import React, { createContext, useContext, useState, useCallback, ReactNode } from "react"
import { Modal, View, StyleSheet, Pressable, KeyboardAvoidingView, Platform, Text, ScrollView } from "react-native"
import { useSelector } from "react-redux"
import { isAuthenticated } from "../store/authSlice"
import { setShowAuthModalCallback, notifyAuthSuccess, notifyAuthCancelled, getInitialErrorMessage, clearInitialErrorMessage } from "../services/api/baseQueryWithAuth"
import { useTheme } from "../theme/ThemeContext"
import type { ThemeColors } from "../types"
import { useToast } from "../hooks/useToast"
import Toast from "../components/Toast"
import { LoginForm } from "../components/LoginForm"

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
  const [initialErrorMessage, setInitialErrorMessage] = useState<string | null>(null)
  const isAuthenticatedUser = useSelector(isAuthenticated)
  const { colors } = useTheme()
  const { toast, showError, hideToast } = useToast()
  
  // Use refs to track previous state and prevent unwanted modal closures
  const wasAuthenticatedRef = React.useRef(isAuthenticatedUser)
  const modalWasExplicitlyOpenedRef = React.useRef(false)

  const showAuthModal = useCallback((errorMessage?: string) => {
    // Prevent opening multiple modals - if already visible, don't open again
    setIsVisible((prevVisible) => {
      if (prevVisible) {
        // Modal is already visible, don't open another one
        return prevVisible
      }
      // Modal is not visible, open it
      return true
    })
    
    // Only update refs and error message if we're actually opening the modal
    // Use a ref to track if modal is visible to avoid stale closure issues
    const currentIsVisible = isVisible
    if (!currentIsVisible) {
      modalWasExplicitlyOpenedRef.current = true
      // Store the initial error message that triggered the modal
      if (errorMessage) {
        setInitialErrorMessage(errorMessage)
      } else {
        // If no error message provided, try to get it from baseQueryWithAuth
        const storedMessage = getInitialErrorMessage()
        if (storedMessage) {
          setInitialErrorMessage(storedMessage)
        }
      }
    }
  }, [isVisible])

  const hideAuthModal = useCallback(() => {
    setIsVisible(false)
    modalWasExplicitlyOpenedRef.current = false
    setInitialErrorMessage(null)
    clearInitialErrorMessage()
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
      setInitialErrorMessage(null)
      clearInitialErrorMessage()
      
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
              <ScrollView 
                style={styles.loginContainer}
                contentContainerStyle={styles.loginContainerContent}
                showsVerticalScrollIndicator={true}
              >
                <LoginForm
                  onLoginSuccess={handleLoginSuccess}
                  showRegisterButton={false}
                  showForgotPasswordButton={false}
                  showSSOButtons={true}
                  compact={true}
                  onError={showError}
                  initialErrorMessage={initialErrorMessage}
                />
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
        <Toast
          visible={toast.visible}
          message={toast.message}
          type={toast.type}
          onHide={hideToast}
          testID="auth-modal-toast"
        />
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
    },
    loginContainerContent: {
      paddingHorizontal: 20,
      paddingBottom: 20,
      paddingTop: 10,
      minHeight: 200, // Ensure enough space for error message
    },
  })

