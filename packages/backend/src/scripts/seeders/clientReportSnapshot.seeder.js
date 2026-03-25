const mongoose = require('mongoose');
const { MedicalAnalysis, FraudAbuseAnalysis } = require('../../models');

/**
 * Deterministic medical + fraud/abuse rows so home “glance” stats are populated without running AI jobs.
 * Latest row per client wins; we remove existing rows for these clients first.
 *
 * @param {Array<{ _id: mongoose.Types.ObjectId, name?: string }>} clients
 */
async function seedClientReportSnapshots(clients) {
  if (!clients?.length) {
    return;
  }

  const ids = clients.map((c) => c._id).filter(Boolean);
  if (!ids.length) {
    return;
  }

  console.log('Seeding client report snapshots (medical + fraud/abuse) for home glance...');

  await MedicalAnalysis.deleteMany({ clientId: { $in: ids } });
  await FraudAbuseAnalysis.deleteMany({ clientId: { $in: ids } });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = now;

  const medicalFor = (clientId, cognitiveRisk, depression, anxiety) => ({
    clientId,
    analysisDate: now,
    timeRange: 'month',
    startDate: monthStart,
    endDate: monthEnd,
    conversationCount: 6,
    messageCount: 24,
    totalWords: 1800,
    confidence: 'medium',
    cognitiveMetrics: {
      riskScore: cognitiveRisk,
      confidence: 'medium',
    },
    psychiatricMetrics: {
      depressionScore: depression,
      anxietyScore: anxiety,
      crisisIndicators: {
        hasCrisisIndicators: false,
        crisisCount: 0,
        crisisWords: [],
      },
    },
    warnings: [],
    recommendations: [],
  });

  const fraudFor = (clientId, overall, financial, abuse, relationship) => ({
    clientId,
    analysisDate: now,
    timeRange: 'month',
    startDate: monthStart,
    endDate: monthEnd,
    conversationCount: 6,
    messageCount: 48,
    totalWords: 2200,
    overallRiskScore: overall,
    confidence: 'medium',
    financialRisk: { riskScore: financial, confidence: 'medium' },
    abuseRisk: { riskScore: abuse, confidence: 'medium' },
    relationshipRisk: { riskScore: relationship, confidence: 'medium' },
    warnings: [],
    recommendations: [],
  });

  const medicalRows = [];
  const fraudRows = [];

  clients.forEach((client, index) => {
    const name = (client.name || '').toLowerCase();
    let cog = 14;
    let dep = 10;
    let anx = 8;
    let overallR = 22;
    let fin = 18;
    let ab = 16;
    let rel = 14;

    if (name.includes('agnes')) {
      cog = 18;
      dep = 12;
      anx = 10;
      overallR = 24;
      fin = 16;
      ab = 18;
      rel = 20;
    } else if (name.includes('barnaby')) {
      cog = 10;
      dep = 8;
      anx = 7;
      overallR = 14;
      fin = 10;
      ab = 12;
      rel = 11;
    } else if (name.includes('margaret')) {
      cog = 32;
      dep = 22;
      anx = 18;
      overallR = 71;
      fin = 78;
      ab = 42;
      rel = 48;
    } else {
      const h = index % 5;
      overallR = 12 + h * 13;
      cog = 8 + h * 6;
      dep = 6 + h * 5;
      anx = 5 + h * 4;
      fin = overallR - 4;
      ab = Math.max(8, overallR - 18);
      rel = Math.max(8, overallR - 22);
    }

    medicalRows.push(medicalFor(client._id, cog, dep, anx));
    fraudRows.push(fraudFor(client._id, Math.min(100, overallR), fin, ab, rel));
  });

  await MedicalAnalysis.insertMany(medicalRows);
  await FraudAbuseAnalysis.insertMany(fraudRows);
  console.log(`Inserted ${medicalRows.length} medical and ${fraudRows.length} fraud/abuse snapshot rows`);
}

module.exports = {
  seedClientReportSnapshots,
};
