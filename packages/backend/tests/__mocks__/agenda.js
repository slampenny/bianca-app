// Centralized Agenda mock
module.exports = jest.fn().mockImplementation(() => ({
  define: jest.fn(),
  start: jest.fn().mockResolvedValue(),
  stop: jest.fn().mockResolvedValue(),
  cancel: jest.fn().mockResolvedValue(),
  schedule: jest.fn().mockResolvedValue(),
  every: jest.fn().mockReturnThis(),
  now: jest.fn().mockResolvedValue(),
  ready: jest.fn().mockResolvedValue()
}));
