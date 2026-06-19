import React from "react"
import { Pressable, Text as RNText, View } from "react-native"
import { render, waitFor } from "@testing-library/react-native"
import { Provider } from "react-redux"
import { configureStore } from "@reduxjs/toolkit"
import { themes } from "@bianca-app/shared"

jest.mock("app/theme/ThemeContext", () => ({
  useTheme: () => ({
    colors: themes.healthcare.colors,
    isLoading: false,
    fontScale: 1,
    themeInfo: themes.healthcare,
  }),
}))

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}))

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => React.createElement(View, { testID: "mock-ionicon" }),
}))

jest.mock("app/components", () => ({
  Button: ({ text, children, testID }: any) => (
    <Pressable testID={testID}>
      <RNText>{text || children}</RNText>
    </Pressable>
  ),
  Text: ({ text, children }: any) => <RNText>{text || children}</RNText>,
  Card: ({ ContentComponent, testID, onPress }: any) => (
    <Pressable testID={testID} onPress={onPress}>
      {ContentComponent}
    </Pressable>
  ),
}))

import { ReportsScreen } from "../ReportsScreen"

const client = {
  id: "client-1",
  name: "Mom",
  avatar: "",
  email: "mom@example.com",
  phone: "5555555555",
  org: "org-1",
  caregivers: [],
  schedules: [],
}

const store = configureStore({
  reducer: {
    auth: () => ({ currentUser: { id: "cg-1", name: "Jordan" } }),
    client: () => ({
      client: null,
      clients: { "cg-1": [client] },
    }),
  },
})

describe("ReportsScreen", () => {
  it("hides the client picker when there is only one client", async () => {
    const { queryByTestId, getByText } = render(
      <Provider store={store}>
        <ReportsScreen />
      </Provider>,
    )

    expect(queryByTestId("client-picker-button")).toBeNull()
    await waitFor(() => {
      expect(getByText("Mom")).toBeTruthy()
    })
  })
})
