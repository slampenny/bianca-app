/**
 * Localized filler / backchannel classification for realtime user transcripts.
 *
 * Supported language codes match Client.preferredLanguage enum:
 *   en, es, fr, de, zh, ja, pt, it, ru, ar, ko, hu
 *
 * Positional rules (enforced by callers via suppressBackchannels):
 * - User's turn: only ACOUSTIC_FILLERS drop the turn (um/uh/hmm).
 * - Mid-AI without barge-in: acoustic ∪ BACKCHANNELS_BY_LANGUAGE[+en] suppress soft acks.
 *
 * NATIVE-SPEAKER REVIEW: BACKCHANNELS_BY_LANGUAGE lists below are seed vocabularies for
 * mid-response suppression. Affirmatives (igen/sí/oui/ja/tak) must remain substantive on
 * the user's turn — that is guaranteed by suppressBackchannels:false (default). Have a
 * native speaker review each list before wider production rollout, especially ar/zh/ja/ko.
 *
 * ASR: Realtime session.audio.input.transcription.language is set to preferredLanguage
 * (message.handler buildSessionConfig). Mid-call language switches can still yield English
 * tokens, so backchannel resolution always unions the preferred-language set with English.
 *
 * Matching: Latin-script / space-delimited languages use whitespace tokenization (+ whole
 * phrase lookup). zh/ja use greedy longest-match character covering so unspaced transcripts
 * like はいはい / 嗯嗯对 still classify. Normalization is NFC + String#toLowerCase (not
 * toLocaleLowerCase), which leaves CJK/Arabic/Cyrillic/Hangul glyphs intact.
 */

/** ISO-639-1 codes from Client.preferredLanguage / caregiver.preferredLanguage enums. */
const CLIENT_PREFERRED_LANGUAGES = Object.freeze([
  'en',
  'es',
  'fr',
  'de',
  'zh',
  'ja',
  'pt',
  'it',
  'ru',
  'ar',
  'ko',
  'hu',
]);

/** Leading/trailing punctuation to strip (periods, commas, ellipses, ?, !). */
const EDGE_PUNCT_RE = /^[\s.,!?;:\u2026]+|[\s.,!?;:\u2026]+$/gu;

/**
 * Lowercase + normalize apostrophes. Diacritics are preserved on the string; lookups also
 * try a diacritic-stripped form so "hát" / "hat" both match.
 * @param {string} str
 * @returns {string}
 */
function normalizeForMatch(str) {
  if (str == null || typeof str !== 'string') return '';
  return str
    .toLowerCase()
    .replace(/[''ʼ]/g, "'")
    .normalize('NFC')
    .trim();
}

/** Strip combining marks for diacritic-insensitive compare. */
function stripDiacritics(str) {
  return str.normalize('NFD').replace(/\p{M}/gu, '');
}

function stripEdgePunctuation(str) {
  let prev;
  let s = str;
  do {
    prev = s;
    s = s.replace(EDGE_PUNCT_RE, '').trim();
  } while (s !== prev);
  return s;
}

/**
 * @param {string} transcript
 * @returns {string[]} tokens (lowercased, punct-trimmed; diacritics kept)
 */
function tokenizeForFillerCheck(transcript) {
  if (transcript == null || typeof transcript !== 'string') {
    return [];
  }
  let s = normalizeForMatch(transcript);
  s = stripEdgePunctuation(s);
  s = s.replace(/\s+/g, ' ').trim();
  if (!s) {
    return [];
  }
  return s
    .split(/\s+/)
    .map((t) => stripEdgePunctuation(t))
    .filter((t) => t.length > 0);
}

/**
 * @param {string} transcript
 * @returns {string}
 */
function normalizePhrase(transcript) {
  return tokenizeForFillerCheck(transcript).join(' ');
}

