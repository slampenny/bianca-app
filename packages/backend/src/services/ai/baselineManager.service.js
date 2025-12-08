// src/services/ai/baselineManager.service.js

const conversationService = require('../conversation.service');
const logger = require('../../config/logger');

/**
 * Baseline Manager Service
 * Manages patient baselines with rolling averages and seasonal adjustments
 */
class BaselineManager {
  constructor() {
    this.config = {
      initialBaselineMonths: 3,    // Months for initial baseline
      rollingBaselineMonths: 6,    // Months for rolling average
      seasonalAdjustment: true,    // Enable seasonal adjustments
      significantChangeThreshold: 2.0, // Z-score threshold for significant changes
      minDataPoints: 5,           // Minimum data points for reliable baseline
      baselineUpdateInterval: 30   // Days between baseline updates
    };

    // Seasonal adjustment factors (month-based)
    this.seasonalFactors = {
      vocabulary: {
        0: 1.0,   // January
        1: 0.95,  // February (winter blues)
        2: 1.05,  // March (spring)
        3: 1.1,   // April (spring)
        4: 1.0,   // May
        5: 0.98,  // June
        6: 0.95,  // July (summer heat)
        7: 0.97,  // August
        8: 1.02,  // September (fall)
        9: 0.98,  // October
        10: 0.95, // November (winter onset)
        11: 0.92  // December (holiday stress)
      },
      mood: {
        0: 0.95,  // January (post-holiday blues)
        1: 0.90,  // February (winter depression)
        2: 1.05,  // March (spring optimism)
        3: 1.1,   // April (spring)
        4: 1.0,   // May
        5: 1.02,  // June
        6: 1.0,   // July
        7: 0.98,  // August
        8: 1.0,   // September
        9: 0.95,  // October
        10: 0.85, // November (seasonal depression onset)
        11: 0.80  // December (holiday stress)
      },
      cognitive: {
        0: 1.0,   // January
        1: 0.98,  // February
        2: 1.02,  // March
        3: 1.0,   // April
        4: 1.0,   // May
        5: 1.0,   // June
        6: 0.98,  // July (heat effects)
        7: 1.0,   // August
        8: 1.0,   // September
        9: 1.0,   // October
        10: 0.98, // November
        11: 0.95  // December (holiday distractions)
      }
    };
  }

  /**
   * Establish initial baseline for a patient
   * @param {string} patientId - Patient ID
   * @param {Object} initialMetrics - Initial metrics to establish baseline
   * @returns {Promise<Object>} Established baseline
   */
  async establishBaseline(patientId, initialMetrics) {
    try {
      const baseline = {
        patientId,
        type: 'initial',
        establishedDate: new Date(),
        lastUpdated: new Date(),
        dataPoints: [initialMetrics],
        metrics: this.calculateBaselineMetrics([initialMetrics]),
        seasonalAdjustments: this.calculateSeasonalAdjustments(),
        version: 1
      };

      await this.storeBaseline(patientId, baseline);
      
      logger.info('Initial baseline established', { 
        patientId, 
        metricsCount: Object.keys(baseline.metrics).length 
      });

      return baseline;

    } catch (error) {
      logger.error('Error establishing baseline:', error);
      throw error;
    }
  }

