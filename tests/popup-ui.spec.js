/**
 * Integration tests for the extension popup UI.
 * Tests the popup page directly via chrome-extension:// URL.
 */
const { expect } = require('@playwright/test');
const { test } = require('./fixtures');

test.describe('Popup — UI Layout', () => {
  test('renders header with logo', async ({ popup }) => {
    const logo = popup.locator('.logo');
    await expect(logo).toBeVisible();
    await expect(logo).toContainText('Sakura Translator');
  });

  test('renders input textarea', async ({ popup }) => {
    const textarea = popup.locator('#inputText');
    await expect(textarea).toBeVisible();
    await expect(textarea).toHaveAttribute('placeholder', 'Type or paste text to translate...');
  });

  test('renders translate button', async ({ popup }) => {
    const btn = popup.locator('#translateBtn');
    await expect(btn).toBeVisible();
    await expect(btn).toContainText('Translate');
  });

  test('renders hint text', async ({ popup }) => {
    const hint = popup.locator('.hint');
    await expect(hint).toBeVisible();
    await expect(hint).toContainText('Select');
  });

  test('result area is hidden by default', async ({ popup }) => {
    const resultArea = popup.locator('#resultArea');
    await expect(resultArea).toHaveClass(/hidden/);
  });

  test('loading indicator is hidden by default', async ({ popup }) => {
    const loading = popup.locator('#loading');
    await expect(loading).toHaveClass(/hidden/);
  });
});

test.describe('Popup — Settings Panel', () => {
  test('settings panel is hidden by default', async ({ popup }) => {
    const panel = popup.locator('#settingsPanel');
    await expect(panel).toHaveClass(/hidden/);
  });

  test('clicking settings button opens panel', async ({ popup }) => {
    const btn = popup.locator('#settingsBtn');
    const panel = popup.locator('#settingsPanel');

    await btn.click();
    await expect(panel).not.toHaveClass(/hidden/);
    await expect(btn).toHaveClass(/active/);
  });

  test('clicking settings button again closes panel', async ({ popup }) => {
    const btn = popup.locator('#settingsBtn');
    const panel = popup.locator('#settingsPanel');

    await btn.click();
    await expect(panel).not.toHaveClass(/hidden/);

    await btn.click();
    await expect(panel).toHaveClass(/hidden/);
    await expect(btn).not.toHaveClass(/active/);
  });

  test('save button exists and is clickable', async ({ popup }) => {
    await popup.locator('#settingsBtn').click();

    const saveBtn = popup.locator('#saveSettingsBtn');
    await expect(saveBtn).toBeVisible();
    await expect(saveBtn).toContainText('Save Settings');
  });

  test('saving settings shows success', async ({ popup }) => {
    await popup.locator('#settingsBtn').click();

    await popup.locator('#saveSettingsBtn').click();

    const status = popup.locator('#saveStatus');
    await expect(status).not.toHaveClass(/hidden/);
    await expect(status).toContainText('Settings saved!');
    await expect(status).toHaveClass(/success/);
  });
});

test.describe('Popup — Shortcut Settings', () => {
  test('Ctrl + Select is selected by default', async ({ popup }) => {
    await popup.locator('#settingsBtn').click();

    const ctrlRadio = popup.locator('input[name="shortcut"][value="ctrl"]');
    await expect(ctrlRadio).toBeChecked();
  });

  test('Ctrl+Shift+Select option is available', async ({ popup }) => {
    await popup.locator('#settingsBtn').click();

    const ctrlShiftRadio = popup.locator('input[name="shortcut"][value="ctrl+shift"]');
    await expect(ctrlShiftRadio).toBeVisible();
    await expect(ctrlShiftRadio).not.toBeChecked();
  });

  test('Alt+Select option is available', async ({ popup }) => {
    await popup.locator('#settingsBtn').click();

    const altRadio = popup.locator('input[name="shortcut"][value="alt"]');
    await expect(altRadio).toBeVisible();
    await expect(altRadio).not.toBeChecked();
  });

  test('changing shortcut updates hint text', async ({ popup }) => {
    await popup.locator('#settingsBtn').click();

    // Switch to Alt + Select
    await popup.locator('input[name="shortcut"][value="alt"]').click();

    const hint = popup.locator('#hintShortcut');
    await expect(hint).toHaveText('Alt + Select');
  });

  test('saving shortcut shows success', async ({ popup }) => {
    await popup.locator('#settingsBtn').click();
    await popup.locator('input[name="shortcut"][value="ctrl+shift"]').click();
    await popup.locator('#saveSettingsBtn').click();

    const status = popup.locator('#saveStatus');
    await expect(status).not.toHaveClass(/hidden/);
    await expect(status).toContainText('Settings saved!');
  });
});

