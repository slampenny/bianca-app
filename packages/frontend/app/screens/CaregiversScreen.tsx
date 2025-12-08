import React, { useState } from "react"
import { View, StyleSheet, FlatList } from "react-native"
import { AutoImage, Text, Button, Screen } from "app/components"
import { useSelector, useDispatch } from "react-redux"
import { getCaregivers, setCaregiver, clearCaregiver } from "app/store/caregiverSlice"
import { getCurrentUser } from "app/store/authSlice"
import { Caregiver } from "app/services/api/api.types"
import { useNavigation, NavigationProp } from "@react-navigation/native"
import { OrgStackParamList } from "app/navigators/navigationTypes"
import { useSyncOrgCaregivers } from "app/utils/useSyncOrgCaregivers"
import { useTheme } from "app/theme/ThemeContext"
import { translate } from "app/i18n"
import { logger } from "../utils/logger"
import { useSendInviteMutation } from "app/services/api/orgApi"
import { getOrg } from "app/store/orgSlice"
import { store } from "app/store/store"
import { caregiverApi } from "app/services/api/caregiverApi"

export function CaregiversScreen() {
  const dispatch = useDispatch()
  const navigation = useNavigation<NavigationProp<OrgStackParamList>>()
  const caregivers = useSelector(getCaregivers)
  const currentUser = useSelector(getCurrentUser) as Caregiver | null
  const currentOrg = useSelector(getOrg)
  const { colors, isLoading: themeLoading } = useTheme()
  const [sendInvite, { isLoading: isResendingInvite }] = useSendInviteMutation()
  const [resendingCaregiverId, setResendingCaregiverId] = useState<string | null>(null)

  const { refetch } = useSyncOrgCaregivers()

  // Everyone should be able to view caregivers (backend handles filtering)
  const isAuthorized = true

  // Debug logging
  logger.debug('CaregiversScreen Debug:', {
    currentUser: currentUser?.id,
    currentUserRole: currentUser?.role,
    currentUserOrg: currentUser?.org,
    totalCaregivers: caregivers.length,
    caregiverIds: caregivers.map(c => c.id),
    caregiverRoles: caregivers.map(c => ({ id: c.id, role: c.role }))
  })

  // Just display what the backend returns (no frontend filtering)
  const orgCaregivers = caregivers

  logger.debug('Displaying caregivers:', {
    orgCaregiversCount: orgCaregivers.length,
    includes_current_user: orgCaregivers.some(c => c.id === currentUser?.id)
  })

  const handleCaregiverPress = (caregiver: Caregiver) => {
    dispatch(setCaregiver(caregiver))
    navigation.navigate("Caregiver")
  }

  const handleAddCaregiver = () => {
    // Clear any existing caregiver so the invite form starts fresh.
    dispatch(clearCaregiver())
    navigation.navigate("Caregiver")
  }

  const handleResendInvite = async (caregiver: Caregiver) => {
    if (!currentOrg?.id || !caregiver.email || !caregiver.name || !caregiver.phone) {
      logger.error("Cannot resend invite: missing required information", {
        orgId: currentOrg?.id,
        caregiverEmail: caregiver.email,
        caregiverName: caregiver.name,
        caregiverPhone: caregiver.phone
      })
      return
    }

    setResendingCaregiverId(caregiver.id)
    try {
      const result = await sendInvite({
        orgId: currentOrg.id,
        name: caregiver.name,
        email: caregiver.email,
        phone: caregiver.phone,
      }).unwrap()

      logger.debug("Invite resent successfully", { caregiverId: caregiver.id, email: caregiver.email })
      
      // Invalidate caregiver list cache to ensure UI is up to date
      // Invalidate both LIST and all Caregiver tags to ensure complete cache refresh
      store.dispatch(
        caregiverApi.util.invalidateTags([
          { type: "Caregiver", id: "LIST" },
          { type: "Caregiver" }, // Invalidate all caregiver tags
        ])
      )
      
      // Also trigger a manual refetch if available
      // The useSyncOrgCaregivers hook should handle this, but we can also trigger it manually
      if (refetch) {
        setTimeout(() => refetch(), 100) // Small delay to ensure invalidation is processed
      }

      // Navigate to the "invite sent" screen, just like the initial invite
      const invitedCaregiver = result.caregiver || caregiver
      try {
        const { CommonActions } = require('@react-navigation/native')
        navigation.dispatch(
          CommonActions.navigate({
            name: "CaregiverInvited",
            params: {
              caregiver: {
                id: invitedCaregiver.id || caregiver.id,
                name: invitedCaregiver.name || caregiver.name,
                email: invitedCaregiver.email || caregiver.email,
              }
            }
          })
        )
        logger.debug('Navigation to CaregiverInvited called successfully via CommonActions (resend)')
      } catch (navError) {
        logger.error('Navigation to CaregiverInvited failed (resend):', navError)
        // Fallback: try direct navigation
        try {
          navigation.navigate("CaregiverInvited" as never, {
            caregiver: {
              id: invitedCaregiver.id || caregiver.id,
              name: invitedCaregiver.name || caregiver.name,
              email: invitedCaregiver.email || caregiver.email,
            }
          } as never)
          logger.debug('Fallback navigation to CaregiverInvited called (resend)')
        } catch (fallbackError) {
          logger.error('Fallback navigation also failed (resend):', fallbackError)
        }
      }
    } catch (error) {
      logger.error("Failed to resend invite:", error)
      // TODO: Show error message to user
    } finally {
      setResendingCaregiverId(null)
    }
  }

  const renderCaregiver = ({ item }: { item: Caregiver }) => {
    const isInvited = (item.role as string) === "invited"
    
    return (
      <View 
        style={[
          styles.caregiverCard,
          isInvited && styles.invitedCaregiverCard
        ]}
        testID="caregiver-card"
      >
        <View style={styles.caregiverInfo}>
          <AutoImage source={{ uri: item.avatar || "https://www.gravatar.com/avatar/?d=mp" }} style={styles.avatar} />
          <View style={styles.infoTextContainer}>
            <Text style={[
              styles.caregiverName,
              isInvited && styles.invitedCaregiverName
            ]}>
              {item.name}
            </Text>
            {isInvited && (
              <View style={styles.invitedBadge}>
                <Text style={styles.invitedBadgeText}>{translate("caregiversScreen.invited")}</Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.buttonContainer}>
          {isInvited && (
            <Button
              text={translate("caregiversScreen.resendInvite")}
              onPress={() => handleResendInvite(item)}
              preset="default"
              style={[
                styles.resendButton,
                resendingCaregiverId === item.id && styles.resendButtonLoading
              ]}
              textStyle={styles.resendButtonText}
              disabled={isResendingInvite && resendingCaregiverId === item.id}
              testID="resend-invite-button"
              accessibilityLabel={`${translate("caregiversScreen.resendInvite")} ${item.name}`}
              accessibilityHint={isResendingInvite && resendingCaregiverId === item.id 
                ? "Sending invitation email, please wait"
                : `Resends the invitation email to ${item.name} at ${item.email}`}
            />
          )}
          <Button
            text={translate("caregiversScreen.edit")}
            onPress={() => handleCaregiverPress(item)}
            preset={isInvited ? "default" : "primary"}
            style={[
              styles.editButton,
              isInvited && styles.invitedEditButton
            ]}
            textStyle={styles.editButtonText}
            testID="edit-caregiver-button"
          />
        </View>
      </View>
    )
  }

  if (themeLoading) {
    return null
  }

  const styles = createStyles(colors)

  const ListEmpty = () => <Text style={styles.noCaregiversText}>{translate("caregiversScreen.noCaregiversFound")}</Text>

  // Show not authorized message (this should rarely happen now)
  if (!isAuthorized) {
    return (
      <Screen preset="fixed" testID="caregivers-screen">
        <View style={styles.notAuthorizedContainer}>
          <Text style={styles.notAuthorizedTitle}>{translate("caregiversScreen.notAuthorized")}</Text>
          <Text style={styles.notAuthorizedText}>
            {translate("caregiversScreen.noPermissionToView")}
          </Text>
        </View>
      </Screen>
    )
  }

  return (
    <Screen preset="scroll" testID="caregivers-screen">
      <FlatList
        data={orgCaregivers}
        keyExtractor={(item, index) => item.id || String(index)}
        renderItem={renderCaregiver}
        contentContainerStyle={styles.listContentContainer}
        ListEmptyComponent={ListEmpty}
      />

      <Button
        text={translate("caregiversScreen.addCaregiver")}
        onPress={handleAddCaregiver}
        preset="success"
        style={styles.addButton}
        textStyle={styles.addButtonText}
        testID="add-caregiver-button"
      />
    </Screen>
  )
}

const createStyles = (colors: any) => StyleSheet.create({
  addButton: {
    margin: 16,
  },
  addButtonText: { 
    fontSize: 18, 
    fontWeight: "600",
    // Button component handles text color automatically based on preset
  },
  avatar: { backgroundColor: colors.palette.neutral300, borderRadius: 24, height: 48, marginRight: 12, width: 48 },
  caregiverCard: {
    alignItems: "center",
    backgroundColor: colors.palette.neutral100,
    borderRadius: 6,
    elevation: 2,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    padding: 16,
    shadowColor: colors.palette.neutral900,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  caregiverInfo: { alignItems: "center", flexDirection: "row" },
  caregiverName: { color: colors.palette.biancaHeader, flexShrink: 1, fontSize: 16 },
  // Container removed - Screen component handles background
  buttonContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  editButton: {
    minHeight: 40,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  resendButton: {
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginRight: 8,
  },
  resendButtonLoading: {
    opacity: 0.6,
  },
  resendButtonText: {
    fontSize: 14,
  },
  editButtonText: { 
    fontSize: 16,
    // Button component handles text color automatically based on preset
  },
  infoTextContainer: { flexDirection: "column" },
  invitedBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.palette.accent400,
    borderRadius: 4,
    marginTop: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  invitedBadgeText: { 
    // CRITICAL: Text on colored badge must always be white for visibility
    color: "#FFFFFF", 
    fontSize: 12 
  },
  invitedCaregiverCard: {
    backgroundColor: colors.palette.accent100,
    borderColor: colors.palette.accent400,
    borderWidth: 1,
  },
  invitedCaregiverName: {
    color: colors.palette.accent500,
  },
  invitedEditButton: {
    // Button preset will handle styling, but we can override if needed
  },
  listContentContainer: { paddingHorizontal: 16, paddingVertical: 20 },
  noCaregiversText: { 
    color: colors.textDim || colors.palette?.neutral600 || "#666666", 
    fontSize: 16, 
    marginTop: 20, 
    textAlign: "center" 
  },
  notAuthorizedContainer: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  notAuthorizedText: {
    color: colors.textDim || colors.palette?.neutral600 || "#666666",
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
  },
  notAuthorizedTitle: {
    color: colors.palette.biancaError,
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
  },
})
