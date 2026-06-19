import React from "react"
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"
import { createStackNavigator } from "@react-navigation/stack"
import { Ionicons } from "@expo/vector-icons"
import { View } from "react-native"
import { useTheme } from "app/theme/ThemeContext"
import {
  HomeScreen,
  ClientScreen,
  ClientOnboardingScreen,
  SchedulesScreen,
  ConversationsScreen,
  CallScreen,
  AlertScreen,
  ProfileScreen,
  LogoutScreen,
  PrivacyScreen,
  TermsScreen,
  PrivacyRequestScreen,
  ReportsScreen,
  HealthReportScreen,
  SentimentAnalysisScreen,
  MedicalAnalysisScreen,
  FraudAbuseAnalysisScreen,
  MFASetupScreen,
  SettingsScreen,
} from "app/screens"
import { DrawerParamList, SettingsStackParamList } from "./navigationTypes"
import ProfileButton from "app/components/ProfileButton"
import { useSelector } from "react-redux"
import { selectUnreadAlertCount } from "app/store/alertSlice"
import { Header } from "app/components/Header"
import { Icon } from "app/components/Icon"
import { translate } from "../i18n"
import { useLanguage } from "../hooks/useLanguage"

const Stack = createStackNavigator()
const Tab = createBottomTabNavigator<DrawerParamList>()
const SettingsStack = createStackNavigator<SettingsStackParamList>()

function CustomHeader({ route, navigation, options }: any) {
  const { colors } = useTheme()

  const backButtonColor =
    (colors.palette as any).biancaHeader || colors.text || colors.tint || colors.palette.primary500

  const LeftActionComponent = navigation.canGoBack() ? (
    <Icon icon="caretLeft" size={24} color={backButtonColor} onPress={navigation.goBack} />
  ) : undefined

  return (
    <Header
      title={options.title || route.name}
      titleStyle={{ color: colors.palette.biancaHeader, fontWeight: "700" }}
      LeftActionComponent={LeftActionComponent}
      RightActionComponent={<ProfileButton />}
      backgroundColor={colors.palette.neutral100}
    />
  )
}

function HomeStack() {
  useLanguage()

  return (
    <Stack.Navigator
      screenOptions={({ route, navigation }) => ({
        headerShown: true,
        header: (props) => <CustomHeader {...props} />,
      })}
    >
      <Stack.Screen name="HomeDetail" component={HomeScreen} options={() => ({ title: translate("headers.home") })} />
      <Stack.Screen name="Client" component={ClientScreen} options={() => ({ title: translate("headers.lovedOne") })} />
      <Stack.Screen
        name="ClientOnboarding"
        component={ClientOnboardingScreen}
        options={() => ({ title: translate("headers.gettingStarted") })}
      />
      <Stack.Screen name="Schedule" component={SchedulesScreen} options={() => ({ title: translate("headers.whenBiancaCalls") })} />
      <Stack.Screen name="Conversations" component={ConversationsScreen} options={() => ({ title: translate("headers.callHistory") })} />
      <Stack.Screen name="Call" component={CallScreen} options={() => ({ title: translate("headers.call") })} />
      <Stack.Screen name="SentimentAnalysis" component={SentimentAnalysisScreen} options={() => ({ title: translate("headers.wellnessDetails") })} />
      <Stack.Screen name="MedicalAnalysis" component={MedicalAnalysisScreen} options={() => ({ title: translate("headers.wellnessCheck") })} />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ headerShown: false }} />
      <Stack.Screen name="MFASetup" component={MFASetupScreen} options={() => ({ title: translate("mfa.setupTitle") || "Multi-Factor Authentication" })} />
      <Stack.Screen name="Privacy" component={PrivacyScreen} options={() => ({ title: translate("headers.privacyPolicy") })} />
      <Stack.Screen name="PrivacyRequest" component={PrivacyRequestScreen} options={() => ({ title: translate("headers.privacyRequest") || "Request My Data" })} />
      <Stack.Screen name="Terms" component={TermsScreen} options={() => ({ title: translate("headers.termsOfService") })} />
      <Stack.Screen name="Logout" component={LogoutScreen} options={() => ({ title: translate("headers.logout") })} />
    </Stack.Navigator>
  )
}

function AlertStack() {
  useLanguage()

  return (
    <Stack.Navigator
      screenOptions={({ route, navigation }) => ({
        headerShown: true,
        header: (props) => <CustomHeader {...props} />,
      })}
    >
      <Stack.Screen name="AlertList" component={AlertScreen} options={() => ({ title: translate("headers.alerts") })} />
    </Stack.Navigator>
  )
}

