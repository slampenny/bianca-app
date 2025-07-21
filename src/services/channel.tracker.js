// src/services/channel.tracker.js

const logger = require('../config/logger');
const portManager = require('./port.manager.service');

class ChannelTracker {
    constructor() {
        this.calls = new Map(); // Key: asteriskChannelId (main channel), Value: call state object
        // Map AudioSocket UUID back to main Asterisk Channel ID (if using AudioSocket)
        this.uuidToChannelId = new Map();
        this.cleanupInProgress = new Set(); // Track calls currently being cleaned up
        
        // Listen to port manager events
        this.setupPortManagerListeners();
        
        logger.info('[Tracker] ChannelTracker initialized.');
    }
    
    /**
     * Set up listeners for port manager events
     */
    setupPortManagerListeners() {
        portManager.on('stuck-ports-detected', (stuckPorts) => {
            logger.warn('[Tracker] Detected stuck ports, checking for orphaned calls');
            for (const stuckPort of stuckPorts) {
                const callData = this.getCallByPrimaryId(stuckPort.callId);
                if (!callData) {
                    logger.error(`[Tracker] Stuck port ${stuckPort.port} for non-existent call ${stuckPort.callId}. Consider force release.`);
                } else if (this.isCallInTerminalState(callData.asteriskChannelId)) {
                    logger.error(`[Tracker] Call ${stuckPort.callId} in terminal state but port ${stuckPort.port} not released!`);
                    // Auto-release the port through proper cleanup
                    this.releasePortsForCall(callData.asteriskChannelId);
                }
            }
        });
        
        portManager.on('ports-exhausted', () => {
            logger.error('[Tracker] Port pool exhausted! Check for leaked ports.');
            this.performPortAudit();
        });
        
        portManager.on('high-utilization', (stats) => {
            logger.warn(`[Tracker] High port utilization detected: ${stats.utilizationPercent}%`);
        });
    }

    /**
     * Adds a new call (main channel) to the tracker.
     * @param {string} asteriskChannelId - The main Asterisk Channel ID.
     * @param {object} initialData - Initial data including channel object, twilioCallSid, patientId.
     */
    addCall(asteriskChannelId, initialData) {
        if (this.calls.has(asteriskChannelId)) {
            logger.warn(`[Tracker] Attempted to add existing main channel ID: ${asteriskChannelId}. Cleaning up existing call first.`);
            // Clean up the existing call properly
            this.removeCall(asteriskChannelId);
        }
        
        const callData = {
            asteriskChannelId: asteriskChannelId,
            mainChannel: initialData.channel || null,
            twilioCallSid: initialData.twilioCallSid || null, // Primary external identifier
            patientId: initialData.patientId || null,
            startTime: new Date(),
            state: initialData.state || 'init', // Initial state
            mainBridge: null,
            mainBridgeId: null,
            conversationId: null, // Mongoose DB conversation _id
            recordingName: null, // Main bridge recording name
            rtpListener: null, // Reference to the dedicated RTP listener instance

            // --- Flag-Based State Properties ---
            isReadStreamReady: false,  // Flag for inbound audio path (user->app)
            isWriteStreamReady: false, // Flag for outbound audio path (app->user)

            // Snoop & Audio Capture Related Fields
            snoopMethod: null, // 'audiosocket' or 'externalMedia' or 'ffmpeg'
            snoopChannel: null,
            snoopChannelId: null,
            snoopBridge: null, // Only used if bridging snoop to Local for AudioSocket
            snoopBridgeId: null,
            audioSocketUuid: null, // Only used for AudioSocket method
            localChannel: null,    // Only used for AudioSocket method
            localChannelId: null,
            
            // External Media RTP Fields
            rtpSessionId: null, // RTP session identifier
            pendingSnoopId: null,
            pendingPlaybackId: null,
            playbackChannel: null,
            playbackChannelId: null,
            inboundRtpChannel: null,
            inboundRtpChannelId: null,
            outboundRtpChannel: null,
            outboundRtpChannelId: null,
            unicastRtpChannel: null,
            unicastRtpChannelId: null,
            asteriskRtpEndpoint: null, // { host, port }
            snoopToRtpMapping: null,
            
            // Port management - MANAGED BY THIS TRACKER
            rtpReadPort: null,    // Explicit read port for this call
            rtpWritePort: null,   // Explicit write port for this call
            
            ffmpegTranscoder: null, // Reference to FFmpeg process if using that method

            ...initialData, // Apply any other passed initial data (but ports are managed here)
        };
        
        this.calls.set(asteriskChannelId, callData);
        logger.info(`[Tracker] Added call: ${asteriskChannelId} (TwilioCallSid: ${callData.twilioCallSid || 'N/A'})`);
        this.logState();
        return callData;
    }

