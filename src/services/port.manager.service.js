// src/services/port.manager.service.js
const logger = require('../config/logger');
const config = require('../config/config');
const EventEmitter = require('events');

class PortManager extends EventEmitter {
    constructor() {
        super();
        
        // Get port range from config, e.g., "10000-20000"
        const [portStart, portEnd] = (config.app?.rtpPortRange || "16384-16484")
            .split('-').map(Number);
        
        this.RTP_PORT_START = portStart;
        this.RTP_PORT_END = portEnd;
        
        // Port pools
        this.availablePorts = new Set();
        this.leasedPorts = new Map(); // port -> { callId, timestamp, metadata }
        
        // Initialize the pool of available ports (even ports for RTP)
        for (let i = this.RTP_PORT_START; i <= this.RTP_PORT_END; i += 2) {
            this.availablePorts.add(i);
        }
        
        // Periodic health check for stuck ports
        this.healthCheckInterval = setInterval(() => {
            this.performHealthCheck();
        }, 60000); // Every minute
        
        logger.info(`[PortManager] Initialized with ${this.availablePorts.size} available ports in range ${this.RTP_PORT_START}-${this.RTP_PORT_END}`);
    }
    
    /**
     * Acquires a unique, available UDP port from the pool.
     * @param {string} callId - Identifier for the call (Asterisk channel ID or Twilio SID)
     * @param {object} metadata - Optional metadata about the port usage
     * @returns {number | null} The acquired port number, or null if none are available.
     */
    acquirePort(callId, metadata = {}) {
        if (!callId) {
            logger.error('[PortManager] Cannot acquire port without callId');
            return null;
        }
        
        // Check if this call already has a port
        const existingPort = this.findPortByCallId(callId);
        if (existingPort) {
            logger.warn(`[PortManager] Call ${callId} already has port ${existingPort} leased`);
            return existingPort;
        }
        
        if (this.availablePorts.size === 0) {
            logger.error('[PortManager] No available RTP ports to lease.');
            this.emit('ports-exhausted');
            return null;
        }
        
        const port = this.availablePorts.values().next().value;
        this.availablePorts.delete(port);
        
        const leaseInfo = {
            callId,
            timestamp: Date.now(),
            metadata: {
                ...metadata,
                asteriskChannelId: metadata.asteriskChannelId || callId,
                twilioCallSid: metadata.twilioCallSid
            }
        };
        
        this.leasedPorts.set(port, leaseInfo);
        
        logger.info(`[PortManager] Acquired port ${port} for call ${callId}. Available: ${this.availablePorts.size}, Leased: ${this.leasedPorts.size}`);
        this.emit('port-acquired', { port, callId, leaseInfo });
        
        return port;
    }
    
    /**
     * Releases a port, returning it to the pool of available ports.
     * @param {number} port - The port number to release
     * @param {string} callId - Optional callId for verification
     * @returns {boolean} True if port was released, false otherwise
     */
    releasePort(port, callId = null) {
        const leaseInfo = this.leasedPorts.get(port);
        
        if (!leaseInfo) {
            logger.warn(`[PortManager] Attempted to release port ${port} which was not leased.`);
            return false;
        }
        
        // Verify callId if provided
        if (callId && leaseInfo.callId !== callId) {
            logger.error(`[PortManager] Call ID mismatch when releasing port ${port}. Expected: ${leaseInfo.callId}, Got: ${callId}`);
            return false;
        }
        
        this.leasedPorts.delete(port);
        this.availablePorts.add(port);
        
        const leaseDuration = Date.now() - leaseInfo.timestamp;
        logger.info(`[PortManager] Released port ${port} from call ${leaseInfo.callId}. Lease duration: ${Math.round(leaseDuration / 1000)}s. Available: ${this.availablePorts.size}`);
        
        this.emit('port-released', { port, callId: leaseInfo.callId, duration: leaseDuration });
        return true;
    }
    
    /**
     * Release port by call ID
     * @param {string} callId - The call identifier
     * @returns {number | null} The port that was released, or null if not found
     */
    releasePortByCallId(callId) {
        if (!callId) return null;
        
        for (const [port, leaseInfo] of this.leasedPorts.entries()) {
            if (leaseInfo.callId === callId) {
                this.releasePort(port);
                return port;
            }
        }
        
        logger.debug(`[PortManager] No port found for call ${callId} to release`);
        return null;
    }
    
