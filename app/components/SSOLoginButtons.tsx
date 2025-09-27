import React, { useState } from 'react';
import { View, StyleSheet, Pressable, Text, Alert, ActivityIndicator } from 'react-native';
import { colors } from 'app/theme/colors';
import { ssoService, SSOUser, SSOError } from '../services/ssoService';

interface SSOLoginButtonsProps {
  onSSOSuccess: (user: SSOUser) => void;
  onSSOError?: (error: SSOError) => void;
  disabled?: boolean;
  showGenericSSO?: boolean;
}

export const SSOLoginButtons: React.FC<SSOLoginButtonsProps> = ({
  onSSOSuccess,
  onSSOError,
  disabled = false,
  showGenericSSO = false,
}) => {
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isMicrosoftLoading, setIsMicrosoftLoading] = useState(false);
  const [isGenericSSOLoading, setIsGenericSSOLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    if (disabled || isGoogleLoading) return;
    
    setIsGoogleLoading(true);
    try {
      const result = await ssoService.signInWithGoogle();
      
      if ('error' in result) {
        onSSOError?.(result);
        // Show different alerts based on error type
        if (result.error.includes('not configured')) {
          Alert.alert('SSO Not Available', result.description || result.error);
        } else {
          Alert.alert('Sign In Failed', result.description || result.error);
        }
      } else {
        onSSOSuccess(result);
      }
    } catch (error) {
      const errorResult: SSOError = {
        error: 'Google sign-in failed',
        description: error instanceof Error ? error.message : 'Unknown error',
      };
      onSSOError?.(errorResult);
      Alert.alert('Sign In Failed', errorResult.description);
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleMicrosoftSignIn = async () => {
    if (disabled || isMicrosoftLoading) return;
    
    setIsMicrosoftLoading(true);
    try {
      const result = await ssoService.signInWithMicrosoft();
      
      if ('error' in result) {
        onSSOError?.(result);
        // Show different alerts based on error type
        if (result.error.includes('not configured')) {
          Alert.alert('SSO Not Available', result.description || result.error);
        } else {
          Alert.alert('Sign In Failed', result.description || result.error);
        }
      } else {
        onSSOSuccess(result);
      }
    } catch (error) {
      const errorResult: SSOError = {
        error: 'Microsoft sign-in failed',
        description: error instanceof Error ? error.message : 'Unknown error',
      };
      onSSOError?.(errorResult);
      Alert.alert('Sign In Failed', errorResult.description);
    } finally {
      setIsMicrosoftLoading(false);
    }
  };

  const handleGenericSSO = async () => {
    if (disabled || isGenericSSOLoading) return;
    
    setIsGenericSSOLoading(true);
    try {
      // For now, show an alert that this would redirect to company SSO
      Alert.alert(
        'Company SSO',
        'This would redirect to your company\'s SSO provider. Please contact your administrator for setup.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      const errorResult: SSOError = {
        error: 'Generic SSO failed',
        description: error instanceof Error ? error.message : 'Unknown error',
      };
      onSSOError?.(errorResult);
    } finally {
      setIsGenericSSOLoading(false);
    }
  };

  const isLoading = isGoogleLoading || isMicrosoftLoading || isGenericSSOLoading;

  return (
    <View style={styles.container}>
      <Text style={styles.dividerText}>Or continue with</Text>
      
      <View style={styles.buttonContainer}>
        {/* Google Sign In Button */}
        <Pressable
          style={[styles.ssoButton, styles.googleButton, disabled && styles.disabledButton]}
          onPress={handleGoogleSignIn}
          disabled={disabled || isLoading}
          testID="google-sso-button"
        >
          {isGoogleLoading ? (
            <ActivityIndicator color={colors.palette.neutral100} size="small" />
          ) : (
            <>
              <Text style={styles.googleIcon}>G</Text>
              <Text style={styles.ssoButtonText}>Google</Text>
            </>
          )}
        </Pressable>

        {/* Microsoft Sign In Button */}
        <Pressable
          style={[styles.ssoButton, styles.microsoftButton, disabled && styles.disabledButton]}
          onPress={handleMicrosoftSignIn}
          disabled={disabled || isLoading}
          testID="microsoft-sso-button"
        >
          {isMicrosoftLoading ? (
            <ActivityIndicator color={colors.palette.neutral100} size="small" />
          ) : (
            <>
              <Text style={styles.microsoftIcon}>M</Text>
              <Text style={styles.ssoButtonText}>Microsoft</Text>
            </>
          )}
        </Pressable>

        {/* Generic SSO Button */}
        {showGenericSSO && (
          <Pressable
            style={[styles.ssoButton, styles.genericSSOButton, disabled && styles.disabledButton]}
            onPress={handleGenericSSO}
            disabled={disabled || isLoading}
          >
            {isGenericSSOLoading ? (
              <ActivityIndicator color={colors.palette.neutral100} size="small" />
            ) : (
              <>
                <Text style={styles.genericSSOIcon}>🏢</Text>
                <Text style={styles.ssoButtonText}>Company SSO</Text>
              </>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 20,
  },
  dividerText: {
    textAlign: 'center',
    color: colors.palette.neutral600,
    fontSize: 14,
    marginBottom: 15,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  ssoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.palette.neutral300,
  },
  googleButton: {
    backgroundColor: '#ffffff',
    borderColor: '#dadce0',
  },
  microsoftButton: {
    backgroundColor: '#0078d4',
    borderColor: '#0078d4',
  },
  genericSSOButton: {
    backgroundColor: '#6B7280', // Gray for generic SSO
    borderColor: '#6B7280',
  },
  disabledButton: {
    opacity: 0.5,
  },
  ssoButtonText: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  googleIcon: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4285f4',
  },
  microsoftIcon: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.palette.neutral100,
  },
  genericSSOIcon: {
    fontSize: 18,
    color: colors.palette.neutral100,
  },
});