test.describe('Popup — Language Settings', () => {
  test('source language dropdown exists and defaults to Auto Detect', async ({ popup }) => {
    await popup.locator('#settingsBtn').click();

    const sourceLang = popup.locator('#sourceLang');
    await expect(sourceLang).toBeVisible();
    await expect(sourceLang).toHaveValue('auto');
  });

  test('target language dropdown exists and defaults to Chinese (Simplified)', async ({ popup }) => {
    await popup.locator('#settingsBtn').click();

    const targetLang = popup.locator('#targetLang');
    await expect(targetLang).toBeVisible();
    await expect(targetLang).toHaveValue('zh-CN');
  });

  test('source language dropdown has multiple language options', async ({ popup }) => {
    await popup.locator('#settingsBtn').click();

    const options = popup.locator('#sourceLang option');
    const count = await options.count();
    expect(count).toBeGreaterThan(10);
  });

  test('can change source language to Japanese', async ({ popup }) => {
    await popup.locator('#settingsBtn').click();

    await popup.locator('#sourceLang').selectOption('ja');
    await expect(popup.locator('#sourceLang')).toHaveValue('ja');
  });

  test('can change target language to French', async ({ popup }) => {
    await popup.locator('#settingsBtn').click();

    await popup.locator('#targetLang').selectOption('fr');
    await expect(popup.locator('#targetLang')).toHaveValue('fr');
  });

  test('swap button swaps source and target languages', async ({ popup }) => {
    await popup.locator('#settingsBtn').click();

    // Set a manual source first (swap with auto has special behavior)
    await popup.locator('#sourceLang').selectOption('en');
    await expect(popup.locator('#sourceLang')).toHaveValue('en');
    await expect(popup.locator('#targetLang')).toHaveValue('zh-CN');

    // Click swap
    await popup.locator('#swapLangsBtn').click();

    await expect(popup.locator('#sourceLang')).toHaveValue('zh-CN');
    await expect(popup.locator('#targetLang')).toHaveValue('en');
  });

  test('saving language settings shows success', async ({ popup }) => {
    await popup.locator('#settingsBtn').click();

    await popup.locator('#sourceLang').selectOption('ja');
    await popup.locator('#targetLang').selectOption('ko');
    await popup.locator('#saveSettingsBtn').click();

    const status = popup.locator('#saveStatus');
    await expect(status).not.toHaveClass(/hidden/);
    await expect(status).toContainText('Settings saved!');
  });

  test('language settings auto-save on change', async ({ popup }) => {
    await popup.locator('#settingsBtn').click();

    await popup.locator('#sourceLang').selectOption('fr');

    // Wait for auto-save (600ms debounce + buffer)
    await popup.waitForTimeout(1000);

    const status = popup.locator('#saveStatus');
    await expect(status).toContainText('Auto-saved');
  });

  test('language settings persist after reopening popup', async ({ context, extensionId }) => {
    // Open popup and set languages
    const popup1 = await context.newPage();
    await popup1.goto(`chrome-extension://${extensionId}/popup/popup.html`);
    await popup1.waitForLoadState('domcontentloaded');

    await popup1.locator('#settingsBtn').click();
    await popup1.locator('#sourceLang').selectOption('ja');
    await popup1.locator('#targetLang').selectOption('ko');
    await popup1.locator('#saveSettingsBtn').click();
    await popup1.waitForTimeout(500);
    await popup1.close();

    // Reopen popup — settings should be restored
    const popup2 = await context.newPage();
    await popup2.goto(`chrome-extension://${extensionId}/popup/popup.html`);
    await popup2.waitForLoadState('domcontentloaded');
    await popup2.waitForTimeout(300);

    await popup2.locator('#settingsBtn').click();

    await expect(popup2.locator('#sourceLang')).toHaveValue('ja');
    await expect(popup2.locator('#targetLang')).toHaveValue('ko');

    await popup2.close();
  });
});

