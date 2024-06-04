import React, { useState, useEffect } from "react"
import { View, Text, StyleSheet, Switch } from "react-native"
import { Picker } from "@react-native-picker/picker"
import { Schedule } from "../services/api/api.types"

interface ScheduleScreenProps {
  initialSchedule: Schedule
  onScheduleChange: (schedule: Schedule) => void
}

const ScheduleComponent: React.FC<ScheduleScreenProps> = ({
  initialSchedule,
  onScheduleChange,
}) => {
  const [schedule, setSchedule] = useState(initialSchedule)
  const [id, setId] = useState(initialSchedule.id)
  const [patient, setPatient] = useState(initialSchedule.patient)
  const [frequency, setFrequency] = useState(initialSchedule.frequency)
  const [intervals, setIntervals] = useState(initialSchedule.intervals)
  const [isActive, setIsActive] = useState(initialSchedule.isActive)
  const [time, setTime] = useState(initialSchedule.time)

  useEffect(() => {
    setId(initialSchedule.id);
    setPatient(initialSchedule.patient);
    setFrequency(initialSchedule.frequency);
    setIntervals(initialSchedule.intervals);
    setIsActive(initialSchedule.isActive);
    setTime(initialSchedule.time);
  }, [initialSchedule]);
  
  useEffect(() => {
    const newSchedule: Schedule = { id, patient, frequency, intervals, isActive, time };
    setSchedule(newSchedule);
    onScheduleChange(newSchedule);
  }, [id, patient, frequency, intervals, isActive, time]);

  const handleDayChange = (dayIndex: number, isChecked: boolean) => {
    let newIntervals
    if (isChecked) {
      newIntervals = [...intervals, { day: dayIndex }]
    } else {
      newIntervals = intervals.filter((interval) => interval.day !== dayIndex)
    }
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
          return `Every ${selectedDays} at ${time}`
        } else {
          return `Every ${schedule.intervals.length > 0 ? schedule.intervals[0].day : 0} at ${time}`
        }
      case "monthly":
        return `Every month on the ${
          schedule.intervals.length > 0 ? schedule.intervals[0].day : 0
        }th at ${time}`
      default:
        return ""
    }
  }

  const times = []
  for (let i = 0; i < 24; i++) {
    for (let j = 0; j < 60; j += 15) {
      const time = (i < 10 ? "0" + i : i) + ":" + (j < 10 ? "0" + j : j)
      times.push(time)
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.form}>
        <Text style={styles.label}>Start:</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={time}
            onValueChange={(itemValue) => {
              setTime(itemValue)
            }}
            style={styles.picker}
          >
            {times.map((time, index) => (
              <Picker.Item key={index} label={time} value={time} />
            ))}
          </Picker>
        </View>

        <Text style={styles.label}>Frequncy:</Text>
        <Picker style={styles.picker} selectedValue={frequency} onValueChange={setFrequency}>
          <Picker.Item label="--Please choose an option--" value="" />
          <Picker.Item label="Daily" value="daily" />
          <Picker.Item label="Weekly" value="weekly" />
          <Picker.Item label="Monthly" value="monthly" />
        </Picker>

        {frequency === "weekly" && (
          <View>
            {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map(
              (day, index) => {
                const selectedDays = intervals.map((interval) => interval.day)
                return (
                  <View key={day} style={styles.checkboxContainer}>
                    <Text style={styles.checkboxLabel}>{day}</Text>
                    <Switch
                      value={selectedDays.includes(index)}
                      onValueChange={(isChecked) => handleDayChange(index, isChecked)}
                    />
                  </View>
                )
              },
            )}
          </View>
        )}
      </View>

      {schedule && (
        <View style={styles.eventDetails}>
          <Text style={styles.eventText}>Schedule: {formatSchedule(schedule)}</Text>
          <Text style={styles.eventText}>Frequency: {schedule.frequency}</Text>
        </View>
      )}

      <Switch
        trackColor={{ false: "#767577", true: "#81b0ff" }}
        thumbColor={isActive ? "#f5dd4b" : "#f4f3f4"}
        ios_backgroundColor="#3e3e3e"
        onValueChange={setIsActive}
        value={isActive}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#ECF0F1",
  },
  headerText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#2C3E50",
    marginBottom: 20,
  },
  form: {
    marginBottom: 20,
  },
  label: {
    fontSize: 18,
    color: "#7F8C8D",
    marginBottom: 5,
  },
  input: {
    height: 40,
    borderColor: "#BDC3C7",
    borderWidth: 1,
    borderRadius: 5,
    marginBottom: 20,
    padding: 10,
  },
  picker: {
    height: 50,
    backgroundColor: "#fff",
    borderColor: "#BDC3C7",
    borderWidth: 1,
    borderRadius: 5,
    marginBottom: 20,
  },
  button: {
    backgroundColor: "#3498DB",
    padding: 15,
    borderRadius: 5,
  },
  buttonText: {
    color: "white",
    fontSize: 18,
    textAlign: "center",
  },
  eventDetails: {
    padding: 20,
    backgroundColor: "#fff",
    borderRadius: 5,
  },
  eventTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#2C3E50",
    marginBottom: 10,
  },
  eventText: {
    fontSize: 18,
    color: "#7F8C8D",
    marginBottom: 10,
  },
  pickerContainer: {
    borderColor: "#BDC3C7",
    borderWidth: 1,
    borderRadius: 5,
    marginBottom: 20,
    overflow: "hidden",
  },
  checkboxContainer: {
    flexDirection: "row",
    marginBottom: 20,
  },
  checkboxLabel: {
    margin: 8,
  },
})

export default ScheduleComponent
