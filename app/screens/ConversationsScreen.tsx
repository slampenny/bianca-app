import React, { useEffect, useState, useCallback } from "react"
import { View, Text, StyleSheet, ActivityIndicator, FlatList, Pressable, RefreshControl } from "react-native"
import { useSelector } from "react-redux"
import { useGetConversationsByPatientQuery } from "../services/api/conversationApi"
import { getPatient } from "../store/patientSlice"
import { Conversation, Message, ConversationPages } from "../services/api/api.types"
import { colors } from "app/theme/colors"

export function ConversationsScreen() {
  const patient = useSelector(getPatient)
  const [expandedConversations, setExpandedConversations] = useState<Set<string>>(new Set())
  const [refreshing, setRefreshing] = useState(false)
  const [page, setPage] = useState(1)
  const [allConversations, setAllConversations] = useState<Conversation[]>([])
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

  // Handle paginated data
  useEffect(() => {
    if (conversationsData) {
      if (page === 1) {
        // First page, replace all conversations
        setAllConversations(conversationsData.results)
      } else {
        // Subsequent pages, append to existing conversations
        setAllConversations(prev => [...prev, ...conversationsData.results])
      }
      setHasMore(conversationsData.page < conversationsData.totalPages)
    }
  }, [conversationsData, page])

  useEffect(() => {
    if (patient?.id) {
      setPage(1)
      setAllConversations([])
      setHasMore(true)
      refetch()
    }
  }, [patient?.id, refetch])

  const loadMoreConversations = useCallback(() => {
    if (hasMore && !isLoading) {
      setPage(prev => prev + 1)
    }
  }, [hasMore, isLoading])

  const onRefresh = async () => {
    setRefreshing(true)
    setPage(1)
    setAllConversations([])
    setHasMore(true)
    await refetch()
    setRefreshing(false)
  }

  const toggleConversation = (conversationId: string) => {
    const newExpanded = new Set(expandedConversations)
    if (newExpanded.has(conversationId)) {
      newExpanded.delete(conversationId)
    } else {
      newExpanded.add(conversationId)
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
      <View style={styles.conversationCard}>
        <Pressable
          style={styles.conversationHeader}
          onPress={() => toggleConversation(item.id!)}
          android_ripple={{ color: colors.palette.biancaButtonUnselected }}
        >
          <View style={styles.conversationInfo}>
            <Text style={styles.conversationTitle}>
              Conversation {formatDate(conversationDate)}
            </Text>
            <Text style={styles.conversationPreview}>
              {getConversationPreview(item.messages || [])}
            </Text>
            <Text style={styles.messageCount}>
              {messageCount} message{messageCount !== 1 ? 's' : ''}
            </Text>
          </View>
          <View style={styles.expandIcon}>
            <Text style={styles.expandIconText}>
              {isExpanded ? '▼' : '▶'}
            </Text>
          </View>
        </Pressable>

        {isExpanded && (
          <View style={styles.messagesContainer}>
            {(item.messages || []).map((message: Message, index: number) => {
              const isUser = message.role === "user"
              return (
                <View
                  key={`${item.id}-${index}`}
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
        )}
      </View>
    )
  }

  const renderEmpty = () => (
    <Text style={styles.noConversationsText}>No conversations to display</Text>
  )

  // Conversations are already sorted by the backend (startTime:desc)
  const conversations = allConversations

  return (
    <View style={styles.container}>
      {/* Loading/Error States */}
      {isLoading && !refreshing && (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={colors.palette.biancaButtonSelected} />
        </View>
      )}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error fetching conversations</Text>
        </View>
      )}

      {/* Conversations List */}
      {!isLoading && !error && (
        <FlatList
          data={conversations}
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
    </View>
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
  container: {
    backgroundColor: colors.palette.biancaBackground,
    flex: 1,
  },
  conversationCard: {
    backgroundColor: colors.palette.neutral100,
    marginBottom: 8,
    borderRadius: 8,
    shadowColor: colors.palette.neutral900,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
    overflow: "hidden",
  },
  conversationHeader: {
    flexDirection: "row",
    padding: 16,
    alignItems: "center",
  },
  conversationInfo: {
    flex: 1,
  },
  conversationTitle: {
    color: colors.palette.biancaHeader,
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  conversationPreview: {
    color: colors.palette.neutral600,
    fontSize: 14,
    marginBottom: 4,
  },
  messageCount: {
    color: colors.palette.biancaButtonSelected,
    fontSize: 12,
    fontWeight: "500",
  },
  expandIcon: {
    marginLeft: 12,
  },
  expandIconText: {
    color: colors.palette.biancaButtonSelected,
    fontSize: 16,
    fontWeight: "bold",
  },
  messagesContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: colors.palette.biancaBorder,
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
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: colors.palette.neutral900,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
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
  errorContainer: {
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    color: colors.palette.biancaError,
    fontSize: 16,
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
  loaderContainer: {
    padding: 20,
  },
  loadMoreContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  loadMoreText: {
    color: colors.palette.neutral600,
    fontSize: 14,
    marginLeft: 8,
  },
  noConversationsText: {
    color: colors.palette.neutral600,
    fontSize: 16,
    marginTop: 20,
    textAlign: "center",
  },
})
