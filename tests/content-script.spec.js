/**
 * Integration tests for the content script behavior.
 * Tests popup rendering, dismissal, word/sentence display, settings, and shortcuts.
 *
 * Chrome extension content scripts injection with Playwright's persistent context
 * can be unreliable. We inject scripts manually and mock chrome.runtime.sendMessage.
 */
const { test: base, chromium, expect } = require('@playwright/test');
const http = require('http');
const fs = require('fs');
const path = require('path');

const EXTENSION_PATH = path.resolve(__dirname, '..');

const detectorJS = fs.readFileSync(path.join(EXTENSION_PATH, 'utils', 'detector.js'), 'utf-8');
const translatorJS = fs.readFileSync(path.join(EXTENSION_PATH, 'utils', 'translator.js'), 'utf-8');
const contentJS = fs.readFileSync(path.join(EXTENSION_PATH, 'content', 'content.js'), 'utf-8');
const contentCSS = fs.readFileSync(path.join(EXTENSION_PATH, 'content', 'content.css'), 'utf-8');

const TEST_HTML = `
<!DOCTYPE html>
<html>
<head><title>Sakura Test</title><style>${contentCSS}</style></head>
<body style="padding: 50px; font-size: 18px; line-height: 2;">
  <p id="english-word" style="margin-bottom: 30px;">hello</p>
  <p id="english-sentence" style="margin-bottom: 30px;">The quick brown fox jumps over the lazy dog</p>
  <p id="chinese-word" style="margin-bottom: 30px;">计算机</p>
  <p id="chinese-sentence" style="margin-bottom: 30px;">今天天气很好我想出去走走看看风景</p>
</body>
</html>`;

const MOCK_WORD = {
  type: 'word', original: 'hello', translation: '你好',
  phonetic: '/həˈloʊ/', phonetics: [],
  meanings: [
    { partOfSpeech: 'exclamation', definitions: [{ definition: '你好!' }] },
    { partOfSpeech: 'noun', definitions: [{ definition: '招呼' }] }
  ],
  definitions: [
    { partOfSpeech: 'exclamation', definitions: [{ definition: 'used as a greeting', example: 'hello there!' }] },
    { partOfSpeech: 'noun', definitions: [{ definition: 'a greeting', example: 'she said hello' }] }
  ],
  examples: ['hello there!', 'she said hello'],
  lang: 'en'
};

const MOCK_SENTENCE = {
  type: 'sentence', original: 'The quick brown fox jumps over the lazy dog',
  translation: '敏捷的棕色狐狸跳过了那只懒狗', lang: 'en'
};

const MOCK_CHINESE_WORD = { type: 'word', original: '计算机', translation: 'computer', phonetic: '', phonetics: [], meanings: [], lang: 'zh' };
const MOCK_CHINESE_SENTENCE = { type: 'sentence', original: '今天天气很好我想出去走走看看风景', translation: 'The weather is nice today and I want to go out for a walk and see the scenery', lang: 'zh' };

const test = base.extend({
  testServer: [async ({}, use) => {
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(TEST_HTML);
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    await use({ url: `http://127.0.0.1:${server.address().port}` });
    server.close();
  }, { scope: 'worker' }],

  testPage: async ({ page, testServer }, use) => {
    await page.goto(testServer.url, { waitUntil: 'load' });

    await page.evaluate((mocks) => {
      const syncStorage = { selectionMode: 'hover', hoverWordKey: 'ctrl', hoverSentenceKey: 'alt', manualKey: 'ctrl', sourceLang: 'auto', targetLang: 'zh-CN' };
      const changeListeners = [];
      window.chrome = {
        runtime: {
          sendMessage: (msg, callback) => {
            setTimeout(() => {
              if (msg.action === 'translate') {
                if (msg.type === 'word' && msg.lang === 'en') callback(mocks.word);
                else if (msg.type === 'sentence' && msg.lang === 'en') callback(mocks.sentence);
                else if (msg.type === 'word' && msg.lang === 'zh') callback(mocks.chineseWord);
                else callback(mocks.chineseSentence);
              }
            }, 100);
          },
          lastError: null,
        },
        storage: {
          sync: {
            get: (defaults, cb) => {
              const r = {};
              for (const k in defaults) r[k] = syncStorage[k] !== undefined ? syncStorage[k] : defaults[k];
              cb(r);
            },
            set: (items, cb) => {
              const changes = {};
              for (const k in items) { changes[k] = { oldValue: syncStorage[k], newValue: items[k] }; syncStorage[k] = items[k]; }
              changeListeners.forEach(fn => fn(changes, 'sync'));
              if (cb) cb();
            },
          },
          onChanged: { addListener: (fn) => { changeListeners.push(fn); } },
        },
      };
    }, { word: MOCK_WORD, sentence: MOCK_SENTENCE, chineseWord: MOCK_CHINESE_WORD, chineseSentence: MOCK_CHINESE_SENTENCE });

    await page.addScriptTag({ content: detectorJS });
    await page.addScriptTag({ content: translatorJS });
    await page.addScriptTag({ content: contentJS });
    await use(page);
  },
});

