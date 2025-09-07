import React from "react"
import { View, Text, StyleSheet, ScrollView } from "react-native"
import { useSelector, useDispatch } from "react-redux"
import { getPatient } from "../store/patientSlice"
import { getConversation, setConversation } from "../store/conversationSlice"
import { getActiveCall, consumePendingCallData } from "../store/callSlice"
import { CallStatusBanner } from "../components/CallStatusBanner"
import { useGetConversationQuery } from "../services/api/conversationApi"
import { colors } from "app/theme/colors"
import { Message } from "../services/api/api.types"

export function CallScreen() {
  const dispatch = useDispatch()
  const patient = useSelector(getPatient)
  const activeCall = useSelector(getActiveCall)
  const currentConversation = useSelector(getConversation)

  // Real-time conversation polling for live call messages
  const { 
    data: liveConversationData, 
    error: conversationError,
    isLoading: isConversationLoading,
    isFetching: isConversationFetching
  } = useGetConversationQuery(
    { conversationId: activeCall?.conversationId || '' },
    {
      pollingInterval: 2000, // Poll every 2 seconds for live conversation updates
      skip: !activeCall?.conversationId || activeCall.conversationId === 'temp-call'
    }
  )

  // Log conversation polling activity
  React.useEffect(() => {
    console.log('💬 CallScreen - Conversation polling status:', {
      conversationId: activeCall?.conversationId,
      isLoading: isConversationLoading,
      isFetching: isConversationFetching,
      hasData: !!liveConversationData,
      hasError: !!conversationError,
      skip: !activeCall?.conversationId || activeCall.conversationId === 'temp-call'
    })
  }, [activeCall?.conversationId, isConversationLoading, isConversationFetching, liveConversationData, conversationError])

  // Use live conversation data if available, otherwise fall back to Redux store
  const conversationToDisplay = liveConversationData || currentConversation

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


  // Helper function to format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)
    
    if (diffInHours < 1) {
      const diffInMinutes = Math.round(diffInHours * 60)
      return `${diffInMinutes}m ago`
    } else if (diffInHours < 24) {
      return `${Math.round(diffInHours)}h ago`
    } else {
      return date.toLocaleDateString()
    }
  }

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
          <Text style={styles.debugText}>Debug: conversation polling = {isConversationFetching ? 'ACTIVE' : 'INACTIVE'}</Text>
          <Text style={styles.debugText}>Debug: live conversation messages = {conversationToDisplay?.messages?.length || 0}</Text>
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
          </Text>
          
          {conversationToDisplay && conversationToDisplay.messages && conversationToDisplay.messages.length > 0 ? (
            <View style={styles.messagesContainer}>
              {conversationToDisplay.messages.map((message: Message, index: number) => {
                const isUser = message.role === "user"
                return (
                  <View
                    key={`${conversationToDisplay.id}-${index}`}
                    style={[
                      styles.messageContainer,
                      isUser ? styles.userMessageContainer : styles.assistantMessageContainer,
                    ]}
                  >
                    <View
                      style={[
                        styles.messageBubble,
                        isUser ? styles.userBubble : styles.assistantBubble,
                      ]}
                    >
                      <Text style={[
                        styles.messageText,
                        isUser ? styles.userMessageText : styles.assistantMessageText,
                      ]}>
                        {message.content}
                      </Text>
                      <Text style={[
                        styles.messageTime,
                        isUser ? styles.userMessageTime : styles.assistantMessageTime,
                      ]}>
                        {formatDate(message.createdAt || new Date().toISOString())}
                      </Text>
                    </View>
                  </View>
                )
              })}
            </View>
          ) : (
            <View style={styles.noMessagesContainer}>
              <Text style={styles.noMessagesText}>
                No messages yet. The conversation will appear here as it unfolds...
              </Text>
            </View>
          )}
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
  messageContainer: {
    marginBottom: 8,
    maxWidth: "80%",
  },
  userMessageContainer: {
    alignSelf: "flex-end",
    marginLeft: "20%",
  },
  assistantMessageContainer: {
    alignSelf: "flex-start",
    marginRight: "20%",
  },
  messageBubble: {
    borderRadius: 18,
    elevation: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: colors.palette.neutral900,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  userBubble: {
    backgroundColor: colors.palette.biancaButtonSelected, // Blue for user
    borderBottomRightRadius: 4, // WhatsApp-style tail
  },
  assistantBubble: {
    backgroundColor: colors.palette.biancaSuccess, // Green for assistant
    borderBottomLeftRadius: 4, // WhatsApp-style tail
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
    marginBottom: 4,
  },
  userMessageText: {
    color: colors.palette.neutral100, // White text on blue
  },
  assistantMessageText: {
    color: colors.palette.neutral100, // White text on green
  },
  messageTime: {
    fontSize: 11,
    opacity: 0.7,
  },
  userMessageTime: {
    color: colors.palette.neutral100,
    textAlign: "right",
  },
  assistantMessageTime: {
    color: colors.palette.neutral100,
    textAlign: "left",
  },
  noMessagesContainer: {
    alignItems: "center",
    paddingVertical: 20,
  },
  noMessagesText: {
    color: colors.palette.neutral400,
    fontSize: 16,
    fontStyle: "italic",
    textAlign: "center",
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
