#!/usr/bin/env node

/**
 * Audio Flow Diagnostic Script
 * 
 * This script helps diagnose why audio isn't making it from Asterisk to Twilio.
 * It checks various components in the audio pipeline.
 */

const logger = require('./src/config/logger');
const config = require('./src/config/config');

async function diagnoseAudioFlow() {
    console.log('🔍 Audio Flow Diagnostic Starting...\n');
    
    // 1. Check configuration
    console.log('1. Configuration Check:');
    console.log(`   - Asterisk ARI URL: ${config.asterisk?.url || 'NOT SET'}`);
    console.log(`   - Asterisk SIP Port: ${config.asterisk?.externalPort || 'NOT SET'}`);
    console.log(`   - RTP Start Port: ${config.asterisk?.rtpStartPort || 'NOT SET'}`);
    console.log(`   - RTP End Port: ${config.asterisk?.rtpEndPort || 'NOT SET'}`);
    console.log(`   - Network Mode: ${process.env.NETWORK_MODE || 'NOT SET'}`);
    console.log(`   - Use Private RTP: ${process.env.USE_PRIVATE_NETWORK_FOR_RTP || 'NOT SET'}`);
    console.log('');
    
    // 2. Check if services are running
    console.log('2. Service Status Check:');
    try {
        const rtpListenerService = require('./src/services/rtp.listener.service');
        const rtpSenderService = require('./src/services/rtp.sender.service');
        const ariClient = require('./src/services/ari.client');
        
        console.log('   - RTP Listener Service: ✅ Available');
        console.log('   - RTP Sender Service: ✅ Available');
        console.log('   - ARI Client: ✅ Available');
        
        // Check active listeners
        const listeners = rtpListenerService.getAllActiveListeners();
        console.log(`   - Active RTP Listeners: ${listeners.length}`);
        
        // Check active senders
        const senderStatus = rtpSenderService.getStatus();
        console.log(`   - Active RTP Senders: ${senderStatus.activeCalls}`);
        
    } catch (err) {
        console.log(`   ❌ Service check failed: ${err.message}`);
    }
    console.log('');
    
    // 3. Check network connectivity
    console.log('3. Network Connectivity Check:');
    try {
        const { getAsteriskIP, getRTPAddress, getNetworkDebugInfo } = require('./src/utils/network.utils');
        const networkInfo = await getNetworkDebugInfo();
        
        console.log(`   - Asterisk IP: ${networkInfo.asteriskIP || 'NOT FOUND'}`);
        console.log(`   - RTP Address: ${networkInfo.rtpAddress || 'NOT FOUND'}`);
        console.log(`   - Current IPs: ${networkInfo.currentIPs?.join(', ') || 'NOT FOUND'}`);
        console.log(`   - Network Mode: ${networkInfo.environment.NETWORK_MODE || 'NOT SET'}`);
        
    } catch (err) {
        console.log(`   ❌ Network check failed: ${err.message}`);
    }
    console.log('');
    
    // 4. Check recent logs for audio-related issues
    console.log('4. Recent Audio Issues (from logs):');
    console.log('   Run this command to check recent audio issues:');
    console.log('   aws logs tail /ecs/bianca-app-backend --profile jordan --since 1h | grep -E "(RTP|audio|Asterisk|ARI|error|failed)"');
    console.log('');
    
    // 5. Common issues and solutions
    console.log('5. Common Audio Flow Issues:');
    console.log('   a) RTP Port Allocation:');
    console.log('      - Check if ports are being allocated correctly');
    console.log('      - Verify port range is available (10000-20000)');
    console.log('');
    console.log('   b) Network Routing:');
    console.log('      - Verify Asterisk can reach the app container');
    console.log('      - Check security group rules for RTP ports');
    console.log('      - Ensure proper network mode (bridge/host)');
    console.log('');
    console.log('   c) Bridge Configuration:');
    console.log('      - Verify snoop bridge is created');
    console.log('      - Check if channels are added to bridges');
    console.log('      - Ensure ExternalMedia is configured correctly');
    console.log('');
    console.log('   d) Audio Format:');
    console.log('      - Verify μ-law format is used consistently');
    console.log('      - Check sample rate (8kHz)');
    console.log('      - Ensure proper audio chunking');
    console.log('');
    
    // 6. Diagnostic commands
    console.log('6. Diagnostic Commands:');
    console.log('   - Check Asterisk logs:');
    console.log('     aws logs tail /aws/ec2/asterisk --profile jordan --since 1h');
    console.log('');
    console.log('   - Check app logs:');
    console.log('     aws logs tail /ecs/bianca-app-backend --profile jordan --since 1h');
    console.log('');
    console.log('   - Check container status:');
    console.log('     aws ecs describe-services --profile jordan --cluster bianca-cluster --services bianca-service');
    console.log('');
    console.log('   - Check Asterisk container:');
    console.log('     aws ecs execute-command --profile jordan --cluster bianca-cluster --task $(aws ecs list-tasks --profile jordan --cluster bianca-cluster --service-name bianca-service --query "taskArns[0]" --output text) --container bianca-app-backend --interactive --command "/bin/bash"');
    console.log('');
    
    console.log('🔍 Audio Flow Diagnostic Complete!');
    console.log('Review the above information and run the suggested commands to identify the issue.');
}

// Run the diagnostic
diagnoseAudioFlow().catch(err => {
    console.error('Diagnostic failed:', err);
    process.exit(1);
}); 