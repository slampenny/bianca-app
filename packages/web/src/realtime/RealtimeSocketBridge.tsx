import { useEffect, useRef } from "react"
import { io, type Socket } from "socket.io-client"
import { getSocketBaseUrl } from "../config/api"
import { alertApi } from "../services/api/alertApi"
import { fraudAbuseAnalysisApi } from "../services/api/fraudAbuseAnalysisApi"
import { medicalAnalysisApi } from "../services/api/medicalAnalysisApi"
import { useAppSelector } from "../store/store"
import { store } from "../store/store"

type ClientAnalysisKind = "medical" | "fraudAbuse"

/**
 * Connects to the backend Socket.IO server when the user has an access token, and
 * refetches RTK Query caches when org-scoped events arrive (alerts, post-call analysis).
 */
export function RealtimeSocketBridge() {
  const accessToken = useAppSelector((s) => s.auth.tokens?.access?.token)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    if (!accessToken) {
      if (socketRef.current) {
        socketRef.current.removeAllListeners()
        socketRef.current.disconnect()
        socketRef.current = null
      }
      return
    }

    const url = getSocketBaseUrl()
    const socket = io(url, {
      path: "/socket.io",
      auth: { token: accessToken },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelayMax: 10_000,
    })
    socketRef.current = socket

    const onAlertsChanged = () => {
      store.dispatch(alertApi.util.invalidateTags(["Alert"]))
    }

    const onClientAnalysisUpdated = (payload: { clientId?: string; kind?: ClientAnalysisKind }) => {
      const { clientId, kind } = payload
      if (!clientId) return
      if (kind === "medical") {
        store.dispatch(medicalAnalysisApi.util.invalidateTags([{ type: "MedicalAnalysis", id: clientId }]))
      } else if (kind === "fraudAbuse") {
        store.dispatch(fraudAbuseAnalysisApi.util.invalidateTags([{ type: "FraudAbuseAnalysis", id: clientId }]))
      } else {
        store.dispatch(fraudAbuseAnalysisApi.util.invalidateTags([{ type: "FraudAbuseAnalysis", id: clientId }]))
        store.dispatch(medicalAnalysisApi.util.invalidateTags([{ type: "MedicalAnalysis", id: clientId }]))
      }
    }

    socket.on("alerts:changed", onAlertsChanged)
    socket.on("client:analysis:updated", onClientAnalysisUpdated)

    return () => {
      socket.removeListener("alerts:changed", onAlertsChanged)
      socket.removeListener("client:analysis:updated", onClientAnalysisUpdated)
      socket.disconnect()
      if (socketRef.current === socket) {
        socketRef.current = null
      }
    }
  }, [accessToken])

  return null
}
