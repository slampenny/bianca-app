import { useEffect } from "react"
import { useDispatch, useSelector } from "react-redux"
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
  logger.debug("orgId:", orgId, "canReadAllCaregivers:", canReadAllCaregivers)
  const { data: caregiversData } = useGetAllCaregiversQuery(
    { org: orgId },
    { skip: !orgId || !canReadAllCaregivers }
  )

  // When data arrives, store it in the slice
  useEffect(() => {
    if (caregiversData) {
      dispatch(setCaregivers(caregiversData.results))
    }
  }, [caregiversData, dispatch])
}
