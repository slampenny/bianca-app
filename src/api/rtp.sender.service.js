// src/services/rtp.sender.service.js

const dgram = require('dgram');
const { Buffer } = require('buffer');
const logger = require('../config/logger'); // Ensure this path is correct for your project
const AudioUtils = require('./audio.utils'); // Ensure this path is correct for your project

/**
 * RTP Sender Service - Sends audio TO Asterisk via ExternalMedia
 * This handles the "write" direction: App → Asterisk
 */
class RtpSenderService {
    constructor() {
        this.activeCalls = new Map(); // callId -> call config
        this.udpSockets = new Map(); // callId -> UDP socket
        this.sequenceNumbers = new Map(); // callId -> current sequence number
        this.timestamps = new Map(); // callId -> current timestamp for the start of the next batch
        this.ssrcs = new Map(); // callId -> SSRC
        
        // RTP Constants
        this.RTP_VERSION = 2;
        this.RTP_PAYLOAD_TYPE_ULAW = 0;     // PCMU (uLaw)
        this.RTP_PAYLOAD_TYPE_SLIN16_8K = 11; // L16/8000/1 (for 8kHz 16-bit PCM)
        this.RTP_SEND_FORMAT = 'ulaw';       // Default format for sending audio to Asterisk
        this.SAMPLE_RATE = 8000;          // 8kHz for telephone quality audio we send to Asterisk
        this.FRAME_SIZE_MS = 20;          // 20ms frames
        this.SAMPLES_PER_FRAME = (this.SAMPLE_RATE * this.FRAME_SIZE_MS) / 1000; // 160 samples for 8kHz 20ms
        
        logger.info('[RTP Sender] Service initialized');
    }

    /**
     * Initialize a call for RTP sending
     */
    async initializeCall(callId, config) {
        if (this.activeCalls.has(callId) && this.activeCalls.get(callId).initialized) {
            logger.warn(`[RTP Sender] Call ${callId} already initialized. Current config for this callId exists.`);
            return;
        }

        logger.info(`[RTP Sender] Initializing call ${callId} with config:`, {
            asteriskChannelId: config.asteriskChannelId,
            rtpHost: config.rtpHost,
            rtpPort: config.rtpPort,
            format: this.RTP_SEND_FORMAT // Expected: 'ulaw' or 'slin' (for 8kHz PCM16)
        });

        const ssrc = Math.floor(Math.random() * 0xFFFFFFFF);
        const initialSequence = Math.floor(Math.random() * 0xFFFF);
        const initialTimestamp = Math.floor(Math.random() * 0xFFFFFFFF); 
        
        this.activeCalls.set(callId, {
            ...config,
            ssrc, 
            initialized: true
        });
        
        this.sequenceNumbers.set(callId, initialSequence);
        this.timestamps.set(callId, initialTimestamp); 
        this.ssrcs.set(callId, ssrc);

        const socket = dgram.createSocket('udp4');
        this.udpSockets.set(callId, socket);

        socket.on('error', (err) => {
            logger.error(`[RTP Sender] Socket error for ${callId}: ${err.message}`, err.stack);
            this.cleanupCall(callId);
        });

        logger.info(`[RTP Sender] Call ${callId} initialized. SSRC: ${ssrc}, Initial Seq: ${initialSequence}, Initial TS: ${initialTimestamp}, Target Format: ${config.format}`);
    }

