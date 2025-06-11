// src/services/port.manager.service.js
const logger = require('../config/logger');
const config = require('../config/config');

// Get port range from config, e.g., "10000-20000"
const [RTP_PORT_START, RTP_PORT_END] = (config.asterisk.rtpPortRange || "10000-20000")
    .split('-').map(Number);

const availablePorts = new Set();
const leasedPorts = new Set();

// Initialize the pool of available ports
for (let i = RTP_PORT_START; i <= RTP_PORT_END; i += 2) { // Use even ports
    availablePorts.add(i);
}

logger.info(`[PortManager] Initialized with ${availablePorts.size} available ports in range ${RTP_PORT_START}-${RTP_PORT_END}`);

/**
 * Acquires a unique, available UDP port from the pool.
 * @returns {number | null} The acquired port number, or null if none are available.
 */
function acquirePort() {
    if (availablePorts.size === 0) {
        logger.error('[PortManager] No available RTP ports to lease.');
        return null;
    }

    const port = availablePorts.values().next().value;
    availablePorts.delete(port);
    leasedPorts.add(port);
    logger.debug(`[PortManager] Acquired port: ${port}. Available: ${availablePorts.size}`);
    return port;
}

/**
 * Releases a port, returning it to the pool of available ports.
 * @param {number} port The port number to release.
 */
function releasePort(port) {
    if (leasedPorts.has(port)) {
        leasedPorts.delete(port);
        availablePorts.add(port);
        logger.debug(`[PortManager] Released port: ${port}. Available: ${availablePorts.size}`);
    } else {
        logger.warn(`[PortManager] Attempted to release port ${port} which was not leased.`);
    }
}

function getStats() {
    return {
        totalPorts: (RTP_PORT_END - RTP_PORT_START) / 2 + 1,
        available: availablePorts.size,
        leased: leasedPorts.size,
    };
}

function isPortAvailable(port) {
    return availablePorts.has(port);
}

module.exports = {
    acquirePort,
    releasePort,
    getStats,
    isPortAvailable,
};