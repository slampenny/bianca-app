import React, { useEffect, useState } from "react"
import { View, StyleSheet } from "react-native"
import { Button, Text } from "app/components"
import { useGetCallStatusQuery, useEndCallMutation } from "../services/api/callWorkflowApi"
import { formatDuration } from "../utils/dateUtils"
import { colors } from "app/theme/colors"
import { useAppDispatch, useAppSelector } from "../store/store"
import { setCallStatus, updateCallStatus } from "../store/callSlice"

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
  const storedCallStatus = useAppSelector(state => state.call.callStatus)
  const [callStatus, setCallStatus] = useState(initialStatus)
  const [callDuration, setCallDuration] = useState(0)
  const [callStartTime, setCallStartTime] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  // RTK Query hooks
  const { data: callStatusData, error: callStatusError } = useGetCallStatusQuery(conversationId, {
    pollingInterval: 2000, // Poll every 2 seconds
    // Only skip polling when call is completed or failed
    skip: conversationId === 'temp-call' || ['completed', 'failed'].includes(callStatus)
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
      const newStatus = callStatusData.data.status
      console.log('CallStatusBanner - New status from API:', newStatus, 'Current status:', callStatus)
      
      // Always update the status from the API - it's the source of truth
      if (newStatus && newStatus !== callStatus) {
        console.log('CallStatusBanner - Status changed, updating to:', newStatus)
        setCallStatus(newStatus)
        onStatusChange?.(newStatus)
        
        // Update Redux store
        dispatch(updateCallStatus({
          conversationId,
          status: newStatus
        }))
      }
      
      // Update duration and start time if available
      if (callStatusData.data.duration !== undefined) {
        setCallDuration(callStatusData.data.duration)
      }
      
      if (callStatusData.data.startTime) {
        setCallStartTime(new Date(callStatusData.data.startTime))
      }
    } else if (callStatusError) {
      console.error('CallStatusBanner - API Error:', callStatusError)
      // Don't update local state on error - keep the last known good state
    }
  }, [callStatusData, callStatus, onStatusChange, dispatch, conversationId, callStatusError])

  // Update duration timer for active calls
  useEffect(() => {
    if (callStartTime && callStatus === 'in-progress') {
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
      case 'initiated':
        return colors.palette.warning
      case 'in-progress':
        return colors.palette.success
      case 'completed':
        return colors.palette.info
      case 'failed':
        return colors.palette.error
      default:
        return colors.palette.neutral600
    }
  }

  const getStatusMessage = (status: string) => {
    switch (status) {
      case 'initiated':
        return 'Initiating call...'
      case 'in-progress':
        return `Connected with ${patientName}`
      case 'completed':
        return 'Call ended'
      case 'failed':
        return 'Call failed'
      default:
        return 'Unknown status'
    }
  }

  const handleEndCall = async () => {
    if (callStatus !== 'in-progress') return
    
    try {
      await endCall({
        conversationId,
        data: {
          outcome: 'answered',
          notes: 'Call ended by agent'
        }
      }).unwrap()
      
      setCallStatus('completed')
      onStatusChange?.('completed')
      
      // Update Redux store
      dispatch(updateCallStatus({
        conversationId,
        status: 'completed'
      }))
    } catch (err: any) {
      setError('Failed to end call')
      console.error('End call error:', err)
    }
  }

  const showEndCallButton = callStatus === 'in-progress'
  const showDuration = callDuration > 0 && ['in-progress', 'completed'].includes(callStatus)

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
