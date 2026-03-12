import React, { useEffect, useState } from "react"
import { View, Text, ActivityIndicator, StyleSheet, Platform } from "react-native"
import { useDispatch } from "react-redux"
import { ssoService, hasSSOCallbackInUrl } from "../services/ssoService"
import { setAuthTokens, setAuthEmail, setCurrentUser } from "../store/authSlice"
import { setCaregiver } from "../store/caregiverSlice"
import { setOrg } from "../store/orgSlice"
import { setClientsForCaregiver } from "../store/clientSlice"

const SSO_REDIRECT_ERROR_KEY = "sso_redirect_error"

/**
 * When the app loads on web with ?code= or #code= (OAuth callback), complete the SSO
 * flow and dispatch auth state *before* rendering the navigator. That way the user
 * is logged in when the first screen is shown instead of briefly seeing the login screen.
 */
export function SSOCallbackGate({ children }: { children: React.ReactNode }) {
  const dispatch = useDispatch()
  const [status, setStatus] = useState<"completing" | "done">(() =>
    Platform.OS === "web" && hasSSOCallbackInUrl() ? "completing" : "done"
  )

  useEffect(() => {
    if (status !== "completing") return

    ssoService.tryCompleteRedirectAuth().then((result) => {
      if (!result || "redirecting" in result) {
        setStatus("done")
        return
      }
      if ("error" in result) {
        try {
          sessionStorage.setItem(
            SSO_REDIRECT_ERROR_KEY,
            JSON.stringify({ description: result.description || result.error })
          )
        } catch {
          // ignore
        }
        setStatus("done")
        return
      }

      const user = result as typeof result & {
        tokens?: any
        backendUser?: any
        backendOrg?: any
        backendClients?: any[]
      }
      if (user.tokens && user.backendUser) {
        dispatch(setAuthTokens(user.tokens))
        dispatch(setAuthEmail(user.email))
        dispatch(setCurrentUser(user.backendUser))
        dispatch(setCaregiver(user.backendUser))
        if (user.backendOrg) dispatch(setOrg(user.backendOrg))
        if (user.backendClients && user.backendUser?.id) {
          dispatch(
            setClientsForCaregiver({
              caregiverId: user.backendUser.id,
              clients: user.backendClients,
            })
          )
        }
      }
      setStatus("done")
    })
  }, [status, dispatch])

  if (status === "completing") {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
        <Text style={styles.text}>Signing you in…</Text>
      </View>
    )
  }

  return <>{children}</>
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  text: {
    fontSize: 16,
  },
})
