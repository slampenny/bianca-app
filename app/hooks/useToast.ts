import { useState } from 'react'

interface ToastState {
  visible: boolean
  message: string
  type: 'success' | 'error' | 'info'
}

export function useToast() {
  const [toast, setToast] = useState<ToastState>({
    visible: false,
    message: '',
    type: 'info',
  })

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({
      visible: true,
      message,
      type,
    })
  }

  const hideToast = () => {
    setToast(prev => ({ ...prev, visible: false }))
  }

  const showSuccess = (message: string) => showToast(message, 'success')
  const showError = (message: string) => showToast(message, 'error')
  const showInfo = (message: string) => showToast(message, 'info')

  return {
    toast,
    showToast,
    hideToast,
    showSuccess,
    showError,
    showInfo,
  }
}