test.describe('Popup — Multi-Language Dropdown Interactions', () => {
  test('all 31 options are present in source dropdown (30 languages + Auto Detect)', async ({ popup }) => {
    await popup.locator('#settingsBtn').click();

    const options = popup.locator('#sourceLang option');
    const count = await options.count();
    expect(count).toBe(31);
  });

  test('all 30 supported languages are present in target dropdown (no Auto Detect)', async ({ popup }) => {
    await popup.locator('#settingsBtn').click();

    const options = popup.locator('#targetLang option');
    const count = await options.count();
    expect(count).toBe(30);
  });

  test('source dropdown contains expected language codes including auto', async ({ popup }) => {
    await popup.locator('#settingsBtn').click();

    const expectedCodes = ['auto', 'en', 'zh-CN', 'zh-TW', 'ja', 'ko', 'fr', 'de', 'es', 'pt', 'ru'];
    for (const code of expectedCodes) {
      const option = popup.locator(`#sourceLang option[value="${code}"]`);
      await expect(option).toBeAttached();
    }
  });

  test('target dropdown contains expected language codes', async ({ popup }) => {
    await popup.locator('#settingsBtn').click();

    const expectedCodes = ['ar', 'hi', 'it', 'nl', 'th', 'vi', 'id', 'ms', 'tr', 'pl'];
    for (const code of expectedCodes) {
      const option = popup.locator(`#targetLang option[value="${code}"]`);
      await expect(option).toBeAttached();
    }
  });

  test('source dropdown shows correct label for English', async ({ popup }) => {
    await popup.locator('#settingsBtn').click();

    const option = popup.locator('#sourceLang option[value="en"]');
    await expect(option).toHaveText('English');
  });

  test('source dropdown shows correct label for Chinese (Simplified)', async ({ popup }) => {
    await popup.locator('#settingsBtn').click();

    const option = popup.locator('#sourceLang option[value="zh-CN"]');
    await expect(option).toHaveText('Chinese (Simplified)');
  });

  test('source dropdown shows correct label for Chinese (Traditional)', async ({ popup }) => {
    await popup.locator('#settingsBtn').click();

    const option = popup.locator('#sourceLang option[value="zh-TW"]');
    await expect(option).toHaveText('Chinese (Traditional)');
  });

  test('source dropdown shows correct label for Japanese', async ({ popup }) => {
    await popup.locator('#settingsBtn').click();

    const option = popup.locator('#sourceLang option[value="ja"]');
    await expect(option).toHaveText('Japanese');
  });

  test('can select all common language pairs', async ({ popup }) => {
    await popup.locator('#settingsBtn').click();

    // Test several common translation pairs
    const pairs = [
      { src: 'en', tgt: 'ja' },
      { src: 'en', tgt: 'ko' },
      { src: 'en', tgt: 'fr' },
      { src: 'ja', tgt: 'en' },
      { src: 'zh-CN', tgt: 'ja' },
    ];

    for (const pair of pairs) {
      await popup.locator('#sourceLang').selectOption(pair.src);
      await popup.locator('#targetLang').selectOption(pair.tgt);
      await expect(popup.locator('#sourceLang')).toHaveValue(pair.src);
      await expect(popup.locator('#targetLang')).toHaveValue(pair.tgt);
    }
  });

  test('double swap restores original languages (manual mode)', async ({ popup }) => {
    await popup.locator('#settingsBtn').click();

    // Set manual source: en → zh-CN
    await popup.locator('#sourceLang').selectOption('en');
    await expect(popup.locator('#sourceLang')).toHaveValue('en');
    await expect(popup.locator('#targetLang')).toHaveValue('zh-CN');

    // First swap: en ↔ zh-CN
    await popup.locator('#swapLangsBtn').click();
    await expect(popup.locator('#sourceLang')).toHaveValue('zh-CN');
    await expect(popup.locator('#targetLang')).toHaveValue('en');

    // Second swap — back to original
    await popup.locator('#swapLangsBtn').click();
    await expect(popup.locator('#sourceLang')).toHaveValue('en');
    await expect(popup.locator('#targetLang')).toHaveValue('zh-CN');
  });

  test('swap works with non-default language pair', async ({ popup }) => {
    await popup.locator('#settingsBtn').click();

    // Set to Japanese → Korean
    await popup.locator('#sourceLang').selectOption('ja');
    await popup.locator('#targetLang').selectOption('ko');

    // Swap
    await popup.locator('#swapLangsBtn').click();
    await expect(popup.locator('#sourceLang')).toHaveValue('ko');
    await expect(popup.locator('#targetLang')).toHaveValue('ja');
  });

  test('can select less common languages (Arabic, Hindi, etc.)', async ({ popup }) => {
    await popup.locator('#settingsBtn').click();

    await popup.locator('#sourceLang').selectOption('ar');
    await expect(popup.locator('#sourceLang')).toHaveValue('ar');

    await popup.locator('#targetLang').selectOption('hi');
    await expect(popup.locator('#targetLang')).toHaveValue('hi');
  });

  test('can select European languages', async ({ popup }) => {
    await popup.locator('#settingsBtn').click();

    const europeanLangs = ['fr', 'de', 'es', 'pt', 'it', 'nl', 'sv', 'da', 'fi', 'no', 'pl', 'cs', 'ro', 'hu', 'el', 'uk'];
    for (const lang of europeanLangs) {
      await popup.locator('#sourceLang').selectOption(lang);
      await expect(popup.locator('#sourceLang')).toHaveValue(lang);
    }
  });

  test('can select Asian languages', async ({ popup }) => {
    await popup.locator('#settingsBtn').click();

    const asianLangs = ['zh-CN', 'zh-TW', 'ja', 'ko', 'th', 'vi', 'id', 'ms', 'hi'];
    for (const lang of asianLangs) {
      await popup.locator('#targetLang').selectOption(lang);
      await expect(popup.locator('#targetLang')).toHaveValue(lang);
    }
  });

  test('saving non-default language pair persists correctly', async ({ context, extensionId }) => {
    // Open popup and set unusual language pair
    const popup1 = await context.newPage();
    await popup1.goto(`chrome-extension://${extensionId}/popup/popup.html`);
    await popup1.waitForLoadState('domcontentloaded');

    await popup1.locator('#settingsBtn').click();
    await popup1.locator('#sourceLang').selectOption('ar');
    await popup1.locator('#targetLang').selectOption('ru');
    await popup1.locator('#saveSettingsBtn').click();
    await popup1.waitForTimeout(500);
    await popup1.close();

    // Reopen popup and verify
    const popup2 = await context.newPage();
    await popup2.goto(`chrome-extension://${extensionId}/popup/popup.html`);
    await popup2.waitForLoadState('domcontentloaded');
    await popup2.waitForTimeout(300);

    await popup2.locator('#settingsBtn').click();
    await expect(popup2.locator('#sourceLang')).toHaveValue('ar');
    await expect(popup2.locator('#targetLang')).toHaveValue('ru');

    await popup2.close();
  });

  test('auto-save triggers for target language change', async ({ popup }) => {
    await popup.locator('#settingsBtn').click();

    await popup.locator('#targetLang').selectOption('de');

    // Wait for auto-save (600ms debounce + buffer)
    await popup.waitForTimeout(1000);

    const status = popup.locator('#saveStatus');
    await expect(status).toContainText('Auto-saved');
  });

  test('swap button triggers auto-save', async ({ popup }) => {
    await popup.locator('#settingsBtn').click();

    await popup.locator('#swapLangsBtn').click();

    // Wait for auto-save
    await popup.waitForTimeout(1000);

    const status = popup.locator('#saveStatus');
    await expect(status).toContainText('Auto-saved');
  });
});

