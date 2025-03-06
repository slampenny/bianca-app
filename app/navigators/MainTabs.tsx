import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { 
  HomeScreen, 
  PatientScreen, 
  SchedulesScreen, 
  ConversationsScreen, 
  CaregiverScreen, 
  CaregiversScreen,
  AlertScreen, 
  OrgScreen, 
  PaymentInfoScreen, 
  LogoutScreen 
} from 'app/screens';
import { DrawerParamList } from './navigationTypes';
import ProfileButton from 'app/components/ProfileButton';
import { useSelector } from 'react-redux';
import { getCurrentUser } from 'app/store/authSlice';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator<DrawerParamList>();

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
    </Stack.Navigator>
  );
}

function ProfileStack() {
  const currentUser = useSelector(getCurrentUser);
  return (
    <Stack.Navigator
      screenOptions={{
        headerRight: () =>
          currentUser?.avatar ? (
            <Avatar
              source={{ uri: currentUser.avatar }}
              style={{ marginRight: 15, width: 40, height: 40, borderRadius: 20 }}
            />
          ) : null,
      }}
    >
      <Stack.Screen name="Profile" component={CaregiverScreen} />
    </Stack.Navigator>
  );
}

function AlertStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Alert" component={AlertScreen} />
    </Stack.Navigator>
  );
}

function OrgStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Org" component={OrgScreen} />
      <Stack.Screen name="Caregivers" component={CaregiversScreen} />
      <Stack.Screen name="Caregiver" component={CaregiverScreen} />
    </Stack.Navigator>
  );
}

function PaymentStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Payment" component={PaymentInfoScreen} />
    </Stack.Navigator>
  );
}

function LogoutStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Logout" component={LogoutScreen} />
    </Stack.Navigator>
  );
}

export default function MainTabNavigator() {
  return (
    <Tab.Navigator initialRouteName="Home" screenOptions={{
      headerShown: false, // Each stack handles its own header
      tabBarActiveTintColor: "#3498db",
      tabBarInactiveTintColor: "#7f8c8d",
    }}>
      <Tab.Screen name="Home" component={HomeStack} />
      <Tab.Screen name="Org" component={OrgStack} />
      <Tab.Screen name="Payment" component={PaymentStack} />
      <Tab.Screen name="Alert" component={AlertStack} />
    </Tab.Navigator>
  );
}
