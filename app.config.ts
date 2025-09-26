import { ExpoConfig, ConfigContext } from "@expo/config"

/**
 * Use ts-node here so we can use TypeScript for our Config Plugins
 * and not have to compile them to JavaScript
 */
require("ts-node/register")

/**
 * @param config ExpoConfig coming from the static config app.json if it exists
 * 
 * You can read more about Expo's Configuration Resolution Rules here:
 * https://docs.expo.dev/workflow/configuration/#configuration-resolution-rules
 */
module.exports = ({ config }: ConfigContext): Partial<ExpoConfig> => {
  const existingPlugins = config.plugins ?? []

  return {
    ...config,
    plugins: [
      ...existingPlugins,
      require("./plugins/withSplashScreen").withSplashScreen,
      require("./plugins/withFlipperDisabled").withFlipperDisabled,
    ],
    extra: {
      eas: {
        projectId: "fb5ec1ef-180c-455a-8b64-2c41f9c8ca2d"
      },
      // OAuth Configuration
      googleClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || "your-google-client-id-here",
      microsoftClientId: process.env.EXPO_PUBLIC_MICROSOFT_CLIENT_ID || "your-microsoft-client-id-here",
      microsoftTenantId: process.env.EXPO_PUBLIC_MICROSOFT_TENANT_ID || "common",
    },
    owner: "negascout",
    slug: "bianca",
    ios: {
      bundleIdentifier: "com.negascout.bianca"
    }
  }
}
