/**
 * Sakura Translator - Background Service Worker
 * Handles translation API calls to avoid CORS issues in content scripts.
 * Uses Google Translate with extended parameters for dictionary-level data.
 * Supports configurable source and target languages.
 * Also intercepts PDF URLs and redirects to the built-in PDF viewer.
 */

// ─── PDF Interception (Manifest V3 compatible) ───
// When Chrome navigates to a URL ending in .pdf, redirect to our custom
// pdf.js viewer which renders the PDF with real DOM text layers, enabling
// the content script's hover/selection translation.
//
// Uses webNavigation.onBeforeNavigate + tabs.update because Manifest V3
// does not support webRequest blocking (webRequestBlocking permission).
// This approach detects PDF navigations and redirects the tab.

const PDF_VIEWER_URL = chrome.runtime.getURL('pdf-viewer.html');

// Track tabs that we've already redirected to avoid infinite loops
const redirectedTabs = new Set();

chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  // Only intercept main frame navigations (not subresources, not iframes)
  if (details.frameId !== 0) return;

  // Check if PDF viewer is enabled in settings
  const settings = await getSettings();
  if (settings.pdfViewerEnabled === false) return;

  const url = details.url;

  // Skip already-redirected URLs (our own viewer)
  if (url.startsWith(PDF_VIEWER_URL)) return;

  // Skip chrome:// and extension:// URLs
  if (url.startsWith('chrome://') || url.startsWith('chrome-extension://')) return;

  // Intercept URLs that end with .pdf (common pattern)
  // Also catch URLs with .pdf?query or .pdf#hash
  const urlWithoutHash = url.split('#')[0].split('?')[0];
  if (urlWithoutHash.toLowerCase().endsWith('.pdf')) {
    // Avoid redirecting the same tab twice
    const tabKey = `${details.tabId}:${url}`;
    if (redirectedTabs.has(tabKey)) {
      redirectedTabs.delete(tabKey);
      return;
    }

    const viewerUrl = `${PDF_VIEWER_URL}?file=${encodeURIComponent(url)}&name=${encodeURIComponent(extractFileName(url))}`;

    // Mark this tab as redirected to prevent loops
    redirectedTabs.add(`${details.tabId}:${viewerUrl}`);

    // Redirect the tab to our viewer
    chrome.tabs.update(details.tabId, { url: viewerUrl });

    // Clean up the tracking entry after a delay
    setTimeout(() => {
      redirectedTabs.delete(`${details.tabId}:${viewerUrl}`);
      redirectedTabs.delete(tabKey);
    }, 5000);
  }
});

/**
 * Extract a readable filename from a URL for display in the PDF viewer toolbar.
 */
function extractFileName(url) {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname;
    const parts = path.split('/');
    const lastPart = parts[parts.length - 1];
    if (lastPart && lastPart.toLowerCase().endsWith('.pdf')) {
      return decodeURIComponent(lastPart);
    }
    // Fallback: use hostname
    return urlObj.hostname || 'PDF Document';
  } catch (e) {
    return 'PDF Document';
  }
}

// ─── API Endpoints ───
const GOOGLE_TRANSLATE_API = 'https://translate.googleapis.com/translate_a/single';

// ─── Supported Languages ───
const SUPPORTED_LANGUAGES = {
  'en': 'English',
  'zh-CN': 'Chinese (Simplified)',
  'zh-TW': 'Chinese (Traditional)',
  'ja': 'Japanese',
  'ko': 'Korean',
  'fr': 'French',
  'de': 'German',
  'es': 'Spanish',
  'pt': 'Portuguese',
  'ru': 'Russian',
  'ar': 'Arabic',
  'hi': 'Hindi',
  'it': 'Italian',
  'nl': 'Dutch',
  'th': 'Thai',
  'vi': 'Vietnamese',
  'id': 'Indonesian',
  'ms': 'Malay',
  'tr': 'Turkish',
  'pl': 'Polish',
  'uk': 'Ukrainian',
  'sv': 'Swedish',
  'da': 'Danish',
  'fi': 'Finnish',
  'no': 'Norwegian',
  'el': 'Greek',
  'cs': 'Czech',
  'ro': 'Romanian',
  'hu': 'Hungarian',
  'he': 'Hebrew'
};

