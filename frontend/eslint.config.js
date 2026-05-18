import globals from 'globals';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

/** @type {import('eslint').Linter.Config[]} */
const config = [
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'node_modules/**',
      '*.cjs',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.es2022,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      ...reactPlugin.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react/no-multi-comp': ['error', { ignoreStateless: false }],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      'no-console': ['error', { allow: ['warn', 'error', 'info'] }],
      'max-lines': ['error', { max: 500, skipBlankLines: true, skipComments: true }],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@supabase/supabase-js',
              message: 'Import @supabase/supabase-js only inside src/queries/client.ts',
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.name='fetch']",
          message: 'fetch() is forbidden outside src/queries/.',
        },
        {
          selector: "CallExpression[callee.object.name='window'][callee.property.name='fetch']",
          message: 'fetch() is forbidden outside src/queries/.',
        },
      ],
      // Raw <button> is banned in favor of the shadcn <Button> primitive at
      // @/components/ui/button. Landed as `warn` while the existing ~114
      // call-sites are migrated; the `--max-warnings` baseline in
      // package.json ratchets down to zero over time. Run
      //   node scripts/audit-raw-button.mjs
      // for an inventory with heuristic classification. Bespoke surfaces
      // (channel rows, participant tiles, color swatches) are legitimate
      // exceptions per frontend/CLAUDE.md — disable per-line with a JSDoc
      // explaining the surface, do NOT silence the rule globally.
      'react/forbid-elements': [
        'warn',
        {
          forbid: [
            {
              element: 'button',
              message:
                "Use <Button> from '@/components/ui/button' instead of a raw <button>. Bespoke surfaces (tile, row, swatch) may stay raw — add a JSDoc note and `// eslint-disable-next-line react/forbid-elements`.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/components/ui/**/*.tsx'],
    // shadcn primitive `button.tsx` legitimately renders a raw <button>.
    rules: {
      'max-lines': 'off',
      'react/forbid-elements': 'off',
    },
  },
  {
    files: ['src/queries/client.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    files: ['src/queries/**'],
    rules: { 'no-restricted-syntax': 'off' },
  },
  {
    files: ['src/test/**', '**/*.spec.ts', '**/*.test.{ts,tsx}', 'e2e/**'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        beforeAll: 'readonly',
        afterAll: 'readonly',
        afterEach: 'readonly',
        beforeEach: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        vi: 'readonly',
      },
    },
    rules: {
      'no-restricted-imports': 'off',
      'no-restricted-syntax': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
];

export default config;
