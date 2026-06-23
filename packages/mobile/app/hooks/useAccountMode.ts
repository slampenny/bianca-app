import { useMemo } from "react"
import { getCurrentUser } from "../store/authSlice"
import { useAppSelector } from "../store/store"

export type AccountMode = "b2c" | "orgFamily"

export function useAccountMode() {
  const currentUser = useAppSelector(getCurrentUser)

  return useMemo(() => {
    const mode: AccountMode = currentUser?.role === "family" ? "orgFamily" : "b2c"
    return {
      mode,
      showAlertsTab: mode === "b2c",
      showOrgAdmin: mode === "b2c" && (currentUser?.role === "orgAdmin" || currentUser?.role === "superAdmin"),
      showAddClient: mode === "b2c" && currentUser?.role !== "staff",
      smsEligible: mode === "b2c",
      linkedResidents: currentUser?.linkedResidents ?? [],
      canEditClient: mode === "b2c",
      showCallHistory: mode === "b2c",
      readOnlySchedules: mode === "orgFamily",
    }
  }, [currentUser?.role, currentUser?.linkedResidents])
}