// ─── Helpers ───

async function ctrlSelectElement(page, selector) {
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    const range = document.createRange();
    range.selectNodeContents(el);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Control', code: 'ControlLeft', ctrlKey: true, bubbles: true }));
    const rect = el.getBoundingClientRect();
    document.dispatchEvent(new MouseEvent('mouseup', { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2, ctrlKey: true, bubbles: true }));
  }, selector);
  await page.waitForTimeout(150);
  await page.evaluate(() => {
    document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Control', code: 'ControlLeft', ctrlKey: false, bubbles: true }));
  });
}

async function selectThenHotkey(page, selector) {
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    const range = document.createRange();
    range.selectNodeContents(el);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }, selector);
  await page.waitForTimeout(100);
  await page.evaluate(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Control', code: 'ControlLeft', ctrlKey: true, bubbles: true }));
  });
  await page.waitForTimeout(150);
  await page.evaluate(() => {
    document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Control', code: 'ControlLeft', ctrlKey: false, bubbles: true }));
  });
}

// ─── Injection ───

test.describe('Injection', () => {
  test('modules are available after injection', async ({ testPage }) => {
    expect(await testPage.evaluate(() => typeof SakuraDetector !== 'undefined')).toBe(true);
    expect(await testPage.evaluate(() => typeof SakuraTranslator !== 'undefined')).toBe(true);
  });
});

// ─── Popup Rendering ───

test.describe('Popup Appearance', () => {
  test('Ctrl+Select on English word shows popup', async ({ testPage }) => {
    await ctrlSelectElement(testPage, '#english-word');
    await expect(testPage.locator('#sakura-translator-root')).toBeAttached({ timeout: 5000 });
    await expect(testPage.locator('.sakura-brand')).toBeAttached({ timeout: 5000 });
  });

  test('Ctrl+Select on Chinese word shows popup', async ({ testPage }) => {
    await ctrlSelectElement(testPage, '#chinese-word');
    await expect(testPage.locator('#sakura-translator-root')).toBeAttached({ timeout: 5000 });
  });

  test('popup has white background (light mode)', async ({ testPage }) => {
    await ctrlSelectElement(testPage, '#english-word');
    await expect(testPage.locator('.sakura-brand')).toBeAttached({ timeout: 5000 });
    const bg = await testPage.evaluate(() => {
      const root = document.querySelector('#sakura-translator-root');
      return window.getComputedStyle(root.shadowRoot.querySelector('.sakura-popup')).backgroundColor;
    });
    expect(bg).toBe('rgb(255, 255, 255)');
  });

  test('popup has dark background in dark mode', async ({ page, testServer }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto(testServer.url, { waitUntil: 'load' });
    await page.evaluate((mocks) => {
      const syncStorage = { selectionMode: 'hover', hoverWordKey: 'ctrl', hoverSentenceKey: 'alt', manualKey: 'ctrl', sourceLang: 'auto', targetLang: 'zh-CN' };
      const changeListeners = [];
      window.chrome = {
        runtime: { sendMessage: (msg, cb) => { setTimeout(() => { if (msg.action === 'translate') cb(mocks.word); }, 100); }, lastError: null },
        storage: { sync: { get: (d, cb) => { const r = {}; for (const k in d) r[k] = syncStorage[k] !== undefined ? syncStorage[k] : d[k]; cb(r); }, set: (i, cb) => { if (cb) cb(); } }, onChanged: { addListener: () => {} } },
      };
    }, { word: MOCK_WORD });
    await page.addScriptTag({ content: detectorJS });
    await page.addScriptTag({ content: translatorJS });
    await page.addScriptTag({ content: contentJS });
    await ctrlSelectElement(page, '#english-word');
    await expect(page.locator('.sakura-brand')).toBeAttached({ timeout: 5000 });
    const bg = await page.evaluate(() => {
      const root = document.querySelector('#sakura-translator-root');
      return window.getComputedStyle(root.shadowRoot.querySelector('.sakura-popup')).backgroundColor;
    });
    expect(bg).toBe('rgb(30, 30, 46)');
  });

  test('shadow DOM isolates popup from host page CSS', async ({ testPage }) => {
    await testPage.evaluate(() => {
      const style = document.createElement('style');
      style.textContent = 'div { background-color: red !important; }';
      document.head.appendChild(style);
    });
    await ctrlSelectElement(testPage, '#english-word');
    await expect(testPage.locator('.sakura-brand')).toBeAttached({ timeout: 5000 });
    const bg = await testPage.evaluate(() => {
      const root = document.querySelector('#sakura-translator-root');
      return window.getComputedStyle(root.shadowRoot.querySelector('.sakura-popup')).backgroundColor;
    });
    expect(bg).toBe('rgb(255, 255, 255)');
  });
});

