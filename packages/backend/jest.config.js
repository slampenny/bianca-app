module.exports = {
  testEnvironment: 'node',
  testEnvironmentOptions: {
    NODE_ENV: 'test',
    NODE_NO_IOURING: '1',
  },
  restoreMocks: true,
  coveragePathIgnorePatterns: ['node_modules', 'src/config', 'src/app.js'],
  coverageReporters: ['text', 'lcov', 'clover', 'html'],
  testMatch: ['**/*.test.js'], // Simplified to catch all .test.js files
  watchAll: false,
  setupFiles: ['<rootDir>/tests/setupEnv.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  // CodeBuild RunTests runs the full unit suite serially; MongoMemoryServer startup can exceed 5s under load.
  testTimeout: 60000,
  // Ignore devops directories to prevent Haste module naming collisions
  modulePathIgnorePatterns: ['<rootDir>/devops'],
};
