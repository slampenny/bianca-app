import React, { useState, useMemo, useEffect } from "react"
import { View, StyleSheet, Pressable, Modal, TouchableWithoutFeedback, ScrollView } from "react-native"
import { useTheme } from "app/theme/ThemeContext"
import { Ionicons } from "@expo/vector-icons"
import { useNavigation } from "@react-navigation/native"
import { useSelector, useDispatch } from "react-redux"
import { getCurrentUser } from "../store/authSlice"
import { getClientsForCaregiver, setClient } from "../store/clientSlice"
import { Client } from "../services/api/api.types"
import { translate } from "../i18n"
import { Button, Text, Card } from "app/components"
type ReportKey = "sentiment" | "medical" | "fraudAbuse"

type ReportDef = {
  key: ReportKey
  titleKey: import("../i18n").TxKeyPath
  hintKey?: import("../i18n").TxKeyPath
  icon: keyof typeof Ionicons.glyphMap
  accent: string
  iconColor: string
  testID: string
  primary?: boolean
}

const PRIMARY_REPORTS: ReportDef[] = [
  {
    key: "sentiment",
    titleKey: "reportsScreen.sentiment",
    hintKey: "reportsScreen.sentimentHint",
    icon: "sparkles",
    accent: "rgba(37, 99, 235, 0.12)",
    iconColor: "#2563EB",
    testID: "sentiment-reports-button",
    primary: true,
  },
]

const SECONDARY_REPORTS: ReportDef[] = [
  {
    key: "medical",
    titleKey: "reportsScreen.medicalAnalysis",
    hintKey: "reportsScreen.medicalHint",
    icon: "heart-outline",
    accent: "rgba(20, 184, 166, 0.12)",
    iconColor: "#0F766E",
    testID: "health-reports-button",
  },
  {
    key: "fraudAbuse",
    titleKey: "reportsScreen.fraudAbuseAnalysis",
    hintKey: "reportsScreen.fraudHint",
    icon: "shield-outline",
    accent: "rgba(245, 158, 11, 0.1)",
    iconColor: "#D97706",
    testID: "fraud-abuse-reports-button",
  },
]

