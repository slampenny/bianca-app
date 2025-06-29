// Global test setup to handle cleanup of intervals and resources
// This prevents Jest from hanging due to open handles

// Store references to intervals that need cleanup
const intervalsToCleanup = new Set();
const timeoutsToCleanup = new Set();

// Override setInterval to track intervals
const originalSetInterval = global.setInterval;
global.setInterval = function(callback, delay, ...args) {
  const intervalId = originalSetInterval(callback, delay, ...args);
  intervalsToCleanup.add(intervalId);
  return intervalId;
};

// Override clearInterval to remove from tracking
const originalClearInterval = global.clearInterval;
global.clearInterval = function(intervalId) {
  intervalsToCleanup.delete(intervalId);
  return originalClearInterval(intervalId);
};

// Override setTimeout to track timeouts
const originalSetTimeout = global.setTimeout;
global.setTimeout = function(callback, delay, ...args) {
  const timeoutId = originalSetTimeout(callback, delay, ...args);
  timeoutsToCleanup.add(timeoutId);
  return timeoutId;
};

// Override clearTimeout to remove from tracking
const originalClearTimeout = global.clearTimeout;
global.clearTimeout = function(timeoutId) {
  timeoutsToCleanup.delete(timeoutId);
  return originalClearTimeout(timeoutId);
};

// Cleanup function to clear all tracked intervals and timeouts
function cleanupTimers() {
  intervalsToCleanup.forEach(intervalId => {
    try {
      originalClearInterval(intervalId);
    } catch (error) {
      // Ignore errors during cleanup
    }
  });
  intervalsToCleanup.clear();
  
  timeoutsToCleanup.forEach(timeoutId => {
    try {
      originalClearTimeout(timeoutId);
    } catch (error) {
      // Ignore errors during cleanup
    }
  });
  timeoutsToCleanup.clear();
}

// Global cleanup after all tests
afterAll(async () => {
  // Wait a bit for any pending operations
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Clean up all tracked timers
  cleanupTimers();
  
  // Additional cleanup for services that might have been imported
  try {
    // Clean up OpenAI Realtime Service if it exists
    const openAIService = require('../src/services/openai.realtime.service');
    if (openAIService && typeof openAIService.disconnectAll === 'function') {
      await openAIService.disconnectAll();
    }
    if (openAIService && typeof openAIService.stopHealthCheck === 'function') {
      openAIService.stopHealthCheck();
    }
    if (openAIService && typeof openAIService.stopTranscriptCleanupInterval === 'function') {
      openAIService.stopTranscriptCleanupInterval();
    }
  } catch (error) {
    // Ignore errors if service doesn't exist or methods don't exist
  }
  
  try {
    // Clean up Port Manager Service if it exists
    const portManager = require('../src/services/port.manager.service');
    if (portManager && typeof portManager.destroy === 'function') {
      portManager.destroy();
    }
  } catch (error) {
    // Ignore errors if service doesn't exist or methods don't exist
  }
  
  try {
    // Clean up RTP Listener Service if it exists
    const rtpListener = require('../src/services/rtp.listener.service');
    if (rtpListener && typeof rtpListener.close === 'function') {
      rtpListener.close();
    }
    if (rtpListener && typeof rtpListener.destroy === 'function') {
      rtpListener.destroy();
    }
  } catch (error) {
    // Ignore errors if service doesn't exist or methods don't exist
  }
  
  try {
    // Clean up RTP Sender Service if it exists
    const rtpSender = require('../src/services/rtp.sender.service');
    if (rtpSender && typeof rtpSender.close === 'function') {
      rtpSender.close();
    }
    if (rtpSender && typeof rtpSender.destroy === 'function') {
      rtpSender.destroy();
    }
  } catch (error) {
    // Ignore errors if service doesn't exist or methods don't exist
  }
  
  try {
    // Clean up ARI Client if it exists
    const ariClient = require('../src/services/ari.client');
    if (ariClient && typeof ariClient.disconnect === 'function') {
      ariClient.disconnect();
    }
    if (ariClient && typeof ariClient.cleanup === 'function') {
      ariClient.cleanup();
    }
  } catch (error) {
    // Ignore errors if service doesn't exist or methods don't exist
  }
  
  // Wait a bit more for cleanup to complete
  await new Promise(resolve => setTimeout(resolve, 100));
});

// Export cleanup function for use in individual test files
module.exports = {
  cleanupTimers
}; 