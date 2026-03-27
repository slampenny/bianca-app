import React, { useCallback, useEffect, useMemo, useState } from "react"
import {
  View,
  ScrollView,
  StyleSheet,
  Platform,
  Pressable,
  ActivityIndicator,
  Share,
} from "react-native"
import { useRoute, RouteProp } from "@react-navigation/native"
import * as FileSystem from "expo-file-system"
import * as Sharing from "expo-sharing"
import { Text, Button } from "app/components"
import { useTheme } from "app/theme/ThemeContext"
import { translate, TxKeyPath } from "app/i18n"
import { useSelector } from "react-redux"
import { getCurrentUser, getAuthTokens } from "app/store/authSlice"
import { getOrg } from "app/store/orgSlice"
import { useGetConsentAuditQuery, useGetAllClientsQuery, useGetAllOrgsQuery } from "app/services/api"
import { getDefaultApiConfig } from "app/services/api/api"
import type { HomeStackParamList } from "app/navigators/navigationTypes"
import { logger } from "app/utils/logger"
import type { ConsentAuditRow } from "app/services/api/privacyApi"
import type { ThemeColors } from "../types"

type AuditScope = "org" | "all"

function buildConsentAuditQueryParams(args: {
  filterClientId?: string
  auditScope: AuditScope
  selectedOrgId?: string
  isSuperAdmin: boolean
}) {
  const { filterClientId, auditScope, selectedOrgId, isSuperAdmin } = args
  const base: {
    clientId?: string
    page: number
    limit: number
    orgId?: string
    allOrganizations?: boolean
  } = {
    page: 1,
    limit: 50,
    ...(filterClientId ? { clientId: filterClientId } : {}),
  }
  if (!isSuperAdmin) return base
  if (auditScope === "all") return { ...base, allOrganizations: true }
  if (selectedOrgId) return { ...base, orgId: selectedOrgId }
  return base
}

