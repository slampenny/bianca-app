import { createStackNavigator } from "@react-navigation/stack"
import { LoginScreen, RegisterScreen, RequestResetScreen, ConfirmResetScreen, PrivacyScreen, PrivacyPracticesScreen, TermsScreen, EmailVerifiedScreen, EmailVerificationRequiredScreen, VerifyEmailScreen, VerifyPhoneScreen, SignupScreen, SSOAccountLinkingScreen, MFAVerificationScreen } from "app/screens"
import MainTabs from "./MainTabs"
import { AppStackParamList, LoginStackParamList } from "./navigationTypes"
import { translate } from "app/i18n"
import { useLanguage } from "app/hooks/useLanguage"
import { useTheme } from "app/theme/ThemeContext"
import { createThemeAwareHeaderOptions } from "./navigationHelpers"

const Stack = createStackNavigator<AppStackParamList>()
const LoginStack = createStackNavigator<LoginStackParamList>()

export const AuthStack = () => {
  const { currentLanguage } = useLanguage()
  const { colors } = useTheme()
  
  return (
    <Stack.Navigator 
      screenOptions={{ 
        headerShown: false,
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
    </Stack.Navigator>
  )
}

export const UnauthStack = () => {
  const { currentLanguage } = useLanguage() // This will trigger re-render when language changes
  const { colors } = useTheme()
  
  return (
    <LoginStack.Navigator screenOptions={{ headerShown: false }}>
      <LoginStack.Screen name="Login" component={LoginScreen} options={() => ({ title: translate("headers.login") })} />
      <LoginStack.Screen name="Register" component={RegisterScreen} options={() => ({ title: translate("headers.register") })} />
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
    </LoginStack.Navigator>
  )
}
