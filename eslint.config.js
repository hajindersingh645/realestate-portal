import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import nodePlugin from 'eslint-plugin-n';
import security from 'eslint-plugin-security';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '.claude/**', 'coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  nodePlugin.configs['flat/recommended-module'],
  security.configs.recommended,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      'no-console': 'error',
      eqeqeq: ['error', 'always'],
      'n/no-process-env': 'error',
      // TypeScript resolves imports; these rules misread `.js` specifiers that point at `.ts` files.
      'n/no-missing-import': 'off',
      'n/no-unpublished-import': 'off',
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    // The only places allowed to read the environment.
    files: [
      '**/config.ts',
      '**/testing.ts',
      '**/*.test.ts',
      'scripts/**',
      '*.config.ts',
      'vitest.swc.ts',
    ],
    rules: { 'n/no-process-env': 'off' },
  },
  {
    files: ['**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },
  {
    // Process entry points decide when the process ends.
    files: ['**/server.ts', '**/migrate.ts'],
    rules: { 'n/no-process-exit': 'off' },
  },
  { files: ['**/*.js'], extends: [tseslint.configs.disableTypeChecked] },
  prettier,
);
