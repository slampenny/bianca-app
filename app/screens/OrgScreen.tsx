import React, { useState, useEffect } from "react"
import { useSelector, useDispatch } from "react-redux"
import { Text, TextInput, ScrollView, Pressable, StyleSheet, View, Image } from "react-native"
import { getOrg } from "../store/orgSlice"
import { getCurrentUser } from "../store/authSlice"
import { useUpdateOrgMutation } from "../services/api/orgApi"
import { LoadingScreen } from "./LoadingScreen"
import { goBack } from "app/navigators"
import { useNavigation, NavigationProp } from "@react-navigation/native"
import { OrgStackParamList } from "app/navigators/navigationTypes"
import { useTheme } from "app/theme/ThemeContext"
import { clearCaregiver } from "../store/caregiverSlice"
import AvatarPicker from "../components/AvatarPicker"
import { translate } from "../i18n"

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

  const navigation = useNavigation<NavigationProp<OrgStackParamList>>()

  // Check if user has permission to invite caregivers
  const canInviteCaregivers = currentUser?.role === 'orgAdmin' || currentUser?.role === 'superAdmin'
  
  // Check if user has permission to edit org details
  const canEditOrg = currentUser?.role === 'orgAdmin' || currentUser?.role === 'superAdmin'

  useEffect(() => {
    if (currentOrg) {
      setName(currentOrg.name)
      setEmail(currentOrg.email)
      setPhone(currentOrg.phone)
      setLogo(currentOrg.logo || null)
      setIsLoading(false)
    }
  }, [currentOrg])

  const handleSave = async () => {
    if (currentOrg?.id) {
      await updateOrg({
        orgId: currentOrg.id,
        org: {
          name,
          email,
          phone,
          logo,
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
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} testID="org-screen">
      {isError && (
        <Text style={styles.errorText}>
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
          <Text style={styles.sectionTitle}>Organization Logo</Text>
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
              <Text style={styles.noLogoText}>No logo set</Text>
            </View>
          )}
        </View>

        <TextInput
          style={[styles.input, !canEditOrg && styles.readonlyInput]}
          placeholder={translate("orgScreen.namePlaceholder")}
          value={name}
          onChangeText={setName}
          placeholderTextColor={colors.palette.neutral600}
          editable={canEditOrg}
        />
        <TextInput
          style={[styles.input, !canEditOrg && styles.readonlyInput]}
          placeholder={translate("orgScreen.emailPlaceholder")}
          value={email}
          onChangeText={setEmail}
          placeholderTextColor={colors.palette.neutral600}
          editable={canEditOrg}
        />
        <TextInput
          style={[styles.input, !canEditOrg && styles.readonlyInput]}
          placeholder={translate("orgScreen.phonePlaceholder")}
          value={phone}
          onChangeText={setPhone}
          placeholderTextColor={colors.palette.neutral600}
          editable={canEditOrg}
        />
        {canEditOrg && (
          <Pressable style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>{translate("orgScreen.save")}</Text>
          </Pressable>
        )}
      </View>
      <Pressable style={styles.viewCaregiversButton} onPress={handleViewCaregivers} testID="view-caregivers-button">
        <Text style={styles.viewCaregiversButtonText}>{translate("orgScreen.viewCaregivers")}</Text>
      </Pressable>
      {canInviteCaregivers && (
        <Pressable style={styles.inviteCaregiverButton} onPress={handleInviteCaregiver} testID="invite-caregiver-button">
          <Text style={styles.inviteCaregiverButtonText}>{translate("orgScreen.inviteCaregiver")}</Text>
        </Pressable>
      )}
      <Pressable style={styles.paymentButton} onPress={handlePaymentPress} testID="payment-button">
        <Text style={styles.paymentButtonText}>{translate("orgScreen.payments")}</Text>
      </Pressable>
    </ScrollView>
  )
}

const createStyles = (colors: any) => StyleSheet.create({
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
  input: {
    borderColor: colors.palette.neutral300,
    borderRadius: 5,
    borderWidth: 1,
    color: colors.palette.biancaHeader,
    fontSize: 16,
    height: 45,
    marginBottom: 15,
    paddingHorizontal: 10,
  },
  readonlyInput: {
    backgroundColor: colors.palette.neutral200,
    color: colors.palette.neutral600,
    borderColor: colors.palette.neutral400,
  },
  saveButton: {
    alignItems: "center",
    backgroundColor: colors.palette.biancaButtonSelected,
    borderRadius: 5,
    paddingVertical: 15,
  },
  saveButtonText: {
    color: colors.palette.neutral100,
    fontSize: 18,
    fontWeight: "600",
  },
  viewCaregiversButton: {
    alignItems: "center",
    backgroundColor: colors.palette.biancaSuccess,
    borderRadius: 5,
    marginTop: 10,
    paddingVertical: 15,
  },
  viewCaregiversButtonText: {
    color: colors.palette.neutral100,
    fontSize: 18,
    fontWeight: "600",
  },
  inviteCaregiverButton: {
    alignItems: "center",
    backgroundColor: colors.palette.biancaButtonSelected,
    borderRadius: 5,
    marginTop: 10,
    paddingVertical: 15,
  },
  inviteCaregiverButtonText: {
    color: colors.palette.neutral100,
    fontSize: 18,
    fontWeight: "600",
  },
  logoSection: {
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.palette.neutral300,
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
    alignItems: "center",
    backgroundColor: colors.palette.accent500,
    borderRadius: 5,
    marginTop: 10,
    paddingVertical: 15,
  },
  paymentButtonText: {
    color: colors.palette.neutral100,
    fontSize: 18,
    fontWeight: "600",
  },
})
