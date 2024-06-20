import { NavigationContainerProps } from '@react-navigation/native';

export type AppStackParamList = {
  LoadingScreen: undefined;
  Login: undefined;
  MainTabsWithDrawer: undefined;
};

export type MainTabsParamList = {
  HomeTab: undefined;
  Caregiver: undefined;
  Alert: undefined;
};

export type DrawerParamList = {
  Home: undefined;  // This points to the MainTabs
  Org: undefined;
  Payment: undefined;
  Logout: undefined;
};

export type LoginStackParamList = {
  Login: undefined;
  Register: undefined;
  RequestReset: undefined;
  ConfirmReset: undefined;
};

export type HomeStackParamList = {
  Home: undefined;
  Patient: undefined;
  Schedule: undefined;
};

export interface NavigationProps extends Partial<NavigationContainerProps> {}
