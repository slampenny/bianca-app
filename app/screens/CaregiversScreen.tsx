import React, { useState } from 'react'
import { View, Text, StyleSheet, Pressable, FlatList } from 'react-native'
import { AutoImage } from 'app/components'
import { useSelector, useDispatch } from 'react-redux'
import { getCaregivers, setCaregiver, clearCaregiver } from 'app/store/caregiverSlice'
import { getCurrentUser } from 'app/store/authSlice'
import { Caregiver } from 'app/services/api/api.types'
import { useNavigation, NavigationProp } from '@react-navigation/native'
import { OrgStackParamList } from 'app/navigators/navigationTypes'
import { useSyncOrgCaregivers } from 'app/utils/useSyncOrgCaregivers'

export function CaregiversScreen() {
  const dispatch = useDispatch()
  const navigation = useNavigation<NavigationProp<OrgStackParamList>>()
  const caregivers = useSelector(getCaregivers)
  const currentUser = useSelector(getCurrentUser)

  useSyncOrgCaregivers()

  const [filter, setFilter] = useState<'all' | 'full-time' | 'part-time'>('all')

  const orgCaregivers = caregivers.filter((cg: Caregiver) => {
    if (currentUser?.org) {
      return cg.org === currentUser.org
    }
    return true
  })

  const filteredCaregivers = orgCaregivers.filter((cg: Caregiver) => {
    if (filter === 'all') return true
    return cg.employmentType === filter
  })

  const handleCaregiverPress = (caregiver: Caregiver) => {
    dispatch(setCaregiver(caregiver))
    navigation.navigate('Caregiver')
  }

  const handleAddCaregiver = () => {
    // Clear any existing caregiver so the invite form starts fresh.
    dispatch(clearCaregiver())
    navigation.navigate('Caregiver')
  }

  const renderCaregiver = ({ item }: { item: Caregiver }) => (
    <View style={styles.caregiverCard}>
      <View style={styles.caregiverInfo}>
        <AutoImage source={{ uri: item.avatar }} style={styles.avatar} />
        <View style={styles.infoTextContainer}>
          <Text style={styles.caregiverName}>{item.name}</Text>
          {item.role === 'invited' && (
            <View style={styles.invitedBadge}>
              <Text style={styles.invitedBadgeText}>Invited</Text>
            </View>
          )}
        </View>
      </View>
      <Pressable style={styles.editButton} onPress={() => handleCaregiverPress(item)} android_ripple={{ color: '#2980b9' }}>
        <Text style={styles.editButtonText}>Edit</Text>
      </Pressable>
    </View>
  )

  const ListEmpty = () => <Text style={styles.noCaregiversText}>No caregivers found</Text>

  return (
    <View style={styles.container}>
      <View style={styles.filterRow}>
        <Pressable style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]} onPress={() => setFilter('all')}>
          <Text style={[styles.filterButtonText, filter === 'all' && styles.filterButtonTextActive]}>All</Text>
        </Pressable>
        <Pressable style={[styles.filterButton, filter === 'full-time' && styles.filterButtonActive]} onPress={() => setFilter('full-time')}>
          <Text style={[styles.filterButtonText, filter === 'full-time' && styles.filterButtonTextActive]}>Full-Time</Text>
        </Pressable>
        <Pressable style={[styles.filterButton, filter === 'part-time' && styles.filterButtonActive]} onPress={() => setFilter('part-time')}>
          <Text style={[styles.filterButtonText, filter === 'part-time' && styles.filterButtonTextActive]}>Part-Time</Text>
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
  container: { flex: 1, backgroundColor: '#ecf0f1' },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    backgroundColor: '#fff',
    marginVertical: 10,
    borderRadius: 6,
    marginHorizontal: 10,
  },
  filterButton: { paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#ccc', borderRadius: 5 },
  filterButtonActive: { backgroundColor: '#3498db' },
  filterButtonText: { fontSize: 16, color: '#2c3e50' },
  filterButtonTextActive: { color: '#fff' },
  listContentContainer: { paddingVertical: 20, paddingHorizontal: 16 },
  caregiverCard: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    padding: 16,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  caregiverInfo: { flexDirection: 'row', alignItems: 'center' },
  infoTextContainer: { flexDirection: 'column' },
  avatar: { width: 48, height: 48, borderRadius: 24, marginRight: 12, backgroundColor: '#bdc3c7' },
  caregiverName: { fontSize: 16, color: '#2c3e50', flexShrink: 1 },
  invitedBadge: { backgroundColor: '#f39c12', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 2, marginTop: 4, alignSelf: 'flex-start' },
  invitedBadgeText: { color: '#fff', fontSize: 12 },
  editButton: { backgroundColor: '#3498db', borderRadius: 5, paddingVertical: 10, paddingHorizontal: 16 },
  editButtonText: { color: '#fff', fontSize: 16 },
  noCaregiversText: { textAlign: 'center', fontSize: 16, color: '#7f8c8d', marginTop: 20 },
  addButton: { backgroundColor: '#2ecc71', paddingVertical: 16, alignItems: 'center', margin: 16, borderRadius: 6 },
  addButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
})