// ─── No Popup Without Hotkey ───

test.describe('No Popup Without Hotkey', () => {
  test('selecting text without Ctrl does NOT show popup', async ({ testPage }) => {
    await testPage.evaluate(() => {
      const el = document.querySelector('#english-word');
      const range = document.createRange();
      range.selectNodeContents(el);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
      document.dispatchEvent(new MouseEvent('mouseup', { clientX: 100, clientY: 100, ctrlKey: false, bubbles: true }));
    });
    await testPage.waitForTimeout(1000);
    await expect(testPage.locator('#sakura-translator-root')).not.toBeAttached();
  });
});

// ─── Dismissal ───

test.describe('Popup Dismissal', () => {
  test('Escape closes the popup', async ({ testPage }) => {
    await ctrlSelectElement(testPage, '#english-word');
    await expect(testPage.locator('#sakura-translator-root')).toBeAttached({ timeout: 5000 });
    await testPage.evaluate(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
    });
    await expect(testPage.locator('#sakura-translator-root')).not.toBeAttached({ timeout: 3000 });
  });

  test('clicking outside closes the popup', async ({ testPage }) => {
    await ctrlSelectElement(testPage, '#english-word');
    await expect(testPage.locator('#sakura-translator-root')).toBeAttached({ timeout: 5000 });
    await testPage.evaluate(() => {
      document.dispatchEvent(new MouseEvent('mousedown', { clientX: 5, clientY: 5, bubbles: true }));
    });
    await expect(testPage.locator('#sakura-translator-root')).not.toBeAttached({ timeout: 3000 });
  });
});

// ─── Word vs Sentence Rendering ───

test.describe('Content Rendering', () => {
  test('English word shows header, phonetic, translation, meanings', async ({ testPage }) => {
    await ctrlSelectElement(testPage, '#english-word');
    await expect(testPage.locator('.sakura-brand')).toBeAttached({ timeout: 5000 });
    await expect(testPage.locator('.sakura-original')).toHaveText('hello');
    await expect(testPage.locator('.sakura-phonetic')).toHaveText('/həˈloʊ/');
    await expect(testPage.locator('.sakura-translation-text')).toHaveText('你好');
    await expect(testPage.locator('.sakura-meaning-pos').first()).toContainText('感叹词');
    await expect(testPage.locator('.sakura-def-text').first()).toContainText('used as a greeting');
  });

  test('English sentence shows sentence-style result', async ({ testPage }) => {
    await ctrlSelectElement(testPage, '#english-sentence');
    await expect(testPage.locator('.sakura-brand')).toBeAttached({ timeout: 5000 });
    await expect(testPage.locator('.sakura-sentence')).toBeAttached();
    await expect(testPage.locator('.sakura-sentence-translation')).toContainText('敏捷的棕色狐狸');
  });

  test('Chinese word shows translation', async ({ testPage }) => {
    await ctrlSelectElement(testPage, '#chinese-word');
    await expect(testPage.locator('.sakura-brand')).toBeAttached({ timeout: 5000 });
    await expect(testPage.locator('.sakura-original')).toHaveText('计算机');
    await expect(testPage.locator('.sakura-translation-text')).toHaveText('computer');
  });

  test('Chinese sentence shows sentence-style result', async ({ testPage }) => {
    await ctrlSelectElement(testPage, '#chinese-sentence');
    await expect(testPage.locator('.sakura-brand')).toBeAttached({ timeout: 5000 });
    await expect(testPage.locator('.sakura-sentence-translation')).toContainText('weather is nice');
  });

  test('selecting new text replaces previous popup', async ({ testPage }) => {
    await ctrlSelectElement(testPage, '#english-word');
    await expect(testPage.locator('.sakura-original')).toHaveText('hello', { timeout: 5000 });
    await ctrlSelectElement(testPage, '#chinese-word');
    await expect(testPage.locator('.sakura-original')).toHaveText('计算机', { timeout: 5000 });
    expect(await testPage.locator('#sakura-translator-root').count()).toBe(1);
  });
});

