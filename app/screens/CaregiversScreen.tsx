import React, { useState } from 'react'
import { View, Text, StyleSheet, Pressable, FlatList } from 'react-native'
import { AutoImage } from 'app/components'
import { useSelector, useDispatch } from 'react-redux'
import { getCaregivers, setCaregiver } from 'app/store/caregiverSlice'
import { getCurrentUser } from 'app/store/authSlice'
import { Caregiver } from 'app/services/api/api.types'
import { useNavigation, NavigationProp } from '@react-navigation/native'
import { OrgStackParamList } from 'app/navigators/navigationTypes'
import { useSyncOrgCaregivers } from 'app/utils/useSyncOrgCaregivers' // Import your sync hook


export function CaregiversScreen() {
  const dispatch = useDispatch()
  const navigation = useNavigation<NavigationProp<OrgStackParamList>>()
  const caregivers = useSelector(getCaregivers)
  const currentUser = useSelector(getCurrentUser)

  // Call the sync hook at the top so it runs on mount and when dependencies change.
  useSyncOrgCaregivers()

  // Local filter state: "all", "full-time", or "part-time"
  const [filter, setFilter] = useState<'all' | 'full-time' | 'part-time'>('all')

  // Filter caregivers by current user's organization.
  const orgCaregivers = caregivers.filter((cg: Caregiver) => {
    if (currentUser?.org) {
      return cg.org === currentUser.org
    }
    return true
  })

  // Further filter by employment type (if provided)
  const filteredCaregivers = orgCaregivers.filter((cg: Caregiver) => {
    if (filter === 'all') return true
    return cg.employmentType === filter
  })

  const handleCaregiverPress = (caregiver: Caregiver) => {
    dispatch(setCaregiver(caregiver))
    navigation.navigate('Caregiver')
  }

  const renderCaregiver = ({ item }: { item: Caregiver }) => (
    <View style={styles.caregiverCard}>
      <View style={styles.caregiverInfo}>
        <AutoImage source={{ uri: item.avatar }} style={styles.avatar} />
        <Text style={styles.caregiverName}>{item.name}</Text>
      </View>
      <Pressable
        style={styles.editButton}
        onPress={() => handleCaregiverPress(item)}
        android_ripple={{ color: '#2980b9' }}
      >
        <Text style={styles.editButtonText}>Edit</Text>
      </Pressable>
    </View>
  )

  const ListEmpty = () => (
    <Text style={styles.noCaregiversText}>No caregivers found</Text>
  )

  return (
    <View style={styles.container}>
      {/* Filter Row */}
      <View style={styles.filterRow}>
        <Pressable
          style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterButtonText, filter === 'all' && styles.filterButtonTextActive]}>
            All
          </Text>
        </Pressable>
        <Pressable
          style={[styles.filterButton, filter === 'full-time' && styles.filterButtonActive]}
          onPress={() => setFilter('full-time')}
        >
          <Text style={[styles.filterButtonText, filter === 'full-time' && styles.filterButtonTextActive]}>
            Full-Time
          </Text>
        </Pressable>
        <Pressable
          style={[styles.filterButton, filter === 'part-time' && styles.filterButtonActive]}
          onPress={() => setFilter('part-time')}
        >
          <Text style={[styles.filterButtonText, filter === 'part-time' && styles.filterButtonTextActive]}>
            Part-Time
          </Text>
        </Pressable>
      </View>

      {/* Caregivers List */}
      <FlatList
        data={filteredCaregivers}
        keyExtractor={(item, index) => item.id || String(index)}
        renderItem={renderCaregiver}
        contentContainerStyle={styles.listContentContainer}
        ListEmptyComponent={ListEmpty}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ecf0f1',
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    backgroundColor: '#fff',
    marginVertical: 10,
    borderRadius: 6,
    marginHorizontal: 10,
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#ccc',
    borderRadius: 5,
  },
  filterButtonActive: {
    backgroundColor: '#3498db',
  },
  filterButtonText: {
    fontSize: 16,
    color: '#2c3e50',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  listContentContainer: {
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
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
  caregiverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
    backgroundColor: '#bdc3c7',
  },
  caregiverName: {
    fontSize: 16,
    color: '#2c3e50',
    flexShrink: 1,
  },
  editButton: {
    backgroundColor: '#3498db',
    borderRadius: 5,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  noCaregiversText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#7f8c8d',
    marginTop: 20,
  },
})
