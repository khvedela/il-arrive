import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    ignores: [
      'node_modules/',
      'dist/',
      'build/',
      'apps/web/**/*.ngsummary',
      'apps/track/**/*.ngsummary',
      '**/*.ngsummary.json',
      '.angular/',
      '**/migrations/**',
      '**/prisma/**',
      '.pnpm-store/',
      'apps/api/jest.config.js',
    ],
  },
];
