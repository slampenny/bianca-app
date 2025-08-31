import React, { useState } from "react"
import { View, StyleSheet } from "react-native"
import { Button, Text } from "app/components"
import { useNavigation } from "@react-navigation/native"
import { HomeStackParamList } from "app/navigators/navigationTypes"
import { initiateCall } from "../services/api/callWorkflowApi"
import { colors } from "app/theme/colors"
import { useAppDispatch } from "../store/store"
import { setActiveCall, setCallStatus } from "../store/callSlice"

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

  const handleCallNow = async () => {
    if (isCalling) return
    
    setIsCalling(true)
    setError(null)
    
    try {
      const response = await initiateCall({
        patientId,
        callNotes: `Manual call initiated by agent to ${patientName}`
      })
      
      // Store call data in Redux
      console.log('CallNowButton - Full response:', response)
      console.log('CallNowButton - response.conversationId:', response.conversationId)
      console.log('CallNowButton - response.data:', (response as any).data)
      console.log('CallNowButton - response.success:', (response as any).success)
      
      dispatch(setActiveCall(response))
      dispatch(setCallStatus({
        conversationId: response.conversationId,
        callStatus: response.callStatus,
        callStartTime: new Date().toISOString(),
        callDuration: 0,
        callOutcome: null,
        callNotes: response.callNotes,
        patient: {
          _id: patientId,
          name: patientName,
          phone: "" // Will be populated by backend
        },
        agent: {
          _id: response.agentId,
          name: response.agentName
        },
        status: "initiated"
      }))
      
      // Navigate to conversation screen with call in progress
      navigation.navigate("Conversations" as keyof HomeStackParamList, {
        conversationId: response.conversationId,
        isActiveCall: true,
        callStatus: response.callStatus,
        patientName: response.patientName
      })
      
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || 'Failed to initiate call'
      setError(errorMessage)
      console.error('Call initiation error:', err)
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
        text={isCalling ? "Calling..." : "Call Now"}
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
    backgroundColor: colors.palette.biancaButtonSelected,
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
    color: colors.palette.error,
    fontSize: 12,
    marginBottom: 4,
    textAlign: "center",
  },
})
