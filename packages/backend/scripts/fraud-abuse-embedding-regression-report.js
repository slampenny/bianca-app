#!/usr/bin/env node
/**
 * Compares embedding-based vs keyword-based fraud/abuse scores on seed-scenario messages.
 *
 * Usage (from packages/backend):
 *   node scripts/fraud-abuse-embedding-regression-report.js
 *
 * Requires: MONGODB_URL, OPENAI_API_KEY (or config after loadSecrets)
 */

const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env'), override: false });

const mongoose = require('mongoose');
const config = require('../src/config/config');
const { embeddingAnchorService } = require('../src/services/ai/embeddingAnchor.service');
const FinancialExploitationDetector = require('../src/services/ai/financialExploitationDetector.service');
const AbuseNeglectDetector = require('../src/services/ai/abuseNeglectDetector.service');
const {
  detectFinancialKeyword,
  detectAbuseKeyword,
} = require('./lib/keywordBaselineFraudAbuse');

// Exact client lines from conversations.seeder.js addFraudAbuseConversations
const SEED = {
  financial: [
    'I met someone new online and they seem really nice. They said they need help with something.',
    'This new friend I met asked if I could send them some money. They said it was urgent and they would pay me back. I think I should help them.',
    'I sent five thousand dollars to my new friend through Western Union. They said it was an emergency and I needed to act now. They told me not to tell anyone about it.',
    'I got a call from someone saying I won a prize and I need to send them money for taxes. They said I need to send ten thousand dollars immediately or I will lose the prize. This is urgent!',
    "I need to send more money. They said I won a lottery and I need to verify my identity with gift cards. I bought five thousand dollars in gift cards. They said this is my last chance to claim the money. Don't tell anyone about this.",
  ],
  physical_abuse: [
    "I fell down yesterday and I have a bruise on my arm. I don't really remember how it happened. It was an accident I think.",
    "I have a cut on my face. I bumped into something. I am afraid to talk about it. I don't want to get in trouble.",
    'Someone hit me and I have a black eye. They said I deserved it because I did something wrong. I am scared of them. I don\'t want to tell anyone because they said they would hurt me more if I did.',
  ],
  emotional_abuse: [
    "I am not allowed to talk to my friends anymore. They said I can't see them. I feel isolated and alone.",
    'I am afraid to do anything because they control everything I do. They tell me what to do and I have to ask permission for everything. I feel worthless.',
    "They threatened me and said they would leave if I don't do what they say. I am walking on eggshells. I don't want to upset them. I can't talk to anyone about this.",
  ],
  neglect: [
    "I haven't eaten in two days. There is no food in the house. I am hungry and I don't know what to do.",
    "I haven't taken my medication in a week. I ran out and no one will help me get more. I need medical care but I can't see a doctor.",
    'I have been left alone for days. No one visits me. No one calls. I am all alone and I feel forgotten. I need help but there is no one here.',
  ],
};

const NORMAL_SAMPLES = [
  {
    label: 'recent_patient (good day)',
    messages: [
      'Good morning! I am feeling really good today. I had a great week and I am very happy with how things are going. My medications are working well and I have been sleeping better. I feel positive and optimistic about the future.',
    ],
  },
  {
    label: 'recent_patient (okay)',
    messages: [
      'Hello! I am doing okay today. Some days are better than others, but overall I am managing well. I have been taking my medications as prescribed and trying to stay active. I appreciate the support I receive.',
    ],
  },
  {
    label: 'recent_patient (tired)',
    messages: [
      'Hi there. I wanted to check in about my health. I have been feeling a bit tired lately, but I am still managing my daily activities. I am following my medication schedule and trying to maintain a routine.',
    ],
  },
  {
    label: 'declining_month1_baseline',
    messages: [
      'Good morning! I hope you are having a wonderful day. I wanted to discuss my medication schedule with you today. I take my blood pressure medication every morning at 8 AM, and I have been very consistent with it. I feel good and I have energy. I am managing my health well and everything is going smoothly. My memory has been sharp and I have been able to keep track of all my appointments and medications without any issues.',
    ],
  },
  {
    label: 'smalltalk',
    messages: ['The weather is nice today. I watered my plants.'],
  },
];

const REGRESSION_DELTA = 15;
const FP_THRESHOLD = 30;

function row(label, oldF, newF, oldA, newA) {
  const finDrop = oldF - newF >= REGRESSION_DELTA && oldF >= 40;
  const abDrop = oldA - newA >= REGRESSION_DELTA && oldA >= 35;
  const flag = finDrop || abDrop ? ' ⚠️ REGRESSION' : '';
  return {
    label,
    oldFin: oldF.toFixed(1),
    newFin: newF.toFixed(1),
    oldAbuse: oldA.toFixed(1),
    newAbuse: newA.toFixed(1),
    flag,
    finDrop,
    abDrop,
  };
}

