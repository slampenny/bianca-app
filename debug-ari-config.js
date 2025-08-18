#!/usr/bin/env node

// Debug script to check ARI configuration
const config = require('./src/config/config');

console.log('=== ARI Configuration Debug ===');
console.log('Environment:', process.env.NODE_ENV);
console.log('ASTERISK_URL env var:', process.env.ASTERISK_URL);
console.log('ASTERISK_HOST env var:', process.env.ASTERISK_HOST);
console.log('ASTERISK_USERNAME env var:', process.env.ASTERISK_USERNAME);
console.log('ARI_PASSWORD env var:', process.env.ARI_PASSWORD ? '***SET***' : 'NOT SET');
console.log('');

console.log('Config.asterisk:');
console.log('  enabled: true (always enabled)');
console.log('  url:', config.asterisk.url);
console.log('  host:', config.asterisk.host);
console.log('  username:', config.asterisk.username);
console.log('  password:', config.asterisk.password ? '***SET***' : 'NOT SET');
console.log('');

// Test the exact URL the app would use
const testUrl = `${config.asterisk.url}/ari/api-docs/resources.json`;
console.log('Test URL that app would use:', testUrl);
console.log('');

// Test if we can resolve the hostname
const urlObj = new URL(config.asterisk.url);
console.log('Parsed URL:');
console.log('  protocol:', urlObj.protocol);
console.log('  hostname:', urlObj.hostname);
console.log('  port:', urlObj.port);
console.log('  pathname:', urlObj.pathname); 