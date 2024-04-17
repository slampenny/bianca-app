module.exports = {
  testEnvironment: 'node',
  testEnvironmentOptions: {
    NODE_ENV: 'test',
  },
  restoreMocks: true,
  coveragePathIgnorePatterns: ['node_modules', 'src/config', 'src/app.js'],
  coverageReporters: ['text', 'lcov', 'clover', 'html'],
  testMatch: ['**/*.test.js'], // Simplified to catch all .test.js files
};
