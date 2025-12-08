const logger = require('../config/logger');

let publicIpAddress = null;
let privateIpAddress = null;
let lastFetchTime = null;
const CACHE_DURATION = 60000; // Cache IP for 1 minute

async function getNetworkIPs(forceRefresh = false) {
    // Check cache first
    if (!forceRefresh && publicIpAddress && privateIpAddress && lastFetchTime && (Date.now() - lastFetchTime) < CACHE_DURATION) {
        return { publicIp: publicIpAddress, privateIp: privateIpAddress };
    }

    // Check if we're in hybrid mode (new architecture)
    const networkMode = process.env.NETWORK_MODE;
    const usePrivateRTP = process.env.USE_PRIVATE_NETWORK_FOR_RTP === 'true';
    
    logger.info(`[Network Utils] Network mode: ${networkMode}, Use private RTP: ${usePrivateRTP}`);

    // In hybrid mode, we always get our private IP and may not have a public IP
    if (networkMode === 'HYBRID' || usePrivateRTP) {
        return await getHybridNetworkIPs(forceRefresh);
    }

    // Legacy behavior for backward compatibility
    return await getLegacyNetworkIPs(forceRefresh);
}

async function getHybridNetworkIPs(forceRefresh = false) {
    // Check cache first
    if (!forceRefresh && privateIpAddress && lastFetchTime && (Date.now() - lastFetchTime) < CACHE_DURATION) {
        return { 
            publicIp: publicIpAddress || 'NOT_AVAILABLE', 
            privateIp: privateIpAddress 
        };
    }

    // Check environment variables first (from Terraform)
    if (process.env.ASTERISK_PRIVATE_IP) {
        logger.info(`[Network Utils] Using Asterisk private IP from environment: ${process.env.ASTERISK_PRIVATE_IP}`);
    }

    // Not in ECS - development mode
    if (!process.env.ECS_CONTAINER_METADATA_URI_V4) {
        logger.warn('[Network Utils] Not running in ECS, using localhost');
        publicIpAddress = 'localhost';
        privateIpAddress = 'localhost';
        lastFetchTime = Date.now();
        return { publicIp: publicIpAddress, privateIp: privateIpAddress };
    }

    try {
        // Get container metadata to find our private IP
        const containerResponse = await fetch(process.env.ECS_CONTAINER_METADATA_URI_V4);
        const containerData = await containerResponse.json();
        
        logger.debug('[Network Utils] Container metadata:', JSON.stringify(containerData.Networks, null, 2));
        
        // Get our private IP from container metadata
        if (containerData.Networks?.[0]?.IPv4Addresses?.[0]) {
            privateIpAddress = containerData.Networks[0].IPv4Addresses[0];
            logger.info(`[Network Utils] Found private IP: ${privateIpAddress}`);
        }

        // In hybrid mode, we're in a private subnet so we DON'T have a public IP
        // The ALB provides external access, not a direct public IP
        publicIpAddress = null; // Explicitly set to null for clarity
        
        logger.info(`[Network Utils] Hybrid mode - Private IP: ${privateIpAddress}, Public IP: NOT_AVAILABLE (behind ALB)`);
        
        lastFetchTime = Date.now();
        return { 
            publicIp: 'NOT_AVAILABLE', 
            privateIp: privateIpAddress 
        };

    } catch (err) {
        logger.error(`[Network Utils] Failed to get network IPs: ${err.message}`, err);
        // If we have cached IPs, return them even if expired
        if (privateIpAddress) {
            logger.warn('[Network Utils] Returning stale cached IPs due to error');
            return { 
                publicIp: publicIpAddress || 'NOT_AVAILABLE', 
                privateIp: privateIpAddress 
            };
        }
        throw err;
    }
}

