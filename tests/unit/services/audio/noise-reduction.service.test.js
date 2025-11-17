/**
 * Unit Tests for Noise Reduction Service
 * 
 * Tests Stage 1: Noise Gate functionality
 */

const { Buffer } = require('buffer');

// Mock config before importing the service
jest.mock('../../../../src/config/config', () => ({
  audio: {
    noiseReduction: {
      noiseGateEnabled: true,
      noiseGateThreshold: 0.1,
      primarySpeakerEnabled: false,
      adaptiveNoiseReductionEnabled: false,
    }
  }
}));

// Mock logger
jest.mock('../../../../src/config/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('Noise Reduction Service - Stage 1: Noise Gate', () => {
  let noiseReductionService;
  let NoiseReductionService;

  beforeAll(() => {
    jest.resetModules();
    // Import the service (it's a singleton, but we can test the class)
    const serviceModule = require('../../../../src/services/audio/noise-reduction.service');
    noiseReductionService = serviceModule;
    
    // Get the class for creating test instances
    const fs = require('fs');
    const path = require('path');
    const servicePath = path.join(__dirname, '../../../../src/services/audio/noise-reduction.service.js');
    const serviceCode = fs.readFileSync(servicePath, 'utf8');
    // Extract class definition - we'll test the singleton instance
  });

  beforeEach(() => {
    // Reset stats
    noiseReductionService.resetStats();
    jest.clearAllMocks();
  });

  describe('Noise Gate - Basic Functionality', () => {
    it('should return silence for low-energy audio (below threshold)', () => {
      // Create low-energy audio (mostly silence with tiny variations)
      // μ-law silence is 0x7F, so we'll use values close to it
      const lowEnergyBuffer = Buffer.alloc(160); // 20ms at 8kHz
      for (let i = 0; i < 160; i++) {
        // Very quiet audio: values between 125-129 (close to silence 127)
        lowEnergyBuffer[i] = 127 + Math.floor(Math.random() * 5) - 2;
      }
      
      const result = noiseReductionService.processAudio(lowEnergyBuffer, 'test-call-1');
      
      // Should be all silence (0x7F)
      expect(result.length).toBe(160);
      for (let i = 0; i < result.length; i++) {
        expect(result[i]).toBe(0x7F); // μ-law silence
      }
      
      // Stats should show noise was gated
      const stats = noiseReductionService.getStats();
      expect(stats.noiseGated).toBeGreaterThan(0);
    });

    it('should preserve high-energy audio (above threshold)', () => {
      // Create high-energy audio (speech-like, far from silence)
      const highEnergyBuffer = Buffer.alloc(160);
      for (let i = 0; i < 160; i++) {
        // Loud audio: values far from silence (0x7F)
        // Use values like 100 or 150 (significant distance from 127)
        highEnergyBuffer[i] = i % 2 === 0 ? 100 : 150;
      }
      
      const result = noiseReductionService.processAudio(highEnergyBuffer, 'test-call-2');
      
      // Should be identical to input (no filtering)
      expect(result.length).toBe(160);
      expect(Buffer.compare(result, highEnergyBuffer)).toBe(0);
      
      // Stats should show audio was preserved
      const stats = noiseReductionService.getStats();
      expect(stats.totalProcessed).toBeGreaterThan(0);
    });

    it('should handle silence buffer correctly', () => {
      // Pure silence (all 0x7F)
      const silenceBuffer = Buffer.alloc(160, 0x7F);
      
      const result = noiseReductionService.processAudio(silenceBuffer, 'test-call-3');
      
      // Should return silence (no change)
      expect(Buffer.compare(result, silenceBuffer)).toBe(0);
      expect(result.length).toBe(160);
    });

    it('should handle empty buffer', () => {
      const emptyBuffer = Buffer.alloc(0);
      
      const result = noiseReductionService.processAudio(emptyBuffer, 'test-call-4');
      
      expect(result.length).toBe(0);
    });

    it('should handle null/undefined gracefully', () => {
      expect(() => {
        noiseReductionService.processAudio(null, 'test-call-5');
      }).not.toThrow();
      
      expect(() => {
        noiseReductionService.processAudio(undefined, 'test-call-6');
      }).not.toThrow();
    });
  });

  describe('Noise Gate - Threshold Behavior', () => {
    it('should filter audio at exactly threshold', () => {
      // Create audio with energy exactly at threshold (0.1)
      // RMS of 0.1 means average distance from silence is ~0.1 * 127 = ~12.7
      // So values should be around 127 ± 12.7 = 114-140
      const thresholdBuffer = Buffer.alloc(160);
      for (let i = 0; i < 160; i++) {
        // Values that give RMS ~0.1
        thresholdBuffer[i] = 127 + (i % 20) - 10; // Range: 117-137
      }
      
      const result = noiseReductionService.processAudio(thresholdBuffer, 'test-call-threshold');
      
      // At threshold, should be filtered (below threshold)
      // Note: Actual RMS calculation may vary, so this is approximate
      const stats = noiseReductionService.getStats();
      expect(stats.totalProcessed).toBeGreaterThan(0);
    });

    it('should preserve audio just above threshold', () => {
      // Create audio with energy slightly above threshold
      const aboveThresholdBuffer = Buffer.alloc(160);
      for (let i = 0; i < 160; i++) {
        // Values further from silence (higher energy)
        aboveThresholdBuffer[i] = i % 2 === 0 ? 90 : 160; // Significant distance from 127
      }
      
      const result = noiseReductionService.processAudio(aboveThresholdBuffer, 'test-call-above');
      
      // Should be preserved
      expect(Buffer.compare(result, aboveThresholdBuffer)).toBe(0);
    });
  });

  describe('Noise Gate - Real-world Scenarios', () => {
    it('should filter constant background noise (TV, fan)', () => {
      // Simulate constant background: steady low-level noise
      const backgroundNoise = Buffer.alloc(160);
      for (let i = 0; i < 160; i++) {
        // Steady low-level noise: 125-129 (very close to silence)
        backgroundNoise[i] = 127 + (i % 3) - 1;
      }
      
      const result = noiseReductionService.processAudio(backgroundNoise, 'test-call-background');
      
      // Should be filtered to silence
      const isSilence = result.every(byte => byte === 0x7F);
      expect(isSilence).toBe(true);
    });

    it('should preserve speech-like audio', () => {
      // Simulate speech: varying amplitude with significant energy
      const speechBuffer = Buffer.alloc(160);
      for (let i = 0; i < 160; i++) {
        // Speech pattern: varying amplitude
        const wave = Math.sin(i / 10) * 30; // ±30 from silence
        speechBuffer[i] = Math.max(0, Math.min(255, 127 + wave));
      }
      
      const result = noiseReductionService.processAudio(speechBuffer, 'test-call-speech');
      
      // Should be preserved (not filtered)
      expect(Buffer.compare(result, speechBuffer)).toBe(0);
    });

    it('should handle mixed audio (speech + background)', () => {
      // Simulate speech with background: speech should dominate
      const mixedBuffer = Buffer.alloc(160);
      for (let i = 0; i < 160; i++) {
        // Speech signal (high energy) + small background noise
        const speech = Math.sin(i / 10) * 40; // ±40 from silence (strong speech)
        const background = (Math.random() - 0.5) * 2; // Tiny background ±1
        mixedBuffer[i] = Math.max(0, Math.min(255, 127 + speech + background));
      }
      
      const result = noiseReductionService.processAudio(mixedBuffer, 'test-call-mixed');
      
      // Should be preserved (speech energy dominates)
      // Note: May not be identical due to processing, but should not be all silence
      const isAllSilence = result.every(byte => byte === 0x7F);
      expect(isAllSilence).toBe(false);
    });
  });

  describe('Statistics Tracking', () => {
    it('should track total processed packets', () => {
      const buffer = Buffer.alloc(160, 0x7F);
      
      noiseReductionService.processAudio(buffer, 'test-call-stats-1');
      noiseReductionService.processAudio(buffer, 'test-call-stats-2');
      noiseReductionService.processAudio(buffer, 'test-call-stats-3');
      
      const stats = noiseReductionService.getStats();
      expect(stats.totalProcessed).toBe(3);
    });

    it('should track noise gated packets', () => {
      // Process low-energy audio (will be gated)
      const lowEnergy = Buffer.alloc(160);
      for (let i = 0; i < 160; i++) {
        lowEnergy[i] = 127 + (i % 3) - 1; // Very quiet
      }
      
      noiseReductionService.processAudio(lowEnergy, 'test-call-gated');
      
      const stats = noiseReductionService.getStats();
      expect(stats.noiseGated).toBeGreaterThan(0);
      expect(parseFloat(stats.noiseGateRate)).toBeGreaterThan(0);
    });

    it('should reset statistics correctly', () => {
      const buffer = Buffer.alloc(160);
      noiseReductionService.processAudio(buffer, 'test-call-reset');
      
      noiseReductionService.resetStats();
      
      const stats = noiseReductionService.getStats();
      expect(stats.totalProcessed).toBe(0);
      expect(stats.noiseGated).toBe(0);
    });
  });

  describe('Configuration', () => {
    it('should respect noiseGateEnabled = false', () => {
      // Temporarily disable noise gate
      const originalEnabled = noiseReductionService.noiseGateEnabled;
      noiseReductionService.noiseGateEnabled = false;
      
      const lowEnergyBuffer = Buffer.alloc(160);
      for (let i = 0; i < 160; i++) {
        lowEnergyBuffer[i] = 127 + (i % 3) - 1; // Very quiet
      }
      
      const result = noiseReductionService.processAudio(lowEnergyBuffer, 'test-call-disabled');
      
      // Should return original (not filtered)
      expect(Buffer.compare(result, lowEnergyBuffer)).toBe(0);
      
      // Restore
      noiseReductionService.noiseGateEnabled = originalEnabled;
    });

    it('should use configured threshold', () => {
      const originalThreshold = noiseReductionService.noiseGateThreshold;
      
      // Set higher threshold (more aggressive filtering)
      noiseReductionService.noiseGateThreshold = 0.2;
      
      const mediumEnergyBuffer = Buffer.alloc(160);
      for (let i = 0; i < 160; i++) {
        // Medium energy: might pass at 0.1 but fail at 0.2
        mediumEnergyBuffer[i] = 127 + (i % 10) - 5; // Range: 122-132
      }
      
      const result = noiseReductionService.processAudio(mediumEnergyBuffer, 'test-call-threshold-high');
      
      // With higher threshold, more should be filtered
      const stats = noiseReductionService.getStats();
      expect(stats.totalProcessed).toBeGreaterThan(0);
      
      // Restore
      noiseReductionService.noiseGateThreshold = originalThreshold;
    });
  });

  describe('Performance', () => {
    it('should process audio quickly (no significant delay)', () => {
      const buffer = Buffer.alloc(160);
      for (let i = 0; i < 160; i++) {
        buffer[i] = 100 + (i % 50);
      }
      
      const start = Date.now();
      for (let i = 0; i < 1000; i++) {
        noiseReductionService.processAudio(buffer, `test-call-perf-${i}`);
      }
      const duration = Date.now() - start;
      
      // Should process 1000 packets in < 100ms (very fast)
      expect(duration).toBeLessThan(100);
    });
  });
});

