import React, { useState, useEffect } from "react"
import { useSelector, useDispatch } from "react-redux"
import { ScrollView, StyleSheet, View, Image } from "react-native"
import { getOrg } from "../store/orgSlice"
import { getCurrentUser } from "../store/authSlice"
import { useUpdateOrgMutation, orgApi } from "../services/api/orgApi"
import { LoadingScreen } from "./LoadingScreen"
import { goBack } from "app/navigators/navigationUtilities"
import { useNavigation, NavigationProp } from "@react-navigation/native"
import { OrgStackParamList } from "app/navigators/navigationTypes"
import { useTheme } from "app/theme/ThemeContext"
import { clearCaregiver } from "../store/caregiverSlice"
import { setOrg } from "../store/orgSlice"
import AvatarPicker from "../components/AvatarPicker"
import { translate } from "../i18n"
import type { ThemeColors } from "../types"
import { Button, Text, TextField, Toggle } from "app/components"
import { logger } from "../utils/logger"

export function OrgScreen() {
  const dispatch = useDispatch()
  const currentOrg = useSelector(getOrg)
  const currentUser = useSelector(getCurrentUser)
  const { colors, isLoading: themeLoading } = useTheme()
  const [updateOrg, { isError, error }] = useUpdateOrgMutation()
  const [isLoading, setIsLoading] = useState(true)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [logo, setLogo] = useState<string | null>(null)
  const [logoBlob, setLogoBlob] = useState<Blob | null>(null)
  const [retryCount, setRetryCount] = useState("2")
  const [retryIntervalMinutes, setRetryIntervalMinutes] = useState("15")
  const [alertOnAllMissedCalls, setAlertOnAllMissedCalls] = useState(false)

  const navigation = useNavigation<NavigationProp<OrgStackParamList>>()

  // Check if user has permission to invite caregivers
  const canInviteCaregivers = currentUser?.role === 'orgAdmin' || currentUser?.role === 'superAdmin'
  
  // Check if user has permission to edit org details
  const canEditOrg = currentUser?.role === 'orgAdmin' || currentUser?.role === 'superAdmin'

  useEffect(() => {
    const loadOrg = async () => {
      // If org is already in Redux, use it
      if (currentOrg) {
        setName(currentOrg.name)
        setEmail(currentOrg.email)
        setPhone(currentOrg.phone)
        setLogo(currentOrg.logo || null)
        // Initialize call retry settings
        if (currentOrg.callRetrySettings) {
          setRetryCount(String(currentOrg.callRetrySettings.retryCount ?? 2))
          setRetryIntervalMinutes(String(currentOrg.callRetrySettings.retryIntervalMinutes ?? 15))
          setAlertOnAllMissedCalls(currentOrg.callRetrySettings.alertOnAllMissedCalls ?? false)
        } else {
          // Use defaults if not set
          setRetryCount("2")
          setRetryIntervalMinutes("15")
          setAlertOnAllMissedCalls(false)
        }
        setIsLoading(false)
        return
      }

      // If user has an org reference but org not in Redux, fetch it
      if (currentUser?.org && !currentOrg) {
        try {
          const orgResponse = await dispatch(orgApi.endpoints.getOrg.initiate({ orgId: currentUser.org }))
          if (orgResponse.data) {
            dispatch(setOrg(orgResponse.data))
            // The useEffect will run again when currentOrg updates
          } else {
            // No org found - stop loading to show the screen
            setIsLoading(false)
          }
        } catch (error) {
          logger.error('Failed to load org:', error)
          // Stop loading even if fetch fails
          setIsLoading(false)
        }
      } else {
        // No org reference - stop loading
        setIsLoading(false)
      }
    }

    loadOrg()
  }, [currentOrg, currentUser?.org, dispatch])

  const handleSave = async () => {
    if (currentOrg?.id) {
      await updateOrg({
        orgId: currentOrg.id,
        org: {
          name,
          email,
          phone,
          logo,
          callRetrySettings: {
            retryCount: parseInt(retryCount, 10) || 2,
            retryIntervalMinutes: parseInt(retryIntervalMinutes, 10) || 15,
            alertOnAllMissedCalls,
          },
        },
      })
    }
    if (!isError) {
      goBack()
    }
  }

  const handleViewCaregivers = () => {
    // Navigate to a dedicated caregivers list screen
    navigation.navigate("Caregivers")
  }

  const handleInviteCaregiver = () => {
    // Clear any existing caregiver so the invite form starts fresh
    dispatch(clearCaregiver())
    // Navigate to caregiver screen in invite mode (no caregiver selected)
    navigation.navigate("Caregiver")
  }

  const handlePaymentPress = () => {
    // Navigate to payment screen
    navigation.navigate("Payment")
  }

  if (isLoading) {
    return <LoadingScreen />
  }

  if (themeLoading) {
    return <LoadingScreen />
  }

  const styles = createStyles(colors)

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} testID="org-screen" accessibilityLabel="org-screen">
      {isError && (
        <Text style={styles.errorText} preset="formHelper">
          {"status" in error && "data" in error
            ? `Status: ${error.status}, Data: ${JSON.stringify(error.data)}`
            : "error" in error
            ? error.error
            : "Unknown error"}
        </Text>
      )}
      <View style={styles.formCard}>
        {/* Logo Section */}
        <View style={styles.logoSection}>
          <Text style={styles.sectionTitle} preset="formLabel">{translate("orgScreen.organizationLogo")}</Text>
          {canEditOrg ? (
            <AvatarPicker
              initialAvatar={logo}
              onAvatarChanged={({ uri, blob }) => {
                setLogo(uri)
                if (blob) setLogoBlob(blob)
              }}
            />
          ) : logo ? (
            <Image source={{ uri: logo }} style={styles.logoPreview} />
          ) : (
            <View style={styles.noLogoContainer}>
              <Text style={styles.noLogoText} preset="formHelper">{translate("orgScreen.noLogoSet")}</Text>
            </View>
          )}
        </View>

        <TextField
          placeholderTx="orgScreen.namePlaceholder"
          value={name}
          onChangeText={setName}
          editable={canEditOrg}
          containerStyle={styles.inputContainer}
          inputWrapperStyle={!canEditOrg ? styles.readonlyInputWrapper : styles.inputWrapper}
          style={!canEditOrg ? styles.readonlyInput : styles.input}
        />
        <TextField
          placeholderTx="orgScreen.emailPlaceholder"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          editable={canEditOrg}
          containerStyle={styles.inputContainer}
          inputWrapperStyle={!canEditOrg ? styles.readonlyInputWrapper : styles.inputWrapper}
          style={!canEditOrg ? styles.readonlyInput : styles.input}
        />
        <TextField
          placeholderTx="orgScreen.phonePlaceholder"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          editable={canEditOrg}
          containerStyle={styles.inputContainer}
          inputWrapperStyle={!canEditOrg ? styles.readonlyInputWrapper : styles.inputWrapper}
          style={!canEditOrg ? styles.readonlyInput : styles.input}
        />

        {/* Call Retry Settings Section */}
        <View style={styles.callRetrySection}>
          <Text style={styles.sectionTitle} preset="formLabel">
            {translate("orgScreen.callRetrySettings")}
          </Text>
          
          <TextField
            labelTx="orgScreen.retryCountLabel"
            helperTx="orgScreen.retryCountHelper"
            value={retryCount}
            onChangeText={setRetryCount}
            keyboardType="numeric"
            editable={canEditOrg}
            containerStyle={styles.inputContainer}
            inputWrapperStyle={!canEditOrg ? styles.readonlyInputWrapper : styles.inputWrapper}
            style={!canEditOrg ? styles.readonlyInput : styles.input}
          />
          
          <TextField
            labelTx="orgScreen.retryIntervalMinutesLabel"
            helperTx="orgScreen.retryIntervalMinutesHelper"
            value={retryIntervalMinutes}
            onChangeText={setRetryIntervalMinutes}
            keyboardType="numeric"
            editable={canEditOrg}
            containerStyle={styles.inputContainer}
            inputWrapperStyle={!canEditOrg ? styles.readonlyInputWrapper : styles.inputWrapper}
            style={!canEditOrg ? styles.readonlyInput : styles.input}
          />
          
          <Toggle
            variant="switch"
            labelTx="orgScreen.alertOnAllMissedCallsLabel"
            helperTx="orgScreen.alertOnAllMissedCallsHelper"
            value={alertOnAllMissedCalls}
            onValueChange={setAlertOnAllMissedCalls}
            editable={canEditOrg}
            containerStyle={styles.inputContainer}
          />
        </View>

        {canEditOrg && (
          <Button 
            preset="primary"
            text={translate("orgScreen.save")}
            onPress={handleSave}
          />
        )}
      </View>

      {/* Actions Section */}
      <View style={styles.actionsContainer}>
        <Text style={styles.actionsTitle} preset="formLabel">
          {translate("orgScreen.organizationActions")}
        </Text>
        
        <View style={styles.actionsGrid}>
          <Button 
            preset="default"
            text={translate("orgScreen.viewCaregivers")}
            onPress={handleViewCaregivers} 
            testID="view-caregivers-button"
            accessibilityLabel="view-caregivers-button"
            style={styles.actionButton}
            textStyle={styles.actionButtonText}
          />
          
          {canInviteCaregivers && (
            <Button 
              preset="primary"
              text={translate("orgScreen.inviteCaregiver")}
              onPress={handleInviteCaregiver} 
              testID="invite-caregiver-button"
              style={[styles.actionButton, styles.primaryActionButton]}
              textStyle={styles.primaryActionButtonText}
            />
          )}
          
          <Button 
            preset="default"
            text={translate("orgScreen.payments")}
            onPress={handlePaymentPress} 
            testID="payment-button"
            style={styles.actionButton}
            textStyle={styles.actionButtonText}
          />
        </View>
      </View>
    </ScrollView>
  )
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    backgroundColor: colors.palette.biancaBackground,
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  errorText: {
    color: colors.palette.biancaError,
    marginBottom: 10,
    textAlign: "center",
  },
  formCard: {
    backgroundColor: colors.palette.neutral100,
    borderRadius: 6,
    elevation: 2,
    marginBottom: 20,
    padding: 20,
    shadowColor: colors.palette.neutral900,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  header: {
    alignItems: "center",
    backgroundColor: colors.palette.neutral100,
    borderBottomWidth: 1,
    borderColor: colors.palette.biancaBorder,
    marginBottom: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    color: colors.palette.biancaHeader,
    fontSize: 24,
    fontWeight: "600",
  },
  inputContainer: {
    marginBottom: 15,
  },
  inputWrapper: {
    // Default input wrapper - TextField handles most styling
  },
  input: {
    // Text input style - TextField handles color automatically via theme
  },
  readonlyInputWrapper: {
    backgroundColor: colors.palette.neutral200,
  },
  readonlyInput: {
    // Read-only input style - TextField handles text color automatically via theme
    // Override text color for readonly state if needed
    opacity: 0.7,
  },
  saveButton: {
    marginTop: 10,
  },
  logoSection: {
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.palette.neutral300,
  },
  callRetrySection: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: colors.palette.neutral300,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.palette.biancaHeader,
    marginBottom: 15,
  },
  logoPreview: {
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: colors.palette.neutral200,
  },
  noLogoContainer: {
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: colors.palette.neutral200,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.palette.neutral300,
    borderStyle: "dashed",
  },
  noLogoText: {
    color: colors.palette.neutral600,
    fontSize: 12,
    textAlign: "center",
  },
  paymentButton: {
    marginTop: 10,
  },
  actionsContainer: {
    marginTop: 8,
  },
  actionsTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textDim || colors.palette?.neutral600 || "#737373",
    marginBottom: 16,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  actionsGrid: {
    gap: 10,
  },
  actionButton: {
    minHeight: 60,
    borderRadius: 14,
    // Default preset handles background and border - only add spacing/shadow
    shadowColor: colors.palette?.neutral900 || "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: "600",
    // Default preset handles text color automatically
  },
  primaryActionButton: {
    backgroundColor: colors.palette?.primary500 || colors.tint,
    borderColor: colors.palette?.primary500 || colors.tint,
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryActionButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
})
