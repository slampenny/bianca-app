import React from "react"
import { View, StyleSheet, Text } from "react-native"
import { useNavigation, NavigationProp, RouteProp } from "@react-navigation/native"
import { Screen, LoadingButton } from "app/components"
import { colors } from "app/theme/colors"
import { OrgStackParamList } from "app/navigators/navigationTypes"

type CaregiverInvitedScreenRouteProp = RouteProp<OrgStackParamList, "CaregiverInvited">

interface CaregiverInvitedScreenProps {
  route: CaregiverInvitedScreenRouteProp
}

export const CaregiverInvitedScreen: React.FC<any> = ({ route }) => {
  const navigation = useNavigation<NavigationProp<OrgStackParamList>>()
  const { caregiver } = route.params

  const handleContinue = () => {
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

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
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
    color: colors.text,
    marginBottom: 16,
    textAlign: "center",
  },
  message: {
    fontSize: 16,
    color: colors.text,
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