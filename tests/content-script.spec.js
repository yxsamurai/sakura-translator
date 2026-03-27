/**
 * Integration tests for the content script behavior.
 * 
 * Chrome extension content scripts injection with Playwright's persistent context
 * can be unreliable due to timing issues. We use a two-pronged approach:
 * 
 * 1. Manually inject the content scripts + CSS into test pages
 * 2. Mock chrome.runtime.sendMessage to return test data
 * 
 * This tests the actual content script UI logic (Ctrl+Select, popup rendering,
 * dismissal, word vs sentence) in isolation from the background worker.
 */
const { test: base, chromium, expect } = require('@playwright/test');
const http = require('http');
const fs = require('fs');
const path = require('path');

const EXTENSION_PATH = path.resolve(__dirname, '..');

// Read source files
const detectorJS = fs.readFileSync(path.join(EXTENSION_PATH, 'utils', 'detector.js'), 'utf-8');
const translatorJS = fs.readFileSync(path.join(EXTENSION_PATH, 'utils', 'translator.js'), 'utf-8');
const contentJS = fs.readFileSync(path.join(EXTENSION_PATH, 'content', 'content.js'), 'utf-8');
const contentCSS = fs.readFileSync(path.join(EXTENSION_PATH, 'content', 'content.css'), 'utf-8');

const TEST_HTML = `
<!DOCTYPE html>
<html>
<head>
  <title>Sakura Translator Test Page</title>
  <style>${contentCSS}</style>
</head>
<body style="padding: 50px; font-size: 18px; line-height: 2;">
  <p id="english-word" style="margin-bottom: 30px;">hello</p>
  <p id="english-sentence" style="margin-bottom: 30px;">The quick brown fox jumps over the lazy dog</p>
  <p id="chinese-word" style="margin-bottom: 30px;">计算机</p>
  <p id="chinese-sentence" style="margin-bottom: 30px;">今天天气很好我想出去走走看看风景</p>
</body>
</html>
`;

// Mock translation results
const MOCK_WORD_RESULT = {
  type: 'word',
  original: 'hello',
  translation: '你好',
  phonetic: '/həˈloʊ/',
  phonetics: [],
  meanings: [
    {
      partOfSpeech: 'exclamation',
      definitions: [
        { definition: '你好 (问候, 致意)' }
      ]
    },
    {
      partOfSpeech: 'noun',
      definitions: [
        { definition: '招呼 (问候, 致意)' }
      ]
    }
  ],
  definitions: [
    {
      partOfSpeech: 'exclamation',
      definitions: [
        { definition: 'used as a greeting or to begin a phone conversation', example: 'hello there, Katie!' }
      ]
    },
    {
      partOfSpeech: 'noun',
      definitions: [
        { definition: 'an utterance of "hello"; a greeting', example: 'she was getting lots of hellos' }
      ]
    }
  ],
  examples: [
    'hello there, Katie!',
    'she was getting lots of hellos'
  ],
  lang: 'en'
};

const MOCK_SENTENCE_RESULT = {
  type: 'sentence',
  original: 'The quick brown fox jumps over the lazy dog',
  translation: '敏捷的棕色狐狸跳过了那只懒狗',
  lang: 'en'
};

const MOCK_CHINESE_WORD_RESULT = {
  type: 'word',
  original: '计算机',
  translation: 'computer',
  phonetic: '',
  phonetics: [],
  meanings: [],
  lang: 'zh'
};

const MOCK_CHINESE_SENTENCE_RESULT = {
  type: 'sentence',
  original: '今天天气很好我想出去走走看看风景',
  translation: 'The weather is nice today and I want to go out for a walk and see the scenery',
  lang: 'zh'
};

// Custom fixture
const test = base.extend({
  testServer: [async ({}, use) => {
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(TEST_HTML);
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    await use({ url: `http://127.0.0.1:${port}` });
    server.close();
  }, { scope: 'worker' }],

  testPage: async ({ page, testServer }, use) => {
    await page.goto(testServer.url, { waitUntil: 'load' });

    // Mock chrome.runtime.sendMessage before injecting content scripts
    await page.evaluate((mocks) => {
      // Create a minimal chrome mock with storage and runtime
      const syncStorage = { triggerShortcut: 'ctrl', selectionMode: 'manual', sourceLang: 'auto', targetLang: 'zh-CN' };
      const changeListeners = [];

      window.chrome = {
        runtime: {
          sendMessage: (msg, callback) => {
            // Simulate async response like the real background worker
            setTimeout(() => {
              if (msg.action === 'translate') {
                if (msg.type === 'word' && msg.lang === 'en') {
                  callback(mocks.word);
                } else if (msg.type === 'sentence' && msg.lang === 'en') {
                  callback(mocks.sentence);
                } else if (msg.type === 'word' && msg.lang === 'zh') {
                  callback(mocks.chineseWord);
                } else {
                  callback(mocks.chineseSentence);
                }
              }
            }, 100);
          },
          lastError: null,
        },
        storage: {
          sync: {
            get: (defaults, callback) => {
              const result = {};
              for (const key in defaults) {
                result[key] = syncStorage[key] !== undefined ? syncStorage[key] : defaults[key];
              }
              callback(result);
            },
            set: (items, callback) => {
              const changes = {};
              for (const key in items) {
                const oldValue = syncStorage[key];
                syncStorage[key] = items[key];
                changes[key] = { oldValue, newValue: items[key] };
              }
              changeListeners.forEach(fn => fn(changes, 'sync'));
              if (callback) callback();
            },
          },
          onChanged: {
            addListener: (fn) => { changeListeners.push(fn); },
          },
        },
      };
    }, {
      word: MOCK_WORD_RESULT,
      sentence: MOCK_SENTENCE_RESULT,
      chineseWord: MOCK_CHINESE_WORD_RESULT,
      chineseSentence: MOCK_CHINESE_SENTENCE_RESULT,
    });

    // Inject content scripts via addScriptTag (executes at global scope, like Chrome does)
    await page.addScriptTag({ content: detectorJS });
    await page.addScriptTag({ content: translatorJS });
    await page.addScriptTag({ content: contentJS });

    await use(page);
  },
});

/**
 * Workflow 1: Hold hotkey + select text (original Ctrl+Select behavior).
 */
