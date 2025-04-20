import React from "react"
import { View, Text, StyleSheet, ActivityIndicator } from "react-native"

export function LoadingScreen() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#0000ff" />
      <Text style={styles.loadingText}>Loading...</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: "#ECF0F1",
    flex: 1,
    justifyContent: "center",
  },
  loadingText: {
    color: "#2C3E50",
    fontSize: 20,
    fontWeight: "bold",
    marginTop: 10,
  },
})