function SettingsStackNavigator() {
  useLanguage()

  return (
    <SettingsStack.Navigator
      screenOptions={({ route, navigation }) => ({
        headerShown: true,
        header: (props) => <CustomHeader {...props} />,
      })}
    >
      <SettingsStack.Screen name="SettingsHome" component={SettingsScreen} options={() => ({ title: translate("headers.settings") })} />
      <SettingsStack.Screen name="Profile" component={ProfileScreen} options={{ headerShown: false }} />
      <SettingsStack.Screen name="Privacy" component={PrivacyScreen} options={() => ({ title: translate("headers.privacyPolicy") })} />
      <SettingsStack.Screen name="Terms" component={TermsScreen} options={() => ({ title: translate("headers.termsOfService") })} />
      <SettingsStack.Screen name="PrivacyRequest" component={PrivacyRequestScreen} options={() => ({ title: translate("headers.privacyRequest") })} />
      <SettingsStack.Screen name="Logout" component={LogoutScreen} options={() => ({ title: translate("headers.logout") })} />
      <SettingsStack.Screen name="MFASetup" component={MFASetupScreen} options={() => ({ title: translate("mfa.setupTitle") || "Multi-Factor Authentication" })} />
    </SettingsStack.Navigator>
  )
}

function InsightsStack() {
  useLanguage()

  return (
    <Stack.Navigator
      initialRouteName="ReportsList"
      screenOptions={({ route, navigation }) => ({
        headerShown: true,
        header: (props) => <CustomHeader {...props} />,
      })}
    >
      <Stack.Screen name="ReportsList" component={ReportsScreen} options={() => ({ title: translate("headers.insights") })} />
      <Stack.Screen name="SentimentReport" component={SentimentAnalysisScreen} options={() => ({ title: translate("headers.wellnessDetails") })} />
      <Stack.Screen name="MedicalAnalysis" component={MedicalAnalysisScreen} options={() => ({ title: translate("headers.wellnessCheck") })} />
      <Stack.Screen name="FraudAbuseAnalysis" component={FraudAbuseAnalysisScreen} options={() => ({ title: translate("headers.safetyConcerns") })} />
      <Stack.Screen name="HealthReport" component={HealthReportScreen} options={() => ({ title: translate("headers.mentalHealthReport") })} />
    </Stack.Navigator>
  )
}

export default function MainTabNavigator() {
  const unreadAlertCount = useSelector(selectUnreadAlertCount)
  const { colors, fontScale } = useTheme()
  useLanguage()

  const initialTab = "Home"

  return (
    <Tab.Navigator
      initialRouteName={initialTab}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.palette.primary500,
        tabBarInactiveTintColor: colors.palette.neutral500,
        tabBarStyle: {
          backgroundColor: colors.palette.neutral100,
          borderTopColor: colors.palette.neutral300,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontSize: 12 * fontScale,
          fontWeight: "500",
        },
        tabBarShowLabel: true,
        tabBarIcon: ({ focused, color, size }) => {
          if (route.name === "Home") {
            return (
              <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name={focused ? "heart" : "heart-outline"} size={size} color={color} />
                <Ionicons
                  name="call"
                  size={Math.max(9, Math.floor(size * 0.42))}
                  color="#14b8a6"
                  style={{ position: "absolute" }}
                />
              </View>
            )
          }

          let iconName: keyof typeof Ionicons.glyphMap = "ellipse-outline"
          if (route.name === "Insights") iconName = focused ? "sparkles" : "sparkles-outline"
          else if (route.name === "Alert") iconName = focused ? "alert-circle" : "alert-circle-outline"
          else if (route.name === "Settings") iconName = focused ? "settings" : "settings-outline"

          return <Ionicons name={iconName} size={size} color={color} />
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeStack}
        options={() => ({
          tabBarLabel: translate("tabs.home"),
          tabBarTestID: "tab-home",
          tabBarAccessibilityLabel: "Home tab",
        })}
      />
      <Tab.Screen
        name="Insights"
        component={InsightsStack}
        options={() => ({
          tabBarLabel: translate("tabs.insights"),
          tabBarTestID: "tab-insights",
          tabBarAccessibilityLabel: "Insights tab",
        })}
      />
      <Tab.Screen
        name="Alert"
        component={AlertStack}
        options={() => ({
          tabBarLabel: translate("tabs.alerts"),
          tabBarBadge: unreadAlertCount > 0 ? unreadAlertCount : undefined,
          tabBarBadgeStyle: {
            maxWidth: "auto",
            minWidth: 20,
            paddingHorizontal: 6,
            justifyContent: "center",
            alignItems: "center",
          },
          tabBarTestID: "tab-alert",
          tabBarAccessibilityLabel: "Alerts tab",
        })}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsStackNavigator}
        options={() => ({
          tabBarLabel: translate("tabs.settings"),
          tabBarTestID: "tab-settings",
          tabBarAccessibilityLabel: "Settings tab",
        })}
      />
    </Tab.Navigator>
  )
}
