import React from "react"
import { FlatList, Pressable, StyleSheet, View } from "react-native"
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native"
import { Text, Card } from "app/components"
import { useTheme } from "app/theme/ThemeContext"
import { translate } from "../i18n"
import { useListFamilyWeeklyDigestsQuery } from "../services/api/familyWeeklyDigestApi"
import type { ReportsStackParamList } from "../navigators/navigationTypes"

export function FamilyWeeklyDigestsScreen() {
  const navigation = useNavigation()
  const route = useRoute<RouteProp<ReportsStackParamList, "FamilyWeeklyDigests">>()
  const clientId = route.params?.clientId ?? ""
  const clientName = route.params?.clientName
  const { colors } = useTheme()
  const { data, isLoading, isError } = useListFamilyWeeklyDigestsQuery(
    { clientId, limit: 20, page: 1 },
    { skip: !clientId },
  )

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.palette.biancaBackground, padding: 16 },
    row: { marginBottom: 12 },
    meta: { color: colors.palette.neutral600, fontSize: 13, marginTop: 4 },
  })

  if (!clientId) {
    return (
      <View style={styles.container}>
        <Text>{translate("familyDigests.selectClient")}</Text>
      </View>
    )
  }

  return (
    <View style={styles.container} testID="family-weekly-digests-screen">
      {clientName ? (
        <Text style={styles.meta} testID="family-digest-client-name">
          {clientName}
        </Text>
      ) : null}
      <Text preset="heading" style={{ marginBottom: 12 }}>
        {translate("familyDigests.title")}
      </Text>
      {isLoading ? <Text>{translate("common.loading")}</Text> : null}
      {isError ? <Text>{translate("familyDigests.loadError")}</Text> : null}
      <FlatList
        data={data?.results ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            testID={`family-weekly-digest-row-${item.id}`}
            onPress={() =>
              (navigation as { navigate: (name: string, params: object) => void }).navigate(
                "FamilyWeeklyDigestDetail",
                { digestId: item.id, clientId },
              )
            }
          >
            <Card>
              <Text preset="bold">{item.payload?.atAGlance?.weekRangeLabel ?? item.localWeekKey}</Text>
              <Text style={styles.meta}>
                {translate("familyDigests.callsSummary", {
                  placed: item.payload?.atAGlance?.callsPlaced ?? 0,
                  answered: item.payload?.atAGlance?.answeredCount ?? 0,
                })}
              </Text>
            </Card>
          </Pressable>
        )}
        ListEmptyComponent={
          !isLoading ? <Text style={styles.meta}>{translate("familyDigests.empty")}</Text> : null
        }
      />
    </View>
  )
}
