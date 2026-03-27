/**
 * Shared Playwright fixtures for Chrome extension testing.
 * Loads the extension in a persistent Chromium context.
 */
const path = require('path');
const { test: base, chromium } = require('@playwright/test');

const EXTENSION_PATH = path.resolve(__dirname, '..');

/**
 * Custom test fixture that launches Chromium with the extension loaded.
 */
const test = base.extend({
  // Provide a browser context with the extension loaded
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--no-first-run',
        '--disable-gpu',
        '--disable-default-apps',
      ],
    });
    await use(context);
    await context.close();
  },

  // Helper to get the extension ID
  extensionId: async ({ context }, use) => {
    // In MV3, the service worker URL contains the extension ID
    let [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent('serviceworker');
    }
    const extensionId = background.url().split('/')[2];
    await use(extensionId);
  },

  // Helper to open the popup page
  popup: async ({ context, extensionId }, use) => {
    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup/popup.html`);
    await popupPage.waitForLoadState('domcontentloaded');
    await use(popupPage);
    await popupPage.close();
  },
});

module.exports = { test };
