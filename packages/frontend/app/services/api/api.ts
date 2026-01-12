/**
 * This Api class lets you define an API endpoint and methods to request
 * data and process it.
 *
 * See the [Backend API Integration](https://docs.infinite.red/ignite-cli/boilerplate/app/services/Services.md)
 * documentation for more details.
 */
import { ApisauceInstance, create } from "apisauce"
import Config from "../../config"
import type { ApiConfig } from "./api.types"

/**
 * Configuring the apisauce instance.
 * Note: We use a getter function to ensure Config.API_URL is read dynamically
 * after any runtime overrides (e.g., for demo.biancawellness.com)
 */
export const getDefaultApiConfig = (): ApiConfig => ({
  url: Config.API_URL, // Read dynamically to pick up runtime overrides
  timeout: 10000,
})

// For backward compatibility, export a constant that reads dynamically
export const DEFAULT_API_CONFIG: ApiConfig = getDefaultApiConfig()

/**
 * Manages all requests to the API. You can use this class to build out
 * various requests that you need to call from your backend API.
 */
export class Api {
  apisauce: ApisauceInstance
  config: ApiConfig

  /**
   * Set up our API instance. Keep this lightweight!
   */
  constructor(config: ApiConfig | null = null) {
    this.config = config || getDefaultApiConfig() // Use getter to get fresh Config.API_URL
    this.apisauce = create({
      baseURL: this.config.url,
      timeout: this.config.timeout,
      headers: {
        Accept: "application/json",
      },
    })
  }
}

// Singleton instance of the API for convenience
export const api = new Api()
