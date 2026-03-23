/**
 * Run with: node tests/helpers/scoreDistribution.js
 * (from packages/backend directory)
 *
 * Calls the real EmbeddingAnchorService (requires OPENAI_API_KEY) and logs
 * similarity scores for every corpus case against every detector bucket.
 * Use this to tune thresholds — look for gaps between true positives and
 * true negatives. True positives should cluster > 0.82, true negatives < 0.72.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const corpusRunner = require('./corpusRunner');
const { EmbeddingAnchorService } = require('../../src/services/embeddingAnchor.service');

const run = async () => {
  const service = new EmbeddingAnchorService();
  await service.initialize();

  const cases = corpusRunner.getAll();
  const results = [];

  for (const tc of cases) {
    const clientLines = tc.text
      .split('\n')
      .filter(
        (l) =>
          l.startsWith('Client:') ||
          l.startsWith('Cliente:') ||
          l.startsWith('Klient:') ||
          l.startsWith('客户：')
      )
      .map((l) => l.replace(/^[^:]+:\s*/, ''))
      .join(' ');

    const textForEmbed = clientLines || tc.text;
    const scores = await service.scoreAgainstAllBuckets(textForEmbed);

    results.push({
      id: tc.id,
      label: tc.label,
      language: tc.language,
      shouldAlert: tc.shouldAlert,
      tense: tc.tense,
      scores,
    });

    console.log(`\n${tc.id} [shouldAlert=${tc.shouldAlert}] (${tc.language}, ${tc.tense})`);
    console.log(`  ${tc.label}`);
    Object.entries(scores).forEach(([bucket, score]) => {
      const flag = score >= 0.78 ? ' *** HIT' : score >= 0.72 ? ' -- near miss' : '';
      console.log(`  ${bucket.padEnd(30)} ${Number(score).toFixed(4)}${flag}`);
    });
  }

  console.log('\n\n=== AMBIGUITY ZONE (0.72-0.82) ===');
  results.forEach((r) => {
    const ambiguous = Object.entries(r.scores).filter(([, s]) => s >= 0.72 && s < 0.82);
    if (ambiguous.length > 0) {
      console.log(
        `${r.id} (shouldAlert=${r.shouldAlert}): ${ambiguous.map(([b, s]) => `${b}=${Number(s).toFixed(4)}`).join(', ')}`
      );
    }
  });
};

run().catch(console.error);
