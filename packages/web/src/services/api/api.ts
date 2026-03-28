import { getApiBaseUrl } from "../../config/api"
import type { ApiConfig } from "./api.types"

export function getDefaultApiConfig(): ApiConfig {
  return {
    url: getApiBaseUrl(),
    timeout: 10_000,
  }
}