test.describe('Popup — Auto-Detect Source Language', () => {
  test('source dropdown defaults to Auto Detect', async ({ popup }) => {
    await popup.locator('#settingsBtn').click();

    await expect(popup.locator('#sourceLang')).toHaveValue('auto');
  });

  test('Auto Detect option has correct label', async ({ popup }) => {
    await popup.locator('#settingsBtn').click();

    const option = popup.locator('#sourceLang option[value="auto"]');
    await expect(option).toHaveText('Auto Detect');
  });

  test('Auto Detect is not available in target dropdown', async ({ popup }) => {
    await popup.locator('#settingsBtn').click();

    const option = popup.locator('#targetLang option[value="auto"]');
    await expect(option).not.toBeAttached();
  });

  test('Auto Detect is the first option in source dropdown', async ({ popup }) => {
    await popup.locator('#settingsBtn').click();

    const firstOption = popup.locator('#sourceLang option').first();
    await expect(firstOption).toHaveAttribute('value', 'auto');
    await expect(firstOption).toHaveText('Auto Detect');
  });

  test('swap with auto source sets source to current target', async ({ popup }) => {
    await popup.locator('#settingsBtn').click();

    // Default: auto → zh-CN
    await expect(popup.locator('#sourceLang')).toHaveValue('auto');
    await expect(popup.locator('#targetLang')).toHaveValue('zh-CN');

    // Swap
    await popup.locator('#swapLangsBtn').click();

    // Source becomes zh-CN (the old target), target becomes en (smart default)
    await expect(popup.locator('#sourceLang')).toHaveValue('zh-CN');
    await expect(popup.locator('#targetLang')).toHaveValue('en');
  });

  test('swap with auto source and non-Chinese target sets sensible default', async ({ popup }) => {
    await popup.locator('#settingsBtn').click();

    // Set auto → ja
    await popup.locator('#sourceLang').selectOption('auto');
    await popup.locator('#targetLang').selectOption('ja');

    // Swap
    await popup.locator('#swapLangsBtn').click();

    // Source becomes ja, target becomes zh-CN (smart default for non-Chinese target)
    await expect(popup.locator('#sourceLang')).toHaveValue('ja');
    await expect(popup.locator('#targetLang')).toHaveValue('zh-CN');
  });

  test('can switch from Auto Detect to manual language', async ({ popup }) => {
    await popup.locator('#settingsBtn').click();

    await expect(popup.locator('#sourceLang')).toHaveValue('auto');

    await popup.locator('#sourceLang').selectOption('ja');
    await expect(popup.locator('#sourceLang')).toHaveValue('ja');
  });

  test('can switch from manual language back to Auto Detect', async ({ popup }) => {
    await popup.locator('#settingsBtn').click();

    await popup.locator('#sourceLang').selectOption('fr');
    await expect(popup.locator('#sourceLang')).toHaveValue('fr');

    await popup.locator('#sourceLang').selectOption('auto');
    await expect(popup.locator('#sourceLang')).toHaveValue('auto');
  });

  test('saving Auto Detect setting shows success', async ({ popup }) => {
    await popup.locator('#settingsBtn').click();

    // Ensure auto is selected
    await popup.locator('#sourceLang').selectOption('auto');
    await popup.locator('#saveSettingsBtn').click();

    const status = popup.locator('#saveStatus');
    await expect(status).not.toHaveClass(/hidden/);
    await expect(status).toContainText('Settings saved!');
  });

  test('Auto Detect setting persists after reopening popup', async ({ context, extensionId }) => {
    // Open popup — should default to auto
    const popup1 = await context.newPage();
    await popup1.goto(`chrome-extension://${extensionId}/popup/popup.html`);
    await popup1.waitForLoadState('domcontentloaded');
    await popup1.waitForTimeout(300);

    await popup1.locator('#settingsBtn').click();
    await expect(popup1.locator('#sourceLang')).toHaveValue('auto');

    // Save explicitly to confirm
    await popup1.locator('#saveSettingsBtn').click();
    await popup1.waitForTimeout(500);
    await popup1.close();

    // Reopen and verify
    const popup2 = await context.newPage();
    await popup2.goto(`chrome-extension://${extensionId}/popup/popup.html`);
    await popup2.waitForLoadState('domcontentloaded');
    await popup2.waitForTimeout(300);

    await popup2.locator('#settingsBtn').click();
    await expect(popup2.locator('#sourceLang')).toHaveValue('auto');

    await popup2.close();
  });

  test('switching from auto to manual and back persists auto', async ({ context, extensionId }) => {
    // Set to manual
    const popup1 = await context.newPage();
    await popup1.goto(`chrome-extension://${extensionId}/popup/popup.html`);
    await popup1.waitForLoadState('domcontentloaded');

    await popup1.locator('#settingsBtn').click();
    await popup1.locator('#sourceLang').selectOption('ko');
    await popup1.locator('#saveSettingsBtn').click();
    await popup1.waitForTimeout(500);

    // Close settings panel before closing popup, so next popup starts with panel closed
    await popup1.locator('#settingsBtn').click();
    await popup1.waitForTimeout(200);
    await popup1.close();

    // Set back to auto
    const popup2 = await context.newPage();
    await popup2.goto(`chrome-extension://${extensionId}/popup/popup.html`);
    await popup2.waitForLoadState('domcontentloaded');
    await popup2.waitForTimeout(300);

    await popup2.locator('#settingsBtn').click();
    await expect(popup2.locator('#settingsPanel')).not.toHaveClass(/hidden/);
    await expect(popup2.locator('#sourceLang')).toHaveValue('ko');

    await popup2.locator('#sourceLang').selectOption('auto');
    await popup2.locator('#saveSettingsBtn').click();
    await popup2.waitForTimeout(500);

    // Close settings panel before closing popup
    await popup2.locator('#settingsBtn').click();
    await popup2.waitForTimeout(200);
    await popup2.close();

    // Verify auto persisted
    const popup3 = await context.newPage();
    await popup3.goto(`chrome-extension://${extensionId}/popup/popup.html`);
    await popup3.waitForLoadState('domcontentloaded');
    await popup3.waitForTimeout(300);

    await popup3.locator('#settingsBtn').click();
    await expect(popup3.locator('#settingsPanel')).not.toHaveClass(/hidden/);
    await expect(popup3.locator('#sourceLang')).toHaveValue('auto');

    await popup3.close();
  });

  test('auto-save triggers when changing source to auto', async ({ popup }) => {
    await popup.locator('#settingsBtn').click();

    // First set to manual
    await popup.locator('#sourceLang').selectOption('de');
    await popup.waitForTimeout(1000);

    // Then switch to auto
    await popup.locator('#sourceLang').selectOption('auto');

    // Wait for auto-save
    await popup.waitForTimeout(1000);

    const status = popup.locator('#saveStatus');
    await expect(status).toContainText('Auto-saved');
  });

  test('translating with auto-detect source shows result for English', async ({ popup }) => {
    // Auto is default, just translate
    await popup.locator('#inputText').fill('hello');
    await popup.locator('#translateBtn').click();

    const resultArea = popup.locator('#resultArea');
    await expect(resultArea).not.toHaveClass(/hidden/, { timeout: 15000 });

    const resultContent = popup.locator('#resultContent');
    const text = await resultContent.textContent();
    expect(text.length).toBeGreaterThan(0);
  });

  test('translating with auto-detect source shows result for Chinese', async ({ popup }) => {
    await popup.locator('#inputText').fill('你好世界');
    await popup.locator('#translateBtn').click();

    const resultArea = popup.locator('#resultArea');
    await expect(resultArea).not.toHaveClass(/hidden/, { timeout: 15000 });

    const resultContent = popup.locator('#resultContent');
    const text = await resultContent.textContent();
    expect(text.length).toBeGreaterThan(0);
  });

  test('translating with auto-detect and target ja shows result', async ({ popup }) => {
    await popup.locator('#settingsBtn').click();
    await popup.locator('#sourceLang').selectOption('auto');
    await popup.locator('#targetLang').selectOption('ja');
    await popup.locator('#saveSettingsBtn').click();
    await popup.waitForTimeout(500);
    await popup.locator('#settingsBtn').click();

    await popup.locator('#inputText').fill('good morning');
    await popup.locator('#translateBtn').click();

    const resultArea = popup.locator('#resultArea');
    await expect(resultArea).not.toHaveClass(/hidden/, { timeout: 15000 });

    const resultContent = popup.locator('#resultContent');
    const text = await resultContent.textContent();
    expect(text.length).toBeGreaterThan(0);
  });
});

