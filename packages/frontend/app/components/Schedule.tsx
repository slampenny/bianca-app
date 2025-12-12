import React, { useState, useEffect } from "react"
import { View, StyleSheet, Platform } from "react-native"
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
  const { colors, currentTheme } = useTheme()
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
      fontSize: 16,
      paddingHorizontal: 12,
      paddingVertical: 0,
    },
    pickerItem: {
      height: 50,
      fontSize: 16,
      lineHeight: 50,
      paddingHorizontal: 12,
      paddingVertical: 0,
      // Note: Picker.Item style prop has limited support on web/iOS
      // The picker wrapper background provides contrast
      color: colors.text || colors.palette?.biancaHeader || colors.palette?.neutral800 || "#000000",
      backgroundColor: "transparent",
    },
    pickerWrapper: {
      // CRITICAL: Use theme-aware background
      backgroundColor: colors.palette?.neutral100 || colors.background || "#FFFFFF",
      // CRITICAL: Border should have good contrast
      borderColor: colors.palette?.neutral300 || colors.palette?.biancaBorder || colors.border || "#E2E8F0",
      borderRadius: 5,
      borderWidth: 1,
      overflow: "hidden",
      minHeight: 50,
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
    monthlyContainer: {
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

      const styleId = 'picker-dropdown-theme'
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

  // Only reset state when the schedule ID changes (switching to a different schedule)
  // Don't reset when the same schedule is updated (e.g., when toggle changes isActive)
  useEffect(() => {
    // Update if the schedule ID has changed (new schedule selected)
    // This handles: switching between schedules, creating new schedule (null -> null but different object), etc.
    const currentId = id ?? null
    const newId = initialSchedule.id ?? null
    
    if (currentId !== newId) {
      // Schedule ID changed - definitely a different schedule, reset everything
      setId(initialSchedule.id)
      setPatient(initialSchedule.patient)
      setFrequency(initialSchedule.frequency)
      setIntervals(initialSchedule.intervals)
      setIsActive(initialSchedule.isActive)
      setTime(initialSchedule.time)
    } else if (currentId === null && newId === null) {
      // Both are null/undefined - check if it's actually a different schedule by comparing other fields
      // This handles the case where user creates a new schedule, then creates another new one
      // IMPORTANT: Don't check time, frequency, intervals, or isActive here to avoid resetting when user is actively changing them
      // Only check patient to detect if it's a different schedule (patient changes are external, not user edits)
      if (initialSchedule.patient !== patient) {
        setId(initialSchedule.id)
        setPatient(initialSchedule.patient)
        setFrequency(initialSchedule.frequency)
        setIntervals(initialSchedule.intervals)
        setIsActive(initialSchedule.isActive)
        setTime(initialSchedule.time)
      }
    }
  }, [initialSchedule.id, initialSchedule.patient, id, patient]) // Removed time, frequency, intervals, and isActive from dependencies to prevent rapid circling/churn

  // Initialize monthly intervals with default day if empty
  useEffect(() => {
    if (frequency === "monthly" && (intervals.length === 0 || intervals[0]?.day === undefined || intervals[0]?.day === 0)) {
      setIntervals([{ day: 1 }])
    }
  }, [frequency, intervals])

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

  const handleMonthlyDayChange = (day: number) => {
    // For monthly schedules, we only store one day in intervals
    setIntervals([{ day }])
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

      {frequency === "monthly" && (
        <View style={styles.monthlyContainer}>
          <Text style={styles.label}>Day of Month</Text>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={intervals.length > 0 && intervals[0].day !== undefined ? intervals[0].day : 1}
              onValueChange={handleMonthlyDayChange}
              style={styles.picker}
              itemStyle={styles.pickerItem}
              dropdownIconColor={colors.text || colors.palette?.biancaHeader || colors.palette?.neutral800 || "#000000"}
            >
              {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                <Picker.Item
                  key={day}
                  label={day.toString()}
                  value={day}
                  color={colors.text || colors.palette?.biancaHeader || colors.palette?.neutral800 || "#000000"}
                />
              ))}
            </Picker>
          </View>
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
        <Toggle
          testID="schedule-toggle-active"
          accessibilityLabel="schedule-toggle-active"
          variant="switch"
          value={isActive}
          onValueChange={setIsActive}
        />
      </View>
    </View>
  )
}

export default ScheduleComponent
