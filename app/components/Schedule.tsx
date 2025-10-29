import React, { useState, useEffect } from "react"
import { View, StyleSheet, Switch } from "react-native"
import { Picker } from "@react-native-picker/picker"
import { Toggle, Text } from "."
import { Schedule } from "../services/api/api.types"
import { translate } from "../i18n"
import { useTheme } from "../theme/ThemeContext"

interface ScheduleScreenProps {
  initialSchedule: Schedule
  onScheduleChange: (schedule: Schedule) => void
}

const ScheduleComponent: React.FC<ScheduleScreenProps> = ({
  initialSchedule,
  onScheduleChange,
}) => {
  const { colors } = useTheme()
  const [id, setId] = useState(initialSchedule.id)
  const [patient, setPatient] = useState(initialSchedule.patient)
  const [frequency, setFrequency] = useState(initialSchedule.frequency)
  const [intervals, setIntervals] = useState(initialSchedule.intervals)
  const [isActive, setIsActive] = useState(initialSchedule.isActive)
  const [time, setTime] = useState(initialSchedule.time)
  
  const createStyles = (colors: any) => StyleSheet.create({
    container: {
      backgroundColor: colors.palette.biancaBackground,
      flex: 1,
      padding: 20,
    },
    dayLabel: {
      // Use theme-aware text color with fallbacks
      color: colors.text || colors.palette?.biancaHeader || colors.palette?.neutral800 || "#000000",
      fontSize: 16,
    },
    dayRow: {
      alignItems: "center",
      borderBottomColor: colors.palette.neutral300,
      borderBottomWidth: 1,
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 8,
    },
    detailsCard: {
      // CRITICAL: Use theme-aware background
      backgroundColor: colors.palette?.neutral100 || colors.background || "#FFFFFF",
      borderRadius: 5,
      elevation: 2,
      marginBottom: 20,
      padding: 20,
      shadowColor: colors.palette?.neutral900 || "#000000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 3,
    },
    detailsText: {
      // Use theme-aware text color with fallbacks
      color: colors.textDim || colors.palette?.neutral600 || colors.palette?.neutral700 || "#666666",
      fontSize: 16,
      marginBottom: 5,
    },
    detailsTitle: {
      // Use theme-aware text color with fallbacks
      color: colors.text || colors.palette?.biancaHeader || colors.palette?.neutral800 || "#000000",
      fontSize: 22,
      fontWeight: "bold",
      marginBottom: 10,
    },
    formGroup: {
      marginBottom: 20,
    },
    label: {
      // Use theme-aware text color with fallbacks
      color: colors.text || colors.palette?.biancaHeader || colors.palette?.neutral800 || "#000000",
      fontSize: 18,
      marginBottom: 8,
    },
    picker: {
      height: 50,
      width: "100%",
      backgroundColor: "transparent",
      // Note: Picker text color is limited on web, but we try to set it
      color: colors.text || colors.palette?.biancaHeader || colors.palette?.neutral800 || "#000000",
    },
    pickerItem: {
      height: 50,
      // Note: Picker.Item style prop has limited support on web/iOS
      // The picker wrapper background provides contrast
      color: colors.text || colors.palette?.biancaHeader || colors.palette?.neutral800 || "#000000",
    },
    pickerWrapper: {
      // CRITICAL: Use theme-aware background
      backgroundColor: colors.palette?.neutral100 || colors.background || "#FFFFFF",
      // CRITICAL: Border should have good contrast
      borderColor: colors.palette?.neutral300 || colors.palette?.biancaBorder || colors.border || "#E2E8F0",
      borderRadius: 5,
      borderWidth: 1,
      overflow: "hidden",
    },
    switchContainer: {
      alignItems: "center",
      // CRITICAL: Use theme-aware background and border
      backgroundColor: colors.palette?.neutral100 || colors.background || "#FFFFFF",
      borderColor: colors.palette?.neutral300 || colors.palette?.biancaBorder || colors.border || "#E2E8F0",
      borderRadius: 5,
      borderWidth: 1,
      flexDirection: "row",
      justifyContent: "space-between",
      padding: 15,
    },
    switchLabel: {
      // Use theme-aware text color with fallbacks
      color: colors.text || colors.palette?.biancaHeader || colors.palette?.neutral800 || "#000000",
      fontSize: 18,
    },
    title: {
      // Use theme-aware text color with fallbacks
      color: colors.text || colors.palette?.biancaHeader || colors.palette?.neutral800 || "#000000",
      fontSize: 26,
      fontWeight: "bold",
      marginBottom: 20,
      textAlign: "center",
    },
    weeklyContainer: {
      // CRITICAL: Use theme-aware background and border
      backgroundColor: colors.palette?.neutral100 || colors.background || "#FFFFFF",
      borderColor: colors.palette?.neutral300 || colors.palette?.biancaBorder || colors.border || "#E2E8F0",
      borderRadius: 5,
      borderWidth: 1,
      marginBottom: 20,
      padding: 10,
    },
  })
  
  const styles = createStyles(colors)

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
    const days = [
      translate("scheduleComponent.sunday"),
      translate("scheduleComponent.monday"),
      translate("scheduleComponent.tuesday"),
      translate("scheduleComponent.wednesday"),
      translate("scheduleComponent.thursday"),
      translate("scheduleComponent.friday"),
      translate("scheduleComponent.saturday")
    ]
    switch (schedule.frequency) {
      case "daily":
        return translate("scheduleComponent.everyDayAt", { time: schedule.time })
      case "weekly":
        if (schedule.intervals && schedule.intervals.length > 0) {
          const selectedDays = schedule.intervals
            .map((interval) => days[interval.day || 0])
            .join(", ")
          return translate("scheduleComponent.everyDaysAt", { days: selectedDays, time: schedule.time })
        } else {
          return translate("scheduleComponent.everyWeekAt", { time: schedule.time })
        }
      case "monthly":
        return translate("scheduleComponent.everyMonthOn", { 
          day: schedule.intervals.length > 0 ? schedule.intervals[0].day : 0,
          time: schedule.time 
        })
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
      <Text style={styles.title}>{translate("scheduleComponent.schedule")}</Text>
      <View style={styles.formGroup}>
        <Text style={styles.label}>{translate("scheduleComponent.startTime")}</Text>
        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={time}
            onValueChange={(itemValue) => setTime(itemValue)}
            style={styles.picker}
            itemStyle={styles.pickerItem}
            dropdownIconColor={colors.text || colors.palette?.biancaHeader || colors.palette?.neutral800 || "#000000"}
          >
            {times.map((t, index) => (
              <Picker.Item 
                key={index} 
                label={t} 
                value={t}
                color={colors.text || colors.palette?.biancaHeader || colors.palette?.neutral800 || "#000000"}
              />
            ))}
          </Picker>
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>{translate("scheduleComponent.frequency")}</Text>
        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={frequency}
            onValueChange={setFrequency}
            style={styles.picker}
            itemStyle={styles.pickerItem}
            dropdownIconColor={colors.text || colors.palette?.biancaHeader || colors.palette?.neutral800 || "#000000"}
          >
            <Picker.Item 
              label={translate("scheduleComponent.daily")} 
              value="daily"
              color={colors.text || colors.palette?.biancaHeader || colors.palette?.neutral800 || "#000000"}
            />
            <Picker.Item 
              label={translate("scheduleComponent.weekly")} 
              value="weekly"
              color={colors.text || colors.palette?.biancaHeader || colors.palette?.neutral800 || "#000000"}
            />
            <Picker.Item 
              label={translate("scheduleComponent.monthly")} 
              value="monthly"
              color={colors.text || colors.palette?.biancaHeader || colors.palette?.neutral800 || "#000000"}
            />
          </Picker>
        </View>
      </View>

      {frequency === "weekly" && (
        <View style={styles.weeklyContainer}>
          {[
            translate("scheduleComponent.sunday"),
            translate("scheduleComponent.monday"),
            translate("scheduleComponent.tuesday"),
            translate("scheduleComponent.wednesday"),
            translate("scheduleComponent.thursday"),
            translate("scheduleComponent.friday"),
            translate("scheduleComponent.saturday")
          ].map(
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
        <Text style={styles.detailsTitle}>{translate("scheduleComponent.scheduleDetails")}</Text>
        <Text style={styles.detailsText}>
          {translate("scheduleComponent.schedule")}: {formatSchedule({ id, patient, frequency, intervals, isActive, time })}
        </Text>
        <Text style={styles.detailsText}>{translate("scheduleComponent.frequency")}: {frequency}</Text>
      </View>

      <View style={styles.switchContainer}>
        <Text style={styles.switchLabel}>{translate("scheduleComponent.active")}:</Text>
        <Switch
          trackColor={{ false: colors.palette.neutral400, true: colors.palette.primary500 }}
          thumbColor={isActive ? colors.palette.warning500 : colors.palette.neutral200}
          ios_backgroundColor={colors.palette.neutral600}
          onValueChange={setIsActive}
          value={isActive}
        />
      </View>
    </View>
  )
}

export default ScheduleComponent
