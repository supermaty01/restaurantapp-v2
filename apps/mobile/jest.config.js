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
      setupFiles: ['<rootDir>/jest.setup.node.ts'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
      },
      transform: {
        '^.+\\.[jt]s$': ['babel-jest', { presets: ['babel-preset-expo'] }],
      },
      // `babel-preset-expo` reescribe cada `process.env.EXPO_PUBLIC_*` como un
      // import de `expo/virtual/env`, que es ESM. Sin esta excepción, cualquier
      // módulo que lea una variable pública —`photos.ts` lee la URL del
      // Worker— revienta al cargarlo con "Unexpected token 'export'", y el
      // mensaje no menciona ni la variable ni el preset.
      transformIgnorePatterns: ['/node_modules/(?!expo/virtual/)'],
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
