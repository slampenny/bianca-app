// app/services/api/__tests__/sentimentApi.test.ts
import { EnhancedStore } from "@reduxjs/toolkit"
import { sentimentApi, orgApi, patientApi } from "../"
import { store as appStore, RootState } from "../../../store/store"
import { registerNewOrgAndCaregiver, createPatientInOrg } from "../../../../test/helpers"
import { newCaregiver } from "../../../../test/fixtures/caregiver.fixture"
import { Org, Patient, SentimentTrend, SentimentSummary, SentimentAnalysis } from "../api.types"

// Mock the sentiment API responses
const mockSentimentTrend: SentimentTrend = {
  patientId: "test-patient-id",
  timeRange: "month",
  startDate: "2024-01-01T00:00:00.000Z",
  endDate: "2024-01-31T23:59:59.999Z",
  totalConversations: 5,
  analyzedConversations: 4,
  dataPoints: [
    {
      conversationId: "conv-1",
      date: "2024-01-15T10:00:00.000Z",
      duration: 300000,
      sentiment: {
        overallSentiment: "positive",
        sentimentScore: 0.7,
        confidence: 0.9,
        patientMood: "cheerful",
        keyEmotions: ["happiness", "satisfaction"],
        concernLevel: "low",
        summary: "Patient shows positive sentiment",
        recommendations: "Continue current approach"
      },
      sentimentAnalyzedAt: "2024-01-15T10:05:00.000Z"
    },
    {
      conversationId: "conv-2",
      date: "2024-01-20T14:00:00.000Z",
      duration: 450000,
      sentiment: {
        overallSentiment: "negative",
        sentimentScore: -0.3,
        confidence: 0.8,
        patientMood: "frustrated",
        keyEmotions: ["frustration"],
        concernLevel: "medium",
        summary: "Patient shows negative sentiment",
        recommendations: "Consider additional support"
      },
      sentimentAnalyzedAt: "2024-01-20T14:05:00.000Z"
    }
  ],
  summary: {
    averageSentiment: 0.2,
    sentimentDistribution: {
      positive: 2,
      negative: 1,
      neutral: 1,
      mixed: 0
    },
    trendDirection: "improving",
    confidence: 0.85,
    keyInsights: [
      "Patient sentiment is generally positive",
      "Recent trend shows improvement",
      "Low concern level overall"
    ]
  }
}

const mockSentimentSummary: SentimentSummary = {
  totalConversations: 10,
  analyzedConversations: 8,
  averageSentiment: 0.3,
  sentimentDistribution: {
    positive: 5,
    negative: 2,
    neutral: 1,
    mixed: 0
  },
  trendDirection: "improving",
  confidence: 0.9,
  keyInsights: [
    "Patient shows generally positive sentiment",
    "Recent trend is improving",
    "High confidence in analysis"
  ],
  recentTrend: [
    {
      conversationId: "conv-recent-1",
      date: "2024-01-25T09:00:00.000Z",
      duration: 300000,
      sentiment: {
        overallSentiment: "positive",
        sentimentScore: 0.6,
        confidence: 0.8,
        patientMood: "content",
        keyEmotions: ["happiness"],
        concernLevel: "low",
        summary: "Patient is doing well",
        recommendations: "Continue current care"
      },
      sentimentAnalyzedAt: "2024-01-25T09:05:00.000Z"
    }
  ]
}

const mockSentimentAnalysis: SentimentAnalysis = {
  overallSentiment: "positive",
  sentimentScore: 0.7,
  confidence: 0.9,
  patientMood: "cheerful and optimistic",
  keyEmotions: ["happiness", "satisfaction"],
  concernLevel: "low",
  satisfactionIndicators: {
    positive: ["expressed gratitude", "mentioned feeling good"],
    negative: []
  },
  summary: "Patient shows positive sentiment with high confidence",
  recommendations: "Continue current care approach"
}

