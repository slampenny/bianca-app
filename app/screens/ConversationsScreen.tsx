import React, { useEffect, useState, useCallback } from "react"
import { View, Text, StyleSheet, ActivityIndicator, FlatList, RefreshControl } from "react-native"
import { useSelector, useDispatch } from "react-redux"
import { useGetConversationsByPatientQuery } from "../services/api/conversationApi"
import { getPatient } from "../store/patientSlice"
import { getConversations, clearConversations, getConversation, setConversation } from "../store/conversationSlice"
import { getActiveCall } from "../store/callSlice"
import { Conversation, Message } from "../services/api/api.types"
import { colors } from "app/theme/colors"
import { SentimentIndicator } from "../components/SentimentIndicator"
import { ConversationMessages } from "../components/ConversationMessages"
import { Screen } from "../components/Screen"
import { Card } from "../components/Card"

export function ConversationsScreen() {
  const patient = useSelector(getPatient)
  const conversations = useSelector(getConversations)
  const currentConversation = useSelector(getConversation)
  const activeCall = useSelector(getActiveCall)
  const dispatch = useDispatch()
  const [expandedConversations, setExpandedConversations] = useState<Set<string>>(new Set())
  const [refreshing, setRefreshing] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  const {
    data: conversationsData,
    error,
    isLoading,
    refetch,
  } = useGetConversationsByPatientQuery(
    { 
      patientId: patient?.id as string,
      page,
      limit: 10,
      sortBy: 'startTime:desc'
    },
    { skip: !patient?.id },
  )

  // Handle pagination state
  useEffect(() => {
    if (conversationsData) {
      console.log(`[ConversationsScreen] Received conversations data:`, {
        page: conversationsData.page,
        totalPages: conversationsData.totalPages,
        totalResults: conversationsData.totalResults,
        resultsCount: conversationsData.results?.length || 0,
        conversationIds: conversationsData.results?.map(c => c.id) || []
      });
      
      setHasMore(conversationsData.page < conversationsData.totalPages)
    }
  }, [conversationsData])

  useEffect(() => {
    if (patient?.id) {
      setPage(1)
      setHasMore(true)
      dispatch(clearConversations())
      refetch()
    }
  }, [patient?.id, refetch, dispatch])

  // Debug logging for Redux state
  useEffect(() => {
    console.log(`[ConversationsScreen] Redux conversations state:`, {
      conversationsCount: conversations.length,
      conversationIds: conversations.map(c => ({ id: c.id, startTime: c.startTime })),
      currentConversationId: currentConversation?.id
    });
  }, [conversations, currentConversation]);

  const loadMoreConversations = useCallback(() => {
    console.log(`[ConversationsScreen] loadMoreConversations called:`, {
      hasMore,
      isLoading,
      currentPage: page,
      currentConversationsCount: conversations.length
    });
    
    if (hasMore && !isLoading) {
      console.log(`[ConversationsScreen] Loading page ${page + 1}`);
      setPage(prev => prev + 1)
    } else {
      console.log(`[ConversationsScreen] Cannot load more:`, {
        hasMore,
        isLoading
      });
    }
  }, [hasMore, isLoading, page, conversations.length])

  const onRefresh = async () => {
    setRefreshing(true)
    setPage(1)
    setHasMore(true)
    dispatch(clearConversations())
    await refetch()
    setRefreshing(false)
  }

  const toggleConversation = (conversationId: string) => {
    const newExpanded = new Set(expandedConversations)
    if (newExpanded.has(conversationId)) {
      newExpanded.delete(conversationId)
    } else {
      newExpanded.add(conversationId)
      // Set this conversation as the current one in Redux
      const conversation = conversations.find(c => c.id === conversationId)
      if (conversation) {
        dispatch(setConversation(conversation))
      }
    }
    setExpandedConversations(newExpanded)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } else if (diffInHours < 48) {
      return 'Yesterday'
    } else {
      return date.toLocaleDateString()
    }
  }

  const getConversationPreview = (messages: Message[]) => {
    if (messages.length === 0) return "No messages"
    const lastMessage = messages[messages.length - 1]
    return lastMessage.content.length > 50 
      ? lastMessage.content.substring(0, 50) + "..."
      : lastMessage.content
  }

  if (!patient) {
    return (
      <View style={styles.container}>
        <Header title="Conversations" />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No patient selected</Text>
        </View>
      </View>
    )
  }

  const renderConversation = ({ item }: { item: Conversation }) => {
    const isExpanded = expandedConversations.has(item.id!)
    const messageCount = item.messages?.length || 0
    const lastMessage = item.messages?.[item.messages.length - 1]
    const conversationDate = lastMessage?.createdAt || item.startTime || new Date().toISOString()

    return (
      <Card 
        style={styles.conversationCard} 
        testID={`conversation-card-${item.id}`}
        heading={`Conversation ${formatDate(conversationDate)}`}
        content={`${getConversationPreview(item.messages || [])}\n${messageCount} message${messageCount !== 1 ? 's' : ''}`}
        RightComponent={
          <View style={styles.rightComponent}>
            {item.sentiment && (
              <SentimentIndicator 
                sentiment={item.sentiment} 
                size="small" 
                showScore={false}
                showMood={false}
              />
            )}
            <Text style={styles.expandIconText}>
              {isExpanded ? '▼' : '▶'}
            </Text>
          </View>
        }
        ContentComponent={
          isExpanded ? (
            <ConversationMessages
              messages={item.messages || []}
              style={styles.messagesContainer}
              data-testid={`messages-container-${item.id}`}
            />
          ) : undefined
        }
        onPress={() => toggleConversation(item.id!)}
      />
    )
  }

  const renderEmpty = () => (
    <Text style={styles.noConversationsText}>
      {activeCall 
        ? "No previous conversations found. This will be the first conversation with this patient." 
        : "No conversations to display"
      }
    </Text>
  )

  // Conversations are already sorted by the backend (startTime:desc)
  const conversationsToRender = conversations

  return (
    <Screen preset="scroll" testID="conversations-screen">
      {/* Debug info for active call */}
      {__DEV__ && activeCall && (
        <View style={{ padding: 10, backgroundColor: '#f0f0f0', margin: 10 }}>
          <Text>Debug - Active Call:</Text>
          <Text>conversationId: {activeCall.conversationId || 'undefined'}</Text>
          <Text>status: {activeCall.status || 'undefined'}</Text>
          <Text>Full activeCall: {JSON.stringify(activeCall, null, 2)}</Text>
        </View>
      )}

      {/* Loading/Error States */}
      {isLoading && !refreshing && (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={colors.palette.biancaButtonSelected} />
        </View>
      )}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            {activeCall 
              ? "No previous conversations found for this patient" 
              : "Error fetching conversations"
            }
          </Text>
        </View>
      )}

      {/* Conversations List */}
      {!isLoading && !error && (
        <FlatList
          data={conversationsToRender}
          keyExtractor={(item, index) => item.id ? String(item.id) : String(index)}
          renderItem={renderConversation}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.palette.biancaButtonSelected]}
              tintColor={colors.palette.biancaButtonSelected}
            />
          }
          onEndReached={loadMoreConversations}
          onEndReachedThreshold={0.1}
          ListFooterComponent={
            hasMore && !isLoading ? (
              <View style={styles.loadMoreContainer}>
                <ActivityIndicator size="small" color={colors.palette.biancaButtonSelected} />
                <Text style={styles.loadMoreText}>Loading more conversations...</Text>
              </View>
            ) : null
          }
        />
      )}
    </Screen>
  )
}

