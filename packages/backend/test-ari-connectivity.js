#!/usr/bin/env node

const fetch = require('node-fetch');

async function testARIConnectivity() {
    console.log('=== Testing ARI Connectivity ===');
    
    // Test different possible ARI URLs
    const testUrls = [
        'http://asterisk.myphonefriend.internal:8088/ari/asterisk/info',
        'http://172.31.100.198:8088/ari/asterisk/info',
        'http://3.21.74.167:8088/ari/asterisk/info'
    ];
    
    const username = 'myphonefriend';
    const password = process.env.ASTERISK_PASSWORD || 'your-password-here';
    
    console.log(`Username: ${username}`);
    console.log(`Password configured: ${!!password}`);
    console.log('');
    
    for (const url of testUrls) {
        console.log(`Testing: ${url}`);
        
        try {
            const response = await fetch(url, {
                headers: {
                    'Authorization': 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64')
                },
                timeout: 10000
            });
            
            if (response.ok) {
                console.log(`✅ SUCCESS: ${url} - Status: ${response.status}`);
                const data = await response.text();
                console.log(`Response: ${data.substring(0, 200)}...`);
            } else {
                console.log(`❌ FAILED: ${url} - Status: ${response.status} ${response.statusText}`);
            }
        } catch (error) {
            console.log(`❌ ERROR: ${url} - ${error.message}`);
        }
        
        console.log('');
    }
}

testARIConnectivity().catch(console.error); 