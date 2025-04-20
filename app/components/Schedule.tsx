import React, { useState, useEffect } from "react"
import { View, Text, StyleSheet, Switch } from "react-native"
import { Picker } from "@react-native-picker/picker"
import { Toggle } from "."
import { Schedule } from "../services/api/api.types"

interface ScheduleScreenProps {
  initialSchedule: Schedule
  onScheduleChange: (schedule: Schedule) => void
}

const ScheduleComponent: React.FC<ScheduleScreenProps> = ({
  initialSchedule,
  onScheduleChange,
}) => {
  const [id, setId] = useState(initialSchedule.id)
  const [patient, setPatient] = useState(initialSchedule.patient)
  const [frequency, setFrequency] = useState(initialSchedule.frequency)
  const [intervals, setIntervals] = useState(initialSchedule.intervals)
  const [isActive, setIsActive] = useState(initialSchedule.isActive)
  const [time, setTime] = useState(initialSchedule.time)

  useEffect(() => {
    setId(initialSchedule.id)
    setPatient(initialSchedule.patient)
    setFrequency(initialSchedule.frequency)
    setIntervals(initialSchedule.intervals)
    setIsActive(initialSchedule.isActive)
    setTime(initialSchedule.time)
  }, [initialSchedule])

  useEffect(() => {
    const newSchedule: Schedule = { id, patient, frequency, intervals, isActive, time }
    onScheduleChange(newSchedule)
  }, [id, patient, frequency, intervals, isActive, time])

  const handleDayChange = (dayIndex: number, isChecked: boolean) => {
    const newIntervals = isChecked
      ? [...intervals, { day: dayIndex }]
      : intervals.filter((interval) => interval.day !== dayIndex)
    setIntervals(newIntervals)
  }

  const formatSchedule = (schedule: Schedule) => {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    switch (schedule.frequency) {
      case "daily":
        return `Every day at ${schedule.time}`
      case "weekly":
        if (schedule.intervals && schedule.intervals.length > 0) {
          const selectedDays = schedule.intervals
            .map((interval) => days[interval.day || 0])
            .join(", ")
          return `Every ${selectedDays} at ${schedule.time}`
        } else {
          return `Every week at ${schedule.time}`
        }
      case "monthly":
        return `Every month on the ${
          schedule.intervals.length > 0 ? schedule.intervals[0].day : 0
        }th at ${schedule.time}`
      default:
        return ""
    }
  }

  const times: string[] = []
  for (let i = 0; i < 24; i++) {
    for (let j = 0; j < 60; j += 15) {
      const formattedTime = (i < 10 ? "0" + i : i) + ":" + (j < 10 ? "0" + j : j)
      times.push(formattedTime)
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Schedule</Text>
      <View style={styles.formGroup}>
        <Text style={styles.label}>Start Time</Text>
        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={time}
            onValueChange={(itemValue) => setTime(itemValue)}
            style={styles.picker}
            itemStyle={styles.pickerItem}
          >
            {times.map((t, index) => (
              <Picker.Item key={index} label={t} value={t} />
            ))}
          </Picker>
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Frequency</Text>
        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={frequency}
            onValueChange={setFrequency}
            style={styles.picker}
            itemStyle={styles.pickerItem}
          >
            <Picker.Item label="Daily" value="daily" />
            <Picker.Item label="Weekly" value="weekly" />
            <Picker.Item label="Monthly" value="monthly" />
          </Picker>
        </View>
      </View>

      {frequency === "weekly" && (
        <View style={styles.weeklyContainer}>
          {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map(
            (day, index) => {
              const selectedDays = intervals.map((interval) => interval.day)
              return (
                <View key={day} style={styles.dayRow}>
                  <Text style={styles.dayLabel}>{day}</Text>
                  <Toggle
                    value={selectedDays.includes(index)}
                    onValueChange={(isChecked) => handleDayChange(index, isChecked)}
                    variant="checkbox"
                  />
                </View>
              )
            },
          )}
        </View>
      )}

      <View style={styles.detailsCard}>
        <Text style={styles.detailsTitle}>Schedule Details</Text>
        <Text style={styles.detailsText}>
          Schedule: {formatSchedule({ id, patient, frequency, intervals, isActive, time })}
        </Text>
        <Text style={styles.detailsText}>Frequency: {frequency}</Text>
      </View>

      <View style={styles.switchContainer}>
        <Text style={styles.switchLabel}>Active:</Text>
        <Switch
          trackColor={{ false: "#767577", true: "#81b0ff" }}
          thumbColor={isActive ? "#f5dd4b" : "#f4f3f4"}
          ios_backgroundColor="#3e3e3e"
          onValueChange={setIsActive}
          value={isActive}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#ecf0f1",
    flex: 1,
    padding: 20,
  },
  dayLabel: {
    color: "#2c3e50",
    fontSize: 16,
  },
  dayRow: {
    alignItems: "center",
    borderBottomColor: "#ecf0f1",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  detailsCard: {
    backgroundColor: "#fff",
    borderRadius: 5,
    elevation: 2,
    marginBottom: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  detailsText: {
    color: "#7f8c8d",
    fontSize: 16,
    marginBottom: 5,
  },
  detailsTitle: {
    color: "#2c3e50",
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 10,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    color: "#7f8c8d",
    fontSize: 18,
    marginBottom: 8,
  },
  picker: {
    height: 50,
    width: "100%",
  },
  pickerItem: {
    height: 50,
  },
  pickerWrapper: {
    backgroundColor: "#fff",
    borderColor: "#bdc3c7",
    borderRadius: 5,
    borderWidth: 1,
    overflow: "hidden",
  },
  switchContainer: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderColor: "#bdc3c7",
    borderRadius: 5,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 15,
  },
  switchLabel: {
    color: "#2c3e50",
    fontSize: 18,
  },
  title: {
    color: "#2c3e50",
    fontSize: 26,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  weeklyContainer: {
    backgroundColor: "#fff",
    borderColor: "#bdc3c7",
    borderRadius: 5,
    borderWidth: 1,
    marginBottom: 20,
    padding: 10,
  },
})

export default ScheduleComponent