    /**
     * Allocate RTP ports for a call (both read and write)
     * @param {string} asteriskChannelId
     * @returns {object} { readPort, writePort } or { readPort: null, writePort: null } on failure
     */
    allocatePortsForCall(asteriskChannelId) {
        const callData = this.getCall(asteriskChannelId);
        if (!callData) {
            logger.error(`[Tracker] Cannot allocate ports for unknown call: ${asteriskChannelId}`);
            return { readPort: null, writePort: null };
        }

        // Check if read port is already allocated
        if (callData.rtpReadPort) {
            logger.info(`[Tracker] Read port already allocated for ${asteriskChannelId}: read=${callData.rtpReadPort}`);
            return { readPort: callData.rtpReadPort, writePort: null };
        }

        const primarySid = callData.twilioCallSid || asteriskChannelId;
        
        // Allocate only read port (for receiving audio from Asterisk)
        const readPort = portManager.acquirePort(`${primarySid}-read`, {
            asteriskChannelId,
            twilioCallSid: callData.twilioCallSid,
            patientId: callData.patientId,
            direction: 'read'
        });

        if (!readPort) {
            logger.error(`[Tracker] Failed to allocate read port for ${asteriskChannelId}`);
            return { readPort: null, writePort: null };
        }

        // Update call data with allocated read port only
        this.updateCall(asteriskChannelId, {
            rtpReadPort: readPort,
            rtpWritePort: null // No write port needed - we'll use Asterisk's RTP endpoint directly
        });

        logger.info(`[Tracker] Allocated read port for ${asteriskChannelId}: read=${readPort} (write port will use Asterisk's RTP endpoint)`);
        return { readPort, writePort: null };
    }

    /**
     * Release all ports associated with a call
     * @param {string} asteriskChannelId
     * @returns {boolean} True if any ports were released
     */
    releasePortsForCall(asteriskChannelId) {
        const callData = this.getCall(asteriskChannelId);
        if (!callData) {
            logger.debug(`[Tracker] No call data found for ${asteriskChannelId} to release ports`);
            return false;
        }

        const primarySid = callData.twilioCallSid || asteriskChannelId;
        let releasedCount = 0;

        // Release read port only
        if (callData.rtpReadPort) {
            if (portManager.releasePort(callData.rtpReadPort, `${primarySid}-read`)) {
                releasedCount++;
                logger.info(`[Tracker] Released read port ${callData.rtpReadPort} for ${asteriskChannelId}`);
            }
        }

        // Also check for any other ports that might be associated with this call
        const additionalPorts = portManager.releaseAllPortsForCall(primarySid);
        releasedCount += additionalPorts.length;
        
        // Release external ports (from Asterisk) as well
        const externalPorts = portManager.releaseExternalPortsForCall(primarySid);
        releasedCount += externalPorts.length;

        if (releasedCount > 0) {
            // Clear port fields from call data
            this.updateCall(asteriskChannelId, {
                rtpReadPort: null,
                rtpWritePort: null
            });
            
            logger.info(`[Tracker] Released ${releasedCount} total ports for call ${asteriskChannelId} (including ${externalPorts.length} external ports)`);
        }

        return releasedCount > 0;
    }

    /**
     * Retrieves call data using the main Asterisk Channel ID.
     * @param {string} asteriskChannelId
     * @returns {object | undefined}
     */
    getCall(asteriskChannelId) {
        return this.calls.get(asteriskChannelId);
    }

    /**
     * Retrieves call data using the primary identifier (Twilio SID or Asterisk ID).
     * @param {string} callId - The primary identifier (usually Twilio SID).
     * @returns {object | null}
     */
    getCallByPrimaryId(callId) {
        if (!callId) return null;
        // First, check if the callId IS the Asterisk ID (e.g., if Twilio SID was missing)
        let callData = this.getCall(callId);
        if (callData) return callData;

        // If not, iterate to find by Twilio SID
        for (const data of this.calls.values()) {
            if (data.twilioCallSid === callId) {
                return data;
            }
        }
        return null; // Not found
    }