async function getLegacyNetworkIPs(forceRefresh = false) {
    // Check cache first
    if (!forceRefresh && publicIpAddress && lastFetchTime && (Date.now() - lastFetchTime) < CACHE_DURATION) {
        return { publicIp: publicIpAddress, privateIp: publicIpAddress }; // Legacy: same IP
    }

    // Check environment variable first (from Terraform)
    if (process.env.BIANCA_PUBLIC_IP && process.env.BIANCA_PUBLIC_IP !== 'AUTO') {
        logger.info(`[Network Utils] Using public IP from environment: ${process.env.BIANCA_PUBLIC_IP}`);
        publicIpAddress = process.env.BIANCA_PUBLIC_IP;
        privateIpAddress = publicIpAddress; // Legacy: same IP
        lastFetchTime = Date.now();
        return { publicIp: publicIpAddress, privateIp: privateIpAddress };
    }

    // Not in ECS
    if (!process.env.ECS_CONTAINER_METADATA_URI_V4) {
        logger.warn('[Network Utils] Not running in ECS, using localhost');
        publicIpAddress = 'localhost';
        privateIpAddress = 'localhost';
        lastFetchTime = Date.now();
        return { publicIp: publicIpAddress, privateIp: privateIpAddress };
    }

    try {
        // Method 1: Try ECS Task Metadata for public IP
        const taskResponse = await fetch(`${process.env.ECS_CONTAINER_METADATA_URI_V4}/task`);
        const taskData = await taskResponse.json();
        
        logger.debug('[Network Utils] Task metadata:', JSON.stringify(taskData.Attachments, null, 2));
        
        // Look for ENI attachment with public IP
        for (const attachment of taskData.Attachments || []) {
            if (attachment.Type === 'ElasticNetworkInterface') {
                logger.debug('[Network Utils] Found ENI attachment:', JSON.stringify(attachment.Details, null, 2));
                
                for (const detail of attachment.Details || []) {
                    if (detail.Name === 'publicIPv4Address' && detail.Value) {
                        logger.info(`[Network Utils] Found public IP from task metadata: ${detail.Value}`);
                        publicIpAddress = detail.Value;
                        privateIpAddress = publicIpAddress; // Legacy: same IP
                        lastFetchTime = Date.now();
                        return { publicIp: publicIpAddress, privateIp: privateIpAddress };
                    }
                }
            }
        }

        // Method 2: Try external service as fallback
        logger.info('[Network Utils] No public IP in task metadata, trying external service...');
        const ipResponse = await fetch('https://api.ipify.org?format=text', {
            signal: AbortSignal.timeout(3000) // 3 second timeout
        });
        
        if (ipResponse.ok) {
            const externalIp = await ipResponse.text();
            logger.info(`[Network Utils] Got public IP from ipify: ${externalIp}`);
            publicIpAddress = externalIp.trim();
            privateIpAddress = publicIpAddress; // Legacy: same IP
            lastFetchTime = Date.now();
            return { publicIp: publicIpAddress, privateIp: privateIpAddress };
        }

        // Method 3: Fallback to private IP (not ideal for legacy)
        const containerResponse = await fetch(process.env.ECS_CONTAINER_METADATA_URI_V4);
        const containerData = await containerResponse.json();
        
        if (containerData.Networks?.[0]?.IPv4Addresses?.[0]) {
            const privateIp = containerData.Networks[0].IPv4Addresses[0];
            logger.warn(`[Network Utils] WARNING: Using private IP as last resort: ${privateIp}`);
            publicIpAddress = privateIp;
            privateIpAddress = privateIp;
            lastFetchTime = Date.now();
            return { publicIp: publicIpAddress, privateIp: privateIpAddress };
        }

        throw new Error('No IP address found');

    } catch (err) {
        logger.error(`[Network Utils] Failed to get public IP: ${err.message}`, err);
        // If we have a cached IP, return it even if expired
        if (publicIpAddress) {
            logger.warn('[Network Utils] Returning stale cached IP due to error');
            return { publicIp: publicIpAddress, privateIp: privateIpAddress || publicIpAddress };
        }
        throw err;
    }
}

// Legacy function for backward compatibility
async function getFargateIp(forceRefresh = false) {
    logger.warn('[Network Utils] getFargateIp() is deprecated, use getNetworkIPs() instead');
    const { publicIp } = await getNetworkIPs(forceRefresh);
    return publicIp === 'NOT_AVAILABLE' ? null : publicIp;
}

