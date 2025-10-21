import React from 'react'
import { View, StyleSheet, Modal } from 'react-native'
import { Text, Button } from 'app/components'
import { colors, spacing } from 'app/theme'

interface ConfirmationModalProps {
  visible: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel: () => void
  confirmButtonStyle?: any
  testID?: string
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  visible,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  confirmButtonStyle,
  testID = 'confirmation-modal',
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      testID={testID}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title} testID={`${testID}-title`}>{title}</Text>
          <Text style={styles.message} testID={`${testID}-message`}>{message}</Text>
          
          <View style={styles.buttonContainer}>
            <Button
              text={cancelText}
              onPress={onCancel}
              style={[styles.button, styles.cancelButton]}
              textStyle={styles.cancelButtonText}
              testID={`${testID}-cancel`}
            />
            <Button
              text={confirmText}
              onPress={onConfirm}
              style={[styles.button, styles.confirmButton, confirmButtonStyle]}
              textStyle={styles.confirmButtonText}
              testID={`${testID}-confirm`}
            />
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: spacing.xl,
    margin: spacing.lg,
    minWidth: 300,
    maxWidth: 400,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.palette.neutral800,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: colors.palette.neutral600,
    marginBottom: spacing.xl,
    textAlign: 'center',
    lineHeight: 22,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  button: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  cancelButton: {
    backgroundColor: colors.palette.neutral200,
    borderWidth: 1,
    borderColor: colors.palette.neutral300,
  },
  cancelButtonText: {
    color: colors.palette.neutral700,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: colors.palette.angry500,
  },
  confirmButtonText: {
    color: 'white',
    fontWeight: '600',
  },
})

export default ConfirmationModal
