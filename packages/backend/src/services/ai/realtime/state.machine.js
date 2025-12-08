/**
 * Conversation State Machine
 * Handles the flow of conversation states to prevent race conditions and dual responses
 */

const logger = require('../../../config/logger');

/**
 * Conversation states
 */
const CONVERSATION_STATES = {
  INITIALIZING: 'initializing',           // Call setup, WebSocket connecting
  WAITING_FOR_GREETING: 'waiting_for_greeting', // Initial greeting being generated
  GREETING_ACTIVE: 'greeting_active',     // AI is speaking the initial greeting
  GREETING_COMPLETE: 'greeting_complete', // Greeting finished, waiting for user
  USER_SPEAKING: 'user_speaking',         // User is speaking
  AI_RESPONDING: 'ai_responding',         // AI is generating/playing response
  CONVERSATION_ACTIVE: 'conversation_active', // Normal conversation flow
  CALL_ENDING: 'call_ending',             // Call is being terminated
  ERROR: 'error'                          // Error state
};

/**
 * State transition rules - what states can transition to what
 */
const STATE_TRANSITIONS = {
  [CONVERSATION_STATES.INITIALIZING]: [CONVERSATION_STATES.WAITING_FOR_GREETING, CONVERSATION_STATES.ERROR],
  [CONVERSATION_STATES.WAITING_FOR_GREETING]: [CONVERSATION_STATES.GREETING_ACTIVE, CONVERSATION_STATES.ERROR],
  [CONVERSATION_STATES.GREETING_ACTIVE]: [CONVERSATION_STATES.GREETING_COMPLETE, CONVERSATION_STATES.ERROR],
  [CONVERSATION_STATES.GREETING_COMPLETE]: [CONVERSATION_STATES.USER_SPEAKING, CONVERSATION_STATES.CALL_ENDING, CONVERSATION_STATES.ERROR],
  [CONVERSATION_STATES.USER_SPEAKING]: [CONVERSATION_STATES.AI_RESPONDING, CONVERSATION_STATES.CALL_ENDING, CONVERSATION_STATES.ERROR],
  [CONVERSATION_STATES.AI_RESPONDING]: [CONVERSATION_STATES.CONVERSATION_ACTIVE, CONVERSATION_STATES.CALL_ENDING, CONVERSATION_STATES.ERROR],
  [CONVERSATION_STATES.CONVERSATION_ACTIVE]: [CONVERSATION_STATES.USER_SPEAKING, CONVERSATION_STATES.AI_RESPONDING, CONVERSATION_STATES.CALL_ENDING, CONVERSATION_STATES.ERROR],
  [CONVERSATION_STATES.CALL_ENDING]: [CONVERSATION_STATES.ERROR],
  [CONVERSATION_STATES.ERROR]: [CONVERSATION_STATES.INITIALIZING] // Can recover from error
};

/**
 * State Machine Manager
 * Manages conversation state transitions for a connection
 * 
 * This module provides state machine functionality that can be used
 * by the main service. The service maintains backward compatibility
 * by wrapping these methods.
 */
class StateMachine {
  /**
   * Initialize conversation state for a new call
   * @param {Object} connection - Connection object to initialize state for
   */
  static initialize(connection) {
    if (!connection) return;

    connection.conversationState = CONVERSATION_STATES.INITIALIZING;
    connection.stateHistory = [{
      state: CONVERSATION_STATES.INITIALIZING,
      timestamp: Date.now(),
      reason: 'call_initialized'
    }];
    
    logger.info(`[State Machine] Initialized conversation state: ${connection.conversationState}`);
  }

  /**
   * Transition to a new conversation state with validation
   * @param {Object} connection - Connection object
   * @param {string} newState - New state to transition to
   * @param {string} reason - Reason for transition
   * @returns {boolean} True if transition was successful
   */
  static transition(connection, newState, reason = 'unknown') {
    if (!connection) {
      logger.error(`[State Machine] Cannot transition state - no connection`);
      return false;
    }

    const currentState = connection.conversationState;
    const allowedTransitions = STATE_TRANSITIONS[currentState] || [];

    if (!allowedTransitions.includes(newState)) {
      logger.warn(`[State Machine] Invalid state transition: ${currentState} -> ${newState}. Allowed: ${allowedTransitions.join(', ')}`);
      return false;
    }

    const previousState = connection.conversationState;
    connection.conversationState = newState;
    connection.stateHistory = connection.stateHistory || [];
    connection.stateHistory.push({
      state: newState,
      timestamp: Date.now(),
      reason: reason,
      previousState: previousState
    });

    // Keep only last 10 state transitions to prevent memory bloat
    if (connection.stateHistory.length > 10) {
      connection.stateHistory = connection.stateHistory.slice(-10);
    }

    logger.info(`[State Machine] ${previousState} -> ${newState} (${reason})`);
    return true;
  }

  /**
   * Check if a state transition is allowed
   * @param {Object} connection - Connection object
   * @param {string} newState - State to check transition to
   * @returns {boolean} True if transition is allowed
   */
  static canTransitionTo(connection, newState) {
    if (!connection) return false;

    const currentState = connection.conversationState;
    const allowedTransitions = STATE_TRANSITIONS[currentState] || [];
    return allowedTransitions.includes(newState);
  }

  /**
   * Get current conversation state
   * @param {Object} connection - Connection object
   * @returns {string|null} Current state or null
   */
  static getCurrentState(connection) {
    return connection ? connection.conversationState : null;
  }

  /**
   * Check if we're in a state where AI can respond
   * @param {Object} connection - Connection object
   * @returns {boolean} True if AI can respond
   */
  static canAIRespond(connection) {
    const state = StateMachine.getCurrentState(connection);
    return [
      CONVERSATION_STATES.WAITING_FOR_GREETING,
      CONVERSATION_STATES.GREETING_COMPLETE,
      CONVERSATION_STATES.CONVERSATION_ACTIVE
    ].includes(state);
  }

  /**
   * Check if we're in a state where user can speak
   * @param {Object} connection - Connection object
   * @returns {boolean} True if user can speak
   */
  static canUserSpeak(connection) {
    const state = StateMachine.getCurrentState(connection);
    return [
      CONVERSATION_STATES.GREETING_COMPLETE,
      CONVERSATION_STATES.CONVERSATION_ACTIVE
    ].includes(state);
  }

  /**
   * Check if we're in the grace period after greeting completion
   * @param {Object} connection - Connection object
   * @param {number} gracePeriodMs - Grace period in milliseconds
   * @returns {boolean} True if in grace period
   */
  static isInGracePeriod(connection, gracePeriodMs) {
    if (!connection || !connection._initialGreetingCompletedAt) return false;

    const timeSinceGreeting = Date.now() - connection._initialGreetingCompletedAt;
    return timeSinceGreeting < gracePeriodMs;
  }
}

module.exports = {
  CONVERSATION_STATES,
  STATE_TRANSITIONS,
  StateMachine
};

