import React from "react"
import { StyleSheet } from "react-native"
import { useSelector, useDispatch } from "react-redux"
import { useLogoutMutation } from "../services/api/authApi"
import { getAuthTokens, clearAuth } from "../store/authSlice"
import { clearOrg } from "../store/orgSlice"
import { clearCaregivers } from "../store/caregiverSlice"
import { clearPatients } from "../store/patientSlice"
import { Button, Screen, Text } from "app/components"
import { useTheme } from "app/theme/ThemeContext"
import { translate } from "app/i18n"
import { logger } from "../utils/logger"

export const LogoutScreen = () => {
  const dispatch = useDispatch()
  const [logout] = useLogoutMutation()
  const { colors, isLoading: themeLoading } = useTheme()

  if (themeLoading) {
    return null
  }

  const styles = createStyles(colors)

  const tokens = useSelector(getAuthTokens)

  const handleLogoutPress = async () => {
    if (tokens) {
      try {
        await logout({ refreshToken: tokens.refresh.token }).unwrap()
        logger.debug("Logout successful")
      } catch (error) {
        logger.warn("Logout API failed (this is normal if token was already expired):", error)
        // Don't treat 404 as an error - it means the token was already invalid
      }
    }
    
    // Always clear local state regardless of API response
    // Note: Slices will auto-clear on logout via extraReducers, but we still call clearAuth
    // to ensure auth state is cleared immediately
    dispatch(clearAuth())
    // Other slices (org, caregiver, patient) will auto-clear via extraReducers listening to logout events
    
    // Navigate to login screen or handle logout completion
    // The navigation will be handled by the auth state change
  }

  return (
    <Screen style={styles.container} accessibilityLabel="logout-screen">
      <Text style={styles.title} tx="logoutScreen.logoutMessage" />
      <Button
        tx="logoutScreen.logoutButton"
        onPress={handleLogoutPress}
        preset="danger"
        style={styles.logoutButton}
        textStyle={styles.logoutButtonText}
        testID="logout-button"
        accessibilityLabel={translate("logoutScreen.logoutButton") || "Log out"}
      />
    </Screen>
  )
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: colors.palette.biancaBackground,
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  logoutButton: {
    backgroundColor: colors.palette.biancaButtonSelected,
    borderRadius: 5,
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    width: "100%",
  },
  logoutButtonText: {
    color: colors.palette.neutral100,
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
  },
  title: {
    color: colors.palette.biancaHeader,
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
})
