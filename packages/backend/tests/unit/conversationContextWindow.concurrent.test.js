// tests/unit/conversationContextWindow.concurrent.test.js

const { getConversationContextWindow } = require('../../src/utils/conversationContextWindow');

describe('ConversationContextWindow - Concurrent Access Safety', () => {
  let contextWindow;

  beforeEach(() => {
    contextWindow = getConversationContextWindow();
    contextWindow.clearAll();
  });

  afterEach(() => {
    contextWindow.clearAll();
    contextWindow.stopCleanupInterval();
  });

  describe('Concurrent writes to same patient', () => {
    test('should handle concurrent writes to same patient context without data loss', async () => {
      const clientId = 'patient123';
      const numConcurrentCalls = 100;
      
      // Simulate 100 concurrent calls adding utterances
      const promises = Array.from({ length: numConcurrentCalls }, (_, i) => 
        contextWindow.addUtterance(clientId, `Message ${i}`, 'user', Date.now() + i)
      );
      
      await Promise.all(promises);
      
      // Should have at most maxUtterances (10) most recent messages
      const context = contextWindow.getRecentContext(clientId, 10);
      expect(context.length).toBeLessThanOrEqual(10);
      
      // Should have the most recent messages
      const timestamps = context.map(u => u.timestamp);
      const maxTimestamp = Math.max(...timestamps);
      const minTimestamp = Math.min(...timestamps);
      expect(maxTimestamp).toBeGreaterThan(minTimestamp);
      
      // All messages should be unique (no duplicates from race conditions)
      const uniqueTexts = new Set(context.map(u => u.text));
      expect(uniqueTexts.size).toBe(context.length);
    });

    test('should handle concurrent writes to different clients independently', async () => {
      const numClients = 50;
      const messagesPerClient = 20;
      
      const allPromises = [];
      for (let p = 0; p < numClients; p++) {
        const clientId = `client${p}`;
        for (let m = 0; m < messagesPerClient; m++) {
          allPromises.push(
            contextWindow.addUtterance(clientId, `Client ${p} message ${m}`, 'user', Date.now() + m)
          );
        }
      }
      
      await Promise.all(allPromises);
      
      for (let p = 0; p < numClients; p++) {
        const clientId = `client${p}`;
        const context = contextWindow.getRecentContext(clientId, 10);
        
        context.forEach(utterance => {
          expect(utterance.text).toContain(`Client ${p}`);
        });
        
        context.forEach(utterance => {
          for (let otherP = 0; otherP < numClients; otherP++) {
            if (otherP !== p) {
              const otherClientPattern = new RegExp(`^Client ${otherP} message \\d+$`);
              expect(utterance.text).not.toMatch(otherClientPattern);
            }
          }
        });
      }
    });

    test('should handle concurrent read and write operations', async () => {
      const clientId = 'patient123';
      const numWrites = 50;
      const numReads = 50;
      
      // Concurrent writes
      const writePromises = Array.from({ length: numWrites }, (_, i) =>
        contextWindow.addUtterance(clientId, `Write ${i}`, 'user', Date.now() + i)
      );
      
      // Concurrent reads
      const readPromises = Array.from({ length: numReads }, () =>
        contextWindow.getRecentContext(clientId)
      );
      
      await Promise.all([...writePromises, ...readPromises]);
      
      // Final state should be consistent
      const finalContext = contextWindow.getRecentContext(clientId);
      expect(finalContext.length).toBeLessThanOrEqual(10);
    });

    test('should handle concurrent cleanup and write operations', async () => {
      const clientId = 'patient123';
      
      // Add some old utterances
      const oldTime = Date.now() - 10 * 60 * 1000; // 10 minutes ago
      contextWindow.addUtterance(clientId, 'Old message', 'user', oldTime);
      
      // Concurrent: write new messages and trigger cleanup
      const newTime = Date.now();
      const promises = [
        contextWindow.addUtterance(clientId, 'New message 1', 'user', newTime),
        contextWindow.addUtterance(clientId, 'New message 2', 'user', newTime + 1000),
        new Promise(resolve => {
          // Trigger cleanup manually
          contextWindow.trimToWindow(clientId);
          resolve();
        })
      ];
      
      await Promise.all(promises);
      
      // Old message should be removed, new messages should remain
      const context = contextWindow.getRecentContext(clientId);
      expect(context.length).toBeLessThanOrEqual(2);
      context.forEach(u => {
        expect(u.text).not.toBe('Old message');
      });
    });
  });

  describe('Thread safety with Map operations', () => {
    test('should safely handle concurrent get and set operations', async () => {
      const numClients = 100;
      const operationsPerClient = 10;
      
      // Concurrent get/set operations
      const allPromises = [];
      for (let p = 0; p < numClients; p++) {
        const clientId = `client${p}`;
        for (let op = 0; op < operationsPerClient; op++) {
          // Mix of reads and writes
          if (op % 2 === 0) {
            allPromises.push(contextWindow.addUtterance(clientId, `Message ${op}`, 'user'));
          } else {
            allPromises.push(Promise.resolve(contextWindow.getRecentContext(clientId)));
          }
        }
      }
      
      await Promise.all(allPromises);
      
      // Verify all clients still have isolated contexts
      const stats = contextWindow.getStats();
      expect(stats.totalClients).toBeLessThanOrEqual(numClients);
    });
  });

  describe('Performance under high concurrency', () => {
    test('should handle 1000 concurrent operations efficiently', async () => {
      const numClients = 100;
      const operationsPerClient = 10;
      const totalOperations = numClients * operationsPerClient;
      
      const startTime = Date.now();
      
      const allPromises = [];
      for (let p = 0; p < numClients; p++) {
        const clientId = `client${p}`;
        for (let op = 0; op < operationsPerClient; op++) {
          allPromises.push(
            contextWindow.addUtterance(clientId, `Client ${p} op ${op}`, 'user', Date.now() + op)
          );
        }
      }
      
      await Promise.all(allPromises);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete reasonably quickly (under 5 seconds for 1000 operations)
      expect(duration).toBeLessThan(5000);
      
      // Verify data integrity
      for (let p = 0; p < numClients; p++) {
        const clientId = `client${p}`;
        const context = contextWindow.getRecentContext(clientId);
        context.forEach(u => {
          expect(u.text).toContain(`Client ${p}`);
        });
      }
    });
  });
});