async function main() {
  const url = config.mongoose?.url || process.env.MONGODB_URL;
  if (!url) {
    console.error('No MONGODB_URL / config.mongoose.url');
    process.exit(1);
  }
  await mongoose.connect(url, config.mongoose?.options || {});
  console.log('Connected to MongoDB\n');

  await embeddingAnchorService.ensureInitialized();
  if (!embeddingAnchorService.hasFinancialEmbeddings()) {
    console.error('Embedding anchors not loaded (check OPENAI_API_KEY). Exiting.');
    await mongoose.disconnect();
    process.exit(1);
  }

  const finDet = new FinancialExploitationDetector();
  const abuseDet = new AbuseNeglectDetector();

  console.log('='.repeat(80));
  console.log('BATCH SCENARIOS (chronological messages → one pipeline run per scenario type)');
  console.log('='.repeat(80));
  const batchRows = [];
  for (const [type, messages] of Object.entries(SEED)) {
    const combined = messages.join(' ');
    const oldF = detectFinancialKeyword(messages, combined);
    const oldA = detectAbuseKeyword(messages, combined);
    const newF = await finDet.detectFinancialExploitation(messages, combined);
    const newA = await abuseDet.detectAbuseNeglect(messages, combined);
    batchRows.push(
      row(
        type,
        oldF.riskScore,
        newF.riskScore,
        oldA.riskScore,
        newA.riskScore
      )
    );
    console.log(`\n--- ${type} ---`);
    console.log(
      `  Keyword  fin=${oldF.riskScore.toFixed(1)} abuse=${oldA.riskScore.toFixed(1)} temporalFin=${oldF.temporalPatterns.hasEscalation} temporalAb=${oldA.temporalPatterns.hasEscalation}`
    );
    console.log(
      `  Embed    fin=${newF.riskScore.toFixed(1)} abuse=${newA.riskScore.toFixed(1)} temporalFin=${newF.temporalPatterns.hasEscalation} temporalAb=${newA.temporalPatterns.hasEscalation}`
    );
  }

  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY TABLE (batch)');
  console.log('='.repeat(80));
  console.table(
    batchRows.map((r) => ({
      scenario: r.label,
      kw_fin: r.oldFin,
      emb_fin: r.newFin,
      kw_abuse: r.oldAbuse,
      emb_abuse: r.newAbuse,
      note: r.flag.trim(),
    }))
  );

  const regressions = batchRows.filter((r) => r.finDrop || r.abDrop);
  if (regressions.length) {
    console.log('\n⚠️  REGRESSIONS (new score ≥15 pts lower than keyword on material keyword score):');
    regressions.forEach((r) => console.log(`   - ${r.label}: ${r.flag}`));
  } else {
    console.log('\n✓ No batch regressions over threshold.');
  }

  console.log('\n' + '='.repeat(80));
  console.log('PER-MESSAGE (single-turn) — fraud seed lines only');
  console.log('='.repeat(80));
  const perRows = [];
  for (const [type, messages] of Object.entries(SEED)) {
    for (let i = 0; i < messages.length; i++) {
      const m = [messages[i]];
      const c = messages[i];
      const of = detectFinancialKeyword(m, c);
      const oa = detectAbuseKeyword(m, c);
      /* eslint-disable no-await-in-loop */
      const nf = await finDet.detectFinancialExploitation(m, c);
      const na = await abuseDet.detectAbuseNeglect(m, c);
      const r = row(`${type}[${i + 1}]`, of.riskScore, nf.riskScore, oa.riskScore, na.riskScore);
      perRows.push(r);
      if (r.finDrop || r.abDrop) {
        console.log(`REGRESSION ${r.label}: fin ${r.oldFin}→${r.newFin} abuse ${r.oldAbuse}→${r.newAbuse}`);
      }
    }
  }
  console.table(
    perRows.map((r) => ({
      line: r.label,
      kw_fin: r.oldFin,
      emb_fin: r.newFin,
      kw_abuse: r.oldAbuse,
      emb_abuse: r.newAbuse,
      note: r.flag.trim(),
    }))
  );

  console.log('\n' + '='.repeat(80));
  console.log(`FALSE-POSITIVE CHECK (normal chatter — flag if embedding fin OR abuse > ${FP_THRESHOLD})`);
  console.log('='.repeat(80));
  for (const { label, messages } of NORMAL_SAMPLES) {
    const combined = messages.join(' ');
    const nf = await finDet.detectFinancialExploitation(messages, combined);
    const na = await abuseDet.detectAbuseNeglect(messages, combined);
    const of = detectFinancialKeyword(messages, combined);
    const oa = detectAbuseKeyword(messages, combined);
    const hot = nf.riskScore > FP_THRESHOLD || na.riskScore > FP_THRESHOLD;
    console.log(
      `${hot ? '⚠️ FP?' : '  ok'} ${label}: emb fin=${nf.riskScore.toFixed(1)} abuse=${na.riskScore.toFixed(1)} | kw fin=${of.riskScore.toFixed(1)} abuse=${oa.riskScore.toFixed(1)}`
    );
  }

  await mongoose.disconnect();
  console.log('\nDone.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
