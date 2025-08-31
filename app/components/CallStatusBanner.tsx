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
  // Validate conversationId
  if (!conversationId || conversationId === 'temp-call') {
    console.warn('CallStatusBanner - Invalid conversationId:', conversationId)
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Invalid conversation ID</Text>
      </View>
    )
  }
  const dispatch = useAppDispatch()
  const storedCallStatus = useAppSelector(state => state.conversation.callStatus)
  const [callStatus, setCallStatus] = useState(initialStatus)
  const [callDuration, setCallDuration] = useState(0)
  const [callStartTime, setCallStartTime] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  // RTK Query hooks
  const { data: callStatusData, error: callStatusError } = useGetCallStatusQuery(conversationId, {
    pollingInterval: 2000, // Poll every 2 seconds
    // Don't skip polling - let the API tell us the current status
    skip: conversationId === 'temp-call'
  })
  
  // Debug logging for call monitoring
  React.useEffect(() => {
    console.log('CallStatusBanner - conversationId:', conversationId)
    console.log('CallStatusBanner - initialStatus:', initialStatus)
    console.log('CallStatusBanner - current callStatus:', callStatus)
    console.log('CallStatusBanner - callStatusData:', callStatusData)
    console.log('CallStatusBanner - callStatusError:', callStatusError)
    
    // Log the raw API response structure
    if (callStatusData) {
      console.log('CallStatusBanner - Raw API response:', JSON.stringify(callStatusData, null, 2))
      console.log('CallStatusBanner - Has data property:', 'data' in callStatusData)
      if ('data' in callStatusData) {
        console.log('CallStatusBanner - Data property content:', callStatusData.data)
      }
    }
  }, [conversationId, initialStatus, callStatus, callStatusData, callStatusError])
  
  const [endCall, { isLoading: isEndingCall }] = useEndCallMutation()

  // Update call status from RTK Query data
  useEffect(() => {
    console.log('CallStatusBanner - Processing callStatusData:', callStatusData)
    
    if (callStatusData && callStatusData.data) {
      const newStatus = callStatusData.data.callStatus
      console.log('CallStatusBanner - New status from API:', newStatus, 'Current status:', callStatus)
      
      // Always update the status from the API - it's the source of truth
      if (newStatus && newStatus !== callStatus) {
        console.log('CallStatusBanner - Status changed, updating to:', newStatus)
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
      
      // Update duration and start time if available
      if (callStatusData.data.callDuration !== undefined) {
        setCallDuration(callStatusData.data.callDuration)
      }
      
      if (callStatusData.data.callStartTime) {
        setCallStartTime(new Date(callStatusData.data.callStartTime))
      }
    } else if (callStatusError) {
      console.error('CallStatusBanner - API Error:', callStatusError)
      // Don't update local state on error - keep the last known good state
    }
  }, [callStatusData, callStatus, onStatusChange, dispatch, conversationId, callStatusError])

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
