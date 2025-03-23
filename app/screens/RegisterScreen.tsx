import React, { useState, useEffect, useLayoutEffect } from 'react'
import { StyleSheet, View, Pressable, ScrollView } from 'react-native'
import { StackScreenProps } from '@react-navigation/stack'
import { useRegisterMutation } from '../services/api/authApi'
import { Button, Text, TextField } from 'app/components'
import { LoginStackParamList } from 'app/navigators/navigationTypes'

export const RegisterScreen = (props: StackScreenProps<LoginStackParamList, 'Register'>) => {
  const { navigation } = props

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      header: () => (
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Register</Text>
        </View>
      ),
    })
  }, [navigation])

  const [register, { isLoading }] = useRegisterMutation()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [accountType, setAccountType] = useState('individual')
  const [organizationName, setOrganizationName] = useState('')
  const [shouldRegister, setShouldRegister] = useState(false)

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const validatePassword = (password: string) =>
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/.test(password)
  const validatePhone = (phone: string) => /^\d{10,}$/.test(phone)

  const validateInputs = () => {
    if (name.trim() === '') return 'Name cannot be empty'
    if (!validateEmail(email)) return 'Please enter a valid email address'
    if (!validatePassword(password))
      return 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    if (password !== confirmPassword) return 'Passwords do not match'
    if (!validatePhone(phone)) return 'Phone number must contain at least 10 digits'
    if (accountType === 'organization' && organizationName.trim() === '')
      return 'Organization name cannot be empty'
    return ''
  }

  useEffect(() => {
    const registerUser = async () => {
      try {
        const result = await register({ name, email, password, phone }).unwrap()
        if (result) {
          setErrorMessage('Registration successful!')
        }
      } catch {
        setErrorMessage('Registration Failed')
      }
    }

    if (shouldRegister) {
      const error = validateInputs()
      if (error) {
        setErrorMessage(error)
        setShouldRegister(false)
      } else {
        registerUser().finally(() => setShouldRegister(false))
      }
    }
  }, [shouldRegister, name, email, password, phone, register])

  const handleRegister = () => {
    setShouldRegister(true)
  }

  return (
    <ScrollView
      contentContainerStyle={styles.contentContainer}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.formContainer}>
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
            ? 'Register as an individual for personal use.'
            : 'Register as an organization for company or group use.'}
        </Text>

        <TextField
          placeholderTx="registerScreen.nameFieldPlaceholder"
          labelTx="registerScreen.nameFieldLabel"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />
        <TextField
          placeholderTx="registerScreen.emailFieldPlaceholder"
          labelTx="registerScreen.emailFieldLabel"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextField
          placeholderTx="registerScreen.passwordFieldPlaceholder"
          labelTx="registerScreen.passwordFieldLabel"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <TextField
          placeholderTx="registerScreen.confirmPasswordFieldPlaceholder"
          labelTx="registerScreen.confirmPasswordFieldLabel"
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />
        <TextField
          placeholderTx="registerScreen.phoneFieldPlaceholder"
          labelTx="registerScreen.phoneFieldLabel"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
        {accountType === 'organization' && (
          <TextField
            placeholderTx="registerScreen.organizationNameFieldPlaceholder"
            labelTx="registerScreen.organizationNameFieldLabel"
            value={organizationName}
            onChangeText={setOrganizationName}
          />
        )}

        <Button onPress={handleRegister} disabled={isLoading} tx="registerScreen.title" />

        <Pressable style={styles.linkButton} onPress={() => navigation.goBack()}>
          <Text style={styles.linkButtonText} tx="registerScreen.goBack" />
        </Pressable>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  contentContainer: {
    flexGrow: 1,
    paddingVertical: 20,
    paddingHorizontal: 16,
    backgroundColor: '#ecf0f1',
  },
  formContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  header: {
    backgroundColor: '#fff',
    paddingVertical: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: '#ddd',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2c3e50',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  button: {
    flex: 1,
    marginHorizontal: 5,
    backgroundColor: 'lightgray',
    borderRadius: 4,
    paddingVertical: 10,
    alignItems: 'center',
  },
  selectedButton: {
    flex: 1,
    marginHorizontal: 5,
    backgroundColor: '#3498db',
    borderRadius: 4,
    paddingVertical: 10,
    alignItems: 'center',
  },
  explanationText: {
    fontSize: 14,
    color: 'gray',
    marginBottom: 20,
    textAlign: 'center',
  },
  errorText: {
    color: 'red',
    marginBottom: 10,
    textAlign: 'center',
  },
  linkButton: {
    marginTop: 15,
  },
  linkButtonText: {
    color: '#3498db',
    fontSize: 16,
    textAlign: 'center',
  },
})