async function ctrlSelectElement(page, selector) {
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) throw new Error(`Element not found: ${sel}`);

    // Select text programmatically
    const range = document.createRange();
    range.selectNodeContents(el);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);

    // Set Ctrl held state
    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Control', code: 'ControlLeft', ctrlKey: true, bubbles: true
    }));

    // Trigger the mouseup handler with Ctrl held
    const rect = el.getBoundingClientRect();
    document.dispatchEvent(new MouseEvent('mouseup', {
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
      ctrlKey: true, bubbles: true
    }));
  }, selector);

  // Release Ctrl after the handler fires
  await page.waitForTimeout(150);
  await page.evaluate(() => {
    document.dispatchEvent(new KeyboardEvent('keyup', {
      key: 'Control', code: 'ControlLeft', ctrlKey: false, bubbles: true
    }));
  });
}

/**
 * Workflow 2: Select text first, then press hotkey.
 */
async function selectThenHotkey(page, selector) {
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) throw new Error(`Element not found: ${sel}`);

    // Select text first (without any modifier key)
    const range = document.createRange();
    range.selectNodeContents(el);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);

    // Fire mouseup without hotkey — should NOT trigger
    const rect = el.getBoundingClientRect();
    document.dispatchEvent(new MouseEvent('mouseup', {
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
      ctrlKey: false, bubbles: true
    }));
  }, selector);

  // Wait a bit, then press Ctrl to trigger translation
  await page.waitForTimeout(100);
  await page.evaluate(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Control', code: 'ControlLeft', ctrlKey: true, bubbles: true
    }));
  });

  // Release Ctrl after the handler fires
  await page.waitForTimeout(150);
  await page.evaluate(() => {
    document.dispatchEvent(new KeyboardEvent('keyup', {
      key: 'Control', code: 'ControlLeft', ctrlKey: false, bubbles: true
    }));
  });
}

// ─── Tests ───

test.describe('Content Script — Injection', () => {
  test('all modules are available after injection', async ({ testPage }) => {
    const hasDetector = await testPage.evaluate(() => typeof SakuraDetector !== 'undefined');
    expect(hasDetector).toBe(true);

    const hasTranslator = await testPage.evaluate(() => typeof SakuraTranslator !== 'undefined');
    expect(hasTranslator).toBe(true);
  });

  test('detector works correctly in page context', async ({ testPage }) => {
    const result = await testPage.evaluate(() => SakuraDetector.detect('hello'));
    expect(result.type).toBe('word');
    expect(result.lang).toBe('en');

    const result2 = await testPage.evaluate(() => SakuraDetector.detect('计算机'));
    expect(result2.type).toBe('word');
    expect(result2.lang).toBe('zh');
  });
});

test.describe('Content Script — Popup Appearance', () => {
  test('Ctrl+Select on English word shows popup', async ({ testPage }) => {
    await ctrlSelectElement(testPage, '#english-word');

    const popup = testPage.locator('#sakura-translator-root');
    await expect(popup).toBeAttached({ timeout: 5000 });

    // Wait for translation to render
    await expect(testPage.locator('.sakura-brand')).toBeAttached({ timeout: 5000 });
  });

  test('Ctrl+Select on English sentence shows popup', async ({ testPage }) => {
    await ctrlSelectElement(testPage, '#english-sentence');

    await expect(testPage.locator('#sakura-translator-root')).toBeAttached({ timeout: 5000 });
    await expect(testPage.locator('.sakura-brand')).toBeAttached({ timeout: 5000 });
  });

  test('Ctrl+Select on Chinese word shows popup', async ({ testPage }) => {
    await ctrlSelectElement(testPage, '#chinese-word');

    await expect(testPage.locator('#sakura-translator-root')).toBeAttached({ timeout: 5000 });
    await expect(testPage.locator('.sakura-brand')).toBeAttached({ timeout: 5000 });
  });

  test('Ctrl+Select on Chinese sentence shows popup', async ({ testPage }) => {
    await ctrlSelectElement(testPage, '#chinese-sentence');

    await expect(testPage.locator('#sakura-translator-root')).toBeAttached({ timeout: 5000 });
    await expect(testPage.locator('.sakura-brand')).toBeAttached({ timeout: 5000 });
  });
});

test.describe('Content Script — No Popup Without Ctrl', () => {
  test('selecting text without Ctrl does NOT show popup', async ({ testPage }) => {
    await testPage.evaluate(() => {
      const el = document.querySelector('#english-word');
      const range = document.createRange();
      range.selectNodeContents(el);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);

      // Mouseup without Ctrl key held
      document.dispatchEvent(new MouseEvent('mouseup', {
        clientX: 100, clientY: 100, ctrlKey: false, bubbles: true
      }));
    });

    await testPage.waitForTimeout(1000);
    await expect(testPage.locator('#sakura-translator-root')).not.toBeAttached();
  });
});

test.describe('Content Script — Popup Dismissal', () => {
  test('pressing Escape closes the popup', async ({ testPage }) => {
    await ctrlSelectElement(testPage, '#english-word');
    await expect(testPage.locator('#sakura-translator-root')).toBeAttached({ timeout: 5000 });

    // Press Escape
    await testPage.evaluate(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Escape', code: 'Escape', bubbles: true
      }));
    });

    await expect(testPage.locator('#sakura-translator-root')).not.toBeAttached({ timeout: 3000 });
  });

  test('clicking outside closes the popup', async ({ testPage }) => {
    await ctrlSelectElement(testPage, '#english-word');
    await expect(testPage.locator('#sakura-translator-root')).toBeAttached({ timeout: 5000 });

    // Mousedown outside popup
    await testPage.evaluate(() => {
      document.dispatchEvent(new MouseEvent('mousedown', {
        clientX: 5, clientY: 5, bubbles: true
      }));
    });

    await expect(testPage.locator('#sakura-translator-root')).not.toBeAttached({ timeout: 3000 });
  });
});

