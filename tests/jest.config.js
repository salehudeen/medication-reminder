module.exports = {
    testEnvironment: 'node',
    verbose: true,
    collectCoverage: true,
    coverageReporters: ['text', 'lcov'],
    coverageDirectory: 'coverage',
    testMatch: [
      '**/__tests__/**/*.js?(x)',
      '**/?(*.)+(spec|test).js?(x)'
    ],
    moduleFileExtensions: ['js', 'jsx', 'json', 'node'],
    setupFiles: ['<rootDir>/jest.setup.js']
  };