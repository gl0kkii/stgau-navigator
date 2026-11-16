// Тесты собранного сайта. BASE_URL — проверить другой адрес (напр. localhost:8765 на Mac).
const { defineConfig, devices } = require('@playwright/test');
const base = process.env.BASE_URL || 'http://localhost:8765/';
module.exports = defineConfig({
  testDir: 'tests',
  timeout: 20000,
  fullyParallel: true,
  reporter: 'list',
  use: { baseURL: base, ...devices['Pixel 7'], browserName: 'chromium', ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}) },
  webServer: process.env.BASE_URL ? undefined : { command: 'node tests/serve.cjs', env: { ROOT: process.env.ROOT || '' }, url: base + 'app.html', reuseExistingServer: true },
});
