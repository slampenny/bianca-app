import React, { useState, useEffect, useRef } from "react"
import { View, ScrollView, StyleSheet, Platform } from "react-native"
import { useSelector, useDispatch } from "react-redux"
import { useNavigation, useRoute, RouteProp, useFocusEffect } from "@react-navigation/native"
import type { HomeStackParamList } from "../navigators/navigationTypes"
import { Picker } from "@react-native-picker/picker"
import ScheduleComponent from "../components/Schedule"
import {
  useCreateScheduleMutation,
  useUpdateScheduleMutation,
  useDeleteScheduleMutation,
} from "../services/api/scheduleApi"
import { useCreateAlertMutation } from "../services/api/alertApi"
import { getSchedules, setSchedule, getSchedule } from "../store/scheduleSlice"
import { getPatient, setPatient } from "../store/patientSlice"
import { getCurrentUser } from "../store/authSlice"
import { LoadingScreen } from "./LoadingScreen"
import { Schedule, Patient } from "app/services/api"
import { spacing } from "app/theme"
import { logger } from "../utils/logger"
import { useTheme } from "app/theme/ThemeContext"
import { translate } from "../i18n"
import { Text, Button, Card } from "app/components"
import type { ThemeColors } from "../types"

type SchedulesScreenRouteProp = RouteProp<HomeStackParamList, 'Schedule'>

