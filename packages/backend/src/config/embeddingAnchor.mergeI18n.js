/**
 * Merges per-language anchor phrases into the English ANCHOR_TREE (deduped by exact phrase text).
 * Languages align with client/caregiver preferredLanguage codes (excluding en).
 */

/** @typedef {Record<string, string[]>} LangPhrases */

const SUPPORTED_ANCHOR_LANGUAGES = ['es', 'fr', 'de', 'zh', 'ja', 'pt', 'it', 'ru', 'ar', 'ko', 'hu'];

function collectLangPhrases(langMap) {
  if (!langMap || typeof langMap !== 'object') return [];
  const out = [];
  for (const lang of SUPPORTED_ANCHOR_LANGUAGES) {
    const list = langMap[lang];
    if (Array.isArray(list)) out.push(...list);
  }
  return out;
}

function appendUnique(target, additions) {
  const seen = new Set(target);
  for (const p of additions) {
    const s = String(p).trim();
    if (!s || seen.has(s)) continue;
    target.push(s);
    seen.add(s);
  }
}

/**
 * @param {import('./embeddingAnchor.defaults').ANCHOR_TREE} tree — mutated in place
 * @param {object} i18n — see embeddingAnchor.i18n.js
 */
function mergeI18nIntoAnchorTree(tree, i18n) {
  if (!i18n) return tree;

  const em = i18n.emergencyDetector;
  if (em) {
    Object.keys(em).forEach((bucket) => {
      if (tree.emergencyDetector[bucket]?.phrases) {
        appendUnique(tree.emergencyDetector[bucket].phrases, collectLangPhrases(em[bucket]));
      }
    });
  }

  const abuse = i18n.abuseNeglectDetector;
  if (abuse) {
    Object.keys(abuse).forEach((category) => {
      if (!tree.abuseNeglectDetector[category]) return;
      Object.keys(abuse[category]).forEach((bucket) => {
        const target = tree.abuseNeglectDetector[category][bucket];
        if (Array.isArray(target)) {
          appendUnique(target, collectLangPhrases(abuse[category][bucket]));
        }
      });
    });
  }

  const fin = i18n.financialExploitationDetector;
  if (fin) {
    Object.keys(fin).forEach((bucket) => {
      if (Array.isArray(tree.financialExploitationDetector[bucket])) {
        appendUnique(tree.financialExploitationDetector[bucket], collectLangPhrases(fin[bucket]));
      }
    });
  }

  const rel = i18n.relationshipPatternDetector;
  if (rel) {
    Object.keys(rel).forEach((bucket) => {
      if (Array.isArray(tree.relationshipPatternDetector[bucket])) {
        appendUnique(tree.relationshipPatternDetector[bucket], collectLangPhrases(rel[bucket]));
      }
    });
  }

  return tree;
}

module.exports = {
  SUPPORTED_ANCHOR_LANGUAGES,
  mergeI18nIntoAnchorTree,
};