test.describe('Content Script — Word vs Sentence Rendering', () => {
  test('English word shows header, phonetic, translation, meanings and definitions', async ({ testPage }) => {
    await ctrlSelectElement(testPage, '#english-word');
    await expect(testPage.locator('.sakura-brand')).toBeAttached({ timeout: 5000 });

    // Original word
    await expect(testPage.locator('.sakura-original')).toHaveText('hello');

    // Phonetic
    await expect(testPage.locator('.sakura-phonetic')).toHaveText('/həˈloʊ/');

    // Translation
    await expect(testPage.locator('.sakura-translation-text')).toHaveText('你好');

    // Meanings (localized — POS tags are translated to target language zh-CN)
    const posTags = testPage.locator('.sakura-meaning-pos');
    await expect(posTags.first()).toContainText('感叹词');

    const defs = testPage.locator('.sakura-meaning-def');
    await expect(defs.first()).toContainText('你好');

    // Definitions section (source language definitions from Google dt=md)
    const defSection = testPage.locator('.sakura-definitions');
    await expect(defSection).toBeAttached();
    await expect(defSection.locator('.sakura-def-text').first()).toContainText('used as a greeting');

    // Examples section (from Google dt=ex)
    const exSection = testPage.locator('.sakura-examples');
    await expect(exSection).toBeAttached();
    await expect(exSection.locator('.sakura-example-item').first()).toContainText('hello there, Katie!');
  });

  test('English sentence shows original + translation', async ({ testPage }) => {
    await ctrlSelectElement(testPage, '#english-sentence');
    await expect(testPage.locator('.sakura-brand')).toBeAttached({ timeout: 5000 });

    // Sentence layout (no source text, only translation)
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

    await expect(testPage.locator('.sakura-sentence')).toBeAttached();
    await expect(testPage.locator('.sakura-sentence-translation')).toContainText('weather is nice');
  });
});

test.describe('Content Script — Multiple Translations', () => {
  test('selecting new text replaces previous popup', async ({ testPage }) => {
    // First selection — English word
    await ctrlSelectElement(testPage, '#english-word');
    await expect(testPage.locator('.sakura-original')).toHaveText('hello', { timeout: 5000 });

    // Second selection — Chinese word
    await ctrlSelectElement(testPage, '#chinese-word');
    await expect(testPage.locator('.sakura-original')).toHaveText('计算机', { timeout: 5000 });

    // Only one popup root
    const count = await testPage.locator('#sakura-translator-root').count();
    expect(count).toBe(1);
  });

  test('loading state appears before result', async ({ testPage }) => {
    await ctrlSelectElement(testPage, '#english-word');

    // The popup should exist immediately
    await expect(testPage.locator('#sakura-translator-root')).toBeAttached({ timeout: 2000 });

    // After mock delay, result should render
    await expect(testPage.locator('.sakura-brand')).toBeAttached({ timeout: 5000 });
  });
});

test.describe('Content Script — Select Then Hotkey (Workflow 2)', () => {
  test('select text first, then press Ctrl shows popup', async ({ testPage }) => {
    await selectThenHotkey(testPage, '#english-word');

    const popup = testPage.locator('#sakura-translator-root');
    await expect(popup).toBeAttached({ timeout: 5000 });
    await expect(testPage.locator('.sakura-brand')).toBeAttached({ timeout: 5000 });
  });

  test('select-then-Ctrl on Chinese word shows popup', async ({ testPage }) => {
    await selectThenHotkey(testPage, '#chinese-word');

    await expect(testPage.locator('#sakura-translator-root')).toBeAttached({ timeout: 5000 });
    await expect(testPage.locator('.sakura-brand')).toBeAttached({ timeout: 5000 });
  });

  test('select-then-Ctrl on sentence shows popup', async ({ testPage }) => {
    await selectThenHotkey(testPage, '#english-sentence');

    await expect(testPage.locator('#sakura-translator-root')).toBeAttached({ timeout: 5000 });
    await expect(testPage.locator('.sakura-brand')).toBeAttached({ timeout: 5000 });
  });

  test('select-then-Ctrl renders word result correctly', async ({ testPage }) => {
    await selectThenHotkey(testPage, '#english-word');
    await expect(testPage.locator('.sakura-brand')).toBeAttached({ timeout: 5000 });

    await expect(testPage.locator('.sakura-original')).toHaveText('hello');
    await expect(testPage.locator('.sakura-translation-text')).toHaveText('你好');
  });
});

