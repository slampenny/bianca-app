// src/services/ai/abuseNeglectDetector.service.js

const logger = require('../../config/logger');
const {
  embeddingAnchorService,
  THRESHOLD_STANDARD,
  THRESHOLD_STRICT,
  THRESHOLD_TEMPORAL_ABUSE,
  similarityToSubScore,
} = require('./embeddingAnchor.service');

const T = THRESHOLD_STANDARD;
const T_STRICT = THRESHOLD_STRICT;

/**
 * Abuse and Neglect Detector Service
 * Semantic similarity vs anchored phrases (text-embedding-3-large)
 */
class AbuseNeglectDetector {
  constructor() {
    this.weights = {
      physicalAbuse: 0.40,
      emotionalAbuse: 0.35,
      neglect: 0.25,
    };
  }

  /** Sentence/clause slices for temporal hits and emotional clause-peak (combined embed dilutes lines). */
  _extractAbuseClauses(msg) {
    if (!msg || !String(msg).trim()) return [];
    const t = String(msg).trim();
    const parts = new Set();
    const add = (s) => {
      const x = s.trim();
      if (x.length >= 8) parts.add(x);
    };
    const sents = t.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
    const blocks = sents.length ? sents : [t];
    for (const b of blocks) {
      add(b);
      if (b.length > 28) {
        b.split(/\s+and\s+/i).forEach((sub) => add(sub));
      }
    }
    const out = [...parts];
    return out.length ? out : [t];
  }

  _peakPhysicalEmotionalFromClauses(patientMessages) {
    const flat = [];
    const ranges = [];
    for (const msg of patientMessages) {
      const clauses = this._extractAbuseClauses(msg);
      const start = flat.length;
      flat.push(...clauses);
      ranges.push([start, flat.length]);
    }
    return { flat, ranges };
  }

  /** One clause batch: per-message max for temporal + peak emotional bucket sims (combined embed dilutes emotional lines). */
  async _clauseTemporalAndEmotionalPeak(patientMessages) {
    const { flat, ranges } = this._peakPhysicalEmotionalFromClauses(patientMessages);
    if (!flat.length || !embeddingAnchorService.hasAbuseEmbeddings()) {
      return {
        perMessageMax: patientMessages.map(() => 0),
        emotionalPeak: null,
      };
    }
    const norms = await embeddingAnchorService.embedQueries(flat);
    let peak = null;
    for (let i = 0; i < norms.length; i++) {
      const q = norms[i];
      if (!q) continue;
      const c = embeddingAnchorService.getAbuseBucketSimilarities(q).emotional;
      if (!peak) {
        peak = { ...c };
      } else {
        peak.isolation = Math.max(peak.isolation, c.isolation);
        peak.control = Math.max(peak.control, c.control);
        peak.threats = Math.max(peak.threats, c.threats);
        peak.belittling = Math.max(peak.belittling, c.belittling);
        peak.fearLanguage = Math.max(peak.fearLanguage, c.fearLanguage);
      }
    }
    const perMessageMax = ranges.map(([a, b]) => {
      let maxS = 0;
      for (let j = a; j < b; j++) {
        if (norms[j]) {
          maxS = Math.max(maxS, embeddingAnchorService.maxSimilarityToAllAbuseAnchors(norms[j]));
        }
      }
      return maxS;
    });
    return { perMessageMax, emotionalPeak: peak };
  }

