import React from "react"
import { View, Text, StyleSheet, ScrollView } from "react-native"
import { useSelector, useDispatch } from "react-redux"
import { getPatient } from "../store/patientSlice"
import { getConversation, setConversation } from "../store/conversationSlice"
import { getActiveCall, consumePendingCallData } from "../store/callSlice"
import { CallStatusBanner } from "../components/CallStatusBanner"
import { ConversationMessages } from "../components/ConversationMessages"
import { useGetConversationQuery } from "../services/api/conversationApi"
import { useGetCallStatusQuery } from "../services/api/callWorkflowApi"
import { colors } from "app/theme/colors"

export function CallScreen() {
  const dispatch = useDispatch()
  const patient = useSelector(getPatient)
  const activeCall = useSelector(getActiveCall)
  const currentConversation = useSelector(getConversation)

  // Use the same call status polling that CallStatusBanner uses (this is working!)
  const { 
    data: callStatusData, 
    error: callStatusError,
    isLoading: isCallStatusLoading,
    isFetching: isCallStatusFetching
  } = useGetCallStatusQuery(
    activeCall?.conversationId || '',
    {
      pollingInterval: 2000, // Poll every 2 seconds for live call updates
      skip: !activeCall?.conversationId || activeCall.conversationId === 'temp-call',
    }
  )

  // Fallback: Try to get full conversation data if call status is working
  const { 
    data: liveConversationData, 
    error: conversationError,
    isLoading: isConversationLoading,
    isFetching: isConversationFetching
  } = useGetConversationQuery(
    { conversationId: activeCall?.conversationId || '' },
    {
      pollingInterval: 3000, // Poll every 3 seconds (less frequent than call status)
      skip: !activeCall?.conversationId || activeCall.conversationId === 'temp-call' || !callStatusData,
      // Only try conversation API if call status is working
    }
  )

  // Log call status and conversation polling activity
  React.useEffect(() => {
    console.log('💬 CallScreen - Call status polling:', {
      conversationId: activeCall?.conversationId,
      callStatusLoading: isCallStatusLoading,
      callStatusFetching: isCallStatusFetching,
      callStatusData: !!callStatusData,
      callStatusError: !!callStatusError,
      conversationLoading: isConversationLoading,
      conversationFetching: isConversationFetching,
      conversationData: !!liveConversationData,
      conversationError: !!conversationError,
      conversationErrorStatus: (conversationError as any)?.status,
    })
    
    // Log AI speaking status
    if (callStatusData?.data?.aiSpeaking) {
      console.log('🎤 CallScreen - AI Speaking Status:', {
        isSpeaking: callStatusData.data.aiSpeaking.isSpeaking,
        userIsSpeaking: callStatusData.data.aiSpeaking.userIsSpeaking,
        conversationState: callStatusData.data.aiSpeaking.conversationState,
        timestamp: new Date().toISOString()
      });
    }
    
    // Log message count
    if (callStatusData?.data?.messages) {
      console.log('💬 CallScreen - Messages from call status:', {
        messageCount: callStatusData.data.messages.length,
        messages: callStatusData.data.messages.map(m => ({
          id: m.id,
          role: m.role,
          content: m.content?.substring(0, 50) + '...',
          createdAt: m.createdAt
        })),
        timestamp: new Date().toISOString()
      });
    }
    
    // Log specific 404 errors with more context
    if ((conversationError as any)?.status === 404) {
      console.warn('⚠️ CallScreen - Conversation not found (404), but call status is working:', {
        conversationId: activeCall?.conversationId,
        callStatusWorking: !!callStatusData,
        error: conversationError,
        timestamp: new Date().toISOString(),
        note: 'Using call status data as primary source'
      });
    }
  }, [activeCall?.conversationId, isCallStatusLoading, isCallStatusFetching, callStatusData, callStatusError, isConversationLoading, isConversationFetching, liveConversationData, conversationError])

  // Use live conversation data if available, otherwise use call status data, then fall back to Redux store
  const conversationToDisplay = liveConversationData || 
    (callStatusData?.data ? {
      id: callStatusData.data.conversationId,
      messages: callStatusData.data.messages || [], // Now includes messages from call status API
      startTime: callStatusData.data.startTime,
      endTime: callStatusData.data.endTime,
      duration: callStatusData.data.duration,
      status: callStatusData.data.status,
      patientId: callStatusData.data.patient._id,
      callSid: '', // Not available in call status
      lineItemId: null,
      history: '',
      analyzedData: {},
      metadata: {}
    } : null) || currentConversation

  // Log conversation updates and sync with Redux store
  React.useEffect(() => {
    if (liveConversationData) {
      console.log('💬 CallScreen - Live conversation data updated:', {
        conversationId: liveConversationData.id,
        messageCount: liveConversationData.messages?.length || 0,
        lastMessage: liveConversationData.messages?.[liveConversationData.messages.length - 1]?.content?.substring(0, 50) || 'No messages',
        timestamp: new Date().toISOString()
      })
      
      // Ensure the live conversation data is set as the current conversation in Redux
      // This ensures the conversation screen shows the same conversation as the call status banner
      if (liveConversationData.id !== currentConversation?.id) {
        console.log('🔄 CallScreen - Syncing live conversation to Redux store:', liveConversationData.id);
        dispatch(setConversation(liveConversationData));
      }
    }
  }, [liveConversationData, currentConversation?.id, dispatch])

  // Consume pending call data when component mounts
  React.useEffect(() => {
    if (!activeCall) {
      console.log('CallScreen - Consuming pending call data')
      dispatch(consumePendingCallData())
    }
  }, [activeCall, dispatch])



  if (!patient) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Call</Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No patient selected</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Call with {patient.name}</Text>
      </View>

      {/* Call Status Banner - Prominently displayed */}
      {activeCall && (
        <View style={styles.bannerContainer}>
          <CallStatusBanner
            conversationId={activeCall.conversationId || 'temp-call'}
            initialStatus={activeCall.status || 'initiated'}
            patientName={patient.name}
            onStatusChange={(status) => {
              console.log('Call status changed:', status)
            }}
          />
        </View>
      )}
      
      {/* Debug info for activeCall */}
      {__DEV__ && activeCall && (
        <View style={styles.debugContainer}>
          <Text style={styles.debugText}>Debug: activeCall.conversationId = {activeCall.conversationId || 'undefined'}</Text>
          <Text style={styles.debugText}>Debug: activeCall.status = {activeCall.status || 'undefined'}</Text>
        </View>
      )}
      
      {/* Debug info */}
      {__DEV__ && (
        <View style={styles.debugContainer}>
          <Text style={styles.debugText}>Debug: activeCall = {JSON.stringify(activeCall, null, 2)}</Text>
          <Text style={styles.debugText}>Debug: call status polling = {isCallStatusFetching ? 'ACTIVE' : 'INACTIVE'}</Text>
          <Text style={styles.debugText}>Debug: conversation polling = {isConversationFetching ? 'ACTIVE' : 'INACTIVE'}</Text>
          <Text style={styles.debugText}>Debug: live conversation messages = {conversationToDisplay?.messages?.length || 0}</Text>
          <Text style={styles.debugText}>Debug: using call status data = {!!callStatusData && !liveConversationData ? 'YES' : 'NO'}</Text>
          {(conversationError as any)?.status === 404 && callStatusData && (
            <Text style={[styles.debugText, { color: 'orange' }]}>
              Debug: Conversation API 404, but call status working - using fallback
            </Text>
          )}
        </View>
      )}

      {/* Conversation Loading/Error State */}
      {(conversationError as any)?.status === 404 && callStatusData && (
        <View style={styles.warningContainer}>
          <Text style={styles.warningText}>
            📞 Call is active - conversation details loading...
          </Text>
          <Text style={[styles.warningText, { fontSize: 12, marginTop: 4 }]}>
            Using call status data while conversation API catches up.
          </Text>
        </View>
      )}

      {/* Call Information */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Call Details</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Patient:</Text>
            <Text style={styles.infoValue}>{patient.name}</Text>
          </View>
          
          {patient.phone && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Phone:</Text>
              <Text style={styles.infoValue}>{patient.phone}</Text>
            </View>
          )}

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Status:</Text>
            <Text style={styles.infoValue}>
              {activeCall?.status ? activeCall.status.replace('-', ' ').toUpperCase() : 'INITIATED'}
            </Text>
          </View>
        </View>

        {/* Live Conversation Display */}
        <View style={styles.conversationSection}>
          <Text style={styles.sectionTitle}>
            Live Conversation
            {isConversationFetching && (
              <Text style={styles.liveIndicator}> 🔄</Text>
            )}
            {callStatusData?.data?.aiSpeaking?.isSpeaking && (
              <Text style={styles.speakingIndicator}> 🎤 AI Speaking...</Text>
            )}
            {callStatusData?.data?.aiSpeaking?.userIsSpeaking && (
              <Text style={styles.speakingIndicator}> 👤 User Speaking...</Text>
            )}
          </Text>
          
        <ConversationMessages
          messages={conversationToDisplay?.messages || []}
          style={styles.messagesContainer}
        />
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.palette.biancaBackground,
    flex: 1,
  },
  header: {
    alignItems: "center",
    backgroundColor: colors.palette.neutral100,
    borderBottomWidth: 1,
    borderColor: colors.palette.biancaBorder,
    paddingVertical: 20,
  },
  headerTitle: {
    color: colors.palette.biancaHeader,
    fontSize: 20,
    fontWeight: "600",
  },
  bannerContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.palette.neutral100,
    borderBottomWidth: 1,
    borderColor: colors.palette.biancaBorder,
  },
  warningContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff3cd',
    borderBottomWidth: 1,
    borderColor: '#ffeaa7',
  },
  warningText: {
    color: '#856404',
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  infoSection: {
    backgroundColor: colors.palette.neutral100,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    elevation: 1,
    shadowColor: colors.palette.neutral900,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  sectionTitle: {
    color: colors.palette.biancaHeader,
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
  },
  liveIndicator: {
    color: colors.palette.biancaSuccess,
    fontSize: 16,
  },
  speakingIndicator: {
    color: colors.palette.biancaPrimary,
    fontSize: 14,
    fontWeight: "500",
    marginLeft: 8,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.palette.biancaBorder,
  },
  infoLabel: {
    color: colors.palette.neutral600,
    fontSize: 16,
    fontWeight: "500",
  },
  infoValue: {
    color: colors.palette.biancaHeader,
    fontSize: 16,
  },
  conversationSection: {
    backgroundColor: colors.palette.neutral100,
    borderRadius: 8,
    padding: 16,
    elevation: 1,
    shadowColor: colors.palette.neutral900,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  messagesContainer: {
    borderTopColor: colors.palette.biancaBorder,
    borderTopWidth: 1,
    paddingBottom: 16,
    paddingTop: 12,
  },
  errorContainer: {
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    color: colors.palette.biancaError,
    fontSize: 16,
  },
  debugContainer: {
    backgroundColor: colors.palette.neutral200,
    padding: 8,
    margin: 8,
    borderRadius: 4,
  },
  debugText: {
    color: colors.palette.neutral600,
    fontSize: 12,
    fontFamily: 'monospace',
  },
})
