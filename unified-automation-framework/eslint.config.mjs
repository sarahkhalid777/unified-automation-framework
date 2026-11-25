import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  { ignores: ['node_modules/**', 'reports/**', 'playwright-report/**', 'test-results/**'] },
  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // An un-awaited Playwright call is the most common cause of flaky tests.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.property.name='waitForTimeout']",
          message: 'Fixed sleeps make tests slow and flaky. Wait for a condition (web-first assertion or pollUntil).',
        },
      ],
    },
  },
  {
    // WebdriverIO/Mocha globals: type-checked against the mobile tsconfig, not the Playwright one.
    files: ['tests/mobile/**/*.ts', 'wdio.conf.ts'],
    languageOptions: {
      parserOptions: { projectService: false, project: ['./tests/mobile/tsconfig.json'], tsconfigRootDir: import.meta.dirname },
    },
  },
  {
    files: ['**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: { process: 'readonly', console: 'readonly' } },
  },
);
