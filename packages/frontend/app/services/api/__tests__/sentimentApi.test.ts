// app/services/api/__tests__/sentimentApi.test.ts
import { sentimentApi, orgApi, clientApi } from "../"
import { store as appStore, RootState } from "../../../store/store"
import { registerNewOrgAndCaregiver, createClientInOrg } from "../../../../test/helpers"
import { newCaregiver } from "../../../../test/fixtures/caregiver.fixture"
import { Org, Client, SentimentTrend, SentimentSummary, SentimentAnalysis } from "../api.types"

// Mock the sentiment API responses
const mockSentimentTrend: SentimentTrend = {
  clientId: "test-client-id",
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
  let store: typeof appStore
  let org: Org
  let orgId: string
  let client: Client
  let clientId: string
  const originalFetch = global.fetch

  const createMockResponse = <T,>(data: T, options?: { ok?: boolean; status?: number }) => {
    const responseBody = JSON.stringify(data)
    const headers =
      typeof Headers !== "undefined"
        ? new Headers({ "content-type": "application/json" })
        : {
            get: (name: string) =>
              name.toLowerCase() === "content-type" ? "application/json" : null,
          }
    const response = {
      ok: options?.ok ?? true,
      status: options?.status ?? 200,
      statusText: options?.ok === false ? "Error" : "OK",
      headers,
      json: () => Promise.resolve(data),
      text: () => Promise.resolve(responseBody),
      clone: () => response,
    }
    return response
  }

  beforeEach(async () => {
    global.fetch = originalFetch
    store = appStore
    store.dispatch(sentimentApi.util.resetApiState())
    store.dispatch(orgApi.util.resetApiState())
    store.dispatch(clientApi.util.resetApiState())
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
    try {
      await orgApi.endpoints.deleteOrg.initiate({ orgId })(store.dispatch, store.getState, {})
    } catch (error) {
      // Ignore cleanup errors
    }
    store.dispatch(sentimentApi.util.resetApiState())
    store.dispatch(orgApi.util.resetApiState())
    store.dispatch(clientApi.util.resetApiState())
    global.fetch = originalFetch
    jest.clearAllMocks()
  })

  describe("getSentimentTrend", () => {
    it("should fetch sentiment trend for client", async () => {
      // Mock the API response
      const mockFetch = jest.fn().mockResolvedValue(createMockResponse(mockSentimentTrend))
      global.fetch = mockFetch

      const result = await (store.dispatch as (arg: unknown) => unknown)(
        sentimentApi.endpoints.getSentimentTrend.initiate({
          clientId,
          timeRange: "month"
        })
      ) as { data?: { timeRange?: string }; isSuccess?: boolean; isError?: boolean; error?: unknown }

      expect(result.data).toEqual(mockSentimentTrend)
      expect(result.isSuccess).toBe(true)
      const [request] = mockFetch.mock.calls[0]
      const requestUrl = typeof request === "string" ? request : request.url
      const requestHeaders =
        typeof request === "string"
          ? undefined
          : (request.headers as unknown as Headers | undefined)
      expect(requestUrl).toContain(`/sentiment/client/${clientId}/trend?timeRange=month`)
      if (requestHeaders?.get) {
        expect(requestHeaders.get("authorization")).toContain("Bearer")
      }
    })

    it("should handle different time ranges", async () => {
      const timeRanges = ["month", "lifetime"] as const
      
      for (const timeRange of timeRanges) {
        const mockFetch = jest.fn().mockResolvedValue(
          createMockResponse({ ...mockSentimentTrend, timeRange })
        )
        global.fetch = mockFetch

        const result = await (store.dispatch as (arg: unknown) => unknown)(
          sentimentApi.endpoints.getSentimentTrend.initiate({
            clientId,
            timeRange
          })
        ) as { data?: { timeRange?: string }; isSuccess?: boolean }

        expect((result as { data?: { timeRange?: string } }).data?.timeRange).toBe(timeRange)
        expect(result.isSuccess).toBe(true)
      }
    })

    it("should handle API errors", async () => {
      const mockFetch = jest.fn().mockResolvedValue(
        createMockResponse({ message: "Patient not found" }, { ok: false, status: 404 })
      )
      global.fetch = mockFetch

      const result = await (store.dispatch as (arg: unknown) => unknown)(
        sentimentApi.endpoints.getSentimentTrend.initiate({
          clientId: "non-existent-client",
          timeRange: "month"
        })
      ) as { isError?: boolean; error?: unknown }

      expect(result.isError).toBe(true)
      expect(result.error).toBeDefined()
    })
  })

  describe("getSentimentSummary", () => {
    it("should fetch sentiment summary for client", async () => {
      const mockFetch = jest.fn().mockResolvedValue(createMockResponse(mockSentimentSummary))
      global.fetch = mockFetch

      const result = await (store.dispatch as (arg: unknown) => unknown)(
        sentimentApi.endpoints.getSentimentSummary.initiate({
          clientId
        })
      ) as { data?: unknown; isSuccess?: boolean }

      expect(result.data).toEqual(mockSentimentSummary)
      expect(result.isSuccess).toBe(true)
      const [request] = mockFetch.mock.calls[0]
      const requestUrl = typeof request === "string" ? request : request.url
      const requestHeaders =
        typeof request === "string"
          ? undefined
          : (request.headers as unknown as Headers | undefined)
      expect(requestUrl).toContain(`/sentiment/client/${clientId}/summary`)
      if (requestHeaders?.get) {
        expect(requestHeaders.get("authorization")).toContain("Bearer")
      }
    })

    it("should handle API errors", async () => {
      const mockFetch = jest.fn().mockResolvedValue(
        createMockResponse({ message: "Patient not found" }, { ok: false, status: 404 })
      )
      global.fetch = mockFetch

      const result = await (store.dispatch as (arg: unknown) => unknown)(
        sentimentApi.endpoints.getSentimentSummary.initiate({
          clientId: "non-existent-client"
        })
      ) as { isError?: boolean; error?: unknown }

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

      const mockFetch = jest.fn().mockResolvedValue(createMockResponse(mockResponse))
      global.fetch = mockFetch

      const result = await (store.dispatch as (arg: unknown) => unknown)(
        sentimentApi.endpoints.getConversationSentiment.initiate({
          conversationId
        })
      ) as { data?: unknown; isSuccess?: boolean }

      expect(result.data).toEqual(mockResponse)
      expect(result.isSuccess).toBe(true)
      const [request] = mockFetch.mock.calls[0]
      const requestUrl = typeof request === "string" ? request : request.url
      const requestHeaders =
        typeof request === "string"
          ? undefined
          : (request.headers as unknown as Headers | undefined)
      expect(requestUrl).toContain(`/sentiment/conversation/${conversationId}`)
      if (requestHeaders?.get) {
        expect(requestHeaders.get("authorization")).toContain("Bearer")
      }
    })

    it("should handle conversation without sentiment analysis", async () => {
      const conversationId = "test-conversation-id"
      const mockResponse = {
        conversationId,
        sentiment: null,
        sentimentAnalyzedAt: null,
        hasSentimentAnalysis: false
      }

      const mockFetch = jest.fn().mockResolvedValue(createMockResponse(mockResponse))
      global.fetch = mockFetch

      const result = await (store.dispatch as (arg: unknown) => unknown)(
        sentimentApi.endpoints.getConversationSentiment.initiate({
          conversationId
        })
      ) as { data?: { hasSentimentAnalysis?: boolean }; isSuccess?: boolean }

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

      const mockFetch = jest.fn().mockResolvedValue(createMockResponse(mockResponse))
      global.fetch = mockFetch

      const result = await (store.dispatch as (arg: unknown) => unknown)(
        sentimentApi.endpoints.analyzeConversationSentiment.initiate({
          conversationId
        })
      ) as { data?: unknown }

      expect(result.data).toEqual(mockResponse)
      const [request] = mockFetch.mock.calls[0]
      const requestUrl = typeof request === "string" ? request : request.url
      const requestHeaders =
        typeof request === "string"
          ? undefined
          : (request.headers as unknown as Headers | undefined)
      expect(requestUrl).toContain(`/sentiment/conversation/${conversationId}/analyze`)
      if (requestHeaders?.get) {
        expect(requestHeaders.get("authorization")).toContain("Bearer")
      }
    })

    it("should handle analysis errors", async () => {
      const conversationId = "test-conversation-id"
      const mockFetch = jest.fn().mockResolvedValue(
        createMockResponse(
          { message: "Conversation has no messages to analyze" },
          { ok: false, status: 400 }
        )
      )
      global.fetch = mockFetch

      const result = await (store.dispatch as (arg: unknown) => unknown)(
        sentimentApi.endpoints.analyzeConversationSentiment.initiate({
          conversationId
        })
      ) as object

      expect("error" in result).toBe(true)
      if ("error" in result && (result as { error?: unknown }).error) {
        expect((result as { error?: unknown }).error).toBeDefined()
      }
    })
  })

  describe("caching and invalidation", () => {
    it("should cache sentiment trend data", async () => {
      const mockFetch = jest.fn().mockResolvedValue(createMockResponse(mockSentimentTrend))
      global.fetch = mockFetch

      // First call
      const result1 = await (store.dispatch as (arg: unknown) => unknown)(
        sentimentApi.endpoints.getSentimentTrend.initiate({
          clientId: clientId,
          timeRange: "month"
        })
      ) as { data?: unknown }

      // Second call should use cache
      const result2 = await (store.dispatch as (arg: unknown) => unknown)(
        sentimentApi.endpoints.getSentimentTrend.initiate({
          clientId: clientId,
          timeRange: "month"
        })
      ) as { data?: unknown }

      expect(result1.data).toEqual(result2.data)
      expect(mockFetch).toHaveBeenCalledTimes(1) // Only called once due to caching
    })

    it("should invalidate cache when analyzing conversation", async () => {
      const mockFetch = jest.fn().mockImplementation((input: RequestInfo) => {
        const url = typeof input === "string" ? input : input.url
        if (url.includes("/analyze")) {
          return Promise.resolve(
            createMockResponse({
              success: true,
              conversationId: "test-conversation-id",
              sentiment: mockSentimentAnalysis,
              analyzedAt: "2024-01-25T09:05:00.000Z",
            }),
          )
        }
        return Promise.resolve(createMockResponse(mockSentimentTrend))
      })
      global.fetch = mockFetch

      // First, fetch sentiment trend
      await (store.dispatch as (arg: unknown) => unknown)(
        sentimentApi.endpoints.getSentimentTrend.initiate({
          clientId: clientId,
          timeRange: "month"
        })
      )

      // Then analyze a conversation (should invalidate cache)
      await (store.dispatch as (arg: unknown) => unknown)(
        sentimentApi.endpoints.analyzeConversationSentiment.initiate({
          conversationId: "test-conversation-id"
        })
      )

      // Next fetch should not use cache
      await (store.dispatch as (arg: unknown) => unknown)(
        sentimentApi.endpoints.getSentimentTrend.initiate({
          clientId: clientId,
          timeRange: "month"
        })
      )

      expect(mockFetch).toHaveBeenCalledTimes(3) // trend + analyze + trend after invalidation
    })
  })

  afterAll(async () => {
    // Allow any pending timers from RN/Jest setup to flush before teardown
    await new Promise(resolve => setTimeout(resolve, 1500))
  })
})


