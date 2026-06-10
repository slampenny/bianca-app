import React, { useEffect, useState } from "react"
import { View, StyleSheet } from "react-native"
import { StackScreenProps } from "@react-navigation/stack"
import { Button, Text, AuthScreenLayout } from "app/components"
import ScheduleComponent from "app/components/Schedule"
import { useTheme } from "app/theme/ThemeContext"
import { translate } from "app/i18n"
import { OnboardingStackParamList } from "app/navigators/navigationTypes"
import { Schedule } from "app/services/api"
import { useCreateScheduleMutation } from "app/services/api/scheduleApi"
import { useDispatch, useSelector } from "react-redux"
import { setLovedOneSetupComplete } from "app/store/authSlice"
import { getClient, setClient } from "app/store/clientSlice"
import { setSchedule } from "app/store/scheduleSlice"

export type OnboardingScheduleScreenProps = StackScreenProps<
  OnboardingStackParamList,
  "OnboardingSchedule"
>

const DEFAULT_SCHEDULE: Schedule = {
  id: null,
  client: null,
  frequency: "daily",
  intervals: [],
  time: "10:00",
  isActive: true,
}

export function OnboardingScheduleScreen({ route }: OnboardingScheduleScreenProps) {
  const { clientId } = route.params
  const { colors, isLoading: themeLoading } = useTheme()
  const dispatch = useDispatch()
  const client = useSelector(getClient)
  const [createSchedule, { isLoading }] = useCreateScheduleMutation()
  const [schedule, setLocalSchedule] = useState<Schedule>({ ...DEFAULT_SCHEDULE, client: clientId })
  const [error, setError] = useState("")

  useEffect(() => {
    dispatch(setSchedule(schedule))
  }, [dispatch, schedule])

  const styles = createStyles(colors)

  const finishSetup = () => {
    dispatch(setLovedOneSetupComplete())
  }

  const handleSave = async () => {
    if (!schedule.time) {
      setError(translate("onboarding.schedule.timeRequired"))
      return
    }
    setError("")
    try {
      await createSchedule({
        clientId,
        data: {
          frequency: schedule.frequency,
          time: schedule.time,
          intervals: schedule.intervals,
          isActive: true,
        },
      }).unwrap()
      if (client?.id === clientId) {
        dispatch(setClient({ ...client, schedules: [{ ...schedule, client: clientId }] }))
      }
      finishSetup()
    } catch {
      setError(translate("onboarding.schedule.saveFailed"))
    }
  }

  if (themeLoading) {
    return (
      <AuthScreenLayout testID="onboarding-schedule">
        <Text>{translate("common.loading")}</Text>
      </AuthScreenLayout>
    )
  }

  return (
    <AuthScreenLayout testID="onboarding-schedule" contentContainerStyle={{ justifyContent: "flex-start" }}>
      <Text style={styles.title} tx="onboarding.schedule.title" />
      <Text style={styles.subtitle} tx="onboarding.schedule.subtitle" />

      <View style={styles.scheduleWrap}>
        <ScheduleComponent initialSchedule={schedule} onScheduleChange={setLocalSchedule} />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button
        tx="onboarding.schedule.saveAndFinish"
        preset="primary"
        onPress={handleSave}
        loading={isLoading}
        testID="onboarding-schedule-save"
        style={styles.primaryButton}
      />
      <Button
        tx="onboarding.schedule.skipForNow"
        preset="default"
        onPress={finishSetup}
        testID="onboarding-schedule-skip"
        style={styles.skipButton}
      />
    </AuthScreenLayout>
  )
}

const createStyles = (colors: ReturnType<typeof useTheme>["colors"]) =>
  StyleSheet.create({
    title: {
      fontSize: 26,
      fontWeight: "700",
      color: colors.palette.biancaHeader ?? colors.text,
      textAlign: "center",
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      color: colors.palette.neutral600,
      textAlign: "center",
      marginBottom: 20,
      lineHeight: 22,
    },
    scheduleWrap: {
      width: "100%",
      marginBottom: 16,
    },
    error: {
      color: colors.palette.error500 ?? "#dc2626",
      textAlign: "center",
      marginBottom: 12,
    },
    primaryButton: { marginTop: 8, width: "100%" },
    skipButton: { marginTop: 12, width: "100%" },
  })
