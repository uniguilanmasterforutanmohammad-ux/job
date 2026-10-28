import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Shared ESLint flat config for every workspace package.
 *
 * It is intentionally rule-light: `js` + `typescript-eslint` recommended rules
 * catch real bugs (unused vars, dead code, `any` leaks) without forcing the
 * codebase through a stylistic overhaul. Apps extend this array and add their
 * own framework config (e.g. `eslint-config-next` in `apps/web`).
 */
const base = tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
      '**/node_modules/**',
      '**/generated/**',
      '**/*.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      // `any` is occasionally the honest type at a Prisma/Express boundary.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      // Decorated NestJS DTOs and Zod `z.infer` aliases trip these.
      '@typescript-eslint/no-empty-object-type': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
);

export default base;
