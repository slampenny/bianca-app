/**
 * Loads the golden corpus and provides helpers to filter and run cases.
 * Used by all corpus-driven test files.
 */
const corpus = require('../fixtures/emergencyCorpus.json');

const getAll = () => corpus.transcripts;
const getById = (id) => corpus.transcripts.find((t) => t.id === id);
const getByDetector = (detector) =>
  corpus.transcripts.filter((t) => t.expectedDetector === detector);
const getTruePositives = () => corpus.transcripts.filter((t) => t.shouldAlert === true);
const getTrueNegatives = () => corpus.transcripts.filter((t) => t.shouldAlert === false);
const getEdgeCases = () => corpus.transcripts.filter((t) => t.id.startsWith('EDGE-'));
const getMultilingual = () => corpus.transcripts.filter((t) => t.language !== 'en');
const getByLanguage = (lang) => corpus.transcripts.filter((t) => t.language === lang);
const getByTense = (tense) => corpus.transcripts.filter((t) => t.tense === tense);

module.exports = {
  getAll,
  getById,
  getByDetector,
  getTruePositives,
  getTrueNegatives,
  getEdgeCases,
  getMultilingual,
  getByLanguage,
  getByTense,
};
