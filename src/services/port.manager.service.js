// src/services/port.manager.service.js
const logger = require('../config/logger');
const config = require('../config/config');
const EventEmitter = require('events');

class PortManager extends EventEmitter {
    constructor() {
        super();
        
        // Get port range from config, e.g., "20001-30000"
        const [portStart, portEnd] = (config.app?.rtpPortRange || "20001-30000")
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
        
        // Only start health check if not in test environment
        if (process.env.NODE_ENV !== 'test') {
            // Periodic health check for stuck ports
            this.healthCheckInterval = setInterval(() => {
                this.performHealthCheck();
            }, 60000); // Every minute
        }
        
        logger.info(`[PortManager] Initialized with ${this.availablePorts.size} available ports in range ${this.RTP_PORT_START}-${this.RTP_PORT_END}`);
    }
    
    /**
     * Acquires a unique, available UDP port from the pool.
     * @param {string} callId - Identifier for the call (Asterisk channel ID or Twilio SID)
     * @param {object} metadata - Optional metadata about the port usage
     * @param {number} retryCount - Internal retry counter to prevent infinite loops
     * @returns {number | null} The acquired port number, or null if none are available.
     */
    acquirePort(callId, metadata = {}, retryCount = 0) {
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
        
        // Atomic port acquisition to prevent race conditions
        if (this.availablePorts.size === 0) {
            logger.error('[PortManager] No available RTP ports to lease.');
            this.emit('ports-exhausted');
            return null;
        }
        
        // Get first available port and immediately remove it
        const availablePorts = Array.from(this.availablePorts);
        const port = availablePorts[0];
        
        // Validate port is in expected range and format
        if (!this.isValidPort(port)) {
            logger.error(`[PortManager] Invalid port ${port} selected from pool`);
            this.availablePorts.delete(port); // Remove invalid port
            
            // Prevent infinite loops
            if (retryCount >= 10) {
                logger.error(`[PortManager] Too many invalid ports encountered (${retryCount} retries). Reinitializing pool.`);
                this.reinitializePool();
                return null;
            }
            
            return this.acquirePort(callId, metadata, retryCount + 1); // Try again
        }
        
        if (!this.availablePorts.delete(port)) {
            logger.error(`[PortManager] Failed to reserve port ${port} - already taken`);
            return null;
        }
        
        const leaseInfo = {
            callId,
            timestamp: Date.now(),
            metadata: {
                ...metadata,
                asteriskChannelId: metadata.asteriskChannelId || callId,
                twilioCallSid: metadata.twilioCallSid,
                direction: metadata.direction || 'unknown'
            }
        };
        
        this.leasedPorts.set(port, leaseInfo);
        
        logger.info(`[PortManager] Acquired port ${port} for call ${callId} (${metadata.direction || 'unknown'}). Available: ${this.availablePorts.size}, Leased: ${this.leasedPorts.size}`);
        this.emit('port-acquired', { port, callId, leaseInfo });
        
        return port;
    }
    
    /**
     * Validates that a port is in the expected range and format
     * @param {number} port
     * @returns {boolean}
     */
    isValidPort(port) {
        return port >= this.RTP_PORT_START && 
               port <= this.RTP_PORT_END && 
               port % 2 === 0; // Must be even for RTP
    }
    
    /**
     * Cleans invalid ports from the available pool
     */
    cleanInvalidPortsFromPool() {
        const invalidPorts = [];
        for (const port of this.availablePorts) {
            if (!this.isValidPort(port)) {
                invalidPorts.push(port);
            }
        }
        
        for (const port of invalidPorts) {
            this.availablePorts.delete(port);
        }
        
        if (invalidPorts.length > 0) {
            logger.warn(`[PortManager] Cleaned ${invalidPorts.length} invalid ports from pool: ${invalidPorts.join(', ')}`);
        }
    }
    
