/**
 * Localized filler-word lists for realtime user transcript filtering.
 * Map keys are BCP-47 tags used with session / client language configuration.
 */

/** Leading/trailing punctuation to strip (periods, commas, ellipses, ?, !). */
const EDGE_PUNCT_RE = /^[\s.,!?\u2026]+|[\s.,!?\u2026]+$/gu;

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
 * Lowercase, collapse whitespace, strip leading/trailing punctuation, split on whitespace,
 * strip punctuation from each token. No stemming or transliteration.
 * @param {string} transcript
 * @returns {string[]}
 */
function tokenizeForFillerCheck(transcript) {
  if (transcript == null || typeof transcript !== 'string') {
    return [];
  }
  let s = transcript.toLowerCase();
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

const enSet = new Set([
  'uh',
  'um',
  'uh-huh',
  'mm',
  'hmm',
  'hm',
  'mhm',
  'mm-hmm',
  'oh',
  'ah',
  'eh',
  'er',
  'yeah',
  'yep',
  'yup',
  'ok',
  'okay',
  'sure',
  'right',
  'alright',
  'fine',
  'good',
  'bye',
  'yes',
  'no',
  'hi',
  'hello',
  'hey',
]);

const frSet = new Set([
  'euh',
  'hm',
  'hmm',
  'ouais',
  'oui',
  'non',
  'ok',
  "d'accord",
  'bien',
  'salut',
  'bonjour',
  'bonsoir',
  'ah',
  'oh',
  'eh',
  'hein',
]);

const esSet = new Set([
  'eh',
  'um',
  'este',
  'este...',
  'am',
  'mm',
  'sí',
  'no',
  'ok',
  'okey',
  'bueno',
  'hola',
  'adiós',
  'claro',
  'bien',
]);

const ptSet = new Set(['ã', 'hm', 'hmm', 'é', 'né', 'sim', 'não', 'ok', 'olá', 'oi', 'tchau', 'bom', 'certo']);

const deSet = new Set([
  'äh',
  'ähm',
  'hm',
  'hmm',
  'ja',
  'nein',
  'ok',
  'okay',
  'tschüss',
  'hallo',
  'gut',
  'alright',
  'na',
  'jo',
]);

const itSet = new Set([
  'eh',
  'um',
  'beh',
  'mah',
  'sì',
  'no',
  'ok',
  'ciao',
  'salve',
  'buongiorno',
  'bene',
  'dai',
  'vabbè',
]);

const nlSet = new Set(['eh', 'uhm', 'hm', 'hmm', 'ja', 'nee', 'ok', 'okay', 'hallo', 'dag', 'goed', 'prima']);

const plSet = new Set(['yyy', 'eee', 'hm', 'hmm', 'tak', 'nie', 'ok', 'okej', 'cześć', 'hej', 'dobrze', 'no']);

const ruSet = new Set(['э', 'эм', 'хм', 'да', 'нет', 'ок', 'окей', 'привет', 'пока', 'хорошо', 'ладно']);

const zhSet = new Set(['嗯', '啊', '哦', '哈', '呃', '是', '对', '好', '行', '没有', '不', '喂', '你好', '再见']);

const jaSet = new Set([
  'えー',
  'あー',
  'うーん',
  'はい',
  'いいえ',
  'うん',
  'ええ',
  'そう',
  'あ',
  'ね',
  'な',
  'もしもし',
  'さようなら',
]);

const koSet = new Set(['어', '음', '흠', '네', '아니요', '응', '그래', '어어', '여보세요', '안녕', '잘있어']);

/** @type {Map<string, Set<string>>} */
const FILLER_WORDS_BY_LANGUAGE = new Map();

function addLangKeys(keys, set) {
  for (const k of keys) {
    FILLER_WORDS_BY_LANGUAGE.set(k, set);
  }
}

addLangKeys(['en', 'en-US', 'en-GB', 'en-AU'], enSet);
addLangKeys(['fr', 'fr-FR', 'fr-CA'], frSet);
addLangKeys(['es', 'es-ES', 'es-MX', 'es-419'], esSet);
addLangKeys(['pt', 'pt-BR', 'pt-PT'], ptSet);
addLangKeys(['de', 'de-DE', 'de-AT', 'de-CH'], deSet);
addLangKeys(['it', 'it-IT'], itSet);
addLangKeys(['nl', 'nl-NL', 'nl-BE'], nlSet);
addLangKeys(['pl', 'pl-PL'], plSet);
addLangKeys(['ru', 'ru-RU'], ruSet);
addLangKeys(['zh', 'zh-CN', 'zh-TW', 'zh-HK'], zhSet);
addLangKeys(['ja', 'ja-JP'], jaSet);
addLangKeys(['ko', 'ko-KR'], koSet);

/**
 * @param {string} [language]
 * @returns {Set<string>}
 */
function getFillerSetForLanguage(language) {
  if (!language || typeof language !== 'string') {
    return enSet;
  }
  const code = language.trim();
  if (FILLER_WORDS_BY_LANGUAGE.has(code)) {
    return FILLER_WORDS_BY_LANGUAGE.get(code);
  }
  const base = code.split('-')[0];
  if (FILLER_WORDS_BY_LANGUAGE.has(base)) {
    return FILLER_WORDS_BY_LANGUAGE.get(base);
  }
  return enSet;
}

/**
 * True if the transcript is filler-only (including empty / whitespace-only after normalization).
 * Unknown languages use the English filler set.
 *
 * @param {string} transcript
 * @param {string} [language] BCP-47 or ISO-like tag (e.g. en, en-US)
 * @returns {boolean}
 */
function isFiller(transcript, language) {
  const tokens = tokenizeForFillerCheck(transcript);
  if (tokens.length === 0) {
    return true;
  }
  const filler = getFillerSetForLanguage(language);
  return tokens.every((t) => filler.has(t));
}

module.exports = {
  FILLER_WORDS_BY_LANGUAGE,
  tokenizeForFillerCheck,
  getFillerSetForLanguage,
  isFiller,
};
