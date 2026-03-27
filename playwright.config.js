// @ts-check
const { defineConfig } = require('@playwright/test');
const path = require('path');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30000,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    headless: false, // Extensions require headed mode
    viewport: { width: 1280, height: 720 },
    actionTimeout: 10000,
  },
  projects: [
    {
      name: 'unit',
      testMatch: /\.(unit)\.spec\.js$/,
      use: {
        // Unit tests don't need a browser with extension
        headless: true,
      },
    },
    {
      name: 'extension',
      testMatch: /^(?!.*\.unit\.).*\.spec\.js$/,
      use: {
        headless: false,
      },
    },
  ],
});
