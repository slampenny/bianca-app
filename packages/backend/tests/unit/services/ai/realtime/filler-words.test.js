const {
  CLIENT_PREFERRED_LANGUAGES,
  isFiller,
  isAcousticFiller,
  isBackchannelOrAcousticFiller,
  resolveBackchannelSet,
  normalizePhrase,
} = require('../../../../../src/services/ai/realtime/filler-words');

describe('filler-words multilingual / positional', () => {
  it('covers every Client.preferredLanguage code', () => {
    expect(CLIENT_PREFERRED_LANGUAGES).toEqual([
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
  });

  it('rejects single acoustic filler token (en)', () => {
    expect(isFiller('um', 'en')).toBe(true);
    expect(isAcousticFiller('uh', 'en')).toBe(true);
    expect(isFiller('hmm', 'en')).toBe(true);
  });

  it('cross-language acoustic variants are shared', () => {
    expect(isFiller('euh', 'fr')).toBe(true);
    expect(isFiller('ähm', 'de')).toBe(true);
    expect(isFiller('ööö', 'hu')).toBe(true);
    expect(isFiller('嗯', 'zh')).toBe(true);
  });

  it('on user turn (default): yeah/mm-hmm/yes are substantive answers', () => {
    expect(isFiller('yeah', 'en')).toBe(false);
    expect(isFiller('yep', 'en')).toBe(false);
    expect(isFiller('mm-hmm', 'en')).toBe(false);
    expect(isFiller('yes', 'en')).toBe(false);
    expect(isFiller('um uh yeah', 'en')).toBe(false);
  });

  it('while AI speaking (suppressBackchannels): yeah/mm-hmm/yes are filler', () => {
    expect(isFiller('yeah', 'en', { suppressBackchannels: true })).toBe(true);
    expect(isFiller('mm-hmm', 'en', { suppressBackchannels: true })).toBe(true);
    expect(isFiller('yes', 'en', { suppressBackchannels: true })).toBe(true);
    expect(isBackchannelOrAcousticFiller('yep', 'en')).toBe(true);
  });

  it('hu: igen is substantive on user turn, suppressed mid-AI', () => {
    expect(isFiller('igen', 'hu')).toBe(false);
    expect(isFiller('igen', 'hu', { suppressBackchannels: true })).toBe(true);
  });

  it('hu: aha suppressed mid-AI', () => {
    expect(isFiller('aha', 'hu', { suppressBackchannels: true })).toBe(true);
    expect(isFiller('aha', 'hu')).toBe(false);
  });

  it('diacritic normalization: hát vs hat', () => {
    expect(isFiller('hát', 'hu', { suppressBackchannels: true })).toBe(true);
    expect(isFiller('hat', 'hu', { suppressBackchannels: true })).toBe(true);
    expect(isFiller('hát', 'hu')).toBe(false); // user turn — answer/discourse, not acoustic
    expect(normalizePhrase('Hát!')).toBe('hát');
  });

  it('es/fr/de yes-equivalents: user turn keeps, mid-AI suppresses', () => {
    expect(isFiller('sí', 'es')).toBe(false);
    expect(isFiller('sí', 'es', { suppressBackchannels: true })).toBe(true);
    expect(isFiller('oui', 'fr')).toBe(false);
    expect(isFiller('oui', 'fr', { suppressBackchannels: true })).toBe(true);
    expect(isFiller('ja', 'de')).toBe(false);
    expect(isFiller('ja', 'de', { suppressBackchannels: true })).toBe(true);
  });

  it('unsupported language code falls back to English backchannels', () => {
    const set = resolveBackchannelSet('xx-Unknown');
    expect(set.has('yeah')).toBe(true);
    expect(isFiller('um', 'xx-Unknown')).toBe(true);
    expect(isFiller('yeah', 'xx-Unknown')).toBe(false);
    expect(isFiller('yeah', 'xx-Unknown', { suppressBackchannels: true })).toBe(true);
    expect(isFiller('not-in-english-filler-list', 'xx-Unknown')).toBe(false);
  });

  it('preferred language backchannels are unioned with English', () => {
    const set = resolveBackchannelSet('hu');
    expect(set.has('igen')).toBe(true);
    expect(set.has('yeah')).toBe(true); // English union
  });

  it('accepts real content', () => {
    expect(isFiller("I'm feeling a bit tired today", 'en')).toBe(false);
    expect(isFiller('um I am fine', 'en')).toBe(false);
    expect(isFiller('Jardent szeretnék kérni', 'hu')).toBe(false);
  });

  it('rejects empty / whitespace', () => {
    expect(isFiller('', 'en')).toBe(true);
    expect(isFiller('   \t  ', 'en')).toBe(true);
  });

  it('strips punctuation on backchannel tokens when suppressed', () => {
    expect(isFiller('yeah.', 'en')).toBe(false);
    expect(isFiller('yeah.', 'en', { suppressBackchannels: true })).toBe(true);
  });

  describe('zh/ja character covering (no whitespace tokens)', () => {
    it('ja: はい mid-AI suppressed; user-turn substantive', () => {
      expect(isFiller('はい', 'ja')).toBe(false);
      expect(isFiller('はい', 'ja', { suppressBackchannels: true })).toBe(true);
    });

    it('ja: repetition はいはい covered mid-AI', () => {
      expect(isFiller('はいはい', 'ja', { suppressBackchannels: true })).toBe(true);
      expect(isFiller('はいはい', 'ja')).toBe(false);
    });

    it('zh: 嗯嗯 mid-AI suppressed; user-turn substantive', () => {
      expect(isFiller('嗯嗯', 'zh')).toBe(false);
      expect(isFiller('嗯嗯', 'zh', { suppressBackchannels: true })).toBe(true);
    });

    it('zh: compound backchannels 嗯嗯对 fully covered mid-AI', () => {
      expect(isFiller('嗯嗯对', 'zh', { suppressBackchannels: true })).toBe(true);
      expect(isFiller('嗯嗯对', 'zh')).toBe(false);
    });

    it('zh/ja: real content is not covered', () => {
      expect(isFiller('今天天气怎么样', 'zh', { suppressBackchannels: true })).toBe(false);
      expect(isFiller('今日はいい天気です', 'ja', { suppressBackchannels: true })).toBe(false);
    });

    it('zh/ja: acoustic-only still drops on user turn', () => {
      expect(isFiller('嗯', 'zh')).toBe(true);
      expect(isFiller('えー', 'ja')).toBe(true);
    });
  });

  describe('ru/ar/ko script + normalization', () => {
    it('ru: Cyrillic backchannel matches post-normalization', () => {
      expect(isFiller('да', 'ru')).toBe(false);
      expect(isFiller('да', 'ru', { suppressBackchannels: true })).toBe(true);
      expect(isFiller('Угу', 'ru', { suppressBackchannels: true })).toBe(true);
    });

    it('ar: Arabic backchannel matches (incl. diacritic variants)', () => {
      expect(isFiller('نعم', 'ar')).toBe(false);
      expect(isFiller('نعم', 'ar', { suppressBackchannels: true })).toBe(true);
      expect(isFiller('حسناً', 'ar', { suppressBackchannels: true })).toBe(true);
      expect(isFiller('حسنا', 'ar', { suppressBackchannels: true })).toBe(true);
    });

    it('ko: Hangul backchannel matches without latin lowercasing side effects', () => {
      expect(isFiller('네', 'ko')).toBe(false);
      expect(isFiller('네', 'ko', { suppressBackchannels: true })).toBe(true);
      expect(isFiller('응', 'ko', { suppressBackchannels: true })).toBe(true);
    });

    it('normalizeForMatch uses NFC + default toLowerCase (not tr locale)', () => {
      const { normalizeForMatch } = require('../../../../../src/services/ai/realtime/filler-words');
      // Default toLowerCase: Latin I → i (not Turkish ı)
      expect(normalizeForMatch('I')).toBe('i');
      expect(normalizeForMatch('はい')).toBe('はい');
      expect(normalizeForMatch('نعم')).toBe('نعم');
      expect(normalizeForMatch('да')).toBe('да');
    });
  });
});
