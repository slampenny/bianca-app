/**
 * Pre-embedding keyword/regex fraud & abuse scoring (baseline for regression reports).
 * Mirrors logic removed from financialExploitationDetector + abuseNeglectDetector.
 */

const natural = require('natural');

const largeAmountPatterns = [
  /\b(\$?\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(thousand|million|grand|k|m)\b/i,
  /\b(ten|twenty|thirty|fifty|hundred|thousand|million)\s*(dollars?|bucks?)\b/i,
  /\b\d{4,}\s*(dollars?|bucks?)\b/i,
];

const transferMethods = [
  'wire transfer',
  'western union',
  'moneygram',
  'gift card',
  'prepaid card',
  'bitcoin',
  'cryptocurrency',
  'venmo',
  'paypal',
  'zelle',
  'cash app',
  'money order',
  'cashier check',
  'certified check',
];

const scamIndicators = [
  'prize',
  'lottery',
  'winner',
  'you won',
  'congratulations',
  'irs',
  'tax',
  'social security',
  'medicare',
  'government',
  'arrest warrant',
  'suspended',
  'expired',
  'verify',
  'nigerian prince',
  'inheritance',
  'unclaimed money',
  'tech support',
  'microsoft',
  'apple',
  'amazon refund',
];

const urgencyLanguage = [
  'act now',
  'urgent',
  'immediately',
  'today only',
  'limited time',
  "don't tell anyone",
  'keep this secret',
  'confidential',
  'this is your last chance',
  'expires today',
  'deadline',
];

const helpRequests = [
  'need money',
  'loan',
  'borrow',
  'lend me',
  'can you send',
  'emergency money',
  'help with bills',
  'behind on payments',
  'need cash',
  'short on money',
  'financial trouble',
];

const relationshipMoney = [
  'new friend',
  'met someone',
  'someone i know',
  'person i met',
  'they need help',
  'they asked for',
  'they want me to send',
];

const tokenizer = new natural.WordTokenizer();

function analyzeLargeAmounts(text) {
  const matches = [];
  largeAmountPatterns.forEach((pattern) => {
    const found = text.match(new RegExp(pattern.source || pattern, 'gi'));
    if (found) matches.push(...found);
  });
  return { count: matches.length };
}

function countKeywordMatches(lowerText, keywords, useWordBoundary) {
  let count = 0;
  keywords.forEach((keyword) => {
    const regex = useWordBoundary
      ? new RegExp(`\\b${keyword.replace(/\s+/g, '\\s+')}\\b`, 'gi')
      : new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const found = lowerText.match(regex);
    if (found) count += found.length;
  });
  return count;
}

function financialTemporalKeywordCount(lowerMsg) {
  let c = 0;
  [...transferMethods, ...scamIndicators, ...urgencyLanguage].forEach((keyword) => {
    const regex = new RegExp(`\\b${keyword.replace(/\s+/g, '\\s+')}\\b`, 'gi');
    if (lowerMsg.match(regex)) c += 1;
  });
  return c;
}

function calculateFinancialRiskScore(analyses) {
  let score = 0;
  let totalWeight = 0;
  const w = { largeAmounts: 0.25, transferMethods: 0.2, scamIndicators: 0.3, urgencyLanguage: 0.15, helpRequests: 0.1 };

  if (analyses.largeAmounts.count > 0) {
    score += Math.min(analyses.largeAmounts.count * 10, 100) * w.largeAmounts;
    totalWeight += w.largeAmounts;
  }
  if (analyses.transferMethods.count > 0) {
    score += Math.min(analyses.transferMethods.count * 15, 100) * w.transferMethods;
    totalWeight += w.transferMethods;
  }
  if (analyses.scamIndicators.count > 0) {
    score += Math.min(analyses.scamIndicators.count * 12, 100) * w.scamIndicators;
    totalWeight += w.scamIndicators;
  }
  if (analyses.urgencyLanguage.count > 0) {
    score += Math.min(analyses.urgencyLanguage.count * 20, 100) * w.urgencyLanguage;
    totalWeight += w.urgencyLanguage;
  }
  if (analyses.helpRequests.count > 0) {
    score += Math.min(analyses.helpRequests.count * 8, 100) * w.helpRequests;
    totalWeight += w.helpRequests;
  }
  if (analyses.relationshipMoney.count > 0) {
    score += Math.min(analyses.relationshipMoney.count * 15, 100) * 0.15;
    totalWeight += 0.15;
  }
  if (analyses.temporalPatterns?.hasEscalation) {
    score += 20;
  }
  if (totalWeight > 0) score /= totalWeight;
  return Math.min(score, 100);
}

function detectFinancialKeyword(patientMessages, combinedText) {
  const lowerText = combinedText.toLowerCase();
  const la = analyzeLargeAmounts(combinedText);
  const transferCount = countKeywordMatches(lowerText, transferMethods, true);
  const scamCount = countKeywordMatches(lowerText, scamIndicators, true);
  let urgencyCount = 0;
  urgencyLanguage.forEach((phrase) => {
    const regex = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const found = lowerText.match(regex);
    if (found) urgencyCount += found.length;
  });
  let helpCount = 0;
  helpRequests.forEach((phrase) => {
    const regex = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const found = lowerText.match(regex);
    if (found) helpCount += found.length;
  });
  let relCount = 0;
  relationshipMoney.forEach((phrase) => {
    const regex = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const found = lowerText.match(regex);
    if (found) relCount += found.length;
  });

  let temporalPatterns = { hasEscalation: false, trend: 'insufficient_data' };
  if (patientMessages.length >= 3) {
    const financialMentions = patientMessages.map((msg) => ({
      count: financialTemporalKeywordCount(msg.toLowerCase()),
    }));
    const recent = financialMentions.slice(-5);
    const earlier = financialMentions.slice(0, Math.max(1, Math.floor(financialMentions.length / 2)));
    const recentAvg = recent.reduce((s, m) => s + m.count, 0) / recent.length;
    const earlierAvg = earlier.reduce((s, m) => s + m.count, 0) / earlier.length;
    temporalPatterns = {
      hasEscalation: recentAvg > earlierAvg * 1.5,
      trend: recentAvg > earlierAvg ? 'increasing' : recentAvg < earlierAvg ? 'decreasing' : 'stable',
      recentAverage: recentAvg,
      earlierAverage: earlierAvg,
    };
  }

  const analyses = {
    largeAmounts: la,
    transferMethods: { count: transferCount },
    scamIndicators: { count: scamCount },
    urgencyLanguage: { count: urgencyCount },
    helpRequests: { count: helpCount },
    relationshipMoney: { count: relCount },
    temporalPatterns,
  };

  return {
    riskScore: Math.round(calculateFinancialRiskScore(analyses) * 100) / 100,
    temporalPatterns,
    largeAmountMentions: la.count,
    transferMethodMentions: transferCount,
    scamIndicatorMentions: scamCount,
    urgencyMentions: urgencyCount,
    helpRequestMentions: helpCount,
    relationshipMoneyMentions: relCount,
  };
}

/* --- Abuse baseline --- */

const physicalAbuseIndicators = {
  injuries: [
    'bruise',
    'bruised',
    'cut',
    'cut me',
    'hit',
    'hit me',
    'punched',
    'slapped',
    'pushed',
    'shoved',
    'grabbed',
    'pulled',
    'hurt me',
    'injured',
    'wound',
    'black eye',
    'swollen',
    'bleeding',
    'sore',
    'painful',
  ],
  inconsistentExplanations: [
    'fell',
    'accident',
    'bumped into',
    'tripped',
    'slipped',
    "don't remember",
    'not sure how',
    'happened somehow',
  ],
  fearOfPerson: [
    'afraid of',
    'scared of',
    'fear',
    'worried about',
    "don't like",
    'makes me nervous',
    'intimidated by',
    'threatened by',
  ],
  punishment: [
    'punished',
    'punishment',
    'disciplined',
    'taught a lesson',
    'got what i deserved',
    'had it coming',
    'deserved it',
  ],
};

const emotionalAbuseIndicators = {
  isolation: [
    'not allowed to',
    "can't talk to",
    'forbidden to',
    'not supposed to',
    'told me not to',
    "said i can't",
    "won't let me",
    'keeps me from',
  ],
  control: [
    'controls',
    'tells me what to do',
    'makes decisions for me',
    "won't let me",
    'has to approve',
    'needs permission',
  ],
  threats: [
    'threatened',
    'threat',
    'threatens',
    'warned me',
    'said they would',
    'going to',
    'will hurt',
    'will take away',
    'will leave',
  ],
  belittling: [
    'stupid',
    'worthless',
    'useless',
    'burden',
    'incompetent',
    "can't do anything right",
    'always wrong',
    'never right',
  ],
  fearLanguage: [
    'afraid to',
    'scared to',
    'fear',
    'worried',
    'anxious about',
    "don't want to upset",
    "don't want trouble",
    'walking on eggshells',
  ],
};

const neglectIndicators = {
  basicNeeds: [
    'no food',
    'hungry',
    "haven't eaten",
    'no medication',
    'missed medication',
    'out of medicine',
    'no water',
    'thirsty',
    'dirty',
    "haven't showered",
    'no clean clothes',
    'cold',
    'no heat',
    'no electricity',
  ],
  medicalCare: [
    "can't see doctor",
    'no doctor',
    'missed appointment',
    'no medical care',
    'pain',
    'sick',
    'not feeling well',
    'need help',
    'need care',
  ],
  isolation: [
    'alone',
    'no one visits',
    'no one calls',
    'lonely',
    'isolated',
    'left alone',
    'abandoned',
    'forgotten',
    'no one cares',
  ],
  timeAlone: [
    'days alone',
    'weeks alone',
    'left me',
    'gone for',
    "hasn't been here",
    'no one here',
    'by myself',
    'all alone',
  ],
};

const allAbuseKeywordsFlat = [
  ...Object.values(physicalAbuseIndicators).flat(),
  ...Object.values(emotionalAbuseIndicators).flat(),
  ...Object.values(neglectIndicators).flat(),
];

function analyzePhysicalAbuseKeyword(lowerText, messages) {
  let injuries = 0;
  physicalAbuseIndicators.injuries.forEach((keyword) => {
    const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    const found = lowerText.match(regex);
    if (found) injuries += found.length;
  });
  let fears = 0;
  physicalAbuseIndicators.fearOfPerson.forEach((phrase) => {
    const regex = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const found = lowerText.match(regex);
    if (found) fears += found.length;
  });
  let punishments = 0;
  physicalAbuseIndicators.punishment.forEach((phrase) => {
    const regex = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const found = lowerText.match(regex);
    if (found) punishments += found.length;
  });
  let inconsistentCount = 0;
  const injuryMsgs = messages.filter((msg) =>
    physicalAbuseIndicators.injuries.some((k) => msg.toLowerCase().includes(k))
  );
  injuryMsgs.forEach((msg) => {
    const lm = msg.toLowerCase();
    if (physicalAbuseIndicators.inconsistentExplanations.some((p) => lm.includes(p))) {
      inconsistentCount += 1;
    }
  });
  const injuryScore = Math.min(injuries * 15, 100);
  const fearScore = Math.min(fears * 20, 100);
  const punishmentScore = Math.min(punishments * 25, 100);
  const inconsistentScore = inconsistentCount * 30;
  const score = Math.min(
    injuryScore * 0.3 + fearScore * 0.3 + punishmentScore * 0.3 + inconsistentScore * 0.1,
    100
  );
  return { score };
}

function analyzeEmotionalAbuseKeyword(lowerText) {
  const counts = { iso: 0, ctrl: 0, thr: 0, bel: 0, fear: 0 };
  emotionalAbuseIndicators.isolation.forEach((phrase) => {
    const found = lowerText.match(new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'));
    if (found) counts.iso += found.length;
  });
  emotionalAbuseIndicators.control.forEach((phrase) => {
    const found = lowerText.match(new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'));
    if (found) counts.ctrl += found.length;
  });
  emotionalAbuseIndicators.threats.forEach((phrase) => {
    const found = lowerText.match(new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'));
    if (found) counts.thr += found.length;
  });
  emotionalAbuseIndicators.belittling.forEach((keyword) => {
    const found = lowerText.match(
      new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
    );
    if (found) counts.bel += found.length;
  });
  emotionalAbuseIndicators.fearLanguage.forEach((phrase) => {
    const found = lowerText.match(new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'));
    if (found) counts.fear += found.length;
  });
  const score = Math.min(
    Math.min(counts.iso * 15, 100) * 0.25 +
      Math.min(counts.ctrl * 20, 100) * 0.25 +
      Math.min(counts.thr * 25, 100) * 0.2 +
      Math.min(counts.bel * 18, 100) * 0.15 +
      Math.min(counts.fear * 15, 100) * 0.15,
    100
  );
  return { score };
}

function analyzeNeglectKeyword(lowerText) {
  const countBucket = (phrases) => {
    let n = 0;
    phrases.forEach((phrase) => {
      const found = lowerText.match(new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'));
      if (found) n += found.length;
    });
    return n;
  };
  const basic = countBucket(neglectIndicators.basicNeeds);
  const med = countBucket(neglectIndicators.medicalCare);
  const iso = countBucket(neglectIndicators.isolation);
  const ta = countBucket(neglectIndicators.timeAlone);
  const score = Math.min(
    Math.min(basic * 20, 100) * 0.3 +
      Math.min(med * 25, 100) * 0.35 +
      Math.min(iso * 15, 100) * 0.2 +
      Math.min(ta * 18, 100) * 0.15,
    100
  );
  return { score };
}

function abuseTemporalKeyword(messages) {
  if (messages.length < 3) return { hasEscalation: false, trend: 'insufficient_data' };
  const abuseMentions = messages.map((msg) => {
    const lowerMsg = msg.toLowerCase();
    let count = 0;
    allAbuseKeywordsFlat.forEach((keyword) => {
      const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      if (lowerMsg.match(regex)) count += 1;
    });
    return { count };
  });
  const recent = abuseMentions.slice(-5);
  const earlier = abuseMentions.slice(0, Math.max(1, Math.floor(abuseMentions.length / 2)));
  const recentAvg = recent.reduce((s, m) => s + m.count, 0) / recent.length;
  const earlierAvg = earlier.reduce((s, m) => s + m.count, 0) / earlier.length;
  return {
    hasEscalation: recentAvg > earlierAvg * 1.5,
    trend: recentAvg > earlierAvg ? 'increasing' : recentAvg < earlierAvg ? 'decreasing' : 'stable',
    recentAverage: recentAvg,
    earlierAverage: earlierAvg,
  };
}

function detectAbuseKeyword(patientMessages, combinedText) {
  const lowerText = combinedText.toLowerCase();
  const physical = analyzePhysicalAbuseKeyword(lowerText, patientMessages);
  const emotional = analyzeEmotionalAbuseKeyword(lowerText);
  const neglect = analyzeNeglectKeyword(lowerText);
  const temporalPatterns = abuseTemporalKeyword(patientMessages);
  let riskScore = 0;
  if (physical.score > 0) riskScore += physical.score * 0.4;
  if (emotional.score > 0) riskScore += emotional.score * 0.35;
  if (neglect.score > 0) riskScore += neglect.score * 0.25;
  if (temporalPatterns.hasEscalation) riskScore += 15;
  riskScore = Math.min(riskScore, 100);
  return {
    riskScore: Math.round(riskScore * 100) / 100,
    physicalAbuseScore: physical.score,
    emotionalAbuseScore: emotional.score,
    neglectScore: neglect.score,
    temporalPatterns,
  };
}

module.exports = {
  detectFinancialKeyword,
  detectAbuseKeyword,
};
