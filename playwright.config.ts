import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './client/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    channel: process.env.PLAYWRIGHT_CHANNEL,
    baseURL: 'http://localhost:4179',
    viewport: { width: 1440, height: 960 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node --import tsx server/test/e2e-server.ts',
    url: 'http://localhost:4179/api/health',
    reuseExistingServer: false,
    timeout: 120000,
  },
});