    /**
     * Send audio data (expected as 8kHz uLaw base64 from openai.realtime.service.js) to Asterisk
     */
    async sendAudio(callId, audioBase64Ulaw) {
        if (!audioBase64Ulaw || audioBase64Ulaw.length === 0) {
            logger.debug(`[RTP Sender] sendAudio (${callId}): Empty audioBase64Ulaw received. Skipping.`);
            return;
        }

        const callConfig = this.activeCalls.get(callId);
        if (!callConfig || !callConfig.initialized) {
            logger.warn(`[RTP Sender] sendAudio (${callId}): Call not initialized or config missing. Skipping audio send.`);
            return;
        }

        const socket = this.udpSockets.get(callId);
        if (!socket) {
            logger.error(`[RTP Sender] sendAudio (${callId}): No UDP socket found for call. Skipping audio send.`);
            return;
        }

        try {
            const ulawBuffer = Buffer.from(audioBase64Ulaw, 'base64');
            if (ulawBuffer.length === 0) {
                logger.warn(`[RTP Sender] sendAudio (${callId}): Decoded uLaw buffer is empty. Original base64 length: ${audioBase64Ulaw.length}. Skipping.`);
                return;
            }
            
            let audioPayload;
            if (callConfig.format === 'slin') { 
                audioPayload = await AudioUtils.convertUlawToPcm(ulawBuffer); 
                logger.debug(`[RTP Sender] sendAudio (${callId}): Converted uLaw (len ${ulawBuffer.length}) to SLIN (len ${audioPayload?.length}) for Asterisk.`);
            } else if (callConfig.format === 'ulaw') { 
                audioPayload = ulawBuffer;
                logger.debug(`[RTP Sender] sendAudio (${callId}): Using uLaw directly (len ${ulawBuffer.length}) for Asterisk.`);
            } else {
                logger.warn(`[RTP Sender] sendAudio (${callId}): Unsupported target format '${callConfig.format}', defaulting to uLaw.`);
                audioPayload = ulawBuffer;
            }

            if (!audioPayload || audioPayload.length === 0) {
                logger.warn(`[RTP Sender] sendAudio (${callId}): Audio payload for Asterisk is empty after processing (format: ${callConfig.format}). Skipping.`);
                return;
            }
            await this.sendAudioFrames(callId, audioPayload, socket, callConfig);
        } catch (err) {
            logger.error(`[RTP Sender] sendAudio (${callId}): Error processing or sending audio: ${err.message}`, err.stack);
        }
    }