/**
 * Build a Set that contains each word plus its diacritic-stripped form (when different).
 * Skips adding bare a–z single letters from diacritic strip (avoids pt "é" → "e" landmine).
 * @param {string[]} words
 * @returns {Set<string>}
 */
function freezeNormalizedSet(words) {
  const set = new Set();
  for (const w of words) {
    const n = normalizeForMatch(w);
    if (!n) continue;
    set.add(n);
    const stripped = stripDiacritics(n);
    if (stripped && stripped !== n) {
      // Avoid single Latin letters as aliases (é→e, á→a)
      if (!(stripped.length === 1 && /^[a-z]$/i.test(stripped))) {
        set.add(stripped);
      }
    }
  }
  return set;
}

/**
 * @param {Set<string>} set
 * @param {string} token
 * @returns {boolean}
 */
function setHasToken(set, token) {
  if (set.has(token)) return true;
  const stripped = stripDiacritics(token);
  if (stripped !== token && set.has(stripped)) return true;
  return false;
}

/** Languages whose ASR transcripts are typically unspaced; whitespace tokenization is wrong. */
const CHARACTER_COVER_LANGUAGES = new Set(['zh', 'ja']);

/**
 * @param {string} [language]
 * @returns {boolean}
 */
function usesCharacterCoveringMatch(language) {
  if (!language || typeof language !== 'string') return false;
  const base = language.trim().toLowerCase().split('-')[0];
  return CHARACTER_COVER_LANGUAGES.has(base);
}

/**
 * Strip outer punctuation / whitespace for covering match (keeps CJK/Kana/Hangul/Cyrillic/Arabic letters).
 * @param {string} transcript
 * @returns {string}
 */
function prepareCoveringText(transcript) {
  let s = normalizeForMatch(transcript);
  s = stripEdgePunctuation(s);
  // Remove internal whitespace (rare for zh/ja ASR) and remaining edge punct
  s = s.replace(/\s+/g, '');
  s = stripEdgePunctuation(s);
  return s;
}

/**
 * True if `text` can be segmented left-to-right as a concatenation of lexicon entries
 * (longest-match greedy). Used for zh/ja where there are no spaces between tokens.
 * Repetitions like うんうん / はいはい / 嗯嗯 work when the unit is in the lexicon.
 *
 * @param {string} text prepared covering text (no spaces)
 * @param {Set<string>} lexicon
 * @returns {boolean}
 */
function isCoveredByLexicon(text, lexicon) {
  if (!text) return true;
  if (!lexicon || lexicon.size === 0) return false;

  let maxLen = 0;
  for (const entry of lexicon) {
    if (entry.length > maxLen) maxLen = entry.length;
  }

  let i = 0;
  while (i < text.length) {
    let matched = false;
    const remaining = text.length - i;
    const tryLen = Math.min(maxLen, remaining);
    for (let len = tryLen; len >= 1; len -= 1) {
      const slice = text.slice(i, i + len);
      if (setHasToken(lexicon, slice)) {
        i += len;
        matched = true;
        break;
      }
    }
    if (!matched) return false;
  }
  return true;
}

/**
 * Shared acoustic / thinking sounds — language-independent base.
 * Always droppable when the utterance contains nothing else.
 */
const ACOUSTIC_FILLERS = freezeNormalizedSet([
  // English / common
  'uh',
  'um',
  'mm',
  'hmm',
  'hm',
  'ah',
  'eh',
  'er',
  'oh',
  // Cross-language Latin variants
  'euh',
  'uhm',
  'ehm',
  'ähm',
  'äh',
  'hum',
  'öö',
  'ööö',
  'ã',
  'yyy',
  'eee',
  // Hesitation particles (not answer content)
  'este', // es
  'ásza', // hu
  'izé', // hu
  // Cyrillic thinking
  'э',
  'эм',
  'хм',
  // CJK thinking — REVIEW: 啊/哦 can be soft answers in context
  '嗯',
  '呃',
  '啊',
  '哦',
  '哈',
  // Japanese / Korean lengtheners & thinking
  'えー',
  'あー',
  'うーん',
  'あ',
  'ね',
  'な',
  '어',
  '음',
  '흠',
  '어어',
]);

