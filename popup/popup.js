/**
 * Sakura Translator - Popup Page Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  const inputText = document.getElementById('inputText');
  const translateBtn = document.getElementById('translateBtn');
  const resultArea = document.getElementById('resultArea');
  const resultContent = document.getElementById('resultContent');
  const loading = document.getElementById('loading');

  // Settings elements
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsPanel = document.getElementById('settingsPanel');
  const saveStatus = document.getElementById('saveStatus');
  const sourceLangSelect = document.getElementById('sourceLang');
  const targetLangSelect = document.getElementById('targetLang');
  const swapLangsBtn = document.getElementById('swapLangsBtn');

  // Mode tabs
  const modeTabHover = document.getElementById('modeTabHover');
  const modeTabManual = document.getElementById('modeTabManual');
  const hoverOptions = document.getElementById('hoverOptions');
  const manualOptions = document.getElementById('manualOptions');

  // Key selects
  const hoverWordKeySelect = document.getElementById('hoverWordKey');
  const hoverSentenceKeySelect = document.getElementById('hoverSentenceKey');
  const manualKeySelect = document.getElementById('manualKey');

  // Hint elements
  const hintText = document.getElementById('hintText');

  // Key display labels
  const KEY_LABELS = {
    'ctrl': 'Ctrl',
    'alt': 'Alt',
    'shift': 'Shift',
    'ctrl+shift': 'Ctrl+Shift'
  };

  // Supported languages
  const SUPPORTED_LANGUAGES = {
    'auto': 'Auto Detect',
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

  // Default settings
  const DEFAULTS = {
    selectionMode: 'hover',
    hoverWordKey: 'ctrl',
    hoverSentenceKey: 'alt',
    manualKey: 'ctrl',
    sourceLang: 'auto',
    targetLang: 'zh-CN'
  };

  // ─── Auto-save debounce timer ───
  let autoSaveTimer = null;

  // ─── Populate language dropdowns ───
  populateLanguageDropdowns();

  // ─── Load saved settings on open ───
  loadSettings();

  // ─── Toggle settings panel ───
  settingsBtn.addEventListener('click', () => {
    const isOpening = settingsPanel.classList.contains('hidden');
    settingsPanel.classList.toggle('hidden');
    settingsBtn.classList.toggle('active');

    // Remember settings panel open/close state
    chrome.storage.local.set({ settingsPanelOpen: isOpening });
  });

  // ─── Mode tab clicks ───
  modeTabHover.addEventListener('click', () => {
    switchMode('hover');
    autoSave();
  });

  modeTabManual.addEventListener('click', () => {
    switchMode('manual');
    autoSave();
  });

  function switchMode(mode) {
    if (mode === 'hover') {
      modeTabHover.classList.add('active');
      modeTabManual.classList.remove('active');
      hoverOptions.classList.remove('hidden');
      manualOptions.classList.add('hidden');
    } else {
      modeTabManual.classList.add('active');
      modeTabHover.classList.remove('active');
      manualOptions.classList.remove('hidden');
      hoverOptions.classList.add('hidden');
    }
    updateHintText();
  }

  // ─── Language select change: auto-save ───
  sourceLangSelect.addEventListener('change', () => {
    autoSave();
  });

  targetLangSelect.addEventListener('change', () => {
    autoSave();
  });

  // ─── Key select changes: auto-save with conflict prevention ───
  hoverWordKeySelect.addEventListener('change', () => {
    resolveHoverKeyConflict('word');
    updateHintText();
    autoSave();
  });

  hoverSentenceKeySelect.addEventListener('change', () => {
    resolveHoverKeyConflict('sentence');
    updateHintText();
    autoSave();
  });

  /**
   * Resolve hover key conflicts: word and sentence keys must be different.
   * When user changes one key to match the other, swap the other to a free key.
   * @param {'word'|'sentence'} changed - which select was just changed
   */
  function resolveHoverKeyConflict(changed) {
    const wordVal = hoverWordKeySelect.value;
    const sentVal = hoverSentenceKeySelect.value;

    if (wordVal !== sentVal) return; // no conflict

    const allKeys = ['ctrl', 'alt', 'shift'];
    const freeKey = allKeys.find(k => k !== wordVal) || 'ctrl';

    if (changed === 'word') {
      hoverSentenceKeySelect.value = freeKey;
    } else {
      hoverWordKeySelect.value = freeKey;
    }
  }

  manualKeySelect.addEventListener('change', () => {
    updateHintText();
    autoSave();
  });

  // ─── Swap languages button ───
  swapLangsBtn.addEventListener('click', () => {
    const src = sourceLangSelect.value;
    const tgt = targetLangSelect.value;

    if (src === 'auto') {
      sourceLangSelect.value = tgt;
      targetLangSelect.value = tgt.startsWith('zh') ? 'en' : 'zh-CN';
    } else {
      sourceLangSelect.value = tgt;
      targetLangSelect.value = src;
    }
    autoSave();
  });

  // ─── Gather current form values ───
  function gatherSettings() {
    const mode = modeTabHover.classList.contains('active') ? 'hover' : 'manual';
    return {
      selectionMode: mode,
      hoverWordKey: hoverWordKeySelect.value,
      hoverSentenceKey: hoverSentenceKeySelect.value,
      manualKey: manualKeySelect.value,
      sourceLang: sourceLangSelect.value,
      targetLang: targetLangSelect.value
    };
  }

  // ─── Auto-save: persist current form values after a short delay ───
  function autoSave() {
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
      const settings = gatherSettings();
      chrome.storage.sync.set(settings, () => {
        showSaveStatus('Auto-saved', 'success');
      });
    }, 600);
  }

  // ─── Update hint text based on current settings ───
  function updateHintText() {
    const mode = modeTabHover.classList.contains('active') ? 'hover' : 'manual';

    if (mode === 'hover') {
      const wordKey = KEY_LABELS[hoverWordKeySelect.value] || 'Ctrl';
      const sentKey = KEY_LABELS[hoverSentenceKeySelect.value] || 'Alt';
      if (hintText) {
        hintText.innerHTML = `<strong>${wordKey}</strong> + hover = word, <strong>${sentKey}</strong> + hover = sentence`;
      }
    } else {
      const key = KEY_LABELS[manualKeySelect.value] || 'Ctrl';
      if (hintText) {
        hintText.innerHTML = `<strong id="hintShortcut">${key} + Select</strong> text on any page to translate`;
      }
    }
  }

  // ─── Load settings from storage ───
  function loadSettings() {
    chrome.storage.sync.get(DEFAULTS, (items) => {
      // Set selection mode
      switchMode(items.selectionMode || 'hover');

      // Set key selects
      if (hoverWordKeySelect) hoverWordKeySelect.value = items.hoverWordKey || 'ctrl';
      if (hoverSentenceKeySelect) hoverSentenceKeySelect.value = items.hoverSentenceKey || 'alt';
      if (manualKeySelect) manualKeySelect.value = items.manualKey || 'ctrl';

      // Set language selects
      if (sourceLangSelect) sourceLangSelect.value = items.sourceLang;
      if (targetLangSelect) targetLangSelect.value = items.targetLang;

      // Update hint text
      updateHintText();
    });

    // Restore settings panel open/close state
    chrome.storage.local.get({ settingsPanelOpen: false }, (state) => {
      if (state.settingsPanelOpen) {
        settingsPanel.classList.remove('hidden');
        settingsBtn.classList.add('active');
      }
    });
  }

  // ─── Populate language dropdowns ───
  function populateLanguageDropdowns() {
    for (const [code, name] of Object.entries(SUPPORTED_LANGUAGES)) {
      const srcOption = document.createElement('option');
      srcOption.value = code;
      srcOption.textContent = name;
      sourceLangSelect.appendChild(srcOption);

      if (code === 'auto') continue;

      const tgtOption = document.createElement('option');
      tgtOption.value = code;
      tgtOption.textContent = name;
      targetLangSelect.appendChild(tgtOption);
    }

    sourceLangSelect.value = 'auto';
    targetLangSelect.value = 'zh-CN';
  }

  // ─── Show save status message ───
  function showSaveStatus(message, type) {
    saveStatus.textContent = message;
    saveStatus.className = `save-status ${type}`;
    saveStatus.classList.remove('hidden');
    setTimeout(() => {
      saveStatus.classList.add('hidden');
    }, 2500);
  }

  // ─── Translate button click ───
  translateBtn.addEventListener('click', () => {
    handleTranslate();
  });

  // ─── Enter key (Ctrl+Enter to translate) ───
  inputText.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleTranslate();
    }
  });

  async function handleTranslate() {
    const text = inputText.value.trim();
    if (!text) return;

    loading.classList.remove('hidden');
    resultArea.classList.add('hidden');
    translateBtn.disabled = true;

    try {
      const detected = detect(text);
      const result = await translate(detected.text, detected.type, detected.lang);

      if (result && result.error) {
        resultContent.innerHTML = `<div class="result-error">${escapeHtml(result.error)}</div>`;
        resultArea.classList.remove('hidden');
      } else {
        renderResult(result);
      }
    } catch (err) {
      resultContent.innerHTML = `<div class="result-error">${escapeHtml(err.message)}</div>`;
      resultArea.classList.remove('hidden');
    } finally {
      loading.classList.add('hidden');
      translateBtn.disabled = false;
    }
  }

  // ─── Simple detector ───
  function detect(text) {
    const CHINESE_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf]/g;
    const chineseChars = text.match(CHINESE_REGEX);
    const chineseRatio = chineseChars ? chineseChars.length / text.length : 0;

    let lang = 'en';
    if (chineseRatio > 0.3) lang = 'zh';
    else if (chineseRatio > 0) lang = 'mixed';

    let type = 'sentence';
    if (lang === 'zh') {
      if (chineseChars && chineseChars.length <= 4 && !/[。！？；，、,.!?;]/.test(text)) {
        type = 'word';
      }
    } else {
      const words = text.split(/\s+/).filter(w => w.length > 0);
      if (words.length === 1 && /^[a-zA-Z'-]+$/.test(words[0])) {
        type = 'word';
      }
    }

    return { type, lang, text };
  }

  // ─── Translation via background ───
  function translate(text, type, lang) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: 'translate', text, type, lang },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          if (response && response.error) {
            reject(new Error(response.error));
            return;
          }
          resolve(response);
        }
      );
    });
  }

  // ─── Render result ───
  function renderResult(result) {
    let html = '';

    const engineBadge = `<div class="result-engine"><span class="engine-badge engine-google">via Google</span></div>`;

    if (result.type === 'word') {
      html += '<div class="result-word">';
      html += `<div class="result-original">${escapeHtml(result.original)}</div>`;

      if (result.phonetic) {
        html += `<div class="result-phonetic">${escapeHtml(result.phonetic)}</div>`;
      }

      if (result.translation) {
        html += `<div class="result-translation">${escapeHtml(result.translation)}</div>`;
      }

      if (result.meanings && result.meanings.length > 0) {
        html += '<div class="result-meanings">';
        result.meanings.forEach(meaning => {
          html += `<span class="result-pos">${escapeHtml(meaning.partOfSpeech)}</span>`;
          const defs = (meaning.definitions || []).slice(0, 3);
          defs.forEach(def => {
            html += `<div class="result-def">${escapeHtml(def.definition)}</div>`;
            if (def.example) {
              html += `<div class="result-example">"${escapeHtml(def.example)}"</div>`;
            }
          });
        });
        html += '</div>';
      }

      html += '</div>';
    } else {
      html += `<div class="result-sentence-text">${escapeHtml(result.translation)}</div>`;
    }

    html += engineBadge;

    resultContent.innerHTML = html;
    resultArea.classList.remove('hidden');
  }

  // ─── HTML escape ───
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
});
