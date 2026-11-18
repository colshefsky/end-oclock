import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['.output/**', '.wxt/**', 'node_modules/**', 'playwright-report/**', 'test-results/**', '.superpowers/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // Dev scripts that run in Node (live browser checks).
  { files: ['tests/live/**/*.mjs'], languageOptions: { globals: { ...globals.node, ...globals.browser, chrome: 'readonly' } } },
  // Playwright fixtures use `async ({}, use) => …` by design.
  { files: ['tests/e2e/**/*.ts'], rules: { 'no-empty-pattern': 'off' } },
);
