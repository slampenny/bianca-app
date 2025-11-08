import React, { useState } from 'react';
import { View, StyleSheet, Pressable, Text, ActivityIndicator } from 'react-native';
import { useTheme } from 'app/theme/ThemeContext';
import { ssoService, SSOUser, SSOError } from '../services/ssoService';
import { translate } from '../i18n';
import { useToast } from '../hooks/useToast';
import Toast from './Toast';

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
  const { colors, themeInfo } = useTheme();
  const { toast, showError, showInfo, hideToast } = useToast();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isMicrosoftLoading, setIsMicrosoftLoading] = useState(false);
  const [isGenericSSOLoading, setIsGenericSSOLoading] = useState(false);
  
  const createStyles = (colors: any, isDarkMode: boolean) => StyleSheet.create({
    container: {
      marginVertical: 12, // Reduced from 20
    },
    dividerText: {
      textAlign: 'center',
      color: colors.palette.neutral600,
      fontSize: 13, // Reduced from 14
      marginBottom: 10, // Reduced from 15
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
      // Google brand guidelines: White background in light mode, darker background in dark mode
      // In dark mode, prioritize visibility - use much lighter gray background for clear contrast
      backgroundColor: isDarkMode 
        ? colors.palette.neutral700  // Lighter gray (#A3A3A3) in dark mode - MAXIMUM visibility!
        : colors.palette.neutral100, // White in light mode (per Google brand guidelines)
      borderColor: isDarkMode 
        ? colors.palette.neutral800  // Very visible light border in dark mode (#D4D4D4 - very light gray)
        : colors.palette.neutral400, // Standard border in light mode
      borderWidth: isDarkMode ? 2 : 1, // Thicker border in dark mode for maximum visibility
    },
    microsoftButton: {
      backgroundColor: '#0078d4', // Microsoft brand color - keep as-is
      borderColor: '#0078d4', // Microsoft brand color - keep as-is
    },
    genericSSOButton: {
      backgroundColor: colors.palette.neutral600, // Theme-aware instead of #6B7280
      borderColor: colors.palette.neutral600, // Theme-aware instead of #6B7280
    },
    disabledButton: {
      opacity: 0.5,
    },
    ssoButtonText: {
      fontSize: 16,
      fontWeight: '500',
      marginLeft: 8,
      // Google brand guidelines: Dark text on white (light mode), light text on dark (dark mode)
      color: colors.palette.biancaHeader, // Theme-aware: dark in light mode, light in dark mode
    },
    googleButtonText: {
      fontSize: 16,
      fontWeight: '500',
      marginLeft: 8,
      // Ensure high contrast: dark text on white (light mode), light text on dark gray (dark mode)
      color: isDarkMode 
        ? colors.palette.neutral900  // Very light text (#FAFAFA) in dark mode for maximum contrast
        : colors.palette.biancaHeader, // Dark text in light mode
    },
    microsoftButtonText: {
      fontSize: 16,
      fontWeight: '500',
      marginLeft: 8,
      color: '#FFFFFF', // Always white text on blue Microsoft background
    },
    googleIcon: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#4285f4', // Google brand blue - keep as-is
    },
    microsoftIcon: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#FFFFFF', // Always white icon on blue Microsoft background
    },
    genericSSOIcon: {
      fontSize: 18,
      color: colors.palette.neutral100,
    },
  });
  
  const isDarkMode = themeInfo.darkMode;
  const styles = createStyles(colors, isDarkMode);
  
  // Debug: Log to verify dark mode detection (remove after testing)
  if (__DEV__) {
    console.log('[SSO Buttons] Dark mode:', isDarkMode, 'Background color:', isDarkMode ? '#A3A3A3' : '#FFFFFF');
  }

  const handleGoogleSignIn = async () => {
    if (disabled || isGoogleLoading) return;
    
    setIsGoogleLoading(true);
    try {
      const result = await ssoService.signInWithGoogle();
      
      if ('error' in result) {
        onSSOError?.(result);
        // Show different toasts based on error type
        const message = result.description || result.error;
        if (result.error.includes('not configured')) {
          showError(`${translate("ssoButtons.ssoNotAvailable")}: ${message}`);
        } else {
          showError(`${translate("ssoButtons.signInFailed")}: ${message}`);
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
      showError(`${translate("ssoButtons.signInFailed")}: ${errorResult.description}`);
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
        // Show different toasts based on error type
        const message = result.description || result.error;
        if (result.error.includes('not configured')) {
          showError(`${translate("ssoButtons.ssoNotAvailable")}: ${message}`);
        } else {
          showError(`${translate("ssoButtons.signInFailed")}: ${message}`);
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
      showError(`${translate("ssoButtons.signInFailed")}: ${errorResult.description}`);
    } finally {
      setIsMicrosoftLoading(false);
    }
  };

  const handleGenericSSO = async () => {
    if (disabled || isGenericSSOLoading) return;
    
    setIsGenericSSOLoading(true);
    try {
      // For now, show an info toast that this would redirect to company SSO
      showInfo(translate("ssoButtons.companySSOMessage"));
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
      <Text style={styles.dividerText}>{translate("ssoButtons.orContinueWith")}</Text>
      
      <View style={styles.buttonContainer}>
        {/* Google Sign In Button */}
        <Pressable
          style={[
            // Completely independent styles - no base ssoButton to avoid conflicts
            {
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderRadius: 6,
              // Force Google button colors - these MUST override everything
              // Using very light gray in dark mode for maximum visibility
              backgroundColor: isDarkMode ? '#B0B0B0' : '#FFFFFF', // Even lighter gray (#B0B0B0) for dark mode
              borderColor: isDarkMode ? '#E0E0E0' : '#E5E5E5', // Very light border
              borderWidth: isDarkMode ? 2 : 1,
            },
            disabled && { opacity: 0.5 }
          ]}
          onPress={handleGoogleSignIn}
          disabled={disabled || isLoading}
          testID="google-sso-button"
        >
            {isGoogleLoading ? (
            <ActivityIndicator color={colors.palette.biancaHeader} size="small" />
          ) : (
            <>
              <Text style={styles.googleIcon}>G</Text>
              <Text style={{
                fontSize: 16,
                fontWeight: '500',
                marginLeft: 8,
                // Force dark text color for visibility on light gray background in dark mode
                color: isDarkMode ? '#171717' : '#171717' // Dark text (#171717) for maximum contrast
              }}>{translate("ssoButtons.google")}</Text>
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
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Text style={styles.microsoftIcon}>M</Text>
              <Text style={styles.microsoftButtonText}>{translate("ssoButtons.microsoft")}</Text>
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
                <Text style={styles.ssoButtonText}>{translate("ssoButtons.companySSO")}</Text>
              </>
            )}
          </Pressable>
        )}
      </View>
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={hideToast}
        testID="sso-toast"
      />
    </View>
  );
};
