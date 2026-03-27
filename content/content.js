/**
 * Sakura Translator - Content Script
 * Detects hotkey+selection and shows translation popup.
 * Supports: select-then-hotkey and hotkey-then-select workflows.
 */

(() => {
  // ─── State ───
  let popupRoot = null;
  let currentAudio = null;
  let triggerShortcut = 'ctrl'; // default, will be overridden by settings
  let selectionMode = 'manual'; // 'manual' = drag-select, 'hover' = auto-hover select
  let sourceLang = 'auto';      // default source language (auto-detect)
  let targetLang = 'zh-CN';     // default target language
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

  // ─── Load settings ───
  function loadSettings() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.get(
        { triggerShortcut: 'ctrl', selectionMode: 'manual', sourceLang: 'auto', targetLang: 'zh-CN' },
        (items) => {
          triggerShortcut = items.triggerShortcut || 'ctrl';
          selectionMode = items.selectionMode || 'manual';
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
        if (changes.triggerShortcut) {
          triggerShortcut = changes.triggerShortcut.newValue || 'ctrl';
        }
        if (changes.selectionMode) {
          selectionMode = changes.selectionMode.newValue || 'manual';
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

  // ─── Shortcut matching ───
  function isShortcutActive(e) {
    switch (triggerShortcut) {
      case 'ctrl+shift':
        return e.ctrlKey && e.shiftKey;
      case 'alt':
        return e.altKey;
      case 'ctrl':
      default:
        return e.ctrlKey && !e.shiftKey && !e.altKey;
    }
  }

  function isShortcutKeyDown(e) {
    switch (triggerShortcut) {
      case 'ctrl+shift':
        return (e.key === 'Control' || e.key === 'Shift') && e.ctrlKey && e.shiftKey;
      case 'alt':
        return e.key === 'Alt';
      case 'ctrl':
      default:
        return e.key === 'Control' && !e.shiftKey && !e.altKey;
    }
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

    // Only handle Ctrl or Alt (not when other unexpected modifiers are pressed)
    if (e.key !== 'Control' && e.key !== 'Alt') return;
    if (popupRoot) return;

    // Determine mode: Alt = sentence, Ctrl = word
    const isAlt = e.key === 'Alt' && e.altKey && !e.ctrlKey && !e.shiftKey;
    const isCtrl = e.key === 'Control' && e.ctrlKey && !e.shiftKey && !e.altKey;

    if (!isAlt && !isCtrl) return;

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
    if (isAlt) {
      extracted = extractSentenceAtOffset(fullText, offset, textNode);
    } else {
      extracted = extractWordAtOffset(fullText, offset);
    }

    if (!extracted || !extracted.text || extracted.text.trim().length === 0) return;
    if (extracted.text.length > 2000) return;

    // Create a range for the extracted text to highlight and position popup
    const range = document.createRange();
    if (extracted.useParent && extracted.parentEl) {
      // Sentence mode: select the entire parent element content
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

  // ─── Dismiss hover popup on key release ───
  document.addEventListener('keyup', (e) => {
    if (!hoverTriggeredPopup) return;
    if (!popupRoot) return;

    // Dismiss when Ctrl or Alt is released (the keys used for hover mode)
    if (e.key === 'Control' || e.key === 'Alt') {
      e.preventDefault();
      removePopup();
      // Clear the selection that was auto-created
      window.getSelection().removeAllRanges();
      hoverTriggeredPopup = false;
    }
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
          // Map parent-level boundaries back to the text node for Range creation
          // Since we may span multiple child nodes, select the entire parent's content
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
  document.addEventListener('mousedown', (e) => {
    if (popupRoot && !popupRoot.contains(e.target)) {
      removePopup();
      hoverTriggeredPopup = false;
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      removePopup();
      hoverTriggeredPopup = false;
    }
  });

  // ─── Show popup ───
  async function showPopup(rect, text) {
    removePopup();

    // Create root container
    popupRoot = document.createElement('div');
    popupRoot.id = 'sakura-translator-root';
    document.body.appendChild(popupRoot);

    // Create popup element
    const popup = document.createElement('div');
    popup.className = 'sakura-popup';

    // Position popup
    positionPopup(popup, rect);

    // Show loading state
    popup.innerHTML = renderLoading();
    popupRoot.appendChild(popup);

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
      <div class="sakura-brand">Sakura Translator</div>
    `;
  }

  // ─── Render: Error ───
  function renderError(message) {
    return `
      <div class="sakura-error">⚠ ${escapeHtml(message)}</div>
      <div class="sakura-brand">Sakura Translator</div>
    `;
  }

  // ─── Render engine badge ───
  function renderEngineBadge() {
    return `<span class="sakura-engine-badge sakura-engine-google">via Google</span>`;
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

    // Dictionary meanings
    if (result.meanings && result.meanings.length > 0) {
      html += '<div class="sakura-divider"></div>';
      html += '<div class="sakura-meanings">';

      result.meanings.forEach(meaning => {
        html += `<div class="sakura-meaning-group">`;
        html += `<span class="sakura-meaning-pos">${escapeHtml(translatePOS(meaning.partOfSpeech))}</span>`;

        // Show up to 3 definitions per part of speech
        const defs = (meaning.definitions || []).slice(0, 3);
        defs.forEach(def => {
          html += `<div class="sakura-meaning-def">${escapeHtml(def.definition)}</div>`;
          if (def.example) {
            html += `<div class="sakura-meaning-example">"${escapeHtml(def.example)}"</div>`;
          }
        });

        html += `</div>`;
      });

      html += '</div>';
    }

    html += `<div class="sakura-brand">Sakura Translator ${renderEngineBadge()}</div>`;
    return html;
  }

  // ─── Render: Sentence result ───
  function renderSentenceResult(result) {
    return `
      <div class="sakura-sentence">
        <div class="sakura-sentence-translation">${escapeHtml(result.translation)}</div>
      </div>
      <div class="sakura-brand">Sakura Translator ${renderEngineBadge()}</div>
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