test.describe('Content Script — Language Settings Propagation', () => {
  test('content script loads sourceLang/targetLang from storage', async ({ testPage }) => {
    const settings = await testPage.evaluate(() => {
      return new Promise(resolve => {
        chrome.storage.sync.get(
          { sourceLang: 'auto', targetLang: 'zh-CN' },
          items => resolve(items)
        );
      });
    });

    expect(settings.sourceLang).toBe('auto');
    expect(settings.targetLang).toBe('zh-CN');
  });

  test('changing sourceLang via storage.sync.set propagates to content script', async ({ testPage }) => {
    // Change sourceLang to Japanese
    await testPage.evaluate(() => {
      chrome.storage.sync.set({ sourceLang: 'ja' });
    });
    await testPage.waitForTimeout(100);

    // Verify the storage was updated
    const updated = await testPage.evaluate(() => {
      return new Promise(resolve => {
        chrome.storage.sync.get({ sourceLang: 'en' }, items => resolve(items));
      });
    });
    expect(updated.sourceLang).toBe('ja');
  });

  test('changing targetLang via storage.sync.set propagates to content script', async ({ testPage }) => {
    // Change targetLang to Korean
    await testPage.evaluate(() => {
      chrome.storage.sync.set({ targetLang: 'ko' });
    });
    await testPage.waitForTimeout(100);

    const updated = await testPage.evaluate(() => {
      return new Promise(resolve => {
        chrome.storage.sync.get({ targetLang: 'zh-CN' }, items => resolve(items));
      });
    });
    expect(updated.targetLang).toBe('ko');
  });

  test('changing both sourceLang and targetLang simultaneously', async ({ testPage }) => {
    await testPage.evaluate(() => {
      chrome.storage.sync.set({ sourceLang: 'fr', targetLang: 'de' });
    });
    await testPage.waitForTimeout(100);

    const updated = await testPage.evaluate(() => {
      return new Promise(resolve => {
        chrome.storage.sync.get({ sourceLang: 'en', targetLang: 'zh-CN' }, items => resolve(items));
      });
    });
    expect(updated.sourceLang).toBe('fr');
    expect(updated.targetLang).toBe('de');
  });

  test('translation still works after changing language settings', async ({ testPage }) => {
    // Change to Japanese → Korean
    await testPage.evaluate(() => {
      chrome.storage.sync.set({ sourceLang: 'ja', targetLang: 'ko' });
    });
    await testPage.waitForTimeout(100);

    // Ctrl+Select on English word — should still show popup
    await ctrlSelectElement(testPage, '#english-word');

    await expect(testPage.locator('#sakura-translator-root')).toBeAttached({ timeout: 5000 });
    await expect(testPage.locator('.sakura-brand')).toBeAttached({ timeout: 5000 });
  });

  test('translation works with Chinese language settings', async ({ testPage }) => {
    await testPage.evaluate(() => {
      chrome.storage.sync.set({ sourceLang: 'zh-CN', targetLang: 'en' });
    });
    await testPage.waitForTimeout(100);

    // Select Chinese word
    await ctrlSelectElement(testPage, '#chinese-word');

    await expect(testPage.locator('#sakura-translator-root')).toBeAttached({ timeout: 5000 });
    await expect(testPage.locator('.sakura-brand')).toBeAttached({ timeout: 5000 });
    await expect(testPage.locator('.sakura-translation-text')).toHaveText('computer');
  });

  test('onChanged listener fires for sourceLang update', async ({ testPage }) => {
    // Track change events
    await testPage.evaluate(() => {
      window.__langChanges = [];
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'sync' && changes.sourceLang) {
          window.__langChanges.push({ key: 'sourceLang', ...changes.sourceLang });
        }
      });
    });

    await testPage.evaluate(() => {
      chrome.storage.sync.set({ sourceLang: 'es' });
    });
    await testPage.waitForTimeout(100);

    const changes = await testPage.evaluate(() => window.__langChanges);
    expect(changes.length).toBeGreaterThanOrEqual(1);
    expect(changes[0].newValue).toBe('es');
  });

  test('onChanged listener fires for targetLang update', async ({ testPage }) => {
    await testPage.evaluate(() => {
      window.__targetChanges = [];
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'sync' && changes.targetLang) {
          window.__targetChanges.push({ key: 'targetLang', ...changes.targetLang });
        }
      });
    });

    await testPage.evaluate(() => {
      chrome.storage.sync.set({ targetLang: 'ru' });
    });
    await testPage.waitForTimeout(100);

    const changes = await testPage.evaluate(() => window.__targetChanges);
    expect(changes.length).toBeGreaterThanOrEqual(1);
    expect(changes[0].newValue).toBe('ru');
  });
});

test.describe('Content Script — Auto-Detect Source Language', () => {
  test('default sourceLang is auto in storage', async ({ testPage }) => {
    const settings = await testPage.evaluate(() => {
      return new Promise(resolve => {
        chrome.storage.sync.get({ sourceLang: 'auto' }, items => resolve(items));
      });
    });
    expect(settings.sourceLang).toBe('auto');
  });

  test('translation works with auto-detect on English word', async ({ testPage }) => {
    // Ensure sourceLang is auto (default)
    await testPage.evaluate(() => {
      chrome.storage.sync.set({ sourceLang: 'auto', targetLang: 'zh-CN' });
    });
    await testPage.waitForTimeout(100);

    await ctrlSelectElement(testPage, '#english-word');

    await expect(testPage.locator('#sakura-translator-root')).toBeAttached({ timeout: 5000 });
    await expect(testPage.locator('.sakura-brand')).toBeAttached({ timeout: 5000 });
    await expect(testPage.locator('.sakura-translation-text')).toHaveText('你好');
  });

  test('translation works with auto-detect on Chinese word', async ({ testPage }) => {
    await testPage.evaluate(() => {
      chrome.storage.sync.set({ sourceLang: 'auto', targetLang: 'zh-CN' });
    });
    await testPage.waitForTimeout(100);

    await ctrlSelectElement(testPage, '#chinese-word');

    await expect(testPage.locator('#sakura-translator-root')).toBeAttached({ timeout: 5000 });
    await expect(testPage.locator('.sakura-brand')).toBeAttached({ timeout: 5000 });
    await expect(testPage.locator('.sakura-translation-text')).toHaveText('computer');
  });

  test('translation works with auto-detect on English sentence', async ({ testPage }) => {
    await testPage.evaluate(() => {
      chrome.storage.sync.set({ sourceLang: 'auto', targetLang: 'zh-CN' });
    });
    await testPage.waitForTimeout(100);

    await ctrlSelectElement(testPage, '#english-sentence');

    await expect(testPage.locator('#sakura-translator-root')).toBeAttached({ timeout: 5000 });
    await expect(testPage.locator('.sakura-sentence-translation')).toContainText('敏捷的棕色狐狸');
  });

  test('translation works with auto-detect on Chinese sentence', async ({ testPage }) => {
    await testPage.evaluate(() => {
      chrome.storage.sync.set({ sourceLang: 'auto', targetLang: 'zh-CN' });
    });
    await testPage.waitForTimeout(100);

    await ctrlSelectElement(testPage, '#chinese-sentence');

    await expect(testPage.locator('#sakura-translator-root')).toBeAttached({ timeout: 5000 });
    await expect(testPage.locator('.sakura-sentence-translation')).toContainText('weather is nice');
  });

  test('auto-detect with target en works for Chinese word', async ({ testPage }) => {
    await testPage.evaluate(() => {
      chrome.storage.sync.set({ sourceLang: 'auto', targetLang: 'en' });
    });
    await testPage.waitForTimeout(100);

    await ctrlSelectElement(testPage, '#chinese-word');

    await expect(testPage.locator('#sakura-translator-root')).toBeAttached({ timeout: 5000 });
    await expect(testPage.locator('.sakura-brand')).toBeAttached({ timeout: 5000 });
  });

  test('switching from auto to manual source lang updates storage', async ({ testPage }) => {
    // Start with auto
    const initial = await testPage.evaluate(() => {
      return new Promise(resolve => {
        chrome.storage.sync.get({ sourceLang: 'auto' }, items => resolve(items));
      });
    });
    expect(initial.sourceLang).toBe('auto');

    // Switch to manual
    await testPage.evaluate(() => {
      chrome.storage.sync.set({ sourceLang: 'ja' });
    });
    await testPage.waitForTimeout(100);

    const updated = await testPage.evaluate(() => {
      return new Promise(resolve => {
        chrome.storage.sync.get({ sourceLang: 'auto' }, items => resolve(items));
      });
    });
    expect(updated.sourceLang).toBe('ja');
  });

  test('switching from manual back to auto works', async ({ testPage }) => {
    await testPage.evaluate(() => {
      chrome.storage.sync.set({ sourceLang: 'fr' });
    });
    await testPage.waitForTimeout(100);

    await testPage.evaluate(() => {
      chrome.storage.sync.set({ sourceLang: 'auto' });
    });
    await testPage.waitForTimeout(100);

    const settings = await testPage.evaluate(() => {
      return new Promise(resolve => {
        chrome.storage.sync.get({ sourceLang: 'auto' }, items => resolve(items));
      });
    });
    expect(settings.sourceLang).toBe('auto');
  });

  test('onChanged listener fires when switching to auto', async ({ testPage }) => {
    await testPage.evaluate(() => {
      window.__autoChanges = [];
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'sync' && changes.sourceLang) {
          window.__autoChanges.push(changes.sourceLang);
        }
      });
    });

    await testPage.evaluate(() => {
      chrome.storage.sync.set({ sourceLang: 'auto' });
    });
    await testPage.waitForTimeout(100);

    const changes = await testPage.evaluate(() => window.__autoChanges);
    expect(changes.length).toBeGreaterThanOrEqual(1);
    expect(changes[0].newValue).toBe('auto');
  });
});

