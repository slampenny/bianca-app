import React, { useState, useEffect } from "react"
import { View, ViewStyle, Alert } from "react-native"
import { StackScreenProps } from "@react-navigation/stack"
import { useRoute } from "@react-navigation/native"
import { useRegisterWithInviteMutation } from "../services/api/authApi"
import { Button, Text, TextField, Screen, Header } from "app/components"
import { LegalLinks } from "app/components/LegalLinks"
import { LoginStackParamList } from "app/navigators/navigationTypes"
import { spacing } from "app/theme"
import { translate } from "../i18n"

type SignupScreenRouteProp = StackScreenProps<LoginStackParamList, "Signup">

export const SignupScreen = (props: SignupScreenRouteProp) => {
  const { navigation } = props
  const route = useRoute()
  const token = (route.params as any)?.token



  const [registerWithInvite, { isLoading }] = useRegisterWithInviteMutation()

  // Form state - name, email, phone will be prefilled from invite
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  // Error states
  const [passwordError, setPasswordError] = useState("")
  const [confirmPasswordError, setConfirmPasswordError] = useState("")
  const [generalError, setGeneralError] = useState("")

  // Check if we have an invite token
  useEffect(() => {
    if (!token) {
      Alert.alert(
        "Invalid Invitation",
        "This invitation link is invalid or has expired. Please contact your organization administrator.",
        [{ text: "OK", onPress: () => navigation.navigate("Login") }]
      )
      return
    }

    // TODO: Decode token to prefill user information
    // For now, we'll let the backend handle token validation
    console.log("Signup with invite token:", token)
  }, [token, navigation])

  const validateForm = () => {
    let isValid = true
    
    // Reset errors
    setPasswordError("")
    setConfirmPasswordError("")
    setGeneralError("")

    // Validate password
    if (!password) {
      setPasswordError("Password is required")
      isValid = false
    } else if (password.length < 6) {
      setPasswordError("Password must be at least 6 characters")
      isValid = false
    }

    // Validate confirm password
    if (!confirmPassword) {
      setConfirmPasswordError("Please confirm your password")
      isValid = false
    } else if (password !== confirmPassword) {
      setConfirmPasswordError("Passwords do not match")
      isValid = false
    }

    return isValid
  }

  const handleSignup = async () => {
    if (!validateForm()) return
    if (!token) return

    try {
      const result = await registerWithInvite({
        token,
        password,
        // The backend will get name, email, phone from the token
      }).unwrap()

      console.log("Signup successful:", result)
      
      // Navigate to main app since user is now registered and logged in
      navigation.navigate("MainTabs" as any)
      
    } catch (error: any) {
      console.error("Signup error:", error)
      
      if (error?.data?.message) {
        setGeneralError(error.data.message)
      } else if (error?.message) {
        setGeneralError(error.message)
      } else {
        setGeneralError("An error occurred during signup. Please try again.")
      }
    }
  }

  return (
    <Screen 
      preset="auto" 
      contentContainerStyle={$screenContentContainer}
      safeAreaEdges={["top"]}
    >
      <Header 
        title={translate("signupScreen.title")}
        leftIcon="back"
        onLeftPress={() => navigation.goBack()}
      />
      
      <View style={$content}>
        <Text 
          preset="heading" 
          text="Welcome to My Phone Friend!" 
          style={$title}
        />
        
        <Text 
          preset="default"
          text="You've been invited to join your organization's account. Complete your registration below."
          style={$subtitle}
        />

        {generalError ? (
          <Text 
            text={generalError}
            style={$errorText}
          />
        ) : null}

        <View style={$form}>
          <TextField
            value={name}
            onChangeText={setName}
            label={translate("signupScreen.fullNameLabel")}
            placeholder={translate("signupScreen.fullNamePlaceholder")}
            editable={false}
            containerStyle={$textField}
          />

          <TextField
            value={email}
            onChangeText={setEmail}
            label={translate("signupScreen.emailLabel")}
            placeholder={translate("signupScreen.emailPlaceholder")}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={false}
            containerStyle={$textField}
          />

          <TextField
            value={phone}
            onChangeText={setPhone}
            label={translate("signupScreen.phoneLabel")}
            placeholder={translate("signupScreen.phonePlaceholder")}
            keyboardType="phone-pad"
            editable={false}
            containerStyle={$textField}
          />

          <TextField
            value={password}
            onChangeText={(text) => {
              setPassword(text)
              setPasswordError("")
            }}
            label={translate("signupScreen.passwordLabel")}
            placeholder={translate("signupScreen.passwordPlaceholder")}
            secureTextEntry
            status={passwordError ? "error" : undefined}
            helper={passwordError}
            containerStyle={$textField}
          />

          <TextField
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text)
              setConfirmPasswordError("")
            }}
            label={translate("signupScreen.confirmPasswordLabel")}
            placeholder={translate("signupScreen.confirmPasswordPlaceholder")}
            secureTextEntry
            status={confirmPasswordError ? "error" : undefined}
            helper={confirmPasswordError}
            containerStyle={$textField}
          />

          <Button
            text={isLoading ? "Creating Account..." : "Complete Registration"}
            onPress={handleSignup}
            disabled={isLoading || !password || !confirmPassword}
            style={$signupButton}
          />

          <Text 
            size="sm"
            text="Your name, email, and organization details have been pre-configured by your administrator."
            style={$infoText}
          />
        </View>

        <LegalLinks />
      </View>
    </Screen>
  )
}

const $screenContentContainer: ViewStyle = {
  flexGrow: 1,
}

const $content: ViewStyle = {
  flex: 1,
  paddingHorizontal: spacing.lg,
  paddingTop: spacing.md,
  paddingBottom: spacing.lg,
}

const $title = {
  textAlign: "center" as const,
  marginBottom: spacing.sm,
}

const $subtitle = {
  textAlign: "center" as const,
  marginBottom: spacing.xl,
  lineHeight: 24,
}

const $form: ViewStyle = {
  flex: 1,
}

const $textField: ViewStyle = {
  marginBottom: spacing.md,
}

const $signupButton: ViewStyle = {
  marginTop: spacing.lg,
  marginBottom: spacing.md,
}

const $errorText = {
  textAlign: "center" as const,
  marginBottom: spacing.md,
  paddingHorizontal: spacing.sm,
}

const $infoText = {
  textAlign: "center" as const,
  fontStyle: "italic" as const,
  marginTop: spacing.md,
  lineHeight: 20,
}