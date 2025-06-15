const logger = require('../config/logger');

let publicIpAddress = null;

async function getFargateIp() {
    if (publicIpAddress) {
        return publicIpAddress;
    }

    if (!process.env.ECS_CONTAINER_METADATA_URI_V4) {
        logger.warn('[Network Utils] Not running in ECS, using localhost');
        publicIpAddress = 'localhost';
        return publicIpAddress;
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

        if (containerData.Networks && containerData.Networks[0] && containerData.Networks[0].IPv4Addresses[0]) {
            const privateIp = containerData.Networks[0].IPv4Addresses[0];
            logger.warn(`[Fargate IP] Using private IP as fallback: ${privateIp}`);
            publicIpAddress = privateIp;
            return publicIpAddress;
        }

        throw new Error('No public or private IP found in ECS metadata');
        
    } catch (err) {
        logger.error(`[Network Utils] Failed to get public IP: ${err.message}`);
        throw err;
    }
}

module.exports = {
    getFargateIp
};