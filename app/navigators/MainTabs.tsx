import React from "react"
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"
import { createStackNavigator } from "@react-navigation/stack"
import { Ionicons } from "@expo/vector-icons"
import { View, Image } from "react-native"
import {
  HomeScreen,
  PatientScreen,
  SchedulesScreen,
  ConversationsScreen,
  CallScreen,
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
  ReportsScreen,
  HealthReportScreen,
  SentimentAnalysisScreen,
  MedicalAnalysisScreen,
} from "app/screens"
import { DrawerParamList } from "./navigationTypes"
import ProfileButton from "app/components/ProfileButton"
import { useSelector } from "react-redux"
import { getOrg } from "app/store/orgSlice"
import { selectUnreadAlertCount } from "app/store/alertSlice"
import { Header } from "app/components/Header"
import { Icon } from "app/components/Icon"
import { translate } from "../i18n"
import { useLanguage } from "../hooks/useLanguage"

const Stack = createStackNavigator()
const Tab = createBottomTabNavigator<DrawerParamList>()

// Custom header component that includes org logo
function CustomHeader({ route, navigation, options }: any) {
  const currentOrg = useSelector(getOrg)
  
  // Create logo component for left side
  const LogoComponent = currentOrg?.logo ? (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 12 }}>
      <Image
        source={{ uri: currentOrg.logo }}
        style={{ width: 32, height: 32, marginRight: 8 }}
        resizeMode="contain"
      />
      {navigation.canGoBack() && (
        <Icon
          icon="caretLeft"
          size={24}
          onPress={navigation.goBack}
          style={{ marginLeft: 4 }}
        />
      )}
    </View>
  ) : navigation.canGoBack() ? (
    <Icon
      icon="caretLeft"
      size={24}
      onPress={navigation.goBack}
    />
  ) : undefined
  
  return (
    <Header
      title={options.title || route.name}
      LeftActionComponent={LogoComponent}
      RightActionComponent={<ProfileButton />}
    />
  )
}

function HomeStack() {
  const { currentLanguage } = useLanguage() // This will trigger re-render when language changes
  
  return (
    <Stack.Navigator
      screenOptions={({ route, navigation }) => ({
        headerShown: true,
        header: (props) => <CustomHeader {...props} />,
      })}
    >
      <Stack.Screen name="HomeDetail" component={HomeScreen} options={() => ({ title: translate("headers.home") })} />
      <Stack.Screen name="Patient" component={PatientScreen} options={() => ({ title: translate("headers.patient") })} />
      <Stack.Screen name="Schedule" component={SchedulesScreen} options={() => ({ title: translate("headers.schedule") })} />
      <Stack.Screen name="Conversations" component={ConversationsScreen} options={() => ({ title: translate("headers.conversations") })} />
      <Stack.Screen name="Call" component={CallScreen} options={() => ({ title: translate("headers.call") })} />
      <Stack.Screen name="SentimentAnalysis" component={SentimentAnalysisScreen} options={() => ({ title: translate("headers.sentimentAnalysis") })} />
      <Stack.Screen name="MedicalAnalysis" component={MedicalAnalysisScreen} options={() => ({ title: translate("headers.medicalAnalysis") })} />
      <Stack.Screen name="Profile" component={ProfileScreen} options={() => ({ title: translate("headers.profile") })} />
      <Stack.Screen name="Privacy" component={PrivacyScreen} options={() => ({ title: translate("headers.privacyPolicy") })} />
      <Stack.Screen name="Terms" component={TermsScreen} options={() => ({ title: translate("headers.termsOfService") })} />
      <Stack.Screen name="Logout" component={LogoutScreen} options={() => ({ title: translate("headers.logout") })} />
    </Stack.Navigator>
  )
}


function AlertStack() {
  const { currentLanguage } = useLanguage() // This will trigger re-render when language changes
  
  return (
    <Stack.Navigator
      screenOptions={({ route, navigation }) => ({
        headerShown: true,
        header: (props) => <CustomHeader {...props} />,
      })}
    >
      <Stack.Screen name="Alert" component={AlertScreen} options={() => ({ title: translate("headers.alerts") })} />
    </Stack.Navigator>
  )
}