    /**
     * Updates the state object for a given call.
     * @param {string} asteriskChannelId - The main Asterisk Channel ID.
     * @param {object} updates - An object containing fields to update.
     */
    updateCall(asteriskChannelId, updates) {
        const callData = this.calls.get(asteriskChannelId);
        if (callData) {
            // Apply updates directly - port management is handled by dedicated methods
            Object.assign(callData, updates);
            
            // Log state change specifically
            if (updates.state) {
                logger.debug(`[Tracker] State change for ${asteriskChannelId}: ${callData.state} -> ${updates.state}`);
                
                // Check if we're moving to a terminal state
                if (this.isCallInTerminalState(asteriskChannelId)) {
                    logger.debug(`[Tracker] Call ${asteriskChannelId} entered terminal state: ${updates.state}`);
                }
            }
        } else {
            logger.warn(`[Tracker] Update failed: Call ${asteriskChannelId} not found.`);
        }
        return callData;
    }

    /**
     * Maps an AudioSocket UUID to a main Asterisk Channel ID.
     * (Used only if implementing the AudioSocket method).
     * @param {string} asteriskChannelId
     * @param {string} audioSocketUuid
     */
    addAudioSocketMapping(asteriskChannelId, audioSocketUuid) {
        const callData = this.getCall(asteriskChannelId);
        if (callData) {
            // Warn if overwriting existing mappings
            if(callData.audioSocketUuid && callData.audioSocketUuid !== audioSocketUuid) { 
                logger.warn(`[Tracker] Overwriting UUID mapping for ${asteriskChannelId}.`); 
            }
            if (this.uuidToChannelId.has(audioSocketUuid) && this.uuidToChannelId.get(audioSocketUuid) !== asteriskChannelId) { 
                logger.warn(`[Tracker] UUID ${audioSocketUuid} already mapped to ${this.uuidToChannelId.get(audioSocketUuid)}. Overwriting.`); 
            }

            callData.audioSocketUuid = audioSocketUuid;
            this.uuidToChannelId.set(audioSocketUuid, asteriskChannelId);
            logger.info(`[Tracker] Mapped AudioSocket UUID ${audioSocketUuid} to channel ${asteriskChannelId}`);
            this.logState();
        } else {
             logger.error(`[Tracker] Cannot add UUID mapping, channel not found: ${asteriskChannelId}`);
        }
    }

    /**
     * Finds the main Asterisk Channel ID associated with an AudioSocket UUID.
     * (Used only if implementing the AudioSocket method).
     * @param {string} audioSocketUuid
     * @returns {string | undefined}
     */
    findParentChannelIdByUuid(audioSocketUuid) {
        const cleanUuid = audioSocketUuid ? audioSocketUuid.trim() : null;
        if (!cleanUuid) return undefined;
        return this.uuidToChannelId.get(cleanUuid);
    }

