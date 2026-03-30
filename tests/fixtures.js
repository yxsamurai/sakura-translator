/**
 * Shared Playwright fixtures for Chrome extension testing.
 * Loads the extension in a persistent Chromium context.
 */
const path = require('path');
const { test: base, chromium } = require('@playwright/test');
const { execSync } = require('child_process');

const EXTENSION_PATH = path.resolve(__dirname, '..');

/**
 * Minimize all Chromium windows via PowerShell so they don't pop up.
 * Uses Win32 API ShowWindow(SW_MINIMIZE) — no focus stealing.
 */
function minimizeChromiumWindows() {
  try {
    execSync(
      'powershell -Command "Add-Type -MemberDefinition \'[DllImport(\\\"user32.dll\\\")]public static extern bool ShowWindow(IntPtr hWnd,int nCmdShow);\' -Name Win32 -Namespace Native;Get-Process chrome -ErrorAction SilentlyContinue | ForEach-Object { [Native.Win32]::ShowWindow($_.MainWindowHandle, 6) }"',
      { stdio: 'ignore', timeout: 5000 }
    );
  } catch (e) {
    // Silently ignore — if minimization fails, tests still work
  }
}

/**
 * Custom test fixture that launches Chromium with the extension loaded.
 * The window is minimized immediately after launch to avoid visual disruption.
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
      ],
    });

    // Minimize the window immediately so it doesn't pop up and steal focus
    minimizeChromiumWindows();

    await use(context);
    await context.close();
  },
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
