// src/services/channel.tracker.js

const logger = require('../config/logger');
const portManager = require('./port.manager.service');

class ChannelTracker {
    constructor() {
        this.calls = new Map(); // Key: asteriskChannelId (main channel), Value: call state object
        // Map AudioSocket UUID back to main Asterisk Channel ID (if using AudioSocket)
        this.uuidToChannelId = new Map();
        
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
                    // Auto-release the port
                    portManager.releasePort(stuckPort.port, stuckPort.callId);
                }
            }
        });
        
        portManager.on('ports-exhausted', () => {
            logger.error('[Tracker] Port pool exhausted! Check for leaked ports.');
            this.performPortAudit();
        });
    }

    /**
     * Adds a new call (main channel) to the tracker.
     * @param {string} asteriskChannelId - The main Asterisk Channel ID.
     * @param {object} initialData - Initial data including channel object, twilioCallSid, patientId.
     */
    addCall(asteriskChannelId, initialData) {
        if (this.calls.has(asteriskChannelId)) {
            logger.warn(`[Tracker] Attempted to add existing main channel ID: ${asteriskChannelId}. Overwriting data.`);
            // Clean up any existing port allocation
            const existingCall = this.calls.get(asteriskChannelId);
            if (existingCall.rtpPort) {
                portManager.releasePort(existingCall.rtpPort, asteriskChannelId);
            }
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
            
            ffmpegTranscoder: null, // Reference to FFmpeg process if using that method

            ...initialData, // Apply any other passed initial data
            rtpPort: rtpPort, // Ensure rtpPort is set after spread
        };
        
        this.calls.set(asteriskChannelId, callData);
        logger.info(`[Tracker] Added call: ${asteriskChannelId} (TwilioCallSid: ${callData.twilioCallSid || 'N/A'}, RTPPort: ${rtpPort || 'N/A'})`);
        this.logState();
        return callData;
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
            // Handle RTP port updates
            if (updates.rtpPort !== undefined && updates.rtpPort !== callData.rtpPort) {
                // Release old port if exists
                if (callData.rtpPort) {
                    portManager.releasePort(callData.rtpPort, asteriskChannelId);
                }
                // Acquire new port if specified
                if (updates.rtpPort === 'acquire') {
                    updates.rtpPort = portManager.acquirePort(asteriskChannelId, {
                        asteriskChannelId,
                        twilioCallSid: callData.twilioCallSid,
                        patientId: callData.patientId
                    });
                }
            }
            
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
        
        // ✅ Port release is now handled by ari.client.js's cleanupChannel, so we remove it from here
        // to prevent double-releases or errors.

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
            mainChannel: callData.mainChannel,
            mainBridge: callData.mainBridge,
            mainBridgeId: callData.mainBridgeId,
            snoopChannel: callData.snoopChannel,
            snoopChannelId: callData.snoopChannelId,
            snoopBridge: callData.snoopBridge,
            snoopBridgeId: callData.snoopBridgeId,
            localChannel: callData.localChannel,
            localChannelId: callData.localChannelId,
            playbackChannel: callData.playbackChannel,
            playbackChannelId: callData.playbackChannelId,
            inboundRtpChannel: callData.inboundRtpChannel,
            inboundRtpChannelId: callData.inboundRtpChannelId,
            outboundRtpChannel: callData.outboundRtpChannel,
            outboundRtpChannelId: callData.outboundRtpChannelId,
            unicastRtpChannel: callData.unicastRtpChannel,
            unicastRtpChannelId: callData.unicastRtpChannelId,
            conversationId: callData.conversationId,
            twilioCallSid: callData.twilioCallSid,
            asteriskChannelId: callData.asteriskChannelId,
            ffmpegTranscoder: callData.ffmpegTranscoder,
            recordingName: callData.recordingName,
            asteriskRtpEndpoint: callData.asteriskRtpEndpoint,
            rtpReadPort: callData.rtpReadPort,   // ✅ Explicit
            rtpWritePort: callData.rtpWritePort,
            rtpListener: callData.rtpListener,
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
     * Find call data by RTP port
     * @param {number} rtpPort
     * @returns {object | null} - Returns { asteriskChannelId, ...callData } or null
     */
    findCallByRtpPort(rtpPort) {
        if (!rtpPort) return null;
        for (const [asteriskId, data] of this.calls.entries()) {
            // ✅ Only check the explicit read and write ports
            if (data.rtpReadPort === rtpPort || data.rtpWritePort === rtpPort) {
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
            portsAllocated: 0
        };

        for (const callData of this.calls.values()) {
            // Count by state
            const state = callData.state || 'unknown';
            stats.callsByState[state] = (stats.callsByState[state] || 0) + 1;

            // Count by snoop method
            const method = callData.snoopMethod || 'none';
            stats.callsBySnoopMethod[method] = (stats.callsBySnoopMethod[method] || 0) + 1;
            
            // Count ports
            if (callData.rtpPort) {
                stats.portsAllocated++;
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
            callsInTerminalStateWithPorts: []
        };
        
        // Check all tracked calls
        for (const [asteriskId, callData] of this.calls.entries()) {
            if (callData.rtpPort) {
                audit.trackedCallsWithPorts.push({
                    asteriskChannelId: asteriskId,
                    twilioCallSid: callData.twilioCallSid,
                    port: callData.rtpPort,
                    state: callData.state,
                    duration: Math.round((Date.now() - callData.startTime) / 1000)
                });
                
                if (this.isCallInTerminalState(asteriskId)) {
                    audit.callsInTerminalStateWithPorts.push({
                        asteriskChannelId: asteriskId,
                        port: callData.rtpPort,
                        state: callData.state
                    });
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
                    // Release port through removeCall which handles cleanup
                    this.removeCall(terminalCall.asteriskChannelId);
                    cleanup.callsRemoved++;
                    logger.info(`[Tracker] Removed terminal call ${terminalCall.asteriskChannelId} and released port ${terminalCall.port}`);
                } catch (error) {
                    cleanup.errors.push({ 
                        type: 'call_removal', 
                        asteriskChannelId: terminalCall.asteriskChannelId, 
                        error: error.message 
                    });
                }
            } else {
                logger.warn(`[Tracker] Call ${terminalCall.asteriskChannelId} in terminal state '${terminalCall.state}' still has port ${terminalCall.port}`);
            }
        }
        
        if (cleanup.errors.length > 0) {
            logger.error('[Tracker] Cleanup encountered errors:', cleanup.errors);
        }
        
        logger.info(`[Tracker] Cleanup complete. Ports released: ${cleanup.portsReleased}, Calls removed: ${cleanup.callsRemoved}`);
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
        if (callData.rtpPort) {
            const portInfo = portManager.getLeaseInfo(callData.rtpPort);
            details.portInfo = portInfo || { error: 'Port lease not found in manager' };
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
            terminalCallsWithPorts: audit.callsInTerminalStateWithPorts.length
        });
        
        // Release all ports
        for (const [asteriskId, callData] of this.calls.entries()) {
            if (callData.rtpPort) {
                portManager.releasePort(callData.rtpPort, asteriskId);
            }
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