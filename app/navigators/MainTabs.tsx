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
} from "app/screens"
import { DrawerParamList } from "./navigationTypes"
import ProfileButton from "app/components/ProfileButton"
import { useSelector } from "react-redux"
import { getOrg } from "app/store/orgSlice"
import { selectUnreadAlertCount } from "app/store/alertSlice"
import { Header } from "app/components/Header"
import { Icon } from "app/components/Icon"

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
  return (
    <Stack.Navigator
      screenOptions={({ route, navigation }) => ({
        headerShown: true,
        header: (props) => <CustomHeader {...props} />,
      })}
    >
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Patient" component={PatientScreen} />
      <Stack.Screen name="Schedule" component={SchedulesScreen} />
      <Stack.Screen name="Conversations" component={ConversationsScreen} />
      <Stack.Screen name="Call" component={CallScreen} />
      <Stack.Screen name="SentimentAnalysis" component={SentimentAnalysisScreen} options={{ title: "Sentiment Analysis" }} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Privacy" component={PrivacyScreen} options={{ title: "Privacy Policy" }} />
      <Stack.Screen name="Terms" component={TermsScreen} options={{ title: "Terms of Service" }} />
      <Stack.Screen name="Logout" component={LogoutScreen} />
    </Stack.Navigator>
  )
}


function AlertStack() {
  return (
    <Stack.Navigator
      screenOptions={({ route, navigation }) => ({
        headerShown: true,
        header: (props) => <CustomHeader {...props} />,
      })}
    >
      <Stack.Screen name="Alert" component={AlertScreen} />
    </Stack.Navigator>
  )
}

function OrgStack() {
  return (
    <Stack.Navigator
      screenOptions={({ route, navigation }) => ({
        headerShown: true,
        header: (props) => <CustomHeader {...props} />,
      })}
    >
      <Stack.Screen name="Org" component={OrgScreen} />
      <Stack.Screen name="Caregivers" component={CaregiversScreen} />
      <Stack.Screen name="Caregiver" component={CaregiverScreen} />
      <Stack.Screen name="CaregiverInvited">
        {(props) => <CaregiverInvitedScreen {...(props as any)} />}
      </Stack.Screen>
      <Stack.Screen name="Payment" component={PaymentInfoScreen} />
    </Stack.Navigator>
  )
}

function ReportsStack() {
  return (
    <Stack.Navigator
      screenOptions={({ route, navigation }) => ({
        headerShown: true,
        header: (props) => <CustomHeader {...props} />,
      })}
    >
      <Stack.Screen name="Reports" component={ReportsScreen} />
      <Stack.Screen name="SentimentReport" component={SentimentAnalysisScreen} options={{ title: "Sentiment Analysis" }} />
      <Stack.Screen name="HealthReport" component={HealthReportScreen} options={{ title: "Mental Health Report" }} />
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
        name="Reports" 
        component={ReportsStack} 
        options={{ 
          tabBarLabel: "Reports",
          tabBarTestID: "tab-reports" 
        }} 
      />
      <Tab.Screen
        name="Alert"
        component={AlertStack}
        options={{
          tabBarLabel: "Alerts",
          tabBarBadge: unreadAlertCount > 0 ? unreadAlertCount : undefined,
          tabBarTestID: "tab-alert",
        }}
      />
    </Tab.Navigator>
  )
}
