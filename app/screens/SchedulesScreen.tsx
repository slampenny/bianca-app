import React, { useState, useEffect } from "react"
import { View, Text, ScrollView, StyleSheet, Button } from "react-native"
import { useSelector, useDispatch } from "react-redux"
import { Picker } from "@react-native-picker/picker"
import ScheduleComponent from "../components/Schedule"
import { useCreateScheduleMutation, useUpdateScheduleMutation, useDeleteScheduleMutation } from "../services/api/scheduleApi"
import { getSchedules, setSchedule, getSchedule } from "../store/scheduleSlice"
import { LoadingScreen } from "./LoadingScreen"
import { Schedule } from "app/services/api"

export const SchedulesScreen = () => {
  const dispatch = useDispatch()
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
        dispatch(setSchedule(selectedSchedule))
      } else {
        await createNewSchedule(selectedSchedule)
        dispatch(setSchedule(selectedSchedule))
      }
  }

  const handleDelete = async () => {
    if (selectedSchedule && selectedSchedule.id) {
      await deleteSchedule({scheduleId: selectedSchedule.id}) // You need to create this mutation in your scheduleApi
      dispatch(setSchedule(null))
    }
  }

  const handleScheduleChange = (newSchedule: Schedule) => {
    dispatch(setSchedule(newSchedule));
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
        <View>
          <Text>Select a schedule:</Text>
          <Picker
            selectedValue={selectedSchedule.id}
            onValueChange={(itemValue) => {
              const selected = schedules.find((schedule) => schedule.id === itemValue)
              if (selected) {
                dispatch(setSchedule(selected))
              }
            }}
          >
            {schedules.map((schedule, index) => (
              <Picker.Item key={schedule.id} label={`Schedule ${index + 1}`} value={schedule.id} />
            ))}
          </Picker>
        </View>
      ) : (
        <Text>No schedules available. Please create a new one.</Text>
      )}
      <ScheduleComponent
        initialSchedule={selectedSchedule}
        onScheduleChange={handleScheduleChange}
      />
      <Button title="Save" onPress={handleSave} />
      <Button title="Delete" onPress={handleDelete} color="red" />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#ECF0F1",
  },
  header: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#2C3E50",
    marginBottom: 20,
  },
})
