/**
 * Integration tests for the extension popup UI.
 */
const { expect } = require('@playwright/test');
const { test } = require('./fixtures');

test.describe('Popup — Layout', () => {
  test('renders header with logo', async ({ popup }) => {
    await expect(popup.locator('.logo')).toContainText('Sakura Translator');
  });

  test('renders input textarea and translate button', async ({ popup }) => {
    await expect(popup.locator('#inputText')).toBeVisible();
    await expect(popup.locator('#translateBtn')).toContainText('Translate');
  });

  test('result area and loading are hidden by default', async ({ popup }) => {
    await expect(popup.locator('#resultArea')).toHaveClass(/hidden/);
    await expect(popup.locator('#loading')).toHaveClass(/hidden/);
  });
});

test.describe('Popup — Settings Panel', () => {
  test('settings panel opens and closes on toggle', async ({ popup }) => {
    const btn = popup.locator('#settingsBtn');
    const panel = popup.locator('#settingsPanel');
    await btn.click();
    await expect(panel).not.toHaveClass(/hidden/);
    await expect(btn).toHaveClass(/active/);
    await btn.click();
    await expect(panel).toHaveClass(/hidden/);
  });

  test('no save button or status indicator (silent auto-save)', async ({ popup }) => {
    await popup.locator('#settingsBtn').click();
    await expect(popup.locator('#saveSettingsBtn')).toHaveCount(0);
    await expect(popup.locator('#saveStatus')).toHaveCount(0);
  });
});

test.describe('Popup — Mode Tabs', () => {
  test('hover mode is active by default, can switch to manual', async ({ popup }) => {
    await popup.locator('#settingsBtn').click();
    await expect(popup.locator('#modeTabHover')).toHaveClass(/active/);
    await expect(popup.locator('#hoverOptions')).not.toHaveClass(/hidden/);

    await popup.locator('#modeTabManual').click();
    await expect(popup.locator('#modeTabManual')).toHaveClass(/active/);
    await expect(popup.locator('#manualOptions')).not.toHaveClass(/hidden/);
    await expect(popup.locator('#hoverOptions')).toHaveClass(/hidden/);
  });
});

test.describe('Popup — Hover Key Settings', () => {
  test('default keys are Ctrl (word) and Alt (sentence)', async ({ popup }) => {
    await popup.locator('#settingsBtn').click();
    await expect(popup.locator('#hoverWordKey')).toHaveValue('ctrl');
    await expect(popup.locator('#hoverSentenceKey')).toHaveValue('alt');
  });

  test('changing word key auto-swaps sentence key to avoid conflict', async ({ popup }) => {
    await popup.locator('#settingsBtn').click();
    await popup.locator('#hoverWordKey').selectOption('alt');
    await expect(popup.locator('#hoverWordKey')).toHaveValue('alt');
    await expect(popup.locator('#hoverSentenceKey')).not.toHaveValue('alt');
  });
});

test.describe('Popup — Manual Key Settings', () => {
  test('default manual key is Ctrl, can change', async ({ popup }) => {
    await popup.locator('#settingsBtn').click();
    await popup.locator('#modeTabManual').click();
    await expect(popup.locator('#manualKey')).toHaveValue('ctrl');
    await popup.locator('#manualKey').selectOption('alt');
    await expect(popup.locator('#manualKey')).toHaveValue('alt');
  });

  test('manual key has 4 options', async ({ popup }) => {
    await popup.locator('#settingsBtn').click();
    await popup.locator('#modeTabManual').click();
    expect(await popup.locator('#manualKey option').count()).toBe(4);
  });
});

test.describe('Popup — Hint Text', () => {
  test('hint shows hover mode text by default', async ({ popup }) => {
    await expect(popup.locator('.hint')).toContainText('hover');
  });

  test('changing mode updates hint text', async ({ popup }) => {
    await popup.locator('#settingsBtn').click();
    await popup.locator('#modeTabManual').click();
    await expect(popup.locator('.hint')).toContainText('Select');
  });
});