    /**
     * Reinitializes the port pool if it gets corrupted
     */
    reinitializePool() {
        logger.warn(`[PortManager] Reinitializing port pool due to corruption`);
        
        // Clear the available ports
        this.availablePorts.clear();
        
        // Reinitialize with valid ports only
        for (let i = this.RTP_PORT_START; i <= this.RTP_PORT_END; i += 2) {
            this.availablePorts.add(i);
        }
        
        logger.info(`[PortManager] Reinitialized with ${this.availablePorts.size} available ports in range ${this.RTP_PORT_START}-${this.RTP_PORT_END}`);
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
            logger.debug(`[PortManager] Attempted to release port ${port} which was not leased.`);
            return false;
        }
        
        // Verify callId if provided
        if (callId && leaseInfo.callId !== callId) {
            logger.error(`[PortManager] Call ID mismatch when releasing port ${port}. Expected: ${leaseInfo.callId}, Got: ${callId}`);
            return false;
        }
        
        this.leasedPorts.delete(port);
        
        // Only add valid ports back to the available pool
        if (this.isValidPort(port)) {
            this.availablePorts.add(port);
        } else {
            logger.warn(`[PortManager] Not adding invalid port ${port} back to available pool`);
        }
        
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
     * Release all ports associated with a call (for cases where a call might have multiple ports)
     * @param {string} callId - The call identifier
     * @returns {number[]} Array of ports that were released
     */
    releaseAllPortsForCall(callId) {
        if (!callId) return [];
        
        const releasedPorts = [];
        for (const [port, leaseInfo] of this.leasedPorts.entries()) {
            if (leaseInfo.callId === callId) {
                if (this.releasePort(port)) {
                    releasedPorts.push(port);
                }
            }
        }
        
        if (releasedPorts.length > 0) {
            logger.info(`[PortManager] Released ${releasedPorts.length} ports for call ${callId}: ${releasedPorts.join(', ')}`);
        }
        
        return releasedPorts;
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
     * Find all ports by call ID (for cases where a call might have multiple ports)
     * @param {string} callId
     * @returns {number[]}
     */
    findAllPortsByCallId(callId) {
        if (!callId) return [];
        
        const ports = [];
        for (const [port, leaseInfo] of this.leasedPorts.entries()) {
            if (leaseInfo.callId === callId) {
                ports.push(port);
            }
        }
        return ports;
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
                direction: leaseInfo.metadata.direction,
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
        
        const totalPorts = Math.floor((this.RTP_PORT_END - this.RTP_PORT_START) / 2) + 1;
        
        return {
            totalPorts,
            available: this.availablePorts.size,
            leased: this.leasedPorts.size,
            utilizationPercent: Math.round((this.leasedPorts.size / totalPorts) * 100),
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
        
        // Also check for pool exhaustion
        const stats = this.getStats();
        if (stats.utilizationPercent > 90) {
            logger.warn(`[PortManager] High port utilization: ${stats.utilizationPercent}%`);
            this.emit('high-utilization', stats);
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
     * Get detailed port allocation report
     * @returns {object}
     */
    getDetailedReport() {
        const stats = this.getStats();
        const callGroups = {};
        
        // Group ports by call
        for (const detail of stats.leasedDetails) {
            const callId = detail.callId;
            if (!callGroups[callId]) {
                callGroups[callId] = {
                    callId,
                    ports: [],
                    totalPorts: 0,
                    metadata: detail.metadata
                };
            }
            callGroups[callId].ports.push(detail.port);
            callGroups[callId].totalPorts++;
        }
        
        return {
            ...stats,
            callGroups: Object.values(callGroups),
            multiPortCalls: Object.values(callGroups).filter(group => group.totalPorts > 1)
        };
    }
    
    /**
     * Start health check interval (for testing or manual control)
     */
    startHealthCheck() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }
        
        this.healthCheckInterval = setInterval(() => {
            this.performHealthCheck();
        }, 60000); // Every minute
        
        logger.info('[PortManager] Started health check interval');
    }
    
    /**
     * Clean up resources
     */
    destroy() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
        
        // Release all ports
        const allPorts = Array.from(this.leasedPorts.keys());
        for (const port of allPorts) {
            this.releasePort(port);
        }
        
        this.removeAllListeners();
        logger.info('[PortManager] Destroyed and released all ports');
    }
}

// Export singleton instance
const portManagerInstance = new PortManager();
module.exports = portManagerInstance;