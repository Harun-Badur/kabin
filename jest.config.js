module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/__tests__/**/*.test.ts'],
  modulePathIgnorePatterns: ['<rootDir>/dist/', '<rootDir>/node_modules/'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
};
