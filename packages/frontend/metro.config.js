const { getDefaultConfig } = require('@expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

// Ensure we use the project root for the config
const config = getDefaultConfig(projectRoot);

// Configure Expo Router transformer to suppress routerRoot warnings
// Set routerRoot to 'app' directory (default Expo Router routes location)
// This is needed because @expo/metro-runtime triggers Expo Router's transformer
const originalGetTransformOptions = config.transformer?.getTransformOptions;
config.transformer = {
  ...config.transformer,
  getTransformOptions: async (entryPoints) => {
    // Get default options from Expo's default config if it exists
    const defaultOptions = originalGetTransformOptions
      ? await originalGetTransformOptions(entryPoints)
      : {
          transform: {
            experimentalImportSupport: false,
            inlineRequires: true,
          },
        };
    
    // Add routerRoot to suppress Expo Router warnings
    // Even if not using Expo Router for routing, the transformer still runs
    if (defaultOptions.transform) {
      defaultOptions.transform.routerRoot = path.resolve(projectRoot, 'app');
    } else {
      defaultOptions.transform = {
        routerRoot: path.resolve(projectRoot, 'app'),
      };
    }
    
    return defaultOptions;
  },
};

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
    // Block ALL test files from staging and production builds
    // This ensures test code (describe, it, expect, etc.) never gets bundled
    /.*\.test\.(ts|tsx|js|jsx|mjs)$/,           // *.test.ts, *.test.tsx, etc.
    /.*\.spec\.(ts|tsx|js|jsx|mjs)$/,         // *.spec.ts, *.spec.tsx, etc.
    /.*\.e2e\.test\.(ts|tsx|js|jsx|mjs)$/,    // *.e2e.test.ts, etc.
    /.*__tests__\/.*/,                         // Any file in __tests__ directories
    /^test\/.*/,                               // Root-level test/ directory only (e2e tests, fixtures, helpers, etc.)
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