/**
 * Per-language backchannels / soft acknowledgements (incl. yes-equivalents).
 * Mid-response suppression only; never dropped on the user's turn.
 *
 * NATIVE-SPEAKER REVIEW REQUIRED before wider rollout — especially ar, zh, ja, ko.
 * Uncertain entries called out per language in comments.
 */
const BACKCHANNELS_BY_LANGUAGE = {
  en: freezeNormalizedSet([
    'yeah',
    'yep',
    'yup',
    'uh-huh',
    'mhm',
    'mm-hmm',
    'yes',
    'ok',
    'okay',
    'sure',
  ]),
  // Uncertain: regional (vale vs ok); bueno as ack vs content
  es: freezeNormalizedSet(['sí', 'ya', 'ajá', 'vale', 'claro', 'ok', 'okay', 'bueno']),
  // Uncertain: hein vs ouais register
  fr: freezeNormalizedSet(['oui', 'ouais', 'hein', "d'accord", 'mmh', 'ok', 'okay', 'bien']),
  // Uncertain: "ach so" multi-word
  de: freezeNormalizedSet(['ja', 'genau', 'mhm', 'ach so', 'achso', 'okay', 'ok', 'richtig']),
  // HIGH UNCERTAINTY — seed acknowledgements only
  zh: freezeNormalizedSet(['对', '好的', '是的', '行', '嗯嗯', '好', 'ok', 'okay']),
  // Uncertain: はい is also a clear yes (intentional mid-AI suppress)
  ja: freezeNormalizedSet(['うん', 'ええ', 'はい', 'そうです', 'そう', 'ok', 'okay']),
  // Uncertain: omitted bare "é" (normalizes toward "e"); keep clearer acks
  pt: freezeNormalizedSet(['sim', 'uhum', 'tá', 'ok', 'okay', 'certo', 'isso']),
  // Uncertain: "ehm" overlaps acoustic; "già" as ack
  it: freezeNormalizedSet(['sì', 'già', 'va bene', 'ok', 'okay', 'certo']),
  // Uncertain: colloquial
  ru: freezeNormalizedSet(['да', 'угу', 'ага', 'хорошо', 'ок', 'ok', 'okay', 'ладно']),
  // HIGH UNCERTAINTY — needs native Arabic review
  ar: freezeNormalizedSet(['نعم', 'أيوه', 'ايوه', 'تمام', 'حسنا', 'حسناً', 'أوكي', 'اوكي', 'طيب', 'ok', 'okay']),
  // Uncertain: politeness levels
  ko: freezeNormalizedSet(['네', '응', '그래', '좋아', '맞아요', 'ok', 'okay']),
  // hát/jó are discourse markers that can also answer; igen is clear "yes"
  hu: freezeNormalizedSet(['igen', 'aha', 'ühüm', 'uhum', 'hát', 'jó', 'ugye', 'ok', 'okay', 'persze']),
};

/**
 * Resolve backchannel set: preferred language ∪ English.
 * Unknown / missing language → English only.
 * @param {string} [language]
 * @returns {Set<string>}
 */
function resolveBackchannelSet(language) {
  const en = BACKCHANNELS_BY_LANGUAGE.en;
  if (!language || typeof language !== 'string') {
    return en;
  }
  const base = language.trim().toLowerCase().split('-')[0];
  if (!CLIENT_PREFERRED_LANGUAGES.includes(base) || base === 'en') {
    return en;
  }
  const langSet = BACKCHANNELS_BY_LANGUAGE[base];
  if (!langSet) {
    return en;
  }
  return new Set([...langSet, ...en]);
}