  async detectAbuseNeglect(patientMessages, combinedText) {
    try {
      if (!patientMessages || patientMessages.length === 0) {
        return this.getDefaultMetrics();
      }

      await embeddingAnchorService.ensureInitialized();
      if (!embeddingAnchorService.isConfigured() || !embeddingAnchorService.hasAbuseEmbeddings()) {
        return this.getDefaultMetrics();
      }

      const queryNorm = await embeddingAnchorService.embedQuery(combinedText);
      if (!queryNorm) {
        logger.warn('[AbuseNeglectDetector] No query embedding (missing API key or empty text)');
        return this.getDefaultMetrics();
      }

      let sims = embeddingAnchorService.getAbuseBucketSimilarities(queryNorm);
      if (!sims) {
        return this.getDefaultMetrics();
      }

      const { perMessageMax, emotionalPeak } = await this._clauseTemporalAndEmotionalPeak(
        patientMessages
      );
      if (emotionalPeak) {
        sims.emotional.isolation = Math.max(sims.emotional.isolation, emotionalPeak.isolation);
        sims.emotional.control = Math.max(sims.emotional.control, emotionalPeak.control);
        sims.emotional.threats = Math.max(sims.emotional.threats, emotionalPeak.threats);
        sims.emotional.belittling = Math.max(sims.emotional.belittling, emotionalPeak.belittling);
        sims.emotional.fearLanguage = Math.max(
          sims.emotional.fearLanguage,
          emotionalPeak.fearLanguage
        );
      }
      const temporalPatterns = this._temporalEscalationFromHits(
        patientMessages,
        perMessageMax.map((m) => (m >= THRESHOLD_TEMPORAL_ABUSE ? 1 : 0))
      );

      const physicalAbuseAnalysis = this.analyzePhysicalAbuse(sims);
      const emotionalAbuseAnalysis = this.analyzeEmotionalAbuse(sims);
      const neglectAnalysis = this.analyzeNeglect(sims);

      const riskScore = this.calculateRiskScore({
        physicalAbuse: physicalAbuseAnalysis,
        emotionalAbuse: emotionalAbuseAnalysis,
        neglect: neglectAnalysis,
        temporalPatterns,
      });

      const indicators = this.generateIndicators({
        physicalAbuse: physicalAbuseAnalysis,
        emotionalAbuse: emotionalAbuseAnalysis,
        neglect: neglectAnalysis,
        temporalPatterns,
      });

      return {
        riskScore: Math.round(riskScore * 100) / 100,
        confidence: this.calculateConfidence(combinedText.length, patientMessages.length),
        indicators,
        physicalAbuseScore: physicalAbuseAnalysis.score,
        emotionalAbuseScore: emotionalAbuseAnalysis.score,
        neglectScore: neglectAnalysis.score,
        injuryMentions: physicalAbuseAnalysis.injuryCount,
        isolationMentions: emotionalAbuseAnalysis.isolationCount + neglectAnalysis.isolationCount,
        fearMentions: physicalAbuseAnalysis.fearCount + emotionalAbuseAnalysis.fearCount,
        basicNeedsMentions: neglectAnalysis.basicNeedsCount,
        temporalPatterns,
        flaggedPhrases: [
          ...physicalAbuseAnalysis.phrases,
          ...emotionalAbuseAnalysis.phrases,
          ...neglectAnalysis.phrases,
        ].slice(0, 10),
      };
    } catch (error) {
      logger.error('Error in AbuseNeglectDetector:', error);
      return this.getDefaultMetrics();
    }
  }

  analyzePhysicalAbuse(sims) {
    const injSim = sims.physical.injuries;
    const incSim = sims.physical.inconsistentExplanations;
    const fearSim = sims.physical.fearOfPerson;
    const punSim = sims.physical.punishment;

    const injuryActive = injSim >= T;
    const injuryScore = similarityToSubScore(injSim, T);
    const fearScore = similarityToSubScore(fearSim, T);
    const punishmentScore = similarityToSubScore(punSim, T);
    const inconsistentScore =
      injuryActive && incSim >= T ? similarityToSubScore(incSim, T) : 0;

    const score = Math.min(
      injuryScore * 0.3 + fearScore * 0.3 + punishmentScore * 0.3 + inconsistentScore * 0.1,
      100
    );

    const phrases = [];
    if (injuryActive) phrases.push('injuries(semantic)');
    if (inconsistentScore > 0) phrases.push('inconsistentExplanations(semantic)');
    if (fearSim >= T) phrases.push('fearOfPerson(semantic)');
    if (punSim >= T) phrases.push('punishment(semantic)');

    return {
      score,
      injuryCount: injuryActive ? Math.max(1, Math.round(injuryScore / 20)) : 0,
      fearCount: fearSim >= T ? Math.max(1, Math.round(fearScore / 20)) : 0,
      punishmentCount: punSim >= T ? Math.max(1, Math.round(punishmentScore / 25)) : 0,
      inconsistentExplanations: inconsistentScore > 0 ? 1 : 0,
      phrases,
    };
  }

