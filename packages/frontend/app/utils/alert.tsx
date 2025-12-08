import { Alert as RNAlert } from 'react-native'
import { PlatformUtils } from './platform'

/**
 * Cross-platform alert utility
 * Uses React Native Alert on mobile, window.alert on web
 * 
 * Note: On web, window.alert is used as a simple fallback.
 * For better UX on web, consider using a modal component instead.
 */
export const Alert = {
  /**
   * Show an alert dialog with a title and message
   * On mobile: Uses React Native Alert (native dialog)
   * On web: Uses window.alert (browser alert dialog)
   * 
   * @param title - Alert title
   * @param message - Optional alert message
   * @param buttons - Optional array of buttons (on web, only first button is used)
   */
  alert: (title: string, message?: string, buttons?: Array<{ text: string; onPress?: () => void }>) => {
    if (PlatformUtils.isWeb()) {
      // On web, use window.alert (works but basic UX)
      // For production, consider implementing a modal-based alert system
      const fullMessage = message ? `${title}\n\n${message}` : title
      window.alert(fullMessage)
      
      // Call the first button's onPress if provided
      if (buttons && buttons[0]?.onPress) {
        // Use setTimeout to ensure alert is dismissed first
        setTimeout(() => {
          buttons[0].onPress?.()
        }, 0)
      }
    } else {
      // On mobile (iOS/Android), use React Native Alert
      if (buttons && buttons.length > 0) {
        RNAlert.alert(title, message, buttons as any)
      } else {
        RNAlert.alert(title, message, [{ text: 'OK' }])
      }
    }
  },
}

export default Alert
