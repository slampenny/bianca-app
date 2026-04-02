import { getApiBaseUrl } from "../../config/api"

export function getDefaultApiConfig(): { url: string; timeout: number } {
  return {
    url: getApiBaseUrl(),
    timeout: 15_000,
  }
}
