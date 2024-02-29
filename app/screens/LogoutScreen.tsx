import React, { useEffect, FC } from "react";
import { View, StyleSheet, TouchableOpacity, Text } from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { useLogoutMutation } from "../services/api/authApi";
import { getAuthTokens } from "../store/authSlice";
import { useNavigation, NavigationProp } from '@react-navigation/native';

import { NativeStackScreenProps } from "@react-navigation/native-stack"

// Define the type for the navigation stack parameters
type LogoutStackParamList = {
  Logout: undefined; // No parameters expected for the Logout route
  Login: undefined; // No parameters expected for the Login route
  // ... other routes in the stack
};

// Define the type for the Logout screen's props
type LogoutScreenProps = NativeStackScreenProps<LogoutStackParamList, 'Logout'>;

export const LogoutScreen = () => {
  const navigation = useNavigation<LogoutScreenProps['navigation']>();
  const dispatch = useDispatch();
  const [logout] = useLogoutMutation();

  const tokens = useSelector(getAuthTokens);

  useEffect(() => {
    if (tokens) {
      logout(tokens).unwrap();
    }
  }, [logout, tokens]);

  const handleLogoutPress = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>You have been logged out</Text>
      <TouchableOpacity style={styles.button} onPress={handleLogoutPress}>
        <Text style={styles.buttonText}>GO TO LOGIN</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#3498db',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    marginTop: 10,
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 18,
  },
});