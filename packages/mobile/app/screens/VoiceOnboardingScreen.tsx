import React, { useEffect, useMemo, useState } from "react"
import { ScrollView, StyleSheet, View } from "react-native"
import { useSelector, useDispatch } from "react-redux"
import { getOrg, setOrg } from "../store/orgSlice"
import { getCurrentUser } from "../store/authSlice"
import {
  useGetDefaultVoiceOnboardingPlanQuery,
  useUpdateOrgMutation,
} from "../services/api/orgApi"
import type { Org, VoiceOnboardingDay } from "../services/api/api.types"
import { LoadingScreen } from "./LoadingScreen"
import { goBack } from "app/navigators/navigationUtilities"
import { useTheme } from "app/theme/ThemeContext"
import { translate } from "../i18n"
import type { ThemeColors } from "../types"
import { Button, Text, TextField, Toggle } from "app/components"
import { logger } from "../utils/logger"

function cloneDays(days: VoiceOnboardingDay[]): VoiceOnboardingDay[] {
  return days.map((day, index) => ({
    dayNumber: index + 1,
    theme: day.theme || "",
    opening: day.opening || "",
    questions: (day.questions || []).map((q) => ({
      id: q.id,
      prompt: q.prompt,
      compressionPriority: q.compressionPriority === true,
    })),
  }))
}

function nextQuestionId(dayNumber: number, questions: { id: string }[]): string {
  const prefix = `day${dayNumber}_topic_`
  const used = new Set(questions.map((q) => q.id))
  let n = 1
  while (used.has(`${prefix}${n}`)) n += 1
  return `${prefix}${n}`
}

function emptyDay(dayNumber: number): VoiceOnboardingDay {
  return {
    dayNumber,
    theme: "",
    opening: "",
    questions: [{ id: nextQuestionId(dayNumber, []), prompt: "", compressionPriority: false }],
  }
}

