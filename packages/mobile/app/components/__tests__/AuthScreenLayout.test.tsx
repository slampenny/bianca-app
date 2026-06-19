import React from "react"
import { Text, View } from "react-native"
import { render } from "@testing-library/react-native"
import { ThemeProvider } from "../../theme/ThemeContext"

jest.mock("../Screen", () => ({
  Screen: ({ children, testID }: { children: React.ReactNode; testID?: string }) => (
    <View testID={testID}>{children}</View>
  ),
}))

jest.mock("../Card", () => ({
  Card: ({ ContentComponent, testID }: { ContentComponent: React.ReactElement; testID?: string }) => (
    <View testID={testID}>{ContentComponent}</View>
  ),
}))

import { AuthScreenLayout } from "../AuthScreenLayout"

describe("AuthScreenLayout", () => {
  it("renders children inside the auth shell", () => {
    const { getByTestId, getByText } = render(
      <ThemeProvider>
        <AuthScreenLayout testID="auth-shell" accessibilityLabel="auth-shell">
          <Text testID="auth-child">Sign in</Text>
        </AuthScreenLayout>
      </ThemeProvider>,
    )

    expect(getByTestId("auth-shell")).toBeTruthy()
    expect(getByText("Sign in")).toBeTruthy()
  })
})
