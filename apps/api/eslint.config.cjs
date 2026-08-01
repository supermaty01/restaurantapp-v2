const js = require('@eslint/js');
const tseslint = require('typescript-eslint');

/**
 * El lint del Worker.
 *
 * Pagaba el coste del análisis con tipos —`parserOptions.project` está puesto,
 * que es lo caro— y **no cobraba el beneficio**: usaba `configs.recommended` en
 * vez de `recommendedTypeChecked`, así que se quedaba fuera justo la regla que
 * más importa aquí. Cada ruta es `async` y cada `fetch` a Supabase devuelve una
 * promesa; una que nadie espera es un enlace que no se revoca o un aviso que no
 * se marca, y ninguno de los dos avisa de nada al fallar. Eso es exactamente lo
 * que `no-floating-promises` encuentra, y la app móvil ya la tenía activada.
 */
module.exports = tseslint.config(
  { ignores: ['node_modules/*', '.wrangler/*', 'dist/*', 'eslint.config.cjs'] },
  {
    files: ['**/*.ts'],
    ...js.configs.recommended,
  },
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
      '@typescript-eslint/no-misused-promises': 'error',
      // Los mismos silencios que la app: un catch vacío es como se pierden datos.
      'no-empty': ['error', { allowEmptyCatch: false }],
    },
  },
  {
    // Los tests montan dobles con formas parciales a propósito; exigirles la
    // firma entera convertiría cada uno en una copia del tipo real.
    files: ['test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      // Un doble implementa una interfaz que devuelve promesas; que su cuerpo
      // no espere nada es lo normal, no un descuido.
      '@typescript-eslint/require-await': 'off',
    },
  },
);
