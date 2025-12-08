import "./i18n"
import { initializeLanguage } from "./i18n"
import { logger } from "../utils/logger"

// Initialize language on app start
initializeLanguage().catch((error) => logger.error("Failed to initialize language:", error))

export * from "./i18n"
export * from "./translate"
