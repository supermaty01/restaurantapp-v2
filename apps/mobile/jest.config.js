/** @type {import('jest').Config} */
module.exports = {
  projects: [
    // React Native / component + logic tests (jest-expo environment).
    {
      displayName: 'app',
      preset: 'jest-expo',
      setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
      moduleNameMapper: {
        '^@restaurantapp/shared$': '<rootDir>/../../packages/shared/src/index.ts',
        '^@/(.*)$': '<rootDir>/$1',
      },
      testMatch: ['**/?(*.)+(spec|test).(ts|tsx)'],
      testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/', '\\.node\\.test\\.ts$'],
    },
    // Node-side tests: migrations and backup logic that run against a real
    // SQLite (better-sqlite3), which needs a plain node environment.
    {
      displayName: 'node',
      testEnvironment: 'node',
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
      },
      transform: {
        '^.+\\.ts$': ['babel-jest', { presets: ['babel-preset-expo'] }],
      },
      testMatch: ['**/*.node.test.ts'],
    },
  ],
  collectCoverageFrom: [
    'features/**/*.{ts,tsx}',
    'lib/**/*.{ts,tsx}',
    'services/**/*.{ts,tsx}',
    '!**/*.d.ts',
  ],
};
