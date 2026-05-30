import "@fontsource/space-grotesk/400.css"
import "@fontsource/space-grotesk/500.css"
import "@fontsource/space-grotesk/600.css"
import "@fontsource/space-grotesk/700.css"
import {
  applyCssVarsToRoot,
  defaultThemeType,
  spacingToCssVars,
  themeColorsToCssVars,
  themes,
} from "@bianca-app/shared"
import { setupListeners } from "@reduxjs/toolkit/query"
import { StrictMode } from "react"
import { Provider } from "react-redux"
import { PersistGate } from "redux-persist/integration/react"
import { createRoot } from "react-dom/client"
import "./i18n/i18n"
import { I18nProvider } from "./i18n/I18nProvider"
import App from "./App"
import { persistor, store } from "./store/store"
import { initWebPreferencesFromStorage } from "./lib/webPreferences"
import "@bianca-app/ui/styles.css"
import "./index.css"

initWebPreferencesFromStorage()

setupListeners(store.dispatch)

const semantic = themes[defaultThemeType].colors
applyCssVarsToRoot({
  ...themeColorsToCssVars(semantic),
  ...spacingToCssVars(),
})

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <I18nProvider>
          <App />
        </I18nProvider>
      </PersistGate>
    </Provider>
  </StrictMode>,
)
