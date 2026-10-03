import { defineConfig, devices } from '@playwright/test';

/**
 * Prueba de punta a punta sobre la versión compilada (la misma que se empaqueta
 * en Android). Requiere `npm run build` antes; el CI la corre después del build.
 * Si hay un Chromium ya instalado fuera de Playwright, se puede indicar con
 * PW_CHROMIUM_PATH.
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]] : 'list',
  use: {
    ...devices['Pixel 7'],
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  webServer: {
    command: 'npx vite preview --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
