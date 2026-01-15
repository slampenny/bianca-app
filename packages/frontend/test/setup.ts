// we always make sure 'react-native' gets included first
import * as ReactNative from "react-native"
import en from "../app/i18n/en"
import mockFile from "./mockFile"

// libraries to mock
jest.doMock("react-native", () => {
  // Extend ReactNative
  return Object.setPrototypeOf(
    {
      Image: {
        ...ReactNative.Image,
        resolveAssetSource: jest.fn((_source) => mockFile), // eslint-disable-line @typescript-eslint/no-unused-vars
        getSize: jest.fn(
          (
            uri: string, // eslint-disable-line @typescript-eslint/no-unused-vars
            success: (width: number, height: number) => void,
            failure?: (_error: any) => void, // eslint-disable-line @typescript-eslint/no-unused-vars
          ) => success(100, 100),
        ),
      },
    },
    ReactNative,
  )
})

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
)

const resolveTranslation = (key: string) => {
  return key.split(".").reduce((value: any, part) => value?.[part], en)
}

const interpolate = (value: string, params?: Record<string, string>) => {
  if (!params) return value
  return value.replace(/\{\{\s*([\w.]+)\s*\}\}|\%\{([\w.]+)\}/g, (_match, key1, key2) => {
    const key = key1 || key2
    return params[key] ?? _match
  })
}

jest.mock("i18n-js", () => ({
  currentLocale: () => "en",
  t: (key: string, params?: Record<string, string>) => {
    const value = resolveTranslation(key)
    if (typeof value !== "string") {
      return key
    }
    return interpolate(value, params)
  },
}))

jest.mock("expo-localization", () => ({
  ...jest.requireActual("expo-localization"),
  getLocales: () => [{ languageTag: "en-US", textDirection: "ltr" }],
}))

declare global {
  let __TEST__: boolean
}