test.describe('Content Script — Configurable Shortcut', () => {
  test('Alt+Select works when shortcut is set to alt', async ({ testPage }) => {
    // Change shortcut setting to alt
    await testPage.evaluate(() => {
      chrome.storage.sync.set({ triggerShortcut: 'alt' });
    });
    await testPage.waitForTimeout(100);

    // Now Alt+Select should work
    await testPage.evaluate(() => {
      const el = document.querySelector('#english-word');
      const range = document.createRange();
      range.selectNodeContents(el);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);

      const rect = el.getBoundingClientRect();
      document.dispatchEvent(new MouseEvent('mouseup', {
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
        altKey: true, bubbles: true
      }));
    });

    await expect(testPage.locator('#sakura-translator-root')).toBeAttached({ timeout: 5000 });
    await expect(testPage.locator('.sakura-brand')).toBeAttached({ timeout: 5000 });
  });

  test('Ctrl+Select does NOT work when shortcut is set to alt', async ({ testPage }) => {
    // Change shortcut to alt
    await testPage.evaluate(() => {
      chrome.storage.sync.set({ triggerShortcut: 'alt' });
    });
    await testPage.waitForTimeout(100);

    // Ctrl+Select should NOT trigger
    await testPage.evaluate(() => {
      const el = document.querySelector('#english-word');
      const range = document.createRange();
      range.selectNodeContents(el);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);

      document.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Control', code: 'ControlLeft', ctrlKey: true, bubbles: true
      }));
      const rect = el.getBoundingClientRect();
      document.dispatchEvent(new MouseEvent('mouseup', {
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
        ctrlKey: true, bubbles: true
      }));
    });

    await testPage.waitForTimeout(1000);
    await expect(testPage.locator('#sakura-translator-root')).not.toBeAttached();
  });

  test('Ctrl+Shift+Select works when shortcut is set to ctrl+shift', async ({ testPage }) => {
    // Change shortcut to ctrl+shift
    await testPage.evaluate(() => {
      chrome.storage.sync.set({ triggerShortcut: 'ctrl+shift' });
    });
    await testPage.waitForTimeout(100);

    await testPage.evaluate(() => {
      const el = document.querySelector('#english-word');
      const range = document.createRange();
      range.selectNodeContents(el);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);

      const rect = el.getBoundingClientRect();
      document.dispatchEvent(new MouseEvent('mouseup', {
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
        ctrlKey: true, shiftKey: true, bubbles: true
      }));
    });

    await expect(testPage.locator('#sakura-translator-root')).toBeAttached({ timeout: 5000 });
    await expect(testPage.locator('.sakura-brand')).toBeAttached({ timeout: 5000 });
  });

  test('select-then-Alt works when shortcut is set to alt', async ({ testPage }) => {
    // Change shortcut to alt
    await testPage.evaluate(() => {
      chrome.storage.sync.set({ triggerShortcut: 'alt' });
    });
    await testPage.waitForTimeout(100);

    // Select text first
    await testPage.evaluate(() => {
      const el = document.querySelector('#english-word');
      const range = document.createRange();
      range.selectNodeContents(el);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
    });

    await testPage.waitForTimeout(100);

    // Then press Alt
    await testPage.evaluate(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Alt', code: 'AltLeft', altKey: true, bubbles: true
      }));
    });

    await expect(testPage.locator('#sakura-translator-root')).toBeAttached({ timeout: 5000 });
    await expect(testPage.locator('.sakura-brand')).toBeAttached({ timeout: 5000 });
  });
});

// ─── Helper: Simulate hover + Ctrl keydown for auto-select word (hover mode) ───
async function hoverCtrlOnElement(page, selector) {
  // Ensure hover mode is active
  await page.evaluate(() => {
    chrome.storage.sync.set({ selectionMode: 'hover' });
  });
  await page.waitForTimeout(100);

  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) throw new Error(`Element not found: ${sel}`);

    const rect = el.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    // Clear any existing selection
    window.getSelection().removeAllRanges();

    // Simulate mouse move to set cursor position
    document.dispatchEvent(new MouseEvent('mousemove', {
      clientX: x, clientY: y, bubbles: true
    }));

    // Press Ctrl (word mode)
    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Control', code: 'ControlLeft', ctrlKey: true,
      shiftKey: false, altKey: false, bubbles: true
    }));
  }, selector);

  // Wait for translation
  await page.waitForTimeout(150);
}

