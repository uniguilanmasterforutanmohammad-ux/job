import base from '@repo/config/eslint';
import nextPlugin from '@next/eslint-plugin-next';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  ...base,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { '@next/next': nextPlugin, 'react-hooks': reactHooks },
    rules: {
      ...nextPlugin.configs['core-web-vitals'].rules,
      ...reactHooks.configs['recommended-latest'].rules,
      // New in eslint-plugin-react-hooks v7: it flags every `setState` inside an
      // effect. The existing auth/portal providers intentionally sync state from
      // storage on mount, so this stays advisory until they are migrated.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  { ignores: ['.next/**', 'next-env.d.ts'] },
];