    /**
     * Split audio into RTP packets and send them
     */
    async sendAudioFrames(callId, audioBuffer, socket, callConfig) {
        const bytesPerSample = callConfig.format === 'slin' ? 2 : 1;
        const bytesPerFrame = this.SAMPLES_PER_FRAME * bytesPerSample;
        
        let offset = 0;
        const promises = [];
        let framesSentThisBatch = 0;

        let currentFrameTimestamp = this.timestamps.get(callId);
        logger.debug(`[RTP Sender] sendAudioFrames (${callId}): Fetched initial TS from map: ${currentFrameTimestamp} (type: ${typeof currentFrameTimestamp})`);

        // More robust check for validity of the fetched timestamp
        if (typeof currentFrameTimestamp !== 'number' || 
            isNaN(currentFrameTimestamp) || 
            currentFrameTimestamp < 0 || 
            currentFrameTimestamp > 0xFFFFFFFF) { 

            logger.error(`[RTP Sender] sendAudioFrames (${callId}): Timestamp from map is invalid (value: ${currentFrameTimestamp}, type: ${typeof currentFrameTimestamp}). Re-initializing TS.`);
            currentFrameTimestamp = Math.floor(Math.random() * 0xFFFFFFFF);
            this.timestamps.set(callId, currentFrameTimestamp); 
            logger.warn(`[RTP Sender] sendAudioFrames (${callId}): Timestamp re-initialized to ${currentFrameTimestamp}.`);
        }
        
        logger.debug(`[RTP Sender] sendAudioFrames (${callId}): Starting batch with initial TS: ${currentFrameTimestamp}. Audio buffer length: ${audioBuffer.length}, bytesPerFrame: ${bytesPerFrame}`);

        while (offset < audioBuffer.length) {
            const frameSize = Math.min(bytesPerFrame, audioBuffer.length - offset);
            const frameData = audioBuffer.slice(offset, offset + frameSize);
            
            if (frameData.length > 0) {
                // Log the timestamp *before* it's passed to createRtpPacket
                logger.debug(`[RTP Sender] sendAudioFrames (${callId}): PRE-CREATE - currentFrameTimestamp for this frame: ${currentFrameTimestamp} (Type: ${typeof currentFrameTimestamp})`);
                
                const rtpPacket = this.createRtpPacket(callId, frameData, callConfig, currentFrameTimestamp);
                if (rtpPacket) {
                    promises.push(this.sendRtpPacket(socket, rtpPacket, callConfig.rtpHost, callConfig.rtpPort));
                    framesSentThisBatch++;
                    
                    // Increment and wrap timestamp for the *next* frame in this batch
                    const prevTimestampForLog = currentFrameTimestamp;
                    currentFrameTimestamp = (currentFrameTimestamp + this.SAMPLES_PER_FRAME) >>> 0; // Use zero-fill right shift
                    logger.debug(`[RTP Sender] sendAudioFrames (${callId}): Timestamp updated. Prev_used: ${prevTimestampForLog}, SamplesAdded: ${this.SAMPLES_PER_FRAME}, NewTS_for_next_frame: ${currentFrameTimestamp}`);

                } else {
                    logger.error(`[RTP Sender] sendAudioFrames (${callId}): Failed to create RTP packet for a frame. Skipping this frame.`);
                }
            }
            offset += frameSize;
        }

        if (framesSentThisBatch > 0) {
            // Store the timestamp that will be used as the starting point for the *next batch* of audio
            this.timestamps.set(callId, currentFrameTimestamp); 
            logger.debug(`[RTP Sender] sendAudioFrames (${callId}): Finished batch. Next starting TS for call will be ${currentFrameTimestamp}. Sent ${framesSentThisBatch} frames this batch.`);
        }
        
        if (promises.length > 0) {
            try {
                await Promise.all(promises);
            } catch (sendAllError) {
                 logger.error(`[RTP Sender] sendAudioFrames (${callId}): Error sending one or more RTP packets in batch: ${sendAllError.message}`, sendAllError.stack);
            }
        } else if (audioBuffer.length > 0) {
            logger.warn(`[RTP Sender] sendAudioFrames (${callId}): Audio buffer had length ${audioBuffer.length} but no frames were prepared or sent.`);
        }
    }

    createRtpPacket(callId, audioData, callConfig, frameTimestamp) {
        let sequenceNumber = this.sequenceNumbers.get(callId);
        const ssrc = this.ssrcs.get(callId);

        // Check if essential parameters are valid numbers
        if (typeof sequenceNumber !== 'number' || isNaN(sequenceNumber) ||
            typeof frameTimestamp !== 'number' || isNaN(frameTimestamp) || 
            typeof ssrc !== 'number' || isNaN(ssrc)) {
            logger.error(`[RTP Sender] createRtpPacket (${callId}): CRITICAL - Undefined or NaN RTP param! Seq: ${sequenceNumber}, TS: ${frameTimestamp}, SSRC: ${ssrc}. Cannot create packet.`);
            return null; 
        }

        // Validate ranges (frameTimestamp should now be positive due to >>> 0 in caller)
        if (frameTimestamp < 0 || frameTimestamp > 0xFFFFFFFF) {
            logger.error(`[RTP Sender] CRITICAL ERROR createRtpPacket (${callId}): Invalid frameTimestamp value before write: ${frameTimestamp}. This indicates an issue with timestamp calculation. Forcing to 0 as fallback, but this needs investigation.`);
            frameTimestamp = 0; 
        }
        if (ssrc < 0 || ssrc > 0xFFFFFFFF) { 
             logger.error(`[RTP Sender] CRITICAL ERROR createRtpPacket (${callId}): Invalid SSRC value before write: ${ssrc}. SSRC: ${ssrc}. Cannot create packet, SSRC is fundamental.`);
             return null; 
        }
        if (sequenceNumber < 0 || sequenceNumber > 0xFFFF) { 
            logger.error(`[RTP Sender] CRITICAL ERROR createRtpPacket (${callId}): Invalid sequenceNumber value before write: ${sequenceNumber}. Forcing to 0 as fallback.`);
            sequenceNumber = 0; 
        }


        logger.debug(`[RTP Sender] createRtpPacket (${callId}): Values for RTP Header -> Seq: ${sequenceNumber}, TS: ${frameTimestamp}, SSRC: ${ssrc}, AudioLen: ${audioData.length}, TargetFormat: ${callConfig.format}`);

        const header = Buffer.alloc(12);
        
        header[0] = (this.RTP_VERSION << 6); 
        
        const payloadType = callConfig.format === 'slin' ? this.RTP_PAYLOAD_TYPE_SLIN16_8K : this.RTP_PAYLOAD_TYPE_ULAW;
        header[1] = payloadType; 
        
        header.writeUInt16BE(sequenceNumber, 2);
        header.writeUInt32BE(frameTimestamp, 4); 
        header.writeUInt32BE(ssrc, 8);

        this.sequenceNumbers.set(callId, (sequenceNumber + 1) & 0xFFFF); 

        return Buffer.concat([header, audioData]);
    }

