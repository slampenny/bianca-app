import React, { useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { useSelector } from "react-redux";
import { useGetConversationsByPatientQuery } from "../services/api/conversationApi";
import { getPatient } from "../store/patientSlice";

export function ConversationsScreen() {
  const patient = useSelector(getPatient);

  const {
    data: conversations,
    error,
    isLoading,
    refetch,
  } = useGetConversationsByPatientQuery({ patientId: patient?.id as string }, { skip: !patient?.id });

  useEffect(() => {
    if (patient?.id) {
      refetch();
    }
  }, [patient?.id, refetch]);

  if (!patient) {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>No patient selected</Text>
      </View>
    );
  }
  console.log(conversations);

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Conversations</Text>
      {isLoading ? (
        <ActivityIndicator size="large" color="#0000ff" />
      ) : error ? (
        <Text style={styles.error}>Error fetching conversations</Text>
      ) : conversations && conversations.length > 0 ? (
        conversations.map((conversation) => (
          <View key={conversation.id} style={styles.conversation}>
            <Text style={styles.conversationText}>
              Conversation ID: {conversation.id}
            </Text>
            {conversation.messages.map((message, index) => (
              <View key={index} style={styles.message}>
                <Text style={styles.messageText}>
                  {message.role}: {message.content}
                </Text>
              </View>
            ))}
          </View>
        ))
      ) : (
        <Text style={styles.noConversations}>No conversations to display</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  conversation: {
    marginBottom: 15,
    padding: 15,
    borderRadius: 5,
    backgroundColor: "#f5f5f5",
  },
  conversationText: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
  },
  message: {
    marginBottom: 10,
    padding: 10,
    borderRadius: 5,
    backgroundColor: "#e0e0e0",
  },
  messageText: {
    fontSize: 14,
  },
  noConversations: {
    fontSize: 16,
    color: "gray",
  },
  error: {
    fontSize: 16,
    color: "red",
  },
});
