import { authApi } from "../services/api/authApi"
import { alertApi } from "../services/api/alertApi"
import { clientApi } from "../services/api/clientApi"
import { conversationApi } from "../services/api/conversationApi"
import { sentimentApi } from "../services/api/sentimentApi"
import { caregiverApi } from "../services/api/caregiverApi"
import { mfaApi } from "../services/api/mfaApi"
import { phoneVerificationApi } from "../services/api/phoneVerificationApi"
import { privacyApi } from "../services/api/privacyApi"
import { store } from "./store"

/**
 * Clears RTK Query caches after an admin session handoff so requests use the new tokens
 * and do not reuse data from a previous user or anonymous session.
 */
export function resetRtkCachesAfterHandoff() {
  store.dispatch(authApi.util.resetApiState())
  store.dispatch(alertApi.util.resetApiState())
  store.dispatch(clientApi.util.resetApiState())
  store.dispatch(conversationApi.util.resetApiState())
  store.dispatch(sentimentApi.util.resetApiState())
  store.dispatch(caregiverApi.util.resetApiState())
  store.dispatch(mfaApi.util.resetApiState())
  store.dispatch(phoneVerificationApi.util.resetApiState())
  store.dispatch(privacyApi.util.resetApiState())
}
