import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getCurrentUser } from 'app/store/authSlice';
import { getCurrentOrg, setCurrentOrg, clearCaregivers, setCaregivers } from 'app/store/caregiverSlice';
import { useGetAllCaregiversQuery } from 'app/services/api';

export function useSyncOrgCaregivers() {
  const dispatch = useDispatch();
  const currentUser = useSelector(getCurrentUser);
  const currentOrg = useSelector(getCurrentOrg);
  const orgId = currentUser?.org || null;

  // Query caregivers for this org
  const { data: caregiversData } = useGetAllCaregiversQuery({ org: orgId }, { skip: !orgId });

  // If the org changes, update it in the slice
  useEffect(() => {
    if (orgId && orgId !== currentOrg) {
      dispatch(setCurrentOrg(orgId));
      dispatch(clearCaregivers());
    }
  }, [orgId, currentOrg, dispatch]);

  // When data arrives, store it in the slice
  useEffect(() => {
    if (caregiversData) {
      dispatch(setCaregivers(caregiversData.results));
    }
  }, [caregiversData, dispatch]);
}
