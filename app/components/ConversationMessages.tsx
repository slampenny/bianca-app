import React from "react"
import { View, StyleSheet, ViewStyle } from "react-native"
import { Text } from "./Text"
import { Message } from "../services/api/api.types"
import { useTheme } from "../theme/ThemeContext"

interface ConversationMessagesProps {
  messages: Message[]
  style?: ViewStyle
  'data-testid'?: string
}

export function ConversationMessages({ messages, style, 'data-testid': testId }: ConversationMessagesProps) {
  const { colors } = useTheme()

  // Sort messages by creation time to ensure proper ordering
  const sortedMessages = React.useMemo(() => {
    // Create a copy of the messages array to avoid mutating the original
    return [...messages].sort((a, b) => {
      const timeA = new Date(a.createdAt || 0).getTime()
      const timeB = new Date(b.createdAt || 0).getTime()
      return timeA - timeB
    })
  }, [messages])

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

  const renderMessage = (message: Message, index: number) => {
    const isUser = message.role === "patient"
    
    return (
      <View key={`${message.id || index}`} style={styles.messageContainer}>
        
        {/* Regular message (user or assistant) */}
        {(
          <View
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
              data-testid={`message-bubble-${message.id || index}`}
            >
              <Text style={[
                styles.messageText,
                isUser ? styles.userMessageText : styles.assistantMessageText,
              ]}>
                {message.content}
              </Text>
              <Text 
                style={[
                  styles.messageTime,
                  isUser ? styles.userMessageTime : styles.assistantMessageTime,
                ]}
                data-testid={`message-time-${message.id || index}`}
              >
                {formatDate(message.createdAt || new Date().toISOString())}
              </Text>
            </View>
          </View>
        )}
      </View>
    )
  }

  const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
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
  debugUserMessageContainer: {
    alignSelf: "flex-end",
    marginLeft: "30%", // More indented than regular user messages
    marginRight: "10%",
    maxWidth: "70%", // Slightly smaller than regular messages
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
    // Use theme-aware colored background
    backgroundColor: colors.palette?.biancaButtonSelected || colors.palette?.primary500 || colors.tint || "#0EA5E9",
    borderBottomRightRadius: 4, // WhatsApp-style tail
  },
  assistantBubble: {
    // Use theme-aware colored background  
    backgroundColor: colors.palette?.biancaSuccess || colors.palette?.success500 || colors.success || "#22C55E",
    borderBottomLeftRadius: 4, // WhatsApp-style tail
  },
  debugUserBubble: {
    backgroundColor: colors.palette?.warning100 || "#FEF9C3", // Light yellow/warning background
    borderBottomRightRadius: 4, // WhatsApp-style tail
    borderWidth: 1,
    borderColor: colors.palette?.warning300 || "#FDE047", // Warning border
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
    marginBottom: 4,
  },
  userMessageText: {
    // CRITICAL: Text on colored backgrounds (blue bubbles) must always be white for visibility
    // Both in dark and light mode, white text provides best contrast on blue/green backgrounds
    color: "#FFFFFF",
  },
  assistantMessageText: {
    // CRITICAL: Text on colored backgrounds (green bubbles) must always be white for visibility
    // Both in dark and light mode, white text provides best contrast on blue/green backgrounds
    color: "#FFFFFF",
  },
  debugUserMessageText: {
    color: colors.palette.warning800, // Dark warning text
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 4,
    fontStyle: 'italic',
  },
  messageTime: {
    fontSize: 11,
    opacity: 0.7,
  },
  userMessageTime: {
    // CRITICAL: Text on colored backgrounds (blue bubbles) must always be white for visibility
    color: "#FFFFFF",
    textAlign: "right",
  },
  assistantMessageTime: {
    // CRITICAL: Text on colored backgrounds (green bubbles) must always be white for visibility
    color: "#FFFFFF",
    textAlign: "left",
  },
  debugUserMessageTime: {
    color: colors.palette.warning800,
    textAlign: "right",
    fontSize: 10,
  },
  noMessagesContainer: {
    alignItems: "center",
    paddingVertical: 20,
  },
    noMessagesText: {
    // Use theme-aware text color with fallbacks
    color: colors.textDim || colors.palette?.neutral600 || colors.palette?.neutral400 || "#666666",
    fontSize: 16,
    fontStyle: "italic",
    textAlign: "center",
  },
  })
  
  const styles = createStyles(colors)
  
  return (
    <View style={[styles.container, style]} data-testid={testId}>
      {sortedMessages.length > 0 ? (
        sortedMessages.map((message, index) => renderMessage(message, index))
      ) : (
        <View style={styles.noMessagesContainer}>
          <Text style={styles.noMessagesText}>
            No messages yet. The conversation will appear here as it unfolds...
          </Text>
        </View>
      )}
    </View>
  )
}