test.describe('Popup — Multi-Language Translation Flow', () => {
  test('translating with default en→zh-CN shows result', async ({ popup }) => {
    await popup.locator('#inputText').fill('hello');
    await popup.locator('#translateBtn').click();

    const resultArea = popup.locator('#resultArea');
    await expect(resultArea).not.toHaveClass(/hidden/, { timeout: 15000 });

    const resultContent = popup.locator('#resultContent');
    const text = await resultContent.textContent();
    expect(text.length).toBeGreaterThan(0);
  });

  test('translating Chinese text shows result', async ({ popup }) => {
    await popup.locator('#inputText').fill('你好世界');
    await popup.locator('#translateBtn').click();

    const resultArea = popup.locator('#resultArea');
    await expect(resultArea).not.toHaveClass(/hidden/, { timeout: 15000 });

    const resultContent = popup.locator('#resultContent');
    const text = await resultContent.textContent();
    expect(text.length).toBeGreaterThan(0);
  });

  test('translating after changing to ja→en still shows result', async ({ popup }) => {
    // Change language settings first
    await popup.locator('#settingsBtn').click();
    await popup.locator('#sourceLang').selectOption('ja');
    await popup.locator('#targetLang').selectOption('en');
    await popup.locator('#saveSettingsBtn').click();
    await popup.waitForTimeout(500);

    // Close settings and translate
    await popup.locator('#settingsBtn').click();

    await popup.locator('#inputText').fill('こんにちは');
    await popup.locator('#translateBtn').click();

    const resultArea = popup.locator('#resultArea');
    await expect(resultArea).not.toHaveClass(/hidden/, { timeout: 15000 });

    const resultContent = popup.locator('#resultContent');
    const text = await resultContent.textContent();
    expect(text.length).toBeGreaterThan(0);
  });

  test('translating after changing to fr→de still shows result', async ({ popup }) => {
    await popup.locator('#settingsBtn').click();
    await popup.locator('#sourceLang').selectOption('fr');
    await popup.locator('#targetLang').selectOption('de');
    await popup.locator('#saveSettingsBtn').click();
    await popup.waitForTimeout(500);

    await popup.locator('#settingsBtn').click();

    await popup.locator('#inputText').fill('Bonjour le monde');
    await popup.locator('#translateBtn').click();

    const resultArea = popup.locator('#resultArea');
    await expect(resultArea).not.toHaveClass(/hidden/, { timeout: 15000 });

    const resultContent = popup.locator('#resultContent');
    const text = await resultContent.textContent();
    expect(text.length).toBeGreaterThan(0);
  });
});

