import React from "react"
import { View, StyleSheet, ScrollView, Pressable, TextInput } from "react-native"
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native"
import type { StackNavigationProp } from "@react-navigation/stack"
import type { AlertStackParamList } from "app/navigators/navigationTypes"
import { useSelector, useDispatch } from "react-redux"
import { Text, Button } from "app/components"
import { getAlerts } from "app/store/alertSlice"
import { getCurrentUser } from "app/store/authSlice"
import { useGetAllClientsQuery, useUpdateAlertMutation } from "app/services/api"
import { setClient } from "app/store/clientSlice"
import type { Alert, Client } from "app/services/api/api.types"
import { useTheme } from "app/theme/ThemeContext"
import { translate, TxKeyPath } from "app/i18n"

type Route = RouteProp<AlertStackParamList, "AlertDetail">
type Nav = StackNavigationProp<AlertStackParamList, "AlertDetail">

function detectorLabel(detector?: string): string {
  const d = detector || "unknown"
  const key = `alertDetail.detectors.${d}` as TxKeyPath
  const t = translate(key)
  return t === key ? detector || translate("alertDetail.detectors.unknown" as TxKeyPath) : t
}

export function AlertDetailScreen() {
  const route = useRoute<Route>()
  const navigation = useNavigation<Nav>()
  const dispatch = useDispatch()
  const { alertId } = route.params
  const alerts = useSelector(getAlerts)
  const currentUser = useSelector(getCurrentUser)
  const { colors } = useTheme()
  const styles = createStyles(colors)

  const alert = React.useMemo(() => alerts.find((a) => a.id === alertId), [alerts, alertId])

  const [resolutionDraft, setResolutionDraft] = React.useState("")
  const [resolveError, setResolveError] = React.useState<string | null>(null)
  const [updateAlert, { isLoading: isResolving }] = useUpdateAlertMutation()

  const { data: clientsData } = useGetAllClientsQuery({})

  const client: Client | undefined = React.useMemo(() => {
    if (!alert?.relatedClient || !clientsData?.results) return undefined
    return clientsData.results.find((c) => c.id === alert.relatedClient)
  }, [alert?.relatedClient, clientsData?.results])

  const relatedAlerts = React.useMemo(() => {
    if (!alert?.relatedClient) return []
    return alerts
      .filter((a) => a.relatedClient === alert.relatedClient && a.id !== alert.id)
      .sort((a, b) => {
        const ta = a.relevanceUntil ? new Date(a.relevanceUntil).getTime() : 0
        const tb = b.relevanceUntil ? new Date(b.relevanceUntil).getTime() : 0
        return tb - ta
      })
      .slice(0, 8)
  }, [alerts, alert?.relatedClient, alert?.id])

  const tabNav = navigation.getParent()

  const goConversations = () => {
    if (client) {
      dispatch(setClient(client))
      ;(tabNav as { navigate: (name: string, params?: object) => void } | undefined)?.navigate("Home", {
        screen: "Conversations",
      })
    }
  }

  const goMedicalReport = () => {
    if (!client?.id) return
    ;(tabNav as { navigate: (name: string, params?: object) => void } | undefined)?.navigate("Reports", {
      screen: "MedicalAnalysis",
      params: { clientId: client.id, clientName: client.name },
    })
  }

  const goFraudReport = () => {
    if (!client?.id) return
    ;(tabNav as { navigate: (name: string, params?: object) => void } | undefined)?.navigate("Reports", {
      screen: "FraudAbuseAnalysis",
      params: { clientId: client.id, clientName: client.name },
    })
  }

  const goClientProfile = () => {
    if (client) {
      dispatch(setClient(client))
      ;(tabNav as { navigate: (name: string, params?: object) => void } | undefined)?.navigate("Home", {
        screen: "Client",
      })
    }
  }

  const goConsentCenter = () => {
    if (!client?.id) return
    ;(tabNav as { navigate: (name: string, params?: object) => void } | undefined)?.navigate("Home", {
      screen: "ConsentCenter",
      params: { clientId: client.id, clientName: client.name },
    })
  }

  const showConsentCenterLink =
    (currentUser?.role === "orgAdmin" || currentUser?.role === "superAdmin") && !!client?.id

  const isResolved = Boolean(alert?.resolvedAt && alert?.resolvedByCaregiver)

  const submitResolution = async () => {
    if (!alert?.id) return
    const note = resolutionDraft.trim()
    if (!note) return
    setResolveError(null)
    try {
      await updateAlert({ alertId: alert.id, alert: { resolutionNote: note } }).unwrap()
      setResolutionDraft("")
    } catch (e: unknown) {
      const status =
        typeof e === "object" && e !== null && "status" in e
          ? (e as { status?: number }).status
          : undefined
      setResolveError(
        status === 409
          ? translate("alertDetail.alreadyResolved" as TxKeyPath)
          : translate("alertDetail.resolveError" as TxKeyPath)
      )
    }
  }

  const handleAction = (actionType: string) => {
    switch (actionType) {
      case "review_conversation":
        goConversations()
        break
      case "open_fraud_report":
        goFraudReport()
        break
      case "call_emergency":
        // No in-app dialer contract; staff use device — copy is instructional
        break
      case "notify_care_team":
      case "document":
        goClientProfile()
        break
      default:
        break
    }
  }

  if (!alert) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted} text={translate("alertDetail.notFound" as TxKeyPath)} />
        <Button text={translate("common.back" as TxKeyPath)} onPress={() => navigation.goBack()} preset="default" />
      </View>
    )
  }

  const consent = alert.relatedResidentConsent
  const ev = alert.evidence
  const confPct =
    ev?.confidence != null && Number.isFinite(ev.confidence) ? Math.round(ev.confidence * 100) : null

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      testID="alert-detail-screen"
      accessibilityLabel="alert-detail-screen"
    >
      <Text style={styles.title} text={translate("alertDetail.title" as TxKeyPath)} />

      <Text style={styles.message}>{alert.message}</Text>

      <View style={styles.metaRow}>
        <Text style={styles.meta}>
          {translate("alertScreen.importance")} {alert.importance}
        </Text>
      </View>

      {isResolved && alert.resolvedByCaregiver && alert.resolvedAt ? (
        <View
          style={[styles.card, styles.cardOk]}
          accessibilityRole="text"
          testID="alert-detail-resolution-summary"
          accessibilityLabel="alert-detail-resolution-summary"
        >
          <Text style={styles.cardTitle} text={translate("alertDetail.resolutionHeading" as TxKeyPath)} />
          <Text style={styles.cardBody}>
            {translate("alertDetail.resolutionSummary" as TxKeyPath, {
              name: alert.resolvedByCaregiver.name,
              date: new Date(alert.resolvedAt).toLocaleString(),
              resolution: alert.resolutionNote ?? "",
            })}
          </Text>
        </View>
      ) : (
        <View
          style={styles.card}
          testID="alert-detail-resolution-form"
          accessibilityLabel="alert-detail-resolution-form"
        >
          <Text style={styles.cardTitle} text={translate("alertDetail.resolutionHeading" as TxKeyPath)} />
          <Text style={styles.cardMuted} text={translate("alertDetail.resolutionNoteLabel" as TxKeyPath)} />
          <TextInput
            style={styles.resolutionInput}
            value={resolutionDraft}
            onChangeText={setResolutionDraft}
            placeholder={translate("alertDetail.resolutionPlaceholder" as TxKeyPath)}
            placeholderTextColor={colors.palette.neutral500}
            multiline
            editable={!isResolving}
            testID="alert-detail-resolution-input"
            accessibilityLabel={translate("alertDetail.resolutionNoteLabel" as TxKeyPath)}
          />
          {resolveError ? <Text style={styles.resolveError}>{resolveError}</Text> : null}
          <Button
            text={translate("alertDetail.markResolved" as TxKeyPath)}
            onPress={submitResolution}
            preset="primary"
            style={styles.actionBtn}
            disabled={!resolutionDraft.trim()}
            loading={isResolving}
            testID="alert-detail-resolve-submit"
          />
        </View>
      )}

      {consent ? (
        <View
          style={[styles.card, consent.onFile ? styles.cardOk : styles.cardWarn]}
          accessibilityRole="text"
          accessibilityLabel={translate("alertDetail.consentSectionA11y" as TxKeyPath)}
        >
          <Text style={styles.cardTitle} text={translate("alertDetail.consentHeading" as TxKeyPath)} />
          <Text style={styles.cardBody}>
            {consent.onFile
              ? translate("alertDetail.consentOnFile" as TxKeyPath)
              : translate("alertDetail.consentMissing" as TxKeyPath)}
          </Text>
          {consent.onFile && consent.recordedAt ? (
            <Text style={styles.cardMuted}>
              {translate("alertDetail.consentRecordedAt" as TxKeyPath)}{" "}
              {new Date(consent.recordedAt).toLocaleString()}
            </Text>
          ) : null}
        </View>
      ) : null}

      {ev ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle} text={translate("alertDetail.evidenceHeading" as TxKeyPath)} />
          {ev.snippet ? <Text style={styles.evidenceSnippet}>{ev.snippet}</Text> : null}
          <Text style={styles.cardMuted}>
            {translate("alertDetail.detectorLabel" as TxKeyPath)} {detectorLabel(ev.detector)}
          </Text>
          {confPct != null ? (
            <Text style={styles.cardMuted}>
              {translate("alertDetail.confidenceLabel" as TxKeyPath)} {confPct}%
            </Text>
          ) : null}
          {ev.conversationId || alert.relatedConversation ? (
            <Button
              text={translate("alertDetail.viewConversation" as TxKeyPath)}
              onPress={goConversations}
              preset="primary"
              style={styles.actionBtn}
              disabled={!client}
            />
          ) : null}
        </View>
      ) : null}

      {alert.recommendedActions && alert.recommendedActions.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle} text={translate("alertDetail.nextStepsHeading" as TxKeyPath)} />
          {alert.recommendedActions.map((a) => (
            <Pressable
              key={a.id}
              onPress={() => handleAction(a.actionType)}
              style={styles.actionRow}
              accessibilityRole="button"
            >
              <Text style={styles.actionText}>
                {translate(a.labelKey as TxKeyPath)}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle} text={translate("alertDetail.contextHeading" as TxKeyPath)} />
        <Button
          text={translate("alertDetail.openClient" as TxKeyPath)}
          onPress={goClientProfile}
          preset="default"
          style={styles.actionBtn}
          disabled={!client}
        />
        <Button
          text={translate("alertDetail.openHealthReport" as TxKeyPath)}
          onPress={goMedicalReport}
          preset="default"
          style={styles.actionBtn}
          disabled={!client}
        />
        <Button
          text={translate("alertDetail.openRiskReport" as TxKeyPath)}
          onPress={goFraudReport}
          preset="default"
          style={styles.actionBtn}
          disabled={!client}
        />
        {showConsentCenterLink ? (
          <Button
            text={translate("alertDetail.openConsentCenter" as TxKeyPath)}
            onPress={goConsentCenter}
            preset="default"
            style={styles.actionBtn}
          />
        ) : null}
      </View>

      {relatedAlerts.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle} text={translate("alertDetail.relatedAlertsHeading" as TxKeyPath)} />
          {relatedAlerts.map((a) => (
            <Pressable
              key={a.id}
              onPress={() => navigation.navigate("AlertDetail", { alertId: a.id! })}
              style={styles.relatedRow}
            >
              <Text style={styles.relatedMessage} numberOfLines={2}>
                {a.message}
              </Text>
              <Text style={styles.relatedMeta}>{a.importance}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </ScrollView>
  )
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    actionBtn: { marginTop: 8, alignSelf: "stretch" },
    actionRow: {
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.palette.neutral300,
    },
    actionText: { color: colors.palette.primary500, fontSize: 15, fontWeight: "600" },
    card: {
      backgroundColor: colors.palette.neutral100,
      borderRadius: 8,
      padding: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.palette.neutral300,
    },
    cardBody: { color: colors.palette.biancaHeader, fontSize: 14, marginTop: 4 },
    cardMuted: { color: colors.palette.neutral600, fontSize: 13, marginTop: 6 },
    cardOk: { borderColor: colors.palette.success500 || colors.palette.neutral300 },
    cardTitle: { fontSize: 15, fontWeight: "700", color: colors.palette.biancaHeader },
    cardWarn: { borderColor: colors.palette.warning500 || colors.palette.neutral400 },
    centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
    container: { flex: 1, backgroundColor: colors.palette.biancaBackground },
    content: { padding: 16, paddingBottom: 32 },
    evidenceSnippet: {
      color: colors.palette.biancaHeader,
      fontSize: 14,
      marginTop: 8,
      fontStyle: "italic",
    },
    message: { fontSize: 16, color: colors.palette.biancaHeader, marginTop: 8, lineHeight: 22 },
    meta: { color: colors.palette.neutral600, fontSize: 14 },
    metaRow: { marginTop: 8 },
    muted: { color: colors.palette.neutral600, marginBottom: 16 },
    relatedMessage: { flex: 1, color: colors.palette.biancaHeader, fontSize: 14 },
    relatedMeta: { color: colors.palette.neutral600, fontSize: 12, marginLeft: 8 },
    relatedRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.palette.neutral300,
    },
    title: { fontSize: 18, fontWeight: "700", color: colors.palette.biancaHeader },
    resolutionInput: {
      marginTop: 8,
      minHeight: 88,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.palette.neutral300,
      borderRadius: 8,
      backgroundColor: colors.palette.neutral200,
      color: colors.palette.biancaHeader,
      fontSize: 15,
      textAlignVertical: "top",
    },
    resolveError: { color: colors.palette.error500 || "#c00", fontSize: 14, marginTop: 8 },
  })
