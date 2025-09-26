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
import { translate } from "app/i18n"

export function CaregiversScreen() {
  const dispatch = useDispatch()
  const navigation = useNavigation<NavigationProp<OrgStackParamList>>()
  const caregivers = useSelector(getCaregivers)
  const currentUser = useSelector(getCurrentUser) as Caregiver | null

  useSyncOrgCaregivers()

  // Everyone should be able to view caregivers (backend handles filtering)
  const isAuthorized = true

  // Debug logging
  console.log('CaregiversScreen Debug:', {
    currentUser: currentUser?.id,
    currentUserRole: currentUser?.role,
    currentUserOrg: currentUser?.org,
    totalCaregivers: caregivers.length,
    caregiverIds: caregivers.map(c => c.id),
    caregiverRoles: caregivers.map(c => ({ id: c.id, role: c.role }))
  })

  // Just display what the backend returns (no frontend filtering)
  const orgCaregivers = caregivers

  console.log('Displaying caregivers:', {
    orgCaregiversCount: orgCaregivers.length,
    includes_current_user: orgCaregivers.some(c => c.id === currentUser?.id)
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

  const renderCaregiver = ({ item }: { item: Caregiver }) => {
    const isInvited = (item.role as string) === "invited"
    
    return (
      <View 
        style={[
          styles.caregiverCard,
          isInvited && styles.invitedCaregiverCard
        ]}
        testID="caregiver-card"
      >
        <View style={styles.caregiverInfo}>
          <AutoImage source={{ uri: item.avatar || "https://www.gravatar.com/avatar/?d=mp" }} style={styles.avatar} />
          <View style={styles.infoTextContainer}>
            <Text style={[
              styles.caregiverName,
              isInvited && styles.invitedCaregiverName
            ]}>
              {item.name}
            </Text>
            {isInvited && (
              <View style={styles.invitedBadge}>
                <Text style={styles.invitedBadgeText}>{translate("caregiversScreen.invited")}</Text>
              </View>
            )}
          </View>
        </View>
        <Pressable
          style={[
            styles.editButton,
            isInvited && styles.invitedEditButton
          ]}
          onPress={() => handleCaregiverPress(item)}
          android_ripple={{ color: colors.palette.biancaButtonSelected }}
          testID="edit-caregiver-button"
        >
          <Text style={styles.editButtonText}>{translate("caregiversScreen.edit")}</Text>
        </Pressable>
      </View>
    )
  }

  const ListEmpty = () => <Text style={styles.noCaregiversText}>{translate("caregiversScreen.noCaregiversFound")}</Text>

  // Show not authorized message (this should rarely happen now)
  if (!isAuthorized) {
    return (
      <View style={styles.container}>
        <View style={styles.notAuthorizedContainer}>
          <Text style={styles.notAuthorizedTitle}>{translate("caregiversScreen.notAuthorized")}</Text>
          <Text style={styles.notAuthorizedText}>
            {translate("caregiversScreen.noPermissionToView")}
          </Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={orgCaregivers}
        keyExtractor={(item, index) => item.id || String(index)}
        renderItem={renderCaregiver}
        contentContainerStyle={styles.listContentContainer}
        ListEmptyComponent={ListEmpty}
      />

      <Pressable style={styles.addButton} onPress={handleAddCaregiver} testID="add-caregiver-button">
        <Text style={styles.addButtonText}>{translate("caregiversScreen.addCaregiver")}</Text>
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
  invitedCaregiverCard: {
    backgroundColor: colors.palette.accent100,
    borderColor: colors.palette.accent400,
    borderWidth: 1,
  },
  invitedCaregiverName: {
    color: colors.palette.accent500,
  },
  invitedEditButton: {
    backgroundColor: colors.palette.accent400,
  },
  listContentContainer: { paddingHorizontal: 16, paddingVertical: 20 },
  noCaregiversText: { color: colors.palette.neutral600, fontSize: 16, marginTop: 20, textAlign: "center" },
  notAuthorizedContainer: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  notAuthorizedText: {
    color: colors.palette.neutral600,
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
  },
  notAuthorizedTitle: {
    color: colors.palette.biancaError,
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
  },
})
