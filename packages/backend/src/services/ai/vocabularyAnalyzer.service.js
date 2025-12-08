// src/services/ai/vocabularyAnalyzer.service.js

const natural = require('natural');
const logger = require('../../config/logger');

/**
 * Vocabulary Analyzer Service
 * Analyzes vocabulary diversity, complexity, and linguistic patterns
 */
class VocabularyAnalyzer {
  constructor() {
    this.tokenizer = new natural.WordTokenizer();
    this.sentenceTokenizer = new natural.SentenceTokenizer();
    this.stemmer = natural.PorterStemmer;
    
    // Stop words for analysis (common words to exclude from unique word counts)
    this.stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
      'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
      'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those'
    ]);
  }

  /**
   * Calculate comprehensive vocabulary metrics for text
   * @param {string} text - Input text to analyze
   * @returns {Object} Vocabulary metrics
   */
  calculateVocabularyMetrics(text) {
    try {
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return this.getDefaultMetrics();
      }

      // Tokenize text
      const words = this.tokenizer.tokenize(text.toLowerCase());
      const sentences = this.sentenceTokenizer.tokenize(text);
      
      if (!words || words.length === 0) {
        return this.getDefaultMetrics();
      }

      // Basic word statistics
      const totalWords = words.length;
      const uniqueWords = new Set(words).size;
      const uniqueWordsFiltered = this.getUniqueWordsFiltered(words);
      
      // Calculate type-token ratio (vocabulary diversity)
      const typeTokenRatio = uniqueWords / totalWords;
      const typeTokenRatioFiltered = uniqueWordsFiltered / totalWords;

      // Calculate average word length
      const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / totalWords;

      // Calculate sentence statistics
      const avgSentenceLength = sentences ? totalWords / sentences.length : 0;
      const avgWordsPerSentence = avgSentenceLength;

      // Calculate complexity score (combination of multiple factors)
      const complexityScore = this.calculateComplexityScore(
        typeTokenRatioFiltered,
        avgWordLength,
        avgSentenceLength,
        uniqueWordsFiltered
      );

      // Word frequency analysis
      const wordFrequency = this.calculateWordFrequency(words);
      const mostCommonWords = this.getMostCommonWords(wordFrequency, 10);

      // Syllable analysis for complexity
      const avgSyllablesPerWord = this.calculateAverageSyllables(words);

      // Lexical diversity measures
      const lexicalDiversity = this.calculateLexicalDiversity(words);

      return {
        uniqueWords: uniqueWordsFiltered,
        totalWords,
        typeTokenRatio: typeTokenRatioFiltered,
        typeTokenRatioRaw: typeTokenRatio,
        avgWordLength: Math.round(avgWordLength * 100) / 100,
        avgSentenceLength: Math.round(avgSentenceLength * 100) / 100,
        avgWordsPerSentence: Math.round(avgWordsPerSentence * 100) / 100,
        complexityScore: Math.round(complexityScore * 100) / 100,
        avgSyllablesPerWord: Math.round(avgSyllablesPerWord * 100) / 100,
        lexicalDiversity,
        sentenceCount: sentences ? sentences.length : 0,
        mostCommonWords,
        wordFrequencyDistribution: this.categorizeWordFrequency(wordFrequency),
        readabilityScore: this.calculateReadabilityScore(avgSentenceLength, avgSyllablesPerWord),
        timestamp: new Date()
      };

    } catch (error) {
      logger.error('Error in VocabularyAnalyzer.calculateVocabularyMetrics:', error);
      return this.getDefaultMetrics();
    }
  }

  /**
   * Get unique words excluding stop words
   * @param {Array} words - Array of words
   * @returns {number} Count of unique non-stop words
   */
  getUniqueWordsFiltered(words) {
    const filteredWords = words.filter(word => 
      word.length > 2 && !this.stopWords.has(word) && /^[a-zA-Z]+$/.test(word)
    );
    return new Set(filteredWords).size;
  }

  /**
   * Calculate complexity score based on multiple linguistic factors
   * @param {number} typeTokenRatio - Type-token ratio
   * @param {number} avgWordLength - Average word length
   * @param {number} avgSentenceLength - Average sentence length
   * @param {number} uniqueWords - Number of unique words
   * @returns {number} Complexity score (0-100)
   */
  calculateComplexityScore(typeTokenRatio, avgWordLength, avgSentenceLength, uniqueWords) {
    // Normalize factors to 0-100 scale
    const diversityScore = Math.min(typeTokenRatio * 200, 100); // Higher diversity = higher score
    const wordLengthScore = Math.min(avgWordLength * 10, 100); // Longer words = higher complexity
    const sentenceLengthScore = Math.min(avgSentenceLength * 2, 100); // Longer sentences = higher complexity
    
    // Weighted average
    const complexityScore = (
      diversityScore * 0.4 +      // 40% vocabulary diversity
      wordLengthScore * 0.3 +     // 30% word length
      sentenceLengthScore * 0.3   // 30% sentence length
    );

    return Math.min(Math.max(complexityScore, 0), 100);
  }

  /**
   * Calculate word frequency distribution
   * @param {Array} words - Array of words
   * @returns {Object} Word frequency map
   */
  calculateWordFrequency(words) {
    const frequency = {};
    
    words.forEach(word => {
      if (word.length > 2 && !this.stopWords.has(word)) {
        frequency[word] = (frequency[word] || 0) + 1;
      }
    });

    return frequency;
  }

  /**
   * Get most common words from frequency map
   * @param {Object} wordFrequency - Word frequency map
   * @param {number} limit - Maximum number of words to return
   * @returns {Array} Array of {word, frequency} objects
   */
  getMostCommonWords(wordFrequency, limit = 10) {
    return Object.entries(wordFrequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([word, frequency]) => ({ word, frequency }));
  }

  /**
   * Calculate average syllables per word
   * @param {Array} words - Array of words
   * @returns {number} Average syllables per word
   */
  calculateAverageSyllables(words) {
    const filteredWords = words.filter(word => 
      word.length > 2 && /^[a-zA-Z]+$/.test(word)
    );

    if (filteredWords.length === 0) return 0;

    const totalSyllables = filteredWords.reduce((sum, word) => {
      return sum + this.countSyllables(word);
    }, 0);

    return totalSyllables / filteredWords.length;
  }

  /**
   * Count syllables in a word (approximation)
   * @param {string} word - Word to count syllables in
   * @returns {number} Number of syllables
   */
  countSyllables(word) {
    word = word.toLowerCase();
    if (word.length <= 3) return 1;
    
    // Count vowel groups
    const vowels = word.match(/[aeiouy]+/g);
    let syllables = vowels ? vowels.length : 1;
    
    // Adjust for silent 'e'
    if (word.endsWith('e')) syllables--;
    
    // Minimum of 1 syllable
    return Math.max(syllables, 1);
  }

  /**
   * Calculate lexical diversity using different measures
   * @param {Array} words - Array of words
   * @returns {Object} Various diversity measures
   */
  calculateLexicalDiversity(words) {
    const uniqueWords = new Set(words).size;
    const totalWords = words.length;
    
    return {
      typeTokenRatio: uniqueWords / totalWords,
      hapaxLegomena: this.countHapaxLegomena(words), // Words that appear only once
      disLegomena: this.countDisLegomena(words),     // Words that appear exactly twice
      hapaxRatio: this.countHapaxLegomena(words) / totalWords
    };
  }

  /**
   * Count words that appear only once
   * @param {Array} words - Array of words
   * @returns {number} Count of hapax legomena
   */
  countHapaxLegomena(words) {
    const frequency = this.calculateWordFrequency(words);
    return Object.values(frequency).filter(count => count === 1).length;
  }

  /**
   * Count words that appear exactly twice
   * @param {Array} words - Array of words
   * @returns {number} Count of dis legomena
   */
  countDisLegomena(words) {
    const frequency = this.calculateWordFrequency(words);
    return Object.values(frequency).filter(count => count === 2).length;
  }

  /**
   * Categorize words by frequency ranges
   * @param {Object} wordFrequency - Word frequency map
   * @returns {Object} Categorized frequency distribution
   */
  categorizeWordFrequency(wordFrequency) {
    const categories = {
      highFrequency: 0,    // 10+ occurrences
      mediumFrequency: 0,  // 3-9 occurrences
      lowFrequency: 0,     // 2 occurrences
      hapaxLegomena: 0     // 1 occurrence
    };

    Object.values(wordFrequency).forEach(frequency => {
      if (frequency >= 10) {
        categories.highFrequency++;
      } else if (frequency >= 3) {
        categories.mediumFrequency++;
      } else if (frequency === 2) {
        categories.lowFrequency++;
      } else {
        categories.hapaxLegomena++;
      }
    });

    return categories;
  }

  /**
   * Calculate readability score (simplified Flesch-like score)
   * @param {number} avgSentenceLength - Average sentence length
   * @param {number} avgSyllablesPerWord - Average syllables per word
   * @returns {number} Readability score (0-100, higher = easier to read)
   */
  calculateReadabilityScore(avgSentenceLength, avgSyllablesPerWord) {
    // Simplified Flesch Reading Ease formula
    const score = 206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllablesPerWord);
    return Math.min(Math.max(score, 0), 100);
  }

  /**
   * Compare vocabulary metrics with baseline
   * @param {Object} current - Current metrics
   * @param {Object} baseline - Baseline metrics
   * @returns {Object} Comparison results
   */
  compareWithBaseline(current, baseline) {
    if (!baseline) {
      return { hasBaseline: false };
    }

    return {
      hasBaseline: true,
      typeTokenRatioChange: this.calculatePercentageChange(baseline.typeTokenRatio, current.typeTokenRatio),
      avgWordLengthChange: this.calculatePercentageChange(baseline.avgWordLength, current.avgWordLength),
      avgSentenceLengthChange: this.calculatePercentageChange(baseline.avgSentenceLength, current.avgSentenceLength),
      complexityScoreChange: this.calculatePercentageChange(baseline.complexityScore, current.complexityScore),
      vocabularyDiversityDrop: current.typeTokenRatio < baseline.typeTokenRatio * 0.8, // 20% drop
      sentenceLengthDrop: current.avgSentenceLength < baseline.avgSentenceLength * 0.7, // 30% drop
      overallTrend: this.determineTrend(current, baseline)
    };
  }

  /**
   * Calculate percentage change between two values
   * @param {number} baseline - Baseline value
   * @param {number} current - Current value
   * @returns {number} Percentage change
   */
  calculatePercentageChange(baseline, current) {
    if (baseline === 0) return current > 0 ? 100 : 0;
    return ((current - baseline) / baseline) * 100;
  }

  /**
   * Determine overall trend based on multiple metrics
   * @param {Object} current - Current metrics
   * @param {Object} baseline - Baseline metrics
   * @returns {string} Trend description
   */
  determineTrend(current, baseline) {
    const diversityChange = this.calculatePercentageChange(baseline.typeTokenRatio, current.typeTokenRatio);
    const complexityChange = this.calculatePercentageChange(baseline.complexityScore, current.complexityScore);
    
    if (diversityChange < -15 && complexityChange < -15) {
      return 'declining';
    } else if (diversityChange > 15 && complexityChange > 15) {
      return 'improving';
    } else if (Math.abs(diversityChange) < 5 && Math.abs(complexityChange) < 5) {
      return 'stable';
    } else {
      return 'mixed';
    }
  }

  /**
   * Get default metrics structure
   * @returns {Object} Default metrics
   */
  getDefaultMetrics() {
    return {
      uniqueWords: 0,
      totalWords: 0,
      typeTokenRatio: 0,
      typeTokenRatioRaw: 0,
      avgWordLength: 0,
      avgSentenceLength: 0,
      avgWordsPerSentence: 0,
      complexityScore: 0,
      avgSyllablesPerWord: 0,
      lexicalDiversity: {
        typeTokenRatio: 0,
        hapaxLegomena: 0,
        disLegomena: 0,
        hapaxRatio: 0
      },
      sentenceCount: 0,
      mostCommonWords: [],
      wordFrequencyDistribution: {
        highFrequency: 0,
        mediumFrequency: 0,
        lowFrequency: 0,
        hapaxLegomena: 0
      },
      readabilityScore: 0,
      timestamp: new Date()
    };
  }
}

// Create singleton instance
const vocabularyAnalyzer = new VocabularyAnalyzer();

// Export both the class and the singleton instance
module.exports = {
  VocabularyAnalyzer,
  calculateVocabularyMetrics: (text) => vocabularyAnalyzer.calculateVocabularyMetrics(text)
};
