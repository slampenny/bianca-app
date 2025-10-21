const { getDefaultConfig } = require('@expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add resolver configuration to handle Platform utilities
config.resolver = {
  ...config.resolver,
  alias: {
    ...config.resolver.alias,
  },
  // Ensure proper resolution of React Native modules
  platforms: ['ios', 'android', 'native', 'web'],
};

module.exports = config;
