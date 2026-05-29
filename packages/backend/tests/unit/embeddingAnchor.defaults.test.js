const {
  ANCHOR_TREE,
  ANCHOR_TREE_EN,
  countUniquePhrases,
  SUPPORTED_ANCHOR_LANGUAGES,
} = require('../../src/config/embeddingAnchor.defaults');
const { I18N_ANCHORS } = require('../../src/config/embeddingAnchor.i18n');

describe('embeddingAnchor.defaults i18n merge', () => {
  it('exports all supported non-English patient languages', () => {
    expect(SUPPORTED_ANCHOR_LANGUAGES).toEqual(
      expect.arrayContaining(['es', 'fr', 'de', 'zh', 'ja', 'pt', 'it', 'ru', 'ar', 'ko', 'hu'])
    );
    expect(SUPPORTED_ANCHOR_LANGUAGES).toHaveLength(11);
  });

  it('merges more phrases than English-only tree', () => {
    const enOnly = ANCHOR_TREE_EN.emergencyDetector.medical_emergency.phrases.length;
    const merged = ANCHOR_TREE.emergencyDetector.medical_emergency.phrases.length;
    expect(merged).toBeGreaterThan(enOnly);
    expect(countUniquePhrases()).toBeGreaterThan(500);
  });

  it('includes Hungarian emergency phrases in medical_emergency bucket', () => {
    const phrases = ANCHOR_TREE.emergencyDetector.medical_emergency.phrases;
    expect(phrases.some((p) => /szívroham/i.test(p))).toBe(true);
  });

  it('includes Spanish abuse neglect phrases', () => {
    const injuries = ANCHOR_TREE.abuseNeglectDetector.physical.injuries;
    expect(injuries.some((p) => /me golpeó|me abofeteó/i.test(p))).toBe(true);
  });

  it('has i18n entries for every emergency bucket and language', () => {
    const buckets = Object.keys(I18N_ANCHORS.emergencyDetector);
    expect(buckets.length).toBeGreaterThanOrEqual(7);
    buckets.forEach((bucket) => {
      SUPPORTED_ANCHOR_LANGUAGES.forEach((lang) => {
        const list = I18N_ANCHORS.emergencyDetector[bucket][lang];
        expect(Array.isArray(list)).toBe(true);
        expect(list.length).toBeGreaterThanOrEqual(3);
      });
    });
  });
});
