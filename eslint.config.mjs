import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    // One-off maintenance scripts run under plain node, not in the browser or
    // a Next.js runtime, so `console` and `process` are genuinely defined here.
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: { console: 'readonly', process: 'readonly' },
    },
  },
  {
    // CommonJS config files at the repo root — `module` is the whole point of them.
    files: ['*.config.js'],
    languageOptions: {
      globals: { module: 'readonly', require: 'readonly' },
    },
  },
  {
    // `.claude` and `.remember` hold vendored tooling and scratch files that we
    // neither author nor ship. Linting them buried the app's own results under
    // ~145 errors from other people's scripts, which made `eslint .` useless.
    ignores: ['.next/**', 'node_modules/**', '.claude/**', '.remember/**'],
  }
);
