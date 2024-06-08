import { createStackNavigator } from '@react-navigation/stack';
import { LoginScreen, RegisterScreen, RequestResetScreen, ConfirmResetScreen } from "app/screens";
import MainTabsWithDrawer from './MainTabsWithDrawer';
import { AppStackParamList, LoginStackParamList } from './navigationTypes';

const Stack = createStackNavigator<AppStackParamList>();
const LoginStack = createStackNavigator<LoginStackParamList>();

export const AuthStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="MainTabsWithDrawer" component={MainTabsWithDrawer} />
  </Stack.Navigator>
);

export const UnauthStack = () => (
  <LoginStack.Navigator screenOptions={{ headerShown: false }}>
    <LoginStack.Screen name="Login" component={LoginScreen} />
    <LoginStack.Screen name="Register" component={RegisterScreen} />
    <LoginStack.Screen name="RequestReset" component={RequestResetScreen} />
    <LoginStack.Screen name="ConfirmReset" component={ConfirmResetScreen} />
  </LoginStack.Navigator>
);
