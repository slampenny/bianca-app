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
  // Exclude mobile-only packages from web builds
  blockList: [
    // Block @stripe/stripe-react-native from web builds
    /node_modules\/@stripe\/stripe-react-native\/.*/,
  ],
};

module.exports = config;