export function ConsentCenterScreen() {
  const route = useRoute<RouteProp<HomeStackParamList, "ConsentCenter">>()
  const { colors } = useTheme()
  const styles = useMemo(() => createStyles(colors as ThemeColors), [colors])
  const user = useSelector(getCurrentUser)
  const tokens = useSelector(getAuthTokens)
  const reduxOrg = useSelector(getOrg)
  const canAccess = user?.role === "orgAdmin" || user?.role === "superAdmin"
  const isSuperAdmin = user?.role === "superAdmin"
  const [filterClientId, setFilterClientId] = useState<string | undefined>(route.params?.clientId)
  const [auditScope, setAuditScope] = useState<AuditScope>("org")
  const [selectedOrgId, setSelectedOrgId] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (route.params?.clientId) {
      setFilterClientId(route.params?.clientId)
    }
  }, [route.params?.clientId])

  const { data: orgsData } = useGetAllOrgsQuery({ limit: 200, page: 1 }, { skip: !isSuperAdmin })

  useEffect(() => {
    if (!isSuperAdmin) return
    if (selectedOrgId) return
    const fromRedux = reduxOrg?.id
    if (fromRedux) {
      setSelectedOrgId(fromRedux)
      return
    }
    const first = orgsData?.results?.[0]?.id
    if (first) setSelectedOrgId(first)
  }, [isSuperAdmin, selectedOrgId, reduxOrg?.id, orgsData?.results])

  const auditQueryArgs = useMemo(
    () =>
      buildConsentAuditQueryParams({
        filterClientId,
        auditScope,
        selectedOrgId,
        isSuperAdmin,
      }),
    [filterClientId, auditScope, selectedOrgId, isSuperAdmin],
  )

  const skipAudit =
    !canAccess || (isSuperAdmin && auditScope === "org" && !selectedOrgId)

  const { data: clientsData } = useGetAllClientsQuery({ limit: 200, page: 1 }, { skip: !canAccess })
  const { data, isLoading, error, refetch, isFetching } = useGetConsentAuditQuery(auditQueryArgs, {
    skip: skipAudit,
  })

  const appendExportQuery = useCallback(
    (q: URLSearchParams) => {
      if (filterClientId) q.set("clientId", filterClientId)
      if (isSuperAdmin) {
        if (auditScope === "all") q.set("allOrganizations", "true")
        else if (selectedOrgId) q.set("orgId", selectedOrgId)
      }
    },
    [filterClientId, isSuperAdmin, auditScope, selectedOrgId],
  )

  const exportCsv = useCallback(async () => {
    if (!tokens?.access?.token) return
    try {
      const base = getDefaultApiConfig().url.replace(/\/$/, "")
      const q = new URLSearchParams()
      appendExportQuery(q)
      const url = `${base}/v1/privacy/consent/audit/export?${q.toString()}`
      const res = await fetch(url, { headers: { Authorization: `Bearer ${tokens.access.token}` } })
      const text = await res.text()
      if (!res.ok) throw new Error(text || res.statusText)
      if (Platform.OS === "web" && typeof document !== "undefined") {
        const blob = new Blob([text], { type: "text/csv;charset=utf-8" })
        const a = document.createElement("a")
        a.href = URL.createObjectURL(blob)
        a.download = "consent-audit.csv"
        a.click()
        URL.revokeObjectURL(a.href)
        return
      }
      const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory
      if (dir) {
        const path = `${dir}consent-audit.csv`
        await FileSystem.writeAsStringAsync(path, text, { encoding: FileSystem.EncodingType.UTF8 })
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(path, {
            mimeType: "text/csv",
            dialogTitle: translate("consentCenter.exportFileName" as TxKeyPath),
          })
          return
        }
      }
      await Share.share({
        message: text.length > 8000 ? `${text.slice(0, 8000)}…` : text,
        title: translate("consentCenter.exportFileName" as TxKeyPath),
      })
    } catch (e) {
      logger.error("Consent audit export failed", e)
    }
  }, [tokens?.access?.token, appendExportQuery])

  const exportPdf = useCallback(async () => {
    if (!tokens?.access?.token) return
    try {
      const base = getDefaultApiConfig().url.replace(/\/$/, "")
      const q = new URLSearchParams()
      appendExportQuery(q)
      const url = `${base}/v1/privacy/consent/audit/export/pdf?${q.toString()}`
      if (Platform.OS === "web" && typeof document !== "undefined") {
        const res = await fetch(url, { headers: { Authorization: `Bearer ${tokens.access.token}` } })
        if (!res.ok) {
          const t = await res.text()
          throw new Error(t || res.statusText)
        }
        const blob = await res.blob()
        const a = document.createElement("a")
        a.href = URL.createObjectURL(blob)
        a.download = "consent-audit.pdf"
        a.click()
        URL.revokeObjectURL(a.href)
        return
      }
      const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory
      if (!dir) {
        throw new Error("No writable directory for PDF export")
      }
      const path = `${dir}consent-audit.pdf`
      const result = await FileSystem.downloadAsync(url, path, {
        headers: { Authorization: `Bearer ${tokens.access.token}` },
      })
      if (result.status !== 200) {
        throw new Error(`PDF download failed (${result.status})`)
      }
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(result.uri, {
          mimeType: "application/pdf",
          UTI: "com.adobe.pdf",
          dialogTitle: translate("consentCenter.exportPdfFileName" as TxKeyPath),
        })
      } else {
        await Share.share({ url: result.uri })
      }
    } catch (e) {
      logger.error("Consent audit PDF export failed", e)
    }
  }, [tokens?.access?.token, appendExportQuery])

  if (!canAccess) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={styles.muted} text={translate("consentCenter.adminOnly" as TxKeyPath)} />
      </View>
    )
  }

  return (
    <ScrollView style={[styles.flex, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <Text preset="heading" text={translate("consentCenter.title" as TxKeyPath)} />
      <Text style={styles.subtitle} text={translate("consentCenter.subtitle" as TxKeyPath)} />
      {data?.scopeLabel ? (
        <Text style={styles.scopeLine} text={`${translate("consentCenter.scopeLabel" as TxKeyPath)} ${data.scopeLabel}`} />
      ) : null}

      {isSuperAdmin ? (
        <>
          <Text style={styles.filterLabel} text={translate("consentCenter.auditScopeLabel" as TxKeyPath)} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
            <Pressable
              onPress={() => setAuditScope("org")}
              style={[styles.chip, auditScope === "org" && styles.chipActive]}
            >
              <Text
                style={auditScope === "org" ? styles.chipTextActive : styles.chipText}
                text={translate("consentCenter.scopeSingleOrg" as TxKeyPath)}
              />
            </Pressable>
            <Pressable
              onPress={() => setAuditScope("all")}
              style={[styles.chip, auditScope === "all" && styles.chipActive]}
            >
              <Text
                style={auditScope === "all" ? styles.chipTextActive : styles.chipText}
                text={translate("consentCenter.scopeAllOrgs" as TxKeyPath)}
              />
            </Pressable>
          </ScrollView>
          {auditScope === "org" ? (
            <>
              <Text style={styles.filterLabel} text={translate("consentCenter.orgPickerLabel" as TxKeyPath)} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
                {(orgsData?.results || []).map((o) => (
                  <Pressable
                    key={o.id}
                    onPress={() => setSelectedOrgId(o.id)}
                    style={[styles.chip, selectedOrgId === o.id && styles.chipActive]}
                  >
                    <Text
                      style={selectedOrgId === o.id ? styles.chipTextActive : styles.chipText}
                      text={o.name || o.id}
                    />
                  </Pressable>
                ))}
              </ScrollView>
            </>
          ) : null}
        </>
      ) : null}

      <Text style={styles.filterLabel} text={translate("consentCenter.filterLabel" as TxKeyPath)} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
        <Pressable
          onPress={() => setFilterClientId(undefined)}
          style={[styles.chip, !filterClientId && styles.chipActive]}
        >
          <Text
            style={!filterClientId ? styles.chipTextActive : styles.chipText}
            text={translate("consentCenter.filterAll" as TxKeyPath)}
          />
        </Pressable>
        {(clientsData?.results || []).map((c) => (
          <Pressable
            key={c.id}
            onPress={() => setFilterClientId(c.id)}
            style={[styles.chip, filterClientId === c.id && styles.chipActive]}
          >
            <Text
              style={filterClientId === c.id ? styles.chipTextActive : styles.chipText}
              text={c.name || c.id}
            />
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.actions}>
        <Button
          text={translate("consentCenter.exportCsv" as TxKeyPath)}
          onPress={exportCsv}
          preset="default"
          disabled={!data?.results?.length}
        />
        <Button
          text={translate("consentCenter.exportPdf" as TxKeyPath)}
          onPress={exportPdf}
          preset="default"
          disabled={!data?.results?.length}
        />
        <Button text={translate("alertScreen.refresh" as TxKeyPath)} onPress={() => refetch()} preset="default" />
      </View>

      {skipAudit ? (
        <Text style={styles.muted} text={translate("consentCenter.pickOrg" as TxKeyPath)} />
      ) : isLoading || isFetching ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.palette.primary500} />
          <Text style={styles.muted} text={translate("consentCenter.refreshing" as TxKeyPath)} />
        </View>
      ) : error ? (
        <Text style={styles.warn} text={translate("consentCenter.errorLoad" as TxKeyPath)} />
      ) : !data?.results?.length ? (
        <Text style={styles.muted} text={translate("consentCenter.empty" as TxKeyPath)} />
      ) : (
        data.results.map((row, index) => (
          <AuditRow key={`${row.id || row._id || "row"}-${index}`} row={row} styles={styles} />
        ))
      )}
    </ScrollView>
  )
}

function AuditRow({ row, styles }: { row: ConsentAuditRow; styles: ReturnType<typeof createStyles> }) {
  const kindLabel =
    row.subjectKind === "client"
      ? translate("consentCenter.rowClient" as TxKeyPath)
      : translate("consentCenter.rowStaff" as TxKeyPath)
  const grantedLabel = row.granted
    ? translate("consentCenter.yes" as TxKeyPath)
    : translate("consentCenter.no" as TxKeyPath)
  const when = row.createdAt ? new Date(row.createdAt).toLocaleString() : "—"
  const via = row.explicitConsent?.providedVia || "—"
  const orgLine =
    row.organizationName || row.organizationId
      ? `${translate("consentCenter.rowOrganization" as TxKeyPath)} ${row.organizationName || row.organizationId}`
      : null

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{row.subjectDisplayName}</Text>
      <Text style={styles.cardLine}>
        {kindLabel} · {row.consentType}
      </Text>
      {orgLine ? <Text style={styles.cardMuted}>{orgLine}</Text> : null}
      <Text style={styles.cardMuted}>
        {translate("consentCenter.rowGranted" as TxKeyPath)} {grantedLabel}
      </Text>
      <Text style={styles.cardMuted}>
        {translate("consentCenter.rowMethod" as TxKeyPath)} {row.method}
      </Text>
      <Text style={styles.cardMuted}>
        {translate("consentCenter.rowRecorded" as TxKeyPath)} {when}
      </Text>
      <Text style={styles.cardMuted}>
        {translate("consentCenter.rowVia" as TxKeyPath)} {via}
      </Text>
      <Text style={styles.cardPurpose} numberOfLines={3}>
        {row.purpose}
      </Text>
    </View>
  )
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    flex: { flex: 1 },
    content: { padding: 16, paddingBottom: 48 },
    center: { padding: 24, alignItems: "center", justifyContent: "center" },
    muted: { marginTop: 8, color: colors.text, opacity: 0.7 },
    warn: { marginTop: 12, color: colors.palette.primary500 },
    subtitle: { marginTop: 8, color: colors.text, opacity: 0.75 },
    scopeLine: { marginTop: 6, color: colors.text, opacity: 0.8, fontSize: 13 },
    filterLabel: { marginTop: 16, marginBottom: 8, fontWeight: "600", color: colors.text },
    chipsRow: { flexGrow: 0, marginBottom: 12 },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
      marginRight: 8,
      backgroundColor: colors.palette.neutral100,
      borderWidth: 1,
      borderColor: colors.palette.neutral300,
    },
    chipActive: {
      borderWidth: 2,
      borderColor: colors.palette.primary500,
    },
    chipText: { color: colors.text, fontSize: 14 },
    chipTextActive: { color: colors.palette.primary500, fontWeight: "600", fontSize: 14 },
    actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
    card: {
      padding: 12,
      marginBottom: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.palette.neutral300,
      backgroundColor: colors.palette.neutral100,
    },
    cardTitle: { fontWeight: "700", color: colors.text, fontSize: 16 },
    cardLine: { marginTop: 4, color: colors.text },
    cardMuted: { marginTop: 4, color: colors.text, opacity: 0.75, fontSize: 13 },
    cardPurpose: { marginTop: 8, color: colors.text, opacity: 0.85, fontSize: 13 },
  })
}
