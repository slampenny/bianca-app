import React, { useState, useMemo } from "react"
import { View, StyleSheet, Pressable, Dimensions, Modal, TouchableWithoutFeedback, ScrollView } from "react-native"
import { useTheme } from "app/theme/ThemeContext"
import { Ionicons } from "@expo/vector-icons"
import { useNavigation } from "@react-navigation/native"
import { useSelector, useDispatch } from "react-redux"
import { getCurrentUser } from "../store/authSlice"
import { getPatientsForCaregiver, setPatient } from "../store/patientSlice"
import { Patient } from "../services/api/api.types"
import { translate } from "../i18n"
import { Button, Text } from "app/components"
import { logger } from "../utils/logger"

const { width } = Dimensions.get('window')
const buttonSize = Math.min((width - 60) / 2, 160) // Max 160px width, responsive

export function ReportsScreen() {
  const navigation = useNavigation()
  const dispatch = useDispatch()
  const currentUser = useSelector(getCurrentUser)
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [showPatientPicker, setShowPatientPicker] = useState(false)
  const { colors, isLoading: themeLoading } = useTheme()

  // Get patients for the current user
  const patientsSelector = useMemo(
    () => (state: any) => {
      const patientList = currentUser && currentUser.id ? getPatientsForCaregiver(state, currentUser.id) : []
      return patientList
    },
    [currentUser?.id]
  )
  const patients = useSelector(patientsSelector)

  const handleSentimentPress = () => {
    if (selectedPatient) {
      // Set the patient in Redux state
      dispatch(setPatient(selectedPatient))
      // Navigate to sentiment analysis screen
      navigation.navigate("SentimentReport" as never)
    }
  }

  const handleHealthPress = () => {
    if (selectedPatient) {
      // Set the patient in Redux state
      dispatch(setPatient(selectedPatient))
      // Navigate to medical analysis screen
      navigation.navigate("MedicalAnalysis" as never)
    }
  }

  const handleComingSoonPress = () => {
    // TODO: Show coming soon message
    logger.debug("Coming soon pressed")
  }

  if (themeLoading) {
    return null
  }

  const styles = createStyles(colors)

  return (
    <View style={styles.container} testID="reports-screen" accessibilityLabel="reports-screen">
      {/* Patient Selector */}
      <View style={styles.patientSelector}>
        <Text style={styles.selectorLabel}>{translate("reportsScreen.selectPatient")}</Text>
        <Pressable
          style={styles.patientPicker}
          onPress={() => setShowPatientPicker(true)}
          testID="patient-picker-button"
        >
          <Text style={styles.patientPickerText}>
            {selectedPatient ? selectedPatient.name : translate("reportsScreen.choosePatient")}
          </Text>
          <Ionicons name="chevron-down" size={20} color={colors.palette.neutral600} />
        </Pressable>
      </View>

      <View style={styles.grid}>
        {/* Top Row */}
        <View style={styles.row}>
          <Button 
            preset="primary"
            style={[
              styles.button, 
              { width: buttonSize, height: buttonSize },
              !selectedPatient && styles.buttonDisabled
            ]} 
            onPress={handleSentimentPress}
            disabled={!selectedPatient}
            testID="sentiment-reports-button"
          >
            <View style={styles.buttonContent}>
              <Ionicons 
                name="trending-up" 
                size={32} 
                color={colors.palette.neutral100}
              />
              <Text style={styles.buttonText}>{translate("reportsScreen.sentiment")}</Text>
            </View>
          </Button>
          
          <Button 
            preset="primary"
            style={[
              styles.button, 
              { width: buttonSize, height: buttonSize },
              !selectedPatient && styles.buttonDisabled
            ]} 
            onPress={handleHealthPress}
            disabled={!selectedPatient}
            testID="health-reports-button"
          >
            <View style={styles.buttonContent}>
              <Ionicons 
                name="heart" 
                size={32} 
                color={colors.palette.neutral100}
              />
              <Text style={styles.buttonText}>{translate("reportsScreen.medicalAnalysis")}</Text>
            </View>
          </Button>
        </View>

        {/* Bottom Row */}
        <View style={styles.row}>
          <Button 
            preset="default"
            style={[styles.button, styles.comingSoonButton, { width: buttonSize, height: buttonSize }]} 
            onPress={handleComingSoonPress}
            testID="coming-soon-button-1"
          >
            <View style={styles.buttonContent}>
              <Ionicons 
                name="time" 
                size={32} 
                color={colors.palette.neutral600}
              />
              <Text style={[styles.buttonText, styles.comingSoonText]}>{translate("reportsScreen.comingSoon")}</Text>
            </View>
          </Button>
          
          <Button 
            preset="default"
            style={[styles.button, styles.comingSoonButton, { width: buttonSize, height: buttonSize }]} 
            onPress={handleComingSoonPress}
            testID="coming-soon-button-2"
          >
            <View style={styles.buttonContent}>
              <Ionicons 
                name="add-circle" 
                size={32} 
                color={colors.palette.neutral600}
              />
              <Text style={[styles.buttonText, styles.comingSoonText]}>{translate("reportsScreen.comingSoon")}</Text>
            </View>
          </Button>
        </View>
      </View>

      {/* Patient Picker Modal */}
      <Modal
        visible={showPatientPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowPatientPicker(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowPatientPicker(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>{translate("reportsScreen.modalTitle")}</Text>
                <ScrollView style={styles.patientList}>
                  {patients.map((patient) => (
                    <Pressable
                      key={patient.id}
                      style={[
                        styles.patientItem,
                        selectedPatient?.id === patient.id && styles.selectedPatientItem
                      ]}
                      onPress={() => {
                        setSelectedPatient(patient)
                        setShowPatientPicker(false)
                      }}
                      testID={`patient-option-${patient.id}`}
                    >
                      <Text style={styles.patientItemText}>{patient.name}</Text>
                      {selectedPatient?.id === patient.id && (
                        <Ionicons name="checkmark" size={20} color={colors.palette.biancaButtonSelected} />
                      )}
                    </Pressable>
                  ))}
                </ScrollView>
                  <Button
                  preset="default"
                  text={translate("reportsScreen.modalCancel")}
                  onPress={() => setShowPatientPicker(false)}
                  style={styles.modalCloseButton}
                />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  )
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.palette.biancaBackground,
    padding: 20,
  },
  patientSelector: {
    marginBottom: 20,
  },
  selectorLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.palette.biancaHeader,
    marginBottom: 8,
  },
  patientPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.palette.neutral100,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.palette.neutral300,
  },
  patientPickerText: {
    fontSize: 16,
    color: colors.palette.biancaHeader,
    flex: 1,
  },
  grid: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    width: '100%',
    maxWidth: 400, // Limit max width for larger screens
  },
  button: {
    backgroundColor: colors.palette.biancaButtonSelected,
    borderRadius: 12,
    elevation: 3,
    shadowColor: colors.palette.neutral900,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    minHeight: 120,
    minWidth: 120,
  },
  comingSoonButton: {
    backgroundColor: colors.palette.neutral200,
    borderWidth: 2,
    borderColor: colors.palette.neutral300,
    borderStyle: 'dashed',
  },
  buttonContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  buttonText: {
    color: colors.palette.neutral100,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  comingSoonText: {
    color: colors.palette.neutral600,
  },
  buttonDisabled: {
    opacity: 0.5,
    backgroundColor: colors.palette.neutral300,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.palette.overlay50 || 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.palette.neutral100,
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.palette.biancaHeader,
    marginBottom: 16,
    textAlign: 'center',
  },
  patientList: {
    maxHeight: 300,
    marginBottom: 16,
  },
  patientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: colors.palette.neutral200,
  },
  selectedPatientItem: {
    backgroundColor: colors.palette.biancaSuccessBackground,
    borderWidth: 1,
    borderColor: colors.palette.biancaSuccess,
  },
  patientItemText: {
    fontSize: 16,
    color: colors.palette.biancaHeader,
    flex: 1,
  },
  modalCloseButton: {
    backgroundColor: colors.palette.neutral300,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.palette.neutral700,
  },
})
