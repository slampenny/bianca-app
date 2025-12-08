const stripe = require('../config/stripe');
const logger = require('../config/logger');
const ApiError = require('../utils/ApiError');
const httpStatus = require('http-status');

/**
 * Stripe Meters Service
 * Handles creation and management of Stripe meters for usage-based billing
 */

// Meter configuration constants
const METER_CONFIG = {
  EVENT_NAME: 'api_requests', // Event name for reporting usage
  AGGREGATION_METHOD: 'sum', // Sum all usage values
  DISPLAY_NAME: 'API Requests', // Display name in Stripe dashboard
};

/**
 * Create or retrieve a meter for API requests
 * @returns {Promise<Object>} Stripe meter object
 */
const getOrCreateMeter = async () => {
  try {
    // Check if meter already exists
    const meters = await stripe.billing.meters.list({
      limit: 100,
    });

    const existingMeter = meters.data.find(
      (meter) => meter.event_name === METER_CONFIG.EVENT_NAME
    );

    if (existingMeter) {
      logger.info(`Using existing Stripe meter: ${existingMeter.id}`);
      return existingMeter;
    }

    // Create new meter
    const meter = await stripe.billing.meters.create({
      display_name: METER_CONFIG.DISPLAY_NAME,
      event_name: METER_CONFIG.EVENT_NAME,
      value_settings: {
        event_payload_key: 'value',
      },
      aggregation_type: METER_CONFIG.AGGREGATION_METHOD,
    });

    logger.info(`Created new Stripe meter: ${meter.id}`);
    return meter;
  } catch (error) {
    logger.error('Error creating/retrieving Stripe meter:', error);
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `Failed to create/retrieve meter: ${error.message}`
    );
  }
};

/**
 * Get meter by ID
 * @param {string} meterId - Stripe meter ID
 * @returns {Promise<Object>} Stripe meter object
 */
const getMeter = async (meterId) => {
  try {
    const meter = await stripe.billing.meters.retrieve(meterId);
    return meter;
  } catch (error) {
    logger.error(`Error retrieving meter ${meterId}:`, error);
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `Failed to retrieve meter: ${error.message}`
    );
  }
};

/**
 * List all meters
 * @param {Object} options - Query options
 * @returns {Promise<Object>} List of meters
 */
const listMeters = async (options = {}) => {
  try {
    const meters = await stripe.billing.meters.list({
      limit: options.limit || 100,
    });
    return meters;
  } catch (error) {
    logger.error('Error listing meters:', error);
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `Failed to list meters: ${error.message}`
    );
  }
};

module.exports = {
  getOrCreateMeter,
  getMeter,
  listMeters,
  METER_CONFIG,
};

