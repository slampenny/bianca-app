import React from "react"
import { Pressable, StyleSheet, View, ViewStyle } from "react-native"
import { Text } from "./Text"
import { useTheme } from "../theme/ThemeContext"
import { translate, TxKeyPath } from "../i18n"

export interface ClientGlanceStatProps {
  labelTx: TxKeyPath
  /** Main value text (already localized or numeric) */
  value: string
  onPress: () => void
  /** Optional screen reader hint describing the navigation action */
  accessibilityHint?: string
  /** Optional test id for the value row (web: data-testid) — used by E2E / debugging */
  valueTestID?: string
  leftAccessory?: React.ReactNode
  containerStyle?: ViewStyle
  /** Red alert styling (e.g. when the client has open alerts) */
  tone?: "default" | "danger"
}

export function ClientGlanceStat(props: ClientGlanceStatProps) {
  const {
    labelTx,
    value,
    onPress,
    accessibilityHint,
    valueTestID,
    leftAccessory,
    containerStyle,
    tone = "default",
  } = props
  const { colors } = useTheme()
  const styles = createStyles(colors, tone)

  const label = translate(labelTx)
  const accessibilityLabel = `${label}: ${value}`

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.chip, pressed && styles.chipPressed, containerStyle]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      {...(accessibilityHint ? { accessibilityHint } : {})}
    >
      <View style={styles.labelRow}>
        <Text style={styles.label} size="xxs" text={label} importantForAccessibility="no" />
      </View>
      <View style={styles.valueBlock}>
        <View style={styles.valueRow}>
          {leftAccessory}
          <Text
            style={styles.value}
            size="xs"
            text={value}
            importantForAccessibility="no"
            {...(valueTestID ? { testID: valueTestID } : {})}
          />
        </View>
      </View>
    </Pressable>
  )
}

const createStyles = (colors: any, tone: "default" | "danger") => {
  const danger = tone === "danger"
  const chipBg = danger ? colors.palette.biancaErrorBackground : colors.palette.neutral100
  const chipBorder = danger ? colors.palette.biancaError : colors.palette.biancaBorder || colors.palette.neutral300
  const labelColor = danger ? colors.palette.error700 || colors.palette.biancaError : colors.palette.neutral600
  const valueColor = danger ? colors.palette.biancaError : colors.palette.biancaHeader

  return StyleSheet.create({
    chip: {
      flex: 1,
      minWidth: 0,
      maxWidth: "100%",
      backgroundColor: chipBg,
      borderWidth: 1,
      borderColor: chipBorder,
      borderRadius: 12,
      paddingHorizontal: 8,
      paddingVertical: 6,
      flexDirection: "column",
    },
    chipPressed: {
      opacity: 0.88,
    },
    valueBlock: {
      flex: 1,
      justifyContent: "center",
      minHeight: 22,
    },
    labelRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 3,
    },
    label: {
      color: labelColor,
      flex: 1,
    },
    valueRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      flexWrap: "nowrap",
    },
    value: {
      color: valueColor,
      fontWeight: "600",
      textAlign: "center",
    },
  })
}