export const SchedulesScreen = () => {
  const dispatch = useDispatch()
  const navigation = useNavigation()
  const route = useRoute<SchedulesScreenRouteProp>()
  const selectedPatient = useSelector(getPatient)
  const selectedSchedule = useSelector(getSchedule)
  const schedules = useSelector(getSchedules)
  const currentUser = useSelector(getCurrentUser)
  const isNewPatient = route.params?.isNewPatient ?? false
  const [updateSchedule, { isLoading: isUpdating, isError: isUpdatingError }] =
    useUpdateScheduleMutation()
  const [createNewSchedule, { isLoading: isCreating, isError: isCreatingError }] =
    useCreateScheduleMutation()
  const [deleteSchedule, { isLoading: isDeleting, isError: isDeletingError }] =
    useDeleteScheduleMutation()
  const [createAlert] = useCreateAlertMutation()
  const { colors, isLoading: themeLoading, currentTheme } = useTheme()
  
  // Track if we've already checked for missing schedule to avoid duplicate alerts
  const hasCheckedForAlert = useRef(false)
  
  // Check if user exits without creating a schedule and create alert if needed
  // Only for new patient creations, not updates
  // useFocusEffect works for both stack navigation and tab navigation
  useFocusEffect(
    React.useCallback(() => {
      // Reset check flag when screen gains focus
      hasCheckedForAlert.current = false
      
      // Return cleanup function that runs when screen loses focus
      return () => {
        // Only check if this is a new patient creation and we haven't checked yet
        if (!isNewPatient || hasCheckedForAlert.current) {
          return
        }

        // Only check if we have a patient and user
        if (!selectedPatient?.id || !currentUser?.id) {
          logger.debug('SchedulesScreen blur: Missing patient or user, skipping alert check', {
            hasPatient: !!selectedPatient?.id,
            hasUser: !!currentUser?.id
          })
          return
        }

        // Mark as checked to prevent duplicate alerts
        hasCheckedForAlert.current = true

        // Check if any schedules exist for this patient
        // Use patient.schedules if available (from API), otherwise fall back to Redux schedules
        const patientSchedules = selectedPatient.schedules || schedules
        const hasSchedules = Array.isArray(patientSchedules) && patientSchedules.length > 0
        
        logger.debug('SchedulesScreen blur: Checking for missing schedule', {
          patientId: selectedPatient.id,
          patientName: selectedPatient.name,
          hasSchedules,
          scheduleCount: patientSchedules.length,
          schedulesSource: selectedPatient.schedules ? 'patient.schedules' : 'Redux'
        })
        
        // If no schedules exist, create an alert
        if (!hasSchedules) {
          logger.info(`Creating alert for patient ${selectedPatient.name} with no schedule`)
          // Use setTimeout to ensure this runs after navigation completes
          // and doesn't block the navigation
          setTimeout(async () => {
            try {
              // Set relevanceUntil to 30 days from now so the alert doesn't expire immediately
              const relevanceUntil = new Date()
              relevanceUntil.setDate(relevanceUntil.getDate() + 30)
              
              const result = await createAlert({
                message: `Patient ${selectedPatient.name} has no schedule configured`,
                importance: 'medium',
                alertType: 'patient',
                relatedPatient: selectedPatient.id,
                createdBy: currentUser.id,
                createdModel: 'Caregiver',
                visibility: 'allCaregivers',
                relevanceUntil: relevanceUntil.toISOString(),
              }).unwrap()
              logger.info(`Alert created successfully for patient ${selectedPatient.name} with no schedule`, result)
            } catch (error) {
              logger.error('Failed to create alert for patient without schedule:', error)
              // Log the full error for debugging
              if (error && typeof error === 'object') {
                logger.error('Alert creation error details:', JSON.stringify(error, null, 2))
              }
            }
          }, 100)
        } else {
          logger.debug(`Patient ${selectedPatient.name} has ${patientSchedules.length} schedule(s), no alert needed`)
        }
      }
    }, [isNewPatient, selectedPatient, currentUser, schedules, createAlert])
  )

  // Inject CSS for web Picker dropdown theming
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const isDarkMode = currentTheme === "dark"
      
      const dropdownBg = isDarkMode 
        ? (colors.palette?.neutral500 || "#525252") 
        : (colors.palette?.neutral100 || "#FFFFFF")
      const dropdownText = isDarkMode
        ? (colors.text || colors.palette?.neutral900 || "#FAFAFA")
        : (colors.text || colors.palette?.neutral800 || "#000000")
      const hoverBg = isDarkMode
        ? (colors.palette?.neutral400 || "#404040")
        : (colors.palette?.neutral200 || "#FAFAFA")

      const styleId = 'picker-dropdown-theme-schedules'
      let styleElement = document.getElementById(styleId)
      
      if (!styleElement) {
        styleElement = document.createElement('style')
        styleElement.id = styleId
        document.head.appendChild(styleElement)
      }

      styleElement.textContent = `
        select {
          background-color: ${dropdownBg} !important;
          color: ${dropdownText} !important;
        }
        select option {
          background-color: ${dropdownBg} !important;
          color: ${dropdownText} !important;
        }
        select option:hover,
        select option:checked {
          background-color: ${hoverBg} !important;
          color: ${dropdownText} !important;
        }
      `

      return () => {
        // Cleanup on unmount
        const element = document.getElementById(styleId)
        if (element) {
          element.remove()
        }
      }
    }
  }, [colors, currentTheme])

  const handleSave = async () => {
    if (selectedSchedule && selectedSchedule.id) {
      await updateSchedule({ scheduleId: selectedSchedule.id, data: selectedSchedule })
    } else {
      if (selectedPatient && selectedPatient.id && selectedSchedule) {
        await createNewSchedule({ patientId: selectedPatient.id, data: selectedSchedule })
      }
    }
  }

  const handleDelete = async () => {
    if (selectedSchedule && selectedSchedule.id) {
      try {
        await deleteSchedule({ scheduleId: selectedSchedule.id }).unwrap()
        
        // Update the patient in Redux to reflect the deleted schedule
        // This will also update the patient in the patients list (handled by setPatient reducer)
        if (selectedPatient) {
          const updatedSchedules = schedules.filter((s) => s.id !== selectedSchedule.id)
          const updatedPatient: Patient = {
            ...selectedPatient,
            schedules: updatedSchedules,
          }
          
          // Update the patient in Redux (setPatient will also update the patients list)
          dispatch(setPatient(updatedPatient))
        }
      } catch (error) {
        logger.error("Failed to delete schedule:", error)
      }
    } else {
      logger.error("No schedule selected to delete.")
    }
  }

  const handleScheduleChange = (newSchedule: Schedule) => {
    dispatch(setSchedule(newSchedule))
  }


  if (themeLoading) {
    return <LoadingScreen />
  }

  const styles = createStyles(colors)

  if (isUpdating || isCreating || isDeleting) {
    return <LoadingScreen /> // use the LoadingScreen component
  }

  if (isUpdatingError || isCreatingError || isDeletingError) {
    return (
      <View style={styles.container}>
        <Text>{translate("schedulesScreen.errorLoadingSchedules")}</Text>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} testID="schedules-screen" accessibilityLabel="schedules-screen">
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle} testID="schedules-header" accessibilityLabel="schedules-header">{translate("schedulesScreen.scheduleDetails")}</Text>
      </View>

      {/* Schedule Selector Card */}
      {schedules && schedules.length > 0 ? (
        <Card
          style={styles.selectorCard}
          ContentComponent={
            <View style={styles.selectorContent}>
              <Text style={styles.selectorLabel}>{translate("schedulesScreen.selectSchedule")}</Text>
              <View style={styles.pickerWrapper}>
                <Picker
                  selectedValue={selectedSchedule?.id}
                  onValueChange={(itemValue) => {
                    const selected = schedules.find((schedule) => schedule.id === itemValue)
                    if (selected) {
                      dispatch(setSchedule(selected))
                    }
                  }}
                  style={styles.picker}
                  dropdownIconColor={colors.text || colors.palette?.biancaHeader || colors.palette?.neutral800 || "#000000"}
                  itemStyle={styles.pickerItem}
                >
                  {schedules.map((schedule, index) => (
                    <Picker.Item 
                      key={schedule.id} 
                      label={`${translate("schedulesScreen.scheduleNumber")} ${index + 1}`} 
                      value={schedule.id}
                      color={colors.text || colors.palette?.biancaHeader || colors.palette?.neutral800 || "#000000"}
                    />
                  ))}
                </Picker>
              </View>
            </View>
          }
        />
      ) : (
        <Card
          style={styles.emptyStateCard}
          verticalAlignment="center"
          ContentComponent={
            <View style={styles.emptyStateContainer}>
              <Text style={styles.emptyStateText}>
                {translate("schedulesScreen.noSchedulesAvailable")}
              </Text>
            </View>
          }
        />
      )}

      {/* Schedule Configuration Card */}
      <Card
        style={styles.scheduleCard}
        ContentComponent={
          <ScheduleComponent
            initialSchedule={selectedSchedule}
            onScheduleChange={handleScheduleChange}
          />
        }
      />

      {/* Action Buttons */}
      <Button
        text={translate("scheduleScreen.saveSchedule")}
        onPress={handleSave}
        style={styles.button}
        preset="primary"
        testID="schedule-save-button"
        accessibilityLabel="schedule-save-button"
      />
      {schedules && schedules.length > 0 && selectedSchedule && selectedSchedule.id && (
        <Button
          text={translate("scheduleScreen.deleteSchedule")}
          onPress={handleDelete}
          style={styles.button}
          preset="danger"
          testID="schedule-delete-button"
          accessibilityLabel="schedule-delete-button"
        />
      )}
    </ScrollView>
  )
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  button: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },

  cardHeading: {
    // Use theme-aware text color with fallbacks
    color: colors.text || colors.palette?.biancaHeader || colors.palette?.neutral800 || "#000000",
    fontSize: 18,
    fontWeight: "600",
  },
  container: {
    backgroundColor: colors.palette.biancaBackground,
    flex: 1,
    padding: spacing.md,
    paddingTop: spacing.lg,
  },
  deleteButton: {
    backgroundColor: colors.palette.angry500,
  },
  emptyStateCard: {
    marginBottom: spacing.md,
    minHeight: 120,
    justifyContent: "center",
  },
  emptyStateContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.lg,
  },
  emptyStateText: {
    // Use theme-aware text color with fallbacks
    color: colors.textDim || colors.palette?.neutral600 || colors.palette?.neutral700 || "#666666",
    fontSize: 18,
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: spacing.md,
  },
  header: {
    marginBottom: spacing.xl,
    alignItems: "center",
  },
  headerTitle: {
    // Use theme-aware text color with fallbacks
    color: colors.text || colors.palette?.biancaHeader || colors.palette?.neutral800 || "#000000",
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
  },
  picker: {
    height: 50,
    width: "100%",
    backgroundColor: "transparent",
    // Note: Picker text color is set via Picker.Item color prop
    color: colors.text || colors.palette?.biancaHeader || colors.palette?.neutral800 || "#000000",
  },
  pickerItem: {
    // Picker.Item color prop has limited support, but we try to set it
    color: colors.text || colors.palette?.biancaHeader || colors.palette?.neutral800 || "#000000",
  },
  pickerWrapper: {
    // CRITICAL: Use theme-aware background and border to match Schedule component
    backgroundColor: colors.palette?.neutral100 || colors.background || "#FFFFFF",
    borderColor: colors.palette?.neutral300 || colors.palette?.biancaBorder || colors.border || "#E2E8F0",
    borderRadius: 5,
    borderWidth: 1,
    overflow: "hidden",
  },
  selectorContent: {
    paddingHorizontal: 20, // Match Schedule component container horizontal padding for alignment
    paddingTop: 20, // Match Schedule component container vertical padding
    paddingBottom: 20, // Add bottom padding for better spacing
  },
  selectorLabel: {
    // Use theme-aware text color with fallbacks
    color: colors.text || colors.palette?.biancaHeader || colors.palette?.neutral800 || "#000000",
    fontSize: 18,
    marginBottom: 8,
  },

  scheduleCard: {
    marginBottom: spacing.lg,
  },
  selectorCard: {
    marginBottom: spacing.lg,
  },
})
