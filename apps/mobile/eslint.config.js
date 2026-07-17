// Flat config. Enforces the layering rules documented in docs/12-calidad.md:
// screens never touch SQL or the network directly.
const expoConfig = require('eslint-config-expo/flat');
const tseslint = require('typescript-eslint');

const unusedImports = require('eslint-plugin-unused-imports');
const jsxA11y = require('eslint-plugin-jsx-a11y');

module.exports = tseslint.config(
  expoConfig,
  {
    ignores: [
      'dist/*',
      'coverage/*',
      'android/*',
      'ios/*',
      '.expo/*',
      'drizzle/*',
      'node_modules/*',
      '*.config.js',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
      },
    },
    // `import` and `@typescript-eslint` are already registered by eslint-config-expo.
    plugins: {
      'unused-imports': unusedImports,
      'jsx-a11y': jsxA11y,
    },
    rules: {
      // --- Types: `any` is banned; use `unknown` + zod at the boundaries.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/switch-exhaustiveness-check': 'error',

      // --- Silent failures are how data gets lost.
      'no-empty': ['error', { allowEmptyCatch: false }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],

      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'error',
        { vars: 'all', varsIgnorePattern: '^_', args: 'after-used', argsIgnorePattern: '^_' },
      ],

      'import/no-duplicates': 'error',
      'import/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            ['parent', 'sibling', 'index'],
            'object',
            'type',
          ],
          pathGroups: [{ pattern: '@/**', group: 'internal', position: 'before' }],
          pathGroupsExcludedImportTypes: ['builtin'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
    },
  },

  // --- Architecture boundaries (docs/12-calidad.md) -------------------------
  // Only repositories may talk to the database.
  {
    files: [
      'app/**/*.{ts,tsx}',
      'components/**/*.{ts,tsx}',
      'features/**/components/**/*.{ts,tsx}',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'drizzle-orm',
              message: 'Screens must not query the DB. Use a feature repository/hook instead.',
            },
          ],
          patterns: [
            {
              group: ['**/services/db/**', '@/services/db/**'],
              message: 'Screens must not query the DB. Use a feature repository/hook instead.',
            },
          ],
        },
      ],
    },
  },
  // Features must stay independent of each other; shared code goes to lib/.
  {
    files: ['features/*/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/features/*/*'],
              message:
                'Features must not import from other features. Lift shared code to lib/ or packages/shared.',
            },
          ],
        },
      ],
    },
  },

  // --- Tests -------------------------------------------------------------
  {
    files: ['**/*.test.{ts,tsx}', 'jest.setup.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
