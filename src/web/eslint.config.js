// Architecture rules from Bulletproof React, enforced by the linter.
// Do NOT weaken these rules to make an error go away — fix the code instead.
//
// Tuned for speed: expensive checks that tsc or Prettier already cover are
// left out (import/no-cycle, import/no-unresolved & co., prettier-in-eslint).
// Formatting is checked by `npm run format:check`; run ESLint with --cache.
import fs from 'node:fs';
import path from 'node:path';

import js from '@eslint/js';
import vitest from '@vitest/eslint-plugin';
import checkFile from 'eslint-plugin-check-file';
import importPlugin from 'eslint-plugin-import';
import jestDom from 'eslint-plugin-jest-dom';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import testingLibrary from 'eslint-plugin-testing-library';
import prettierConfig from 'eslint-config-prettier/flat';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Every folder in src/features is discovered automatically, so a new feature
// is isolated from the others the moment its folder exists.
const featuresDir = path.resolve(import.meta.dirname, 'src/features');
const features = fs.existsSync(featuresDir)
  ? fs
      .readdirSync(featuresDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
  : [];

const crossFeatureZones = features.map((feature) => ({
  target: `./src/features/${feature}`,
  from: './src/features',
  except: [`./${feature}`],
  message:
    'Features must not import from other features. Compose them in src/app instead.',
}));

// Raw palette colors (bg-blue-500, text-gray-900...) and hex literals bypass
// the design tokens in src/styles/theme.css. Use semantic tokens instead
// (bg-primary, text-muted-foreground, border-border...).
const RAW_COLOR =
  '\\b(?:bg|text|border|ring|outline|fill|stroke|from|via|to|divide|placeholder|shadow|decoration|accent|caret)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\\d{2,3}\\b|\\[#[0-9a-fA-F]{3,8}\\]';
const rawColorMessage =
  'Use design tokens (bg-primary, text-foreground, text-muted-foreground, border-border...) instead of raw palette colors. Add a token in src/styles/theme.css if one is missing.';

export default defineConfig([
  {
    ignores: [
      'dist',
      'coverage',
      'node_modules',
      'public/mockServiceWorker.js',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      react.configs.flat.recommended,
      react.configs.flat['jsx-runtime'],
      jsxA11y.flatConfigs.recommended,
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
    },
    settings: {
      react: { version: 'detect' },
      'import/resolver': {
        typescript: { project: './tsconfig.json' },
      },
    },
    plugins: {
      import: importPlugin,
      'react-hooks': reactHooks,
      'check-file': checkFile,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,

      'import/no-restricted-paths': [
        'error',
        {
          zones: [
            // 1. Features are isolated from each other.
            ...crossFeatureZones,

            // 2. Unidirectional flow: shared -> features -> app.
            {
              target: './src/features',
              from: './src/app',
              message: 'Features cannot import from the app layer.',
            },
            {
              target: [
                './src/components',
                './src/config',
                './src/hooks',
                './src/lib',
                './src/stores',
                './src/types',
                './src/utils',
              ],
              from: ['./src/features', './src/app'],
              message:
                'Shared modules cannot import from features or the app layer.',
            },
          ],
        },
      ],
      'import/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
            'object',
          ],
          pathGroups: [{ pattern: '@/**', group: 'internal' }],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      // Absolute imports (@/...) instead of climbing out of the current module.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^\\.\\./\\.\\./',
              message: 'Use absolute imports (@/...) instead of ../../',
            },
          ],
        },
      ],

      'no-restricted-syntax': [
        'error',
        {
          selector: `Literal[value=/${RAW_COLOR}/]`,
          message: rawColorMessage,
        },
        {
          selector: `TemplateElement[value.raw=/${RAW_COLOR}/]`,
          message: rawColorMessage,
        },
      ],

      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
      'jsx-a11y/anchor-is-valid': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { fixStyle: 'inline-type-imports' },
      ],

      'check-file/filename-naming-convention': [
        'error',
        { '**/*.{ts,tsx}': 'KEBAB_CASE' },
        { ignoreMiddleExtensions: true },
      ],
      'check-file/folder-naming-convention': [
        'error',
        { 'src/**/!(__tests__)': 'KEBAB_CASE' },
      ],
    },
  },
  {
    files: ['src/**/*.test.{ts,tsx}', 'src/testing/**'],
    extends: [
      testingLibrary.configs['flat/react'],
      jestDom.configs['flat/recommended'],
      vitest.configs.recommended,
    ],
    languageOptions: {
      globals: { ...vitest.environments.env.globals },
    },
  },
  prettierConfig,
]);
