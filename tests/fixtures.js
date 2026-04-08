/**
 * Shared Playwright fixtures for Chrome extension testing.
 * Loads the extension in a persistent Chromium context.
 *
 * NOTE: True headless mode is NOT possible for Chrome extension e2e tests.
 * Chromium's --headless=new does not support --load-extension.
 * Instead, we launch the browser off-screen (-32000,-32000) so it never
 * appears visually or steals focus from the user's own browser.
 */
const path = require('path');
const { test: base, chromium } = require('@playwright/test');

const EXTENSION_PATH = path.resolve(__dirname, '..');

/**
 * Custom test fixture that launches Chromium with the extension loaded.
 * The browser window is positioned far off-screen so it is completely invisible
 * and does NOT interfere with any user-visible Chrome windows.
 */
const test = base.extend({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--no-first-run',
        '--disable-gpu',
        '--disable-default-apps',
        '--window-size=1280,720',
        '--window-position=-32000,-32000',
        '--start-minimized',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
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