    /**
     * Comprehensive cleanup for a call - centralizes all cleanup logic
     * @param {string} asteriskChannelId - The main Asterisk Channel ID.
     * @param {string} reason - Reason for cleanup (for logging)
     * @returns {object} - Cleanup result with success status and errors
     */
    async cleanupCall(asteriskChannelId, reason = "Unknown") {
        // Prevent multiple simultaneous cleanups for the same call
        if (this.cleanupInProgress.has(asteriskChannelId)) {
            logger.warn(`[Tracker] Cleanup already in progress for ${asteriskChannelId}. Skipping duplicate cleanup request. Reason: ${reason}`);
            return { success: false, errors: ['Cleanup already in progress'] };
        }
        
        const callData = this.calls.get(asteriskChannelId);
        
        if (!callData) {
            logger.warn(`[Tracker] Attempted to cleanup non-existent channel ID: ${asteriskChannelId}`);
            return { success: false, errors: ['Call not found'] };
        }
        
        // Mark cleanup as in progress
        this.cleanupInProgress.add(asteriskChannelId);
        
        const cleanupErrors = [];
        const primarySid = callData.twilioCallSid || asteriskChannelId;
        
        logger.info(`[Tracker] Starting comprehensive cleanup for ${asteriskChannelId}. Reason: ${reason}`);
        
        try {
            // Step 1: Cleanup RTP listeners
            if (callData.rtpReadPort) {
                try {
                    const rtpListenerService = require('./rtp.listener.service');
                    rtpListenerService.stopRtpListenerForCall(primarySid);
                    logger.info(`[Tracker] Stopped RTP listener for ${primarySid}`);
                } catch (err) {
                    logger.warn(`[Tracker] Error stopping RTP listener: ${err.message}`);
                    cleanupErrors.push(`RTP listener: ${err.message}`);
                }
            }
            
            // Step 2: Cleanup RTP sender service
            try {
                const rtpSenderService = require('./rtp.sender.service');
                rtpSenderService.cleanupCall(primarySid);
                logger.info(`[Tracker] Cleaned up RTP sender for ${primarySid}`);
            } catch (err) {
                logger.warn(`[Tracker] Error cleaning up RTP sender: ${err.message}`);
                cleanupErrors.push(`RTP sender: ${err.message}`);
            }
            
            // Step 3: Disconnect OpenAI service
            try {
                const openAIService = require('./openai.realtime.service');
                await openAIService.disconnect(primarySid);
                logger.info(`[Tracker] Disconnected OpenAI service for ${primarySid}`);
            } catch (err) {
                logger.warn(`[Tracker] Error disconnecting OpenAI: ${err.message}`);
                cleanupErrors.push(`OpenAI disconnect: ${err.message}`);
            }
            
            // Step 4: Release all ports (including external ports)
            this.releasePortsForCall(asteriskChannelId);
            
            // Step 5: Clean up AudioSocket UUID mapping if it exists
            if (callData.audioSocketUuid) {
                if(this.uuidToChannelId.get(callData.audioSocketUuid) === asteriskChannelId) {
                    this.uuidToChannelId.delete(callData.audioSocketUuid);
                    logger.debug(`[Tracker] Removed AudioSocket UUID mapping for ${callData.audioSocketUuid}`);
                }
            }
            
            // Step 6: Update conversation record in database
            if (callData.conversationId) {
                try {
                    const Conversation = require('../models').Conversation;
                    await Conversation.findByIdAndUpdate(
                        callData.conversationId,
                        {
                            status: 'completed',
                            endTime: new Date(),
                            cleanupReason: reason,
                            cleanupErrors: cleanupErrors.length > 0 ? cleanupErrors : undefined
                        }
                    );
                    logger.info(`[Tracker] Updated conversation record ${callData.conversationId}`);
                } catch (err) {
                    logger.error(`[Tracker] Error updating conversation record: ${err.message}`);
                    cleanupErrors.push(`Conversation update: ${err.message}`);
                }
            }
            
            // Step 7: Remove from tracker
            const deleted = this.calls.delete(asteriskChannelId);
            
            if (deleted) {
                logger.info(`[Tracker] Successfully cleaned up and removed call: ${asteriskChannelId}`);
                this.logState();
            }
            
            // Log summary
            if (cleanupErrors.length > 0) {
                logger.warn(`[Tracker] Cleanup completed with ${cleanupErrors.length} errors for ${asteriskChannelId}: ${cleanupErrors.join(', ')}`);
            } else {
                logger.info(`[Tracker] Successfully completed all cleanup for ${asteriskChannelId}`);
            }
            
            return {
                success: cleanupErrors.length === 0,
                errors: cleanupErrors,
                callId: asteriskChannelId,
                primarySid
            };
            
        } catch (err) {
            logger.error(`[Tracker] Unexpected error during cleanup for ${asteriskChannelId}: ${err.message}`, err);
            cleanupErrors.push(`Unexpected error: ${err.message}`);
            
            // Even on error, try to remove from tracker
            try {
                this.calls.delete(asteriskChannelId);
                logger.info(`[Tracker] Emergency removal from tracker completed for ${asteriskChannelId}`);
            } catch (trackerErr) {
                logger.error(`[Tracker] Failed to remove from tracker: ${trackerErr.message}`);
                cleanupErrors.push(`Tracker removal: ${trackerErr.message}`);
            }
            
            return {
                success: false,
                errors: cleanupErrors,
                callId: asteriskChannelId,
                primarySid
            };
        } finally {
            // Always remove the cleanup flag, regardless of success or failure
            this.cleanupInProgress.delete(asteriskChannelId);
        }
    }
    
