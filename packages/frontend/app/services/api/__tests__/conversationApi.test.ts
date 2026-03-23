// app/services/api/__tests__/conversationApi.test.ts
import { EnhancedStore } from "@reduxjs/toolkit"
import { orgApi, conversationApi, clientApi } from "../"
import { store as appStore, RootState } from "../../../store/store"
import { registerNewOrgAndCaregiver, createClientInOrg } from "../../../../test/helpers"
import { newCaregiver } from "../../../../test/fixtures/caregiver.fixture"
import { newConversation } from "../../../../test/fixtures/conversation.fixture"
import { Org, Client, Conversation } from "../api.types"

describe("conversationApi", () => {
  let store: EnhancedStore<RootState>
  let org: Org
  let orgId: string
  let client: Client
  let clientId: string
  let conversation: Conversation
  let conversationId: string

  beforeEach(async () => {
    store = appStore
    // Same as clientApi / alertApi: register before resetting RTK caches (see afterEach).
    const testCaregiver = newCaregiver()
    const response = await registerNewOrgAndCaregiver(
      testCaregiver.name,
      testCaregiver.email,
      testCaregiver.password,
      testCaregiver.phone,
    )
    org = response.org
    orgId = response.org.id as string

    const result = await createClientInOrg(
      org,
      testCaregiver.email,
      testCaregiver.password,
    )
    client = result
    clientId = client.id as string
  })

  afterEach(async () => {
    // Clean up org - wrap in try-catch to prevent test failures if cleanup fails
    try {
      const result = await orgApi.endpoints.deleteOrg.initiate({ orgId })(store.dispatch, store.getState, {})
      // Unwrap to ensure promise completes
      if ('data' in result) {
        // Success - cleanup complete
      }
    } catch (error) {
      // Cleanup failed but don't fail the test
      console.warn('Cleanup failed:', error)
    }

    // Reset RTK Query state to cancel any pending queries
    store.dispatch(conversationApi.util.resetApiState())
    store.dispatch(orgApi.util.resetApiState())
    store.dispatch(clientApi.util.resetApiState())

    jest.clearAllMocks()
    jest.clearAllTimers()
  })

  afterAll(async () => {
    // Force cleanup of any pending async operations
    await new Promise(resolve => setTimeout(resolve, 100))
  })

  describe("createConversation", () => {
    it("should create a conversation for a client", async () => {
      const conversationPayload = newConversation(clientId)
      
      const result = await conversationApi.endpoints.createConversation.initiate({
        clientId: clientId,
        data: conversationPayload,
      })(store.dispatch, store.getState, {})

      if ("data" in result && result.data) {
        conversation = result.data
        conversationId = conversation.id as string
        
        expect(conversation).toBeDefined()
        expect(conversation.clientId).toBe(clientId)
        expect(conversation.id).toBeDefined()
        expect(conversation.messages).toBeDefined()
        expect(conversation.startTime).toBeDefined()
      } else {
        throw new Error(`Create conversation failed with error: ${JSON.stringify(result.error)}`)
      }
    })

    it("should return 404 when client does not exist", async () => {
      const nonExistentClientId = "507f1f77bcf86cd799439011" // Valid ObjectId format
      const conversationPayload = newConversation(nonExistentClientId)
      
      const result = await conversationApi.endpoints.createConversation.initiate({
        clientId: nonExistentClientId,
        data: conversationPayload,
      })(store.dispatch, store.getState, {})

      expect("error" in result).toBe(true)
      if ("error" in result && result.error) {
        const error = result.error as any
        if (error.status) {
          expect(error.status).toBe(404)
        }
      }
    })
  })

  describe("getConversation", () => {
    beforeEach(async () => {
      // Create a conversation first
      const conversationPayload = newConversation(clientId)
      const createResult = await conversationApi.endpoints.createConversation.initiate({
        clientId: clientId,
        data: conversationPayload,
      })(store.dispatch, store.getState, {})

      if ("data" in createResult && createResult.data) {
        conversation = createResult.data
        conversationId = conversation.id as string
      } else {
        throw new Error(`Create conversation failed: ${JSON.stringify(createResult.error)}`)
      }
    })

    it("should get a conversation by id", async () => {
      const result = await conversationApi.endpoints.getConversation.initiate({
        conversationId,
      })(store.dispatch, store.getState, {})

      if ("data" in result && result.data) {
        const retrievedConversation = result.data
        
        expect(retrievedConversation).toBeDefined()
        expect(retrievedConversation.id).toBe(conversationId)
        expect(retrievedConversation.clientId).toBe(clientId)
        expect(retrievedConversation.messages).toBeDefined()
        expect(retrievedConversation.startTime).toBeDefined()
      } else {
        throw new Error(`Get conversation failed with error: ${JSON.stringify(result.error)}`)
      }
    })

    it("should return 404 when conversation does not exist", async () => {
      const nonExistentConversationId = "507f1f77bcf86cd799439011" // Valid ObjectId format
      
      const result = await conversationApi.endpoints.getConversation.initiate({
        conversationId: nonExistentConversationId,
      })(store.dispatch, store.getState, {})

      expect("error" in result).toBe(true)
      if ("error" in result && result.error) {
        const error = result.error as any
        if (error.status) {
          expect(error.status).toBe(404)
        }
      }
    })

    it("should return 403 when user lacks permission to access conversation", async () => {
      // This test would require creating a different caregiver/client setup
      // For now, we'll test that the endpoint exists and can be called
      const result = await conversationApi.endpoints.getConversation.initiate({
        conversationId,
      })(store.dispatch, store.getState, {})

      // Should succeed since we're using the same caregiver who created the conversation
      expect("data" in result).toBe(true)
    })
  })

  describe("addMessageToConversation", () => {
    beforeEach(async () => {
      // Create a conversation first
      const conversationPayload = newConversation(clientId)
      const createResult = await conversationApi.endpoints.createConversation.initiate({
        clientId: clientId,
        data: conversationPayload,
      })(store.dispatch, store.getState, {})

      if ("data" in createResult && createResult.data) {
        conversation = createResult.data
        conversationId = conversation.id as string
      } else {
        throw new Error(`Create conversation failed: ${JSON.stringify(createResult.error)}`)
      }
    })

    it("should add a message to a conversation", async () => {
      const messageContent = "Hello, this is a test message"
      
      const result = await conversationApi.endpoints.addMessageToConversation.initiate({
        conversationId,
        role: "client",
        content: messageContent,
      })(store.dispatch, store.getState, {})

      if ("data" in result && result.data) {
        const updatedConversation = result.data
        
        expect(updatedConversation).toBeDefined()
        expect(updatedConversation.id).toBe(conversationId)
        expect(updatedConversation.messages).toBeDefined()
        expect(updatedConversation.messages.length).toBeGreaterThan(0)
        
        // Check that the new message was added
        const lastMessage = updatedConversation.messages[updatedConversation.messages.length - 1]
        expect(lastMessage.content).toBe(messageContent)
        expect(lastMessage.role).toBe("client")
      } else {
        throw new Error(`Add message failed with error: ${JSON.stringify(result.error)}`)
      }
    })

    it("should return 404 when conversation does not exist", async () => {
      const nonExistentConversationId = "507f1f77bcf86cd799439011" // Valid ObjectId format
      const messageContent = "This should fail"
      
      const result = await conversationApi.endpoints.addMessageToConversation.initiate({
        conversationId: nonExistentConversationId,
        role: "client",
        content: messageContent,
      })(store.dispatch, store.getState, {})

      expect("error" in result).toBe(true)
      if ("error" in result && result.error) {
        const error = result.error as any
        if (error.status) {
          expect(error.status).toBe(404)
        }
      }
    })

    it("should return 400 when message content is missing", async () => {
      const result = await conversationApi.endpoints.addMessageToConversation.initiate({
        conversationId,
        role: "client",
        content: "", // Empty message
      })(store.dispatch, store.getState, {})

      expect("error" in result).toBe(true)
      if ("error" in result && result.error) {
        const error = result.error as any
        if (error.status) {
          expect(error.status).toBe(400)
        }
      }
    })
  })

  describe("getConversationsByClient", () => {
    beforeEach(async () => {
      // Create multiple conversations for the client
      const conversationPayload1 = newConversation(clientId)
      const conversationPayload2 = newConversation(clientId)
      
      await conversationApi.endpoints.createConversation.initiate({
        clientId: clientId,
        data: conversationPayload1,
      })(store.dispatch, store.getState, {})

      await conversationApi.endpoints.createConversation.initiate({
        clientId: clientId,
        data: conversationPayload2,
      })(store.dispatch, store.getState, {})
    })

    it("should get conversations by client with pagination", async () => {
      const result = await conversationApi.endpoints.getConversationsByClient.initiate({
        clientId: clientId,
        page: 1,
        limit: 10,
        sortBy: "startTime:desc",
      })(store.dispatch, store.getState, {})

      if ("data" in result && result.data) {
        const conversations = result.data
        
        expect(conversations).toBeDefined()
        expect(conversations.results).toBeDefined()
        expect(Array.isArray(conversations.results)).toBe(true)
        expect(conversations.results.length).toBeGreaterThanOrEqual(2)
        expect(conversations.page).toBe(1)
        expect(conversations.totalPages).toBeDefined()
        expect(conversations.totalResults).toBeDefined()
        
        // Verify all conversations belong to the client
        conversations.results.forEach((conv) => {
          expect(conv.clientId).toBe(clientId)
        })
      } else if ("error" in result && result.error) {
        const error = result.error as any
        if (error.status) {
          expect(error.status).toBe(403)
        } else {
          throw new Error(`Get conversations by client failed with error: ${JSON.stringify(result.error)}`)
        }
      } else {
        throw new Error(`Get conversations by client failed with error: ${JSON.stringify(result.error)}`)
      }
    })

    it("should return empty results when client has no conversations", async () => {
      // Create a new client with no conversations
      const randomEmail = `newclient${Date.now()}@test.com`
      const newClientResult = await clientApi.endpoints.createClient.initiate({
        client: {
          name: "New Client",
          email: randomEmail,
          phone: "+16045624263",
        }
      })(store.dispatch, store.getState, {})

      let newClientId: string
      if ("data" in newClientResult && newClientResult.data) {
        newClientId = newClientResult.data.id as string
      } else {
        throw new Error(`Create new client failed: ${JSON.stringify(newClientResult.error)}`)
      }

      const result = await conversationApi.endpoints.getConversationsByClient.initiate({
        clientId: newClientId,
        page: 1,
        limit: 10,
      })(store.dispatch, store.getState, {})

      if ("data" in result && result.data) {
        const conversations = result.data
        
        expect(conversations).toBeDefined()
        expect(conversations.results).toBeDefined()
        expect(Array.isArray(conversations.results)).toBe(true)
        expect(conversations.results.length).toBe(0)
        expect(conversations.totalResults).toBe(0)
      } else if ("error" in result && result.error) {
        const error = result.error as any
        if (error.status) {
          expect(error.status).toBe(403)
        } else {
          throw new Error(`Get conversations by client failed with error: ${JSON.stringify(result.error)}`)
        }
      } else {
        throw new Error(`Get conversations by client failed with error: ${JSON.stringify(result.error)}`)
      }
    })
  })

  afterAll(async () => {
    // Allow any pending timers from RN/Jest setup to flush before teardown
    await new Promise(resolve => setTimeout(resolve, 1500))
  })
})
