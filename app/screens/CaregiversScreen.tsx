import React, { useState } from "react"
import { View, Text, StyleSheet, Pressable, FlatList } from "react-native"
import { AutoImage } from "app/components"
import { useSelector, useDispatch } from "react-redux"
import { getCaregivers, setCaregiver, clearCaregiver } from "app/store/caregiverSlice"
import { getCurrentUser } from "app/store/authSlice"
import { Caregiver } from "app/services/api/api.types"
import { useNavigation, NavigationProp } from "@react-navigation/native"
import { OrgStackParamList } from "app/navigators/navigationTypes"
import { useSyncOrgCaregivers } from "app/utils/useSyncOrgCaregivers"
import { colors } from "app/theme/colors"

export function CaregiversScreen() {
  const dispatch = useDispatch()
  const navigation = useNavigation<NavigationProp<OrgStackParamList>>()
  const caregivers = useSelector(getCaregivers)
  const currentUser = useSelector(getCurrentUser) as Caregiver | null

  useSyncOrgCaregivers()

  const [filter, setFilter] = useState<"all" | "full-time" | "part-time">("all")

  // Check if user is authorized to view caregivers (orgAdmin role)
  const isAuthorized = currentUser?.role === 'orgAdmin'

  const orgCaregivers = caregivers.filter((cg: Caregiver) => {
    if (currentUser?.org) {
      return cg.org === currentUser.org
    }
    return true
  })

  const filteredCaregivers = orgCaregivers.filter((cg: Caregiver) => {
    if (filter === "all") return true
    return (cg as any).employmentType === filter
  })

  const handleCaregiverPress = (caregiver: Caregiver) => {
    dispatch(setCaregiver(caregiver))
    navigation.navigate("Caregiver")
  }

  const handleAddCaregiver = () => {
    // Clear any existing caregiver so the invite form starts fresh.
    dispatch(clearCaregiver())
    navigation.navigate("Caregiver")
  }

  const renderCaregiver = ({ item }: { item: Caregiver }) => (
    <View style={styles.caregiverCard}>
      <View style={styles.caregiverInfo}>
        <AutoImage source={{ uri: item.avatar || "https://www.gravatar.com/avatar/?d=mp" }} style={styles.avatar} />
        <View style={styles.infoTextContainer}>
          <Text style={styles.caregiverName}>{item.name}</Text>
          {(item.role as string) === "invited" && (
            <View style={styles.invitedBadge}>
              <Text style={styles.invitedBadgeText}>Invited</Text>
            </View>
          )}
        </View>
      </View>
      <Pressable
        style={styles.editButton}
        onPress={() => handleCaregiverPress(item)}
        android_ripple={{ color: colors.palette.biancaButtonSelected }}
      >
        <Text style={styles.editButtonText}>Edit</Text>
      </Pressable>
    </View>
  )

  const ListEmpty = () => <Text style={styles.noCaregiversText}>No caregivers found</Text>

  // Show not authorized message for non-admin users
  if (!isAuthorized) {
    return (
      <View style={styles.container}>
        <View style={styles.notAuthorizedContainer}>
          <Text style={styles.notAuthorizedTitle}>Not Authorized</Text>
          <Text style={styles.notAuthorizedText}>
            You don't have permission to view caregivers. Only organization administrators can access this feature.
          </Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.filterRow}>
        <Pressable
          style={[styles.filterButton, filter === "all" ? styles.filterButtonActive : undefined]}
          onPress={() => setFilter("all")}
        >
          <Text
            style={[styles.filterButtonText, filter === "all" ? styles.filterButtonTextActive : undefined]}
          >
            All
          </Text>
        </Pressable>
        <Pressable
          style={[styles.filterButton, filter === "full-time" ? styles.filterButtonActive : undefined]}
          onPress={() => setFilter("full-time")}
        >
          <Text
            style={[
              styles.filterButtonText,
              filter === "full-time" ? styles.filterButtonTextActive : undefined,
            ]}
          >
            Full-Time
          </Text>
        </Pressable>
        <Pressable
          style={[styles.filterButton, filter === "part-time" ? styles.filterButtonActive : undefined]}
          onPress={() => setFilter("part-time")}
        >
          <Text
            style={[
              styles.filterButtonText,
              filter === "part-time" ? styles.filterButtonTextActive : undefined,
            ]}
          >
            Part-Time
          </Text>
        </Pressable>
      </View>

      <FlatList
        data={filteredCaregivers}
        keyExtractor={(item, index) => item.id || String(index)}
        renderItem={renderCaregiver}
        contentContainerStyle={styles.listContentContainer}
        ListEmptyComponent={ListEmpty}
      />

      <Pressable style={styles.addButton} onPress={handleAddCaregiver}>
        <Text style={styles.addButtonText}>Add Caregiver</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  addButton: {
    alignItems: "center",
    backgroundColor: colors.palette.biancaSuccess,
    borderRadius: 6,
    margin: 16,
    paddingVertical: 16,
  },
  addButtonText: { color: colors.palette.neutral100, fontSize: 18, fontWeight: "600" },
  avatar: { backgroundColor: colors.palette.neutral300, borderRadius: 24, height: 48, marginRight: 12, width: 48 },
  caregiverCard: {
    alignItems: "center",
    backgroundColor: colors.palette.neutral100,
    borderRadius: 6,
    elevation: 2,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    padding: 16,
    shadowColor: colors.palette.neutral900,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  caregiverInfo: { alignItems: "center", flexDirection: "row" },
  caregiverName: { color: colors.palette.biancaHeader, flexShrink: 1, fontSize: 16 },
  container: { backgroundColor: colors.palette.biancaBackground, flex: 1 },
  editButton: {
    backgroundColor: colors.palette.biancaButtonSelected,
    borderRadius: 5,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  editButtonText: { color: colors.palette.neutral100, fontSize: 16 },
  filterButton: {
    backgroundColor: colors.palette.neutral400,
    borderRadius: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterButtonActive: { backgroundColor: colors.palette.biancaButtonSelected },
  filterButtonText: { color: colors.palette.biancaHeader, fontSize: 16 },
  filterButtonTextActive: { color: colors.palette.neutral100 },
  filterRow: {
    backgroundColor: colors.palette.neutral100,
    borderRadius: 6,
    flexDirection: "row",
    justifyContent: "space-around",
    marginHorizontal: 10,
    marginVertical: 10,
    paddingVertical: 10,
  },
  infoTextContainer: { flexDirection: "column" },
  invitedBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.palette.accent400,
    borderRadius: 4,
    marginTop: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  invitedBadgeText: { color: colors.palette.neutral100, fontSize: 12 },
  listContentContainer: { paddingHorizontal: 16, paddingVertical: 20 },
  noCaregiversText: { color: colors.palette.neutral600, fontSize: 16, marginTop: 20, textAlign: "center" },
  notAuthorizedContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  notAuthorizedTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.palette.biancaError,
    marginBottom: 16,
    textAlign: "center",
  },
  notAuthorizedText: {
    fontSize: 16,
    color: colors.palette.neutral600,
    textAlign: "center",
    lineHeight: 24,
  },
})
