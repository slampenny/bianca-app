import React from "react"
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"
import { createStackNavigator } from "@react-navigation/stack"
import { Ionicons } from "@expo/vector-icons"
import {
  HomeScreen,
  PatientScreen,
  SchedulesScreen,
  ConversationsScreen,
  CaregiverScreen,
  CaregiversScreen,
  CaregiverInvitedScreen,
  AlertScreen,
  OrgScreen,
  PaymentInfoScreen,
  ProfileScreen,
  LogoutScreen,
  PrivacyScreen,
  TermsScreen,
} from "app/screens"
import { DrawerParamList } from "./navigationTypes"
import ProfileButton from "app/components/ProfileButton"
import { useSelector } from "react-redux"
import { getCurrentUser } from "app/store/authSlice"
import { selectUnreadAlertCount } from "app/store/alertSlice"

const Stack = createStackNavigator()
const Tab = createBottomTabNavigator<DrawerParamList>()

function HomeStack() {
  return (
    <Stack.Navigator
      screenOptions={({ route, navigation }) => ({
        headerShown: true,
        headerTitle: route.name,
        // No left button since we're not using a drawer/hamburger
        headerRight: () => <ProfileButton />,
      })}
    >
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Patient" component={PatientScreen} />
      <Stack.Screen name="Schedule" component={SchedulesScreen} />
      <Stack.Screen name="Conversations" component={ConversationsScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Privacy" component={PrivacyScreen} options={{ title: "Privacy Policy" }} />
      <Stack.Screen name="Terms" component={TermsScreen} options={{ title: "Terms of Service" }} />
      <Stack.Screen name="Logout" component={LogoutScreen} />
    </Stack.Navigator>
  )
}

function ProfileStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerRight: () =>
          <ProfileButton/>
      }}
    >
      <Stack.Screen name="Profile" component={CaregiverScreen} />
      <Stack.Screen name="Privacy" component={PrivacyScreen} options={{ title: "Privacy Policy" }} />
      <Stack.Screen name="Terms" component={TermsScreen} options={{ title: "Terms of Service" }} />
    </Stack.Navigator>
  )
}

function AlertStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerRight: () => <ProfileButton />,
      }}
    >
      <Stack.Screen name="Alert" component={AlertScreen} />
    </Stack.Navigator>
  )
}

function OrgStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerRight: () => <ProfileButton />,
      }}
    >
      <Stack.Screen name="Org" component={OrgScreen} />
      <Stack.Screen name="Caregivers" component={CaregiversScreen} />
      <Stack.Screen name="Caregiver" component={CaregiverScreen} />
      <Stack.Screen name="CaregiverInvited" component={CaregiverInvitedScreen} />
    </Stack.Navigator>
  )
}

function PaymentStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerRight: () => <ProfileButton />,
      }}
    >
      <Stack.Screen name="Payment" component={PaymentInfoScreen} />
    </Stack.Navigator>
  )
}

function LogoutStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Logout" component={LogoutScreen} />
    </Stack.Navigator>
  )
}

export default function MainTabNavigator() {
  const unreadAlertCount = useSelector(selectUnreadAlertCount) // Get unread alert count

  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: "#3498db",
        tabBarInactiveTintColor: "#7f8c8d",
        tabBarShowLabel: true, // Show labels
        tabBarIcon: ({ focused, color, size }) => {
          let iconName

          if (route.name === "Home") {
            iconName = focused ? "home" : "home-outline"
          } else if (route.name === "Org") {
            iconName = focused ? "people" : "people-outline"
          } else if (route.name === "Payment") {
            iconName = focused ? "card" : "card-outline"
          } else if (route.name === "Alert") {
            iconName = focused ? "alert-circle" : "alert-circle-outline"
          }

          return <Ionicons name={iconName} size={size} color={color} />
        },
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeStack} 
        options={{ 
          tabBarLabel: "Home",
          tabBarTestID: "tab-home" 
        }} 
      />
      <Tab.Screen 
        name="Org" 
        component={OrgStack} 
        options={{ 
          tabBarLabel: "Org",
          tabBarTestID: "tab-org" 
        }} 
      />
      <Tab.Screen 
        name="Payment" 
        component={PaymentStack} 
        options={{ 
          tabBarLabel: "Payments",
          tabBarTestID: "tab-payment" 
        }} 
      />
      <Tab.Screen
        name="Alert"
        component={AlertStack}
        options={{
          tabBarLabel: "Alerts",
          tabBarBadge: unreadAlertCount > 0 ? unreadAlertCount : null,
          tabBarTestID: "tab-alert",
        }}
      />
    </Tab.Navigator>
  )
}