  analyzeEmotionalAbuse(sims) {
    const iso = similarityToSubScore(sims.emotional.isolation, T);
    const ctrl = similarityToSubScore(sims.emotional.control, T);
    const thr = similarityToSubScore(sims.emotional.threats, T);
    const bel = similarityToSubScore(sims.emotional.belittling, T);
    const fear = similarityToSubScore(sims.emotional.fearLanguage, T);

    const score = Math.min(iso * 0.25 + ctrl * 0.25 + thr * 0.2 + bel * 0.15 + fear * 0.15, 100);

    const phrases = [];
    if (sims.emotional.isolation >= T) phrases.push('isolation(semantic)');
    if (sims.emotional.control >= T) phrases.push('control(semantic)');
    if (sims.emotional.threats >= T) phrases.push('threats(semantic)');
    if (sims.emotional.belittling >= T) phrases.push('belittling(semantic)');
    if (sims.emotional.fearLanguage >= T) phrases.push('fearLanguage(semantic)');

    return {
      score,
      isolationCount: sims.emotional.isolation >= T ? Math.max(1, Math.round(iso / 15)) : 0,
      controlCount: sims.emotional.control >= T ? Math.max(1, Math.round(ctrl / 20)) : 0,
      threatCount: sims.emotional.threats >= T ? Math.max(1, Math.round(thr / 25)) : 0,
      belittlingCount: sims.emotional.belittling >= T ? Math.max(1, Math.round(bel / 18)) : 0,
      fearCount: sims.emotional.fearLanguage >= T ? Math.max(1, Math.round(fear / 15)) : 0,
      phrases,
    };
  }

  analyzeNeglect(sims) {
    const basic = similarityToSubScore(sims.neglect.basicNeeds, T_STRICT);
    const med = similarityToSubScore(sims.neglect.medicalCare, T_STRICT);
    const iso = similarityToSubScore(sims.neglect.isolation, T);
    const timeA = similarityToSubScore(sims.neglect.timeAlone, T);

    const score = Math.min(basic * 0.3 + med * 0.35 + iso * 0.2 + timeA * 0.15, 100);

    const phrases = [];
    if (sims.neglect.basicNeeds >= T_STRICT) phrases.push('basicNeeds(semantic)');
    if (sims.neglect.medicalCare >= T_STRICT) phrases.push('medicalCare(semantic)');
    if (sims.neglect.isolation >= T) phrases.push('neglectIsolation(semantic)');
    if (sims.neglect.timeAlone >= T) phrases.push('timeAlone(semantic)');

    return {
      score,
      basicNeedsCount: sims.neglect.basicNeeds >= T_STRICT ? Math.max(1, Math.round(basic / 20)) : 0,
      medicalCareCount: sims.neglect.medicalCare >= T_STRICT ? Math.max(1, Math.round(med / 25)) : 0,
      isolationCount: sims.neglect.isolation >= T ? Math.max(1, Math.round(iso / 15)) : 0,
      timeAloneCount: sims.neglect.timeAlone >= T ? Math.max(1, Math.round(timeA / 18)) : 0,
      phrases,
    };
  }

