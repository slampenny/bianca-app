/**
 * Central toggle for keyword/regex/DB-phrase vs embedding-first detection.
 * Use config.detection.useKeywordBasedDetectors (env USE_KEYWORD_BASED_DETECTORS=true).
 */
const appConfig = require('../config/config');

function useKeywordBasedDetectors() {
  return appConfig.detection?.useKeywordBasedDetectors === true;
}

module.exports = {
  useKeywordBasedDetectors,
};
