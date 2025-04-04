import React, { useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Pressable, 
  ScrollView, 
  KeyboardAvoidingView, 
  Platform 
} from 'react-native';
import { StackScreenProps } from '@react-navigation/stack';
import { LoginStackParamList } from 'app/navigators/navigationTypes';
import { Text, TextField, Button } from 'app/components';
import { useForgotPasswordMutation } from '../services/api/authApi';

export const RequestResetScreen = (props: StackScreenProps<LoginStackParamList, 'Register'>) => {
  const { navigation } = props;
  const [requestReset, { isLoading }] = useForgotPasswordMutation();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const validateEmail = (text: string) => {
    setEmail(text);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(text)) {
      setEmailError('Please enter a valid email address');
    } else {
      setEmailError('');
    }
  };

  const handleRequestReset = async () => {
    if (emailError || !email) {
      return;
    }

    try {
      await requestReset({ email }).unwrap();
      setSuccessMessage('Reset code sent to your email!');
    } catch (err) {
      setEmailError('Request failed. Please check your email and try again.');
    }
  };

  return (
    <div 
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#ecf0f1',
        overflowY: 'scroll',
        msOverflowStyle: 'scrollbar',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      <div style={{ padding: '20px' }}>
        <View style={styles.formContainer}>
          <Text style={styles.headerTitle} tx="requestResetScreen.title" />
          
          {successMessage ? (
            <Text style={styles.successText}>{successMessage}</Text>
          ) : null}
          
          <View style={styles.fieldContainer}>
            <TextField
              placeholderTx="requestResetScreen.emailFieldPlaceholder"
              labelTx="requestResetScreen.emailFieldLabel"
              value={email}
              onChangeText={validateEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {emailError ? <Text style={styles.fieldErrorText}>{emailError}</Text> : null}
          </View>
          
          <Button 
            onPress={handleRequestReset} 
            disabled={isLoading || !!emailError || !email} 
            tx="requestResetScreen.requestReset" 
            style={[
              styles.registerButton,
              (!email || !!emailError) && styles.buttonDisabled
            ]} 
          />
          
          <Pressable style={styles.linkButton} onPress={() => navigation.goBack()}>
            <Text style={styles.linkButtonText} tx="registerScreen.goBack" />
          </Pressable>
        </View>
      </div>
    </div>
  );
};

const styles = StyleSheet.create({
  formContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 6,
    marginTop: 40,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 20,
    textAlign: 'center',
  },
  fieldContainer: {
    marginBottom: 10,
  },
  fieldErrorText: {
    color: 'red',
    fontSize: 12,
    marginTop: 2,
    marginBottom: 8,
    textAlign: 'center',
  },
  successText: {
    color: 'green',
    marginBottom: 20,
    textAlign: 'center',
    padding: 10,
    backgroundColor: 'rgba(0,255,0,0.05)',
    borderRadius: 4,
  },
  registerButton: {
    width: '100%',
    backgroundColor: '#3498db',
    borderRadius: 4,
    paddingVertical: 12,
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  linkButton: {
    marginTop: 15,
    marginBottom: 10,
  },
  linkButtonText: {
    color: '#3498db',
    fontSize: 16,
    textAlign: 'center',
  },
});