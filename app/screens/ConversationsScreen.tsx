import React, { useEffect } from "react"
import { View, Text, StyleSheet, ActivityIndicator, FlatList, Pressable } from "react-native"
import { useSelector } from "react-redux"
import { useGetConversationsByPatientQuery } from "../services/api/conversationApi"
import { getPatient } from "../store/patientSlice"
import { Conversation, Message } from "../services/api/api.types"

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
              message.role === "patient" ? styles.patientBubble : styles.doctorBubble,
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
          <ActivityIndicator size="large" color="#3498db" />
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
          keyExtractor={(item) => item.id}
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
    backgroundColor: "#ecf0f1",
    flex: 1,
  },
  conversationCard: {
    backgroundColor: "#fff",
    padding: 16,
    marginBottom: 12,
    borderRadius: 6,

    // iOS shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,

    // Android elevation
    elevation: 2,
  },
  conversationTitle: {
    color: "#2c3e50",
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 12,
  },
  doctorBubble: {
    backgroundColor: "#e2ffd0", // Light green
  },
  errorContainer: {
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    color: "red",
    fontSize: 16,
  },
  header: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderColor: "#ddd",
    paddingVertical: 16,
  },
  headerTitle: {
    color: "#2c3e50",
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
    color: "#2c3e50",
    fontWeight: "bold",
    marginBottom: 4,
  },
  messageText: {
    color: "#2c3e50",
    fontSize: 14,
  },
  noConversationsText: {
    color: "#7f8c8d",
    fontSize: 16,
    marginTop: 20,
    textAlign: "center",
  },
  patientBubble: {
    backgroundColor: "#d0ebff", // Light blue
  },
})
