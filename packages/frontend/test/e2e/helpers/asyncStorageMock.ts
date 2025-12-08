// AsyncStorage mock for web environment
const mockStorage = new Map<string, string>()

export const AsyncStorageMock = {
  getItem: async (key: string): Promise<string | null> => {
    return mockStorage.get(key) || null
  },
  setItem: async (key: string, value: string): Promise<void> => {
    mockStorage.set(key, value)
  },
  removeItem: async (key: string): Promise<void> => {
    mockStorage.delete(key)
  },
  clear: async (): Promise<void> => {
    mockStorage.clear()
  },
  getAllKeys: async (): Promise<string[]> => {
    return Array.from(mockStorage.keys())
  },
  multiGet: async (keys: string[]): Promise<[string, string | null][]> => {
    return keys.map(key => [key, mockStorage.get(key) || null])
  },
  multiSet: async (keyValuePairs: [string, string][]): Promise<void> => {
    keyValuePairs.forEach(([key, value]) => mockStorage.set(key, value))
  },
  multiRemove: async (keys: string[]): Promise<void> => {
    keys.forEach(key => mockStorage.delete(key))
  }
}

// Browser script to inject AsyncStorage mock
export const asyncStorageMockScript = `
  (() => {
    const mockStorage = new Map();
    
    window.AsyncStorage = {
      getItem: async (key) => mockStorage.get(key) || null,
      setItem: async (key, value) => mockStorage.set(key, value),
      removeItem: async (key) => mockStorage.delete(key),
      clear: async () => mockStorage.clear(),
      getAllKeys: async () => Array.from(mockStorage.keys()),
      multiGet: async (keys) => keys.map(key => [key, mockStorage.get(key) || null]),
      multiSet: async (keyValuePairs) => keyValuePairs.forEach(([key, value]) => mockStorage.set(key, value)),
      multiRemove: async (keys) => keys.forEach(key => mockStorage.delete(key))
    };
  })();
` 