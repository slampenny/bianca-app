const corpusRunner = require('../helpers/corpusRunner');
const AbuseNeglectDetector = require('../../src/services/ai/abuseNeglectDetector.service');

jest.mock('../../src/services/embeddingAnchor.service', () => {
  const actual = jest.requireActual('../../src/services/embeddingAnchor.service');
  return {
    ...actual,
    EmbeddingAnchorService: jest.fn(),
  };
});

const { EmbeddingAnchorService } = require('../../src/services/embeddingAnchor.service');

describe('AbuseNeglectDetector corpus', () => {
  let detector;
  let mockInitialize;
  let mockEmbedText;
  let mockGetBucketScores;

  beforeEach(() => {
    detector = new AbuseNeglectDetector();
    mockInitialize = jest.fn().mockResolvedValue(undefined);
    mockEmbedText = jest.fn().mockResolvedValue([1, 0, 0]);
    mockGetBucketScores = jest.fn();
    EmbeddingAnchorService.mockImplementation(function Mocked() {
      this.initialize = mockInitialize;
      this.embedText = mockEmbedText;
      this.getBucketScores = mockGetBucketScores;
    });
  });

  const setScores = (partial) => {
    const base = {
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
    };
    mockGetBucketScores.mockReturnValue({ ...base, ...partial });
  };

  test.each(corpusRunner.getTruePositives().filter((t) => t.expectedDetector === 'abuseNeglectDetector'))(
    '$id — should alert ($label)',
    async (testCase) => {
      const high = {};
      (testCase.expectedBuckets || ['injuries']).forEach((b) => {
        high[b] = 0.85;
      });
      setScores(high);

      const result = await detector.analyze(testCase.text, null);
      expect(result.shouldAlert).toBe(true);
      if (testCase.expectedBuckets) {
        testCase.expectedBuckets.forEach((bucket) => {
          expect(result.matchedBuckets).toContain(bucket);
        });
      }
    }
  );

  test.each(
    corpusRunner.getTrueNegatives().filter((t) => ['physical_abuse', 'emotional_abuse', 'neglect'].includes(t.category))
  )('$id — should not alert ($label)', async (testCase) => {
    setScores({
      injuries: 0.72,
      fearOfPerson: 0.72,
      punishment: 0.72,
      emotionalIsolation: 0.72,
      control: 0.72,
      threats: 0.72,
      belittling: 0.72,
      fearLanguage: 0.72,
      basicNeeds: 0.72,
      medicalCare: 0.72,
      neglectIsolation: 0.72,
      timeAlone: 0.72,
    });
    const result = await detector.analyze(testCase.text, null);
    expect(result.shouldAlert).toBe(false);
  });

  test('high-FP bucket threshold 0.82 for basicNeeds', async () => {
    setScores({ basicNeeds: 0.8, injuries: 0.5 });
    let result = await detector.analyze('x', null);
    expect(result.matchedBuckets).not.toContain('basicNeeds');
    expect(result.shouldAlert).toBe(false);

    setScores({ basicNeeds: 0.83, injuries: 0.5 });
    result = await detector.analyze('x', null);
    expect(result.matchedBuckets).toContain('basicNeeds');
    expect(result.shouldAlert).toBe(true);
  });

  test('TN-ABUSE-003 — cold food: low basicNeeds/medicalCare', async () => {
    const tc = corpusRunner.getById('TN-ABUSE-003');
    setScores({ basicNeeds: 0.74, medicalCare: 0.7, injuries: 0.5 });
    const result = await detector.analyze(tc.text, null);
    expect(result.shouldAlert).toBe(false);
  });

  test('weighted scoring — physical only', async () => {
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
    const detectorInst = new AbuseNeglectDetector();
    mockGetBucketScores.mockReturnValue({
      injuries: 0.85,
      fearOfPerson: 0,
      punishment: 0,
      emotionalIsolation: 0,
      control: 0,
      threats: 0,
      belittling: 0,
      fearLanguage: 0,
      basicNeeds: 0,
      medicalCare: 0,
      neglectIsolation: 0,
      timeAlone: 0,
    });
    const result = await detectorInst.analyze('test', null);
    expect(result.physicalScore).toBeCloseTo(0.85, 5);
    expect(result.riskScore).toBeCloseTo(0.85 * detectorInst.weights.physicalAbuse, 5);
  });

  test('weighted scoring — blend 0.85 all three categories', async () => {
    const detectorInst = new AbuseNeglectDetector();
    mockGetBucketScores.mockReturnValue({
      injuries: 0.85,
      fearOfPerson: 0,
      punishment: 0,
      emotionalIsolation: 0.85,
      control: 0.85,
      threats: 0.85,
      belittling: 0.85,
      fearLanguage: 0.85,
      basicNeeds: 0.85,
      medicalCare: 0.85,
      neglectIsolation: 0.85,
      timeAlone: 0.85,
    });
    const result = await detectorInst.analyze('test', null);
    const w = detectorInst.weights;
    const expected =
      0.85 * w.physicalAbuse + 0.85 * w.emotionalAbuse + 0.85 * w.neglect;
    expect(result.riskScore).toBeCloseTo(expected, 5);
  });
});