    async sendRtpPacket(socket, rtpPacket, host, port) {
        return new Promise((resolve, reject) => {
            socket.send(rtpPacket, 0, rtpPacket.length, port, host, (err, bytes) => {
                if (err) {
                    logger.error(`[RTP Sender] UDP send error to ${host}:${port} : ${err.message}`, err);
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    cleanupCall(callId) {
        logger.info(`[RTP Sender] Cleaning up call ${callId}`);
        const socket = this.udpSockets.get(callId);
        if (socket) {
            try { 
                socket.close((closeErr) => { 
                    if (closeErr) logger.warn(`[RTP Sender] Error reported during socket.close() for ${callId}: ${closeErr.message}`);
                });
            } catch (e) { 
                logger.warn(`[RTP Sender] Exception during socket.close() attempt for ${callId}: ${e.message}`);
            }
            this.udpSockets.delete(callId);
        }

        this.activeCalls.delete(callId);
        this.sequenceNumbers.delete(callId);
        this.timestamps.delete(callId);
        this.ssrcs.delete(callId);
        logger.info(`[RTP Sender] Cleanup completed for ${callId}`);
    }

    cleanupAll() {
        logger.info(`[RTP Sender] Cleaning up all calls (${this.activeCalls.size} active)`);
        const callIds = [...this.activeCalls.keys()]; 
        for (const callId of callIds) {
            this.cleanupCall(callId);
        }
        logger.info('[RTP Sender] All calls cleaned up');
    }

    getStatus() {
        const callDetails = [];
        for (const [callId, config] of this.activeCalls.entries()) {
            callDetails.push({
                callId,
                rtpHost: config.rtpHost,
                rtpPort: config.rtpPort,
                format: config.format,
                ssrc: this.ssrcs.get(callId), 
                initialized: config.initialized,
                currentSequenceNumber: this.sequenceNumbers.get(callId),
                nextTimestamp: this.timestamps.get(callId) 
            });
        }
        return {
            activeCallsCount: this.activeCalls.size,
            calls: callDetails
        };
    }
}

const rtpSenderService = new RtpSenderService();

// Optional: Graceful shutdown hooks. Handle in your main application if preferred.
// function gracefulShutdown() {
//     logger.info('[RTP Sender] Received signal for shutdown. Cleaning up all calls.');
//     rtpSenderService.cleanupAll();
//     setTimeout(() => process.exit(0), 1000); 
// }
// process.on('SIGTERM', gracefulShutdown);
// process.on('SIGINT', gracefulShutdown);

module.exports = rtpSenderService;
