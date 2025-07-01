import React, { useEffect } from "react"
import { View, Text, StyleSheet, ActivityIndicator, FlatList, Pressable } from "react-native"
import { useSelector } from "react-redux"
import { useGetConversationsByPatientQuery } from "../services/api/conversationApi"
import { getPatient } from "../store/patientSlice"
import { Conversation, Message } from "../services/api/api.types"
import { colors } from "app/theme/colors"

export function ConversationsScreen() {
  const patient = useSelector(getPatient)

  const {
    data: conversations,
    error,
    isLoading,
    refetch,
  } = useGetConversationsByPatientQuery(
    { patientId: patient?.id as string },
    { skip: !patient?.id },
  )

  useEffect(() => {
    if (patient?.id) {
      refetch()
    }
  }, [patient?.id, refetch])

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
    return (
      <View style={styles.conversationCard}>
        <Text style={styles.conversationTitle}>Conversation ID: {item.id}</Text>

        {item.messages.map((message: Message, index: number) => (
          <View
            key={`${item.id}-${index}`}
            style={[
              styles.messageBubble,
              // Example of slightly different background for patient vs doctor
              message.role === "patient" ? styles.patientBubble : undefined,
              message.role !== "patient" ? styles.doctorBubble : undefined,
            ]}
          >
            <Text style={styles.messageRole}>{message.role}:</Text>
            <Text style={styles.messageText}>{message.content}</Text>
          </View>
        ))}
      </View>
    )
  }

  const renderEmpty = () => (
    <Text style={styles.noConversationsText}>No conversations to display</Text>
  )

  return (
    <View style={styles.container}>
      {/* Loading/Error States */}
      {isLoading && (
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
    padding: 16,
    marginBottom: 12,
    borderRadius: 6,
    shadowColor: colors.palette.neutral900,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  conversationTitle: {
    color: colors.palette.biancaHeader,
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 12,
  },
  doctorBubble: {
    backgroundColor: colors.palette.biancaSuccessBackground, // Light green
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
  messageBubble: {
    borderRadius: 6,
    marginBottom: 8,
    padding: 10,
  },
  messageRole: {
    color: colors.palette.biancaHeader,
    fontWeight: "bold",
    marginBottom: 4,
  },
  messageText: {
    color: colors.palette.biancaHeader,
    fontSize: 14,
  },
  noConversationsText: {
    color: colors.palette.neutral600,
    fontSize: 16,
    marginTop: 20,
    textAlign: "center",
  },
  patientBubble: {
    backgroundColor: colors.palette.biancaButtonUnselected, // Light blue
  },
})
