const { isFiller } = require('../../../../../src/services/ai/realtime/filler-words');

describe('filler-words isFiller', () => {
  it('rejects single filler token (en)', () => {
    expect(isFiller('um', 'en')).toBe(true);
  });

  it('rejects single filler token (fr)', () => {
    expect(isFiller('euh', 'fr')).toBe(true);
  });

  it('rejects single filler token (es)', () => {
    expect(isFiller('bueno', 'es')).toBe(true);
  });

  it('rejects single filler token (zh)', () => {
    expect(isFiller('嗯', 'zh')).toBe(true);
  });

  it('rejects single filler token (ja)', () => {
    expect(isFiller('えー', 'ja')).toBe(true);
  });

  it('rejects multi-filler phrase (en)', () => {
    expect(isFiller('um okay yeah', 'en')).toBe(true);
  });

  it('accepts real English content', () => {
    expect(isFiller("I'm feeling a bit tired today", 'en')).toBe(false);
  });

  it('accepts mixed filler + content', () => {
    expect(isFiller("um I'm fine", 'en')).toBe(false);
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
