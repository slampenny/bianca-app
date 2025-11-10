import React, { createContext, useContext, useState, useCallback, ReactNode } from "react"
import { Modal, View, StyleSheet, Pressable, KeyboardAvoidingView, Platform, Text } from "react-native"
import { LoginForm } from "../components/LoginForm"
import { useSelector } from "react-redux"
import { isAuthenticated } from "../store/authSlice"
import { setShowAuthModalCallback, notifyAuthSuccess, notifyAuthCancelled } from "../services/api/baseQueryWithAuth"
import { useTheme } from "../theme/ThemeContext"
import type { ThemeColors } from "../types"

interface AuthModalContextType {
  showAuthModal: () => void
  hideAuthModal: () => void
  isVisible: boolean
}

export const AuthModalContext = createContext<AuthModalContextType | undefined>(undefined)

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
  
  // Use refs to track previous state and prevent unwanted modal closures
  const wasAuthenticatedRef = React.useRef(isAuthenticatedUser)
  const modalWasExplicitlyOpenedRef = React.useRef(false)

  const showAuthModal = useCallback(() => {
    setIsVisible(true)
    modalWasExplicitlyOpenedRef.current = true
  }, [])

  const hideAuthModal = useCallback(() => {
    setIsVisible(false)
    modalWasExplicitlyOpenedRef.current = false
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
  // Only close when user actually transitions from unauthenticated to authenticated
  React.useEffect(() => {
    const wasAuthenticated = wasAuthenticatedRef.current
    const isNowAuthenticated = isAuthenticatedUser
    
    // Only close modal if:
    // 1. Modal is visible
    // 2. Modal was explicitly opened (not just a state re-evaluation)
    // 3. User was NOT authenticated before
    // 4. User IS authenticated now (successful login)
    if (isVisible && modalWasExplicitlyOpenedRef.current && !wasAuthenticated && isNowAuthenticated) {
      // User logged in successfully - close modal and retry pending requests
      setIsVisible(false)
      modalWasExplicitlyOpenedRef.current = false
      
      // Force a small delay to ensure state is fully updated
      setTimeout(() => {
        notifyAuthSuccess()
      }, 50)
    }
    
    // Update ref for next render
    wasAuthenticatedRef.current = isAuthenticatedUser
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

const createStyles = (colors: ThemeColors) =>
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

