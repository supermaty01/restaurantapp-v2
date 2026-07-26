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
      // Passing an async handler to a JSX prop (onPress={async () => …}) is
      // idiomatic in React Native — the returned promise is ignored by design.
      // The genuine risk (floating promises in statements, async callbacks to
      // library APIs) stays caught by `arguments` + no-floating-promises.
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/switch-exhaustiveness-check': 'error',

      // --- React Compiler readiness rules (eslint-plugin-react-hooks v6).
      //
      // Off here, and on in `npm run lint:compiler`. React Compiler is NOT
      // enabled in this build, so these findings say nothing about how the app
      // behaves today: they describe work needed *before* adopting it.
      //
      // They were 'warn', which sounds like the careful choice and was the
      // worst of the three. `npm run lint` carries `--max-warnings=0`, so 83
      // advisory findings made the standard fail and CI red — and a red gate
      // that everyone knows to ignore stops being a gate. Either a rule blocks
      // the build or it is a separate question you ask on purpose. This is the
      // second kind.
      'react-hooks/refs': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/incompatible-library': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      // The classic two stay errors: these are about correctness today.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',

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
              // Blocks the schema and query surface. Plain constants such as
              // DATABASE_NAME carry no query power and the root layout needs
              // them to configure SQLiteProvider, so they stay allowed.
              group: [
                '**/services/db/schema',
                '@/services/db/schema',
                '**/services/db/types',
                '@/services/db/types',
              ],
              message: 'Screens must not query the DB. Use a feature repository/hook instead.',
            },
          ],
        },
      ],
    },
  },
  // NOTE: cross-feature isolation ("a feature must not import another feature's
  // internals") is intentionally NOT enforced here. no-restricted-imports can't
  // express "any feature except my own" — a single `@/features/*/*` pattern also
  // flags same-feature imports, and extglob negation isn't supported by the
  // rule's matcher (it silently matches nothing). Doing it right needs
  // eslint-plugin-boundaries, plus relocating today's legitimately-shared pieces
  // (the Tag component, ImageDTO/TagDTO) to a shared area. Tracked in docs/12.

  // --- Tests -------------------------------------------------------------
  {
    files: ['**/*.test.{ts,tsx}', 'jest.setup.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
