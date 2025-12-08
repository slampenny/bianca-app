// Centralized ARI client mock
module.exports = {
  connect: jest.fn().mockResolvedValue({
    applications: {
      list: jest.fn().mockResolvedValue([{ name: 'myphonefriend' }])
    },
    endpoints: {
      list: jest.fn().mockResolvedValue([])
    },
    on: jest.fn(),
    close: jest.fn(),
    removeAllListeners: jest.fn(),
    start: jest.fn().mockResolvedValue()
  })
};