export function VoiceOnboardingScreen() {
  const dispatch = useDispatch()
  const currentOrg = useSelector(getOrg)
  const currentUser = useSelector(getCurrentUser)
  const { colors, isLoading: themeLoading } = useTheme()
  const [updateOrg, { isLoading: saving }] = useUpdateOrgMutation()

  const canEditOrg = currentUser?.role === "orgAdmin" || currentUser?.role === "superAdmin"

  const { data: defaultPlanData, isLoading: defaultPlanLoading } = useGetDefaultVoiceOnboardingPlanQuery()

  const [useDefault, setUseDefault] = useState(true)
  const [days, setDays] = useState<VoiceOnboardingDay[]>([])
  const [saveError, setSaveError] = useState("")

  const defaultDays = useMemo(() => defaultPlanData?.plan?.days ?? [], [defaultPlanData?.plan?.days])
  const defaultDayCount = defaultPlanData?.plan?.totalDays ?? (defaultDays.length || 0)
  const onboardingDisabled = !useDefault && days.length === 0

  useEffect(() => {
    if (!currentOrg) return
    const vo = currentOrg.voiceOnboarding
    const orgUsesDefault = vo?.useDefault !== false

    if (!orgUsesDefault && vo?.days && vo.days.length > 0) {
      setUseDefault(false)
      setDays(cloneDays(vo.days))
      return
    }

    if (!orgUsesDefault) {
      setUseDefault(false)
      setDays([])
      return
    }

    setUseDefault(true)
    if (defaultDays.length > 0) {
      setDays(cloneDays(defaultDays))
    }
  }, [currentOrg, defaultPlanData])

  const markCustomized = () => {
    if (useDefault) setUseDefault(false)
  }

  const resetToDefault = () => {
    if (!defaultDays.length) return
    setUseDefault(true)
    setDays(cloneDays(defaultDays))
  }

  const disableOnboarding = () => {
    setUseDefault(false)
    setDays([])
  }

  const updateDay = (dayIndex: number, patch: Partial<VoiceOnboardingDay>) => {
    markCustomized()
    setDays((prev) => prev.map((d, i) => (i === dayIndex ? { ...d, ...patch } : d)))
  }

  const updateQuestion = (
    dayIndex: number,
    qIndex: number,
    patch: Partial<VoiceOnboardingDay["questions"][0]>
  ) => {
    markCustomized()
    setDays((prev) =>
      prev.map((d, i) =>
        i !== dayIndex
          ? d
          : {
              ...d,
              questions: d.questions.map((q, qi) => (qi === qIndex ? { ...q, ...patch } : q)),
            }
      )
    )
  }

  const addDay = () => {
    markCustomized()
    const dayNumber = days.length + 1
    setDays((prev) => [...prev, emptyDay(dayNumber)])
  }

  const removeDay = (dayIndex: number) => {
    markCustomized()
    setDays((prev) => cloneDays(prev.filter((_, i) => i !== dayIndex)))
  }

  const addQuestion = (dayIndex: number) => {
    markCustomized()
    setDays((prev) =>
      prev.map((d, i) => {
        if (i !== dayIndex) return d
        const dayNumber = d.dayNumber || i + 1
        return {
          ...d,
          questions: [
            ...d.questions,
            { id: nextQuestionId(dayNumber, d.questions), prompt: "", compressionPriority: false },
          ],
        }
      })
    )
  }

  const removeQuestion = (dayIndex: number, qIndex: number) => {
    markCustomized()
    setDays((prev) =>
      prev.map((d, i) =>
        i !== dayIndex ? d : { ...d, questions: d.questions.filter((_, qi) => qi !== qIndex) }
      )
    )
  }

  const handleUseDefaultChange = (checked: boolean) => {
    if (checked) {
      resetToDefault()
      return
    }
    setUseDefault(false)
  }

  const handleSave = async () => {
    if (!currentOrg?.id) return
    setSaveError("")
    try {
      const body = useDefault
        ? { voiceOnboarding: { useDefault: true, days: [] } }
        : { voiceOnboarding: { useDefault: false, days: cloneDays(days) } }
      const result = await updateOrg({ orgId: currentOrg.id, org: body }).unwrap()
      if (result) {
        dispatch(setOrg(result as Org))
      }
      goBack()
    } catch (error) {
      logger.error("Failed to save voice onboarding:", error)
      setSaveError(translate("voiceOnboardingScreen.saveError"))
    }
  }

  if (!currentOrg) {
    return <LoadingScreen />
  }

  if (themeLoading || defaultPlanLoading) {
    return <LoadingScreen />
  }

  const styles = createStyles(colors)

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.helper} preset="formHelper">
        {translate("voiceOnboardingScreen.intro", { days: defaultDayCount })}
      </Text>

      {onboardingDisabled ? (
        <Text style={styles.bannerDisabled} preset="formHelper">
          {translate("voiceOnboardingScreen.disabledBanner")}
        </Text>
      ) : useDefault ? (
        <Text style={styles.bannerDefault} preset="formHelper">
          {translate("voiceOnboardingScreen.defaultBanner", { days: defaultDayCount })}
        </Text>
      ) : (
        <Text style={styles.bannerCustom} preset="formHelper">
          {translate("voiceOnboardingScreen.customBanner")}
        </Text>
      )}

      {!canEditOrg ? (
        <Text style={styles.viewOnly} preset="formHelper">
          {translate("voiceOnboardingScreen.viewOnly")}
        </Text>
      ) : null}

      <Toggle
        variant="switch"
        labelTx="voiceOnboardingScreen.useDefaultLabel"
        value={useDefault}
        onValueChange={handleUseDefaultChange}
        editable={canEditOrg && defaultDays.length > 0}
        containerStyle={styles.toggleContainer}
      />

      {canEditOrg && !onboardingDisabled ? (
        <View style={styles.actionsRow}>
          <Button preset="default" text={translate("voiceOnboardingScreen.addDay")} onPress={addDay} />
          {!useDefault ? (
            <Button
              preset="default"
              text={translate("voiceOnboardingScreen.resetDefault")}
              onPress={resetToDefault}
            />
          ) : null}
          <Button
            preset="default"
            text={translate("voiceOnboardingScreen.disable")}
            onPress={disableOnboarding}
          />
        </View>
      ) : null}

      {canEditOrg && onboardingDisabled ? (
        <Button
          preset="default"
          text={translate("voiceOnboardingScreen.reEnableDefault")}
          onPress={resetToDefault}
          style={styles.reEnableButton}
        />
      ) : null}

      {!onboardingDisabled &&
        days.map((day, dayIndex) => (
          <View key={`day-${dayIndex}`} style={styles.dayCard}>
            <View style={styles.dayHeader}>
              <Text style={styles.dayTitle}>
                {translate("voiceOnboardingScreen.dayLabel", { day: dayIndex + 1 })}
              </Text>
              {canEditOrg && days.length > 1 ? (
                <Button
                  preset="default"
                  text={translate("voiceOnboardingScreen.removeDay")}
                  onPress={() => removeDay(dayIndex)}
                />
              ) : null}
            </View>

            <TextField
              labelTx="voiceOnboardingScreen.themeLabel"
              value={day.theme || ""}
              onChangeText={(text) => updateDay(dayIndex, { theme: text })}
              editable={canEditOrg}
              containerStyle={styles.field}
            />
            <TextField
              labelTx="voiceOnboardingScreen.openingLabel"
              value={day.opening || ""}
              onChangeText={(text) => updateDay(dayIndex, { opening: text })}
              editable={canEditOrg}
              containerStyle={styles.field}
              multiline
            />

            <Text style={styles.questionsTitle} preset="formLabel">
              {translate("voiceOnboardingScreen.questionsTitle")}
            </Text>

            {day.questions.map((question, qIndex) => (
              <View key={`q-${dayIndex}-${qIndex}`} style={styles.questionBlock}>
                <Text style={styles.questionId} preset="formHelper">
                  {translate("voiceOnboardingScreen.questionId", { id: question.id })}
                </Text>
                <TextField
                  labelTx="voiceOnboardingScreen.promptLabel"
                  value={question.prompt}
                  onChangeText={(text) => updateQuestion(dayIndex, qIndex, { prompt: text })}
                  editable={canEditOrg}
                  containerStyle={styles.field}
                  multiline
                />
                <Toggle
                  variant="checkbox"
                  labelTx="voiceOnboardingScreen.compressionPriorityLabel"
                  value={question.compressionPriority === true}
                  onValueChange={(v) => updateQuestion(dayIndex, qIndex, { compressionPriority: v })}
                  editable={canEditOrg}
                  containerStyle={styles.field}
                />
                {canEditOrg && day.questions.length > 1 ? (
                  <Button
                    preset="default"
                    text={translate("voiceOnboardingScreen.removeQuestion")}
                    onPress={() => removeQuestion(dayIndex, qIndex)}
                  />
                ) : null}
              </View>
            ))}

            {canEditOrg ? (
              <Button
                preset="default"
                text={translate("voiceOnboardingScreen.addQuestion")}
                onPress={() => addQuestion(dayIndex)}
              />
            ) : null}
          </View>
        ))}

      {saveError ? (
        <Text style={styles.errorText} preset="formHelper">{saveError}</Text>
      ) : null}

      {canEditOrg ? (
        <Button
          preset="primary"
          text={saving ? translate("voiceOnboardingScreen.saving") : translate("voiceOnboardingScreen.save")}
          onPress={handleSave}
          disabled={saving}
          style={styles.saveButton}
        />
      ) : null}
    </ScrollView>
  )
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      backgroundColor: colors.palette.biancaBackground,
      flex: 1,
    },
    contentContainer: {
      padding: 20,
    },
    helper: {
      marginBottom: 12,
      color: colors.palette.neutral600,
    },
    bannerDisabled: {
      marginBottom: 12,
      color: colors.palette.biancaError,
    },
    bannerDefault: {
      marginBottom: 12,
      color: colors.palette.neutral600,
    },
    bannerCustom: {
      marginBottom: 12,
      color: colors.palette.neutral600,
    },
    viewOnly: {
      marginBottom: 12,
      color: colors.palette.neutral600,
    },
    toggleContainer: {
      marginBottom: 12,
    },
    actionsRow: {
      gap: 8,
      marginBottom: 16,
    },
    reEnableButton: {
      marginBottom: 16,
    },
    dayCard: {
      backgroundColor: colors.palette.neutral100,
      borderRadius: 6,
      marginBottom: 16,
      padding: 16,
    },
    dayHeader: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    dayTitle: {
      color: colors.palette.biancaHeader,
      fontSize: 16,
      fontWeight: "600",
    },
    field: {
      marginBottom: 8,
    },
    questionsTitle: {
      color: colors.palette.biancaHeader,
      marginBottom: 8,
      marginTop: 4,
    },
    questionBlock: {
      borderTopColor: colors.palette.biancaBorder,
      borderTopWidth: 1,
      marginTop: 8,
      paddingTop: 8,
    },
    questionId: {
      color: colors.palette.neutral600,
      fontSize: 12,
      marginBottom: 4,
    },
    errorText: {
      color: colors.palette.biancaError,
      marginBottom: 8,
    },
    saveButton: {
      marginTop: 8,
    },
  })
