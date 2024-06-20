import React, { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { StackScreenProps } from '@react-navigation/stack';
import { LoginStackParamList } from 'app/navigators/navigationTypes';
import { Screen, Text, TextField } from 'app/components'; // Import the Text component from the component library
import { useForgotPasswordMutation } from '../services/api/authApi'; // Adjust the path as necessary

export const RequestResetScreen = (props: StackScreenProps<LoginStackParamList, 'Register'>) => {
  const { navigation } = props;

  const [requestReset, { isLoading }] = useForgotPasswordMutation();

  const [email, setEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleRequestReset = async () => {
    if (!validateEmail(email)) {
      setErrorMessage('Please enter a valid email address');
      return;
    }
    setErrorMessage('');

    try {
      await requestReset({email}).unwrap();
      setErrorMessage('Reset code sent to your email!');
    } catch (err) {
      setErrorMessage('Request failed');
    }
  };

  return (
    <Screen style={styles.container}>
      <Text style={styles.title} tx="requestResetScreen.title"/>
      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
      <TextField
        style={styles.input}
        labelTx='requestResetScreen.emailFieldLabel'
        placeholderTx="requestResetScreen.emailFieldPlaceholder"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <Pressable style={styles.button} onPress={handleRequestReset} disabled={isLoading}>
        <Text style={styles.buttonText} tx="requestResetScreen.requestReset"/>
      </Pressable>
      <Pressable style={styles.linkButton} onPress={() => navigation.goBack()}>
        <Text style={styles.linkButtonText} tx="registerScreen.goBack"/>
      </Pressable>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  linkButton: {
    marginTop: 10,
  },
  linkButtonText: {
    color: '#3498db',
    textAlign: 'center',
    fontSize: 16,
  },
  input: {
    height: 40,
    borderColor: 'gray',
    borderWidth: 1,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  button: {
    backgroundColor: '#007BFF',
    padding: 10,
    alignItems: 'center',
    borderRadius: 5,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
  },
  errorText: {
    color: 'red',
    marginBottom: 10,
  },
});