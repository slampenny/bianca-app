import React, { useState, useRef, useEffect, FC } from "react";
import { TextInput, View, StyleSheet, Pressable, Text } from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { StackNavigationProp } from '@react-navigation/stack';
import { useLoginMutation, useLogoutMutation } from "../services/api/authApi";
import { setAuthEmail, setAuthTokens, getValidationError, getAuthEmail, getAuthTokens } from "../store/authSlice";
import { LoginStackParamList } from "app/navigators/navigationTypes";

type LoginScreenNavigationProp = StackNavigationProp<LoginStackParamList, 'Login'>;

interface LoginScreenProps {
  navigation: LoginScreenNavigationProp;
}

export const LoginScreen: FC<LoginScreenProps> = ({ navigation }) => {
  const dispatch = useDispatch();
  const [loginAPI] = useLoginMutation();
  const [logout] = useLogoutMutation();

  const authPasswordInput = useRef<TextInput>(null);
  const validationError = useSelector(getValidationError);
  const authEmail = useSelector(getAuthEmail);
  const tokens = useSelector(getAuthTokens);

  const [authPassword, setAuthPassword] = useState("password1");
  const [isAuthPasswordHidden, setIsAuthPasswordHidden] = useState(true);

  useEffect(() => {
    dispatch(setAuthEmail("negascout@gmail.com"));
    setAuthPassword("password1");
    return () => {
      setAuthPassword("");
      dispatch(setAuthEmail(""));
      if (tokens) {
        logout({refreshToken: tokens.refresh.token}).unwrap();
      }
    };
  }, [dispatch, logout, tokens]);

  const handleLoginPress = async () => {
    if (validationError) return;
    try {
      const result = await loginAPI({ email: authEmail, password: authPassword }).unwrap();
      dispatch(setAuthTokens(result.tokens));
    } catch (error) {
      console.error(error);
    }
  };

  const handleRegisterPress = () => {
    // Navigate to the Register screen
    navigation.navigate('Register');
  };

  const handleForgotPasswordPress = () => {
    // Navigate to the Forgot Password screen
    navigation.navigate('RequestReset');
  };

  // When you want to focus the password input after submitting the email
  const focusPasswordInput = () => {
    if (authPasswordInput.current) {
      authPasswordInput.current.focus();
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign In</Text>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={authEmail}
          onChangeText={(value) => dispatch(setAuthEmail(value))}
          placeholder="Email"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="next"
          onSubmitEditing={focusPasswordInput}
        />
        <TextInput
          ref={authPasswordInput}
          style={styles.input}
          value={authPassword}
          onChangeText={setAuthPassword}
          placeholder="Password"
          secureTextEntry={isAuthPasswordHidden}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={handleLoginPress}
        />
      </View>
      <Pressable style={styles.button} onPress={handleLoginPress}>
        <Text style={styles.buttonText}>LOGIN</Text>
      </Pressable>
      <Pressable style={styles.button} onPress={handleRegisterPress}>
        <Text style={styles.buttonText}>REGISTER</Text>
      </Pressable>
      <Pressable style={styles.linkButton} onPress={handleForgotPasswordPress}>
        <Text style={styles.linkButtonText}>Forgot Password?</Text>
      </Pressable>
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
  inputContainer: {
    width: '100%',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  input: {
    backgroundColor: 'white',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#dedede',
    marginBottom: 10,
  },
  button: {
    backgroundColor: '#3498db',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    marginTop: 10,
    marginBottom: 10,
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 18,
  },
  linkButton: {
    marginTop: 10,
  },
  linkButtonText: {
    color: '#3498db',
    textAlign: 'center',
    fontSize: 16,
  },
});