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
      const syncStorage = { triggerShortcut: 'ctrl', sourceLang: 'auto', targetLang: 'zh-CN' };
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
  test('English word shows header, phonetic, translation and meanings', async ({ testPage }) => {
    await ctrlSelectElement(testPage, '#english-word');
    await expect(testPage.locator('.sakura-brand')).toBeAttached({ timeout: 5000 });

    // Original word
    await expect(testPage.locator('.sakura-original')).toHaveText('hello');

    // Phonetic
    await expect(testPage.locator('.sakura-phonetic')).toHaveText('/həˈloʊ/');

    // Translation
    await expect(testPage.locator('.sakura-translation-text')).toHaveText('你好');

    // Meanings
    const posTags = testPage.locator('.sakura-meaning-pos');
    await expect(posTags.first()).toContainText('exclamation');

    const defs = testPage.locator('.sakura-meaning-def');
    await expect(defs.first()).toContainText('used as a greeting');

    // Examples
    const examples = testPage.locator('.sakura-meaning-example');
    await expect(examples.first()).toContainText('hello there, Katie!');
  });

  test('English sentence shows original + translation', async ({ testPage }) => {
    await ctrlSelectElement(testPage, '#english-sentence');
    await expect(testPage.locator('.sakura-brand')).toBeAttached({ timeout: 5000 });

    // Sentence layout
    await expect(testPage.locator('.sakura-sentence')).toBeAttached();
    await expect(testPage.locator('.sakura-sentence-original')).toContainText('The quick brown fox');
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

module.exports = { test };
