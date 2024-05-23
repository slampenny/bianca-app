import { NavigationContainerProps } from '@react-navigation/native';

// Define the parameter list for your app's navigation stack
export type AppStackParamList = {
  LoadingScreen: undefined;
  Login: undefined;
  MainTabsWithDrawer: undefined;
};

// MainTabsParamList.ts
export type MainTabsParamList = {
    HomeScreen: undefined;
    CaregiverScreen: undefined;
};

// DrawerParamList.ts
export type DrawerParamList = {
    Home: undefined;  // This points to the MainTabs
    Payment: undefined;
    Logout: undefined;
};

export type LoginStackParamList = {
    Login: undefined;
    Register: undefined;
    ForgotPassword: undefined;
  };
  

// Extend NavigationContainerProps with any additional props you might need
export interface NavigationProps extends Partial<NavigationContainerProps> {}

