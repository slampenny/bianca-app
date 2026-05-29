import React, { useMemo, useState } from "react"
import { View, StyleSheet, ScrollView, Pressable, FlatList } from "react-native"
import { Text, Card } from "app/components"
import { useSelector } from "react-redux"
import { getClient } from "../store/clientSlice"
import { useGetClientOnboardingQuery } from "../services/api/clientApi"
import { useTheme } from "app/theme/ThemeContext"
import { translate, type TxKeyPath } from "../i18n"
import type { OnboardingResponseRow } from "../services/api/api.types"

type DayFlagKey = "safety" | "memory" | "mood" | "distress" | "confusion"

const FLAG_KEYS_ORDER: DayFlagKey[] = ["safety", "memory", "mood", "distress", "confusion"]

const FLAG_LABEL_KEY: Record<DayFlagKey, TxKeyPath> = {
  safety: "clientOnboardingScreen.flag.safety",
  memory: "clientOnboardingScreen.flag.memory",
  mood: "clientOnboardingScreen.flag.mood",
  distress: "clientOnboardingScreen.flag.distress",
  confusion: "clientOnboardingScreen.flag.confusion",
}

function aggregateFlagsForDay(responses: OnboardingResponseRow[]): DayFlagKey[] | null {
  if (!responses.length) return null
  const on = new Set<DayFlagKey>()
  for (const r of responses) {
    if (r.safety_flag) on.add("safety")
    if (r.memory_flag) on.add("memory")
    if (r.mood_flag) on.add("mood")
    if (r.distress_flag) on.add("distress")
    if (r.confusion_flag) on.add("confusion")
  }
  if (on.size === 0) return null
  return FLAG_KEYS_ORDER.filter((k) => on.has(k))
}

export function ClientOnboardingScreen() {
  const client = useSelector(getClient)
  const { colors } = useTheme()
  const [filterDay, setFilterDay] = useState<number | null>(null)
  const clientId = client?.id || ""
  const { data, isLoading, error } = useGetClientOnboardingQuery(
    { clientId, day: filterDay ?? undefined },
    { skip: !clientId },
  )

  const styles = useMemo(() => createStyles(colors), [colors])

  const activeDayFlags = useMemo(() => {
    if (filterDay == null || !data?.responses?.length) return null
    const rowsForDay = data.responses.filter((r) => r.dayNumber === filterDay)
    return aggregateFlagsForDay(rowsForDay)
  }, [filterDay, data?.responses])

  const dayNumbers = useMemo(
    () => data?.journey?.days?.map((d) => d.dayNumber) ?? [1, 2, 3, 4],
    [data?.journey?.days],
  )

  const renderRow = ({ item }: { item: OnboardingResponseRow }) => (
    <Card
      style={styles.rowCard}
      ContentComponent={
        <View>
          <Text style={styles.qId} size="xs">
            {item.questionId}
          </Text>
          <Text style={styles.value} size="sm">
            {typeof item.responseValue === "string"
              ? item.responseValue
              : JSON.stringify(item.responseValue)}
          </Text>
          <Text style={styles.meta} size="xxs">
            {translate("clientOnboardingScreen.day")} {item.dayNumber}
            {item.capturedAt ? ` · ${new Date(item.capturedAt).toLocaleString()}` : ""}
          </Text>
          {(item.safety_flag ||
            item.memory_flag ||
            item.mood_flag ||
            item.distress_flag ||
            item.confusion_flag) && (
            <Text style={styles.flags} size="xxs">
              {[
                item.safety_flag ? "Safety" : null,
                item.memory_flag ? "Memory" : null,
                item.mood_flag ? "Mood" : null,
                item.distress_flag ? "Distress" : null,
                item.confusion_flag ? "Confusion" : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          )}
        </View>
      }
    />
  )

  if (!clientId) {
    return (
      <View style={styles.centered}>
        <Text>{translate("clientOnboardingScreen.noClient")}</Text>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text preset="heading" style={styles.title}>
        {translate("clientOnboardingScreen.title")}
      </Text>
      <Text style={styles.subtitle}>{client?.name}</Text>

      <Text style={styles.filterLabel}>{translate("clientOnboardingScreen.filterByDay")}</Text>
      <View style={styles.dayRow}>
        <Pressable
          onPress={() => setFilterDay(null)}
          style={[styles.dayChip, filterDay === null && styles.dayChipActive]}
        >
          <Text size="xs">{translate("clientOnboardingScreen.allDays")}</Text>
        </Pressable>
        {dayNumbers.map((d) => (
          <Pressable
            key={d}
            onPress={() => setFilterDay(d)}
            style={[styles.dayChip, filterDay === d && styles.dayChipActive]}
          >
            <Text size="xs">{d}</Text>
          </Pressable>
        ))}
      </View>

      {filterDay != null && activeDayFlags != null && activeDayFlags.length > 0 ? (
        <View style={styles.flagSection}>
          <Text style={styles.flagSectionLabel}>
            {translate("clientOnboardingScreen.signalsForDay", { day: String(filterDay) })}
          </Text>
          <View style={styles.flagRow}>
            {activeDayFlags.map((key) => (
              <View key={key} style={[styles.flagChip, styles.flagOn]}>
                <Text size="xxs">{translate(FLAG_LABEL_KEY[key])}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {isLoading && <Text>{translate("clientOnboardingScreen.loading")}</Text>}
      {error && <Text style={styles.err}>{translate("clientOnboardingScreen.error")}</Text>}
      {!isLoading && data && (
        <Text style={styles.count}>
          {translate("clientOnboardingScreen.captureCount", { count: String(data.questionCount) })}
        </Text>
      )}

      <FlatList
        data={data?.responses ?? []}
        keyExtractor={(item, i) => item.id || `${item.questionId}-${i}`}
        renderItem={renderRow}
        scrollEnabled={false}
        ListEmptyComponent={
          !isLoading ? (
            <Text style={styles.empty}>
              {filterDay != null
                ? translate("clientOnboardingScreen.emptyForDay", { day: String(filterDay) })
                : translate("clientOnboardingScreen.emptyAllDays")}
            </Text>
          ) : null
        }
      />
    </ScrollView>
  )
}

function createStyles(colors: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.palette.neutral200 },
    content: { padding: 16, paddingBottom: 48 },
    centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
    title: { marginBottom: 4 },
    subtitle: { color: colors.palette.neutral600, marginBottom: 12 },
    flagSection: { marginTop: 4, marginBottom: 12 },
    flagSectionLabel: {
      color: colors.palette.neutral600,
      fontSize: 13,
      fontWeight: "600",
      marginBottom: 8,
    },
    flagRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    flagChip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.palette.neutral400,
    },
    flagOn: { backgroundColor: colors.palette.angry100 || "#fee2e2" },
    filterLabel: { marginBottom: 8, fontWeight: "600" },
    dayRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
    dayChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.palette.neutral400,
    },
    dayChipActive: { backgroundColor: colors.palette.biancaSubtle || colors.palette.neutral300 },
    count: { marginBottom: 8, color: colors.palette.neutral600 },
    rowCard: { marginBottom: 10 },
    qId: { fontWeight: "700", marginBottom: 4 },
    value: { marginBottom: 4 },
    meta: { color: colors.palette.neutral500 },
    flags: { color: colors.palette.angry500 || "#b91c1c", marginTop: 4 },
    err: { color: colors.palette.error || "#b91c1c", marginBottom: 8 },
    empty: { color: colors.palette.neutral500, marginTop: 16 },
  })
}
