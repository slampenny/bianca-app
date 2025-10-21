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
import ConfirmationModal from './ConfirmationModal'
import Toast from './Toast'

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
        setMessage(error.message || 'An error occurred')
        onError?.(error.message || 'An error occurred')
        return
      }

      if (paymentMethod) {
        await attachPaymentMethod({
          orgId,
          paymentMethodId: paymentMethod.id,
        }).unwrap()

        setMessage('Payment method added successfully!')
        showToast('Payment method added successfully!', 'success')
        onPaymentMethodAdded?.()
        
        // Clear the card element
        cardElement.clear()
        
        // Refetch payment methods
        refetch()
      }
    } catch (err: any) {
      const errorMessage = err.message || 'An error occurred'
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
      showToast('Payment method set as default successfully!', 'success')
      
      // Refetch and log the updated data
      const refetchResult = await refetch()
      console.log('Refetch result:', refetchResult.data)
      
      // Force a re-render by updating a dummy state
      setMessage('Payment method set as default successfully!')
      
    } catch (err: any) {
      console.error('Error setting default payment method:', err)
      const errorMessage = err.message || 'Failed to set default payment method'
      showToast(errorMessage, 'error')
    }
  }

  const handleDeletePaymentMethod = (paymentMethodId: string) => {
    setConfirmationModal({
      visible: true,
      title: 'Delete Payment Method',
      message: 'Are you sure you want to delete this payment method? This action cannot be undone.',
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
      
      showToast('Payment method deleted successfully!', 'success')
      refetch()
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to delete payment method'
      showToast(errorMessage, 'error')
    }
  }

  const cardElementOptions = {
    style: {
      base: {
        fontSize: '16px',
        color: '#424770',
        '::placeholder': {
          color: '#aab7c4',
        },
      },
      invalid: {
        color: '#9e2146',
      },
    },
  }

  return (
    <View style={styles.container} accessibilityLabel="stripe-web-payment-container">
      <Text style={styles.title} accessibilityLabel="payment-methods-title">Add Payment Method</Text>
      
      {paymentMethodsLoading && (
        <View style={styles.loadingContainer} accessibilityLabel="payment-methods-loading">
          <Text style={styles.loadingText}>Loading payment methods...</Text>
        </View>
      )}

      {!paymentMethodsLoading && paymentMethodsError && (
        <View style={styles.errorContainer} accessibilityLabel="payment-methods-error">
          <Text style={styles.errorText}>Error loading payment methods: {paymentMethodsError.message}</Text>
        </View>
      )}

      {!paymentMethodsLoading && !paymentMethodsError && paymentMethods.length > 0 && (
        <View style={styles.existingMethods} accessibilityLabel="existing-payment-methods">
          <Text style={styles.sectionTitle} accessibilityLabel="existing-methods-title">Existing Payment Methods ({paymentMethods.length})</Text>
          
          {paymentMethods.map((method: PaymentMethod, index: number) => {
            // Create display text based on available data
            let displayText = 'Payment Method'
            let subText = method.isDefault ? 'Default' : ''
            
            if (method.brand && method.last4) {
              displayText = `${method.brand.toUpperCase()} •••• ${method.last4}`
              if (method.expMonth && method.expYear) {
                subText = `${subText ? subText + ' • ' : ''}Expires ${method.expMonth}/${method.expYear}`
              }
            } else if (method.bankName && method.accountType) {
              displayText = `${method.bankName} ${method.accountType}`
            } else if (method.type) {
              displayText = `${method.type.toUpperCase()}`
            }
            
            return (
              <View key={method.id} style={styles.paymentMethodCard} accessibilityLabel={`payment-method-card-${method.id}`}>
                <View style={styles.paymentMethodContent}>
                  <View style={styles.paymentMethodInfo}>
                    <Text style={styles.paymentMethodText} accessibilityLabel={`payment-method-text-${method.id}`}>{displayText}</Text>
                    {subText ? <Text style={styles.paymentMethodSubText} accessibilityLabel={`payment-method-subtext-${method.id}`}>{subText}</Text> : null}
                    {method.isDefault && (
                      <View style={styles.defaultBadge} accessibilityLabel={`default-badge-${method.id}`}>
                        <Text style={styles.defaultBadgeText}>Default</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.paymentMethodActions}>
                    {!method.isDefault && (
                      <Button
                        text="Set Default"
                        onPress={() => handleSetDefault(method.id)}
                        style={styles.actionButton}
                        textStyle={styles.actionButtonText}
                        testID={`set-default-button-${method.id}`}
                      />
                    )}
                    <Button
                      text="Remove"
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

      <View style={styles.formContainer} accessibilityLabel="add-payment-form">
        <Text style={styles.sectionTitle} accessibilityLabel="add-card-title">Add New Card</Text>
        <View style={styles.cardElementContainer} accessibilityLabel="card-element-container">
          <CardElement options={cardElementOptions} />
        </View>
        
        <Button
          text="Add Payment Method"
          onPress={handleSubmit}
          disabled={!stripe || isLoading}
          style={styles.submitButton}
          testID="add-payment-method-button"
        />
        
        {message && (
          <Text style={[styles.message, message.includes('success') ? styles.successMessage : styles.errorMessage]} accessibilityLabel="payment-message">
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
        confirmText="Delete"
        cancelText="Cancel"
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
  // Initialize Stripe with the provided publishable key
  const stripePromise = loadStripe(publishableKey)

  return (
    <Elements stripe={stripePromise}>
      <PaymentForm
        orgId={orgId}
        onPaymentMethodAdded={onPaymentMethodAdded}
        onError={onError}
      />
    </Elements>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.md,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: spacing.lg,
    color: colors.text,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: spacing.md,
    color: colors.text,
  },
  existingMethods: {
    marginBottom: spacing.xl,
  },
  paymentMethodCard: {
    marginBottom: spacing.sm,
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.palette.neutral300,
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
  paymentMethodText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.palette.neutral800,
    marginBottom: spacing.xs,
  },
  paymentMethodSubText: {
    fontSize: 14,
    color: colors.palette.neutral600,
  },
  defaultBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: colors.palette.accent500,
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
    backgroundColor: colors.palette.neutral100,
    padding: spacing.lg,
    borderRadius: 8,
  },
  cardElementContainer: {
    padding: spacing.md,
    backgroundColor: colors.palette.neutral100,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.palette.neutral300,
    marginBottom: spacing.lg,
  },
  submitButton: {
    marginTop: spacing.md,
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
  loadingContainer: {
    padding: spacing.md,
    alignItems: 'center',
  },
  loadingText: {
    color: colors.palette.neutral600,
    fontSize: 14,
  },
  errorContainer: {
    padding: spacing.md,
    backgroundColor: colors.palette.angry100,
    borderRadius: 4,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.palette.angry500,
    fontSize: 14,
  },
  deleteConfirmButton: {
    backgroundColor: colors.palette.angry500,
  },
})

export default StripeWebPayment