describe("sentimentApi", () => {
  let store: EnhancedStore<RootState>
  let org: Org
  let orgId: string
  let patient: Patient
  let patientId: string

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

  describe("getSentimentTrend", () => {
    it("should fetch sentiment trend for patient", async () => {
      // Mock the API response
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSentimentTrend),
      })
      global.fetch = mockFetch

      const result = await store.dispatch(
        sentimentApi.endpoints.getSentimentTrend.initiate({
          patientId,
          timeRange: "month"
        })
      )

      expect(result.data).toEqual(mockSentimentTrend)
      expect(result.isSuccess).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/sentiment/patient/${patientId}/trend?timeRange=month`),
        expect.objectContaining({
          headers: expect.objectContaining({
            authorization: expect.stringContaining("Bearer")
          })
        })
      )
    })

    it("should handle different time ranges", async () => {
      const timeRanges = ["month", "year", "lifetime"] as const
      
      for (const timeRange of timeRanges) {
        const mockFetch = jest.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ ...mockSentimentTrend, timeRange }),
        })
        global.fetch = mockFetch

        const result = await store.dispatch(
          sentimentApi.endpoints.getSentimentTrend.initiate({
            patientId,
            timeRange
          })
        )

        expect(result.data?.timeRange).toBe(timeRange)
        expect(result.isSuccess).toBe(true)
      }
    })

    it("should handle API errors", async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ message: "Patient not found" }),
      })
      global.fetch = mockFetch

      const result = await store.dispatch(
        sentimentApi.endpoints.getSentimentTrend.initiate({
          patientId: "non-existent-patient",
          timeRange: "month"
        })
      )

      expect(result.isError).toBe(true)
      expect(result.error).toBeDefined()
    })
  })

  describe("getSentimentSummary", () => {
    it("should fetch sentiment summary for patient", async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSentimentSummary),
      })
      global.fetch = mockFetch

      const result = await store.dispatch(
        sentimentApi.endpoints.getSentimentSummary.initiate({
          patientId
        })
      )

      expect(result.data).toEqual(mockSentimentSummary)
      expect(result.isSuccess).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/sentiment/patient/${patientId}/summary`),
        expect.objectContaining({
          headers: expect.objectContaining({
            authorization: expect.stringContaining("Bearer")
          })
        })
      )
    })

    it("should handle API errors", async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ message: "Patient not found" }),
      })
      global.fetch = mockFetch

      const result = await store.dispatch(
        sentimentApi.endpoints.getSentimentSummary.initiate({
          patientId: "non-existent-patient"
        })
      )

      expect(result.isError).toBe(true)
      expect(result.error).toBeDefined()
    })
  })

  describe("getConversationSentiment", () => {
    it("should fetch sentiment analysis for conversation", async () => {
      const conversationId = "test-conversation-id"
      const mockResponse = {
        conversationId,
        sentiment: mockSentimentAnalysis,
        sentimentAnalyzedAt: "2024-01-25T09:05:00.000Z",
        hasSentimentAnalysis: true
      }

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })
      global.fetch = mockFetch

      const result = await store.dispatch(
        sentimentApi.endpoints.getConversationSentiment.initiate({
          conversationId
        })
      )

      expect(result.data).toEqual(mockResponse)
      expect(result.isSuccess).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/sentiment/conversation/${conversationId}`),
        expect.objectContaining({
          headers: expect.objectContaining({
            authorization: expect.stringContaining("Bearer")
          })
        })
      )
    })

    it("should handle conversation without sentiment analysis", async () => {
      const conversationId = "test-conversation-id"
      const mockResponse = {
        conversationId,
        sentiment: null,
        sentimentAnalyzedAt: null,
        hasSentimentAnalysis: false
      }

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })
      global.fetch = mockFetch

      const result = await store.dispatch(
        sentimentApi.endpoints.getConversationSentiment.initiate({
          conversationId
        })
      )

      expect(result.data).toEqual(mockResponse)
      expect(result.isSuccess).toBe(true)
      expect(result.data?.hasSentimentAnalysis).toBe(false)
    })
  })

  describe("analyzeConversationSentiment", () => {
    it("should trigger sentiment analysis for conversation", async () => {
      const conversationId = "test-conversation-id"
      const mockResponse = {
        success: true,
        conversationId,
        sentiment: mockSentimentAnalysis,
        analyzedAt: "2024-01-25T09:05:00.000Z"
      }

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })
      global.fetch = mockFetch

      const result = await store.dispatch(
        sentimentApi.endpoints.analyzeConversationSentiment.initiate({
          conversationId
        })
      )

      expect(result.data).toEqual(mockResponse)
      expect(result.isSuccess).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/sentiment/conversation/${conversationId}/analyze`),
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            authorization: expect.stringContaining("Bearer")
          })
        })
      )
    })

    it("should handle analysis errors", async () => {
      const conversationId = "test-conversation-id"
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ message: "Conversation has no messages to analyze" }),
      })
      global.fetch = mockFetch

      const result = await store.dispatch(
        sentimentApi.endpoints.analyzeConversationSentiment.initiate({
          conversationId
        })
      )

      expect(result.isError).toBe(true)
      expect(result.error).toBeDefined()
    })
  })

  describe("caching and invalidation", () => {
    it("should cache sentiment trend data", async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSentimentTrend),
      })
      global.fetch = mockFetch

      // First call
      const result1 = await store.dispatch(
        sentimentApi.endpoints.getSentimentTrend.initiate({
          patientId,
          timeRange: "month"
        })
      )

      // Second call should use cache
      const result2 = await store.dispatch(
        sentimentApi.endpoints.getSentimentTrend.initiate({
          patientId,
          timeRange: "month"
        })
      )

      expect(result1.data).toEqual(result2.data)
      expect(mockFetch).toHaveBeenCalledTimes(1) // Only called once due to caching
    })

    it("should invalidate cache when analyzing conversation", async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSentimentTrend),
      })
      global.fetch = mockFetch

      // First, fetch sentiment trend
      await store.dispatch(
        sentimentApi.endpoints.getSentimentTrend.initiate({
          patientId,
          timeRange: "month"
        })
      )

      // Then analyze a conversation (should invalidate cache)
      const mockAnalysisFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          conversationId: "test-conversation-id",
          sentiment: mockSentimentAnalysis,
          analyzedAt: "2024-01-25T09:05:00.000Z"
        }),
      })
      global.fetch = mockAnalysisFetch

      await store.dispatch(
        sentimentApi.endpoints.analyzeConversationSentiment.initiate({
          conversationId: "test-conversation-id"
        })
      )

      // Next fetch should not use cache
      await store.dispatch(
        sentimentApi.endpoints.getSentimentTrend.initiate({
          patientId,
          timeRange: "month"
        })
      )

      expect(mockFetch).toHaveBeenCalledTimes(2) // Called twice due to cache invalidation
    })
  })
})