// ─── Workflow 2: Select Then Hotkey ───

test.describe('Select Then Hotkey', () => {
  test('select text then press Ctrl shows popup', async ({ testPage }) => {
    await selectThenHotkey(testPage, '#english-word');
    await expect(testPage.locator('#sakura-translator-root')).toBeAttached({ timeout: 5000 });
    await expect(testPage.locator('.sakura-original')).toHaveText('hello');
  });

  test('select-then-Ctrl on Chinese word shows popup', async ({ testPage }) => {
    await selectThenHotkey(testPage, '#chinese-word');
    await expect(testPage.locator('#sakura-translator-root')).toBeAttached({ timeout: 5000 });
  });
});

// ─── Configurable Shortcuts ───

test.describe('Configurable Shortcuts', () => {
  test('Alt+Select works when shortcut is set to alt', async ({ testPage }) => {
    await testPage.evaluate(() => { chrome.storage.sync.set({ selectionMode: 'manual', manualKey: 'alt' }); });
    await testPage.waitForTimeout(100);
    await testPage.evaluate(() => {
      const el = document.querySelector('#english-word');
      const range = document.createRange();
      range.selectNodeContents(el);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
      const rect = el.getBoundingClientRect();
      document.dispatchEvent(new MouseEvent('mouseup', { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2, altKey: true, bubbles: true }));
    });
    await expect(testPage.locator('#sakura-translator-root')).toBeAttached({ timeout: 5000 });
  });

  test('Ctrl+Select does NOT work when shortcut is set to alt', async ({ testPage }) => {
    await testPage.evaluate(() => { chrome.storage.sync.set({ selectionMode: 'manual', manualKey: 'alt' }); });
    await testPage.waitForTimeout(100);
    await ctrlSelectElement(testPage, '#english-word');
    await testPage.waitForTimeout(1000);
    await expect(testPage.locator('#sakura-translator-root')).not.toBeAttached();
  });

  test('Ctrl+Shift+Select works when shortcut is set to ctrl+shift', async ({ testPage }) => {
    await testPage.evaluate(() => { chrome.storage.sync.set({ selectionMode: 'manual', manualKey: 'ctrl+shift' }); });
    await testPage.waitForTimeout(100);
    await testPage.evaluate(() => {
      const el = document.querySelector('#english-word');
      const range = document.createRange();
      range.selectNodeContents(el);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
      const rect = el.getBoundingClientRect();
      document.dispatchEvent(new MouseEvent('mouseup', { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2, ctrlKey: true, shiftKey: true, bubbles: true }));
    });
    await expect(testPage.locator('#sakura-translator-root')).toBeAttached({ timeout: 5000 });
  });
});

// ─── Settings Propagation ───

test.describe('Settings Propagation', () => {
  test('content script loads sourceLang/targetLang from storage', async ({ testPage }) => {
    const settings = await testPage.evaluate(() => {
      return new Promise(resolve => { chrome.storage.sync.get({ sourceLang: 'auto', targetLang: 'zh-CN' }, items => resolve(items)); });
    });
    expect(settings.sourceLang).toBe('auto');
    expect(settings.targetLang).toBe('zh-CN');
  });

  test('changing language settings via storage propagates', async ({ testPage }) => {
    await testPage.evaluate(() => { chrome.storage.sync.set({ sourceLang: 'fr', targetLang: 'de' }); });
    await testPage.waitForTimeout(100);
    const updated = await testPage.evaluate(() => {
      return new Promise(resolve => { chrome.storage.sync.get({ sourceLang: 'en', targetLang: 'zh-CN' }, items => resolve(items)); });
    });
    expect(updated.sourceLang).toBe('fr');
    expect(updated.targetLang).toBe('de');
  });

  test('translation works after changing language settings', async ({ testPage }) => {
    await testPage.evaluate(() => { chrome.storage.sync.set({ sourceLang: 'zh-CN', targetLang: 'en' }); });
    await testPage.waitForTimeout(100);
    await ctrlSelectElement(testPage, '#chinese-word');
    await expect(testPage.locator('#sakura-translator-root')).toBeAttached({ timeout: 5000 });
    await expect(testPage.locator('.sakura-translation-text')).toHaveText('computer');
  });
});

