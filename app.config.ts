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
      googleClientId: "959208772047-srq01jpg8sq31afovfb38afsroee0o53.apps.googleusercontent.com",
      microsoftClientId: "28288cd7-df50-4587-9f58-5c97ff54e65c",
      microsoftTenantId: process.env.EXPO_PUBLIC_MICROSOFT_TENANT_ID || "common",
    },
    owner: "negascout",
    slug: "bianca",
    ios: {
      bundleIdentifier: "com.negascout.bianca"
    }
  }
}
