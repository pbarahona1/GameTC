import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

// `--mode single` produce un único index.html autocontenido (vista previa jugable).
export default defineConfig(({ mode }) => ({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [react(), ...(mode === 'single' ? [viteSingleFile()] : [])],
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    target: 'es2020',
    chunkSizeWarningLimit: 700,
    rollupOptions: mode === 'single' ? {} : {
      output: {
        // Separar librerías y textos del glosario acelera el primer arranque en Android (se cachean aparte).
        manualChunks(id: string) {
          if (id.includes('node_modules/react') || id.includes('node_modules/scheduler')) return 'vendor';
          if (id.includes('/src/content/glossary')) return 'glossary';
          return undefined;
        },
      },
    },
  },
  test: { globals: true, environment: 'node', include: ['tests/**/*.test.ts'], testTimeout: 120000, hookTimeout: 120000 },
}));
