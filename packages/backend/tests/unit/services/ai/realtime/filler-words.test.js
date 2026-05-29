const { isFiller } = require('../../../../../src/services/ai/realtime/filler-words');

describe('filler-words isFiller', () => {
  it('rejects single filler token (en)', () => {
    expect(isFiller('um', 'en')).toBe(true);
  });

  it('rejects single filler token (fr)', () => {
    expect(isFiller('euh', 'fr')).toBe(true);
  });

  it('rejects single filler token (es)', () => {
    expect(isFiller('eh', 'es')).toBe(true);
  });

  it('rejects single filler token (zh)', () => {
    expect(isFiller('嗯', 'zh')).toBe(true);
  });

  it('rejects single filler token (ja)', () => {
    expect(isFiller('えー', 'ja')).toBe(true);
  });

  it('rejects single filler token (hu)', () => {
    expect(isFiller('hm', 'hu')).toBe(true);
    expect(isFiller('ööö', 'hu')).toBe(true);
  });

  it('rejects multi-filler phrase (en)', () => {
    expect(isFiller('um uh yeah', 'en')).toBe(true);
  });

  it('accepts real English content', () => {
    expect(isFiller("I'm feeling a bit tired today", 'en')).toBe(false);
  });

  it('accepts mixed filler + content', () => {
    expect(isFiller("um I'm fine", 'en')).toBe(false);
  });

  it('does not treat former filler-like answers as filler (en)', () => {
    expect(isFiller('yes', 'en')).toBe(false);
    expect(isFiller('no', 'en')).toBe(false);
    expect(isFiller('ok', 'en')).toBe(false);
    expect(isFiller('okay', 'en')).toBe(false);
    expect(isFiller('fine', 'en')).toBe(false);
    expect(isFiller('hello', 'en')).toBe(false);
  });

  it('does not treat Spanish answer words as filler', () => {
    expect(isFiller('sí', 'es')).toBe(false);
    expect(isFiller('bueno', 'es')).toBe(false);
    expect(isFiller('hola', 'es')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isFiller('', 'en')).toBe(true);
  });

  it('rejects whitespace-only', () => {
    expect(isFiller('   \t  ', 'en')).toBe(true);
  });

  it('falls back to English set for unknown language', () => {
    expect(isFiller('yeah', 'xx-Unknown')).toBe(true);
    expect(isFiller('not-in-english-filler-list', 'xx-Unknown')).toBe(false);
  });

  it('strips punctuation so yeah. and yeah both match (en)', () => {
    expect(isFiller('yeah.', 'en')).toBe(true);
    expect(isFiller('yeah', 'en')).toBe(true);
  });
});
