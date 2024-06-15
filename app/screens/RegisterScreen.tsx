import React, { useState, useLayoutEffect } from 'react';
import { Text, StyleSheet, View } from 'react-native';
import { StackScreenProps } from '@react-navigation/stack';
import { useRegisterMutation } from '../services/api/authApi'; // Adjust the path as necessary
import { Button, Header, Screen, TextField } from 'app/components';
import { LoginStackParamList } from 'app/navigators/navigationTypes';

export const RegisterScreen = (props: StackScreenProps<LoginStackParamList, 'Register'>) => {
  const { navigation } = props

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      header: () => <Header titleTx='registerScreen.title' />,
    })
  }, [])

  const [register, { isLoading }] = useRegisterMutation();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [accountType, setAccountType] = useState('individual'); // 'individual' or 'organization'
  const [organizationName, setOrganizationName] = useState('');

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password: string) => {
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/; // Minimum eight characters, at least one letter and one number
    return passwordRegex.test(password);
  };

  const validatePhone = (phone: string) => {
    const phoneRegex = /^\d{10,}$/; // Validates that the phone number has at least 10 digits
    return phoneRegex.test(phone);
  };

  const handleRegister = async () => {
    if (name.trim() === '') {
      setErrorMessage('Name cannot be empty');
      return;
    }
    if (!validateEmail(email)) {
      setErrorMessage('Please enter a valid email address');
      return;
    }
    if (!validatePassword(password)) {
      setErrorMessage('Password must contain at least one letter and one number');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match');
      return;
    }
    if (!validatePhone(phone)) {
      setErrorMessage('Phone number must contain at least 10 digits');
      return;
    }
    setErrorMessage('');

    if (accountType === 'organization' && organizationName.trim() === '') {
      setErrorMessage('Organization name cannot be empty');
      return;
    }

    try {
      await register({ name, email, password, phone }).unwrap();
      setErrorMessage('Registration successful!');
    } catch (err) {
      setErrorMessage('Registration Failed');
    }
  };

  return (
    <Screen 
      preset="scroll"
      style={styles.container}
      contentContainerStyle={{justifyContent: 'center', alignItems: 'center'}}
    >
      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
      <View style={styles.buttonContainer}>
        <Button
          tx="registerScreen.individualButton"
          onPress={() => setAccountType('individual')} 
          style={accountType === 'individual' ? styles.selectedButton : styles.button}
        />
        <Button
          tx="registerScreen.organizationButton"
          onPress={() => setAccountType('organization')} 
          style={accountType === 'organization' ? styles.selectedButton : styles.button}
        />
      </View>
      <Text style={styles.explanationText}>
        {accountType === 'individual' 
          ? 'Register as an individual if you are signing up for personal use.' 
          : 'Register as an organization if you are signing up on behalf of a company or group.'}
      </Text>
      <View style={styles.formContainer}>
        <TextField
          placeholderTx="registerScreen.nameFieldPlaceholder"
          labelTx='registerScreen.nameFieldLabel'
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />
      <TextField
        placeholderTx="registerScreen.emailFieldPlaceholder"
        labelTx='registerScreen.emailFieldLabel'
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextField
        placeholderTx="registerScreen.passwordFieldPlaceholder"
        labelTx='registerScreen.passwordFieldLabel'
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <TextField
        placeholderTx="registerScreen.confirmPasswordFieldPlaceholder"
        labelTx='registerScreen.confirmPasswordFieldLabel'
        secureTextEntry
        value={confirmPassword}
        onChangeText={setConfirmPassword}
      />
      <TextField
        placeholderTx="registerScreen.phoneFieldPlaceholder"
        labelTx='registerScreen.phoneFieldLabel'
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
      />
      {accountType === 'organization' ? (
        <TextField
          placeholderTx="registerScreen.organizationNameFieldPlaceholder"
          labelTx='registerScreen.organizationNameFieldLabel'
          value={organizationName}
          onChangeText={setOrganizationName}
        />
      ) : null}
      <Button
          onPress={handleRegister}
          disabled={isLoading}
          tx="registerScreen.title"
          style={styles.submitButton}
        />
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    padding: 20,
  },
  formContainer: {
    width: '100%',
    paddingHorizontal: 20,
  },
  input: {
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    padding: 10,
    backgroundColor: '#fff',
  },
  submitButton: {
    backgroundColor: 'blue',
    color: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  button: {
    flex: 1,
    margin: 10,
    backgroundColor: 'lightgray',
    borderRadius: 4,
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedButton: {
    flex: 1,
    margin: 10,
    backgroundColor: 'blue',
    borderRadius: 4,
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  explanationText: {
    fontSize: 14,
    color: 'gray',
    marginBottom: 20,
  },
  errorText: {
    color: 'red',
    marginBottom: 10,
  },
});