import React from "react"
import { fireEvent, render } from "@testing-library/react-native"
import { StatusBanner } from "../StatusBanner"
import { ThemeProvider } from "../../theme/ThemeContext"

jest.mock("@expo/vector-icons", () => {
  const React = require("react")
  const { View } = require("react-native")
  return {
    Ionicons: () => React.createElement(View, { testID: "mock-ionicon" }),
  }
})

const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider>{ui}</ThemeProvider>)

describe("StatusBanner", () => {
  it("shows healthy state when there are no unread alerts", () => {
    const { getByTestId, getByText } = renderWithTheme(<StatusBanner unreadAlertCount={0} />)

    expect(getByTestId("home-status-banner")).toBeTruthy()
    expect(getByText("Everything looks good")).toBeTruthy()
    expect(getByText("No unread alerts right now.")).toBeTruthy()
  })

  it("shows alert state and handles press when unread alerts exist", () => {
    const onPressAlerts = jest.fn()
    const { getByTestId, getByText } = renderWithTheme(
      <StatusBanner unreadAlertCount={3} onPressAlerts={onPressAlerts} />,
    )

    expect(getByText("3 alerts need attention")).toBeTruthy()
    fireEvent.press(getByTestId("home-status-banner"))
    expect(onPressAlerts).toHaveBeenCalledTimes(1)
  })
})
