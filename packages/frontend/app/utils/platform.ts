import { Platform } from 'react-native'

/**
 * Platform detection utilities for determining the current platform
 */
export const PlatformUtils = {
  /**
   * Check if the current platform is web
   */
  isWeb: (): boolean => {
    return Platform.OS === 'web'
  },

  /**
   * Check if the current platform is mobile (iOS or Android)
   */
  isMobile: (): boolean => {
    return Platform.OS === 'ios' || Platform.OS === 'android'
  },

  /**
   * Check if the current platform is iOS
   */
  isIOS: (): boolean => {
    return Platform.OS === 'ios'
  },

  /**
   * Check if the current platform is Android
   */
  isAndroid: (): boolean => {
    return Platform.OS === 'android'
  },

  /**
   * Get the current platform as a string
   */
  getPlatform: (): string => {
    return Platform.OS
  },

  /**
   * Check if we should use Stripe web components
   */
  shouldUseStripeWeb: (): boolean => {
    return Platform.OS === 'web'
  },

  /**
   * Check if we should use Stripe mobile components
   */
  shouldUseStripeMobile: (): boolean => {
    return Platform.OS === 'ios' || Platform.OS === 'android'
  },
}

export default PlatformUtils








