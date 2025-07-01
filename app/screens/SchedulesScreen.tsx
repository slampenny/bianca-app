import React, { useState, useEffect } from "react"
import { View, Text, ScrollView, StyleSheet, Pressable } from "react-native"
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
import { colors } from "app/theme/colors"

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
      <Text style={styles.header}>Schedule Details</Text>
      {schedules && schedules.length > 0 ? (
        <View style={styles.pickerContainer}>
          <Text style={styles.label}>Select a schedule:</Text>
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
        </View>
      ) : (
        <Text style={styles.noSchedulesText}>No schedules available. Please create a new one.</Text>
      )}
      <ScheduleComponent
        initialSchedule={selectedSchedule}
        onScheduleChange={handleScheduleChange}
      />
      <View style={styles.buttonContainer}>
        <Pressable
          style={({ pressed }) => [
            {
              backgroundColor: pressed ? colors.palette.biancaButtonUnselected : colors.palette.biancaButtonSelected,
              padding: 10,
              justifyContent: "center",
              alignItems: "center",
              width: "45%",
            },
            styles.button,
          ]}
          onPress={handleSave}
        >
          <Text style={styles.buttonText}>Save</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            {
              backgroundColor: pressed ? colors.palette.angry100 : colors.palette.angry500,
              padding: 10,
              justifyContent: "center",
              alignItems: "center",
              width: "45%",
            },
            styles.button,
          ]}
          onPress={handleDelete}
        >
          <Text style={styles.buttonText}>Delete</Text>
        </Pressable>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  button: {
    padding: 10, // Add padding to increase the size of the buttons
    width: "45%", // Adjust the width of the buttons
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
  buttonText: {
    color: colors.palette.neutral100,
    fontSize: 16,
  },
  container: {
    backgroundColor: colors.palette.biancaBackground,
    flex: 1,
    padding: 20,
  },
  header: {
    color: colors.palette.biancaHeader,
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  label: {
    color: colors.palette.neutral600,
    fontSize: 18,
    marginBottom: 5,
  },
  noSchedulesText: {
    color: colors.palette.neutral600,
    fontSize: 18,
    marginBottom: 20,
  },
  picker: {
    backgroundColor: colors.palette.neutral100,
    height: 50,
  },
  pickerContainer: {
    borderColor: colors.palette.biancaBorder,
    borderRadius: 5,
    borderWidth: 1,
    marginBottom: 20,
    overflow: "hidden",
    padding: 10,
  },
})
