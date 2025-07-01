import React from "react"
import { View, Text, StyleSheet, ActivityIndicator } from "react-native"
import { colors } from "app/theme/colors"

export function LoadingScreen({ message }: { message?: string }) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.palette.biancaButtonSelected} />
      <Text style={styles.loadingText}>{message || "Loading..."}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
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
