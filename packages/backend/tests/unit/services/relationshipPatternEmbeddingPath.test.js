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

const RelationshipPatternAnalyzer = require('../../../src/services/ai/relationshipPatternAnalyzer.service');
const { EmbeddingAnchorService, resetEmbeddingAnchorServiceForTests } = require('../../../src/services/embeddingAnchor.service');
const { buildPatientConversations } = require('../../helpers/patientConversation.fixture');

describe('RelationshipPatternAnalyzer embedding path (buildRelationshipMetricsFromEmbedding)', () => {
  let analyzer;
  let mockGetBucketScores;

  beforeEach(() => {
    resetEmbeddingAnchorServiceForTests();
    analyzer = new RelationshipPatternAnalyzer();

    mockGetBucketScores = jest.fn();
    EmbeddingAnchorService.mockImplementation(function MockedRel() {
      this.initialize = jest.fn().mockResolvedValue(undefined);
      this.embedText = jest.fn().mockResolvedValue([1, 0, 0]);
      this.getBucketScores = mockGetBucketScores;
    });
  });

  it('maps embedding bucket scores to relationship counts and risk score', async () => {
    mockGetBucketScores.mockReturnValue({
      newPeople: 0.85,
      isolation: 0.85,
      control: 0.85,
      dependency: 0.5,
      suspiciousBehavior: 0.85,
    });

    const conversations = buildPatientConversations([
      'I met someone new online. They tell me what to do and I am not allowed to see my friends.',
      'They asked for money and want me to send it through Western Union.',
    ]);

    const result = await analyzer.buildRelationshipMetricsFromEmbedding(conversations);

    expect(result.newPeopleCount).toBeGreaterThan(0);
    expect(result.isolationCount).toBeGreaterThan(0);
    expect(result.controlCount).toBeGreaterThan(0);
    expect(result.suspiciousBehaviorCount).toBeGreaterThan(0);
    expect(result.riskScore).toBeGreaterThan(0);
    expect(result.temporalChanges).toBeDefined();
  });

  it('adds combination bonus when multiple indicator types are present', async () => {
    mockGetBucketScores.mockReturnValue({
      newPeople: 0.85,
      isolation: 0.85,
      control: 0.85,
      dependency: 0.85,
      suspiciousBehavior: 0.85,
    });

    const conversations = buildPatientConversations([
      'I met someone new. They control everything and I am isolated.',
      'They are the only person I have and they want money.',
    ]);

    const result = await analyzer.buildRelationshipMetricsFromEmbedding(conversations);

    // 5 indicator types at count ~9 each → high additive score + combination bonus
    expect(result.riskScore).toBeGreaterThan(50);
  });

  it('returns default metrics when patient text is too short', async () => {
    const conversations = buildPatientConversations(['Hi']);
    const result = await analyzer.buildRelationshipMetricsFromEmbedding(conversations);
    expect(result.riskScore).toBe(0);
    expect(result.confidence).toBe('none');
  });
});
