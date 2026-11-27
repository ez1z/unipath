// @ts-check
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import astro from 'eslint-plugin-astro';
import jsxA11y from 'eslint-plugin-jsx-a11y-x';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores([
    'dist/',
    '.astro/',
    '.wrangler/',
    'node_modules/',
    'test-results/',
    'playwright-report/',
    'worker-configuration.d.ts',
    '.remember/',
  ]),
  js.configs.recommended,
  tseslint.configs.strict,
  tseslint.configs.stylistic,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  // Astro components, with strict accessibility rules for their markup.
  astro.configs.recommended,
  astro.configs['jsx-a11y-strict'],
  // React islands: hooks rules and strict accessibility rules.
  {
    files: ['src/islands/**/*.{ts,tsx}'],
    ...jsxA11y.configs.strict,
  },
  {
    files: ['src/islands/**/*.{ts,tsx}'],
    ...reactHooks.configs.flat['recommended-latest'],
  },
  prettier,
);
