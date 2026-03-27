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
  let sourceLang = 'auto';      // default source language (auto-detect)
  let targetLang = 'zh-CN';     // default target language

  // ─── Load settings ───
  function loadSettings() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.get(
        { triggerShortcut: 'ctrl', sourceLang: 'auto', targetLang: 'zh-CN' },
        (items) => {
          triggerShortcut = items.triggerShortcut || 'ctrl';
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

  // ─── Dismiss on click outside / Escape ───
  document.addEventListener('mousedown', (e) => {
    if (popupRoot && !popupRoot.contains(e.target)) {
      removePopup();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      removePopup();
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
        html += `<span class="sakura-meaning-pos">${escapeHtml(meaning.partOfSpeech)}</span>`;

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
        <div class="sakura-sentence-original">${escapeHtml(result.original)}</div>
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