    /**
     * Removes a call and its associated mappings from the tracker.
     * @param {string} asteriskChannelId - The main Asterisk Channel ID.
     * @returns {boolean} - True if the call was found and removed.
     */
    removeCall(asteriskChannelId) {
        const callData = this.calls.get(asteriskChannelId);
        
        if (!callData) {
            logger.warn(`[Tracker] Attempted to remove non-existent channel ID: ${asteriskChannelId}`);
            return false;
        }
        
        // Release all ports associated with this call
        this.releasePortsForCall(asteriskChannelId);

        // Clean up AudioSocket UUID mapping if it exists
        if (callData.audioSocketUuid) {
            if(this.uuidToChannelId.get(callData.audioSocketUuid) === asteriskChannelId) {
                this.uuidToChannelId.delete(callData.audioSocketUuid);
                logger.debug(`[Tracker] Removed AudioSocket UUID mapping for ${callData.audioSocketUuid}`);
            }
        }

        const deleted = this.calls.delete(asteriskChannelId);
        
        if (deleted) {
            logger.info(`[Tracker] Removed call: ${asteriskChannelId}`);
            this.logState();
        }
        
        return deleted;
    }

    /**
     * Helper to get active resources for cleanup.
     * @param {string} asteriskChannelId
     * @returns {object | null}
     */
    getResources(asteriskChannelId) {
        const callData = this.getCall(asteriskChannelId);
        return callData ? {
            // Main channel and bridges
            mainChannel: callData.mainChannel,
            mainBridge: callData.mainBridge,
            mainBridgeId: callData.mainBridgeId,
            
            // Auxiliary channels
            snoopChannel: callData.snoopChannel,
            snoopChannelId: callData.snoopChannelId,
            snoopBridge: callData.snoopBridge,
            snoopBridgeId: callData.snoopBridgeId,
            localChannel: callData.localChannel,
            localChannelId: callData.localChannelId,
            playbackChannel: callData.playbackChannel,
            playbackChannelId: callData.playbackChannelId,
            
            // RTP channels
            inboundRtpChannel: callData.inboundRtpChannel,
            inboundRtpChannelId: callData.inboundRtpChannelId,
            outboundRtpChannel: callData.outboundRtpChannel,
            outboundRtpChannelId: callData.outboundRtpChannelId,
            unicastRtpChannel: callData.unicastRtpChannel,
            unicastRtpChannelId: callData.unicastRtpChannelId,
            
            // Database and external IDs
            conversationId: callData.conversationId,
            twilioCallSid: callData.twilioCallSid,
            asteriskChannelId: callData.asteriskChannelId,
            audioSocketUuid: callData.audioSocketUuid,
            
            // Method and state info
            snoopMethod: callData.snoopMethod,
            state: callData.state,
            
            // RTP and media info
            rtpReadPort: callData.rtpReadPort,       // Explicit read port
            rtpWritePort: callData.rtpWritePort,     // Explicit write port
            asteriskRtpEndpoint: callData.asteriskRtpEndpoint,
            rtpListener: callData.rtpListener,
            
            // Other resources
            ffmpegTranscoder: callData.ffmpegTranscoder,
            recordingName: callData.recordingName,
            
            // Readiness flags
            isReadStreamReady: callData.isReadStreamReady,
            isWriteStreamReady: callData.isWriteStreamReady,
        } : null;
    }

    /**
     * Find call data by Twilio Call SID with both ID and data returned
     * @param {string} twilioCallSid
     * @returns {object | null} - Returns { asteriskChannelId, ...callData } or null
     */
    findCallByTwilioCallSid(twilioCallSid) {
        if (!twilioCallSid) return null;
        for (const [asteriskId, data] of this.calls.entries()) {
            if (data.twilioCallSid === twilioCallSid) {
                return { asteriskChannelId: asteriskId, ...data };
            }
        }
        return null;
    }
    
