import { useEffect, useRef } from "react"
import { useDispatch, useSelector } from "react-redux"
import { io, type Socket } from "socket.io-client"
import Config from "app/config"
import { alertApi } from "app/services/api/alertApi"
import type { RootState } from "app/store/store"
import { logger } from "app/utils/logger"

/**
 * Subscribes to org-scoped `alerts:changed` over Socket.IO so RTK Query refetches without waiting for poll.
 * When REDIS_URL is set on the API, multiple Node processes share broadcasts via @socket.io/redis-adapter.
 */
export function useAlertRealtime() {
  const dispatch = useDispatch()
  const accessToken = useSelector((s: RootState) => s.auth.tokens?.access?.token)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    if (process.env.JEST_WORKER_ID) return undefined
    if (!accessToken) {
      if (socketRef.current) {
        socketRef.current.close()
        socketRef.current = null
      }
      return undefined
    }

    const baseUrl = Config.API_URL.replace(/\/?v1\/?$/i, "").replace(/\/$/, "")
    const socket = io(baseUrl, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      auth: { token: `Bearer ${accessToken}` },
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    })

    socketRef.current = socket

    socket.on("connect", () => {
      logger.debug("[AlertRealtime] socket connected", { id: socket.id })
    })
    socket.on("connect_error", (err) => {
      logger.warn("[AlertRealtime] connect_error", err.message)
    })
    socket.on("alerts:changed", () => {
      dispatch(alertApi.util.invalidateTags(["Alert"]))
    })

    return () => {
      socket.off("alerts:changed")
      socket.close()
      if (socketRef.current === socket) {
        socketRef.current = null
      }
    }
  }, [accessToken, dispatch])
}
