import React, { useEffect } from "react"
import { View, StyleSheet } from "react-native"
import { useSelector, useDispatch } from "react-redux"
import { Button } from "app/components/Button"
import { Text } from "app/components/Text"
import { getCurrentUser, setCurrentUser } from "../store/authSlice"
import { useTheme } from "app/theme/ThemeContext"
import { translate } from "app/i18n"
import { Caregiver } from "../services/api/api.types"
import { navigationRef } from "../navigators/navigationUtilities"
import { useGetCaregiverQuery } from "../services/api/caregiverApi"

interface PhoneVerificationBannerProps {
  onDismiss?: () => void
}

export const PhoneVerificationBanner: React.FC<PhoneVerificationBannerProps> = ({
  onDismiss
}) => {
  const dispatch = useDispatch()
  const currentUser = useSelector(getCurrentUser) as Caregiver | null
  const { colors } = useTheme()

  // Refetch user data to ensure we have the latest isPhoneVerified status
  // This prevents showing the banner when the phone is already verified (stale Redux state)
  const { data: freshUserData, refetch } = useGetCaregiverQuery(
    { id: currentUser?.id || '' },
    { skip: !currentUser?.id, refetchOnMountOrArgChange: true }
  )

  // Update Redux with fresh user data if it's different
  useEffect(() => {
    if (freshUserData && currentUser?.id === freshUserData.id) {
      // Only update if isPhoneVerified status changed
      if (freshUserData.isPhoneVerified !== currentUser.isPhoneVerified) {
        dispatch(setCurrentUser(freshUserData))
      }
    }
  }, [freshUserData, currentUser, dispatch])

  // Use fresh data if available, otherwise fall back to Redux state
  const userToCheck = freshUserData || currentUser

  // Debug logging (only in development)
  if (process.env.NODE_ENV === 'development' && userToCheck) {
    console.log('[PhoneVerificationBanner] Debug:', {
      hasUser: !!userToCheck,
      hasPhone: !!userToCheck.phone,
      phone: userToCheck.phone ? `${userToCheck.phone.substring(0, 3)}***` : 'none',
      isPhoneVerified: userToCheck.isPhoneVerified,
      isPhoneVerifiedType: typeof userToCheck.isPhoneVerified,
      usingFreshData: !!freshUserData,
      shouldShow: !userToCheck.isPhoneVerified && !!userToCheck.phone && userToCheck.phone.trim() !== ''
    })
  }

  // Only show banner if:
  // 1. User exists
  // 2. User has a phone number (not empty string)
  // 3. User is NOT phone verified (explicitly check for false/undefined, not just truthy)
  // Use fresh data if available to avoid stale Redux state
  if (!userToCheck) {
    return null
  }
  
  // Check if user has a phone number
  if (!userToCheck.phone || typeof userToCheck.phone !== 'string' || userToCheck.phone.trim() === '') {
    return null
  }
  
  // Check if phone is verified - explicitly check for true (not just truthy)
  // isPhoneVerified should be false or undefined for unverified users
  // The DTO defaults it to false, but we check explicitly for true to be safe
  // Use fresh data to ensure we don't show banner for already-verified phones
  if (userToCheck.isPhoneVerified === true) {
    return null
  }

  // Only show for caregivers/admins (not patients - patients don't create accounts)
  // All users in the system are caregivers, so we show for all
  const handleVerifyPhone = () => {
    if (navigationRef.isReady()) {
      navigationRef.navigate("VerifyPhone" as never)
    }
  }

  const styles = createStyles(colors)

  return (
    <View style={styles.container} testID="phone-verification-banner" accessibilityLabel="phone-verification-banner">
      <View style={styles.banner}>
        <View style={styles.content}>
          <Text style={styles.icon}>📱</Text>
          <View style={styles.textContainer}>
            <Text style={styles.title}>
              {translate("phoneVerificationBanner.title") || "Verify Your Phone Number"}
            </Text>
            <Text style={styles.message}>
              {translate("phoneVerificationBanner.message") || "Please verify your phone number to receive emergency alerts and important notifications."}
            </Text>
          </View>
        </View>
        <Button
          text={translate("phoneVerificationBanner.verifyButton") || "Verify Now"}
          preset="primary"
          onPress={handleVerifyPhone}
          style={styles.verifyButton}
          testID="phone-verification-banner-button"
          accessibilityLabel="Verify phone button"
        />
      </View>
    </View>
  )
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: colors.palette.warning100 || '#FEF3C7',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.palette.warning300 || '#FCD34D',
    gap: 12,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  icon: {
    fontSize: 24,
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.palette.neutral900 || '#171717',
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    color: colors.palette.neutral700 || '#525252',
    lineHeight: 20,
  },
  verifyButton: {
    backgroundColor: colors.palette.primary500 || colors.tint || '#6366F1',
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 100,
  },
})