    /**
     * Find call data by RTP port (checks both read and write ports, plus external ports)
     * @param {number} rtpPort
     * @returns {object | null} - Returns { asteriskChannelId, ...callData } or null
     */
    findCallByRtpPort(rtpPort) {
        if (!rtpPort) return null;
        
        // First check explicit ports in call data
        for (const [asteriskId, data] of this.calls.entries()) {
            // Check both explicit read and write ports
            if (data.rtpReadPort === rtpPort || data.rtpWritePort === rtpPort) {
                return { asteriskChannelId: asteriskId, ...data };
            }
        }
        
        // Then check external ports in port manager
        const portManager = require('./port.manager.service');
        const portInfo = portManager.getCallByPort(rtpPort);
        if (portInfo && portInfo.metadata?.source === 'asterisk') {
            // Find the call data for this external port
            const callData = this.getCallByPrimaryId(portInfo.callId);
            if (callData) {
                return { asteriskChannelId: callData.asteriskChannelId, ...callData };
            }
        }
        
        return null;
    }
    
    /**
     * Find call data by UnicastRTP channel ID
     * @param {string} unicastRtpChannelId
     * @returns {object | null} - Returns { asteriskChannelId, ...callData } or null
     */
    findCallByUnicastRtpChannelId(unicastRtpChannelId) {
        if (!unicastRtpChannelId) return null;
        
        for (const [asteriskId, data] of this.calls.entries()) {
            if (data.unicastRtpChannelId === unicastRtpChannelId) {
                return { asteriskChannelId: asteriskId, ...data };
            }
        }
        
        return null;
    }

    /**
     * Debugging helper to log current state.
     */
    logState() {
        try {
            const callSummary = Array.from(this.calls.entries()).map(([id, data]) => ({
                astId: id,
                twilioCallSid: data.twilioCallSid,
                state: data.state,
                snoopMethod: data.snoopMethod,
                snoopId: data.snoopChannelId,
                localId: data.localChannelId,
                playbackId: data.playbackChannelId,
                ssrc: data.rtp_ssrc,
                rtpSession: data.rtpSessionId,
                rtpReadPort: data.rtpReadPort,
                rtpWritePort: data.rtpWritePort,
            }));
            logger.debug(`[Tracker State] Active Calls: ${JSON.stringify(callSummary)}`);
            logger.debug(`[Tracker State] AudioSocket UUIDs Mapped: ${JSON.stringify(Array.from(this.uuidToChannelId.keys()))}`);
            
            // Add port manager stats
            const portStats = portManager.getStats();
            logger.debug(`[Tracker State] Port Usage: ${portStats.leased}/${portStats.totalPorts} (${portStats.utilizationPercent}%)`);
        } catch (e) {
            logger.warn(`[Tracker State] Error logging state: ${e.message}`);
        }
    }

    /**
     * Get statistics about tracked calls
     * @returns {object} Statistics object
     */
    getStats() {
        const stats = {
            totalCalls: this.calls.size,
            callsByState: {},
            callsBySnoopMethod: {},
            audioSocketMappings: this.uuidToChannelId.size,
            portsAllocated: 0,
            callsWithReadPorts: 0,
            callsWithWritePorts: 0,
            callsWithBothPorts: 0
        };

        for (const callData of this.calls.values()) {
            // Count by state
            const state = callData.state || 'unknown';
            stats.callsByState[state] = (stats.callsByState[state] || 0) + 1;

            // Count by snoop method
            const method = callData.snoopMethod || 'none';
            stats.callsBySnoopMethod[method] = (stats.callsBySnoopMethod[method] || 0) + 1;
            
            // Count ports
            if (callData.rtpReadPort) {
                stats.callsWithReadPorts++;
                stats.portsAllocated++;
            }
            if (callData.rtpWritePort) {
                stats.callsWithWritePorts++;
                stats.portsAllocated++;
            }
            if (callData.rtpReadPort && callData.rtpWritePort) {
                stats.callsWithBothPorts++;
            }
        }
        
        // Add port manager stats
        stats.portManager = portManager.getStats();

        return stats;
    }

    /**
     * Find calls in specific states
     * @param {string|string[]} states - State or array of states to search for
     * @returns {Array} Array of call data objects
     */
    findCallsByState(states) {
        const stateArray = Array.isArray(states) ? states : [states];
        const results = [];

        for (const [asteriskId, callData] of this.calls.entries()) {
            if (stateArray.includes(callData.state)) {
                results.push({ asteriskChannelId: asteriskId, ...callData });
            }
        }

        return results;
    }

    /**
     * Check if a call is in a terminal state (cleanup should have happened)
     * @param {string} asteriskChannelId
     * @returns {boolean}
     */
    isCallInTerminalState(asteriskChannelId) {
        const callData = this.getCall(asteriskChannelId);
        if (!callData) return true; // If call doesn't exist, consider it terminal

        const terminalStates = ['cleanup', 'completed', 'failed', 'error'];
        return terminalStates.includes(callData.state);
    }
    
