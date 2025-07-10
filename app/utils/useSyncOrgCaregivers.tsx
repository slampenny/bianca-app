import { useEffect } from "react"
import { useDispatch, useSelector } from "react-redux"
import { getCurrentUser } from "app/store/authSlice"
import {
  clearCaregivers,
  setCaregivers,
} from "app/store/caregiverSlice"
import { getOrg } from "app/store/orgSlice"
import { useGetAllCaregiversQuery } from "app/services/api"

export function useSyncOrgCaregivers() {
  const dispatch = useDispatch()
  const currentUser = useSelector(getCurrentUser)
  const currentOrg = useSelector(getOrg)
  const orgId = currentUser?.org || currentOrg?.id || null

  // Query caregivers for this org
  console.log("orgId:", orgId)
  const { data: caregiversData } = useGetAllCaregiversQuery({ org: orgId }, { skip: !orgId })

  // When data arrives, store it in the slice
  useEffect(() => {
    if (caregiversData) {
      dispatch(setCaregivers(caregiversData.results))
    }
  }, [caregiversData, dispatch])
}
