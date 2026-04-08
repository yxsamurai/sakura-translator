// @ts-check
const { defineConfig } = require('@playwright/test');
const path = require('path');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30000,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    headless: false,
    viewport: { width: 1280, height: 720 },
    actionTimeout: 10000,
  },
  projects: [
    {
      name: 'unit',
      testMatch: /\.(unit)\.spec\.js$/,
      use: {
        headless: true,
      },
    },
    {
      name: 'extension',
      testMatch: /^(?!.*\.unit\.).*\.spec\.js$/,
      use: {
        // True headless is NOT possible for extension tests (Chromium limitation:
        // --load-extension is unsupported in headless mode).
        // Instead, fixtures.js launches the browser off-screen (-32000,-32000)
        // so it never appears visually or interferes with the user's browser.
        headless: false,
      },
    },
  ],
});
