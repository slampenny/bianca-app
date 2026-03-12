import { createStackNavigator } from "@react-navigation/stack"
import { Platform, ViewStyle } from "react-native"
import { LoginScreen, RegisterScreen, RequestResetScreen, ConfirmResetScreen, PrivacyScreen, PrivacyPracticesScreen, TermsScreen, EmailVerifiedScreen, EmailVerificationRequiredScreen, VerifyEmailScreen, VerifyPhoneScreen, SignupScreen, SSOAccountLinkingScreen, MFAVerificationScreen, ClientConsentScreen, OnboardingAboutYouScreen, OnboardingHowBiancaWorksScreen, OnboardingOrgInfoScreen, OnboardingRegistrationScreen } from "app/screens"
import MainTabs from "./MainTabs"
import { AppStackParamList, LoginStackParamList, OnboardingStackParamList } from "./navigationTypes"
import { translate } from "app/i18n"
import { useLanguage } from "app/hooks/useLanguage"
import { useTheme } from "app/theme/ThemeContext"
import { createThemeAwareHeaderOptions } from "./navigationHelpers"
import { navigationRef } from "./navigationUtilities"

// On web, stack Card uses deprecated shadow*; cardStyle with boxShadow avoids the warning
const webCardStyle: ViewStyle | undefined = Platform.OS === "web" ? ({ boxShadow: "0 2px 12px rgba(0,0,0,0.08)" } as ViewStyle) : undefined

const Stack = createStackNavigator<AppStackParamList>()
const LoginStack = createStackNavigator<LoginStackParamList>()
const OnboardingStack = createStackNavigator<OnboardingStackParamList>()

export const OnboardingStackNavigator = () => {
  const { colors } = useTheme()
  return (
    <OnboardingStack.Navigator
      screenOptions={{ headerShown: false, cardStyle: webCardStyle }}
      initialRouteName="OnboardingAboutYou"
    >
      <OnboardingStack.Screen name="OnboardingAboutYou" component={OnboardingAboutYouScreen} />
      <OnboardingStack.Screen name="OnboardingHowBiancaWorks" component={OnboardingHowBiancaWorksScreen} />
      <OnboardingStack.Screen name="OnboardingOrgInfo" component={OnboardingOrgInfoScreen} />
      <OnboardingStack.Screen name="OnboardingRegistration" component={OnboardingRegistrationScreen} />
      <OnboardingStack.Screen
        name="Terms"
        component={TermsScreen}
        options={createThemeAwareHeaderOptions("headers.termsOfService", colors)}
      />
      <OnboardingStack.Screen
        name="Privacy"
        component={PrivacyScreen}
        options={createThemeAwareHeaderOptions("headers.privacyPolicy", colors)}
      />
    </OnboardingStack.Navigator>
  )
}

export const AuthStack = () => {
  const { currentLanguage } = useLanguage()
  const { colors } = useTheme()
  
  return (
    <Stack.Navigator 
      screenOptions={{ 
        headerShown: false,
        cardStyle: webCardStyle,
      }}
    >
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen 
        name="Privacy" 
        component={PrivacyScreen}
        options={createThemeAwareHeaderOptions("headers.privacyPolicy", colors)}
      />
      <Stack.Screen 
        name="PrivacyPractices" 
        component={PrivacyPracticesScreen}
        options={createThemeAwareHeaderOptions("headers.privacyPractices", colors)}
      />
      <Stack.Screen 
        name="Terms" 
        component={TermsScreen}
        options={createThemeAwareHeaderOptions("headers.termsOfService", colors)}
      />
      <Stack.Screen name="EmailVerified" component={EmailVerifiedScreen} />
      <Stack.Screen name="EmailVerificationRequired" component={EmailVerificationRequiredScreen} />
      <Stack.Screen name="VerifyPhone" component={VerifyPhoneScreen} />
      <Stack.Screen name="ClientConsent" component={ClientConsentScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  )
}

export const UnauthStack = () => {
  const { currentLanguage } = useLanguage() // This will trigger re-render when language changes
  const { colors } = useTheme()
  
  // Don't automatically reset to Login when UnauthStack mounts
  // Let the linking config and initialState handle navigation
  // This allows reset-password and signup URLs to work correctly
  
  return (
    <LoginStack.Navigator 
      screenOptions={{ headerShown: false, cardStyle: webCardStyle }}
      // Don't set initialRouteName - let React Navigation linking handle it based on URL
    >
      <LoginStack.Screen name="Login" component={LoginScreen} options={() => ({ title: translate("headers.login") })} />
      <LoginStack.Screen name="Register" component={RegisterScreen} options={() => ({ title: translate("headers.register") })} />
      <LoginStack.Screen name="OnboardingAboutYou" component={OnboardingAboutYouScreen} />
      <LoginStack.Screen name="OnboardingHowBiancaWorks" component={OnboardingHowBiancaWorksScreen} />
      <LoginStack.Screen name="OnboardingOrgInfo" component={OnboardingOrgInfoScreen} />
      <LoginStack.Screen name="Signup" component={SignupScreen} />
      <LoginStack.Screen name="RequestReset" component={RequestResetScreen} />
      <LoginStack.Screen name="ConfirmReset" component={ConfirmResetScreen} />
      <LoginStack.Screen 
        name="Privacy" 
        component={PrivacyScreen}
        options={createThemeAwareHeaderOptions("headers.privacyPolicy", colors)}
      />
      <LoginStack.Screen 
        name="PrivacyPractices" 
        component={PrivacyPracticesScreen}
        options={createThemeAwareHeaderOptions("headers.privacyPractices", colors)}
      />
      <LoginStack.Screen 
        name="Terms" 
        component={TermsScreen}
        options={createThemeAwareHeaderOptions("headers.termsOfService", colors)}
      />
      <LoginStack.Screen name="EmailVerified" component={EmailVerifiedScreen} />
      <LoginStack.Screen name="EmailVerificationRequired" component={EmailVerificationRequiredScreen} />
      <LoginStack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
      <LoginStack.Screen name="SSOAccountLinking" component={SSOAccountLinkingScreen} />
      <LoginStack.Screen name="MFAVerification" component={MFAVerificationScreen} />
      <LoginStack.Screen name="ClientConsent" component={ClientConsentScreen} options={{ headerShown: false }} />
    </LoginStack.Navigator>
  )
}
