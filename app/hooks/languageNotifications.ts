// Global language change listeners
const languageChangeListeners = new Set<() => void>()

// Function to notify all listeners of language change
export const notifyLanguageChange = () => {
  console.log("notifyLanguageChange called, notifying", languageChangeListeners.size, "listeners")
  languageChangeListeners.forEach(listener => listener())
}

// Function to add a language change listener
export const addLanguageChangeListener = (listener: () => void) => {
  languageChangeListeners.add(listener)
}

// Function to remove a language change listener
export const removeLanguageChangeListener = (listener: () => void) => {
  languageChangeListeners.delete(listener)
}