function OrgStack() {
  const { currentLanguage } = useLanguage() // This will trigger re-render when language changes
  
  return (
    <Stack.Navigator
      screenOptions={({ route, navigation }) => ({
        headerShown: true,
        header: (props) => <CustomHeader {...props} />,
      })}
    >
      <Stack.Screen name="Organization" component={OrgScreen} options={() => ({ title: translate("headers.organization") })} />
      <Stack.Screen name="Caregivers" component={CaregiversScreen} options={() => ({ title: translate("headers.caregivers") })} />
      <Stack.Screen name="Caregiver" component={CaregiverScreen} options={() => ({ title: translate("headers.caregiver") })} />
      <Stack.Screen name="CaregiverInvited" options={() => ({ title: translate("headers.caregiverInvited") })}>
        {(props) => <CaregiverInvitedScreen {...(props as any)} />}
      </Stack.Screen>
      <Stack.Screen name="Payment" component={PaymentInfoScreen} options={() => ({ title: translate("headers.payments") })} />
    </Stack.Navigator>
  )
}

function ReportsStack() {
  const { currentLanguage } = useLanguage() // This will trigger re-render when language changes
  
  return (
    <Stack.Navigator
      screenOptions={({ route, navigation }) => ({
        headerShown: true,
        header: (props) => <CustomHeader {...props} />,
      })}
    >
      <Stack.Screen name="Reports" component={ReportsScreen} options={() => ({ title: translate("headers.reports") })} />
      <Stack.Screen name="SentimentReport" component={SentimentAnalysisScreen} options={() => ({ title: translate("headers.sentimentAnalysis") })} />
      <Stack.Screen name="MedicalAnalysis" component={MedicalAnalysisScreen} options={() => ({ title: translate("headers.medicalAnalysis") })} />
      <Stack.Screen name="HealthReport" component={HealthReportScreen} options={() => ({ title: translate("headers.mentalHealthReport") })} />
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
        tabBarActiveTintColor: colors.palette.primary500,
        tabBarInactiveTintColor: colors.palette.neutral500,
        tabBarShowLabel: true, // Show labels
        tabBarIcon: ({ focused, color, size }) => {
          let iconName

          if (route.name === "Home") {
            iconName = focused ? "home" : "home-outline"
          } else if (route.name === "Org") {
            iconName = focused ? "people" : "people-outline"
          } else if (route.name === "Reports") {
            iconName = focused ? "analytics" : "analytics-outline"
          } else if (route.name === "Alert") {
            iconName = focused ? "alert-circle" : "alert-circle-outline"
          }

          return <Ionicons name={iconName as any} size={size} color={color} />
        },
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeStack} 
        options={{ 
          tabBarLabel: translate("tabs.home"),
          tabBarTestID: "tab-home" 
        }} 
      />
      <Tab.Screen 
        name="Org" 
        component={OrgStack} 
        options={{ 
          tabBarLabel: translate("tabs.org"),
          tabBarTestID: "tab-org" 
        }} 
      />
      <Tab.Screen 
        name="Reports" 
        component={ReportsStack} 
        options={{ 
          tabBarLabel: translate("tabs.reports"),
          tabBarTestID: "tab-reports" 
        }} 
      />
      <Tab.Screen
        name="Alert"
        component={AlertStack}
        options={{
          tabBarLabel: translate("tabs.alerts"),
          tabBarBadge: unreadAlertCount > 0 ? unreadAlertCount : undefined,
          tabBarBadgeStyle: {
            maxWidth: 'auto', // Allows the badge to expand based on content
            minWidth: 20,     // Ensures a minimum width for single-digit numbers
            paddingHorizontal: 6, // Adds horizontal padding for better spacing
            justifyContent: 'center',
            alignItems: 'center',
          },
          tabBarTestID: "tab-alert",
        }}
      />
    </Tab.Navigator>
  )
}