    /**
     * Perform an audit of port allocations
     * @returns {object} Audit results
     */
    performPortAudit() {
        const audit = {
            trackedCallsWithPorts: [],
            orphanedPorts: [],
            callsInTerminalStateWithPorts: [],
            inconsistentPortMappings: []
        };
        
        // Check all tracked calls
        for (const [asteriskId, callData] of this.calls.entries()) {
            const portInfo = {
                asteriskChannelId: asteriskId,
                twilioCallSid: callData.twilioCallSid,
                state: callData.state,
                duration: Math.round((Date.now() - callData.startTime) / 1000),
                ports: []
            };

            if (callData.rtpReadPort) {
                portInfo.ports.push({ port: callData.rtpReadPort, type: 'read' });
            }
            if (callData.rtpWritePort) {
                portInfo.ports.push({ port: callData.rtpWritePort, type: 'write' });
            }

            if (portInfo.ports.length > 0) {
                audit.trackedCallsWithPorts.push(portInfo);
                
                if (this.isCallInTerminalState(asteriskId)) {
                    audit.callsInTerminalStateWithPorts.push(portInfo);
                }

                // Check for inconsistencies between tracker and port manager
                for (const portEntry of portInfo.ports) {
                    const leaseInfo = portManager.getLeaseInfo(portEntry.port);
                    if (!leaseInfo) {
                        audit.inconsistentPortMappings.push({
                            asteriskChannelId: asteriskId,
                            port: portEntry.port,
                            type: portEntry.type,
                            issue: 'Port tracked by call but not leased in port manager'
                        });
                    }
                }
            }
        }
        
        // Check port manager for orphaned ports
        const portStats = portManager.getStats();
        for (const leaseDetail of portStats.leasedDetails) {
            const callData = this.getCallByPrimaryId(leaseDetail.callId);
            if (!callData) {
                audit.orphanedPorts.push({
                    port: leaseDetail.port,
                    callId: leaseDetail.callId,
                    duration: leaseDetail.duration,
                    metadata: leaseDetail.metadata
                });
            }
        }
        
        // Log audit results
        if (audit.orphanedPorts.length > 0) {
            logger.error(`[Tracker] Port audit found ${audit.orphanedPorts.length} orphaned ports:`, audit.orphanedPorts);
        }
        
        if (audit.callsInTerminalStateWithPorts.length > 0) {
            logger.error(`[Tracker] Port audit found ${audit.callsInTerminalStateWithPorts.length} calls in terminal state with unreleased ports:`, 
                audit.callsInTerminalStateWithPorts);
        }

        if (audit.inconsistentPortMappings.length > 0) {
            logger.error(`[Tracker] Port audit found ${audit.inconsistentPortMappings.length} inconsistent port mappings:`, 
                audit.inconsistentPortMappings);
        }
        
        logger.info(`[Tracker] Port audit complete. Tracked calls with ports: ${audit.trackedCallsWithPorts.length}`);
        
        return audit;
    }
    
