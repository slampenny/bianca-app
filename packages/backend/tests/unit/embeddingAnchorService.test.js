jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    embeddings: {
      create: jest.fn(),
    },
  }));
});

const OpenAI = require('openai');
const {
  EmbeddingAnchorService,
  cosineSimilarity,
  countUniquePhrases,
} = require('../../src/services/embeddingAnchor.service');

describe('EmbeddingAnchorService', () => {
  let mockCreate;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCreate = jest.fn();
    OpenAI.mockImplementation(() => ({
      embeddings: { create: mockCreate },
    }));
  });

  test('startup embedding — called once per unique anchor phrase; second init does not re-call', async () => {
    mockCreate.mockResolvedValue({ data: [{ embedding: [1, 0, 0] }] });

    const svc = new EmbeddingAnchorService();
    const n = countUniquePhrases();
    await svc.initialize();
    expect(mockCreate).toHaveBeenCalledTimes(n);

    await svc.initialize();
    expect(mockCreate).toHaveBeenCalledTimes(n);
  });

  test('getAnchors returns { phrase, vector } for abuseNeglectDetector physical injuries', async () => {
    const vec = [0.5, 0.5, 0.5];
    mockCreate.mockResolvedValue({ data: [{ embedding: vec }] });

    const svc = new EmbeddingAnchorService();
    await svc.initialize();

    const anchors = svc.getAnchors('abuseNeglectDetector', 'physical', 'injuries');
    expect(Array.isArray(anchors)).toBe(true);
    expect(anchors.length).toBeGreaterThan(0);
    anchors.forEach((a) => {
      expect(a).toHaveProperty('phrase');
      expect(a).toHaveProperty('vector');
      expect(a.vector).toEqual(vec);
    });
  });

  test('cosine similarity math', () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1, 3);
    expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBeCloseTo(0, 3);
    expect(cosineSimilarity([1, 0, 0], [0.70710678, 0.70710678, 0])).toBeCloseTo(0.707, 2);
  });

  describe('threshold filtering', () => {
    test('respects base 0.78 and high-FP 0.82 for basicNeeds / medicalCare', () => {
      const svc = new EmbeddingAnchorService();
      svc.initialized = true;
      const v = [1, 0, 0];

      jest.spyOn(svc, 'getAnchors').mockImplementation((detector, cat, bucket) => {
        if (bucket === 'injuries') return [{ phrase: 'x', vector: [1, 0, 0] }];
        if (bucket === 'basicNeeds') return [{ phrase: 'y', vector: [0.8, 0.6, 0] }];
        if (bucket === 'medicalCare') return [{ phrase: 'z', vector: [0.81, 0.586, 0] }];
        return [];
      });

      const hiFp = svc.getMatchingBuckets(v, 'abuseNeglectDetector', 0.78);
      expect(hiFp).toContain('injuries');
      expect(hiFp).not.toContain('basicNeeds');
      expect(hiFp).not.toContain('medicalCare');

      svc.getAnchors.mockImplementation((detector, cat, bucket) => {
        if (bucket === 'basicNeeds') return [{ phrase: 'y', vector: [0.83, 0.558, 0] }];
        return [];
      });
      const pass = svc.getMatchingBuckets(v, 'abuseNeglectDetector', 0.78);
      expect(pass).toContain('basicNeeds');
    });
  });
});