export function ReportsScreen() {
  const navigation = useNavigation()
  const dispatch = useDispatch()
  const currentUser = useSelector(getCurrentUser)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [showClientPicker, setShowClientPicker] = useState(false)
  const { colors, isLoading: themeLoading } = useTheme()

  const clientsSelector = useMemo(
    () => (state: any) => {
      return currentUser && currentUser.id ? getClientsForCaregiver(state, currentUser.id) : []
    },
    [currentUser?.id],
  )
  const clients = useSelector(clientsSelector)

  useEffect(() => {
    if (clients.length === 1 && !selectedClient) {
      setSelectedClient(clients[0])
    }
  }, [clients, selectedClient])

  const openReport = (key: ReportKey) => {
    if (!selectedClient) return
    dispatch(setClient(selectedClient))
    if (key === "sentiment") navigation.navigate("SentimentReport" as never)
    else if (key === "medical") navigation.navigate("MedicalAnalysis" as never)
    else navigation.navigate("FraudAbuseAnalysis" as never)
  }

  if (themeLoading) {
    return null
  }

  const styles = createStyles(colors)
  const clientPickerHidden = clients.length <= 1

  const renderReportCard = (report: ReportDef) => {
    const disabled = !selectedClient
    return (
      <Card
        key={report.key}
        testID={report.testID}
        accessibilityLabel={translate(report.titleKey)}
        accessibilityHint={disabled ? undefined : `Opens ${translate(report.titleKey)}`}
        onPress={disabled ? undefined : () => openReport(report.key)}
        style={[
          styles.reportCard,
          report.primary ? styles.reportCardPrimary : styles.reportCardSecondary,
          disabled && styles.reportCardDisabled,
        ]}
        ContentComponent={
          <View style={styles.reportCardInner}>
            <View style={[styles.iconCircle, { backgroundColor: report.accent }]}>
              <Ionicons name={report.icon} size={report.primary ? 24 : 20} color={report.iconColor} />
            </View>
            <View style={styles.reportTextBlock}>
              <Text
                style={[styles.reportTitle, report.primary ? undefined : styles.reportTitleSecondary]}
                text={translate(report.titleKey)}
              />
              {report.hintKey ? (
                <Text style={styles.reportHint} text={translate(report.hintKey)} />
              ) : null}
            </View>
          </View>
        }
      />
    )
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      testID="reports-screen"
      accessibilityLabel="reports-screen"
    >
      {!clientPickerHidden ? (
        <View style={styles.clientSelector}>
          <Text style={styles.selectorLabel}>{translate("reportsScreen.selectClient")}</Text>
          <Pressable
            style={styles.clientPicker}
            onPress={() => setShowClientPicker(true)}
            testID="client-picker-button"
            accessibilityRole="button"
            accessibilityLabel={
              selectedClient
                ? `Selected client: ${selectedClient.name}`
                : translate("reportsScreen.chooseClient") || "Choose client"
            }
          >
            <Text style={styles.clientPickerText}>
              {selectedClient ? selectedClient.name : translate("reportsScreen.chooseClient")}
            </Text>
            <Ionicons name="chevron-down" size={20} color={colors.palette.neutral600} />
          </Pressable>
        </View>
      ) : selectedClient ? (
        <Text style={styles.singleClientLabel}>{selectedClient.name}</Text>
      ) : null}

      <Text style={styles.intro} tx="reportsScreen.intro" />

      <Text style={styles.sectionLabel} tx="reportsScreen.primarySection" />
      <View style={styles.grid}>{PRIMARY_REPORTS.map(renderReportCard)}</View>

      <Text style={styles.sectionLabelSecondary} tx="reportsScreen.secondarySection" />
      <View style={styles.grid}>{SECONDARY_REPORTS.map(renderReportCard)}</View>

      <Modal
        visible={showClientPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowClientPicker(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowClientPicker(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>{translate("reportsScreen.modalTitle")}</Text>
                <ScrollView style={styles.clientList}>
                  {clients.map((client) => (
                    <Pressable
                      key={client.id}
                      style={[
                        styles.clientItem,
                        selectedClient?.id === client.id && styles.selectedClientItem,
                      ]}
                      onPress={() => {
                        setSelectedClient(client)
                        setShowClientPicker(false)
                      }}
                      testID={`client-option-${client.id}`}
                    >
                      <Text style={styles.clientItemText}>{client.name}</Text>
                      {selectedClient?.id === client.id ? (
                        <Ionicons name="checkmark" size={20} color={colors.palette.primary500} />
                      ) : null}
                    </Pressable>
                  ))}
                </ScrollView>
                <Button
                  preset="default"
                  text={translate("reportsScreen.modalCancel")}
                  onPress={() => setShowClientPicker(false)}
                />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </ScrollView>
  )
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      backgroundColor: colors.palette.neutral200,
      flex: 1,
    },
    content: {
      padding: 20,
      paddingBottom: 32,
    },
    clientSelector: {
      marginBottom: 20,
    },
    selectorLabel: {
      color: colors.palette.neutral600,
      fontSize: 13,
      fontWeight: "600",
      marginBottom: 8,
    },
    singleClientLabel: {
      color: colors.palette.neutral600,
      fontSize: 15,
      fontWeight: "600",
      marginBottom: 8,
    },
    intro: {
      color: colors.palette.neutral600,
      fontSize: 15,
      lineHeight: 22,
      marginBottom: 20,
    },
    sectionLabel: {
      color: colors.palette.neutral600,
      fontSize: 13,
      fontWeight: "700",
      letterSpacing: 0.4,
      marginBottom: 10,
      textTransform: "uppercase",
    },
    sectionLabelSecondary: {
      color: colors.palette.neutral500,
      fontSize: 12,
      fontWeight: "600",
      letterSpacing: 0.3,
      marginBottom: 10,
      marginTop: 8,
      textTransform: "uppercase",
    },
    clientPicker: {
      alignItems: "center",
      backgroundColor: colors.palette.neutral100,
      borderColor: colors.palette.neutral300,
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: "row",
      justifyContent: "space-between",
      padding: 14,
    },
    clientPickerText: {
      color: colors.palette.biancaHeader,
      flex: 1,
      fontSize: 16,
    },
    grid: {
      gap: 12,
      marginBottom: 12,
    },
    reportCard: {
      flexDirection: "column",
      marginBottom: 0,
      minHeight: 0,
      padding: 16,
    },
    reportCardPrimary: {
      paddingVertical: 18,
    },
    reportCardSecondary: {
      opacity: 0.95,
      paddingVertical: 14,
    },
    reportCardDisabled: {
      opacity: 0.55,
    },
    reportCardInner: {
      alignItems: "center",
      flexDirection: "row",
      gap: 14,
    },
    iconCircle: {
      alignItems: "center",
      borderRadius: 12,
      height: 44,
      justifyContent: "center",
      width: 44,
    },
    reportTextBlock: {
      flex: 1,
      gap: 2,
    },
    reportTitle: {
      color: colors.palette.biancaHeader,
      fontSize: 17,
      fontWeight: "700",
    },
    reportTitleSecondary: {
      fontSize: 15,
      fontWeight: "600",
    },
    reportHint: {
      color: colors.palette.neutral500,
      fontSize: 13,
      lineHeight: 18,
    },
    modalOverlay: {
      alignItems: "center",
      backgroundColor: colors.palette.overlay50 || "rgba(15, 23, 42, 0.5)",
      flex: 1,
      justifyContent: "center",
      padding: 20,
    },
    modalContent: {
      backgroundColor: colors.palette.neutral100,
      borderRadius: 16,
      maxHeight: "80%",
      maxWidth: 400,
      padding: 20,
      width: "100%",
    },
    modalTitle: {
      color: colors.palette.biancaHeader,
      fontSize: 18,
      fontWeight: "700",
      marginBottom: 16,
      textAlign: "center",
    },
    clientList: {
      marginBottom: 16,
      maxHeight: 300,
    },
    clientItem: {
      alignItems: "center",
      backgroundColor: colors.palette.neutral200,
      borderRadius: 12,
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 8,
      padding: 12,
    },
    selectedClientItem: {
      backgroundColor: colors.palette.primary100,
      borderColor: colors.palette.primary500,
      borderWidth: 1,
    },
    clientItemText: {
      color: colors.palette.biancaHeader,
      flex: 1,
      fontSize: 16,
    },
  })