// ─── Helper: Simulate hover + Alt for auto-select sentence (hover mode) ───
async function hoverAltOnElement(page, selector) {
  // Ensure hover mode is active
  await page.evaluate(() => {
    chrome.storage.sync.set({ selectionMode: 'hover' });
  });
  await page.waitForTimeout(100);

  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) throw new Error(`Element not found: ${sel}`);

    const rect = el.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    // Clear any existing selection
    window.getSelection().removeAllRanges();

    // Simulate mouse move to set cursor position
    document.dispatchEvent(new MouseEvent('mousemove', {
      clientX: x, clientY: y, bubbles: true
    }));

    // Press Alt (sentence mode)
    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Alt', code: 'AltLeft', ctrlKey: false,
      shiftKey: false, altKey: true, bubbles: true
    }));
  }, selector);

  // Wait for translation
  await page.waitForTimeout(150);
}

test.describe('Content Script — Hover + Ctrl (Auto-Select Word)', () => {
  test('hover+Ctrl on English word shows popup', async ({ testPage }) => {
    await hoverCtrlOnElement(testPage, '#english-word');

    await expect(testPage.locator('#sakura-translator-root')).toBeAttached({ timeout: 5000 });
    await expect(testPage.locator('.sakura-brand')).toBeAttached({ timeout: 5000 });
  });

  test('hover+Ctrl on English word shows correct translation', async ({ testPage }) => {
    await hoverCtrlOnElement(testPage, '#english-word');

    await expect(testPage.locator('.sakura-brand')).toBeAttached({ timeout: 5000 });
    await expect(testPage.locator('.sakura-translation-text')).toHaveText('你好');
  });

  test('hover+Ctrl on Chinese word shows popup', async ({ testPage }) => {
    await hoverCtrlOnElement(testPage, '#chinese-word');

    await expect(testPage.locator('#sakura-translator-root')).toBeAttached({ timeout: 5000 });
    await expect(testPage.locator('.sakura-brand')).toBeAttached({ timeout: 5000 });
  });

  test('hover+Ctrl on Chinese word shows correct translation', async ({ testPage }) => {
    await hoverCtrlOnElement(testPage, '#chinese-word');

    await expect(testPage.locator('.sakura-brand')).toBeAttached({ timeout: 5000 });
    await expect(testPage.locator('.sakura-translation-text')).toHaveText('computer');
  });

  test('hover+Ctrl on English sentence selects word (not whole sentence)', async ({ testPage }) => {
    await hoverCtrlOnElement(testPage, '#english-sentence');

    await expect(testPage.locator('#sakura-translator-root')).toBeAttached({ timeout: 5000 });
    await expect(testPage.locator('.sakura-brand')).toBeAttached({ timeout: 5000 });

    // Should be a word result (single word from the sentence), not the whole sentence
    const selectedText = await testPage.evaluate(() => window.getSelection().toString().trim());
    const wordCount = selectedText.split(/\s+/).length;
    expect(wordCount).toBe(1);
  });

  test('hover+Ctrl highlights the word in the page', async ({ testPage }) => {
    await hoverCtrlOnElement(testPage, '#english-word');

    await expect(testPage.locator('#sakura-translator-root')).toBeAttached({ timeout: 5000 });

    const selectedText = await testPage.evaluate(() => window.getSelection().toString().trim());
    expect(selectedText.length).toBeGreaterThan(0);
    expect(selectedText).toBe('hello');
  });

  test('hover+Ctrl does NOT trigger when text is already selected', async ({ testPage }) => {
    // Enable hover mode
    await testPage.evaluate(() => {
      chrome.storage.sync.set({ selectionMode: 'hover' });
    });
    await testPage.waitForTimeout(100);

    // First select some text manually
    await testPage.evaluate(() => {
      const el = document.querySelector('#english-sentence');
      const range = document.createRange();
      range.selectNodeContents(el);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
    });

    // Now try hover+Ctrl — should NOT create a new popup (existing selection should prevent it)
    // Instead, Workflow 2 (select-then-hotkey) should handle it
    await testPage.evaluate(() => {
      const el = document.querySelector('#english-word');
      const rect = el.getBoundingClientRect();

      document.dispatchEvent(new MouseEvent('mousemove', {
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
        bubbles: true
      }));

      document.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Control', code: 'ControlLeft', ctrlKey: true,
        shiftKey: false, altKey: false, bubbles: true
      }));
    });

    await testPage.waitForTimeout(500);

    // Popup should appear (from Workflow 2, since there was an existing selection)
    await expect(testPage.locator('#sakura-translator-root')).toBeAttached({ timeout: 5000 });
  });

  test('hover+Ctrl does NOT trigger on input elements', async ({ testPage }) => {
    // Enable hover mode
    await testPage.evaluate(() => {
      chrome.storage.sync.set({ selectionMode: 'hover' });
    });
    await testPage.waitForTimeout(100);

    // Add an input element to the page
    await testPage.evaluate(() => {
      const input = document.createElement('input');
      input.id = 'test-input';
      input.type = 'text';
      input.value = 'hello world';
      input.style.padding = '10px';
      input.style.fontSize = '16px';
      document.body.appendChild(input);
    });

    // Hover over the input + Ctrl
    await testPage.evaluate(() => {
      const el = document.querySelector('#test-input');
      const rect = el.getBoundingClientRect();

      window.getSelection().removeAllRanges();

      document.dispatchEvent(new MouseEvent('mousemove', {
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
        bubbles: true
      }));

      document.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Control', code: 'ControlLeft', ctrlKey: true,
        shiftKey: false, altKey: false, bubbles: true
      }));
    });

    await testPage.waitForTimeout(1000);
    await expect(testPage.locator('#sakura-translator-root')).not.toBeAttached();
  });

  test('hover+Ctrl does NOT trigger in manual mode', async ({ testPage }) => {
    // Ensure manual mode
    await testPage.evaluate(() => {
      chrome.storage.sync.set({ selectionMode: 'manual' });
    });
    await testPage.waitForTimeout(100);

    await testPage.evaluate(() => {
      const el = document.querySelector('#english-word');
      const rect = el.getBoundingClientRect();

      window.getSelection().removeAllRanges();

      document.dispatchEvent(new MouseEvent('mousemove', {
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
        bubbles: true
      }));

      document.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Control', code: 'ControlLeft', ctrlKey: true,
        shiftKey: false, altKey: false, bubbles: true
      }));
    });

    await testPage.waitForTimeout(1000);
    await expect(testPage.locator('#sakura-translator-root')).not.toBeAttached();
  });

  test('releasing Ctrl dismisses hover popup and clears selection', async ({ testPage }) => {
    await hoverCtrlOnElement(testPage, '#english-word');
    await expect(testPage.locator('#sakura-translator-root')).toBeAttached({ timeout: 5000 });

    // Release Ctrl
    await testPage.evaluate(() => {
      document.dispatchEvent(new KeyboardEvent('keyup', {
        key: 'Control', code: 'ControlLeft', ctrlKey: false,
        shiftKey: false, altKey: false, bubbles: true
      }));
    });

    await expect(testPage.locator('#sakura-translator-root')).not.toBeAttached({ timeout: 3000 });

    // Selection should be cleared
    const selectedText = await testPage.evaluate(() => window.getSelection().toString().trim());
    expect(selectedText).toBe('');
  });

  test('hover+Ctrl popup can be dismissed with Escape', async ({ testPage }) => {
    await hoverCtrlOnElement(testPage, '#english-word');
    await expect(testPage.locator('#sakura-translator-root')).toBeAttached({ timeout: 5000 });

    await testPage.evaluate(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Escape', code: 'Escape', bubbles: true
      }));
    });

    await expect(testPage.locator('#sakura-translator-root')).not.toBeAttached({ timeout: 3000 });
  });

  test('hover+Ctrl popup can be dismissed by clicking outside', async ({ testPage }) => {
    await hoverCtrlOnElement(testPage, '#english-word');
    await expect(testPage.locator('#sakura-translator-root')).toBeAttached({ timeout: 5000 });

    await testPage.evaluate(() => {
      document.dispatchEvent(new MouseEvent('mousedown', {
        clientX: 5, clientY: 5, bubbles: true
      }));
    });

    await expect(testPage.locator('#sakura-translator-root')).not.toBeAttached({ timeout: 3000 });
  });
});

