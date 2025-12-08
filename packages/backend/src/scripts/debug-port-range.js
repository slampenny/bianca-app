#!/usr/bin/env node

// Debug script to check port range configuration
const config = require('../config/config');

console.log('=== Port Range Configuration Debug ===');
console.log('Environment:', process.env.NODE_ENV);
console.log('APP_RTP_PORT_RANGE env var:', process.env.APP_RTP_PORT_RANGE);
console.log('');

console.log('Config.app.rtpPortRange:', config.app?.rtpPortRange);
console.log('');

// Parse the port range like the port manager does
const [portStart, portEnd] = (config.app?.rtpPortRange || "20002-30000")
    .split('-').map(Number);

console.log('Parsed port range:');
console.log('  portStart:', portStart);
console.log('  portEnd:', portEnd);
console.log('');

// Show some example ports that would be valid
console.log('Example valid ports (even numbers in range):');
for (let i = portStart; i <= Math.min(portStart + 20, portEnd); i += 2) {
    console.log(`  ${i}`);
}
console.log('');

// Check if the problematic ports are in range
const problematicPorts = [22969, 22971, 22973, 22975, 22977, 22979, 22981, 22983, 22985, 22987, 22989, 22991, 22993, 22995, 22997, 22999, 23001, 23003, 23005, 23007, 23009, 23011, 23013, 23015, 23017, 23019, 23021, 23023, 23025, 23027, 23029, 23031, 23033, 23035, 23037, 23039, 23041, 23043, 23045, 23047, 23049, 23051, 23053, 23055, 23057, 23059, 23061, 23063, 23065, 23067, 23069, 23071, 23073, 23075, 23077, 23079, 23081, 23083, 23085];

console.log('Problematic ports analysis:');
problematicPorts.forEach(port => {
    const inRange = port >= portStart && port <= portEnd;
    const isEven = port % 2 === 0;
    const valid = inRange && isEven;
    console.log(`  ${port}: inRange=${inRange}, isEven=${isEven}, valid=${valid}`);
}); 