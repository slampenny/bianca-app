import "./i18n"
import { initializeLanguage } from "./i18n"
import { logger } from "../utils/logger"

const shouldInitializeLanguage = process.env.NODE_ENV !== "test" && !process.env.JEST_WORKER_ID

// Initialize language on app start (skip in tests to avoid open handles)
if (shouldInitializeLanguage) {
  initializeLanguage().catch((error) => logger.error("Failed to initialize language:", error))
}

export * from "./i18n"
export * from "./translate"
