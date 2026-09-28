import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `--mode single` produce un único index.html autocontenido (vista previa jugable).
export default defineConfig(({ mode }) => ({
  base: './',
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
  test: { globals: true, environment: 'node', include: ['tests/**/*.test.ts'] },
}));
