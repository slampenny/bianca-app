import { useTheme } from '../theme/ThemeContext'
import { LoadingScreen } from '../screens'

/**
 * Hook to handle screen-level loading states
 * Combines theme loading with any additional loading states
 * 
 * @param loadingStates - Additional loading states to check
 * @returns Object with isLoading flag and LoadingComponent
 */
export function useScreenLoading(...loadingStates: boolean[]) {
  const { isLoading: themeLoading } = useTheme()
  const isLoading = themeLoading || loadingStates.some(state => state)
  
  return {
    isLoading,
    LoadingComponent: isLoading ? LoadingScreen : null,
  }
}