// ─── Settings ───
const DEFAULT_SETTINGS = {
  selectionMode: 'hover',
  hoverWordKey: 'ctrl',
  hoverSentenceKey: 'alt',
  manualKey: 'ctrl',
  sourceLang: 'auto',
  targetLang: 'zh-CN',
  pdfViewerEnabled: true
};

async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (items) => {
      resolve(items);
    });
  });
}

// ─── Message Handler ───
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'translate') {
    handleTranslation(request)
      .then(sendResponse)
      .catch(err => sendResponse({ error: err.message }));
    return true; // Keep message channel open for async response
  }
  if (request.action === 'getSettings') {
    getSettings().then(sendResponse);
    return true;
  }
  if (request.action === 'getSupportedLanguages') {
    sendResponse(SUPPORTED_LANGUAGES);
    return false;
  }
});

/**
 * Route translation request based on type and language.
 * Uses sourceLang/targetLang from settings to determine translation direction.
 */
async function handleTranslation({ text, type, lang }) {
  const settings = await getSettings();
  const { sourceLang, targetLang } = settings;

  if (type === 'word') {
    return await translateWord(text, lang, sourceLang, targetLang);
  } else {
    return await translateSentence(text, lang, sourceLang, targetLang);
  }
}

/**
 * Determine the Google Translate language codes for source/target based on
 * the detected language and user's configured languages.
 *
 * When sourceLang is 'auto':
 *   - Google Translate auto-detects the source language
 *   - If detected language matches targetLang, we swap direction
 *     (e.g. user set target=zh-CN but typed Chinese → translate to English/auto)
 *
 * When sourceLang is a specific language:
 *   - If detected language matches sourceLang → translate to targetLang
 *   - If detected language matches targetLang → translate to sourceLang
 *   - Otherwise → translate from auto-detect to targetLang
 */
function resolveTranslationDirection(detectedLang, sourceLang, targetLang) {
  // ─── Auto-detect mode ───
  if (sourceLang === 'auto') {
    const isTargetChinese = targetLang.startsWith('zh');

    // Only swap when detected language ACTUALLY matches target language
    // (avoid translating Chinese→Chinese or English→English)
    if (detectedLang === 'zh' && isTargetChinese) {
      // Chinese text detected but target is also Chinese → translate to English
      return { from: 'auto', to: 'en' };
    } else if (detectedLang === 'en' && targetLang === 'en') {
      // English text detected but target is also English → translate to Chinese
      return { from: 'auto', to: 'zh-CN' };
    } else {
      // Normal: auto-detect source, translate to target
      // This covers: ja→zh-CN, ko→zh-CN, en→zh-CN, etc.
      return { from: 'auto', to: targetLang };
    }
  }

  // ─── Manual source language mode ───
  // Normalize: map detector's 'zh' to match 'zh-CN' or 'zh-TW'
  const isSourceChinese = sourceLang.startsWith('zh');
  const isTargetChinese = targetLang.startsWith('zh');

  // Check if detected language matches source or target
  const detectedMatchesSource =
    (detectedLang === 'zh' && isSourceChinese) ||
    (detectedLang === 'en' && sourceLang === 'en') ||
    (detectedLang === 'ja' && sourceLang === 'ja') ||
    (detectedLang === 'ko' && sourceLang === 'ko');

  const detectedMatchesTarget =
    (detectedLang === 'zh' && isTargetChinese) ||
    (detectedLang === 'en' && targetLang === 'en') ||
    (detectedLang === 'ja' && targetLang === 'ja') ||
    (detectedLang === 'ko' && targetLang === 'ko');

  if (detectedMatchesSource) {
    // Text is in source language → translate to target
    return { from: sourceLang, to: targetLang };
  } else if (detectedMatchesTarget) {
    // Text is in target language → translate to source (reverse direction)
    return { from: targetLang, to: sourceLang };
  } else {
    // Neither matches → let Google auto-detect, translate to target
    return { from: 'auto', to: targetLang };
  }
}