// New function to get the appropriate IP for RTP communication
async function getRTPAddress(forceRefresh = false) {
    // First, check if RTP_BIANCA_HOST is explicitly set (highest priority)
    if (process.env.RTP_BIANCA_HOST) {
        logger.info(`[Network Utils] Using RTP_BIANCA_HOST for RTP: ${process.env.RTP_BIANCA_HOST}`);
        return process.env.RTP_BIANCA_HOST;
    }
    
    const networkMode = process.env.NETWORK_MODE;
    const usePrivateRTP = process.env.USE_PRIVATE_NETWORK_FOR_RTP === 'true';
    
    if (networkMode === 'HYBRID' || usePrivateRTP) {
        // In hybrid mode, use private IP for RTP
        const { privateIp } = await getNetworkIPs(forceRefresh);
        logger.info(`[Network Utils] Using private IP for RTP: ${privateIp}`);
        return privateIp;
    } else {
        // Legacy mode, use public IP for RTP
        const { publicIp } = await getNetworkIPs(forceRefresh);
        logger.info(`[Network Utils] Using public IP for RTP: ${publicIp}`);
        return publicIp;
    }
}

// Function to get Asterisk IP for ARI communication
function getAsteriskIP() {
    const networkMode = process.env.NETWORK_MODE;
    const deploymentType = process.env.DEPLOYMENT_TYPE;
    const asteriskHost = process.env.ASTERISK_HOST;
    const asteriskPrivateIP = process.env.ASTERISK_PRIVATE_IP;
    const asteriskPublicIP = process.env.ASTERISK_PUBLIC_IP;
    
    // Docker Compose deployment - use service name
    if (deploymentType === 'docker-compose' && asteriskHost) {
        logger.info(`[Network Utils] Using Asterisk Docker service name for ARI: ${asteriskHost}`);
        return asteriskHost;
    }
    
    if (networkMode === 'HYBRID' && asteriskPrivateIP) {
        logger.info(`[Network Utils] Using Asterisk private IP for ARI: ${asteriskPrivateIP}`);
        return asteriskPrivateIP;
    } else if (asteriskPublicIP) {
        logger.info(`[Network Utils] Using Asterisk public IP for ARI: ${asteriskPublicIP}`);
        return asteriskPublicIP;
    } else {
        logger.warn('[Network Utils] No Asterisk IP configured, using localhost');
        return 'localhost';
    }
}

// Debug function to get all network info
async function getNetworkDebugInfo() {
    const info = {
        environment: {
            NETWORK_MODE: process.env.NETWORK_MODE,
            USE_PRIVATE_NETWORK_FOR_RTP: process.env.USE_PRIVATE_NETWORK_FOR_RTP,
            ASTERISK_PRIVATE_IP: process.env.ASTERISK_PRIVATE_IP,
            ASTERISK_PUBLIC_IP: process.env.ASTERISK_PUBLIC_IP,
            BIANCA_PUBLIC_IP: process.env.BIANCA_PUBLIC_IP,
            ECS_CONTAINER_METADATA_URI_V4: process.env.ECS_CONTAINER_METADATA_URI_V4,
            isECS: !!process.env.ECS_CONTAINER_METADATA_URI_V4
        },
        cached: {
            publicIpAddress,
            privateIpAddress,
            lastFetchTime,
            cacheAge: lastFetchTime ? Date.now() - lastFetchTime : null
        },
        metadata: {}
    };

    if (process.env.ECS_CONTAINER_METADATA_URI_V4) {
        try {
            // Get container metadata
            const containerResponse = await fetch(process.env.ECS_CONTAINER_METADATA_URI_V4);
            const containerData = await containerResponse.json();
            info.metadata.container = {
                Networks: containerData.Networks,
                TaskARN: containerData.TaskARN
            };

            // Get task metadata
            const taskResponse = await fetch(`${process.env.ECS_CONTAINER_METADATA_URI_V4}/task`);
            const taskData = await taskResponse.json();
            info.metadata.task = {
                Attachments: taskData.Attachments,
                Containers: taskData.Containers?.map(c => ({
                    Name: c.Name,
                    NetworkInterfaces: c.NetworkInterfaces
                }))
            };
        } catch (err) {
            info.metadata.error = err.message;
        }
    }

    // Try to get current IPs
    try {
        const currentIPs = await getNetworkIPs(true); // Force refresh
        info.currentIPs = currentIPs;
        info.rtpAddress = await getRTPAddress(true);
        info.asteriskIP = getAsteriskIP();
    } catch (err) {
        info.currentIPsError = err.message;
    }

    return info;
}

module.exports = {
    // New functions
    getNetworkIPs,
    getRTPAddress,
    getAsteriskIP,
    getNetworkDebugInfo,
    
    // Legacy functions for backward compatibility
    getFargateIp
};