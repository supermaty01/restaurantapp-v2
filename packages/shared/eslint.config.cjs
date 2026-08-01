const js = require('@eslint/js');
const tseslint = require('typescript-eslint');

/**
 * El paquete declaraba un script `lint` y no tenía configuración, así que
 * `npm run lint` en la raíz fallaba al llegar aquí. Misma severidad que el
 * Worker: es código que se ejecuta en los dos lados.
 */
module.exports = tseslint.config(
  { ignores: ['node_modules/*', 'dist/*', 'eslint.config.cjs'] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { project: './tsconfig.json', tsconfigRootDir: __dirname },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-floating-promises': 'error',
    },
  },
);
