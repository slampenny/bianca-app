import React, { useState, useEffect } from "react"
import { View, ScrollView, StyleSheet, Platform } from "react-native"
import { useSelector, useDispatch } from "react-redux"
import { Picker } from "@react-native-picker/picker"
import ScheduleComponent from "../components/Schedule"
import {
  useCreateScheduleMutation,
  useUpdateScheduleMutation,
  useDeleteScheduleMutation,
} from "../services/api/scheduleApi"
import { getSchedules, setSchedule, getSchedule } from "../store/scheduleSlice"
import { LoadingScreen } from "./LoadingScreen"
import { Schedule } from "app/services/api"
import { getPatient } from "app/store/patientSlice"
import { spacing } from "app/theme"
import { logger } from "../utils/logger"
import { useTheme } from "app/theme/ThemeContext"
import { translate } from "../i18n"
import { Text, Button, Card } from "app/components"
import type { ThemeColors } from "../types"

export const SchedulesScreen = () => {
  const dispatch = useDispatch()
  const selectedPatient = useSelector(getPatient)
  const selectedSchedule = useSelector(getSchedule)
  const schedules = useSelector(getSchedules)
  const [updateSchedule, { isLoading: isUpdating, isError: isUpdatingError }] =
    useUpdateScheduleMutation()
  const [createNewSchedule, { isLoading: isCreating, isError: isCreatingError }] =
    useCreateScheduleMutation()
  const [deleteSchedule, { isLoading: isDeleting, isError: isDeletingError }] =
    useDeleteScheduleMutation()
  const { colors, isLoading: themeLoading, currentTheme } = useTheme()

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
      await deleteSchedule({ scheduleId: selectedSchedule.id })
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
      <Button
        text={translate("scheduleScreen.deleteSchedule")}
        onPress={handleDelete}
        style={styles.button}
        preset="danger"
        testID="schedule-delete-button"
        accessibilityLabel="schedule-delete-button"
      />
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
