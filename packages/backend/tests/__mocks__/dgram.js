// Centralized dgram (UDP) mock
const mockUdpServer = {
  bind: jest.fn((port, host, callback) => {
    // Simulate successful bind by calling the callback immediately
    if (callback) {
      setTimeout(() => callback(), 0);
    }
  }),
  close: jest.fn(),
  on: jest.fn(),
  address: jest.fn().mockReturnValue({ address: '0.0.0.0', port: 1234 })
};

const dgram = {
  createSocket: jest.fn().mockReturnValue(mockUdpServer)
};

module.exports = dgram;