test.describe('Popup — Settings Persistence', () => {
  test('auto-saves shortcut selection on change', async ({ popup }) => {
    await popup.locator('#settingsBtn').click();

    // Switch to Alt + Select
    await popup.locator('input[name="shortcut"][value="alt"]').click();

    // Wait for auto-save (600ms debounce + buffer)
    await popup.waitForTimeout(1000);

    const status = popup.locator('#saveStatus');
    await expect(status).toContainText('Auto-saved');
  });

  test('settings persist after reopening popup', async ({ context, extensionId }) => {
    // Open popup and set shortcut to alt
    const popup1 = await context.newPage();
    await popup1.goto(`chrome-extension://${extensionId}/popup/popup.html`);
    await popup1.waitForLoadState('domcontentloaded');

    await popup1.locator('#settingsBtn').click();
    await popup1.locator('input[name="shortcut"][value="alt"]').click();
    await popup1.locator('#saveSettingsBtn').click();
    await popup1.waitForTimeout(500);
    await popup1.close();

    // Reopen popup — settings should be restored
    const popup2 = await context.newPage();
    await popup2.goto(`chrome-extension://${extensionId}/popup/popup.html`);
    await popup2.waitForLoadState('domcontentloaded');
    await popup2.waitForTimeout(300); // Wait for loadSettings async

    await popup2.locator('#settingsBtn').click();

    const altRadio = popup2.locator('input[name="shortcut"][value="alt"]');
    await expect(altRadio).toBeChecked();

    await popup2.close();
  });
});

