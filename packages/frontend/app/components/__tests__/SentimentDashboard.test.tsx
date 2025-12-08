import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native"
import { SentimentDashboard } from "../SentimentDashboard"
import { SentimentTrend, SentimentSummary } from "../../services/api/api.types"

// Mock the child components
jest.mock("../SentimentTrendChart", () => {
  return function MockSentimentTrendChart({ trend }: { trend: SentimentTrend }) {
    return <div testID="sentiment-trend-chart">Trend Chart: {trend.timeRange}</div>
  }
})

jest.mock("../SentimentSummaryCard", () => {
  return function MockSentimentSummaryCard({ summary }: { summary: SentimentSummary }) {
    return <div testID="sentiment-summary-card">Summary Card</div>
  }
})

describe("SentimentDashboard", () => {
  const mockTrend: SentimentTrend = {
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
          keyEmotions: ["happiness"],
          concernLevel: "low",
          summary: "Patient shows positive sentiment",
          recommendations: "Continue current approach"
        },
        sentimentAnalyzedAt: "2024-01-15T10:05:00.000Z"
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
        "Recent trend shows improvement"
      ]
    }
  }

  const mockSummary: SentimentSummary = {
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
      "Recent trend is improving"
    ],
    recentTrend: []
  }

  const defaultProps = {
    patientId: "test-patient-id"
  }

  it("should render with trend and summary data", () => {
    render(
      <SentimentDashboard
        {...defaultProps}
        trend={mockTrend}
        summary={mockSummary}
      />
    )

    expect(screen.getByText("Patient Sentiment Analysis")).toBeTruthy()
    expect(screen.getByText("Emotional wellness insights and trends")).toBeTruthy()
    expect(screen.getByTestId("sentiment-trend-chart")).toBeTruthy()
    expect(screen.getByTestId("sentiment-summary-card")).toBeTruthy()
  })

  it("should render time range selector", () => {
    render(
      <SentimentDashboard
        {...defaultProps}
        trend={mockTrend}
        summary={mockSummary}
      />
    )

    expect(screen.getByText("Time Range:")).toBeTruthy()
    expect(screen.getByText("Month")).toBeTruthy()
    expect(screen.getByText("Year")).toBeTruthy()
    expect(screen.getByText("All Time")).toBeTruthy()
  })

  it("should handle time range changes", async () => {
    const onTimeRangeChange = jest.fn()
    
    render(
      <SentimentDashboard
        {...defaultProps}
        trend={mockTrend}
        summary={mockSummary}
        onTimeRangeChange={onTimeRangeChange}
      />
    )

    const yearButton = screen.getByText("Year")
    fireEvent.press(yearButton)

    await waitFor(() => {
      expect(onTimeRangeChange).toHaveBeenCalledWith("year")
    })
  })

  it("should handle refresh", async () => {
    const onRefresh = jest.fn()
    
    render(
      <SentimentDashboard
        {...defaultProps}
        trend={mockTrend}
        summary={mockSummary}
        onRefresh={onRefresh}
      />
    )

    // Simulate pull-to-refresh
    const scrollView = screen.getByTestId("sentiment-dashboard-scroll")
    fireEvent.scroll(scrollView, { nativeEvent: { contentOffset: { y: -100 } } })

    await waitFor(() => {
      expect(onRefresh).toHaveBeenCalled()
    })
  })

  it("should show loading state", () => {
    render(
      <SentimentDashboard
        {...defaultProps}
        isLoading={true}
      />
    )

    expect(screen.getByText("Loading sentiment analysis...")).toBeTruthy()
  })

  it("should show no data state when no trend or summary", () => {
    render(
      <SentimentDashboard
        {...defaultProps}
      />
    )

    expect(screen.getByText("No Sentiment Data Available")).toBeTruthy()
    expect(screen.getByText("Sentiment analysis will appear here once the patient has completed conversations.")).toBeTruthy()
  })

  it("should show footer information", () => {
    render(
      <SentimentDashboard
        {...defaultProps}
        trend={mockTrend}
        summary={mockSummary}
      />
    )

    expect(screen.getByText("Sentiment analysis is automatically generated after each conversation using AI technology.")).toBeTruthy()
  })

  it("should handle different time range selections", async () => {
    const onTimeRangeChange = jest.fn()
    
    render(
      <SentimentDashboard
        {...defaultProps}
        trend={mockTrend}
        summary={mockSummary}
        onTimeRangeChange={onTimeRangeChange}
      />
    )

    // Test month selection
    const monthButton = screen.getByText("Month")
    fireEvent.press(monthButton)
    await waitFor(() => {
      expect(onTimeRangeChange).toHaveBeenCalledWith("month")
    })

    // Test year selection
    const yearButton = screen.getByText("Year")
    fireEvent.press(yearButton)
    await waitFor(() => {
      expect(onTimeRangeChange).toHaveBeenCalledWith("year")
    })

    // Test lifetime selection
    const lifetimeButton = screen.getByText("All Time")
    fireEvent.press(lifetimeButton)
    await waitFor(() => {
      expect(onTimeRangeChange).toHaveBeenCalledWith("lifetime")
    })
  })

  it("should render with only trend data", () => {
    render(
      <SentimentDashboard
        {...defaultProps}
        trend={mockTrend}
      />
    )

    expect(screen.getByTestId("sentiment-trend-chart")).toBeTruthy()
    expect(screen.queryByTestId("sentiment-summary-card")).toBeNull()
  })

  it("should render with only summary data", () => {
    render(
      <SentimentDashboard
        {...defaultProps}
        summary={mockSummary}
      />
    )

    expect(screen.getByTestId("sentiment-summary-card")).toBeTruthy()
    expect(screen.queryByTestId("sentiment-trend-chart")).toBeNull()
  })

  it("should apply custom style", () => {
    const customStyle = { backgroundColor: "red" }
    
    render(
      <SentimentDashboard
        {...defaultProps}
        trend={mockTrend}
        summary={mockSummary}
        style={customStyle}
      />
    )

    expect(screen.getByText("Patient Sentiment Analysis")).toBeTruthy()
  })

  it("should handle empty trend data", () => {
    const emptyTrend = {
      ...mockTrend,
      dataPoints: []
    }

    render(
      <SentimentDashboard
        {...defaultProps}
        trend={emptyTrend}
        summary={mockSummary}
      />
    )

    expect(screen.getByTestId("sentiment-trend-chart")).toBeTruthy()
    expect(screen.getByTestId("sentiment-summary-card")).toBeTruthy()
  })

  it("should handle empty summary data", () => {
    const emptySummary = {
      ...mockSummary,
      keyInsights: [],
      recentTrend: []
    }

    render(
      <SentimentDashboard
        {...defaultProps}
        trend={mockTrend}
        summary={emptySummary}
      />
    )

    expect(screen.getByTestId("sentiment-trend-chart")).toBeTruthy()
    expect(screen.getByTestId("sentiment-summary-card")).toBeTruthy()
  })
})


