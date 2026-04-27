import { useEffect, useRef } from "react"
import { useSelector } from "react-redux"
import { io, type Socket } from "socket.io-client"
import { store } from "../store/store"
import { alertApi } from "../services/api/alertApi"
import { fraudAbuseAnalysisApi } from "../services/api/fraudAbuseAnalysisApi"
import { medicalAnalysisApi } from "../services/api/medicalAnalysisApi"
import type { RootState } from "../store/store"
import { getSocketBaseUrl } from "./getSocketBaseUrl"

type ClientAnalysisKind = "medical" | "fraudAbuse"

/**
 * Authenticated Socket.IO: `alerts:changed` and `client:analysis:updated` (org room).
 */
export function RealtimeSocketBridge() {
  const accessToken = useSelector((s: RootState) => s.auth.tokens?.access?.token)
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
        store.dispatch(
          medicalAnalysisApi.util.invalidateTags([
            { type: "MedicalAnalysisResult", id: clientId },
            { type: "MedicalAnalysisSummary", id: clientId },
            { type: "MedicalAnalysisTrend", id: `${clientId}-month` },
          ]),
        )
      } else if (kind === "fraudAbuse") {
        store.dispatch(
          fraudAbuseAnalysisApi.util.invalidateTags([{ type: "FraudAbuseAnalysisResult", id: clientId }]),
        )
      } else {
        store.dispatch(
          fraudAbuseAnalysisApi.util.invalidateTags([{ type: "FraudAbuseAnalysisResult", id: clientId }]),
        )
        store.dispatch(
          medicalAnalysisApi.util.invalidateTags([
            { type: "MedicalAnalysisResult", id: clientId },
            { type: "MedicalAnalysisSummary", id: clientId },
            { type: "MedicalAnalysisTrend", id: `${clientId}-month` },
          ]),
        )
      }
    }

    socket.on("alerts:changed", onAlertsChanged)
    socket.on("client:analysis:updated", onClientAnalysisUpdated)

    return () => {
      socket.off("alerts:changed", onAlertsChanged)
      socket.off("client:analysis:updated", onClientAnalysisUpdated)
      socket.disconnect()
      if (socketRef.current === socket) {
        socketRef.current = null
      }
    }
  }, [accessToken])

  return null
}
