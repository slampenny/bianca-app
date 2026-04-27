import { getDefaultApiConfig } from "../services/api/api"

/** HTTP origin for Socket.IO; REST uses `.../v1`, socket mounts on the root server. */
export function getSocketBaseUrl(): string {
  const url = getDefaultApiConfig().url.replace(/\/$/, "")
  return url.replace(/\/v1\/?$/, "")
}