/** Example Header component */
function Header({ title }: { title: string }) {
  return (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>{title}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  assistantBubble: {
    backgroundColor: colors.palette.biancaSuccess, // Green for assistant
    borderBottomLeftRadius: 4, // WhatsApp-style tail
  },
  assistantMessageContainer: {
    alignSelf: "flex-start",
    marginRight: "20%",
  },
  assistantMessageText: {
    color: colors.palette.neutral100, // White text on green
  },
  assistantMessageTime: {
    color: colors.palette.neutral100,
    textAlign: "left",
  },
  container: {
    backgroundColor: colors.palette.biancaBackground,
    flex: 1,
  },
  conversationCard: {
    backgroundColor: colors.palette.neutral100,
    borderRadius: 8,
    elevation: 1,
    marginBottom: 8,
    overflow: "hidden",
    shadowColor: colors.palette.neutral900,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  conversationHeader: {
    alignItems: "center",
    flexDirection: "row",
    padding: 16,
  },
  conversationInfo: {
    flex: 1,
  },
  conversationHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  conversationPreview: {
    color: colors.palette.neutral600,
    fontSize: 14,
    marginBottom: 4,
  },
  conversationTitle: {
    color: colors.palette.biancaHeader,
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  errorContainer: {
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    color: colors.palette.biancaError,
    fontSize: 16,
  },
  expandIcon: {
    marginLeft: 12,
  },
  expandIconText: {
    color: colors.palette.biancaButtonSelected,
    fontSize: 16,
    fontWeight: "bold",
  },
  header: {
    alignItems: "center",
    backgroundColor: colors.palette.neutral100,
    borderBottomWidth: 1,
    borderColor: colors.palette.biancaBorder,
    paddingVertical: 16,
  },
  headerTitle: {
    color: colors.palette.biancaHeader,
    fontSize: 20,
    fontWeight: "600",
  },
  listContent: {
    paddingBottom: 24,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  loadMoreContainer: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    padding: 16,
  },
  loadMoreText: {
    color: colors.palette.neutral600,
    fontSize: 14,
    marginLeft: 8,
  },
  rightComponent: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  loaderContainer: {
    padding: 20,
  },
  messageCount: {
    color: colors.palette.biancaButtonSelected,
    fontSize: 12,
    fontWeight: "500",
  },
  messagesContainer: {
    borderTopColor: colors.palette.biancaBorder,
    borderTopWidth: 1,
    paddingBottom: 16,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  noConversationsText: {
    color: colors.palette.neutral600,
    fontSize: 16,
    marginTop: 20,
    textAlign: "center",
  },
})
