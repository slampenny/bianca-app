import React, { useState } from "react"
import { View, StyleSheet } from "react-native"
import { Button } from "app/components/Button"
import { Text } from "app/components/Text"
import { useNavigation } from "@react-navigation/native"
import { HomeStackParamList } from "app/navigators/navigationTypes"
import { useInitiateCallMutation } from "../services/api/callWorkflowApi"
import { colors } from "app/theme/colors"
import { useAppDispatch } from "../store/store"
import { setActiveCall, setCallStatus } from "../store/callSlice"
import { translate } from "app/i18n"
import { logger } from "../utils/logger"

interface CallNowButtonProps {
  patientId: string
  patientName: string
  disabled?: boolean
  style?: any
}

export const CallNowButton: React.FC<CallNowButtonProps> = ({
  patientId,
  patientName,
  disabled = false,
  style
}) => {
  const [isCalling, setIsCalling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigation = useNavigation()
  const dispatch = useAppDispatch()
  const [initiateCallMutation] = useInitiateCallMutation()

  const handleCallNow = async () => {
    if (isCalling) return
    
    setIsCalling(true)
    setError(null)
    
    try {
      const response = await initiateCallMutation({
        patientId,
        callNotes: `Manual call initiated by agent to ${patientName}`
      }).unwrap()
      
      // Store call data in Redux
      logger.debug('CallNowButton - Full response:', response)
      logger.debug('CallNowButton - response.conversationId:', response.conversationId)
      
      dispatch(setActiveCall(response))
      // Conversation is now created immediately, so conversationId is always available
      const callNotes = `Manual call initiated by agent to ${patientName}`
      dispatch(setCallStatus({
        conversationId: response.conversationId,
        status: response.status || 'initiated',
        startTime: new Date().toISOString(),
        duration: 0,
        callOutcome: null,
        callNotes,
        patient: {
          _id: patientId,
          name: patientName,
          phone: response.patientPhone || "" // Will be populated by backend
        },
        agent: {
          _id: response.agentId,
          name: response.agentName
        }
      }))
      
      // Navigate to call screen
      ;(navigation as any).navigate("Call")
      
    } catch (err: any) {
      const errorMessage = err?.data?.message || err?.message || 'Failed to initiate call'
      setError(errorMessage)
      logger.error('Call initiation error:', err)
    } finally {
      setIsCalling(false)
    }
  }

  return (
    <View style={[styles.container, style]}>
      {error && (
        <Text style={styles.errorText} testID={`call-error-${patientId}`}>
          {error}
        </Text>
      )}
      
      <Button
        text={isCalling ? translate("common.calling") : translate("common.callNow")}
        preset="primary"
        onPress={handleCallNow}
        disabled={disabled || isCalling}
        testID={`call-now-${patientName}`}
        style={styles.button}
        textStyle={styles.buttonText}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  button: {
    backgroundColor: (colors.palette as any).biancaButtonSelected || colors.tint,
    borderRadius: 5,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minWidth: 100,
  },
  buttonText: {
    color: colors.palette.neutral100,
    fontSize: 14,
    fontWeight: "600",
  },
  errorText: {
    color: colors.palette.angry500,
    fontSize: 12,
    marginBottom: 4,
    textAlign: "center",
  },
})