  _temporalEscalationFromHits(messages, perMessageHit01) {
    if (messages.length < 3) {
      return { hasEscalation: false, trend: 'insufficient_data' };
    }
    const abuseMentions = perMessageHit01.map((count, idx) => ({ index: idx, count }));
    const recent = abuseMentions.slice(-5);
    const earlier = abuseMentions.slice(0, Math.max(1, Math.floor(abuseMentions.length / 2)));
    const recentAvg = recent.reduce((sum, m) => sum + m.count, 0) / recent.length;
    const earlierAvg = earlier.reduce((sum, m) => sum + m.count, 0) / earlier.length;

    return {
      hasEscalation: recentAvg > earlierAvg * 1.5,
      trend:
        recentAvg > earlierAvg ? 'increasing' : recentAvg < earlierAvg ? 'decreasing' : 'stable',
      recentAverage: recentAvg,
      earlierAverage: earlierAvg,
    };
  }

  async analyzeTemporalPatterns(messages) {
    await embeddingAnchorService.ensureInitialized();
    if (!embeddingAnchorService.isConfigured() || !embeddingAnchorService.hasAbuseEmbeddings()) {
      return { hasEscalation: false, trend: 'insufficient_data' };
    }
    const { perMessageMax } = await this._clauseTemporalAndEmotionalPeak(messages);
    return this._temporalEscalationFromHits(
      messages,
      perMessageMax.map((m) => (m >= THRESHOLD_TEMPORAL_ABUSE ? 1 : 0))
    );
  }

  calculateRiskScore(analyses) {
    let score = 0;
    if (analyses.physicalAbuse.score > 0) {
      score += analyses.physicalAbuse.score * this.weights.physicalAbuse;
    }
    if (analyses.emotionalAbuse.score > 0) {
      score += analyses.emotionalAbuse.score * this.weights.emotionalAbuse;
    }
    if (analyses.neglect.score > 0) {
      score += analyses.neglect.score * this.weights.neglect;
    }
    if (analyses.temporalPatterns?.hasEscalation) {
      score += 15;
    }
    return Math.min(score, 100);
  }

  generateIndicators(analyses) {
    const indicators = [];
    if (analyses.physicalAbuse.score > 30) {
      indicators.push({
        type: 'physical_abuse',
        severity: analyses.physicalAbuse.score > 60 ? 'high' : 'medium',
        message: `Physical abuse indicators detected (score: ${analyses.physicalAbuse.score.toFixed(0)})`,
      });
    }
    if (analyses.emotionalAbuse.score > 30) {
      indicators.push({
        type: 'emotional_abuse',
        severity: analyses.emotionalAbuse.score > 60 ? 'high' : 'medium',
        message: `Emotional abuse indicators detected (score: ${analyses.emotionalAbuse.score.toFixed(0)})`,
      });
    }
    if (analyses.neglect.score > 30) {
      indicators.push({
        type: 'neglect',
        severity: analyses.neglect.score > 60 ? 'high' : 'medium',
        message: `Neglect indicators detected (score: ${analyses.neglect.score.toFixed(0)})`,
      });
    }
    if (analyses.temporalPatterns?.hasEscalation) {
      indicators.push({
        type: 'escalation',
        severity: 'high',
        message: 'Abuse/neglect mentions have increased over time',
      });
    }
    return indicators;
  }

  calculateConfidence(textLength, messageCount) {
    if (textLength < 500 || messageCount < 3) return 'low';
    if (textLength < 2000 || messageCount < 10) return 'medium';
    return 'high';
  }

  getDefaultMetrics() {
    return {
      riskScore: 0,
      confidence: 'none',
      indicators: [],
      physicalAbuseScore: 0,
      emotionalAbuseScore: 0,
      neglectScore: 0,
      injuryMentions: 0,
      isolationMentions: 0,
      fearMentions: 0,
      basicNeedsMentions: 0,
      temporalPatterns: { hasEscalation: false, trend: 'insufficient_data' },
      flaggedPhrases: [],
    };
  }
}

module.exports = AbuseNeglectDetector;
