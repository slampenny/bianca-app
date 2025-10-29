import React, { useEffect, useState } from "react"
import { View, StyleSheet } from "react-native"
import { Button, Text } from "app/components"
import { useGetCallStatusQuery, useEndCallMutation } from "../services/api/callWorkflowApi"
import { formatDuration } from "../utils/dateUtils"
import { colors } from "app/theme/colors"
import { useAppDispatch, useAppSelector } from "../store/store"
import { setCallStatus, updateCallStatus } from "../store/callSlice"
import { translate } from "app/i18n"

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
  const [status, setStatus] = useState(initialStatus)
  const [callDuration, setCallDuration] = useState(0)
  const [callStartTime, setCallStartTime] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  // RTK Query hooks
  const { data: callStatusData, error: callStatusError, isLoading, isFetching } = useGetCallStatusQuery(conversationId, {
    pollingInterval: 2000, // Poll every 2 seconds
    // Only skip polling when call is in a terminal state
    skip: conversationId === 'temp-call' || ['completed', 'failed', 'busy', 'no_answer', 'ended'].includes(status)
  })

  // Log polling activity
  React.useEffect(() => {
    console.log('🔄 CallStatusBanner - Polling status check:', {
      conversationId,
      isLoading,
      isFetching,
      status,
      skip: conversationId === 'temp-call' || ['completed', 'failed'].includes(status)
    })
  }, [isLoading, isFetching, conversationId, status])
  
  // Debug logging for call monitoring
  React.useEffect(() => {
    console.log('CallStatusBanner - conversationId:', conversationId)
    console.log('CallStatusBanner - initialStatus:', initialStatus)
    console.log('CallStatusBanner - current status:', status)
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
  }, [conversationId, initialStatus, status, callStatusData, callStatusError])
  
  const [endCall, { isLoading: isEndingCall }] = useEndCallMutation()

  // Update call status from RTK Query data
  useEffect(() => {
    console.log('📡 CallStatusBanner - API Response received:', {
      hasData: !!callStatusData,
      hasError: !!callStatusError,
      data: callStatusData,
      error: callStatusError,
      timestamp: new Date().toISOString()
    })
    
    if (callStatusData && callStatusData.data) {
      const newStatus = callStatusData.data.status
      console.log('✅ CallStatusBanner - Processing API data:', {
        newStatus,
        currentStatus: status,
        fullResponse: callStatusData.data,
        statusChanged: newStatus !== status
      })
      
      // Always update the status from the API - it's the source of truth
      if (newStatus && newStatus !== status) {
        console.log('🔄 CallStatusBanner - Status changed, updating to:', newStatus)
        setStatus(newStatus)
        onStatusChange?.(newStatus)
        
        // Update Redux store
        dispatch(updateCallStatus({
          conversationId,
          status: newStatus
        }))
      } else {
        console.log('⏸️ CallStatusBanner - Status unchanged:', newStatus)
      }
      
      // Update duration and start time if available
      // Only update duration from API for terminal states to avoid conflicts with local timer
      if (callStatusData.data.duration !== undefined && ['completed', 'failed', 'busy', 'no_answer', 'ended'].includes(newStatus)) {
        console.log('⏱️ CallStatusBanner - Updating duration from API for terminal state:', callStatusData.data.duration)
        setCallDuration(callStatusData.data.duration)
      }
      
      if (callStatusData.data.startTime) {
        console.log('🕐 CallStatusBanner - Updating start time:', callStatusData.data.startTime)
        setCallStartTime(new Date(callStatusData.data.startTime))
      }
    } else if (callStatusError) {
      console.error('❌ CallStatusBanner - API Error:', callStatusError)
      // Don't update local state on error - keep the last known good state
    }
  }, [callStatusData, status, onStatusChange, dispatch, conversationId, callStatusError])

  // Update duration timer for active calls
  useEffect(() => {
    if (callStartTime && status === 'in-progress') {
      const interval = setInterval(() => {
        const now = new Date()
        const duration = Math.round((now.getTime() - callStartTime.getTime()) / 1000)
        setCallDuration(duration)
      }, 1000)

      return () => clearInterval(interval)
    }
  }, [callStartTime, status])

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
        return 'Setting up call...'
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
    if (status !== 'in-progress') return
    
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

  const showEndCallButton = status === 'in-progress'
  const showDuration = callDuration > 0 && ['in-progress', 'completed'].includes(status)

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
            style={[styles.statusBadge, { backgroundColor: getStatusColor(status) }]}
            testID="call-status-badge"
          >
            <Text style={styles.statusBadgeText}>
              {status.replace('_', ' ').toUpperCase()}
            </Text>
          </View>
          
          <View style={styles.statusInfo}>
            <Text style={styles.statusMessage}>
              {getStatusMessage(status)}
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
            text={isEndingCall ? translate("common.ending") : translate("common.endCall")}
            preset="danger"
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