// ─── Word Translation (Dictionary-level) ───
async function translateWord(word, detectedLang, sourceLang, targetLang) {
  const direction = resolveTranslationDirection(detectedLang, sourceLang, targetLang);

  const result = {
    type: 'word',
    original: word,
    translation: '',
    phonetic: '',
    phonetics: [],
    meanings: [],
    definitions: [],
    examples: [],
    lang: detectedLang,
    engine: 'google'
  };

  const googleResult = await fetchGoogleExtended(word, direction.from, direction.to);
  if (googleResult) {
    result.translation = googleResult.translation || '';
    if (googleResult.srcRomanization) {
      result.phonetic = detectedLang === 'en'
        ? '/' + googleResult.srcRomanization + '/'
        : googleResult.srcRomanization;
    }
    if (googleResult.dictionary && googleResult.dictionary.length > 0) {
      result.meanings = googleResult.dictionary;
    }
    if (googleResult.definitions && googleResult.definitions.length > 0) {
      result.definitions = googleResult.definitions;
    }
    if (googleResult.examples && googleResult.examples.length > 0) {
      result.examples = googleResult.examples;
    }
  }

  return result;
}

// ─── Sentence Translation ───
async function translateSentence(text, detectedLang, sourceLang, targetLang) {
  const direction = resolveTranslationDirection(detectedLang, sourceLang, targetLang);
  const googleResult = await fetchGoogleExtended(text, direction.from, direction.to, ['t']);

  return {
    type: 'sentence',
    original: text,
    translation: (googleResult && googleResult.translation) || 'Translation failed.',
    lang: detectedLang,
    engine: 'google'
  };
}

// ─── API: Google Translate Extended (Free endpoint) ───
// Uses configurable dt parameters:
//   dt=t  → translation
//   dt=bd → dictionary (part of speech + alternative translations)
//   dt=rm → romanization/pinyin
//   dt=md → definitions
//   dt=ex → examples
async function fetchGoogleExtended(text, fromLang, toLang, dtParams = ['t', 'bd', 'rm', 'md', 'ex']) {
  const googleFrom = mapToGoogleLang(fromLang);
  const googleTo = mapToGoogleLang(toLang);

  const url = new URL(GOOGLE_TRANSLATE_API);
  url.searchParams.set('client', 'gtx');
  url.searchParams.set('sl', googleFrom);
  url.searchParams.set('tl', googleTo);
  url.searchParams.set('q', text);
  for (const dt of dtParams) {
    url.searchParams.append('dt', dt);
  }

  try {
    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) throw new Error(`Google Translate HTTP ${response.status}`);
    const data = await response.json();

    return parseGoogleExtendedResponse(data);
  } catch (e) {
    console.warn('[Sakura] Google Translate API error:', e.message);
    return null;
  }
}

/**
 * Parse the extended Google Translate response.
 * The response is an array with different indices for different dt params.
 *
 * data[0] = translation segments: [[translatedText, originalText, ...], ...]
 *           Last sub-array often contains romanization: [null, null, tgtRoman, srcRoman]
 * data[1] = dictionary (dt=bd): [[partOfSpeech, [translations], [[word, [reverseTranslations], null, score], ...]], ...]
 * Other indices vary: source language, definitions (dt=md), synonyms (dt=ss), examples (dt=ex)
 */