/** Legacy maps for older callers */
const FILLER_WORDS_BY_LANGUAGE = new Map();
const FILLER_BY_LANGUAGE = new Map();
for (const code of CLIENT_PREFERRED_LANGUAGES) {
  const back = BACKCHANNELS_BY_LANGUAGE[code] || BACKCHANNELS_BY_LANGUAGE.en;
  const combined = new Set([...ACOUSTIC_FILLERS, ...back]);
  FILLER_WORDS_BY_LANGUAGE.set(code, combined);
  FILLER_BY_LANGUAGE.set(code, { acoustic: ACOUSTIC_FILLERS, backchannel: back });
}

/**
 * @param {string} [language]
 * @returns {{ acoustic: Set<string>, backchannel: Set<string> }}
 */
function getFillerSetsForLanguage(language) {
  return {
    acoustic: ACOUSTIC_FILLERS,
    backchannel: resolveBackchannelSet(language),
  };
}

/**
 * @param {string} [language]
 * @returns {Set<string>}
 */
function getFillerSetForLanguage(language) {
  const { acoustic, backchannel } = getFillerSetsForLanguage(language);
  return new Set([...acoustic, ...backchannel]);
}

/**
 * True if the utterance is filler/backchannel under positional rules (empty → true).
 *
 * Matching:
 * - zh/ja: character covering (greedy longest lexicon match) — no whitespace tokens.
 * - All other languages: whitespace tokenization + whole-phrase lookup.
 *
 * @param {string} transcript
 * @param {string} [language] Client preferredLanguage (ISO-639-1)
 * @param {{ suppressBackchannels?: boolean }} [options]
 * @returns {boolean}
 */
function isFiller(transcript, language, options = {}) {
  const suppressBackchannels = options.suppressBackchannels === true;
  const backchannels = resolveBackchannelSet(language);

  if (usesCharacterCoveringMatch(language)) {
    const text = prepareCoveringText(transcript);
    if (!text) return true;

    if (suppressBackchannels) {
      // Mid-AI: utterance is only acoustic + backchannel pieces (incl. はいはい / 嗯嗯)
      const combined = new Set([...ACOUSTIC_FILLERS, ...backchannels]);
      return isCoveredByLexicon(text, combined);
    }

    // User turn: backchannel-only covering (はい / 嗯嗯) is a real answer — not filler.
    // Acoustic-only covering (嗯 / えー) is droppable noise.
    if (isCoveredByLexicon(text, backchannels)) {
      return false;
    }
    return isCoveredByLexicon(text, ACOUSTIC_FILLERS);
  }

  const phrase = normalizePhrase(transcript);
  if (!phrase) {
    return true;
  }
  const tokens = phrase.split(' ');

  if (!suppressBackchannels) {
    return tokens.every((t) => setHasToken(ACOUSTIC_FILLERS, t));
  }

  if (setHasToken(backchannels, phrase)) {
    return true;
  }
  return tokens.every((t) => setHasToken(ACOUSTIC_FILLERS, t) || setHasToken(backchannels, t));
}

function isAcousticFiller(transcript, language) {
  return isFiller(transcript, language, { suppressBackchannels: false });
}

function isBackchannelOrAcousticFiller(transcript, language) {
  return isFiller(transcript, language, { suppressBackchannels: true });
}

module.exports = {
  CLIENT_PREFERRED_LANGUAGES,
  CHARACTER_COVER_LANGUAGES,
  ACOUSTIC_FILLERS,
  BACKCHANNELS_BY_LANGUAGE,
  FILLER_WORDS_BY_LANGUAGE,
  FILLER_BY_LANGUAGE,
  normalizeForMatch,
  normalizePhrase,
  stripDiacritics,
  tokenizeForFillerCheck,
  prepareCoveringText,
  usesCharacterCoveringMatch,
  isCoveredByLexicon,
  resolveBackchannelSet,
  getFillerSetForLanguage,
  getFillerSetsForLanguage,
  isFiller,
  isAcousticFiller,
  isBackchannelOrAcousticFiller,
};
