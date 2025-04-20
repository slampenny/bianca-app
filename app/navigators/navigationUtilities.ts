import { useState, useEffect, useRef } from "react"
import { BackHandler, Platform } from "react-native"
import {
  NavigationState,
  PartialState,
  createNavigationContainerRef,
} from "@react-navigation/native"
import Config from "../config"
import type { PersistNavigationConfig } from "../config/config.base"
import { useIsMounted } from "../utils/useIsMounted"
import type { AppStackParamList, NavigationProps } from "./navigationTypes"

import * as storage from "../utils/storage"

export const navigationRef = createNavigationContainerRef<AppStackParamList>()

export function getActiveRouteName(state: NavigationState | PartialState<NavigationState>): string {
  const route = state.routes[state.index ?? 0]
  if (!route.state) return route.name as keyof AppStackParamList
  return getActiveRouteName(route.state as NavigationState<AppStackParamList>)
}

export function useBackButtonHandler(canExit: (routeName: string) => boolean) {
  if (Platform.OS !== "android") return
  const canExitRef = useRef(canExit)
  useEffect(() => {
    canExitRef.current = canExit
  }, [canExit])
  useEffect(() => {
    const onBackPress = () => {
      if (!navigationRef.isReady()) {
        return false
      }
      const routeName = getActiveRouteName(navigationRef.getRootState())
      if (canExitRef.current(routeName)) {
        BackHandler.exitApp()
        return true
      }
      if (navigationRef.canGoBack()) {
        navigationRef.goBack()
        return true
      }
      return false
    }
    BackHandler.addEventListener("hardwareBackPress", onBackPress)
    return () => BackHandler.removeEventListener("hardwareBackPress", onBackPress)
  }, [])
}

export function useNavigationPersistence(storageKey: typeof storage, persistenceKey: string) {
  const [initialNavigationState, setInitialNavigationState] =
    useState<NavigationProps["initialState"]>()
  const isMounted = useIsMounted()
  const initNavState = navigationRestoredDefaultState(Config.persistNavigation)
  const [isRestored, setIsRestored] = useState(initNavState)
  const routeNameRef = useRef<keyof AppStackParamList | undefined>()
  const onNavigationStateChange = (state: NavigationState | undefined) => {
    const previousRouteName = routeNameRef.current
    if (state) {
      const currentRouteName = getActiveRouteName(state)
      if (previousRouteName !== currentRouteName && __DEV__) {
        console.log(currentRouteName)
      }
      routeNameRef.current = currentRouteName as keyof AppStackParamList
      storage.save(persistenceKey, state)
    }
  }
  const restoreState = async () => {
    try {
      const state = (await storageKey.load(persistenceKey)) as
        | NavigationProps["initialState"]
        | null
      if (state) setInitialNavigationState(state)
    } finally {
      if (isMounted()) setIsRestored(true)
    }
  }
  useEffect(() => {
    if (!isRestored) restoreState()
  }, [isRestored])
  return { onNavigationStateChange, restoreState, isRestored, initialNavigationState }
}

function navigationRestoredDefaultState(persistNavigation: PersistNavigationConfig) {
  if (persistNavigation === "always") return false
  if (persistNavigation === "dev" && __DEV__) return false
  if (persistNavigation === "prod" && !__DEV__) return false
  return true
}

export function navigate(name: keyof AppStackParamList, params?: object) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name as any, params)
  }
}

export function goBack() {
  if (navigationRef.isReady() && navigationRef.canGoBack()) {
    navigationRef.goBack()
  }
}

export function resetRoot(
  state: Parameters<typeof navigationRef.resetRoot>[0] = { index: 0, routes: [] },
) {
  if (navigationRef.isReady()) {
    navigationRef.resetRoot(state)
  }
}
