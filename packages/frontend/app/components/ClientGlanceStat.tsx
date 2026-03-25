import React from "react"
import { Alert, Platform, Pressable, StyleSheet, View, ViewStyle } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { Text } from "./Text"
import { useTheme } from "../theme/ThemeContext"
import { translate, TxKeyPath } from "../i18n"

export interface ClientGlanceStatProps {
  labelTx: TxKeyPath
  hintTitleTx: TxKeyPath
  hintBodyTx: TxKeyPath
  /** Main value text (already localized or numeric) */
  value: string
  /** Optional test id for the value row (web: data-testid) — used by E2E / debugging */
  valueTestID?: string
  valueAccessibilityLabel?: string
  leftAccessory?: React.ReactNode
  containerStyle?: ViewStyle
}

export function ClientGlanceStat(props: ClientGlanceStatProps) {
  const { labelTx, hintTitleTx, hintBodyTx, value, valueTestID, valueAccessibilityLabel, leftAccessory, containerStyle } =
    props
  const { colors } = useTheme()
  const styles = createStyles(colors)

  const title = translate(hintTitleTx)
  const body = translate(hintBodyTx)
  const webTitle = `${title}\n\n${body}`

  const showHint = () => {
    Alert.alert(title, body, [{ text: translate("common.ok"), style: "default" }])
  }

  return (
    <View style={[styles.chip, containerStyle]} accessibilityRole="summary">
      <View style={styles.labelRow}>
        <Text style={styles.label} size="xxs" tx={labelTx} />
        <Pressable
          onPress={showHint}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={translate("homeScreen.glanceHintButtonA11y", { label: translate(labelTx) })}
          {...(Platform.OS === "web" ? ({ title: webTitle, accessibilityHint: body } as object) : { accessibilityHint: body })}
        >
          <Ionicons name="information-circle-outline" size={15} color={colors.palette.neutral500} />
        </Pressable>
      </View>
      <View style={styles.valueBlock}>
        <View style={styles.valueRow}>
          {leftAccessory}
          <Text
            style={styles.value}
            size="xs"
            text={value}
            {...(valueTestID ? { testID: valueTestID } : {})}
            accessibilityLabel={valueAccessibilityLabel ?? value}
          />
        </View>
      </View>
    </View>
  )
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    chip: {
      flex: 1,
      minWidth: 0,
      maxWidth: "100%",
      backgroundColor: colors.palette.neutral100,
      borderWidth: 1,
      borderColor: colors.palette.biancaBorder || colors.palette.neutral300,
      borderRadius: 10,
      paddingHorizontal: 8,
      paddingVertical: 6,
      flexDirection: "column",
    },
    valueBlock: {
      flex: 1,
      justifyContent: "center",
      minHeight: 22,
    },
    labelRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 4,
      marginBottom: 3,
    },
    label: {
      color: colors.palette.neutral600,
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
      color: colors.palette.biancaHeader,
      fontWeight: "600",
      textAlign: "center",
    },
  })
