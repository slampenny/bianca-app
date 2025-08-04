import { createStackNavigator } from "@react-navigation/stack"
import { LoginScreen, RegisterScreen, RequestResetScreen, ConfirmResetScreen, PrivacyScreen, TermsScreen, EmailVerifiedScreen } from "app/screens"
import MainTabs from "./MainTabs"
import { AppStackParamList, LoginStackParamList } from "./navigationTypes"

const Stack = createStackNavigator<AppStackParamList>()
const LoginStack = createStackNavigator<LoginStackParamList>()

export const AuthStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="MainTabs" component={MainTabs} />
    <Stack.Screen name="Privacy" component={PrivacyScreen} />
    <Stack.Screen name="Terms" component={TermsScreen} />
    <Stack.Screen name="EmailVerified" component={EmailVerifiedScreen} />
  </Stack.Navigator>
)

export const UnauthStack = () => (
  <LoginStack.Navigator screenOptions={{ headerShown: false }}>
    <LoginStack.Screen name="Login" component={LoginScreen} />
    <LoginStack.Screen name="Register" component={RegisterScreen} />
    <LoginStack.Screen name="RequestReset" component={RequestResetScreen} />
    <LoginStack.Screen name="ConfirmReset" component={ConfirmResetScreen} />
    <LoginStack.Screen name="Privacy" component={PrivacyScreen} />
    <LoginStack.Screen name="Terms" component={TermsScreen} />
    <LoginStack.Screen name="EmailVerified" component={EmailVerifiedScreen} />
  </LoginStack.Navigator>
)
