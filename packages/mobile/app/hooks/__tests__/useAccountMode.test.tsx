import React from "react"
import { renderHook } from "@testing-library/react-native"
import { Provider } from "react-redux"
import { configureStore } from "@reduxjs/toolkit"
import { useAccountMode } from "../useAccountMode"

function wrapperForRole(role: string, linkedResidents: unknown[] = []) {
  const store = configureStore({
    reducer: {
      auth: () => ({
        currentUser: { id: "cg-1", role, linkedResidents },
      }),
    },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  )
}

describe("useAccountMode", () => {
  it("exposes full B2C capabilities for account owners", () => {
    const { result } = renderHook(() => useAccountMode(), {
      wrapper: wrapperForRole("orgAdmin"),
    })
    expect(result.current.mode).toBe("b2c")
    expect(result.current.showAlertsTab).toBe(true)
    expect(result.current.showAddClient).toBe(true)
    expect(result.current.canEditClient).toBe(true)
    expect(result.current.showCallHistory).toBe(true)
    expect(result.current.readOnlySchedules).toBe(false)
  })

  it("gates org-family portal users to read-only schedules and no alerts", () => {
    const { result } = renderHook(() => useAccountMode(), {
      wrapper: wrapperForRole("family", [{ clientId: "client-1", displayName: "Agnes" }]),
    })
    expect(result.current.mode).toBe("orgFamily")
    expect(result.current.showAlertsTab).toBe(false)
    expect(result.current.showAddClient).toBe(false)
    expect(result.current.canEditClient).toBe(false)
    expect(result.current.showCallHistory).toBe(false)
    expect(result.current.readOnlySchedules).toBe(true)
    expect(result.current.linkedResidents).toHaveLength(1)
  })

  it("treats facility staff as B2C mode without add-client", () => {
    const { result } = renderHook(() => useAccountMode(), {
      wrapper: wrapperForRole("staff"),
    })
    expect(result.current.mode).toBe("b2c")
    expect(result.current.showAddClient).toBe(false)
    expect(result.current.canEditClient).toBe(true)
  })
})
