const mongoose = require('mongoose');
const { MedicalAnalysis } = require('../../../src/models');

describe('MedicalAnalysis overallHealthScore virtual', () => {
  it('starts at 100 and deducts for cognitive and psychiatric risk', () => {
    const doc = new MedicalAnalysis({
      cognitiveMetrics: { riskScore: 50 },
      psychiatricMetrics: {
        depressionScore: 60,
        anxietyScore: 40,
        crisisIndicators: { hasCrisisIndicators: false },
      },
    });

    // 100 - min(50*0.3,30)=15 - min(60*0.2,25)=12 - min(40*0.15,20)=6
    expect(doc.overallHealthScore).toBe(67);
  });

  it('deducts an additional 25 for crisis indicators', () => {
    const doc = new MedicalAnalysis({
      cognitiveMetrics: { riskScore: 0 },
      psychiatricMetrics: {
        depressionScore: 0,
        anxietyScore: 0,
        crisisIndicators: { hasCrisisIndicators: true },
      },
    });

    expect(doc.overallHealthScore).toBe(75);
  });

  it('applies capped deductions and never drops below zero', () => {
    const doc = new MedicalAnalysis({
      cognitiveMetrics: { riskScore: 100 },
      psychiatricMetrics: {
        depressionScore: 100,
        anxietyScore: 100,
        crisisIndicators: { hasCrisisIndicators: true },
      },
    });

    // 100 - min(100*0.3,30) - min(100*0.2,25) - min(100*0.15,20) - 25 = 10
    expect(doc.overallHealthScore).toBe(10);
  });

  it('returns 100 when no risk metrics are present', () => {
    const doc = new MedicalAnalysis({});
    expect(doc.overallHealthScore).toBe(100);
  });
});
