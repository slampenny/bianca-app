import { orgApi } from "../services/api/orgApi"
import { store } from "../store/store"
import { logger } from "./logger"

/** Disable facility-style voice onboarding for family (B2C) orgs — uses existing PATCH /orgs API. */
export async function disableFamilyVoiceOnboarding(orgId: string): Promise<void> {
  try {
    await store
      .dispatch(
        orgApi.endpoints.updateOrg.initiate({
          orgId,
          org: { voiceOnboarding: { useDefault: false, days: [] } },
        }),
      )
      .unwrap()
    logger.debug("[familyOrgSettings] Voice onboarding disabled for org", orgId)
  } catch (error) {
    logger.warn("[familyOrgSettings] Failed to disable voice onboarding:", error)
  }
}
