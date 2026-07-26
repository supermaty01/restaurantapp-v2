// Compiler-readiness pass: `npm run lint:compiler`.
//
// Separate from the main gate on purpose. React Compiler is not enabled, so
// these findings describe work needed before adopting it, not defects in what
// ships today. Mixing them into `npm run lint` made an 83-warning standard that
// could never pass, which is a gate everyone learns to ignore.
//
// Run it when picking up that work, or before turning the compiler on.
import base from './eslint.config.js';

export default [
  ...base,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      'react-hooks/refs': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/incompatible-library': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
    },
  },
];
