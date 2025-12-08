// Centralized WebSocket mock
const MockWebSocket = jest.fn().mockImplementation(() => ({
  send: jest.fn(),
  close: jest.fn(),
  on: jest.fn(),
  removeAllListeners: jest.fn(),
  readyState: 1 // OPEN
}));

// Add static properties
MockWebSocket.OPEN = 1;
MockWebSocket.CONNECTING = 0;
MockWebSocket.CLOSING = 2;
MockWebSocket.CLOSED = 3;

module.exports = MockWebSocket;
