import React from 'react'
import { View, StyleSheet, Modal, Pressable } from 'react-native'
import { Text, Button } from 'app/components'
import { useTheme } from 'app/theme/ThemeContext'
import { spacing } from 'app/theme'

interface AlertModalProps {
  visible: boolean
  title: string
  message?: string
  buttonText?: string
  onPress: () => void
}

const AlertModal: React.FC<AlertModalProps> = ({
  visible,
  title,
  message,
  buttonText = 'OK',
  onPress,
}) => {
  const { colors } = useTheme()
  
  const createStyles = (colors: any) => StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modal: {
      backgroundColor: colors.palette.neutral100,
      borderRadius: 12,
      padding: spacing.xl,
      margin: spacing.lg,
      minWidth: 300,
      maxWidth: 400,
      shadowColor: colors.palette.neutral900,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    },
    title: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.palette.neutral800,
      marginBottom: message ? spacing.sm : spacing.md,
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
      alignItems: 'center',
    },
    button: {
      minWidth: 100,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
    },
  })
  
  const styles = createStyles(colors)
  
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onPress}
    >
      <Pressable style={styles.overlay} onPress={onPress}>
        <Pressable style={styles.modal} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{title}</Text>
          {message && <Text style={styles.message}>{message}</Text>}
          <View style={styles.buttonContainer}>
            <Button
              text={buttonText}
              onPress={onPress}
              preset="primary"
              style={styles.button}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

export default AlertModal
