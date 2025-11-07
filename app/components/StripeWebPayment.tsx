import React, { useState, useEffect } from 'react'
import { View, StyleSheet } from 'react-native'
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import { Text, Button, Card, ListItem } from 'app/components'
import { colors, spacing } from 'app/theme'
import { useAttachPaymentMethodMutation, useGetPaymentMethodsQuery, useSetDefaultPaymentMethodMutation, useDetachPaymentMethodMutation } from 'app/services/api/paymentMethodApi'
import { useSelector } from 'react-redux'
import { getOrg } from 'app/store/orgSlice'
import { translate } from 'app/i18n'
import { useTheme } from 'app/theme/ThemeContext'
import { useLanguage } from 'app/hooks/useLanguage'
import ConfirmationModal from './ConfirmationModal'
import Toast from './Toast'
import i18n from 'i18n-js'

interface PaymentMethod {
  id: string
  type: string
  brand?: string
  last4?: string
  expMonth?: number
  expYear?: number
  isDefault: boolean
  billingDetails?: {
    name?: string
    email?: string
    phone?: string
  }
}

interface StripeWebPaymentProps {
  orgId: string
  publishableKey: string
  onPaymentMethodAdded?: () => void
  onError?: (error: string) => void
}

const PaymentForm: React.FC<{
  orgId: string
  onPaymentMethodAdded?: () => void
  onError?: (error: string) => void
}> = ({ orgId, onPaymentMethodAdded, onError }) => {
  const stripe = useStripe()
  const elements = useElements()
  const { colors: themeColors } = useTheme()
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [toastVisible, setToastVisible] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info')
  const [confirmationModal, setConfirmationModal] = useState<{
    visible: boolean
    title: string
    message: string
    onConfirm: () => void
    paymentMethodId?: string
  }>({
    visible: false,
    title: '',
    message: '',
    onConfirm: () => {},
  })

  const [attachPaymentMethod] = useAttachPaymentMethodMutation()
  const [setDefaultPaymentMethod] = useSetDefaultPaymentMethodMutation()
  const [detachPaymentMethod] = useDetachPaymentMethodMutation()
  const { data: paymentMethods = [], refetch, isLoading: paymentMethodsLoading, error: paymentMethodsError } = useGetPaymentMethodsQuery(orgId)

  // Debug logging
  console.log('Payment methods query:', { 
    paymentMethods, 
    paymentMethodsLoading, 
    paymentMethodsError,
    orgId 
  })
  
  // Debug payment methods rendering
  console.log('Payment methods for rendering:', paymentMethods.map(pm => ({
    id: pm.id,
    isDefault: pm.isDefault,
    brand: pm.brand,
    last4: pm.last4
  })))

  const handleSubmit = async (event: any) => {
    event.preventDefault()

    if (!stripe || !elements) {
      return
    }

    setIsLoading(true)
    setMessage('')

    try {
      const cardElement = elements.getElement(CardElement)
      if (!cardElement) {
        throw new Error('Card element not found')
      }

      const { error, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
      })

      if (error) {
        const errorMsg = error.message || translate("paymentScreen.anErrorOccurred")
        setMessage(errorMsg)
        onError?.(errorMsg)
        return
      }

      if (paymentMethod) {
        await attachPaymentMethod({
          orgId,
          paymentMethodId: paymentMethod.id,
        }).unwrap()

        const successMsg = translate("paymentScreen.paymentMethodAddedSuccess")
        setMessage(successMsg)
        showToast(successMsg, 'success')
        onPaymentMethodAdded?.()
        
        // Clear the card element
        cardElement.clear()
        
        // Refetch payment methods
        refetch()
      }
    } catch (err: any) {
      const errorMessage = err.message || translate("paymentScreen.anErrorOccurred")
      setMessage(errorMessage)
      showToast(errorMessage, 'error')
      onError?.(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage(message)
    setToastType(type)
    setToastVisible(true)
  }

  const handleSetDefault = async (paymentMethodId: string) => {
    console.log('Setting default payment method:', { paymentMethodId, orgId })
    try {
      const result = await setDefaultPaymentMethod({
        orgId,
        paymentMethodId,
      }).unwrap()
      
      console.log('Set default payment method result:', result)
      const successMsg = translate("paymentScreen.paymentMethodSetDefaultSuccess")
      showToast(successMsg, 'success')
      
      // Refetch and log the updated data
      const refetchResult = await refetch()
      console.log('Refetch result:', refetchResult.data)
      
      // Force a re-render by updating a dummy state
      setMessage(successMsg)
      
    } catch (err: any) {
      console.error('Error setting default payment method:', err)
      const errorMessage = err.message || translate("paymentScreen.failedToSetDefault")
      showToast(errorMessage, 'error')
    }
  }

  const handleDeletePaymentMethod = (paymentMethodId: string) => {
    setConfirmationModal({
      visible: true,
      title: translate("paymentScreen.deletePaymentMethod"),
      message: translate("paymentScreen.deletePaymentMethodConfirm"),
      onConfirm: () => confirmDeletePaymentMethod(paymentMethodId),
      paymentMethodId,
    })
  }

  const confirmDeletePaymentMethod = async (paymentMethodId: string) => {
    setConfirmationModal(prev => ({ ...prev, visible: false }))
    
    try {
      await detachPaymentMethod({
        orgId,
        paymentMethodId,
      }).unwrap()
      
      showToast(translate("paymentScreen.paymentMethodDeletedSuccess"), 'success')
      refetch()
    } catch (err: any) {
      const errorMessage = err.message || translate("paymentScreen.failedToDelete")
      showToast(errorMessage, 'error')
    }
  }

  // Get current locale for CardElement localization
  const { currentLanguage } = useLanguage()
  const currentLocale = currentLanguage || i18n.locale || 'en'
  // Map our locale codes to Stripe's supported locales
  // Stripe supports: auto, bg, cs, da, de, el, en, es, et, fi, fr, hu, id, it, ja, lt, lv, ms, mt, nb, nl, pl, pt, ro, ru, sk, sl, sv, tr, zh
  const stripeLocaleMap: { [key: string]: string } = {
    'en': 'en',
    'zh': 'zh',
    'fr': 'fr',
    'es': 'es',
    'de': 'de',
    'it': 'it',
    'ja': 'ja',
    'ko': 'auto', // Korean not directly supported, use auto
    'pt': 'pt',
    'ru': 'ru',
    'ar': 'auto', // Arabic not directly supported, use auto
  }
  const stripeLocale = stripeLocaleMap[currentLocale] || 'en'
  
  // Debug logging
  if (__DEV__) {
    console.log('[StripeWebPayment] Locale detection:', {
      currentLanguage,
      i18nLocale: i18n.locale,
      currentLocale,
      stripeLocale,
    })
  }

  // Create themed card element options based on current theme
  // Note: locale should NOT be in CardElement options - it goes in Elements options
  const cardElementOptions = {
    style: {
      base: {
        fontSize: '16px',
        color: themeColors.text || themeColors.palette.neutral800 || '#424770',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        '::placeholder': {
          color: themeColors.textDim || themeColors.palette.neutral500 || '#aab7c4',
        },
      },
      invalid: {
        color: themeColors.palette.angry500 || '#9e2146',
        iconColor: themeColors.palette.angry500 || '#9e2146',
      },
    },
  }

  const dynamicStyles = createDynamicStyles(themeColors)

  return (
    <View style={[styles.container, { backgroundColor: themeColors.palette.biancaBackground }]} accessibilityLabel="stripe-web-payment-container">
      <Text style={dynamicStyles.title} accessibilityLabel="payment-methods-title">{translate("paymentScreen.addPaymentMethod")}</Text>
      
      {paymentMethodsLoading && (
        <View style={styles.loadingContainer} accessibilityLabel="payment-methods-loading">
          <Text style={dynamicStyles.loadingText}>{translate("paymentScreen.loadingPaymentMethods")}</Text>
        </View>
      )}

      {!paymentMethodsLoading && paymentMethodsError && (
        <View style={[styles.errorContainer, { backgroundColor: themeColors.palette.angry100 }]} accessibilityLabel="payment-methods-error">
          <Text style={dynamicStyles.errorText}>{translate("paymentScreen.errorLoadingPaymentMethods")} {paymentMethodsError.message}</Text>
        </View>
      )}

      {!paymentMethodsLoading && !paymentMethodsError && paymentMethods.length > 0 && (
        <View style={styles.existingMethods} accessibilityLabel="existing-payment-methods">
          <Text style={dynamicStyles.sectionTitle} accessibilityLabel="existing-methods-title">
            {translate("paymentScreen.existingPaymentMethods")} ({paymentMethods.length})
          </Text>
          
          {paymentMethods.map((method: PaymentMethod, index: number) => {
            // Create display text based on available data
            let displayText = translate("paymentScreen.paymentMethod")
            let subText = method.isDefault ? translate("paymentScreen.default") : ''
            
            if (method.brand && method.last4) {
              displayText = `${method.brand.toUpperCase()} •••• ${method.last4}`
              if (method.expMonth && method.expYear) {
                subText = `${subText ? subText + ' • ' : ''}${translate("paymentScreen.expires")} ${method.expMonth}/${method.expYear}`
              }
            } else if (method.bankName && method.accountType) {
              displayText = `${method.bankName} ${method.accountType}`
            } else if (method.type) {
              displayText = `${method.type.toUpperCase()}`
            }
            
            return (
              <View key={method.id} style={[styles.paymentMethodCard, { backgroundColor: themeColors.palette.neutral100, borderColor: themeColors.palette.neutral300 }]} accessibilityLabel={`payment-method-card-${method.id}`}>
                <View style={styles.paymentMethodContent}>
                  <View style={styles.paymentMethodInfo}>
                    <Text style={dynamicStyles.paymentMethodText} accessibilityLabel={`payment-method-text-${method.id}`}>{displayText}</Text>
                    {subText ? <Text style={dynamicStyles.paymentMethodSubText} accessibilityLabel={`payment-method-subtext-${method.id}`}>{subText}</Text> : null}
                    {method.isDefault && (
                      <View style={[styles.defaultBadge, { backgroundColor: themeColors.palette.accent500 }]} accessibilityLabel={`default-badge-${method.id}`}>
                        <Text style={styles.defaultBadgeText}>{translate("paymentScreen.default")}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.paymentMethodActions}>
                    {!method.isDefault && (
                      <Button
                        text={translate("paymentScreen.setDefault")}
                        onPress={() => handleSetDefault(method.id)}
                        style={styles.actionButton}
                        textStyle={styles.actionButtonText}
                        testID={`set-default-button-${method.id}`}
                      />
                    )}
                    <Button
                      text={translate("paymentScreen.remove")}
                      onPress={() => handleDeletePaymentMethod(method.id)}
                      style={[styles.actionButton, styles.removeButton]}
                      textStyle={[styles.actionButtonText, styles.removeButtonText]}
                      testID={`remove-button-${method.id}`}
                    />
                  </View>
                </View>
              </View>
            )
          })}
        </View>
      )}

      <View style={[styles.formContainer, { backgroundColor: themeColors.palette.neutral100 }]} accessibilityLabel="add-payment-form">
        <Text style={dynamicStyles.sectionTitle} accessibilityLabel="add-card-title">{translate("paymentScreen.addNewCard")}</Text>
        <View style={[styles.cardElementContainer, { backgroundColor: themeColors.palette.neutral100, borderColor: themeColors.palette.neutral300 }]} accessibilityLabel="card-element-container">
          <CardElement key={`card-element-${stripeLocale}`} options={cardElementOptions} />
        </View>
        
        <Button
          text={translate("paymentScreen.addPaymentMethod")}
          onPress={handleSubmit}
          disabled={!stripe || isLoading}
          style={styles.submitButton}
          testID="add-payment-method-button"
        />
        
        {message && (
          <Text style={[dynamicStyles.message, message.includes('success') ? dynamicStyles.successMessage : dynamicStyles.errorMessage]} accessibilityLabel="payment-message">
            {message}
          </Text>
        )}
      </View>

      {/* Toast for success/error messages */}
      <Toast
        visible={toastVisible}
        message={toastMessage}
        type={toastType}
        onHide={() => setToastVisible(false)}
        testID="payment-toast"
      />

      {/* Confirmation modal for delete actions */}
      <ConfirmationModal
        visible={confirmationModal.visible}
        title={confirmationModal.title}
        message={confirmationModal.message}
        confirmText={translate("common.delete")}
        cancelText={translate("common.cancel")}
        onConfirm={confirmationModal.onConfirm}
        onCancel={() => setConfirmationModal(prev => ({ ...prev, visible: false }))}
        confirmButtonStyle={styles.deleteConfirmButton}
        testID="delete-payment-method-modal"
      />
    </View>
  )
}

const StripeWebPayment: React.FC<StripeWebPaymentProps> = ({
  orgId,
  publishableKey,
  onPaymentMethodAdded,
  onError,
}) => {
  // Use language hook to trigger re-renders on language change
  const { currentLanguage } = useLanguage()
  
  // Get current locale for Stripe Elements localization
  const currentLocale = currentLanguage || i18n.locale || 'en'
  // Map our locale codes to Stripe's supported locales
  // Stripe supports: auto, bg, cs, da, de, el, en, es, et, fi, fr, hu, id, it, ja, lt, lv, ms, mt, nb, nl, pl, pt, ro, ru, sk, sl, sv, tr, zh
  const stripeLocaleMap: { [key: string]: string } = {
    'en': 'en',
    'zh': 'zh',
    'fr': 'fr',
    'es': 'es',
    'de': 'de',
    'it': 'it',
    'ja': 'ja',
    'ko': 'auto', // Korean not directly supported, use auto
    'pt': 'pt',
    'ru': 'ru',
    'ar': 'auto', // Arabic not directly supported, use auto
  }
  const stripeLocale = stripeLocaleMap[currentLocale] || 'en'
  
  // Initialize Stripe with the provided publishable key
  // Note: loadStripe doesn't accept locale - it must be passed to Elements options
  const stripePromise = React.useMemo(() => loadStripe(publishableKey), [publishableKey])
  
  // Create a key that changes when locale changes to force complete remount
  // This ensures Stripe Elements re-initializes with the new locale
  const elementsKey = `stripe-elements-${stripeLocale}`

  // Debug logging
  if (__DEV__) {
    console.log('[StripeWebPayment] Locale configuration:', {
      currentLanguage,
      i18nLocale: i18n.locale,
      currentLocale,
      stripeLocale,
      elementsKey,
    })
  }

  return (
    <Elements 
      key={elementsKey}
      stripe={stripePromise} 
      options={{ locale: stripeLocale }}
    >
      <PaymentForm
        key={`payment-form-${stripeLocale}`}
        orgId={orgId}
        onPaymentMethodAdded={onPaymentMethodAdded}
        onError={onError}
      />
    </Elements>
  )
}

const createDynamicStyles = (colors: any) => StyleSheet.create({
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: spacing.lg,
    color: colors.text || colors.palette.neutral800,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: spacing.md,
    color: colors.text || colors.palette.neutral800,
  },
  paymentMethodText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text || colors.palette.neutral800,
    marginBottom: spacing.xs,
  },
  paymentMethodSubText: {
    fontSize: 14,
    color: colors.textDim || colors.palette.neutral600,
  },
  loadingText: {
    color: colors.textDim || colors.palette.neutral600,
    fontSize: 14,
  },
  errorText: {
    color: colors.palette.angry500,
    fontSize: 14,
  },
  message: {
    marginTop: spacing.md,
    textAlign: 'center',
    fontSize: 14,
  },
  successMessage: {
    color: colors.palette.accent500,
  },
  errorMessage: {
    color: colors.palette.angry500,
  },
})

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.md,
  },
  existingMethods: {
    marginBottom: spacing.xl,
  },
  paymentMethodCard: {
    marginBottom: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  paymentMethodContent: {
    padding: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentMethodInfo: {
    flex: 1,
    position: 'relative',
  },
  paymentMethodActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  defaultBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: 4,
  },
  defaultBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  actionButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 4,
    minWidth: 80,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  removeButton: {
    backgroundColor: colors.palette.angry100,
    borderWidth: 1,
    borderColor: colors.palette.angry300,
  },
  removeButtonText: {
    color: colors.palette.angry600,
  },
  formContainer: {
    padding: spacing.lg,
    borderRadius: 8,
  },
  cardElementContainer: {
    padding: spacing.md,
    borderRadius: 4,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  submitButton: {
    marginTop: spacing.md,
  },
  loadingContainer: {
    padding: spacing.md,
    alignItems: 'center',
  },
  errorContainer: {
    padding: spacing.md,
    borderRadius: 4,
    marginBottom: spacing.md,
  },
  deleteConfirmButton: {
    backgroundColor: colors.palette.angry500,
  },
})

export default StripeWebPayment
