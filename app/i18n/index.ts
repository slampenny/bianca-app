import "./i18n"
import { initializeLanguage } from "./i18n"

// Initialize language on app start
initializeLanguage().catch(console.error)

export * from "./i18n"
export * from "./translate"
