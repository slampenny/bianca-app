const { getDefaultConfig } = require('@expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

// Ensure we use the project root for the config
const config = getDefaultConfig(projectRoot);

// Add resolver configuration to handle Platform utilities and monorepo
config.resolver = {
  ...config.resolver,
  alias: {
    ...config.resolver.alias,
  },
  // Ensure proper resolution of React Native modules
  platforms: ['ios', 'android', 'native', 'web'],
  // Explicitly include image asset extensions to ensure proper handling
  assetExts: [
    ...(config.resolver.assetExts || []),
    'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff',
  ],
  // Exclude mobile-only packages and native-only assets from web builds
  blockList: [
    // Block @stripe/stripe-react-native from web builds
    /node_modules\/@stripe\/stripe-react-native\/.*/,
    // Block native-only app icons and splash screens from web builds
    /assets\/images\/app-icon-.*\.png/,
    /assets\/images\/playstore\.png/,
    /assets\/images\/appstore\.png/,
  ],
  // Add monorepo node_modules resolution
  nodeModulesPaths: [
    path.resolve(projectRoot, 'node_modules'),
    path.resolve(workspaceRoot, 'node_modules'),
  ],
  // Disable package exports to avoid metro-cache FileStore import issues
  unstable_enablePackageExports: false,
};

// Update watchFolders for monorepo
config.watchFolders = [workspaceRoot];

module.exports = config;
