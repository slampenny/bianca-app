const logger = require('../config/logger');

let publicIpAddress = null;

async function getFargatePublicIp() {
    if (publicIpAddress) {
        return publicIpAddress;
    }

    // In dev/local environment
    if (!process.env.ECS_CONTAINER_METADATA_URI_V4) {
        logger.warn('[Network Utils] Not running in ECS, returning localhost');
        return '127.0.0.1';
    }

    try {
        // For Fargate with public IP assignment
        const taskResponse = await fetch(`${process.env.ECS_CONTAINER_METADATA_URI_V4}/task`);
        const taskData = await taskResponse.json();
        
        // Look for the ENI (Elastic Network Interface) with a public IP
        for (const attachment of taskData.Attachments || []) {
            if (attachment.Type === 'ElasticNetworkInterface') {
                for (const detail of attachment.Details || []) {
                    if (detail.Name === 'publicIPv4Address' && detail.Value) {
                        logger.info(`[Network Utils] Found public IP from task metadata: ${detail.Value}`);
                        publicIpAddress = detail.Value;
                        return publicIpAddress;
                    }
                }
            }
        }

        // Fallback: Try the container metadata endpoint
        const containerResponse = await fetch(process.env.ECS_CONTAINER_METADATA_URI_V4);
        const containerData = await containerResponse.json();
        
        // In public subnets, the Networks array should have the public IP
        for (const network of containerData.Networks || []) {
            // Look for a non-private IP
            for (const ip of network.IPv4Addresses || []) {
                if (ip && !ip.startsWith('172.') && !ip.startsWith('10.') && !ip.startsWith('192.168.')) {
                    logger.info(`[Network Utils] Found public IP: ${ip}`);
                    publicIpAddress = ip;
                    return publicIpAddress;
                }
            }
        }

        throw new Error('No public IP found in ECS metadata');
        
    } catch (err) {
        logger.error(`[Network Utils] Failed to get public IP: ${err.message}`);
        throw err;
    }
}

module.exports = {
    getFargatePublicIp
};