    /**
     * Find port by call ID
     * @param {string} callId
     * @returns {number | null}
     */
    findPortByCallId(callId) {
        if (!callId) return null;
        
        for (const [port, leaseInfo] of this.leasedPorts.entries()) {
            if (leaseInfo.callId === callId) {
                return port;
            }
        }
        return null;
    }
    
    /**
     * Find call information by port number
     * @param {number} port - The port to look up
     * @returns {object | null} - Returns lease info with callId and metadata
     */
    getCallByPort(port) {
        const leaseInfo = this.leasedPorts.get(port);
        if (leaseInfo) {
            return {
                callId: leaseInfo.callId,
                asteriskChannelId: leaseInfo.metadata.asteriskChannelId,
                twilioCallSid: leaseInfo.metadata.twilioCallSid,
                ...leaseInfo
            };
        }
        return null;
    }
    
    /**
     * Get lease information for a port
     * @param {number} port
     * @returns {object | null}
     */
    getLeaseInfo(port) {
        return this.leasedPorts.get(port) || null;
    }
    
    /**
     * Check if a port is available
     * @param {number} port
     * @returns {boolean}
     */
    isPortAvailable(port) {
        return this.availablePorts.has(port);
    }
    
    /**
     * Check if a port is leased
     * @param {number} port
     * @returns {boolean}
     */
    isPortLeased(port) {
        return this.leasedPorts.has(port);
    }
    
    /**
     * Get statistics about port usage
     * @returns {object}
     */
    getStats() {
        const now = Date.now();
        const leasedDetails = [];
        
        for (const [port, leaseInfo] of this.leasedPorts.entries()) {
            leasedDetails.push({
                port,
                callId: leaseInfo.callId,
                duration: Math.round((now - leaseInfo.timestamp) / 1000),
                metadata: leaseInfo.metadata
            });
        }
        
        return {
            totalPorts: Math.floor((this.RTP_PORT_END - this.RTP_PORT_START) / 2) + 1,
            available: this.availablePorts.size,
            leased: this.leasedPorts.size,
            utilizationPercent: Math.round((this.leasedPorts.size / (this.availablePorts.size + this.leasedPorts.size)) * 100),
            leasedDetails,
            oldestLease: leasedDetails.reduce((oldest, lease) => 
                lease.duration > (oldest?.duration || 0) ? lease : oldest, null
            )
        };
    }
    
    /**
     * Perform health check on leased ports
     * Warns about ports that have been leased for too long
     */
    performHealthCheck() {
        const MAX_LEASE_DURATION = 3600000; // 1 hour in milliseconds
        const now = Date.now();
        const stuckPorts = [];
        
        for (const [port, leaseInfo] of this.leasedPorts.entries()) {
            const duration = now - leaseInfo.timestamp;
            if (duration > MAX_LEASE_DURATION) {
                stuckPorts.push({
                    port,
                    callId: leaseInfo.callId,
                    duration: Math.round(duration / 1000),
                    metadata: leaseInfo.metadata
                });
            }
        }
        
        if (stuckPorts.length > 0) {
            logger.warn(`[PortManager] Health check found ${stuckPorts.length} ports leased for over 1 hour:`, stuckPorts);
            this.emit('stuck-ports-detected', stuckPorts);
        }
    }
    
    /**
     * Force release stuck ports (use with caution)
     * @param {number} maxAge - Maximum age in milliseconds
     * @returns {number} Number of ports released
     */
    forceReleaseOldPorts(maxAge = 3600000) {
        const now = Date.now();
        const released = [];
        
        for (const [port, leaseInfo] of this.leasedPorts.entries()) {
            if (now - leaseInfo.timestamp > maxAge) {
                this.releasePort(port);
                released.push(port);
            }
        }
        
        if (released.length > 0) {
            logger.warn(`[PortManager] Force released ${released.length} old ports: ${released.join(', ')}`);
        }
        
        return released.length;
    }
    
    /**
     * Clean up resources
     */
    destroy() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
        this.removeAllListeners();
        logger.info('[PortManager] Destroyed');
    }
}

// Export singleton instance
const portManagerInstance = new PortManager();
module.exports = portManagerInstance;