function parseGoogleExtendedResponse(data) {
  if (!data) return null;

  const result = {
    translation: '',
    srcRomanization: '',
    tgtRomanization: '',
    dictionary: [],
    definitions: [],
    examples: []
  };

  // ─── Translation (data[0]) ───
  if (data[0] && Array.isArray(data[0])) {
    const translationParts = [];
    for (const segment of data[0]) {
      if (!Array.isArray(segment)) continue;
      // Translation segments: [translatedText, originalText, ...]
      // Use strict type check — segment[0] can be "" (empty string) which is falsy
      // but still a valid translation part (e.g. for whitespace/punctuation segments)
      if (typeof segment[0] === 'string') {
        translationParts.push(segment[0]);
      }
      // Romanization is in a segment like [null, null, tgtRoman, srcRoman]
      // segment[2] = target language romanization (e.g. pinyin for Chinese translation)
      // segment[3] = source language romanization (e.g. rough pronunciation of English word)
      if (segment[0] === null && segment.length >= 4) {
        if (segment[2]) result.tgtRomanization = segment[2];
        if (segment[3]) result.srcRomanization = segment[3];
      }
    }
    result.translation = translationParts.join('');
  }

  // ─── Dictionary (data[1] when dt=bd) ───
  if (data[1] && Array.isArray(data[1])) {
    for (const entry of data[1]) {
      if (!Array.isArray(entry) || !entry[0]) continue;
      const partOfSpeech = entry[0]; // e.g. "interjection", "noun", "verb"
      const detailedEntries = entry[2]; // [[word, [reverseTranslations], null, score], ...]

      const definitions = [];
      if (Array.isArray(detailedEntries)) {
        for (const detail of detailedEntries) {
          if (!Array.isArray(detail)) continue;
          const word = detail[0];
          definitions.push({
            definition: word,
          });
        }
      }

      if (definitions.length > 0) {
        result.dictionary.push({
          partOfSpeech,
          definitions: definitions.slice(0, 5) // Limit to 5 per part of speech
        });
      }
    }
  }

  // ─── Definitions (dt=md) — scan all indices ───
  // md blocks look like: [[partOfSpeech, [[definition, oxfordId, example, ...], ...], baseWord, flag], ...]
  // Note: d[0] = definition text, d[1] = Oxford dictionary ID (e.g. "m_en_gbus1084190.008"), d[2] = example sentence
  for (let i = 2; i < data.length; i++) {
    if (Array.isArray(data[i]) && data[i].length > 0 && Array.isArray(data[i][0])) {
      const block = data[i];
      for (const group of block) {
        if (!Array.isArray(group) || typeof group[0] !== 'string') continue;
        const pos = group[0];
        const defs = group[1];
        if (!Array.isArray(defs)) continue;
        // Check if this looks like a definitions block (array of arrays with strings)
        const isDefBlock = defs.every(d => Array.isArray(d) && typeof d[0] === 'string');
        if (!isDefBlock) continue;

        const defItems = [];
        for (const d of defs) {
          defItems.push({
            definition: d[0],
            // d[1] is the Oxford dictionary ID (skip it), d[2] is the example sentence
            example: (typeof d[2] === 'string' && d[2].length > 0) ? d[2] : undefined
          });
        }
        if (defItems.length > 0) {
          result.definitions.push({
            partOfSpeech: pos,
            definitions: defItems.slice(0, 3)
          });
        }
      }
    }
  }

  // ─── Examples (dt=ex) — scan for example blocks ───
  for (let i = 2; i < data.length; i++) {
    if (Array.isArray(data[i]) && data[i].length > 0) {
      const block = data[i];
      // Example blocks look like: [[[exampleHtml, null, null, ...], ...]]
      if (Array.isArray(block[0]) && Array.isArray(block[0][0])) {
        const exBlock = block[0];
        for (const ex of exBlock) {
          if (Array.isArray(ex) && typeof ex[0] === 'string') {
            // Strip HTML tags from examples
            const cleanExample = ex[0].replace(/<[^>]+>/g, '');
            result.examples.push(cleanExample);
          }
        }
      }
    }
  }

  return result;
}

/**
 * Map language codes to Google Translate language codes.
 * Most codes are already Google-compatible (e.g. 'en', 'ja', 'zh-CN').
 * This handles edge cases from the detector ('zh', 'mixed').
 */
function mapToGoogleLang(lang) {
  const map = {
    'zh': 'zh-CN',
    'mixed': 'auto',
    'auto': 'auto'
  };
  return map[lang] || lang;
}
