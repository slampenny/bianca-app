export interface ConfigBaseProps {
  persistNavigation: "always" | "dev" | "prod" | "never"
  catchErrors: "always" | "dev" | "prod" | "never"
  exitRoutes: string[]
  paymentMethodGatewayUrl: string
  appIconUrl: string
}

export type PersistNavigationConfig = ConfigBaseProps["persistNavigation"]

const BaseConfig: ConfigBaseProps = {
  // This feature is particularly useful in development mode, but
  // can be used in production as well if you prefer.
  persistNavigation: "dev",

  /**
   * Only enable if we're catching errors in the right environment
   */
  catchErrors: "always",

  /**
   * This is a list of all the route names that will exit the app if the back button
   * is pressed while in that screen. Only affects Android.
   */
  exitRoutes: ["MainTabsWithDrawer"],

  paymentMethodGatewayUrl: "https://biancawellness.com/payment-method",
  
  // S3 URL for app icon (upload icon.png to this bucket)
  appIconUrl: "https://bianca-app-assets.s3.us-east-2.amazonaws.com/icon.png",
}

export default BaseConfig