// ─── Workflow Conflicts ───

test.describe('Workflow Conflicts', () => {
  test('Ctrl+Select still works in manual mode', async ({ testPage }) => {
    await testPage.evaluate(() => { chrome.storage.sync.set({ selectionMode: 'manual' }); });
    await testPage.waitForTimeout(100);
    await ctrlSelectElement(testPage, '#english-word');
    await expect(testPage.locator('#sakura-translator-root')).toBeAttached({ timeout: 5000 });
    await expect(testPage.locator('.sakura-translation-text')).toHaveText('你好');
  });

  test('select-then-Ctrl still works in manual mode', async ({ testPage }) => {
    await testPage.evaluate(() => { chrome.storage.sync.set({ selectionMode: 'manual' }); });
    await testPage.waitForTimeout(100);
    await selectThenHotkey(testPage, '#english-word');
    await expect(testPage.locator('#sakura-translator-root')).toBeAttached({ timeout: 5000 });
  });

  test('switching from hover to manual mode works', async ({ testPage }) => {
    await ctrlSelectElement(testPage, '#english-word');
    await expect(testPage.locator('#sakura-translator-root')).toBeAttached({ timeout: 5000 });
    await testPage.evaluate(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true })); });
    await expect(testPage.locator('#sakura-translator-root')).not.toBeAttached({ timeout: 3000 });

    await testPage.evaluate(() => { chrome.storage.sync.set({ selectionMode: 'manual' }); });
    await testPage.waitForTimeout(100);
    await ctrlSelectElement(testPage, '#chinese-word');
    await expect(testPage.locator('#sakura-translator-root')).toBeAttached({ timeout: 5000 });
    await expect(testPage.locator('.sakura-translation-text')).toHaveText('computer');
  });
});

// ─── Hover Mode Negative Tests ───
// Note: Positive hover tests (popup appears on hover+key) require caretRangeFromPoint
// which is unavailable in headless/offscreen mode. Only negative tests (no popup) work.

test.describe('Hover Mode — Negative Tests', () => {
  test('hover+Ctrl does NOT trigger on input elements', async ({ testPage }) => {
    await testPage.evaluate(() => { chrome.storage.sync.set({ selectionMode: 'hover' }); });
    await testPage.waitForTimeout(100);
    await testPage.evaluate(() => {
      const input = document.createElement('input');
      input.id = 'test-input';
      input.type = 'text';
      input.value = 'hello world';
      input.style.padding = '10px';
      input.style.fontSize = '16px';
      document.body.appendChild(input);
      const el = document.querySelector('#test-input');
      const rect = el.getBoundingClientRect();
      window.getSelection().removeAllRanges();
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2, bubbles: true }));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Control', code: 'ControlLeft', ctrlKey: true, shiftKey: false, altKey: false, bubbles: true }));
    });
    await testPage.waitForTimeout(1000);
    await expect(testPage.locator('#sakura-translator-root')).not.toBeAttached();
  });

  test('hover+Ctrl does NOT trigger in manual mode', async ({ testPage }) => {
    await testPage.evaluate(() => { chrome.storage.sync.set({ selectionMode: 'manual' }); });
    await testPage.waitForTimeout(100);
    await testPage.evaluate(() => {
      const el = document.querySelector('#english-word');
      const rect = el.getBoundingClientRect();
      window.getSelection().removeAllRanges();
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2, bubbles: true }));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Control', code: 'ControlLeft', ctrlKey: true, shiftKey: false, altKey: false, bubbles: true }));
    });
    await testPage.waitForTimeout(1000);
    await expect(testPage.locator('#sakura-translator-root')).not.toBeAttached();
  });
});

module.exports = { test };
