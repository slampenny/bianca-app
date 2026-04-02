import "@fontsource/ibm-plex-sans/400.css"
import "@fontsource/ibm-plex-sans/500.css"
import "@fontsource/ibm-plex-sans/600.css"
import "@fontsource/ibm-plex-mono/400.css"
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
import { BrowserRouter } from "react-router-dom"
import App from "./App"
import { persistor, store } from "./store/store"
import "./index.css"
import "./admin-app.css"

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
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </PersistGate>
    </Provider>
  </StrictMode>,
)
