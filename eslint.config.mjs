import tseslint from '@typescript-eslint/eslint-plugin'
import tsparser from '@typescript-eslint/parser'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const tsconfigRootDir = dirname(fileURLToPath(import.meta.url))

export default [
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        // Anchor project discovery at the repo root so per-package eslint
        // invocations resolve `./packages/*/tsconfig.json` correctly even
        // when CWD is `packages/core` or `packages/cli`.
        project: ['./packages/*/tsconfig.json'],
        tsconfigRootDir,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'viem/accounts',
              message:
                'bridgehound is read-only. Importing signing utilities is not allowed.',
            },
          ],
        },
      ],
    },
  },
]
