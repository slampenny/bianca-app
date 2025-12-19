// Polyfill for expo-font to prevent crashes when native module isn't available
// This allows the app to run without custom fonts (uses system fonts)

// IMPORTANT: This file must be loaded BEFORE any code tries to import expo-font
// The Metro config aliases expo-font to this file, so all imports will use this polyfill

// Create a stub native module interface that matches what expo-font expects
const createFontLoaderStub = () => ({
  loadAsync: async () => {},
  isLoaded: () => false,
  isLoading: () => false,
  getAssetForSource: () => null,
})

// Set up stubs IMMEDIATELY, before any other code can require the module
// This must happen synchronously at module load time
const stub = createFontLoaderStub()
if (typeof global !== 'undefined') {
  // Set up global stub first
  global.__EXPO_FONT_LOADER_STUB__ = stub
}

// Stub NativeModules.ExpoFontLoader for compatibility
// Do this IMMEDIATELY, synchronously, before anything else can load
if (typeof global !== 'undefined') {
  const stub = global.__EXPO_FONT_LOADER_STUB__ || createFontLoaderStub()
  global.__EXPO_FONT_LOADER_STUB__ = stub
  
  // Set up the stub in NativeModules immediately if react-native is available
  if (typeof require !== 'undefined') {
    try {
      const { NativeModules } = require('react-native')
      // Force set the stub - override anything that might already be there
      Object.defineProperty(NativeModules, 'ExpoFontLoader', {
        value: stub,
        writable: true,
        configurable: true,
        enumerable: true,
      })
    } catch (e) {
      // react-native not available yet - that's ok
    }
  }
  
  // CRITICAL: Intercept requireNativeModule calls for ExpoFontLoader
  // This MUST happen synchronously, before any other code can call it
  if (typeof require !== 'undefined') {
    // Try to get expo-modules-core immediately - it might already be loaded
    let expoModulesCore: any
    try {
      expoModulesCore = require('expo-modules-core')
    } catch (e) {
      // Not loaded yet - we'll set up a hook to catch it when it loads
    }
    
    const patchRequireNativeModule = (core: any) => {
      if (core && core.requireNativeModule && !core.__EXPO_FONT_POLYFILL_PATCHED__) {
        const originalRequireNativeModule = core.requireNativeModule.bind(core)
        core.requireNativeModule = function(moduleName: string) {
          if (moduleName === 'ExpoFontLoader') {
            return stub
          }
          try {
            return originalRequireNativeModule(moduleName)
          } catch (e: any) {
            if (moduleName === 'ExpoFontLoader' || (e?.message && e.message.includes('ExpoFontLoader'))) {
              return stub
            }
            throw e
          }
        }
        core.__EXPO_FONT_POLYFILL_PATCHED__ = true
      }
    }
    
    // Patch immediately if already loaded
    if (expoModulesCore) {
      patchRequireNativeModule(expoModulesCore)
    }
    
    // Also hook into the require cache to patch when it loads
    // This is a workaround for when expo-modules-core loads after this polyfill
    const originalRequire = require
    try {
      // Override global require to catch expo-modules-core
      ;(global as any).require = function(id: string) {
        const result = originalRequire(id)
        if (id === 'expo-modules-core') {
          patchRequireNativeModule(result)
        }
        return result
      }
    } catch (e) {
      // If we can't override require, that's ok - we'll rely on the immediate patch
    }
  }
}

export const useFonts = (fonts: Record<string, any>): [boolean] => {
  // Always return true (fonts "loaded") so app doesn't block
  // App will use system fonts as fallback
  return [true]
}

export const loadAsync = async (fontFamilyOrFontMap: string | Record<string, any>, source?: any): Promise<void> => {
  // No-op - fonts not loaded, will use system fonts
  return Promise.resolve()
}

export const isLoaded = (fontFamily: string): boolean => {
  return false // Fonts not loaded, will use system fonts
}

export const isLoading = (fontFamily: string): boolean => {
  return false
}

export const processFontFamily = (fontFamily: string | null): string | null => {
  return fontFamily // Return as-is, will use system fonts
}

// Export default to match expo-font's export structure
export default {
  useFonts,
  loadAsync,
  isLoaded,
  isLoading,
  processFontFamily,
}




