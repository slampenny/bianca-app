import React, { useState, useEffect } from "react"
import { View, StyleSheet, Platform, Pressable, Modal, ScrollView, ViewStyle } from "react-native"
import DateTimePicker from "@react-native-community/datetimepicker"
import { Text, TextProps } from "./Text"
import { Icon } from "./Icon"
import { useTheme } from "../theme/ThemeContext"
import { useKeyboardFocus } from "../hooks/useKeyboardFocus"
import { translate } from "../i18n"
import { spacing } from "../theme"

interface TimePickerProps {
  value: string // Format: "HH:MM" (e.g., "09:30")
  onValueChange: (value: string) => void
  label?: TextProps["text"]
  labelTx?: TextProps["tx"]
  labelTxOptions?: TextProps["txOptions"]
  helper?: TextProps["text"]
  helperTx?: TextProps["tx"]
  helperTxOptions?: TextProps["txOptions"]
  enabled?: boolean
  containerStyle?: ViewStyle
  testID?: string
  accessibilityLabel?: string
}

export function TimePicker({
  value,
  onValueChange,
  label,
  labelTx,
  labelTxOptions,
  helper,
  helperTx,
  helperTxOptions,
  enabled = true,
  containerStyle,
  testID,
  accessibilityLabel,
}: TimePickerProps) {
  const { colors, currentTheme } = useTheme()
  const keyboardFocusStyle = useKeyboardFocus()
  const [showPicker, setShowPicker] = useState(false)
  const [date, setDate] = useState(new Date())
  const [hour, setHour] = useState(9)
  const [minute, setMinute] = useState(0)
  const [isAM, setIsAM] = useState(true)

  // Parse value from props - component just reflects the underlying data
  useEffect(() => {
    if (value) {
      const [hours, minutes] = value.split(":").map(Number)
      const h = hours || 0
      const m = minutes || 0
      setHour(h % 12 || 12)
      setMinute(m)
      setIsAM(h < 12)
      const newDate = new Date()
      newDate.setHours(h)
      newDate.setMinutes(m)
      setDate(newDate)
    }
  }, [value])

  const formatTime = (h: number, m: number, am: boolean): string => {
    const displayHour = h === 0 ? 12 : h
    const displayMinute = m.toString().padStart(2, "0")
    return `${displayHour}:${displayMinute} ${am ? "AM" : "PM"}`
  }

  const formatTime24 = (h: number, m: number, am: boolean): string => {
    let hours24 = h
    if (h === 12) {
      hours24 = am ? 0 : 12
    } else if (!am) {
      hours24 = h + 12
    }
    return `${hours24.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`
  }

  const handleTimeChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      setShowPicker(false)
    }

    if (selectedDate) {
      setDate(selectedDate)
      const timeString = `${selectedDate.getHours().toString().padStart(2, "0")}:${selectedDate.getMinutes().toString().padStart(2, "0")}`
      onValueChange(timeString)
    }
  }

  const handleWebTimeChange = () => {
    const timeString = formatTime24(hour, minute, isAM)
    onValueChange(timeString)
    setShowPicker(false)
  }

  const getAccessibilityLabel = () => {
    if (accessibilityLabel) return accessibilityLabel
    const labelText = labelTx ? translate(labelTx, labelTxOptions) : label
    if (labelText) {
      return `${labelText}, ${value ? formatTime(hour, minute, isAM) : "No time selected"}`
    }
    return `Time, ${value ? formatTime(hour, minute, isAM) : "No time selected"}`
  }

  const createStyles = (colors: any) => StyleSheet.create({
    container: {
      marginBottom: spacing.md,
    },
    label: {
      marginBottom: spacing.xs,
      color: colors.palette?.biancaHeader || colors.text,
    },
    pickerWrapper: {
      backgroundColor: colors.palette?.neutral100 || colors.background || "#FFFFFF",
      borderColor: colors.palette?.neutral300 || colors.palette?.biancaBorder || colors.border || "#E2E8F0",
      borderRadius: 5,
      borderWidth: 1,
      overflow: "hidden",
      marginTop: spacing.xs,
    },
    timeButton: {
      backgroundColor: colors.palette?.neutral100 || colors.background || "#FFFFFF",
      borderColor: colors.palette?.neutral300 || colors.palette?.biancaBorder || colors.border || "#E2E8F0",
      borderRadius: 5,
      borderWidth: 1,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      minHeight: 50,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    timeDisplay: {
      fontSize: 16,
      fontWeight: "500",
      color: colors.text || colors.palette?.biancaHeader || colors.palette?.neutral800 || "#000000",
    },
    helper: {
      marginTop: spacing.xs,
      color: colors.textDim,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: colors.palette?.overlay50 || "rgba(0, 0, 0, 0.5)",
      justifyContent: "center",
      alignItems: "center",
      ...(Platform.OS === "web" && {
        position: "fixed" as any,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9998,
      }),
    },
    modalContent: {
      backgroundColor: colors.palette?.neutral100 || colors.background || "#FFFFFF",
      borderRadius: 10,
      width: "90%",
      maxWidth: 400,
      maxHeight: "80%",
      elevation: 5,
      shadowColor: colors.palette?.neutral900 || "#000000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      ...(Platform.OS === "web" && {
        position: "fixed" as any,
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 9999,
      }),
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.palette?.neutral300 || colors.border || "#E2E8F0",
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: colors.palette?.biancaHeader || colors.text || "#000000",
    },
    modalCloseButton: {
      padding: spacing.xs,
    },
    webTimePickerContainer: {
      flexDirection: "row",
      padding: spacing.md,
      justifyContent: "space-around",
      alignItems: "flex-start",
    },
    timeColumn: {
      flex: 1,
      alignItems: "center",
      marginHorizontal: spacing.xs,
    },
    timeColumnLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textDim || colors.palette?.neutral600 || "#666666",
      marginBottom: spacing.xs,
    },
    timeScrollView: {
      maxHeight: 200,
      width: "100%",
    },
    timeOption: {
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      marginVertical: 2,
      borderRadius: 6,
      alignItems: "center",
      minWidth: 50,
    },
    timeOptionSelected: {
      backgroundColor: colors.palette?.biancaHeader || colors.palette?.neutral800 || "#000000",
    },
    timeOptionText: {
      fontSize: 18,
      color: colors.text || colors.palette?.neutral800 || "#000000",
    },
    timeOptionTextSelected: {
      color: colors.palette?.neutral100 || "#FFFFFF",
      fontWeight: "600",
    },
    ampmContainer: {
      flexDirection: "column",
      gap: spacing.xs,
    },
    ampmButton: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: colors.palette?.neutral300 || colors.border || "#E2E8F0",
      alignItems: "center",
      minWidth: 80,
    },
    ampmButtonSelected: {
      backgroundColor: colors.palette?.biancaHeader || colors.palette?.neutral800 || "#000000",
      borderColor: colors.palette?.biancaHeader || colors.palette?.neutral800 || "#000000",
    },
    ampmText: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.text || colors.palette?.neutral800 || "#000000",
    },
    ampmTextSelected: {
      color: colors.palette?.neutral100 || "#FFFFFF",
    },
    iosPicker: {
      height: 200,
    },
  })

  const styles = createStyles(colors)
  const textColor = colors.text || colors.palette?.biancaHeader || colors.palette?.neutral800 || "#000000"

  // Web implementation with custom clock interface
  if (Platform.OS === "web") {
    return (
      <View style={[styles.container, containerStyle]} testID={testID}>
        {!!(label || labelTx) && (
          <Text
            preset="formLabel"
            text={label}
            tx={labelTx}
            txOptions={labelTxOptions}
            style={styles.label}
          />
        )}

        <Pressable
          style={[styles.timeButton, keyboardFocusStyle]}
          onPress={() => enabled && setShowPicker(true)}
          disabled={!enabled}
          accessibilityRole="button"
          accessibilityLabel={getAccessibilityLabel()}
          accessibilityHint="Opens time selection dialog"
          accessibilityState={{ disabled: !enabled }}
        >
          <Text style={styles.timeDisplay}>
            {value ? formatTime(hour, minute, isAM) : "Select Time"}
          </Text>
          <Icon icon="caretDown" size={16} color={colors.palette?.neutral600 || colors.textDim} />
        </Pressable>

        {!!(helper || helperTx) && (
          <Text
            preset="formHelper"
            text={helper}
            tx={helperTx}
            txOptions={helperTxOptions}
            style={styles.helper}
          />
        )}

        {showPicker && (
          <Modal
            visible={showPicker}
            transparent
            animationType="fade"
            onRequestClose={() => setShowPicker(false)}
          >
            <Pressable
              style={styles.modalOverlay}
              onPress={() => setShowPicker(false)}
            >
              <Pressable
                style={styles.modalContent}
                onPress={(e) => e.stopPropagation()}
              >
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    {labelTx ? translate(labelTx, labelTxOptions) : label || "Select Time"}
                  </Text>
                  <Pressable
                    onPress={() => setShowPicker(false)}
                    style={styles.modalCloseButton}
                    testID={testID ? `${testID}-close` : undefined}
                  >
                    <Icon icon="x" size={24} color={colors.palette?.neutral600 || colors.textDim} />
                  </Pressable>
                </View>
                
                <View style={styles.webTimePickerContainer}>
                  {/* Hour selector */}
                  <View style={styles.timeColumn}>
                    <Text style={styles.timeColumnLabel}>Hour</Text>
                    <ScrollView style={styles.timeScrollView} showsVerticalScrollIndicator={false}>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                        <Pressable
                          key={h}
                          style={[
                            styles.timeOption,
                            hour === h && styles.timeOptionSelected,
                            keyboardFocusStyle,
                          ]}
                          onPress={() => setHour(h)}
                        >
                          <Text
                            style={[
                              styles.timeOptionText,
                              hour === h && styles.timeOptionTextSelected,
                            ]}
                          >
                            {h}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>

                  {/* Minute selector */}
                  <View style={styles.timeColumn}>
                    <Text style={styles.timeColumnLabel}>Minute</Text>
                    <ScrollView style={styles.timeScrollView} showsVerticalScrollIndicator={false}>
                      {Array.from({ length: 60 }, (_, i) => i).map((m) => (
                        <Pressable
                          key={m}
                          style={[
                            styles.timeOption,
                            minute === m && styles.timeOptionSelected,
                            keyboardFocusStyle,
                          ]}
                          onPress={() => setMinute(m)}
                        >
                          <Text
                            style={[
                              styles.timeOptionText,
                              minute === m && styles.timeOptionTextSelected,
                            ]}
                          >
                            {m.toString().padStart(2, "0")}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>

                  {/* AM/PM selector */}
                  <View style={styles.timeColumn}>
                    <Text style={styles.timeColumnLabel}>Period</Text>
                    <View style={styles.ampmContainer}>
                      <Pressable
                        style={[
                          styles.ampmButton,
                          isAM && styles.ampmButtonSelected,
                          keyboardFocusStyle,
                        ]}
                        onPress={() => setIsAM(true)}
                      >
                        <Text
                          style={[
                            styles.ampmText,
                            isAM && styles.ampmTextSelected,
                          ]}
                        >
                          AM
                        </Text>
                      </Pressable>
                      <Pressable
                        style={[
                          styles.ampmButton,
                          !isAM && styles.ampmButtonSelected,
                          keyboardFocusStyle,
                        ]}
                        onPress={() => setIsAM(false)}
                      >
                        <Text
                          style={[
                            styles.ampmText,
                            !isAM && styles.ampmTextSelected,
                          ]}
                        >
                          PM
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                </View>

                <Pressable
                  style={[
                    {
                      backgroundColor: colors.palette?.primary500 || colors.tint || "#3B82F6",
                      padding: spacing.md,
                      borderRadius: 8,
                      margin: spacing.md,
                      alignItems: "center",
                    },
                    keyboardFocusStyle,
                  ]}
                  onPress={handleWebTimeChange}
                >
                  <Text
                    style={{
                      color: colors.palette?.neutral100 || "#FFFFFF",
                      fontSize: 16,
                      fontWeight: "600",
                    }}
                  >
                    {translate("common.done")}
                  </Text>
                </Pressable>
              </Pressable>
            </Pressable>
          </Modal>
        )}
      </View>
    )
  }

  // Native implementation
  return (
    <View style={[styles.container, containerStyle]} testID={testID}>
      {!!(label || labelTx) && (
        <Text
          preset="formLabel"
          text={label}
          tx={labelTx}
          txOptions={labelTxOptions}
          style={styles.label}
        />
      )}

      <Pressable
        style={[styles.timeButton, keyboardFocusStyle]}
        onPress={() => enabled && setShowPicker(true)}
        disabled={!enabled}
        accessibilityRole="button"
        accessibilityLabel={getAccessibilityLabel()}
        accessibilityHint="Opens time selection dialog"
        accessibilityState={{ disabled: !enabled }}
      >
        <Text style={styles.timeDisplay}>
          {value ? formatTime(hour, minute, isAM) : "Select Time"}
        </Text>
        <Icon icon="caretDown" size={16} color={colors.palette?.neutral600 || colors.textDim} />
      </Pressable>

      {!!(helper || helperTx) && (
        <Text
          preset="formHelper"
          text={helper}
          tx={helperTx}
          txOptions={helperTxOptions}
          style={styles.helper}
        />
      )}

      {showPicker && (
        <>
          {Platform.OS === "ios" ? (
            <Modal
              visible={showPicker}
              transparent
              animationType="slide"
              onRequestClose={() => setShowPicker(false)}
            >
              <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <View style={styles.modalHeader}>
                    <Pressable
                      onPress={() => setShowPicker(false)}
                      style={styles.modalCloseButton}
                    >
                      <Text style={[styles.modalTitle, { color: colors.textDim }]}>
                        {translate("common.cancel") || "Cancel"}
                      </Text>
                    </Pressable>
                    <Text style={styles.modalTitle}>
                      {labelTx ? translate(labelTx, labelTxOptions) : label || "Select Time"}
                    </Text>
                    <Pressable
                      onPress={() => {
                        setShowPicker(false)
                        const timeString = formatTime24(hour, minute, isAM)
                        onValueChange(timeString)
                      }}
                      style={styles.modalCloseButton}
                    >
                      <Text style={[styles.modalTitle, { color: colors.palette?.primary500 || colors.tint }]}>
                        {translate("common.done")}
                      </Text>
                    </Pressable>
                  </View>
                  <DateTimePicker
                    value={date}
                    mode="time"
                    is24Hour={false}
                    display="spinner"
                    onChange={(event, selectedDate) => {
                      if (selectedDate) {
                        setDate(selectedDate)
                        const h = selectedDate.getHours() % 12 || 12
                        const m = selectedDate.getMinutes()
                        const am = selectedDate.getHours() < 12
                        setHour(h)
                        setMinute(m)
                        setIsAM(am)
                      }
                    }}
                    style={styles.iosPicker}
                  />
                </View>
              </View>
            </Modal>
          ) : (
            <DateTimePicker
              value={date}
              mode="time"
              is24Hour={false}
              display="clock"
              onChange={handleTimeChange}
            />
          )}
        </>
      )}
    </View>
  )
}