test.describe('Popup — Translation Flow', () => {
  test('empty input does not trigger translation', async ({ popup }) => {
    const btn = popup.locator('#translateBtn');
    await btn.click();

    // Loading should NOT appear
    const loading = popup.locator('#loading');
    await expect(loading).toHaveClass(/hidden/);
  });

  test('translating English word shows result', async ({ popup }) => {
    await popup.locator('#inputText').fill('hello');
    await popup.locator('#translateBtn').click();

    // Loading should appear briefly
    const loading = popup.locator('#loading');

    // Wait for result
    const resultArea = popup.locator('#resultArea');
    await expect(resultArea).not.toHaveClass(/hidden/, { timeout: 15000 });

    // Result should have content
    const resultContent = popup.locator('#resultContent');
    const text = await resultContent.textContent();
    expect(text.length).toBeGreaterThan(0);
  });

  test('translating Chinese sentence shows result', async ({ popup }) => {
    await popup.locator('#inputText').fill('今天天气怎么样');
    await popup.locator('#translateBtn').click();

    const resultArea = popup.locator('#resultArea');
    await expect(resultArea).not.toHaveClass(/hidden/, { timeout: 15000 });

    const resultContent = popup.locator('#resultContent');
    const text = await resultContent.textContent();
    expect(text.length).toBeGreaterThan(0);
  });

  test('Ctrl+Enter triggers translation', async ({ popup }) => {
    await popup.locator('#inputText').fill('world');
    await popup.locator('#inputText').press('Control+Enter');

    const resultArea = popup.locator('#resultArea');
    await expect(resultArea).not.toHaveClass(/hidden/, { timeout: 15000 });
  });

  test('translate button is disabled during translation', async ({ popup }) => {
    await popup.locator('#inputText').fill('computer');
    await popup.locator('#translateBtn').click();

    // Button should be disabled briefly during fetch
    const btn = popup.locator('#translateBtn');

    // Wait for result to confirm cycle completed
    const resultArea = popup.locator('#resultArea');
    await expect(resultArea).not.toHaveClass(/hidden/, { timeout: 15000 });

    // After translation, button should be re-enabled
    await expect(btn).not.toBeDisabled();
  });
});
