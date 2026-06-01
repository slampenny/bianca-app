import { lazy, Suspense } from "react"
import { isDevDemoEnabled } from "../lib/devDemo"
import { ReportsResidentTabLive } from "./ReportsResidentTabLive"
import type { ApiAlertRecord, Client } from "../services/api/api.types"

const ReportsResidentTabMock = import.meta.env.DEV
  ? lazy(() => import("./ReportsResidentTabMock").then((m) => ({ default: m.ReportsResidentTabMock })))
  : null

type Props = {
  clients: Client[]
  alerts: ApiAlertRecord[]
  clientsLoading: boolean
  clientsError: boolean
  selectedClientId: string
  onSelectClientId: (id: string) => void
}

export function ReportsResidentTab(props: Props) {
  if (isDevDemoEnabled() && ReportsResidentTabMock) {
    const Mock = ReportsResidentTabMock
    return (
      <Suspense fallback={null}>
        <Mock />
      </Suspense>
    )
  }
  return <ReportsResidentTabLive {...props} />
}
