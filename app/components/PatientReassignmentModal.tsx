import React, { useState, useEffect, useRef } from "react"
import {
  Modal,
  View,
  Text,
  ScrollView,
  StyleSheet,
  Switch,
  ActivityIndicator,
} from "react-native"
import { useToast } from "../hooks/useToast"
import Toast from "./Toast"
import ConfirmationModal from "./ConfirmationModal"
import { useSelector } from "react-redux"
import { Button } from "./Button"
import {
  useAssignCaregiverMutation,
} from "../services/api/patientApi"
import { useGetAllCaregiversQuery } from "../services/api/caregiverApi"
import { Patient, Caregiver } from "../services/api/api.types"
import { logger } from "../utils/logger"
import { RootState } from "../store/store"
import { TIMEOUTS } from "../constants"
import { colors } from "../theme/colors"

interface PatientReassignmentModalProps {
  patients: Patient[]
  isVisible: boolean
  onClose: () => void
  onComplete: () => void
  orgId: string
}

export const PatientReassignmentModal: React.FC<PatientReassignmentModalProps> = ({
  patients,
  isVisible,
  onClose,
  onComplete,
  orgId,
}) => {
  const { toast, showError, showSuccess, hideToast } = useToast()
  const [selectedCaregiverId, setSelectedCaregiverId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [reassignedCount, setReassignedCount] = useState(0)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  const currentUser = useSelector((state: RootState) => state.auth.currentUser)
  
  // Fetch all caregivers in the organization (excluding the one being deleted)
  const { data: allCaregivers, isLoading: isLoadingCaregivers } = useGetAllCaregiversQuery(
    { org: orgId },
    { skip: !orgId }
  )
  
  // Mutation for assigning patients to caregivers
  const [assignCaregiver] = useAssignCaregiverMutation()
  
  // Filter out the current user from the list (since they're being deleted)
  const availableCaregivers = allCaregivers?.results?.filter(
    (caregiver: Caregiver) => caregiver.id !== currentUser?.id
  ) || []
  
  // Auto-select the first available caregiver if none selected
  useEffect(() => {
    if (availableCaregivers.length > 0 && !selectedCaregiverId) {
      setSelectedCaregiverId(availableCaregivers[0].id!)
    }
    
    // Cleanup timeout on unmount
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [availableCaregivers, selectedCaregiverId])
  
  const handleReassignAllPatients = async () => {
    if (!selectedCaregiverId || patients.length === 0) {
      showError("Please select a caregiver and ensure there are patients to reassign.")
      return
    }
    
    setIsLoading(true)
    let successCount = 0
    
    try {
      // Reassign each patient to the selected caregiver
      for (const patient of patients) {
        try {
          await assignCaregiver({ 
            patientId: patient.id!, 
            caregiverId: selectedCaregiverId 
          }).unwrap()
          successCount++
        } catch (error) {
          logger.error(`Failed to reassign patient ${patient.name}:`, error)
        }
      }
      
      setReassignedCount(successCount)
      
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      
      if (successCount === patients.length) {
        showSuccess(`All ${successCount} patients have been successfully reassigned.`)
        timeoutRef.current = setTimeout(() => {
          onComplete()
          timeoutRef.current = null
        }, TIMEOUTS.NAVIGATION_DELAY)
      } else {
        showSuccess(`${successCount} out of ${patients.length} patients were reassigned successfully.`)
        timeoutRef.current = setTimeout(() => {
          onComplete()
          timeoutRef.current = null
        }, TIMEOUTS.NAVIGATION_DELAY)
      }
    } catch (error) {
      showError("Failed to reassign patients. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }
  
  const handleCancel = () => {
    if (isLoading) return
    setShowCancelConfirm(true)
  }
  
  if (isLoadingCaregivers) {
    return (
      <Modal visible={isVisible} onRequestClose={onClose} transparent>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.palette.biancaButtonSelected} />
          <Text style={styles.loadingText}>Loading caregivers...</Text>
        </View>
      </Modal>
    )
  }
  
  return (
    <Modal visible={isVisible} onRequestClose={handleCancel} animationType="slide">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Reassign Patients</Text>
          <Text style={styles.subtitle}>
            {patients.length} patient{patients.length !== 1 ? 's' : ''} need{patients.length === 1 ? 's' : ''} to be reassigned
          </Text>
        </View>
        
        {/* Patient List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Patients to Reassign:</Text>
          <ScrollView style={styles.patientList} showsVerticalScrollIndicator={false}>
            {patients.map((patient) => (
              <View key={patient.id} style={styles.patientItem} testID={`patient-item-${patient.name}`}>
                <Text style={styles.patientName}>{patient.name}</Text>
                <Text style={styles.patientDetails}>
                  {patient.email} • {patient.phone}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
        
        {/* Caregiver Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select New Caregiver:</Text>
          <ScrollView style={styles.caregiverList} showsVerticalScrollIndicator={false}>
            {availableCaregivers.map((caregiver: Caregiver) => (
              <View key={caregiver.id} style={styles.caregiverItem} testID={`caregiver-item-${caregiver.name}`}>
                <View style={styles.caregiverInfo}>
                  <Text style={styles.caregiverName}>{caregiver.name}</Text>
                  <Text style={styles.caregiverDetails}>
                    {caregiver.role} • {caregiver.email}
                  </Text>
                </View>
                <Switch
                  value={selectedCaregiverId === caregiver.id}
                  onValueChange={(value) => {
                    if (value) {
                      setSelectedCaregiverId(caregiver.id!)
                    }
                  }}
                  disabled={isLoading}
                  trackColor={{ 
                    false: colors.palette.neutral300, 
                    true: colors.palette.biancaSuccess 
                  }}
                  thumbColor={colors.palette.neutral100}
                  testID={`caregiver-toggle-${caregiver.name}`}
                />
              </View>
            ))}
            
            {availableCaregivers.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No other caregivers available in this organization</Text>
                <Text style={styles.emptySubtext}>
                  You cannot delete this caregiver because there are no other caregivers to reassign their patients to.
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
        
        {/* Footer */}
        <View style={styles.footer}>
          {availableCaregivers.length > 0 ? (
            <>
              <Button
                text={isLoading ? "Reassigning..." : `Reassign All Patients`}
                onPress={handleReassignAllPatients}
                style={[styles.reassignButton, isLoading && styles.buttonDisabled]}
                textStyle={styles.reassignButtonText}
                disabled={isLoading || !selectedCaregiverId}
                testID="patient-reassign-reassign-btn"
              />
              <Button
                text="Cancel"
                onPress={handleCancel}
                style={styles.cancelButton}
                textStyle={styles.cancelButtonText}
                disabled={isLoading}
                testID="patient-reassign-cancel-btn"
              />
            </>
          ) : (
            <Button
              text="Close"
              onPress={onClose}
              style={styles.closeButton}
              textStyle={styles.closeButtonText}
              testID="patient-reassign-close-btn"
            />
          )}
        </View>
      </View>
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={hideToast}
        testID="patient-reassignment-toast"
      />
      <ConfirmationModal
        visible={showCancelConfirm}
        title="Cancel Reassignment"
        message="Are you sure you want to cancel? Patients will remain unassigned."
        confirmText="Cancel"
        cancelText="Continue Reassignment"
        onConfirm={onClose}
        onCancel={() => setShowCancelConfirm(false)}
        testID="patient-reassignment-cancel-confirm"
      />
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.palette.biancaBackground,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.palette.biancaBackground,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.palette.neutral600,
  },
  header: {
    backgroundColor: colors.palette.neutral100,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.palette.biancaBorder,
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    color: colors.palette.biancaHeader,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: colors.palette.neutral600,
    textAlign: "center",
    marginTop: 4,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.palette.biancaBorder,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.palette.biancaHeader,
    marginBottom: 12,
  },
  patientList: {
    maxHeight: 150,
  },
  patientItem: {
    backgroundColor: colors.palette.neutral100,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  patientName: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.palette.biancaHeader,
    marginBottom: 4,
  },
  patientDetails: {
    fontSize: 14,
    color: colors.palette.neutral600,
  },
  caregiverList: {
    maxHeight: 200,
  },
  caregiverItem: {
    backgroundColor: colors.palette.neutral100,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: colors.palette.neutral900,
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
    color: colors.palette.biancaHeader,
    marginBottom: 4,
  },
  caregiverDetails: {
    fontSize: 14,
    color: colors.palette.neutral600,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: colors.palette.neutral600,
    textAlign: "center",
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.palette.neutral500,
    textAlign: "center",
  },
  footer: {
    backgroundColor: colors.palette.neutral100,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: colors.palette.biancaBorder,
  },
  reassignButton: {
    backgroundColor: colors.palette.biancaSuccess,
    paddingVertical: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  reassignButtonText: {
    color: colors.palette.neutral100,
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  cancelButton: {
    backgroundColor: colors.palette.neutral300,
    paddingVertical: 16,
    borderRadius: 8,
  },
  cancelButtonText: {
    color: colors.palette.neutral700,
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  closeButton: {
    backgroundColor: colors.palette.biancaButtonSelected,
    paddingVertical: 16,
    borderRadius: 8,
  },
  closeButtonText: {
    color: colors.palette.neutral100,
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
}) 