  /**
   * Update baseline with new metrics
   * @param {string} patientId - Patient ID
   * @param {Object} newMetrics - New metrics to add
   * @returns {Promise<Object>} Updated baseline
   */
  async updateBaseline(patientId, newMetrics) {
    try {
      const existingBaseline = await this.getBaseline(patientId);
      
      if (!existingBaseline) {
        // No existing baseline, establish initial one
        return await this.establishBaseline(patientId, newMetrics);
      }

      // Add new data point
      const updatedDataPoints = [...existingBaseline.dataPoints, newMetrics];
      
      // Remove old data points if we exceed the rolling window
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - this.config.rollingBaselineMonths);
      
      const filteredDataPoints = updatedDataPoints.filter(point => {
        // If no analysisDate, keep the point (for backward compatibility)
        if (!point.analysisDate) return true;
        return new Date(point.analysisDate) >= cutoffDate;
      });

      // Calculate new baseline metrics
      const updatedMetrics = this.calculateBaselineMetrics(filteredDataPoints);
      
      // Check if significant changes warrant baseline recalculation
      const significantChanges = this.detectSignificantChanges(
        existingBaseline.metrics, 
        updatedMetrics
      );

      const updatedBaseline = {
        ...existingBaseline,
        lastUpdated: new Date(),
        dataPoints: filteredDataPoints,
        metrics: updatedMetrics,
        seasonalAdjustments: this.calculateSeasonalAdjustments(),
        significantChanges,
        version: existingBaseline.version + 1
      };

      await this.storeBaseline(patientId, updatedBaseline);
      
      logger.info('Baseline updated', { 
        patientId, 
        dataPoints: filteredDataPoints.length,
        significantChanges: significantChanges.length
      });

      return updatedBaseline;

    } catch (error) {
      logger.error('Error updating baseline:', error);
      throw error;
    }
  }

  /**
   * Get deviation from baseline for current metrics
   * @param {string} patientId - Patient ID
   * @param {Object} currentMetrics - Current metrics to compare (can be nested medical analysis result)
   * @returns {Promise<Object>} Deviation analysis
   */
  async getDeviation(patientId, currentMetrics) {
    try {
      const baseline = await this.getBaseline(patientId);
      
      if (!baseline) {
        return {
          hasBaseline: false,
          message: 'No baseline available for comparison'
        };
      }

      // Flatten current metrics to match baseline structure
      const flattenedCurrentMetrics = this.flattenMetrics(currentMetrics);
      
      const deviations = {};
      const zScores = {};
      const significantChanges = [];

      // Calculate deviations for each metric
      Object.keys(flattenedCurrentMetrics).forEach(metricKey => {
        if (baseline.metrics[metricKey]) {
          const baselineMetric = baseline.metrics[metricKey];
          const currentValue = flattenedCurrentMetrics[metricKey];
          
          if (typeof currentValue === 'number' && typeof baselineMetric.mean === 'number') {
            // Calculate deviation
            const deviation = currentValue - baselineMetric.mean;
            const deviationPercent = baselineMetric.mean !== 0 
              ? (deviation / baselineMetric.mean) * 100 
              : 0;

            // Calculate z-score
            const zScore = baselineMetric.stdDev > 0 
              ? (currentValue - baselineMetric.mean) / baselineMetric.stdDev 
              : 0;

            deviations[metricKey] = {
              current: currentValue,
              baseline: baselineMetric.mean,
              deviation: Math.round(deviation * 10000) / 10000,
              deviationPercent: Math.round(deviationPercent * 100) / 100,
              zScore: Math.round(zScore * 100) / 100,
              isSignificant: Math.abs(zScore) >= this.config.significantChangeThreshold,
              direction: deviation > 0 ? 'increased' : deviation < 0 ? 'decreased' : 'stable'
            };

            zScores[metricKey] = zScore;

            // Check for significant changes
            if (Math.abs(zScore) >= this.config.significantChangeThreshold) {
              significantChanges.push({
                metric: metricKey,
                zScore: Math.round(zScore * 100) / 100,
                deviation: Math.round(deviation * 10000) / 10000,
                direction: deviation > 0 ? 'increase' : 'decrease',
                significance: this.categorizeSignificance(Math.abs(zScore))
              });
            }
          }
        }
      });

      // Apply seasonal adjustments
      const seasonalAdjustedDeviations = this.applySeasonalAdjustments(deviations);

      return {
        hasBaseline: true,
        baselineVersion: baseline.version,
        baselineEstablished: baseline.establishedDate,
        lastUpdated: baseline.lastUpdated,
        dataPoints: baseline.dataPoints.length,
        deviations,
        seasonalAdjustedDeviations,
        zScores,
        significantChanges,
        overallTrend: this.calculateOverallTrend(zScores),
        confidence: this.calculateConfidence(baseline.dataPoints.length)
      };

    } catch (error) {
      logger.error('Error calculating deviation:', error);
      throw error;
    }
  }

  /**
   * Check if a change is significant based on z-score
   * @param {number} zScore - Z-score value
   * @returns {boolean} Whether change is significant
   */
  isSignificantChange(zScore) {
    return Math.abs(zScore) >= this.config.significantChangeThreshold;
  }

  /**
   * Flatten nested medical analysis metrics to flat structure
   * @param {Object} analysisResult - Medical analysis result with nested metrics
   * @returns {Object} Flattened metrics object
   */
  flattenMetrics(analysisResult) {
    const flattened = {};
    
    // Helper function to recursively flatten nested objects
    const flattenObject = (obj, prefix = '') => {
      Object.keys(obj).forEach(key => {
        const value = obj[key];
        const newKey = prefix ? `${prefix}.${key}` : key;
        
        if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
          // Recursively flatten nested objects
          flattenObject(value, newKey);
        } else if (typeof value === 'number' && !isNaN(value)) {
          // Store numeric values
          flattened[newKey] = value;
        }
      });
    };
    
    flattenObject(analysisResult);
    return flattened;
  }

  /**
   * Calculate baseline metrics from data points
   * @param {Array} dataPoints - Array of metric data points
   * @returns {Object} Calculated baseline metrics
   */
  calculateBaselineMetrics(dataPoints) {
    if (dataPoints.length === 0) {
      return {};
    }

    const metrics = {};
    
    // Flatten each data point and collect all metric keys
    const metricKeys = new Set();
    const flattenedDataPoints = [];
    
    dataPoints.forEach(point => {
      const flattened = this.flattenMetrics(point);
      flattenedDataPoints.push(flattened);
      
      Object.keys(flattened).forEach(key => {
        if (typeof flattened[key] === 'number') {
          metricKeys.add(key);
        }
      });
    });

    // Calculate statistics for each metric
    metricKeys.forEach(metricKey => {
      const values = flattenedDataPoints
        .map(point => point[metricKey])
        .filter(value => typeof value === 'number' && !isNaN(value));

      if (values.length > 0) {
        metrics[metricKey] = {
          mean: this.calculateMean(values),
          median: this.calculateMedian(values),
          stdDev: this.calculateStandardDeviation(values),
          min: Math.min(...values),
          max: Math.max(...values),
          count: values.length,
          variance: this.calculateVariance(values)
        };
      }
    });

    return metrics;
  }

  /**
   * Calculate seasonal adjustments
   * @returns {Object} Seasonal adjustment factors
   */
  calculateSeasonalAdjustments() {
    const currentMonth = new Date().getMonth();
    
    return {
      vocabulary: this.seasonalFactors.vocabulary[currentMonth],
      mood: this.seasonalFactors.mood[currentMonth],
      cognitive: this.seasonalFactors.cognitive[currentMonth],
      month: currentMonth,
      monthName: new Date().toLocaleString('default', { month: 'long' })
    };
  }

  /**
   * Apply seasonal adjustments to deviations
   * @param {Object} deviations - Deviation calculations
   * @returns {Object} Seasonally adjusted deviations
   */
  applySeasonalAdjustments(deviations) {
    const seasonalFactors = this.calculateSeasonalAdjustments();
    const adjusted = {};

    Object.keys(deviations).forEach(metricKey => {
      const deviation = deviations[metricKey];
      let seasonalFactor = 1.0;

      // Determine appropriate seasonal factor based on metric type
      if (metricKey.includes('vocabulary') || metricKey.includes('complexity')) {
        seasonalFactor = seasonalFactors.vocabulary;
      } else if (metricKey.includes('mood') || metricKey.includes('depression') || metricKey.includes('anxiety')) {
        seasonalFactor = seasonalFactors.mood;
      } else if (metricKey.includes('cognitive') || metricKey.includes('memory')) {
        seasonalFactor = seasonalFactors.cognitive;
      }

      adjusted[metricKey] = {
        ...deviation,
        seasonalAdjustedDeviation: Math.round(deviation.deviation * seasonalFactor * 10000) / 10000,
        seasonalAdjustedPercent: Math.round(deviation.deviationPercent * seasonalFactor * 100) / 100,
        seasonalFactor: Math.round(seasonalFactor * 10000) / 10000
      };
    });

    return adjusted;
  }

  /**
   * Detect significant changes between old and new baselines
   * @param {Object} oldMetrics - Previous baseline metrics
   * @param {Object} newMetrics - New baseline metrics
   * @returns {Array} Array of significant changes
   */
  detectSignificantChanges(oldMetrics, newMetrics) {
    const changes = [];

    Object.keys(newMetrics).forEach(metricKey => {
      if (oldMetrics[metricKey]) {
        const oldMean = oldMetrics[metricKey].mean;
        const newMean = newMetrics[metricKey].mean;
        const oldStdDev = oldMetrics[metricKey].stdDev;

        if (oldStdDev > 0) {
          const zScore = (newMean - oldMean) / oldStdDev;
          
          if (Math.abs(zScore) >= this.config.significantChangeThreshold) {
            changes.push({
              metric: metricKey,
              oldMean,
              newMean,
              change: newMean - oldMean,
              changePercent: oldMean !== 0 ? ((newMean - oldMean) / oldMean) * 100 : 0,
              zScore: Math.round(zScore * 100) / 100,
              significance: this.categorizeSignificance(Math.abs(zScore))
            });
          }
        }
      }
    });

    return changes;
  }

  /**
   * Calculate overall trend from z-scores
   * @param {Object} zScores - Z-scores for all metrics
   * @returns {string} Overall trend direction
   */
  calculateOverallTrend(zScores) {
    const scores = Object.values(zScores).filter(score => typeof score === 'number');
    
    if (scores.length === 0) return 'stable';

    const avgZScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    
    if (avgZScore > 1.0) return 'improving';
    if (avgZScore < -1.0) return 'declining';
    return 'stable';
  }

  /**
   * Calculate confidence level based on data points
   * @param {number} dataPointCount - Number of data points
   * @returns {string} Confidence level
   */
  calculateConfidence(dataPointCount) {
    if (dataPointCount < this.config.minDataPoints) return 'low';
    if (dataPointCount < this.config.minDataPoints * 2) return 'medium';
    return 'high';
  }

  /**
   * Categorize significance level
   * @param {number} zScore - Absolute z-score value
   * @returns {string} Significance level
   */
  categorizeSignificance(zScore) {
    if (zScore >= 3.0) return 'very_high';
    if (zScore >= 2.5) return 'high';
    if (zScore >= 2.0) return 'moderate';
    return 'low';
  }

  /**
   * Get baseline for a patient
   * @param {string} patientId - Patient ID
   * @returns {Promise<Object|null>} Baseline data or null
   */
  async getBaseline(patientId) {
    try {
      return await conversationService.getMedicalBaseline(patientId);
    } catch (error) {
      logger.error('Error getting baseline:', error);
      return null;
    }
  }

  /**
   * Store baseline for a patient
   * @param {string} patientId - Patient ID
   * @param {Object} baseline - Baseline data
   * @returns {Promise<void>}
   */
  async storeBaseline(patientId, baseline) {
    try {
      await conversationService.storeMedicalBaseline(patientId, baseline);
    } catch (error) {
      logger.error('Error storing baseline:', error);
      throw error;
    }
  }

  /**
   * Calculate mean of an array
   * @param {Array} values - Array of numbers
   * @returns {number} Mean value
   */
  calculateMean(values) {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  /**
   * Calculate median of an array
   * @param {Array} values - Array of numbers
   * @returns {number} Median value
   */
  calculateMedian(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }

  /**
   * Calculate standard deviation of an array
   * @param {Array} values - Array of numbers
   * @returns {number} Standard deviation
   */
  calculateStandardDeviation(values) {
    const mean = this.calculateMean(values);
    const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  /**
   * Calculate variance of an array
   * @param {Array} values - Array of numbers
   * @returns {number} Variance
   */
  calculateVariance(values) {
    const mean = this.calculateMean(values);
    return values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
  }

  /**
   * Update configuration
   * @param {Object} newConfig - New configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   * @returns {Object} Current configuration
   */
  getConfig() {
    return { ...this.config };
  }
}

// Create singleton instance
const baselineManager = new BaselineManager();

module.exports = baselineManager;
