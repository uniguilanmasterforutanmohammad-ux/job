import base from '@repo/config/eslint';

export default [
  ...base,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parserOptions: { sourceType: 'module', ecmaVersion: 2023 },
    },
    rules: {
      // NestJS DI relies on runtime metadata that looks unused to the linter.
      '@typescript-eslint/no-extraneous-class': 'off',
    },
  },
];