test.describe('Popup — Language Settings', () => {
  test('defaults to Auto Detect → Chinese (Simplified)', async ({ popup }) => {
    await popup.locator('#settingsBtn').click();
    await expect(popup.locator('#sourceLang')).toHaveValue('auto');
    await expect(popup.locator('#targetLang')).toHaveValue('zh-CN');
  });

  test('source dropdown has 31 options, target has 30', async ({ popup }) => {
    await popup.locator('#settingsBtn').click();
    expect(await popup.locator('#sourceLang option').count()).toBe(31);
    expect(await popup.locator('#targetLang option').count()).toBe(30);
  });

  test('Auto Detect is first in source but not in target', async ({ popup }) => {
    await popup.locator('#settingsBtn').click();
    await expect(popup.locator('#sourceLang option').first()).toHaveAttribute('value', 'auto');
    await expect(popup.locator('#targetLang option[value="auto"]')).not.toBeAttached();
  });

  test('can change source and target languages', async ({ popup }) => {
    await popup.locator('#settingsBtn').click();
    await popup.locator('#sourceLang').selectOption('ja');
    await expect(popup.locator('#sourceLang')).toHaveValue('ja');
    await popup.locator('#targetLang').selectOption('fr');
    await expect(popup.locator('#targetLang')).toHaveValue('fr');
  });

  test('swap button swaps source and target', async ({ popup }) => {
    await popup.locator('#settingsBtn').click();
    await popup.locator('#sourceLang').selectOption('en');
    await expect(popup.locator('#sourceLang')).toHaveValue('en');
    await expect(popup.locator('#targetLang')).toHaveValue('zh-CN');
    await popup.locator('#swapLangsBtn').click();
    await expect(popup.locator('#sourceLang')).toHaveValue('zh-CN');
    await expect(popup.locator('#targetLang')).toHaveValue('en');
  });

  test('double swap restores original', async ({ popup }) => {
    await popup.locator('#settingsBtn').click();
    await popup.locator('#sourceLang').selectOption('en');
    await popup.locator('#swapLangsBtn').click();
    await popup.locator('#swapLangsBtn').click();
    await expect(popup.locator('#sourceLang')).toHaveValue('en');
    await expect(popup.locator('#targetLang')).toHaveValue('zh-CN');
  });

  test('swap with auto source sets source to current target', async ({ popup }) => {
    await popup.locator('#settingsBtn').click();
    await expect(popup.locator('#sourceLang')).toHaveValue('auto');
    await expect(popup.locator('#targetLang')).toHaveValue('zh-CN');
    await popup.locator('#swapLangsBtn').click();
    await expect(popup.locator('#sourceLang')).toHaveValue('zh-CN');
    await expect(popup.locator('#targetLang')).toHaveValue('en');
  });
});

test.describe('Popup — Settings Persistence', () => {
  test('settings persist after reopening popup', async ({ context, extensionId }) => {
    const p1 = await context.newPage();
    await p1.goto(`chrome-extension://${extensionId}/popup/popup.html`);
    await p1.waitForLoadState('domcontentloaded');
    await p1.locator('#settingsBtn').click();
    await p1.locator('#modeTabManual').click();
    await p1.locator('#manualKey').selectOption('alt');
    await p1.locator('#sourceLang').selectOption('ja');
    await p1.locator('#targetLang').selectOption('ko');
    await p1.waitForTimeout(1000);
    await p1.close();

    const p2 = await context.newPage();
    await p2.goto(`chrome-extension://${extensionId}/popup/popup.html`);
    await p2.waitForLoadState('domcontentloaded');
    await p2.waitForTimeout(300);
    await p2.locator('#settingsBtn').click();
    await expect(p2.locator('#modeTabManual')).toHaveClass(/active/);
    await expect(p2.locator('#manualKey')).toHaveValue('alt');
    await expect(p2.locator('#sourceLang')).toHaveValue('ja');
    await expect(p2.locator('#targetLang')).toHaveValue('ko');
    await p2.close();
  });
});

test.describe('Popup — Translation Flow', () => {
  test('empty input does not trigger translation', async ({ popup }) => {
    await popup.locator('#translateBtn').click();
    await expect(popup.locator('#loading')).toHaveClass(/hidden/);
  });

  test('English word shows result', async ({ popup }) => {
    await popup.locator('#inputText').fill('hello');
    await popup.locator('#translateBtn').click();
    await expect(popup.locator('#resultArea')).not.toHaveClass(/hidden/, { timeout: 15000 });
    expect((await popup.locator('#resultContent').textContent()).length).toBeGreaterThan(0);
  });

  test('Chinese sentence shows result', async ({ popup }) => {
    await popup.locator('#inputText').fill('今天天气怎么样');
    await popup.locator('#translateBtn').click();
    await expect(popup.locator('#resultArea')).not.toHaveClass(/hidden/, { timeout: 15000 });
  });

  test('Ctrl+Enter triggers translation', async ({ popup }) => {
    await popup.locator('#inputText').fill('world');
    await popup.locator('#inputText').press('Control+Enter');
    await expect(popup.locator('#resultArea')).not.toHaveClass(/hidden/, { timeout: 15000 });
  });
});
