#!/usr/bin/env node

const fetch = require('node-fetch');
const net = require('net');

async function testARIConnection() {
    const ariUrl = process.env.ASTERISK_URL || 'http://172.31.100.198:8088';
    const username = process.env.ASTERISK_USERNAME || 'myphonefriend';
    const password = process.env.ASTERISK_PASSWORD || 'your-password-here';
    
    console.log('=== ARI Connection Test ===');
    console.log(`ARI URL: ${ariUrl}`);
    console.log(`Username: ${username}`);
    console.log(`Password configured: ${!!password}`);
    console.log('');
    
    // Test 1: Parse URL
    try {
        const urlObj = new URL(ariUrl);
        console.log(`Hostname: ${urlObj.hostname}`);
        console.log(`Port: ${urlObj.port || 80}`);
        console.log(`Protocol: ${urlObj.protocol}`);
    } catch (err) {
        console.error('❌ Invalid URL:', err.message);
        return;
    }
    
    // Test 2: Basic network connectivity
    console.log('\n--- Testing Network Connectivity ---');
    try {
        const urlObj = new URL(ariUrl);
        const testConnection = () => {
            return new Promise((resolve, reject) => {
                const socket = new net.Socket();
                const timeout = setTimeout(() => {
                    socket.destroy();
                    reject(new Error('Connection timeout'));
                }, 5000);
                
                socket.on('connect', () => {
                    clearTimeout(timeout);
                    socket.destroy();
                    resolve(true);
                });
                
                socket.on('error', (err) => {
                    clearTimeout(timeout);
                    reject(err);
                });
                
                socket.connect(parseInt(urlObj.port || 80), urlObj.hostname);
            });
        };
        
        await testConnection();
        console.log('✅ TCP connection successful');
    } catch (err) {
        console.error('❌ Network connectivity failed:', err.message);
        console.error('   Error code:', err.code);
        return;
    }
    
    // Test 3: HTTP connectivity
    console.log('\n--- Testing HTTP Connectivity ---');
    try {
        const response = await fetch(`${ariUrl}/ari/api-docs/resources.json`, {
            headers: {
                'Authorization': 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64')
            }
        });
        
        if (response.ok) {
            console.log('✅ HTTP connection successful');
            console.log(`   Status: ${response.status}`);
            console.log(`   Content-Type: ${response.headers.get('content-type')}`);
        } else {
            console.error('❌ HTTP request failed');
            console.error(`   Status: ${response.status}`);
            console.error(`   Status Text: ${response.statusText}`);
            
            // Try to get response body for more details
            try {
                const errorText = await response.text();
                console.error(`   Response: ${errorText.substring(0, 200)}...`);
            } catch (e) {
                console.error('   Could not read response body');
            }
        }
    } catch (err) {
        console.error('❌ HTTP request failed:', err.message);
        console.error('   Error code:', err.code);
    }
    
    // Test 4: Try without authentication
    console.log('\n--- Testing without Authentication ---');
    try {
        const response = await fetch(`${ariUrl}/ari/api-docs/resources.json`);
        
        if (response.ok) {
            console.log('⚠️  HTTP connection works without authentication (security issue!)');
        } else if (response.status === 401) {
            console.log('✅ Authentication required (expected)');
        } else {
            console.log(`⚠️  Unexpected status without auth: ${response.status}`);
        }
    } catch (err) {
        console.error('❌ HTTP request without auth failed:', err.message);
    }
    
    // Test 5: Try different endpoints
    console.log('\n--- Testing Different Endpoints ---');
    const endpoints = [
        '/ari/asterisk/info',
        '/ari/api-docs/resources.json',
        '/ari/applications',
        '/'
    ];
    
    for (const endpoint of endpoints) {
        try {
            const response = await fetch(`${ariUrl}${endpoint}`, {
                headers: {
                    'Authorization': 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64')
                }
            });
            
            console.log(`${endpoint}: ${response.status} ${response.statusText}`);
        } catch (err) {
            console.log(`${endpoint}: ERROR - ${err.message}`);
        }
    }
}

// Run the test
testARIConnection().catch(console.error); 