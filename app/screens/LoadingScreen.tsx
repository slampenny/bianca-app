import React from "react"
import { View, StyleSheet, ActivityIndicator } from "react-native"
import { useTheme } from "app/theme/ThemeContext"
import { Text } from "app/components"

export function LoadingScreen({ message }: { message?: string }) {
  const { colors, isLoading: themeLoading } = useTheme()
  
  if (themeLoading) {
    return null
  }

  const styles = createStyles(colors)
  
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
