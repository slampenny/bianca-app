import React from "react"
import { View, Text, StyleSheet, ActivityIndicator } from "react-native"
import { useTheme } from "app/theme/ThemeContext"

export function LoadingScreen({ message }: { message?: string }) {
  const { colors, isLoading: themeLoading } = useTheme()
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.palette.biancaButtonSelected} />
      <Text style={styles.loadingText}>{message || "Loading..."}</Text>
    </View>
  )
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: colors.palette.biancaBackground,
    flex: 1,
    justifyContent: "center",
  },
  loadingText: {
    color: colors.palette.biancaHeader,
    fontSize: 20,
    fontWeight: "bold",
    marginTop: 10,
  },
})
