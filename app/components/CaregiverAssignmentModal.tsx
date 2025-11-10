import React, { useState, useEffect } from "react"
import {
  Modal,
  View,
  ScrollView,
  StyleSheet,
  Switch,
  ActivityIndicator,
} from "react-native"
import { useSelector } from "react-redux"
import { Button, Text } from "./"
import { translate } from "../i18n"
import {
  useGetCaregiversQuery,
  useAssignCaregiverMutation,
  useUnassignCaregiverMutation,
} from "../services/api/patientApi"
import { useGetAllCaregiversQuery } from "../services/api/caregiverApi"
import { Patient, Caregiver } from "../services/api/api.types"
import { RootState } from "../store/store"
import { logger } from "../utils/logger"
import { useTheme } from "../theme/ThemeContext"

interface CaregiverAssignmentModalProps {
  patient: Patient
  isVisible: boolean
  onClose: () => void
}

export const CaregiverAssignmentModal: React.FC<CaregiverAssignmentModalProps> = ({
  patient,
  isVisible,
  onClose,
}) => {
  const { colors, isLoading: themeLoading } = useTheme()
  const [assignedCaregiverIds, setAssignedCaregiverIds] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  
  const currentUser = useSelector((state: RootState) => state.auth.currentUser)
  
  if (themeLoading) {
    return null
  }
  
  const styles = createStyles(colors)
  
  // Check if user has permission to manage caregivers
  const canManageCaregivers = currentUser?.role === 'orgAdmin' || currentUser?.role === 'superAdmin'
  
  // Fetch current caregivers for this patient
  // Skip if user doesn't have permission or patient doesn't have an ID
  const { data: currentCaregivers, isLoading: isLoadingCurrent } = useGetCaregiversQuery(
    { patientId: patient.id! },
    { skip: !patient.id || !canManageCaregivers }
  )
  
  // Fetch all caregivers in the organization
  // Skip if user doesn't have permission or patient doesn't have an org
  const { data: allCaregivers, isLoading: isLoadingAll } = useGetAllCaregiversQuery(
    { org: patient.org! },
    { skip: !patient.org || !canManageCaregivers }
  )
  
  // Mutations for assigning/unassigning caregivers
  const [assignCaregiver] = useAssignCaregiverMutation()
  const [unassignCaregiver] = useUnassignCaregiverMutation()
  
  // Update assigned caregiver IDs when current caregivers data loads
  useEffect(() => {
    if (currentCaregivers) {
      setAssignedCaregiverIds(currentCaregivers.map(cg => cg.id!).filter(Boolean))
    }
  }, [currentCaregivers])
  
  const handleToggleCaregiver = async (caregiverId: string, isCurrentlyAssigned: boolean) => {
    if (isLoading) return // Prevent multiple simultaneous operations
    
    setIsLoading(true)
    try {
      if (isCurrentlyAssigned) {
        await unassignCaregiver({ patientId: patient.id!, caregiverId }).unwrap()
        setAssignedCaregiverIds(prev => prev.filter(id => id !== caregiverId))
      } else {
        await assignCaregiver({ patientId: patient.id!, caregiverId }).unwrap()
        setAssignedCaregiverIds(prev => [...prev, caregiverId])
      }
    } catch (error) {
      logger.error('Error toggling caregiver assignment:', error)
      // Could add a toast notification here for error feedback
    } finally {
      setIsLoading(false)
    }
  }
  
  const isAssigned = (caregiverId: string) => assignedCaregiverIds.includes(caregiverId)
  
  if (isLoadingCurrent || isLoadingAll) {
    const loadingStyles = createStyles(colors)
    return (
      <Modal visible={isVisible} onRequestClose={onClose} transparent>
        <View style={loadingStyles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.palette?.biancaButtonSelected || colors.tint || colors.palette?.primary500} />
          <Text style={loadingStyles.loadingText}>{translate("caregiverScreen.loadingCaregivers")}</Text>
        </View>
      </Modal>
    )
  }
  
  // If user doesn't have permission, show access denied
  if (!canManageCaregivers) {
    return (
      <Modal visible={isVisible} onRequestClose={onClose} animationType="slide">
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Access Denied</Text>
            <Text style={styles.subtitle}>You don't have permission to manage caregivers</Text>
          </View>
          <View style={styles.accessDeniedContainer}>
            <Text style={styles.accessDeniedText}>
              Only organization administrators and super administrators can manage caregiver assignments.
            </Text>
          </View>
          <View style={styles.footer}>
            <Button
              text="Close"
              onPress={onClose}
              preset="primary"
              style={styles.doneButton}
              textStyle={styles.doneButtonText}
              testID="caregiver-assignment-access-denied-close"
            />
          </View>
        </View>
      </Modal>
    )
  }
  
  return (
    <Modal visible={isVisible} onRequestClose={onClose} animationType="slide">
      <View style={styles.container} testID="caregiver-assignment-modal">
        {/* Header */}
        <View style={styles.header} testID="caregiver-assignment-modal-header">
          <Text style={styles.title}>Manage Caregivers</Text>
          <Text style={styles.subtitle}>for {patient.name || 'Unknown Patient'}</Text>
        </View>
        
        {/* Caregiver List */}
        <ScrollView style={styles.caregiverList} showsVerticalScrollIndicator={false} testID="caregiver-assignment-list">
          {allCaregivers?.results?.map((caregiver) => {
            if (!caregiver.id) return null // Skip caregivers without IDs
            return (
              <View key={caregiver.id} style={styles.caregiverItem}>
                <View style={styles.caregiverInfo}>
                  <Text style={styles.caregiverName}>{caregiver.name}</Text>
                  <Text style={styles.caregiverDetails}>
                    {caregiver.role} • {caregiver.email}
                  </Text>
                  {isAssigned(caregiver.id) && (
                    <Text style={styles.assignedBadge}>Currently Assigned</Text>
                  )}
                </View>
                <Switch
                  value={isAssigned(caregiver.id)}
                  onValueChange={(value) => handleToggleCaregiver(caregiver.id!, isAssigned(caregiver.id))}
                  disabled={isLoading}
                  trackColor={{ 
                    false: colors.palette?.neutral300 || "#CCCCCC", 
                    true: colors.palette?.biancaSuccess || colors.palette?.success500 || "#22C55E"
                  }}
                  // CRITICAL: Thumb should always be white/light for visibility on both dark and light tracks
                  thumbColor="#FFFFFF"
                />
              </View>
            )
          })}
          
          {(!allCaregivers?.results || allCaregivers.results.length === 0) && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No caregivers found in this organization</Text>
            </View>
          )}
        </ScrollView>
        
        {/* Footer */}
        <View style={styles.footer}>
          <Button
            text="Done"
            onPress={onClose}
            preset="primary"
            style={styles.doneButton}
            textStyle={styles.doneButtonText}
            testID="caregiver-assignment-done-button"
          />
        </View>
      </View>
    </Modal>
  )
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.palette?.biancaBackground || colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.palette?.biancaBackground || colors.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textDim || colors.palette?.neutral600 || "#666666",
  },
  header: {
    backgroundColor: colors.palette?.neutral100 || colors.background,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.palette?.biancaBorder || colors.border || "#E2E8F0",
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    color: colors.palette?.biancaHeader || colors.text || "#000000",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: colors.textDim || colors.palette?.neutral600 || "#666666",
    textAlign: "center",
    marginTop: 4,
  },
  caregiverList: {
    flex: 1,
    padding: 16,
  },
  caregiverItem: {
    backgroundColor: colors.palette?.neutral100 || colors.background,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: colors.palette?.neutral900 || "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  caregiverInfo: {
    flex: 1,
    marginRight: 16,
  },
  caregiverName: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.palette?.biancaHeader || colors.text || "#000000",
    marginBottom: 4,
  },
  caregiverDetails: {
    fontSize: 14,
    color: colors.textDim || colors.palette?.neutral600 || "#666666",
    marginBottom: 4,
  },
  assignedBadge: {
    fontSize: 12,
    color: colors.palette?.biancaSuccess || colors.success || "#22C55E",
    fontWeight: "500",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textDim || colors.palette?.neutral600 || "#666666",
    textAlign: "center",
  },
  footer: {
    backgroundColor: colors.palette?.neutral100 || colors.background,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: colors.palette?.biancaBorder || colors.border || "#E2E8F0",
  },
  doneButton: {
    paddingVertical: 16,
    borderRadius: 8,
    // Button component handles background color automatically based on preset
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    // Button component handles text color automatically based on preset
  },
  accessDeniedContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  accessDeniedText: {
    fontSize: 16,
    color: colors.textDim || colors.palette?.neutral600 || "#666666",
    textAlign: "center",
    lineHeight: 24,
  },
}) 