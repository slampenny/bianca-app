import React, { createContext, useContext, useState, useCallback, ReactNode } from "react"
import { Modal, View, StyleSheet, Pressable, KeyboardAvoidingView, Platform, Text } from "react-native"
import { LoginForm } from "../components/LoginForm"
import { useSelector } from "react-redux"
import { isAuthenticated } from "../store/authSlice"
import { setShowAuthModalCallback, notifyAuthSuccess, notifyAuthCancelled } from "../services/api/baseQueryWithAuth"
import { useTheme } from "../theme/ThemeContext"

interface AuthModalContextType {
  showAuthModal: () => void
  hideAuthModal: () => void
  isVisible: boolean
}

const AuthModalContext = createContext<AuthModalContextType | undefined>(undefined)

export const useAuthModal = () => {
  const context = useContext(AuthModalContext)
  if (!context) {
    throw new Error("useAuthModal must be used within AuthModalProvider")
  }
  return context
}

interface AuthModalProviderProps {
  children: ReactNode
}

export const AuthModalProvider: React.FC<AuthModalProviderProps> = ({ children }) => {
  const [isVisible, setIsVisible] = useState(false)
  const isAuthenticatedUser = useSelector(isAuthenticated)
  const { colors } = useTheme()

  const showAuthModal = useCallback(() => {
    setIsVisible(true)
  }, [])

  const hideAuthModal = useCallback(() => {
    setIsVisible(false)
    notifyAuthCancelled()
  }, [])

  // Set up the callback so baseQuery can trigger the modal
  React.useEffect(() => {
    setShowAuthModalCallback(showAuthModal)
    return () => {
      setShowAuthModalCallback(null)
    }
  }, [showAuthModal])

  // Watch for authentication success - close modal and retry requests
  React.useEffect(() => {
    if (isVisible && isAuthenticatedUser) {
      // User logged in successfully - close modal and retry pending requests
      setIsVisible(false)
      
      // Force a small delay to ensure state is fully updated
      setTimeout(() => {
        notifyAuthSuccess()
      }, 50)
    }
  }, [isVisible, isAuthenticatedUser])

  const handleLoginSuccess = useCallback(() => {
    // This will be called by LoginForm when login succeeds
    // The effect above will handle closing the modal
  }, [])

  const styles = createStyles(colors)

  return (
    <AuthModalContext.Provider value={{ showAuthModal, hideAuthModal, isVisible }}>
      {children}
      <Modal
        visible={isVisible}
        transparent
        animationType="fade"
        onRequestClose={hideAuthModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalContainer}
        >
          <Pressable style={styles.overlay} onPress={hideAuthModal}>
            <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Please Sign In</Text>
                <Pressable onPress={hideAuthModal} style={styles.closeButton}>
                  <Text style={styles.closeButtonText}>✕</Text>
                </Pressable>
              </View>
              <View style={styles.loginContainer}>
                <LoginForm
                  onLoginSuccess={handleLoginSuccess}
                  showRegisterButton={false}
                  showForgotPasswordButton={false}
                  showSSOButtons={true}
                  compact={true}
                />
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </AuthModalContext.Provider>
  )
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    modalContainer: {
      flex: 1,
    },
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.7)",
      justifyContent: "center",
      alignItems: "center",
    },
    modalContent: {
      width: "90%",
      maxWidth: 500,
      backgroundColor: colors.palette.neutral100,
      borderRadius: 12,
      maxHeight: "90%",
      overflow: "hidden",
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.palette.neutral300 || "#e5e5e5",
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: "600",
      color: colors.palette.biancaHeader || colors.text,
    },
    closeButton: {
      padding: 5,
    },
    closeButtonText: {
      fontSize: 24,
      color: colors.palette.neutral600 || "#666",
      lineHeight: 24,
    },
    loginContainer: {
      flex: 1,
      paddingHorizontal: 20,
      paddingBottom: 20,
    },
  })

