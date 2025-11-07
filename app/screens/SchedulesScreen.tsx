import React, { useState, useEffect } from "react"
import { View, ScrollView, StyleSheet } from "react-native"
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
import { useTheme } from "app/theme/ThemeContext"
import { translate } from "../i18n"
import { Text, Button, Card } from "app/components"

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
  const { colors, isLoading: themeLoading } = useTheme()

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
      console.error("No schedule selected to delete.")
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
          heading={translate("schedulesScreen.selectSchedule")}
          headingStyle={styles.cardHeading}
          ContentComponent={
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
          }
        />
      ) : (
        <Card
          style={styles.emptyStateCard}
          content={translate("schedulesScreen.noSchedulesAvailable")}
          contentStyle={styles.emptyStateText}
        />
      )}

      {/* Schedule Configuration Card */}
      <Card
        style={styles.scheduleCard}
        heading={translate("scheduleScreen.heading")}
        headingStyle={styles.cardHeading}
        ContentComponent={
          <ScheduleComponent
            initialSchedule={selectedSchedule}
            onScheduleChange={handleScheduleChange}
          />
        }
      />

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        <Button
          text={translate("scheduleScreen.saveSchedule")}
          onPress={handleSave}
          style={styles.button}
          preset="primary"
        />
        <Button
          text={translate("scheduleScreen.deleteSchedule")}
          onPress={handleDelete}
          style={styles.button}
          preset="danger"
        />
      </View>
    </ScrollView>
  )
}

const createStyles = (colors: any) => StyleSheet.create({
  button: {
    flex: 1,
    marginHorizontal: spacing.xs,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xs,
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
  },
  deleteButton: {
    backgroundColor: colors.palette.angry500,
  },
  emptyStateCard: {
    marginBottom: spacing.md,
  },
  emptyStateText: {
    // Use theme-aware text color with fallbacks
    color: colors.textDim || colors.palette?.neutral600 || colors.palette?.neutral700 || "#666666",
    fontSize: 16,
    textAlign: "center",
  },
  header: {
    marginBottom: spacing.lg,
  },
  headerTitle: {
    // Use theme-aware text color with fallbacks
    color: colors.text || colors.palette?.biancaHeader || colors.palette?.neutral800 || "#000000",
    fontSize: 28,
    fontWeight: "bold",
  },
  picker: {
    // CRITICAL: Use theme-aware background
    backgroundColor: colors.palette?.neutral100 || colors.background || "#FFFFFF",
    borderRadius: 8,
    height: 50,
    // Note: Picker text color is set via Picker.Item color prop
    color: colors.text || colors.palette?.biancaHeader || colors.palette?.neutral800 || "#000000",
  },
  pickerItem: {
    // Picker.Item color prop has limited support, but we try to set it
    color: colors.text || colors.palette?.biancaHeader || colors.palette?.neutral800 || "#000000",
  },

  scheduleCard: {
    marginBottom: spacing.md,
  },
  selectorCard: {
    marginBottom: spacing.md,
  },
})
