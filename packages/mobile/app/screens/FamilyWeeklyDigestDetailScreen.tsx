import React from "react"
import { ScrollView, StyleSheet, View } from "react-native"
import { RouteProp, useRoute } from "@react-navigation/native"
import { Text, Card } from "app/components"
import { useTheme } from "app/theme/ThemeContext"
import { translate } from "../i18n"
import { useGetFamilyWeeklyDigestQuery } from "../services/api/familyWeeklyDigestApi"
import type { ReportsStackParamList } from "../navigators/navigationTypes"

export function FamilyWeeklyDigestDetailScreen() {
  const route = useRoute<RouteProp<ReportsStackParamList, "FamilyWeeklyDigestDetail">>()
  const { digestId } = route.params
  const { colors } = useTheme()
  const { data, isLoading, isError } = useGetFamilyWeeklyDigestQuery({ digestId }, { skip: !digestId })

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.palette.biancaBackground, padding: 16 },
    section: { marginBottom: 16 },
    meta: { color: colors.palette.neutral600, fontSize: 14, marginTop: 4 },
  })

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text>{translate("common.loading")}</Text>
      </View>
    )
  }

  if (isError || !data) {
    return (
      <View style={styles.container}>
        <Text>{translate("familyDigests.loadError")}</Text>
      </View>
    )
  }

  const payload = data.payload

  return (
    <ScrollView style={styles.container} testID="family-weekly-digest-detail">
      <Text preset="heading">{payload?.title ?? translate("familyDigests.title")}</Text>
      <Text style={styles.meta}>{payload?.atAGlance?.weekRangeLabel}</Text>
      <View style={styles.section}>
        <Text preset="bold">{translate("familyDigests.weekAtAGlance")}</Text>
        <Text style={styles.meta}>
          {translate("familyDigests.callsSummary", {
            placed: payload?.atAGlance?.callsPlaced ?? 0,
            answered: payload?.atAGlance?.answeredCount ?? 0,
          })}
        </Text>
      </View>
      {(payload?.callRows ?? []).map((row, index) => (
        <Card key={`${row.dayLabel}-${index}`} style={{ marginBottom: 8 }}>
          <Text preset="bold">
            {row.dayLabel} {row.dateLabel}
          </Text>
          <Text style={styles.meta}>{row.connected ? translate("familyDigests.connected") : translate("familyDigests.missed")}</Text>
          <Text>{row.summary}</Text>
        </Card>
      ))}
    </ScrollView>
  )
}
