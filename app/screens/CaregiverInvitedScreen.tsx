import React from "react"
import { View, StyleSheet } from "react-native"
import { useNavigation, NavigationProp, RouteProp } from "@react-navigation/native"
import { Screen, LoadingButton, Text } from "app/components"
import { useTheme } from "app/theme/ThemeContext"
import { OrgStackParamList } from "app/navigators/navigationTypes"
import { store } from "app/store/store"
import { caregiverApi } from "app/services/api/caregiverApi"

type CaregiverInvitedScreenRouteProp = RouteProp<OrgStackParamList, "CaregiverInvited">

interface CaregiverInvitedScreenProps {
  route: CaregiverInvitedScreenRouteProp
}

export const CaregiverInvitedScreen: React.FC<any> = ({ route }) => {
  const { colors, isLoading: themeLoading } = useTheme()
  const navigation = useNavigation<NavigationProp<OrgStackParamList>>()
  
  // Handle missing route params gracefully
  const caregiver = route?.params?.caregiver || { id: '', name: 'Unknown', email: 'unknown@example.com' }
  
  // Log for debugging
  if (__DEV__) {
    console.log('CaregiverInvitedScreen rendered with params:', route?.params)
  }

  if (themeLoading) {
    return null
  }

  const styles = createStyles(colors)

  const handleContinue = () => {
    // Force invalidate caregiver cache before navigating to ensure fresh data
    store.dispatch(
      caregiverApi.util.invalidateTags([{ type: "Caregiver", id: "LIST" }])
    )
    // Navigate back to the caregivers list
    navigation.navigate("Caregivers")
  }

  return (
    <Screen preset="fixed" style={styles.screen} testID="caregiver-invited-screen">
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.icon}>✅</Text>
          <Text style={styles.title}>Invitation Sent!</Text>
          <Text style={styles.message}>
            An invitation has been sent to {caregiver.name} at {caregiver.email}.
          </Text>
          <Text style={styles.subMessage}>
            They will receive an email with instructions to complete their registration.
          </Text>
        </View>
        
        <View style={styles.buttonContainer}>
          <LoadingButton
            title="Continue"
            onPress={handleContinue}
            style={styles.button}
          />
        </View>
      </View>
    </Screen>
  )
}

const createStyles = (colors: any) => StyleSheet.create({
  screen: {
    backgroundColor: colors.palette.biancaBackground,
  },
  container: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
  },
  content: {
    alignItems: "center",
    marginBottom: 40,
  },
  icon: {
    fontSize: 64,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.palette.biancaHeader,
    marginBottom: 16,
    textAlign: "center",
  },
  message: {
    fontSize: 16,
    color: colors.palette.biancaHeader,
    textAlign: "center",
    marginBottom: 12,
    lineHeight: 24,
  },
  subMessage: {
    fontSize: 14,
    color: colors.palette.neutral600,
    textAlign: "center",
    lineHeight: 20,
  },
  buttonContainer: {
    marginTop: 20,
  },
  button: {
    backgroundColor: colors.palette.biancaSuccess,
  },
}) 