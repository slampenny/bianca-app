// src/services/channel.tracker.js

const logger = require('../config/logger');

class ChannelTracker {
    constructor() {
        this.calls = new Map(); // Key: asteriskChannelId (main channel), Value: call state object
        // Map AudioSocket UUID back to main Asterisk Channel ID (if using AudioSocket)
        this.uuidToChannelId = new Map();
        logger.info('[Tracker] ChannelTracker initialized.');
    }

    /**
     * Adds a new call (main channel) to the tracker.
     * @param {string} asteriskChannelId - The main Asterisk Channel ID.
     * @param {object} initialData - Initial data including channel object, twilioCallSid, patientId.
     */
    addCall(asteriskChannelId, initialData) {
        if (this.calls.has(asteriskChannelId)) {
            logger.warn(`[Tracker] Attempted to add existing main channel ID: ${asteriskChannelId}. Overwriting data.`);
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

            // --- Flag-Based State Properties ---
            isReadStreamReady: false,  // NEW: Flag for inbound audio path (user->app)
            isWriteStreamReady: false, // NEW: Flag for outbound audio path (app->user)

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
            rtpPort: null, // NEW: The unique UDP port for receiving audio for this call
            rtpSessionId: null, // RTP session identifier
            expectingRtpChannel: false,
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
            rtp_ssrc: null, // Learned SSRC for ExternalMedia stream
            awaitingSsrcForRtp: false,
            snoopToRtpMapping: null,
            
            ffmpegTranscoder: null, // Reference to FFmpeg process if using that method

            ...initialData, // Apply any other passed initial data
        };
        this.calls.set(asteriskChannelId, callData);
        logger.info(`[Tracker] Added call: ${asteriskChannelId} (TwilioCallSid: ${callData.twilioCallSid || 'N/A'})`);
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
            Object.assign(callData, updates);
            // Example: Log state change specifically
            if (updates.state) {
                 logger.debug(`[Tracker] State change for ${asteriskChannelId}: ${callData.state} -> ${updates.state}`);
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
            if(callData.audioSocketUuid && callData.audioSocketUuid !== audioSocketUuid) { logger.warn(`[Tracker] Overwriting UUID mapping for ${asteriskChannelId}.`); }
            if (this.uuidToChannelId.has(audioSocketUuid) && this.uuidToChannelId.get(audioSocketUuid) !== asteriskChannelId) { logger.warn(`[Tracker] UUID ${audioSocketUuid} already mapped to ${this.uuidToChannelId.get(audioSocketUuid)}. Overwriting.`); }

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
        let uuidToRemove = null;
        if (callData && callData.audioSocketUuid) { // Check if AudioSocket was used
             uuidToRemove = callData.audioSocketUuid;
        }
        // Note: We don't have a reverse map for SSRC, cleanup handled by RTP listener calling removeSsrcMapping

        const deleted = this.calls.delete(asteriskChannelId);

        // Clean up AudioSocket UUID mapping if it exists
        if (uuidToRemove) {
             if(this.uuidToChannelId.get(uuidToRemove) === asteriskChannelId) {
                   this.uuidToChannelId.delete(uuidToRemove);
                   logger.debug(`[Tracker] Removed AudioSocket UUID mapping for ${uuidToRemove}`);
             } else {
                  logger.warn(`[Tracker] UUID ${uuidToRemove} was not mapped to removed channel ${asteriskChannelId} during cleanup.`);
             }
        }

        if (deleted) {
            logger.info(`[Tracker] Removed call: ${asteriskChannelId}`);
            this.logState();
        } else {
             logger.warn(`[Tracker] Attempted to remove non-existent channel ID: ${asteriskChannelId}`);
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
            rtp_ssrc: callData.rtp_ssrc,
            ffmpegTranscoder: callData.ffmpegTranscoder,
            recordingName: callData.recordingName,
            asteriskRtpEndpoint: callData.asteriskRtpEndpoint,
            rtpPort: callData.rtpPort, // NEW: Ensure port is available for cleanup
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
                 rtpSession: data.rtpSessionId
             }));
             logger.debug(`[Tracker State] Active Calls: ${JSON.stringify(callSummary)}`);
             logger.debug(`[Tracker State] AudioSocket UUIDs Mapped: ${JSON.stringify(Array.from(this.uuidToChannelId.keys()))}`);
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
            audioSocketMappings: this.uuidToChannelId.size
        };

        for (const callData of this.calls.values()) {
            // Count by state
            const state = callData.state || 'unknown';
            stats.callsByState[state] = (stats.callsByState[state] || 0) + 1;

            // Count by snoop method
            const method = callData.snoopMethod || 'none';
            stats.callsBySnoopMethod[method] = (stats.callsBySnoopMethod[method] || 0) + 1;
        }

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
}

// Export a single instance (Singleton)
const channelTrackerInstance = new ChannelTracker();
module.exports = channelTrackerInstance;