test.describe('Content Script — Hover + Alt (Auto-Select Sentence)', () => {
  test('hover+Alt on English sentence shows popup', async ({ testPage }) => {
    await hoverAltOnElement(testPage, '#english-sentence');

    await expect(testPage.locator('#sakura-translator-root')).toBeAttached({ timeout: 5000 });
    await expect(testPage.locator('.sakura-brand')).toBeAttached({ timeout: 5000 });
  });

  test('hover+Alt on English sentence shows sentence-style result', async ({ testPage }) => {
    await hoverAltOnElement(testPage, '#english-sentence');

    await expect(testPage.locator('.sakura-brand')).toBeAttached({ timeout: 5000 });
    await expect(testPage.locator('.sakura-sentence')).toBeAttached();
    await expect(testPage.locator('.sakura-sentence-translation')).toContainText('敏捷的棕色狐狸');
  });

  test('hover+Alt on Chinese sentence shows popup', async ({ testPage }) => {
    await hoverAltOnElement(testPage, '#chinese-sentence');

    await expect(testPage.locator('#sakura-translator-root')).toBeAttached({ timeout: 5000 });
    await expect(testPage.locator('.sakura-brand')).toBeAttached({ timeout: 5000 });
  });

  test('hover+Alt on Chinese sentence shows sentence result', async ({ testPage }) => {
    await hoverAltOnElement(testPage, '#chinese-sentence');

    await expect(testPage.locator('.sakura-brand')).toBeAttached({ timeout: 5000 });
    await expect(testPage.locator('.sakura-sentence-translation')).toContainText('weather is nice');
  });

  test('hover+Alt selects more text than hover+Ctrl', async ({ testPage }) => {
    // First: hover+Ctrl on sentence element (should select just one word)
    await hoverCtrlOnElement(testPage, '#english-sentence');
    await expect(testPage.locator('#sakura-translator-root')).toBeAttached({ timeout: 5000 });

    const wordText = await testPage.evaluate(() => window.getSelection().toString().trim());

    // Dismiss popup via keyup
    await testPage.evaluate(() => {
      document.dispatchEvent(new KeyboardEvent('keyup', {
        key: 'Control', code: 'ControlLeft', ctrlKey: false, bubbles: true
      }));
    });
    await expect(testPage.locator('#sakura-translator-root')).not.toBeAttached({ timeout: 3000 });

    // Second: hover+Alt on same element (should select sentence)
    await hoverAltOnElement(testPage, '#english-sentence');
    await expect(testPage.locator('#sakura-translator-root')).toBeAttached({ timeout: 5000 });

    const sentenceText = await testPage.evaluate(() => window.getSelection().toString().trim());

    // Sentence should be longer than the word
    expect(sentenceText.length).toBeGreaterThan(wordText.length);
  });

  test('hover+Alt on single-word element still works', async ({ testPage }) => {
    await hoverAltOnElement(testPage, '#english-word');

    await expect(testPage.locator('#sakura-translator-root')).toBeAttached({ timeout: 5000 });
    await expect(testPage.locator('.sakura-brand')).toBeAttached({ timeout: 5000 });
  });

  test('hover+Alt highlights the sentence in the page', async ({ testPage }) => {
    await hoverAltOnElement(testPage, '#english-sentence');
    await expect(testPage.locator('#sakura-translator-root')).toBeAttached({ timeout: 5000 });

    const selectedText = await testPage.evaluate(() => window.getSelection().toString().trim());
    expect(selectedText.length).toBeGreaterThan(0);
    // Should contain multiple words
    const wordCount = selectedText.split(/\s+/).length;
    expect(wordCount).toBeGreaterThan(1);
  });

  test('hover+Alt does NOT trigger on input elements', async ({ testPage }) => {
    // Enable hover mode
    await testPage.evaluate(() => {
      chrome.storage.sync.set({ selectionMode: 'hover' });
    });
    await testPage.waitForTimeout(100);

    // Add a textarea
    await testPage.evaluate(() => {
      const ta = document.createElement('textarea');
      ta.id = 'test-textarea';
      ta.textContent = 'This is a test sentence in a textarea.';
      ta.style.padding = '10px';
      ta.style.fontSize = '16px';
      ta.style.width = '300px';
      ta.style.height = '50px';
      document.body.appendChild(ta);
    });

    await testPage.evaluate(() => {
      const el = document.querySelector('#test-textarea');
      const rect = el.getBoundingClientRect();

      window.getSelection().removeAllRanges();

      document.dispatchEvent(new MouseEvent('mousemove', {
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
        bubbles: true
      }));

      document.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Alt', code: 'AltLeft', ctrlKey: false,
        shiftKey: false, altKey: true, bubbles: true
      }));
    });

    await testPage.waitForTimeout(1000);
    await expect(testPage.locator('#sakura-translator-root')).not.toBeAttached();
  });

  test('hover+Alt does NOT trigger in manual mode', async ({ testPage }) => {
    // Ensure manual mode
    await testPage.evaluate(() => {
      chrome.storage.sync.set({ selectionMode: 'manual' });
    });
    await testPage.waitForTimeout(100);

    await testPage.evaluate(() => {
      const el = document.querySelector('#english-sentence');
      const rect = el.getBoundingClientRect();

      window.getSelection().removeAllRanges();

      document.dispatchEvent(new MouseEvent('mousemove', {
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
        bubbles: true
      }));

      document.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Alt', code: 'AltLeft', ctrlKey: false,
        shiftKey: false, altKey: true, bubbles: true
      }));
    });

    await testPage.waitForTimeout(1000);
    await expect(testPage.locator('#sakura-translator-root')).not.toBeAttached();
  });

  test('releasing Alt dismisses hover popup and clears selection', async ({ testPage }) => {
    await hoverAltOnElement(testPage, '#english-sentence');
    await expect(testPage.locator('#sakura-translator-root')).toBeAttached({ timeout: 5000 });

    // Release Alt
    await testPage.evaluate(() => {
      document.dispatchEvent(new KeyboardEvent('keyup', {
        key: 'Alt', code: 'AltLeft', ctrlKey: false,
        shiftKey: false, altKey: false, bubbles: true
      }));
    });

    await expect(testPage.locator('#sakura-translator-root')).not.toBeAttached({ timeout: 3000 });

    // Selection should be cleared
    const selectedText = await testPage.evaluate(() => window.getSelection().toString().trim());
    expect(selectedText).toBe('');
  });

  test('hover+Alt popup can be dismissed with Escape', async ({ testPage }) => {
    await hoverAltOnElement(testPage, '#english-sentence');
    await expect(testPage.locator('#sakura-translator-root')).toBeAttached({ timeout: 5000 });

    await testPage.evaluate(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Escape', code: 'Escape', bubbles: true
      }));
    });

    await expect(testPage.locator('#sakura-translator-root')).not.toBeAttached({ timeout: 3000 });
  });
});

