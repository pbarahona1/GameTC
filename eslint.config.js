// Configuración de ESLint (formato plano). `npm run lint` falla con cualquier error:
// el CI lo ejecuta antes de compilar.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import { defineConfig } from 'eslint/config';

export default defineConfig(
  { ignores: ['dist/', 'dist-single/', 'android/', 'ota/', 'node_modules/', 'public/'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}', 'tests/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-hooks/exhaustive-deps': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
  },
  {
    files: ['scripts/**/*.mjs', 'vite.config.ts', 'capacitor.config.ts', 'eslint.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },
);
