import React, { useEffect, useState } from "react"
import { View, StyleSheet } from "react-native"
import { Button, Text } from "app/components"
import { useGetCallStatusQuery, useEndCallMutation } from "../services/api/callWorkflowApi"
import { formatDuration } from "../utils/dateUtils"
import { colors } from "app/theme/colors"
import { useAppDispatch, useAppSelector } from "../store/store"
import { setCallStatus, updateCallStatus } from "../store/conversationSlice"

interface CallStatusBannerProps {
  conversationId: string
  initialStatus?: string
  patientName: string
  onStatusChange?: (status: string) => void
}

export const CallStatusBanner: React.FC<CallStatusBannerProps> = ({
  conversationId,
  initialStatus = 'initiating',
  patientName,
  onStatusChange
}) => {
  const dispatch = useAppDispatch()
  const storedCallStatus = useAppSelector(state => state.conversation.callStatus)
  const [callStatus, setCallStatus] = useState(initialStatus)
  const [callDuration, setCallDuration] = useState(0)
  const [callStartTime, setCallStartTime] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  // RTK Query hooks
  const { data: callStatusData, error: callStatusError } = useGetCallStatusQuery(conversationId, {
    pollingInterval: 2000, // Poll every 2 seconds
    skip: ['ended', 'failed', 'busy', 'no_answer'].includes(callStatus)
  })
  
  const [endCall, { isLoading: isEndingCall }] = useEndCallMutation()

  // Update call status from RTK Query data
  useEffect(() => {
    if (callStatusData && callStatusData.data) {
      const newStatus = callStatusData.data.callStatus
      
      if (newStatus !== callStatus) {
        setCallStatus(newStatus)
        onStatusChange?.(newStatus)
        
        // Update Redux store
        dispatch(updateCallStatus({
          conversationId,
          status: newStatus,
          outcome: callStatusData.data.callOutcome,
          notes: callStatusData.data.callNotes
        }))
      }
      
      if (callStatusData.data.callDuration) {
        setCallDuration(callStatusData.data.callDuration)
      }
      
      if (callStatusData.data.callStartTime) {
        setCallStartTime(new Date(callStatusData.data.callStartTime))
      }
    }
  }, [callStatusData, callStatus, onStatusChange, dispatch, conversationId])

  // Update duration timer for active calls
  useEffect(() => {
    if (callStartTime && ['answered', 'connected'].includes(callStatus)) {
      const interval = setInterval(() => {
        const now = new Date()
        const duration = Math.round((now.getTime() - callStartTime.getTime()) / 1000)
        setCallDuration(duration)
      }, 1000)

      return () => clearInterval(interval)
    }
  }, [callStartTime, callStatus])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'setting-up':
      case 'initiating':
      case 'ringing':
        return colors.palette.warning
      case 'answered':
      case 'connected':
        return colors.palette.success
      case 'ended':
        return colors.palette.info
      case 'failed':
      case 'busy':
      case 'no_answer':
        return colors.palette.error
      default:
        return colors.palette.neutral600
    }
  }

  const getStatusMessage = (status: string) => {
    switch (status) {
      case 'setting-up':
        return 'Dialing...'
      case 'initiating':
        return 'Initiating call...'
      case 'ringing':
        return `Calling ${patientName}...`
      case 'answered':
        return `${patientName} answered`
      case 'connected':
        return `Connected with ${patientName}`
      case 'ended':
        return 'Call ended'
      case 'failed':
        return 'Call failed'
      case 'busy':
        return 'Line busy'
      case 'no_answer':
        return 'No answer'
      default:
        return 'Unknown status'
    }
  }

  const handleEndCall = async () => {
    if (!['answered', 'connected'].includes(callStatus)) return
    
    try {
      await endCall({
        conversationId,
        data: {
          outcome: 'answered',
          notes: 'Call ended by agent'
        }
      }).unwrap()
      
      setCallStatus('ended')
      onStatusChange?.('ended')
      
      // Update Redux store
      dispatch(updateCallStatus({
        conversationId,
        status: 'ended',
        outcome: 'answered',
        notes: 'Call ended by agent'
      }))
    } catch (err: any) {
      setError('Failed to end call')
      console.error('End call error:', err)
    }
  }

  const showEndCallButton = ['answered', 'connected'].includes(callStatus)
  const showDuration = callDuration > 0 && ['answered', 'connected', 'ended'].includes(callStatus)

  return (
    <View style={styles.container}>
      {error && (
        <Text style={styles.errorText} testID="call-status-error">
          {error}
        </Text>
      )}
      
      <View style={styles.banner}>
        <View style={styles.statusSection}>
          <View 
            style={[styles.statusBadge, { backgroundColor: getStatusColor(callStatus) }]}
            testID="call-status-badge"
          >
            <Text style={styles.statusBadgeText}>
              {callStatus.replace('_', ' ').toUpperCase()}
            </Text>
          </View>
          
          <View style={styles.statusInfo}>
            <Text style={styles.statusMessage}>
              {getStatusMessage(callStatus)}
            </Text>
            
            {showDuration && (
              <Text style={styles.durationText}>
                Duration: {formatDuration(callDuration)}
              </Text>
            )}
          </View>
        </View>
        
        {showEndCallButton && (
          <Button
            text={isEndingCall ? "Ending..." : "End Call"}
            preset="secondary"
            onPress={handleEndCall}
            disabled={isEndingCall}
            testID="end-call-button"
            style={styles.endCallButton}
            textStyle={styles.endCallButtonText}
          />
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: colors.palette.neutral200,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.palette.biancaBorder,
  },
  statusSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 12,
  },
  statusBadgeText: {
    color: colors.palette.neutral100,
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  statusInfo: {
    flex: 1,
  },
  statusMessage: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.palette.neutral900,
    marginBottom: 2,
  },
  durationText: {
    fontSize: 14,
    color: colors.palette.neutral600,
  },
  endCallButton: {
    backgroundColor: colors.palette.error,
    borderRadius: 5,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 80,
  },
  endCallButtonText: {
    color: colors.palette.neutral100,
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    color: colors.palette.error,
    fontSize: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
})
