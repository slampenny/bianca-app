// src/services/channel.tracker.js

const logger = require('../config/logger');

class ChannelTracker {
    constructor() {
        this.calls = new Map(); // Key: asteriskChannelId, Value: call state object
        this.uuidToChannelId = new Map(); // Key: audioSocketUuid, Value: asteriskChannelId
        logger.info('[Tracker] ChannelTracker initialized.');
    }

    addCall(asteriskChannelId, initialData) {
        if (this.calls.has(asteriskChannelId)) {
            logger.warn(`[Tracker] Attempted to add existing channel ID: ${asteriskChannelId}. Overwriting data.`);
        }
        const callData = {
            asteriskChannelId: asteriskChannelId,
            mainChannel: initialData.channel || null,
            twilioSid: initialData.twilioSid || null,
            patientId: initialData.patientId || null,
            startTime: new Date(),
            state: 'init',
            mainBridge: null,
            mainBridgeId: null,
            conversationId: null,
            recordingName: null,
            snoopChannel: null,
            snoopChannelId: null,
            snoopBridge: null,
            snoopBridgeId: null,
            audioSocketUuid: null,
            localChannel: null,
            localChannelId: null,
            ...initialData, // Apply passed initial data
        };
        this.calls.set(asteriskChannelId, callData);
        logger.info(`[Tracker] Added call: ${asteriskChannelId}`);
        this.logState(); // Log state after adding
        return callData;
    }

    getCall(asteriskChannelId) {
        return this.calls.get(asteriskChannelId);
    }

    updateCall(asteriskChannelId, updates) {
        const callData = this.calls.get(asteriskChannelId);
        if (callData) {
            Object.assign(callData, updates);
            // logger.debug(`[Tracker] Updated call ${asteriskChannelId}: ${JSON.stringify(updates)}`);
        } else {
            logger.warn(`[Tracker] Attempted to update non-existent channel ID: ${asteriskChannelId}`);
        }
        return callData;
    }

    addAudioSocketMapping(asteriskChannelId, audioSocketUuid) {
        const callData = this.getCall(asteriskChannelId);
        if (callData) {
            if(callData.audioSocketUuid && callData.audioSocketUuid !== audioSocketUuid) {
                 logger.warn(`[Tracker] Overwriting existing UUID mapping for ${asteriskChannelId}. Old: ${callData.audioSocketUuid}, New: ${audioSocketUuid}`);
            }
            if (this.uuidToChannelId.has(audioSocketUuid) && this.uuidToChannelId.get(audioSocketUuid) !== asteriskChannelId) {
                logger.warn(`[Tracker] UUID ${audioSocketUuid} is already mapped to a different channel (${this.uuidToChannelId.get(audioSocketUuid)}). Overwriting mapping to ${asteriskChannelId}.`);
            }
            callData.audioSocketUuid = audioSocketUuid;
            this.uuidToChannelId.set(audioSocketUuid, asteriskChannelId);
            logger.info(`[Tracker] Mapped UUID ${audioSocketUuid} to channel ${asteriskChannelId}`);
            this.logState(); // Log state after mapping
        } else {
             logger.error(`[Tracker] Cannot add UUID mapping, channel not found: ${asteriskChannelId}`);
        }
    }

    // Renamed for clarity - used by AudioSocket service
    findParentChannelIdByUuid(audioSocketUuid) {
        const cleanUuid = audioSocketUuid ? audioSocketUuid.trim() : null;
        if (!cleanUuid) return null;
        return this.uuidToChannelId.get(cleanUuid);
    }

    removeCall(asteriskChannelId) {
        const callData = this.calls.get(asteriskChannelId);
        let uuidToRemove = null;
        if (callData && callData.audioSocketUuid) {
             uuidToRemove = callData.audioSocketUuid;
        }

        // Remove the main call entry
        const deleted = this.calls.delete(asteriskChannelId);

        // If the main call was found and had a UUID, remove the reverse mapping
        if (uuidToRemove) {
             if(this.uuidToChannelId.get(uuidToRemove) === asteriskChannelId) {
                  this.uuidToChannelId.delete(uuidToRemove);
                  logger.debug(`[Tracker] Removed UUID mapping for ${uuidToRemove}`);
             } else {
                 // This case might happen if mappings were overwritten - log it
                 logger.warn(`[Tracker] UUID ${uuidToRemove} was not mapped to the channel being removed (${asteriskChannelId}) during cleanup.`);
             }
        }

        if (deleted) {
            logger.info(`[Tracker] Removed call: ${asteriskChannelId}`);
            this.logState(); // Log state after removal
        } else {
             logger.warn(`[Tracker] Attempted to remove non-existent channel ID: ${asteriskChannelId}`);
        }
        return deleted;
    }

    // Helper to get active channel/bridge objects for cleanup
    // Ensures we return null if callData doesn't exist
    getResources(asteriskChannelId) {
        const callData = this.getCall(asteriskChannelId);
        return callData ? {
            mainChannel: callData.mainChannel,
            mainBridge: callData.mainBridge,
            snoopChannel: callData.snoopChannel,
            snoopBridge: callData.snoopBridge,
            localChannel: callData.localChannel,
            conversationId: callData.conversationId,
            twilioSid: callData.twilioSid,
            asteriskChannelId: callData.asteriskChannelId
        } : null;
    }

    // Debugging helper
    logState() {
        try {
             logger.debug(`[Tracker State] Calls: ${JSON.stringify(Array.from(this.calls.keys()))}, UUIDs Mapped: ${JSON.stringify(Array.from(this.uuidToChannelId.keys()))}`);
        } catch (e) {
             logger.warn(`[Tracker State] Error logging state: ${e.message}`); // Avoid crashing logger
        }
    }
}

// Export a single instance (Singleton)
const channelTrackerInstance = new ChannelTracker();
module.exports = channelTrackerInstance;