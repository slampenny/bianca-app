const logger = require('../config/logger');

let publicIpAddress = null;
let lastFetchTime = null;
const CACHE_DURATION = 60000; // Cache IP for 1 minute

async function getFargateIp(forceRefresh = false) {
    // Check cache first
    if (!forceRefresh && publicIpAddress && lastFetchTime && (Date.now() - lastFetchTime) < CACHE_DURATION) {
        return publicIpAddress;
    }

    // Check environment variable first (from Terraform)
    if (process.env.BIANCA_PUBLIC_IP && process.env.BIANCA_PUBLIC_IP !== 'AUTO') {
        logger.info(`[Network Utils] Using public IP from environment: ${process.env.BIANCA_PUBLIC_IP}`);
        publicIpAddress = process.env.BIANCA_PUBLIC_IP;
        lastFetchTime = Date.now();
        return publicIpAddress;
    }

    // Not in ECS
    if (!process.env.ECS_CONTAINER_METADATA_URI_V4) {
        logger.warn('[Network Utils] Not running in ECS, using localhost');
        publicIpAddress = 'localhost';
        lastFetchTime = Date.now();
        return publicIpAddress;
    }

    try {
        // Method 1: Try ECS Task Metadata
        const taskResponse = await fetch(`${process.env.ECS_CONTAINER_METADATA_URI_V4}/task`);
        const taskData = await taskResponse.json();
        
        logger.debug('[Network Utils] Task metadata:', JSON.stringify(taskData.Attachments, null, 2));
        
        // Look for ENI attachment
        for (const attachment of taskData.Attachments || []) {
            if (attachment.Type === 'ElasticNetworkInterface') {
                logger.debug('[Network Utils] Found ENI attachment:', JSON.stringify(attachment.Details, null, 2));
                
                for (const detail of attachment.Details || []) {
                    if (detail.Name === 'publicIPv4Address' && detail.Value) {
                        logger.info(`[Network Utils] Found public IP from task metadata: ${detail.Value}`);
                        publicIpAddress = detail.Value;
                        lastFetchTime = Date.now();
                        return publicIpAddress;
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
            lastFetchTime = Date.now();
            return publicIpAddress;
        }

        // Method 3: Fallback to private IP (not ideal)
        const containerResponse = await fetch(process.env.ECS_CONTAINER_METADATA_URI_V4);
        const containerData = await containerResponse.json();
        
        if (containerData.Networks?.[0]?.IPv4Addresses?.[0]) {
            const privateIp = containerData.Networks[0].IPv4Addresses[0];
            logger.warn(`[Network Utils] WARNING: Using private IP as last resort: ${privateIp}`);
            publicIpAddress = privateIp;
            lastFetchTime = Date.now();
            return publicIpAddress;
        }

        throw new Error('No IP address found');

    } catch (err) {
        logger.error(`[Network Utils] Failed to get public IP: ${err.message}`, err);
        // If we have a cached IP, return it even if expired
        if (publicIpAddress) {
            logger.warn('[Network Utils] Returning stale cached IP due to error');
            return publicIpAddress;
        }
        throw err;
    }
}

// Debug function to get all network info
async function getNetworkDebugInfo() {
    const info = {
        environment: {
            BIANCA_PUBLIC_IP: process.env.BIANCA_PUBLIC_IP,
            ECS_CONTAINER_METADATA_URI_V4: process.env.ECS_CONTAINER_METADATA_URI_V4,
            isECS: !!process.env.ECS_CONTAINER_METADATA_URI_V4
        },
        cached: {
            publicIpAddress,
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

    // Try to get current IP
    try {
        info.currentIp = await getFargateIp(true); // Force refresh
    } catch (err) {
        info.currentIpError = err.message;
    }

    return info;
}

module.exports = {
    getFargateIp,
    getNetworkDebugInfo
};