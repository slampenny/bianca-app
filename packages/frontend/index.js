// CRITICAL: Load expo-font polyfill FIRST before ANYTHING else
// This must happen synchronously before any other imports
require('./app/utils/expo-font-polyfill');

import { registerRootComponent } from 'expo';
import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);

