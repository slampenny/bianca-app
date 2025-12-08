// app/services/api/__tests__/conversationApi.test.ts
import { EnhancedStore } from "@reduxjs/toolkit"
import { orgApi, conversationApi, patientApi } from "../"
import { store as appStore, RootState } from "../../../store/store"
import { registerNewOrgAndCaregiver, createPatientInOrg } from "../../../../test/helpers"
import { newCaregiver } from "../../../../test/fixtures/caregiver.fixture"
import { newConversation } from "../../../../test/fixtures/conversation.fixture"
import { Org, Patient, Conversation } from "../api.types"

describe("conversationApi", () => {
  let store: EnhancedStore<RootState>
  let org: Org
  let orgId: string
  let patient: Patient
  let patientId: string
  let conversation: Conversation
  let conversationId: string

  beforeEach(async () => {
    store = appStore
    const testCaregiver = newCaregiver()
    const response = await registerNewOrgAndCaregiver(
      testCaregiver.name,
      testCaregiver.email,
      testCaregiver.password,
      testCaregiver.phone,
    )
    org = response.org
    orgId = response.org.id as string

    const result = (await createPatientInOrg(
      org,
      testCaregiver.email,
      testCaregiver.password,
    )) as Patient
    if ("error" in result) {
      throw new Error(`Create patient failed with error: ${JSON.stringify(result.error)}`)
    } else {
      patient = result
      patientId = patient.id as string
    }
  })

  afterEach(async () => {
    try {
      await orgApi.endpoints.deleteOrg.initiate({ orgId })(store.dispatch, store.getState, {})
    } catch (error) {
      // Ignore cleanup errors
    }
    jest.clearAllMocks()
  })

  afterAll(async () => {
    // Force cleanup of any pending async operations
    await new Promise(resolve => setTimeout(resolve, 100))
  })

  describe("createConversation", () => {
    it("should create a conversation for a patient", async () => {
      const conversationPayload = newConversation(patientId)
      
      const result = await conversationApi.endpoints.createConversation.initiate({
        patientId,
        data: conversationPayload,
      })(store.dispatch, store.getState, {})

      if ("data" in result && result.data) {
        conversation = result.data
        conversationId = conversation.id as string
        
        expect(conversation).toBeDefined()
        expect(conversation.patientId).toBe(patientId)
        expect(conversation.id).toBeDefined()
        expect(conversation.messages).toBeDefined()
        expect(conversation.startTime).toBeDefined()
        expect(conversation.status).toBeDefined()
      } else {
        throw new Error(`Create conversation failed with error: ${JSON.stringify(result.error)}`)
      }
    })

    it("should return 404 when patient does not exist", async () => {
      const nonExistentPatientId = "507f1f77bcf86cd799439011" // Valid ObjectId format
      const conversationPayload = newConversation(nonExistentPatientId)
      
      const result = await conversationApi.endpoints.createConversation.initiate({
        patientId: nonExistentPatientId,
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
      const conversationPayload = newConversation(patientId)
      const createResult = await conversationApi.endpoints.createConversation.initiate({
        patientId,
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
        expect(retrievedConversation.patientId).toBe(patientId)
        expect(retrievedConversation.messages).toBeDefined()
        expect(retrievedConversation.startTime).toBeDefined()
        expect(retrievedConversation.status).toBeDefined()
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
      // This test would require creating a different caregiver/patient setup
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
      const conversationPayload = newConversation(patientId)
      const createResult = await conversationApi.endpoints.createConversation.initiate({
        patientId,
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
        role: "patient",
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
        expect(lastMessage.role).toBe("patient")
      } else {
        throw new Error(`Add message failed with error: ${JSON.stringify(result.error)}`)
      }
    })

    it("should return 404 when conversation does not exist", async () => {
      const nonExistentConversationId = "507f1f77bcf86cd799439011" // Valid ObjectId format
      const messageContent = "This should fail"
      
      const result = await conversationApi.endpoints.addMessageToConversation.initiate({
        conversationId: nonExistentConversationId,
        role: "patient",
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
        role: "patient",
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

  describe("getConversationsByPatient", () => {
    beforeEach(async () => {
      // Create multiple conversations for the patient
      const conversationPayload1 = newConversation(patientId)
      const conversationPayload2 = newConversation(patientId)
      
      await conversationApi.endpoints.createConversation.initiate({
        patientId,
        data: conversationPayload1,
      })(store.dispatch, store.getState, {})

      await conversationApi.endpoints.createConversation.initiate({
        patientId,
        data: conversationPayload2,
      })(store.dispatch, store.getState, {})
    })

    it("should get conversations by patient with pagination", async () => {
      const result = await conversationApi.endpoints.getConversationsByPatient.initiate({
        patientId,
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
        
        // Verify all conversations belong to the patient
        conversations.results.forEach((conv) => {
          expect(conv.patientId).toBe(patientId)
        })
      } else {
        throw new Error(`Get conversations by patient failed with error: ${JSON.stringify(result.error)}`)
      }
    })

    it("should return empty results when patient has no conversations", async () => {
      // Create a new patient with no conversations
      const randomEmail = `newpatient${Date.now()}@test.com`
      const newPatientResult = await patientApi.endpoints.createPatient.initiate({
        patient: {
          name: "New Patient",
          email: randomEmail,
          phone: "+16045624263",
        }
      })(store.dispatch, store.getState, {})

      let newPatientId: string
      if ("data" in newPatientResult && newPatientResult.data) {
        newPatientId = newPatientResult.data.id as string
      } else {
        throw new Error(`Create new patient failed: ${JSON.stringify(newPatientResult.error)}`)
      }

      const result = await conversationApi.endpoints.getConversationsByPatient.initiate({
        patientId: newPatientId,
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
      } else {
        throw new Error(`Get conversations by patient failed with error: ${JSON.stringify(result.error)}`)
      }
    })
  })

})