    /**
     * Clean up orphaned resources based on audit
     * @param {boolean} autoRelease - If true, automatically release orphaned ports
     * @returns {object} Cleanup results
     */
    cleanupOrphanedResources(autoRelease = false) {
        const audit = this.performPortAudit();
        const cleanup = {
            portsReleased: 0,
            callsRemoved: 0,
            inconsistenciesFixed: 0,
            errors: []
        };
        
        // Handle orphaned ports
        for (const orphan of audit.orphanedPorts) {
            if (autoRelease) {
                try {
                    portManager.releasePort(orphan.port, orphan.callId);
                    cleanup.portsReleased++;
                    logger.info(`[Tracker] Released orphaned port ${orphan.port} from call ${orphan.callId}`);
                } catch (error) {
                    cleanup.errors.push({ type: 'port_release', port: orphan.port, error: error.message });
                }
            } else {
                logger.warn(`[Tracker] Found orphaned port ${orphan.port} for call ${orphan.callId} (duration: ${orphan.duration}s)`);
            }
        }
        
        // Handle terminal state calls with ports
        for (const terminalCall of audit.callsInTerminalStateWithPorts) {
            if (autoRelease) {
                try {
                    // Release ports and remove call
                    this.removeCall(terminalCall.asteriskChannelId);
                    cleanup.callsRemoved++;
                    logger.info(`[Tracker] Removed terminal call ${terminalCall.asteriskChannelId} and released its ports`);
                } catch (error) {
                    cleanup.errors.push({ 
                        type: 'call_removal', 
                        asteriskChannelId: terminalCall.asteriskChannelId, 
                        error: error.message 
                    });
                }
            } else {
                logger.warn(`[Tracker] Call ${terminalCall.asteriskChannelId} in terminal state '${terminalCall.state}' still has ports: ${terminalCall.ports.map(p => p.port).join(', ')}`);
            }
        }

        // Handle inconsistent port mappings
        for (const inconsistency of audit.inconsistentPortMappings) {
            if (autoRelease) {
                try {
                    // Clear the port from call data since it's not actually leased
                    const updates = {};
                    if (inconsistency.type === 'read') {
                        updates.rtpReadPort = null;
                    } else if (inconsistency.type === 'write') {
                        updates.rtpWritePort = null;
                    }
                    this.updateCall(inconsistency.asteriskChannelId, updates);
                    cleanup.inconsistenciesFixed++;
                    logger.info(`[Tracker] Fixed inconsistent port mapping for ${inconsistency.asteriskChannelId}, port ${inconsistency.port}`);
                } catch (error) {
                    cleanup.errors.push({ 
                        type: 'inconsistency_fix', 
                        asteriskChannelId: inconsistency.asteriskChannelId, 
                        port: inconsistency.port,
                        error: error.message 
                    });
                }
            } else {
                logger.warn(`[Tracker] Inconsistent port mapping: ${inconsistency.issue} (call: ${inconsistency.asteriskChannelId}, port: ${inconsistency.port})`);
            }
        }
        
        if (cleanup.errors.length > 0) {
            logger.error('[Tracker] Cleanup encountered errors:', cleanup.errors);
        }
        
        logger.info(`[Tracker] Cleanup complete. Ports released: ${cleanup.portsReleased}, Calls removed: ${cleanup.callsRemoved}, Inconsistencies fixed: ${cleanup.inconsistenciesFixed}`);
        return cleanup;
    }
    
    /**
     * Get detailed information about a specific call including port status
     * @param {string} callId - Asterisk channel ID or Twilio SID
     * @returns {object | null}
     */
    getCallDetails(callId) {
        const callData = this.getCallByPrimaryId(callId);
        if (!callData) return null;
        
        const details = { ...callData };
        
        // Add port information if available
        details.portDetails = {};
        if (callData.rtpReadPort) {
            const readPortInfo = portManager.getLeaseInfo(callData.rtpReadPort);
            details.portDetails.read = readPortInfo || { error: 'Port lease not found in manager' };
        }
        if (callData.rtpWritePort) {
            const writePortInfo = portManager.getLeaseInfo(callData.rtpWritePort);
            details.portDetails.write = writePortInfo || { error: 'Port lease not found in manager' };
        }
        
        // Add duration
        details.callDuration = Math.round((Date.now() - callData.startTime) / 1000);
        
        // Add terminal state check
        details.isTerminal = this.isCallInTerminalState(callData.asteriskChannelId);
        
        return details;
    }
    
    /**
     * Gracefully shutdown the tracker
     */
    async shutdown() {
        logger.info('[Tracker] Starting graceful shutdown...');
        
        // Perform final audit
        const audit = this.performPortAudit();
        logger.info('[Tracker] Final audit:', {
            activeCalls: this.calls.size,
            orphanedPorts: audit.orphanedPorts.length,
            terminalCallsWithPorts: audit.callsInTerminalStateWithPorts.length,
            inconsistentMappings: audit.inconsistentPortMappings.length
        });
        
        // Release all ports for all calls
        const allCalls = Array.from(this.calls.keys());
        for (const asteriskId of allCalls) {
            this.releasePortsForCall(asteriskId);
        }
        
        // Clear all mappings
        this.calls.clear();
        this.uuidToChannelId.clear();
        
        logger.info('[Tracker] Shutdown complete');
    }
}

// Export a single instance (Singleton)
const channelTrackerInstance = new ChannelTracker();
module.exports = channelTrackerInstance;