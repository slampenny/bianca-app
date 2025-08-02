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
import { colors, spacing } from "app/theme"
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

  if (isUpdating || isCreating || isDeleting) {
    return <LoadingScreen /> // use the LoadingScreen component
  }

  if (isUpdatingError || isCreatingError || isDeletingError) {
    return (
      <View style={styles.container}>
        <Text>Error loading schedules.</Text>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Schedule Details</Text>
      </View>

      {/* Schedule Selector Card */}
      {schedules && schedules.length > 0 ? (
        <Card
          style={styles.selectorCard}
          heading="Select a schedule:"
          headingStyle={styles.cardHeading}
          ContentComponent={
            <Picker
              selectedValue={selectedSchedule.id}
              onValueChange={(itemValue) => {
                const selected = schedules.find((schedule) => schedule.id === itemValue)
                if (selected) {
                  dispatch(setSchedule(selected))
                }
              }}
              style={styles.picker}
            >
              {schedules.map((schedule, index) => (
                <Picker.Item key={schedule.id} label={`Schedule ${index + 1}`} value={schedule.id} />
              ))}
            </Picker>
          }
        />
      ) : (
        <Card
          style={styles.emptyStateCard}
          content="No schedules available. Please create a new one."
          contentStyle={styles.emptyStateText}
        />
      )}

      {/* Schedule Configuration Card */}
      <Card
        style={styles.scheduleCard}
        heading="Schedule Configuration"
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
          text="Save Schedule"
          onPress={handleSave}
          style={styles.button}
          preset="primary"
        />
        <Button
          text="Delete Schedule"
          onPress={handleDelete}
          style={styles.button}
          preset="danger"
        />
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
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
    color: colors.palette.biancaHeader,
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
    color: colors.palette.neutral600,
    fontSize: 16,
    textAlign: "center",
  },
  header: {
    marginBottom: spacing.lg,
  },
  headerTitle: {
    color: colors.palette.biancaHeader,
    fontSize: 28,
    fontWeight: "bold",
  },
  picker: {
    backgroundColor: colors.palette.neutral100,
    borderRadius: 8,
    height: 50,
  },

  scheduleCard: {
    marginBottom: spacing.md,
  },
  selectorCard: {
    marginBottom: spacing.md,
  },
})
