/**
 * Sakura Translator - Content Script
 * Detects hotkey+selection and shows translation popup.
 * Supports: select-then-hotkey and hotkey-then-select workflows.
 */

(() => {
  // ─── State ───
  let popupRoot = null;
  let currentAudio = null;
  let selectionMode = 'hover';   // 'manual' = drag-select, 'hover' = auto-hover select
  let hoverWordKey = 'ctrl';     // key for hover word selection
  let hoverSentenceKey = 'alt';  // key for hover sentence selection
  let manualKey = 'ctrl';        // key for manual mode trigger
  let sourceLang = 'auto';       // default source language (auto-detect)
  let targetLang = 'zh-CN';      // default target language
  let hoverTriggeredPopup = false; // track if current popup was triggered by hover mode

  // ─── Part-of-speech translation map ───
  const POS_TRANSLATIONS = {
    'zh-CN': {
      'noun': '名词', 'verb': '动词', 'adjective': '形容词', 'adverb': '副词',
      'pronoun': '代词', 'preposition': '介词', 'conjunction': '连词',
      'interjection': '感叹词', 'exclamation': '感叹词', 'determiner': '限定词',
      'article': '冠词', 'numeral': '数词', 'particle': '助词',
      'abbreviation': '缩写', 'affix': '词缀', 'phrase': '短语',
      'idiom': '习语', 'prefix': '前缀', 'suffix': '后缀',
      'auxiliary verb': '助动词', 'transitive verb': '及物动词',
      'intransitive verb': '不及物动词', 'phrasal verb': '短语动词',
    },
    'zh-TW': {
      'noun': '名詞', 'verb': '動詞', 'adjective': '形容詞', 'adverb': '副詞',
      'pronoun': '代詞', 'preposition': '介詞', 'conjunction': '連詞',
      'interjection': '感嘆詞', 'exclamation': '感嘆詞', 'determiner': '限定詞',
      'article': '冠詞', 'numeral': '數詞', 'particle': '助詞',
      'abbreviation': '縮寫', 'affix': '詞綴', 'phrase': '短語',
      'idiom': '慣用語', 'prefix': '前綴', 'suffix': '後綴',
      'auxiliary verb': '助動詞', 'transitive verb': '及物動詞',
      'intransitive verb': '不及物動詞', 'phrasal verb': '片語動詞',
    },
    'ja': {
      'noun': '名詞', 'verb': '動詞', 'adjective': '形容詞', 'adverb': '副詞',
      'pronoun': '代名詞', 'preposition': '前置詞', 'conjunction': '接続詞',
      'interjection': '感動詞', 'exclamation': '感動詞', 'determiner': '限定詞',
      'article': '冠詞', 'numeral': '数詞', 'particle': '助詞',
      'abbreviation': '略語', 'phrase': 'フレーズ', 'idiom': '慣用句',
    },
    'ko': {
      'noun': '명사', 'verb': '동사', 'adjective': '형용사', 'adverb': '부사',
      'pronoun': '대명사', 'preposition': '전치사', 'conjunction': '접속사',
      'interjection': '감탄사', 'exclamation': '감탄사', 'determiner': '한정사',
      'article': '관사', 'numeral': '수사', 'particle': '조사',
    },
    'fr': {
      'noun': 'nom', 'verb': 'verbe', 'adjective': 'adjectif', 'adverb': 'adverbe',
      'pronoun': 'pronom', 'preposition': 'préposition', 'conjunction': 'conjonction',
      'interjection': 'interjection', 'exclamation': 'exclamation', 'determiner': 'déterminant',
      'article': 'article', 'phrase': 'expression', 'idiom': 'idiome',
    },
    'de': {
      'noun': 'Substantiv', 'verb': 'Verb', 'adjective': 'Adjektiv', 'adverb': 'Adverb',
      'pronoun': 'Pronomen', 'preposition': 'Präposition', 'conjunction': 'Konjunktion',
      'interjection': 'Interjektion', 'exclamation': 'Ausruf', 'determiner': 'Artikel',
      'article': 'Artikel', 'phrase': 'Redewendung', 'idiom': 'Idiom',
    },
    'es': {
      'noun': 'sustantivo', 'verb': 'verbo', 'adjective': 'adjetivo', 'adverb': 'adverbio',
      'pronoun': 'pronombre', 'preposition': 'preposición', 'conjunction': 'conjunción',
      'interjection': 'interjección', 'exclamation': 'exclamación', 'determiner': 'determinante',
      'article': 'artículo', 'phrase': 'frase', 'idiom': 'modismo',
    },
  };

  function translatePOS(pos) {
    const lang = targetLang || 'en';
    const map = POS_TRANSLATIONS[lang];
    if (!map) return pos; // No translation available, keep original English
    const key = pos.toLowerCase().trim();
    return map[key] || pos; // Fallback to original if not found
  }

  // ─── Localize UI labels ───
  const LABEL_TRANSLATIONS = {
    'zh-CN': { definitions: '释义', examples: '例句' },
    'zh-TW': { definitions: '釋義', examples: '例句' },
    'ja': { definitions: '定義', examples: '例文' },
    'ko': { definitions: '정의', examples: '예문' },
    'fr': { definitions: 'Définitions', examples: 'Exemples' },
    'de': { definitions: 'Definitionen', examples: 'Beispiele' },
    'es': { definitions: 'Definiciones', examples: 'Ejemplos' },
  };

  function localizeLabel(key) {
    const lang = targetLang || 'en';
    const map = LABEL_TRANSLATIONS[lang];
    if (map && map[key]) return map[key];
    // Fallback to English with capitalize
    const fallback = { definitions: 'Definitions', examples: 'Examples' };
    return fallback[key] || key;
  }

  // ─── Load settings ───
  function loadSettings() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.get(
        { selectionMode: 'hover', hoverWordKey: 'ctrl', hoverSentenceKey: 'alt', manualKey: 'ctrl', sourceLang: 'auto', targetLang: 'zh-CN' },
        (items) => {
          selectionMode = items.selectionMode || 'hover';
          hoverWordKey = items.hoverWordKey || 'ctrl';
          hoverSentenceKey = items.hoverSentenceKey || 'alt';
          manualKey = items.manualKey || 'ctrl';
          sourceLang = items.sourceLang || 'en';
          targetLang = items.targetLang || 'zh-CN';
        }
      );
    }
  }
  loadSettings();

  // Listen for settings changes in real-time
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync') {
        if (changes.selectionMode) {
          selectionMode = changes.selectionMode.newValue || 'hover';
        }
        if (changes.hoverWordKey) {
          hoverWordKey = changes.hoverWordKey.newValue || 'ctrl';
        }
        if (changes.hoverSentenceKey) {
          hoverSentenceKey = changes.hoverSentenceKey.newValue || 'alt';
        }
        if (changes.manualKey) {
          manualKey = changes.manualKey.newValue || 'ctrl';
        }
        if (changes.sourceLang) {
          sourceLang = changes.sourceLang.newValue || 'auto';
        }
        if (changes.targetLang) {
          targetLang = changes.targetLang.newValue || 'zh-CN';
        }
      }
    });
  }

  // ─── Key matching helpers ───
  function isKeyActive(key, e) {
    switch (key) {
      case 'ctrl+shift':
        return e.ctrlKey && e.shiftKey;
      case 'alt':
        return e.altKey && !e.ctrlKey && !e.shiftKey;
      case 'shift':
        return e.shiftKey && !e.ctrlKey && !e.altKey;
      case 'ctrl':
      default:
        return e.ctrlKey && !e.shiftKey && !e.altKey;
    }
  }

  function isKeyDown(key, e) {
    switch (key) {
      case 'ctrl+shift':
        return (e.key === 'Control' || e.key === 'Shift') && e.ctrlKey && e.shiftKey;
      case 'alt':
        return e.key === 'Alt' && e.altKey && !e.ctrlKey && !e.shiftKey;
      case 'shift':
        return e.key === 'Shift' && e.shiftKey && !e.ctrlKey && !e.altKey;
      case 'ctrl':
      default:
        return e.key === 'Control' && e.ctrlKey && !e.shiftKey && !e.altKey;
    }
  }

  // ─── Manual mode shortcut matching ───
  function isShortcutActive(e) {
    return isKeyActive(manualKey, e);
  }

  function isShortcutKeyDown(e) {
    return isKeyDown(manualKey, e);
  }

  // ─── Workflow 1: Hotkey held + mouseup (original behavior) ───
  document.addEventListener('mouseup', async (e) => {
    if (!isShortcutActive(e)) return;

    const selection = window.getSelection();
    const text = selection?.toString().trim();

    if (!text || text.length === 0 || text.length > 2000) return;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    showPopup(rect, text);
  });

  // ─── Workflow 2: Select first, then press hotkey ───
  document.addEventListener('keydown', (e) => {
    // Skip if popup is already showing
    if (popupRoot) return;

    if (!isShortcutKeyDown(e)) return;

    const selection = window.getSelection();
    const text = selection?.toString().trim();

    if (!text || text.length === 0 || text.length > 2000) return;

    // Must have a valid range
    if (selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // Ignore collapsed selections (no actual selection)
    if (rect.width === 0 && rect.height === 0) return;

    showPopup(rect, text);
  });

  // ─── Workflow 3: Hover + Ctrl = auto-select word, Hover + Alt = auto-select sentence ───
  // Only active when selectionMode === 'hover'
  let lastMouseX = 0;
  let lastMouseY = 0;

  document.addEventListener('mousemove', (e) => {
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  });

  document.addEventListener('keydown', (e) => {
    // Only active in hover mode
    if (selectionMode !== 'hover') return;

    // Check if either hover word key or hover sentence key is being pressed
    const isWordKey = isKeyDown(hoverWordKey, e);
    const isSentenceKey = isKeyDown(hoverSentenceKey, e);

    if (!isWordKey && !isSentenceKey) return;
    if (popupRoot) return;

    // Prevent browser default behavior (Alt activates Chrome menu bar)
    e.preventDefault();

    // If user already has text selected, let Workflow 2 handle it
    const existingSelection = window.getSelection();
    const existingText = existingSelection?.toString().trim();
    if (existingText && existingText.length > 0) return;

    // Get the element under the cursor
    const elementUnderCursor = document.elementFromPoint(lastMouseX, lastMouseY);
    if (!elementUnderCursor) return;

    // Don't trigger on inputs, textareas, contenteditable, or our own popup
    if (isEditableElement(elementUnderCursor)) return;
    if (elementUnderCursor.closest('#sakura-translator-root')) return;

    // Get the text node and offset at cursor position
    const caretInfo = getCaretInfoFromPoint(lastMouseX, lastMouseY);
    if (!caretInfo || !caretInfo.node || caretInfo.node.nodeType !== Node.TEXT_NODE) return;

    const textNode = caretInfo.node;
    const offset = caretInfo.offset;
    const fullText = textNode.textContent;

    if (!fullText || fullText.trim().length === 0) return;

    let extracted;
    if (isSentenceKey) {
      extracted = extractSentenceAtOffset(fullText, offset, textNode);
    } else {
      extracted = extractWordAtOffset(fullText, offset);
    }

    if (!extracted || !extracted.text || extracted.text.trim().length === 0) return;
    if (extracted.text.length > 2000) return;

    // Create a range for the extracted text to highlight and position popup
    const range = document.createRange();
    if (extracted.rangePoints) {
      // Sentence mode with precise text node mapping
      range.setStart(extracted.rangePoints.startNode, extracted.rangePoints.startOff);
      range.setEnd(extracted.rangePoints.endNode, extracted.rangePoints.endOff);
    } else if (extracted.useParent && extracted.parentEl) {
      // Sentence mode fallback: select the entire parent element content
      range.selectNodeContents(extracted.parentEl);
    } else {
      range.setStart(textNode, extracted.start);
      range.setEnd(textNode, extracted.end);
    }

    // Highlight the text by selecting it
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);

    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;

    // Mark this popup as hover-triggered so keyup can dismiss it
    hoverTriggeredPopup = true;
    showPopup(rect, extracted.text.trim());
  });

  // ─── Helper: Check if element is an editable input ───
  function isEditableElement(el) {
    if (!el) return false;
    const tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (el.isContentEditable) return true;
    return false;
  }

  // ─── Helper: Get caret position from screen coordinates ───
  function getCaretInfoFromPoint(x, y) {
    // Modern browsers
    if (document.caretPositionFromPoint) {
      const pos = document.caretPositionFromPoint(x, y);
      if (pos) return { node: pos.offsetNode, offset: pos.offset };
    }
    // WebKit/Blink (Chrome, Safari, Edge)
    if (document.caretRangeFromPoint) {
      const range = document.caretRangeFromPoint(x, y);
      if (range) return { node: range.startContainer, offset: range.startOffset };
    }
    return null;
  }

  // ─── Helper: Extract a word at the given offset in text ───
  function extractWordAtOffset(text, offset) {
    if (offset < 0 || offset > text.length) return null;

    // Check if the character at offset is Chinese
    const CHINESE_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf]/;
    const charAtOffset = text[offset] || text[offset - 1];

    if (charAtOffset && CHINESE_REGEX.test(charAtOffset)) {
      // Chinese: extract contiguous Chinese characters around offset
      return extractChineseWordAtOffset(text, offset);
    }

    // Non-Chinese: extract word bounded by whitespace/punctuation
    return extractAlphaWordAtOffset(text, offset);
  }

  function extractChineseWordAtOffset(text, offset) {
    const CHINESE_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf]/;

    // Find start: scan left while Chinese
    let start = offset;
    while (start > 0 && CHINESE_REGEX.test(text[start - 1])) {
      start--;
    }

    // Find end: scan right while Chinese
    let end = offset;
    while (end < text.length && CHINESE_REGEX.test(text[end])) {
      end++;
    }

    // Limit Chinese "word" to max 4 characters (common word length)
    // If more than 4, just take up to 4 centered on offset
    if (end - start > 4) {
      const mid = offset;
      start = Math.max(start, mid - 2);
      end = Math.min(end, start + 4);
    }

    const word = text.substring(start, end);
    return word.length > 0 ? { text: word, start, end } : null;
  }

  function extractAlphaWordAtOffset(text, offset) {
    // Word characters: letters, digits, hyphens, apostrophes
    const WORD_CHAR = /[a-zA-Z0-9'-\u00C0-\u024F]/;

    // If offset is at end, move back
    let pos = offset;
    if (pos >= text.length) pos = text.length - 1;
    if (pos < 0) return null;

    // If character at pos is not a word char, try pos-1
    if (!WORD_CHAR.test(text[pos])) {
      pos = pos - 1;
      if (pos < 0 || !WORD_CHAR.test(text[pos])) return null;
    }

    // Scan left
    let start = pos;
    while (start > 0 && WORD_CHAR.test(text[start - 1])) {
      start--;
    }

    // Scan right
    let end = pos + 1;
    while (end < text.length && WORD_CHAR.test(text[end])) {
      end++;
    }

    const word = text.substring(start, end);
    return word.length > 0 ? { text: word, start, end } : null;
  }

  // ─── Helper: Extract a sentence at the given offset in text ───
  function extractSentenceAtOffset(text, offset, textNode) {
    // First try to get sentence from the full text of the parent element
    // (sentences often span multiple text nodes)
    const parentEl = textNode.parentElement;
    if (parentEl) {
      const parentText = parentEl.textContent || '';
      // Calculate the offset within the parent element's full text
      const parentOffset = getOffsetInParent(textNode, offset, parentEl);
      if (parentOffset !== null && parentText.trim().length > 0) {
        const result = extractSentenceBoundaries(parentText, parentOffset);
        if (result) {
          // Map parent-level boundaries back to exact DOM text node positions
          // so we highlight only the sentence, not the entire parent element
          const rangePoints = mapParentOffsetsToTextNodes(parentEl, result.start, result.end);
          if (rangePoints) {
            return {
              text: result.text,
              start: 0,
              end: 0,
              useParent: false,
              rangePoints: rangePoints
            };
          }
          // Fallback: if mapping fails, select the entire parent
          return {
            text: result.text,
            start: 0,
            end: textNode.textContent.length,
            useParent: true,
            parentEl: parentEl
          };
        }
      }
    }

    // Fallback: extract from the text node's own text
    const result = extractSentenceBoundaries(text, offset);
    if (result) {
      return { text: result.text, start: result.start, end: result.end };
    }
    return null;
  }

  // ─── Helper: Map parent-level character offsets to DOM text node positions ───
  // Given a start and end offset within parentEl.textContent, find the exact
  // text nodes and offsets within them for creating a precise Range.
  function mapParentOffsetsToTextNodes(parentEl, startOffset, endOffset) {
    const walker = document.createTreeWalker(parentEl, NodeFilter.SHOW_TEXT, null);
    let accumulated = 0;
    let startNode = null, startOff = 0;
    let endNode = null, endOff = 0;
    let current;

    while ((current = walker.nextNode())) {
      const len = current.textContent.length;
      const nodeStart = accumulated;
      const nodeEnd = accumulated + len;

      // Find the start point
      if (!startNode && startOffset >= nodeStart && startOffset <= nodeEnd) {
        startNode = current;
        startOff = startOffset - nodeStart;
      }

      // Find the end point
      if (endOffset >= nodeStart && endOffset <= nodeEnd) {
        endNode = current;
        endOff = endOffset - nodeStart;
      }

      accumulated += len;
    }

    if (startNode && endNode) {
      return { startNode, startOff, endNode, endOff };
    }
    return null;
  }

  function getOffsetInParent(textNode, offsetInNode, parentEl) {
    const walker = document.createTreeWalker(parentEl, NodeFilter.SHOW_TEXT, null);
    let accumulated = 0;
    let current;
    while ((current = walker.nextNode())) {
      if (current === textNode) {
        return accumulated + offsetInNode;
      }
      accumulated += current.textContent.length;
    }
    return null;
  }

  function extractSentenceBoundaries(text, offset) {
    if (!text || text.trim().length === 0) return null;

    // Sentence-ending punctuation (English + Chinese)
    const SENTENCE_END = /[.!?。！？；\n]/;

    // Clamp offset
    let pos = Math.min(offset, text.length - 1);
    if (pos < 0) pos = 0;

    // Find start: scan left for sentence boundary
    let start = pos;
    while (start > 0 && !SENTENCE_END.test(text[start - 1])) {
      start--;
    }

    // Find end: scan right for sentence boundary
    let end = pos;
    while (end < text.length && !SENTENCE_END.test(text[end])) {
      end++;
    }
    // Include the sentence-ending punctuation
    if (end < text.length && SENTENCE_END.test(text[end])) {
      end++;
    }

    const sentence = text.substring(start, end).trim();
    return sentence.length > 0 ? { text: sentence, start, end } : null;
  }

  // ─── Dismiss on click outside / Escape ───
  function isClickInsidePopup(e) {
    if (!popupRoot) return false;
    // Direct check on the host element
    if (popupRoot.contains(e.target)) return true;
    // Check composed path for shadow DOM clicks
    if (e.composedPath && e.composedPath().includes(popupRoot)) return true;
    return false;
  }

  document.addEventListener('mousedown', (e) => {
    if (popupRoot && !isClickInsidePopup(e)) {
      const wasHover = hoverTriggeredPopup;
      removePopup();
      hoverTriggeredPopup = false;
      // Clear the auto-selection that was created by hover mode
      if (wasHover) {
        window.getSelection().removeAllRanges();
      }
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && popupRoot) {
      const wasHover = hoverTriggeredPopup;
      removePopup();
      hoverTriggeredPopup = false;
      // Clear the auto-selection that was created by hover mode
      if (wasHover) {
        window.getSelection().removeAllRanges();
      }
    }
  });

  // ─── CSS injection into shadow DOM ───
  // Returns a CSS URL (for extension) or null (for test/fallback)
  function getExtensionCSSUrl() {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
        return chrome.runtime.getURL('content/content.css');
      }
    } catch (e) { /* not in extension context */ }
    return null;
  }

  // Inject CSS into a shadow root. Uses <link> for extension (most reliable),
  // falls back to <style> with stylesheet content for test environments.
  function injectCSSIntoShadow(shadow) {
    const cssUrl = getExtensionCSSUrl();

    if (cssUrl) {
      // In real extension: use <link> tag pointing to the CSS file.
      // This is the most reliable method — no fetch, no CORS, no timing issues.
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = cssUrl;
      shadow.appendChild(link);

      // Also add inline critical styles as immediate fallback while <link> loads
      const fallback = document.createElement('style');
      fallback.textContent = CRITICAL_POPUP_CSS;
      shadow.appendChild(fallback);

      // Once the <link> loads, remove the fallback to avoid duplication
      link.addEventListener('load', () => { fallback.remove(); });
      link.addEventListener('error', () => { /* fallback stays */ });
      return;
    }

    // Test / non-extension fallback: read CSS from document stylesheets
    let cssText = '';
    for (const sheet of document.styleSheets) {
      try {
        const rules = Array.from(sheet.cssRules || []);
        const hasSakura = rules.some(r => r.cssText && r.cssText.includes('sakura-popup'));
        if (hasSakura) {
          cssText = rules.map(r => r.cssText).join('\n');
          break;
        }
      } catch (e) {
        // Cross-origin stylesheet, skip
      }
    }

    const styleEl = document.createElement('style');
    styleEl.textContent = cssText || CRITICAL_POPUP_CSS;
    shadow.appendChild(styleEl);
  }

    // Minimal inline CSS to ensure the popup is never transparent,
  // even if the external stylesheet fails to load.
  // Includes dark mode support via prefers-color-scheme media query.
  const CRITICAL_POPUP_CSS = `
    :host {
      position: fixed;
      z-index: 2147483647;
      pointer-events: none;
    }
    .sakura-popup {
      pointer-events: auto;
      position: absolute;
      min-width: 280px;
      max-width: 420px;
      max-height: 400px;
      overflow-y: auto;
      overflow-x: hidden;
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06);
      padding: 6px;
      color: #1f2937;
      font-size: 14px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans SC', sans-serif;
      line-height: 1.5;
      word-wrap: break-word;
      overflow-wrap: break-word;
      box-sizing: border-box;
    }
    .sakura-popup * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: inherit;
      line-height: 1.5;
    }
    .sakura-header { padding: 10px 14px; border-bottom: 1px solid #f3f4f6; display: flex; align-items: center; justify-content: space-between; gap: 8px; overflow: hidden; }
    .sakura-header-left { display: flex; align-items: baseline; gap: 10px; flex: 1; min-width: 0; overflow: hidden; }
    .sakura-original { font-size: 17px; font-weight: 600; word-break: break-word; }
    .sakura-phonetic { font-size: 13px; color: #6b7280; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex-shrink: 1; min-width: 0; }
    .sakura-audio-btn { flex-shrink: 0; width: 28px; height: 28px; border: none; background: #f3f4f6; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; }
    .sakura-audio-btn svg { width: 16px; height: 16px; fill: #6b7280; }
    .sakura-translation { padding: 8px 14px 6px; }
    .sakura-translation-text { font-size: 16px; font-weight: 500; color: #2563eb; background: #eff6ff; display: inline-block; padding: 2px 8px; border-radius: 6px; }
    .sakura-divider { height: 1px; background: #f3f4f6; margin: 4px 14px; }
    .sakura-meanings { padding: 6px 14px 8px; }
    .sakura-meaning-group { margin-bottom: 10px; }
    .sakura-meaning-pos { display: inline-block; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #e11d48; background: rgba(225, 29, 72, 0.08); padding: 1px 6px; border-radius: 4px; margin-bottom: 4px; }
    .sakura-translations-list { font-size: 14px; font-weight: 500; margin: 4px 0 2px 0; line-height: 1.6; }
    .sakura-def-item { font-size: 13px; margin: 4px 0; display: flex; gap: 6px; }
    .sakura-def-number { color: #9ca3af; font-weight: 600; flex-shrink: 0; }
    .sakura-def-text { flex: 1; min-width: 0; word-break: break-word; }
    .sakura-meaning-example { font-size: 12px; color: #9ca3af; font-style: italic; border-left: 2px solid #e5e7eb; padding-left: 8px; margin: 2px 0 8px 2px; }
    .sakura-section-title { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #9ca3af; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid #f3f4f6; }
    .sakura-example-item { font-size: 12px; color: #6b7280; font-style: italic; border-left: 2px solid #e5e7eb; padding-left: 8px; margin: 4px 0 4px 2px; line-height: 1.6; }
    .sakura-brand { padding: 4px 14px 6px; text-align: right; font-size: 10px; color: #d1d5db; display: flex; align-items: center; justify-content: flex-end; gap: 4px; }
    .sakura-brand-icon { flex-shrink: 0; vertical-align: middle; }
    @media (prefers-color-scheme: dark) {
      .sakura-popup {
        background: #1e1e2e;
        border-color: #313244;
        color: #cdd6f4;
        box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.2);
      }
      .sakura-header { border-bottom-color: #313244; }
      .sakura-original { color: #cdd6f4; }
      .sakura-phonetic { color: #a6adc8; }
      .sakura-audio-btn { background: #313244; }
      .sakura-audio-btn svg { fill: #a6adc8; }
      .sakura-translation-text { color: #89b4fa; background: rgba(137, 180, 250, 0.1); }
      .sakura-divider { background: #313244; }
      .sakura-meaning-pos { color: #f38ba8; background: rgba(243, 139, 168, 0.1); }
      .sakura-translations-list { color: #cdd6f4; }
      .sakura-def-item { color: #bac2de; }
      .sakura-meaning-example { color: #a6adc8; border-left-color: #45475a; }
      .sakura-section-title { color: #a6adc8; border-bottom-color: #313244; }
      .sakura-example-item { color: #a6adc8; border-left-color: #45475a; }
      .sakura-brand { color: #585b70; }
    }
  `;

  // ─── Show popup ───
  async function showPopup(rect, text) {
    removePopup();

    // Create root container
    popupRoot = document.createElement('div');
    popupRoot.id = 'sakura-translator-root';
    // Apply critical host styles inline so host page CSS cannot override them
    popupRoot.style.cssText = 'position:fixed!important;z-index:2147483647!important;pointer-events:none!important;top:0!important;left:0!important;width:0!important;height:0!important;overflow:visible!important;margin:0!important;padding:0!important;border:none!important;background:transparent!important;';
    document.body.appendChild(popupRoot);

    // Create shadow root for CSS isolation from host page
    const shadow = popupRoot.attachShadow({ mode: 'open' });

    // Inject CSS into shadow root
    injectCSSIntoShadow(shadow);

    // Create popup element
    const popup = document.createElement('div');
    popup.className = 'sakura-popup';

    // Position popup
    positionPopup(popup, rect);

    // Show loading state
    popup.innerHTML = renderLoading();
    shadow.appendChild(popup);

    // Detect text type
    const detected = SakuraDetector.detect(text);

    try {
      // Fetch translation
      const result = await SakuraTranslator.translate(
        detected.text,
        detected.type,
        detected.lang
      );

      // Render result
      if (!popupRoot) return; // Popup was dismissed during fetch
      popup.innerHTML = result.type === 'word'
        ? renderWordResult(result)
        : renderSentenceResult(result);

      // Re-position after content change
      positionPopup(popup, rect);

      // Bind audio buttons
      bindAudioButtons(popup);

    } catch (err) {
      if (!popupRoot) return;
      popup.innerHTML = renderError(err.message);
    }
  }

  // ─── Position popup near selection ───
  function positionPopup(popup, rect) {
    const MARGIN = 8;
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;

    // Position below the selection
    let top = rect.bottom + MARGIN;
    let left = rect.left;

    // Convert to fixed positioning
    popup.style.position = 'fixed';
    popup.style.top = `${rect.bottom + MARGIN}px`;
    popup.style.left = `${rect.left}px`;

    // After rendering, check if popup goes off screen
    requestAnimationFrame(() => {
      const popupRect = popup.getBoundingClientRect();
      const viewWidth = window.innerWidth;
      const viewHeight = window.innerHeight;

      // Adjust horizontal
      if (popupRect.right > viewWidth - MARGIN) {
        popup.style.left = `${viewWidth - popupRect.width - MARGIN}px`;
      }
      if (popupRect.left < MARGIN) {
        popup.style.left = `${MARGIN}px`;
      }

      // If goes below viewport, show above selection
      if (popupRect.bottom > viewHeight - MARGIN) {
        popup.style.top = `${rect.top - popupRect.height - MARGIN}px`;
      }
    });
  }

  // ─── Remove popup ───
  function removePopup() {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
    if (popupRoot) {
      popupRoot.remove();
      popupRoot = null;
    }
  }

  // ─── Render: Loading ───
  function renderLoading() {
    return `
      <div class="sakura-loading">
        <div class="sakura-loading-bar"></div>
      </div>
      <div class="sakura-brand">${renderBrandIcon()} Sakura Translator</div>
    `;
  }

  // ─── Render: Error ───
  function renderError(message) {
    return `
      <div class="sakura-error">⚠ ${escapeHtml(message)}</div>
      <div class="sakura-brand">${renderBrandIcon()} Sakura Translator</div>
    `;
  }

  // ─── Render engine badge ───
  function renderEngineBadge() {
    return `<span class="sakura-engine-badge sakura-engine-google">via Google</span>`;
  }

  // ─── Render sakura brand icon (minimalist cherry blossom) ───
  function renderBrandIcon() {
    return `<svg class="sakura-brand-icon" width="10" height="10" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><g transform="translate(12,12)"><ellipse rx="3" ry="5.2" fill="#ed648c" opacity="0.85"/><ellipse rx="3" ry="5.2" transform="rotate(72)" fill="#ed648c" opacity="0.85"/><ellipse rx="3" ry="5.2" transform="rotate(144)" fill="#ed648c" opacity="0.85"/><ellipse rx="3" ry="5.2" transform="rotate(216)" fill="#ed648c" opacity="0.85"/><ellipse rx="3" ry="5.2" transform="rotate(288)" fill="#ed648c" opacity="0.85"/><circle r="2" fill="#ffc457"/></g></svg>`;
  }

  // ─── Merge word data from different Google response blocks ───
  // Combines dt=bd (localized translations) and dt=md (English definitions) by POS
  function mergeWordData(meanings, definitions) {
    const posMap = new Map(); // partOfSpeech → { translations: [...], defs: [...] }

    // Process dt=bd meanings (localized translations like "教程", "课程")
    if (meanings && meanings.length > 0) {
      for (const m of meanings) {
        const pos = (m.partOfSpeech || '').toLowerCase();
        if (!posMap.has(pos)) {
          posMap.set(pos, { partOfSpeech: m.partOfSpeech, translations: [], defs: [] });
        }
        const group = posMap.get(pos);
        // Extract just the translated word, strip redundant reverse-translations "(xxx, yyy)"
        for (const d of (m.definitions || [])) {
          const raw = d.definition || '';
          // dt=bd format: "翻译词 (reverseTranslation1, reverseTranslation2)"
          // Strip the parenthesized reverse translations
          const cleanTranslation = raw.replace(/\s*\([^)]*\)\s*$/, '').trim();
          if (cleanTranslation && !group.translations.includes(cleanTranslation)) {
            group.translations.push(cleanTranslation);
          }
        }
      }
    }

    // Process dt=md definitions (English definitions + examples)
    if (definitions && definitions.length > 0) {
      for (const d of definitions) {
        const pos = (d.partOfSpeech || '').toLowerCase();
        if (!posMap.has(pos)) {
          posMap.set(pos, { partOfSpeech: d.partOfSpeech, translations: [], defs: [] });
        }
        const group = posMap.get(pos);
        for (const def of (d.definitions || [])) {
          group.defs.push({
            definition: def.definition,
            example: def.example || undefined
          });
        }
      }
    }

    return Array.from(posMap.values());
  }

  // ─── Render: Word result ───
  function renderWordResult(result) {
    let html = '';

    // Header: word + phonetic + audio
    const audioUrl = getAudioUrl(result.phonetics);
    html += `
      <div class="sakura-header">
        <div class="sakura-header-left">
          <span class="sakura-original">${escapeHtml(result.original)}</span>
          ${result.phonetic ? `<span class="sakura-phonetic">${escapeHtml(result.phonetic)}</span>` : ''}
        </div>
        ${audioUrl ? `
          <button class="sakura-audio-btn" data-audio-url="${escapeHtml(audioUrl)}" title="Play pronunciation">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
            </svg>
          </button>
        ` : ''}
      </div>
    `;

    // Translation
    if (result.translation) {
      html += `
        <div class="sakura-translation">
          <span class="sakura-translation-text">${escapeHtml(result.translation)}</span>
        </div>
      `;
    }

    // ─── Merge meanings (dt=bd) + definitions (dt=md) by part of speech ───
    // dt=bd provides: localized translations (e.g. Chinese words)
    // dt=md provides: source-language definitions + example sentences
    // dt=ex provides: additional example sentences
    // We merge them into a single unified section for clean rendering.
    const mergedGroups = mergeWordData(result.meanings, result.definitions);

    if (mergedGroups.length > 0) {
      html += '<div class="sakura-divider"></div>';
      html += '<div class="sakura-meanings">';

      mergedGroups.forEach(group => {
        html += `<div class="sakura-meaning-group">`;
        html += `<span class="sakura-meaning-pos">${escapeHtml(translatePOS(group.partOfSpeech))}</span>`;

        // Show localized translations as a compact list (from dt=bd)
        if (group.translations && group.translations.length > 0) {
          html += `<div class="sakura-translations-list">`;
          html += group.translations.map(t => escapeHtml(t)).join('；');
          html += `</div>`;
        }

        // Show numbered definitions with examples (from dt=md)
        if (group.defs && group.defs.length > 0) {
          const defsSlice = group.defs.slice(0, 3);
          defsSlice.forEach((def, idx) => {
            html += `<div class="sakura-def-item">`;
            html += `<span class="sakura-def-number">${idx + 1}.</span>`;
            html += `<span class="sakura-def-text">${escapeHtml(def.definition)}</span>`;
            html += `</div>`;
            if (def.example) {
              html += `<div class="sakura-meaning-example">"${escapeHtml(def.example)}"</div>`;
            }
          });
        }

        html += `</div>`; // .sakura-meaning-group
      });

      html += '</div>'; // .sakura-meanings
    }

    // Additional examples (from Google dt=ex) — only show those not already in definitions
    const shownExamples = new Set();
    mergedGroups.forEach(g => (g.defs || []).forEach(d => {
      if (d.example) shownExamples.add(d.example.toLowerCase());
    }));
    const extraExamples = (result.examples || []).filter(
      ex => !shownExamples.has(ex.toLowerCase())
    ).slice(0, 3);

    if (extraExamples.length > 0) {
      html += '<div class="sakura-divider"></div>';
      html += '<div class="sakura-examples">';
      html += `<div class="sakura-section-title">${escapeHtml(localizeLabel('examples'))}</div>`;
      extraExamples.forEach(ex => {
        html += `<div class="sakura-example-item">"${escapeHtml(ex)}"</div>`;
      });
      html += '</div>';
    }

    html += `<div class="sakura-brand">${renderBrandIcon()} Sakura Translator ${renderEngineBadge()}</div>`;
    return html;
  }

  // ─── Render: Sentence result ───
  function renderSentenceResult(result) {
    return `
      <div class="sakura-sentence">
        <div class="sakura-sentence-translation">${escapeHtml(result.translation)}</div>
      </div>
      <div class="sakura-brand">${renderBrandIcon()} Sakura Translator ${renderEngineBadge()}</div>
    `;
  }

  // ─── Bind audio playback ───
  function bindAudioButtons(popup) {
    const buttons = popup.querySelectorAll('.sakura-audio-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const url = btn.getAttribute('data-audio-url');
        if (url) {
          if (currentAudio) currentAudio.pause();
          currentAudio = new Audio(url);
          currentAudio.play().catch(() => {});
        }
      });
    });
  }

  // ─── Get best audio URL from phonetics ───
  function getAudioUrl(phonetics) {
    if (!phonetics || !Array.isArray(phonetics)) return null;
    for (const p of phonetics) {
      if (p.audio) {
        // Ensure URL is absolute
        let url = p.audio;
        if (url.startsWith('//')) url = 'https:' + url;
        return url;
      }
    }
    return null;
  }

  // ─── HTML escape ───
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
})();