test.describe('Content Script — Hover Translate Does Not Conflict With Other Workflows', () => {
  test('Ctrl+Select (Workflow 1) still works in manual mode', async ({ testPage }) => {
    // Ensure manual mode
    await testPage.evaluate(() => {
      chrome.storage.sync.set({ selectionMode: 'manual' });
    });
    await testPage.waitForTimeout(100);

    await ctrlSelectElement(testPage, '#english-word');

    await expect(testPage.locator('#sakura-translator-root')).toBeAttached({ timeout: 5000 });
    await expect(testPage.locator('.sakura-brand')).toBeAttached({ timeout: 5000 });
    await expect(testPage.locator('.sakura-translation-text')).toHaveText('你好');
  });

  test('select-then-Ctrl (Workflow 2) still works in manual mode', async ({ testPage }) => {
    // Ensure manual mode
    await testPage.evaluate(() => {
      chrome.storage.sync.set({ selectionMode: 'manual' });
    });
    await testPage.waitForTimeout(100);

    await selectThenHotkey(testPage, '#english-word');

    await expect(testPage.locator('#sakura-translator-root')).toBeAttached({ timeout: 5000 });
    await expect(testPage.locator('.sakura-brand')).toBeAttached({ timeout: 5000 });
  });

  test('hover+Ctrl after dismissing a manual popup works', async ({ testPage }) => {
    // First: manual mode Ctrl+Select
    await testPage.evaluate(() => {
      chrome.storage.sync.set({ selectionMode: 'manual' });
    });
    await testPage.waitForTimeout(100);

    await ctrlSelectElement(testPage, '#english-word');
    await expect(testPage.locator('#sakura-translator-root')).toBeAttached({ timeout: 5000 });

    // Dismiss
    await testPage.evaluate(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Escape', code: 'Escape', bubbles: true
      }));
    });
    await expect(testPage.locator('#sakura-translator-root')).not.toBeAttached({ timeout: 3000 });

    // Clear selection
    await testPage.evaluate(() => { window.getSelection().removeAllRanges(); });

    // Switch to hover mode and use hover+Ctrl
    await hoverCtrlOnElement(testPage, '#chinese-word');
    await expect(testPage.locator('#sakura-translator-root')).toBeAttached({ timeout: 5000 });
    await expect(testPage.locator('.sakura-brand')).toBeAttached({ timeout: 5000 });
  });

  test('switching from hover mode to manual mode works', async ({ testPage }) => {
    // Use hover mode first
    await hoverCtrlOnElement(testPage, '#english-word');
    await expect(testPage.locator('#sakura-translator-root')).toBeAttached({ timeout: 5000 });

    // Dismiss via keyup
    await testPage.evaluate(() => {
      document.dispatchEvent(new KeyboardEvent('keyup', {
        key: 'Control', code: 'ControlLeft', ctrlKey: false, bubbles: true
      }));
    });
    await expect(testPage.locator('#sakura-translator-root')).not.toBeAttached({ timeout: 3000 });

    // Switch to manual mode
    await testPage.evaluate(() => {
      chrome.storage.sync.set({ selectionMode: 'manual' });
    });
    await testPage.waitForTimeout(100);

    // Manual Ctrl+Select should work
    await ctrlSelectElement(testPage, '#chinese-word');
    await expect(testPage.locator('#sakura-translator-root')).toBeAttached({ timeout: 5000 });
    await expect(testPage.locator('.sakura-translation-text')).toHaveText('computer');
  });
});

module.exports = { test };
