import React from "react"
import { render, screen } from "@testing-library/react-native"
import { SentimentIndicator } from "../SentimentIndicator"
import { SentimentAnalysis } from "../../services/api/api.types"

describe("SentimentIndicator", () => {
  const mockPositiveSentiment: SentimentAnalysis = {
    overallSentiment: "positive",
    sentimentScore: 0.7,
    confidence: 0.9,
    patientMood: "cheerful and optimistic",
    keyEmotions: ["happiness", "satisfaction"],
    concernLevel: "low",
    summary: "Patient shows positive sentiment",
    recommendations: "Continue current approach"
  }

  const mockNegativeSentiment: SentimentAnalysis = {
    overallSentiment: "negative",
    sentimentScore: -0.5,
    confidence: 0.8,
    patientMood: "frustrated",
    keyEmotions: ["frustration", "concern"],
    concernLevel: "medium",
    summary: "Patient shows negative sentiment",
    recommendations: "Consider additional support"
  }

  const mockNeutralSentiment: SentimentAnalysis = {
    overallSentiment: "neutral",
    sentimentScore: 0.1,
    confidence: 0.7,
    patientMood: "calm",
    keyEmotions: ["neutrality"],
    concernLevel: "low",
    summary: "Patient shows neutral sentiment",
    recommendations: "Monitor for changes"
  }

  const mockMixedSentiment: SentimentAnalysis = {
    overallSentiment: "mixed",
    sentimentScore: 0.0,
    confidence: 0.6,
    patientMood: "conflicted",
    keyEmotions: ["uncertainty", "hope"],
    concernLevel: "medium",
    summary: "Patient shows mixed sentiment",
    recommendations: "Provide reassurance"
  }

  it("should render positive sentiment correctly", () => {
    render(<SentimentIndicator sentiment={mockPositiveSentiment} />)
    
    expect(screen.getByText("Positive")).toBeTruthy()
    expect(screen.getByTestId("icon-checkCircle")).toBeTruthy()
  })

  it("should render negative sentiment correctly", () => {
    render(<SentimentIndicator sentiment={mockNegativeSentiment} />)
    
    expect(screen.getByText("Negative")).toBeTruthy()
    expect(screen.getByTestId("icon-xCircle")).toBeTruthy()
  })

  it("should render neutral sentiment correctly", () => {
    render(<SentimentIndicator sentiment={mockNeutralSentiment} />)
    
    expect(screen.getByText("Neutral")).toBeTruthy()
    expect(screen.getByTestId("icon-minusCircle")).toBeTruthy()
  })

  it("should render mixed sentiment correctly", () => {
    render(<SentimentIndicator sentiment={mockMixedSentiment} />)
    
    expect(screen.getByText("Mixed")).toBeTruthy()
    expect(screen.getByTestId("icon-alertCircle")).toBeTruthy()
  })

  it("should render no data state when sentiment is null", () => {
    render(<SentimentIndicator sentiment={null} />)
    
    expect(screen.getByText("No data")).toBeTruthy()
    expect(screen.getByTestId("icon-question")).toBeTruthy()
  })

  it("should render no data state when sentiment is undefined", () => {
    render(<SentimentIndicator sentiment={undefined} />)
    
    expect(screen.getByText("No data")).toBeTruthy()
    expect(screen.getByTestId("icon-question")).toBeTruthy()
  })

  it("should show confidence warning for low confidence", () => {
    const lowConfidenceSentiment = {
      ...mockPositiveSentiment,
      confidence: 0.5 // Low confidence
    }

    render(<SentimentIndicator sentiment={lowConfidenceSentiment} />)
    
    expect(screen.getByText("!")).toBeTruthy() // Low confidence badge
  })

  it("should not show confidence warning for high confidence", () => {
    render(<SentimentIndicator sentiment={mockPositiveSentiment} />)
    
    expect(screen.queryByText("!")).toBeNull() // No low confidence badge
  })

  it("should show score when showScore is true", () => {
    render(<SentimentIndicator sentiment={mockPositiveSentiment} showScore={true} />)
    
    expect(screen.getByText("+0.7")).toBeTruthy()
  })

  it("should show negative score correctly", () => {
    render(<SentimentIndicator sentiment={mockNegativeSentiment} showScore={true} />)
    
    expect(screen.getByText("-0.5")).toBeTruthy()
  })

  it("should not show score when showScore is false", () => {
    render(<SentimentIndicator sentiment={mockPositiveSentiment} showScore={false} />)
    
    expect(screen.queryByText("+0.7")).toBeNull()
  })

  it("should show mood when showMood is true", () => {
    render(<SentimentIndicator sentiment={mockPositiveSentiment} showMood={true} />)
    
    expect(screen.getByText("cheerful and optimistic")).toBeTruthy()
  })

  it("should not show mood when showMood is false", () => {
    render(<SentimentIndicator sentiment={mockPositiveSentiment} showMood={false} />)
    
    expect(screen.queryByText("cheerful and optimistic")).toBeNull()
  })

  it("should handle different sizes", () => {
    const { rerender } = render(<SentimentIndicator sentiment={mockPositiveSentiment} size="small" />)
    expect(screen.getByText("Positive")).toBeTruthy()

    rerender(<SentimentIndicator sentiment={mockPositiveSentiment} size="medium" />)
    expect(screen.getByText("Positive")).toBeTruthy()

    rerender(<SentimentIndicator sentiment={mockPositiveSentiment} size="large" />)
    expect(screen.getByText("Positive")).toBeTruthy()
  })

  it("should apply custom style", () => {
    const customStyle = { backgroundColor: "red" }
    render(<SentimentIndicator sentiment={mockPositiveSentiment} style={customStyle} />)
    
    expect(screen.getByText("Positive")).toBeTruthy()
  })

  it("should handle sentiment with missing optional fields", () => {
    const minimalSentiment: SentimentAnalysis = {
      overallSentiment: "positive",
      sentimentScore: 0.5,
      confidence: 0.8
    }

    render(<SentimentIndicator sentiment={minimalSentiment} showMood={true} />)
    
    expect(screen.getByText("Positive")).toBeTruthy()
    expect(screen.queryByText("cheerful and optimistic")).toBeNull() // No mood data
  })

  it("should handle unknown sentiment type", () => {
    const unknownSentiment = {
      ...mockPositiveSentiment,
      overallSentiment: "unknown" as any
    }

    render(<SentimentIndicator sentiment={unknownSentiment} />)
    
    expect(screen.getByText("Unknown")).toBeTruthy()
    expect(screen.getByTestId("icon-question")).toBeTruthy()
  })
})


