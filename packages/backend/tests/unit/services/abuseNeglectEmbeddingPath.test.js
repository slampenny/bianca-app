jest.mock('../../../src/utils/detectionMode', () => ({
  useKeywordBasedDetectors: () => false,
}));

jest.mock('../../../src/services/embeddingAnchor.service', () => {
  const actual = jest.requireActual('../../../src/services/embeddingAnchor.service');
  return {
    ...actual,
    EmbeddingAnchorService: jest.fn(),
  };
});

const AbuseNeglectDetector = require('../../../src/services/ai/abuseNeglectDetector.service');
const { EmbeddingAnchorService, resetEmbeddingAnchorServiceForTests } = require('../../../src/services/embeddingAnchor.service');

describe('AbuseNeglectDetector embedding path (buildAbuseMetricsFromEmbedding)', () => {
  let detector;
  let mockGetBucketScores;

  beforeEach(() => {
    resetEmbeddingAnchorServiceForTests();
    detector = new AbuseNeglectDetector();

    mockGetBucketScores = jest.fn();
    EmbeddingAnchorService.mockImplementation(function MockedAbuse() {
      this.initialize = jest.fn().mockResolvedValue(undefined);
      this.embedText = jest.fn().mockResolvedValue([1, 0, 0]);
      this.getBucketScores = mockGetBucketScores;
    });
  });

  const setScores = (partial) => {
    mockGetBucketScores.mockReturnValue({
      injuries: 0.5,
      fearOfPerson: 0.5,
      punishment: 0.5,
      emotionalIsolation: 0.5,
      control: 0.5,
      threats: 0.5,
      belittling: 0.5,
      fearLanguage: 0.5,
      basicNeeds: 0.5,
      medicalCare: 0.5,
      neglectIsolation: 0.5,
      timeAlone: 0.5,
      ...partial,
    });
  };

  it('maps embedding sub-scores to physical, emotional, and neglect metrics', async () => {
    setScores({
      injuries: 0.85,
      emotionalIsolation: 0.8,
      basicNeeds: 0.82,
    });
    const messages = ['Someone hit me and I have a bruise.'];
    const combined = messages.join(' ');

    const result = await detector.buildAbuseMetricsFromEmbedding(messages, combined, null);

    expect(result.physicalAbuseScore).toBe(85);
    expect(result.emotionalAbuseScore).toBe(80);
    expect(result.neglectScore).toBe(82);
    expect(result.injuryMentions).toBeGreaterThan(0);
    expect(result.basicNeedsMentions).toBeGreaterThan(0);
  });

  it('floors overall abuse risk at 50 when shouldAlert', async () => {
    setScores({ injuries: 0.85 });
    const messages = ['I have bruises and I am afraid of them.'];
    const combined = messages.join(' ');

    const result = await detector.buildAbuseMetricsFromEmbedding(messages, combined, null);

    expect(result.riskScore).toBeGreaterThanOrEqual(50);
  });

  it('computes weighted riskScore from category scores and temporal patterns', async () => {
    setScores({
      injuries: 0.85,
      emotionalIsolation: 0,
      control: 0,
      threats: 0,
      belittling: 0,
      fearLanguage: 0,
      basicNeeds: 0,
      medicalCare: 0,
      neglectIsolation: 0,
      timeAlone: 0,
      fearOfPerson: 0,
      punishment: 0,
    });
    const messages = [
      'Someone hit me and I have a bruise.',
      'They hit me again and I have another bruise.',
      'I am afraid of them and they threatened me.',
    ];
    const combined = messages.join(' ');

    const result = await detector.buildAbuseMetricsFromEmbedding(messages, combined, null);
    const w = detector.weights;
    const expectedBase = 85 * w.physicalAbuse;
    expect(result.riskScore).toBeGreaterThanOrEqual(expectedBase);
    expect(result.temporalPatterns).toBeDefined();
  });
});
