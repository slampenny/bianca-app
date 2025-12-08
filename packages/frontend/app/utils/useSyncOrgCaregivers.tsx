import { useEffect } from "react"
import { useDispatch, useSelector } from "react-redux"
import { useFocusEffect } from "@react-navigation/native"
import { useCallback } from "react"
import { getCurrentUser } from "app/store/authSlice"
import {
  clearCaregivers,
  setCaregivers,
} from "app/store/caregiverSlice"
import { getOrg } from "app/store/orgSlice"
import { useGetAllCaregiversQuery } from "app/services/api"
import { logger } from "./logger"

export function useSyncOrgCaregivers() {
  const dispatch = useDispatch()
  const currentUser = useSelector(getCurrentUser)
  const currentOrg = useSelector(getOrg)
  const orgId = currentUser?.org || currentOrg?.id || null

  // Only orgAdmin and superAdmin can read all caregivers in an org
  // Staff users only have read:own:caregiver permission
  const canReadAllCaregivers = currentUser?.role === 'orgAdmin' || currentUser?.role === 'superAdmin'

  // Query caregivers for this org
  // Skip if user doesn't have permission or no org ID
  // Refetch on mount to ensure we have fresh data when navigating to this screen
  logger.debug("orgId:", orgId, "canReadAllCaregivers:", canReadAllCaregivers)
  const { data: caregiversData, refetch } = useGetAllCaregiversQuery(
    { org: orgId, limit: 100 }, // Increase limit to ensure we get all caregivers (default might be 10)
    { 
      skip: !orgId || !canReadAllCaregivers,
      refetchOnMountOrArgChange: true, // Always refetch when component mounts or args change
      // Force refetch even if we have cached data - ensures we get the latest list after invites
      refetchOnFocus: true, // Refetch when window regains focus
    }
  )

  // When data arrives, store it in the slice
  useEffect(() => {
    if (caregiversData) {
      dispatch(setCaregivers(caregiversData.results))
    }
  }, [caregiversData, dispatch])

  // Aggressively refetch when screen comes into focus (e.g., after navigating from invite screen)
  // This ensures the list is always fresh when navigating to this screen
  useFocusEffect(
    useCallback(() => {
      if (orgId && canReadAllCaregivers && refetch) {
        logger.debug("CaregiversScreen focused - immediately refetching caregivers")
        // Small delay to ensure navigation is complete before refetching
        const timeoutId = setTimeout(() => {
          // Refetch immediately when screen comes into focus
          refetch().catch((error) => {
            logger.error("Failed to refetch caregivers on focus:", error)
          })
        }, 100) // Small delay to ensure navigation is complete
        
        return () => clearTimeout(timeoutId)
      }
    }, [orgId, canReadAllCaregivers, refetch])
  )

  // Return refetch function so components can manually trigger refetch if needed
  return { refetch }
}
