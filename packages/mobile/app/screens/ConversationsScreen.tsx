import React, { useEffect, useState, useCallback, useMemo, useRef } from "react"
import { View, StyleSheet, ActivityIndicator, FlatList, RefreshControl } from "react-native"
import { Text } from "../components"
import { useSelector, useDispatch } from "react-redux"
import { useGetConversationsByClientQuery } from "../services/api/conversationApi"
import { getClient } from "../store/clientSlice"
import { getConversations, clearConversations, getConversation, setConversation } from "../store/conversationSlice"
import { getActiveCall } from "../store/callSlice"
import { Conversation, Message, RequiredCallQuestionAnswer } from "../services/api/api.types"
import { useTheme } from "app/theme/ThemeContext"
import type { ThemeColors } from "../types"
import { SentimentIndicator } from "../components/SentimentIndicator"
import { ConversationMessages } from "../components/ConversationMessages"
import { Screen } from "../components/Screen"
import { Card } from "../components/Card"
import { translate } from "../i18n"
import { logger } from "../utils/logger"

const createStyles = (colors: ThemeColors) => StyleSheet.create({
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
  debugContainer: {
    padding: 10,
    backgroundColor: colors.palette.neutral200,
    margin: 10,
    borderRadius: 5,
  },
  debugText: {
    color: colors.palette.biancaHeader,
    fontSize: 12,
  },
  standardQuestionsSection: {
    borderTopColor: colors.palette.biancaBorder,
    borderTopWidth: 1,
    marginTop: 8,
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  standardQuestionsTitle: {
    color: colors.palette.biancaHeader,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  standardQuestionRow: {
    marginBottom: 6,
  },
  standardQuestionPrompt: {
    color: colors.palette.neutral600,
    fontSize: 13,
    marginBottom: 2,
  },
  standardQuestionAnswer: {
    color: colors.palette.biancaHeader,
    fontSize: 14,
  },
})

export function ConversationsScreen() {
  const client = useSelector(getClient)
  const conversations = useSelector(getConversations)
  const currentConversation = useSelector(getConversation)
  const activeCall = useSelector(getActiveCall)
  const dispatch = useDispatch()
  const [expandedConversations, setExpandedConversations] = useState<Set<string>>(new Set())
  const [refreshing, setRefreshing] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const loadMoreThrottleRef = useRef(0)
  const { colors, isLoading: themeLoading } = useTheme()

  const {
    data: conversationsData,
    error,
    isLoading,
    refetch,
  } = useGetConversationsByClientQuery(
    { 
      clientId: client?.id as string,
      page,
      limit: 10,
      sortBy: 'startTime:desc'
    },
    { 
      skip: !client?.id,
      // Force refetch on mount to ensure fresh data
      refetchOnMountOrArgChange: true,
    },
  )

  // Handle pagination state (success)
  useEffect(() => {
    if (conversationsData) {
      logger.debug(`[ConversationsScreen] Received conversations data:`, {
        page: conversationsData.page,
        totalPages: conversationsData.totalPages,
        totalResults: conversationsData.totalResults,
        resultsCount: conversationsData.results?.length || 0,
        conversationIds: conversationsData.results?.map(c => c.id) || []
      });
      
      setHasMore(conversationsData.page < conversationsData.totalPages)
    }
  }, [conversationsData])

  // Stop pagination on error (e.g. 403) so we don't cycle through pages
  useEffect(() => {
    if (error) {
      logger.warn('[ConversationsScreen] Conversations request failed, stopping pagination', { error: (error as any)?.status })
      setHasMore(false)
    }
  }, [error])

  useEffect(() => {
    if (client?.id) {
      setPage(1)
      setHasMore(true)
      // Force refetch when client changes to ensure we get fresh data
      // Don't clear conversations here - let the API response handle it
      // This prevents conversations from disappearing during the API call
      refetch()
    } else {
      // If no client, clear conversations
      dispatch(clearConversations())
    }
  }, [client?.id, refetch, dispatch])

  // Debug logging for Redux state
  useEffect(() => {
    logger.debug(`[ConversationsScreen] Redux conversations state:`, {
      conversationsCount: conversations.length,
      conversationIds: conversations.map(c => ({ id: c.id, startTime: c.startTime })),
      currentConversationId: currentConversation?.id
    });
  }, [conversations, currentConversation]);

  const loadMoreConversations = useCallback(() => {
    if (error) return
    if (!hasMore || isLoading) return
    // Throttle: avoid rapid fire when onEndReached triggers repeatedly (e.g. short/empty list)
    const now = Date.now()
    if (now - loadMoreThrottleRef.current < 800) return
    loadMoreThrottleRef.current = now
    logger.debug(`[ConversationsScreen] Loading page ${page + 1}`);
    setPage(prev => prev + 1)
  }, [hasMore, isLoading, page, error])

  const onRefresh = async () => {
    setRefreshing(true)
    setPage(1)
    setHasMore(true)
    // Don't clear conversations on refresh - let the API response update them
    // This prevents conversations from disappearing during refresh
    await refetch()
    setRefreshing(false)
  }

  const toggleConversation = useCallback((conversationId: string) => {
    // Guard against invalid IDs
    if (!conversationId) {
      logger.warn('[ConversationsScreen] Cannot toggle conversation with invalid ID')
      return
    }
    
    setExpandedConversations(prev => {
      logger.debug('[ConversationsScreen] Toggling conversation:', conversationId, 'Current expanded:', Array.from(prev))
      
      // If this conversation is already expanded, collapse it
      if (prev.has(conversationId)) {
        logger.debug('[ConversationsScreen] Collapsing conversation:', conversationId)
        const newExpanded = new Set<string>()
        return newExpanded
      } else {
        // Otherwise, expand only this conversation (collapse all others)
        logger.debug('[ConversationsScreen] Expanding conversation:', conversationId)
        const newExpanded = new Set<string>([conversationId])
        
        // Set this conversation as the current one in Redux
        // Use conversationsData.results if available, otherwise fall back to Redux conversations
        const allConversations = conversationsData?.results || conversations
        // Try to find by id first, then by callSid as fallback
        const conversation = allConversations.find((c: any) => 
          c.id === conversationId || c.callSid === conversationId
        )
        if (conversation) {
          dispatch(setConversation(conversation))
        }
        
        logger.debug('[ConversationsScreen] New expanded set:', Array.from(newExpanded))
        return newExpanded
      }
    })
  }, [conversationsData, conversations, dispatch])

  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } else if (diffInHours < 48) {
      return translate("conversationsScreen.yesterday")
    } else {
      return date.toLocaleDateString()
    }
  }, [])

  const getRequiredQuestionAnswers = useCallback((conversation: Conversation): RequiredCallQuestionAnswer[] => {
    const rq = conversation.analyzedData?.requiredQuestions as
      | { answers?: RequiredCallQuestionAnswer[] }
      | undefined
    if (!rq?.answers?.length) return []
    return rq.answers.filter((a) => a && (a.answer || a.asked))
  }, [])

  const getConversationPreview = useCallback((messages: Message[]) => {
    if (messages.length === 0) return translate("conversationsScreen.noMessages")
    const lastMessage = messages[messages.length - 1]
    return lastMessage.content.length > 50 
      ? lastMessage.content.substring(0, 50) + "..."
      : lastMessage.content
  }, [])

  if (themeLoading) {
    return null
  }

  const styles = createStyles(colors)

  if (!client) {
    return (
      <View style={styles.container}>
        <Header title={translate("conversationsScreen.title")} colors={colors} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{translate("conversationsScreen.noClientSelected")}</Text>
        </View>
      </View>
    )
  }

  const renderConversation = ({ item, index }: { item: Conversation; index: number }) => {
    // Use ID if available, otherwise use callSid or index as fallback
    const conversationId = item.id || item.callSid || `temp-${index}`
    const isExpanded = expandedConversations.has(conversationId)
    const messageCount = item.messages?.length || 0
    const lastMessage = item.messages?.[item.messages.length - 1]
    const conversationDate = lastMessage?.createdAt || item.startTime || new Date().toISOString()

    const handlePress = () => {
      logger.debug('[ConversationsScreen] Card pressed for conversation:', conversationId)
      toggleConversation(conversationId)
    }

    return (
      <Card 
        style={styles.conversationCard} 
        testID={`conversation-card-${conversationId}`}
        accessibilityLabel={`conversation-card-${conversationId}`}
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
            <View>
              {getRequiredQuestionAnswers(item).length > 0 ? (
                <View style={styles.standardQuestionsSection}>
                  <Text style={styles.standardQuestionsTitle}>
                    {translate("conversationsScreen.standardQuestionsTitle")}
                  </Text>
                  {getRequiredQuestionAnswers(item).map((answer) => (
                    <View key={answer.questionId} style={styles.standardQuestionRow}>
                      <Text style={styles.standardQuestionPrompt}>{answer.prompt}</Text>
                      <Text style={styles.standardQuestionAnswer}>
                        {answer.answer || translate("conversationsScreen.standardQuestionNotAnswered")}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
              <ConversationMessages
                messages={item.messages || []}
                style={styles.messagesContainer}
                data-testid={`messages-container-${conversationId}`}
              />
            </View>
          ) : undefined
        }
        onPress={handlePress}
      />
    )
  }

  const renderEmpty = () => (
    <Text style={styles.noConversationsText}>
      {activeCall 
        ? translate("conversationsScreen.firstConversation") 
        : translate("conversationsScreen.noConversationsToDisplay")
      }
    </Text>
  )

  // Conversations are already sorted by the backend (startTime:desc)
  // Use conversationsData.results if available (from API), otherwise fall back to Redux conversations
  // Prioritize API data when available, but also show Redux data as fallback
  // Important: Only use Redux conversations if API hasn't loaded yet (isLoading) or if API data is undefined
  const conversationsToRender = useMemo(() => {
    // If API has loaded (!isLoading) and has results, use API results
    // BUT: If API returns empty array and we have Redux conversations, keep showing Redux until API has real data
    if (!isLoading && conversationsData?.results !== undefined) {
      // If API returned empty array but we have conversations in Redux, keep showing Redux
      // This handles the case where API returns empty due to cache/304 but we have data
      if (conversationsData.results.length === 0 && conversations && conversations.length > 0) {
        return conversations
      }
      return conversationsData.results
    }
    // While loading or if API data is undefined, show Redux conversations as fallback
    if (conversations && conversations.length > 0) {
      return conversations
    }
    // Default to empty array
    return []
  }, [conversationsData?.results, conversations, isLoading])

  // Determine if we should show the list (not loading, no error, or have data to show)
  const shouldShowList = !isLoading || conversationsToRender.length > 0

  return (
    <Screen preset="scroll" testID="conversations-screen">
      {/* Debug info for active call */}
      {__DEV__ && activeCall && (
        <View style={styles.debugContainer}>
          <Text style={styles.debugText}>Debug - Active Call:</Text>
          <Text style={styles.debugText}>conversationId: {activeCall.conversationId || 'undefined'}</Text>
          <Text style={styles.debugText}>status: {activeCall.status || 'undefined'}</Text>
          <Text style={styles.debugText}>Full activeCall: {JSON.stringify(activeCall, null, 2)}</Text>
        </View>
      )}

      {/* Loading State - only show if we have no data */}
      {isLoading && !refreshing && conversationsToRender.length === 0 && (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={colors.palette.biancaButtonSelected} />
        </View>
      )}
      
      {/* Error State */}
      {error && conversationsToRender.length === 0 && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            {activeCall 
              ? translate("conversationsScreen.noPreviousConversations") 
              : translate("conversationsScreen.errorFetchingConversations")
            }
          </Text>
        </View>
      )}

      {/* Conversations List - show if we have data OR if not loading/error */}
      {shouldShowList && (
        <FlatList
          data={conversationsToRender}
          keyExtractor={(item, index) => item.id ? String(item.id) : (item.callSid ? String(item.callSid) : String(index))}
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
            hasMore && isLoading ? (
              <View style={styles.loadMoreContainer}>
                <ActivityIndicator size="small" color={colors.palette.biancaButtonSelected} />
                <Text style={styles.loadMoreText}>{translate("conversationsScreen.loadingMoreConversations")}</Text>
              </View>
            ) : null
          }
        />
      )}
    </Screen>
  )
}

/** Example Header component */
function Header({ title, colors }: { title: string; colors: any }) {
  const headerStyles = {
    header: {
      alignItems: "center" as const,
      backgroundColor: colors.palette.neutral100,
      borderBottomWidth: 1,
      borderColor: colors.palette.biancaBorder,
      paddingVertical: 16,
    },
    headerTitle: {
      color: colors.palette.biancaHeader,
      fontSize: 20,
      fontWeight: "600" as const,
    },
  }
  return (
    <View style={headerStyles.header}>
      <Text style={headerStyles.headerTitle}>{title}</Text>
    </View>
  )
}
