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
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const saveStatus = document.getElementById('saveStatus');
  const shortcutRadios = document.querySelectorAll('input[name="shortcut"]');
  const selectionModeRadios = document.querySelectorAll('input[name="selectionMode"]');
  const hintShortcut = document.getElementById('hintShortcut');
  const hintText = document.getElementById('hintText');
  const sourceLangSelect = document.getElementById('sourceLang');
  const targetLangSelect = document.getElementById('targetLang');
  const swapLangsBtn = document.getElementById('swapLangsBtn');

  // Shortcut display names
  const SHORTCUT_LABELS = {
    'ctrl': 'Ctrl + Select',
    'ctrl+shift': 'Ctrl + Shift + Select',
    'alt': 'Alt + Select'
  };

  // Supported languages (synced from background on first load)
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

  // ─── Language select change: auto-save ───
  sourceLangSelect.addEventListener('change', () => {
    autoSave();
  });

  targetLangSelect.addEventListener('change', () => {
    autoSave();
  });

  // ─── Swap languages button ───
  swapLangsBtn.addEventListener('click', () => {
    const src = sourceLangSelect.value;
    const tgt = targetLangSelect.value;

    // If source is 'auto', swap means: set source to current target, set target to 'en' (sensible default)
    // If source is a real language, normal swap
    if (src === 'auto') {
      sourceLangSelect.value = tgt;
      // Pick a sensible default target: if target was Chinese, go to English, otherwise go to Chinese
      targetLangSelect.value = tgt.startsWith('zh') ? 'en' : 'zh-CN';
    } else {
      sourceLangSelect.value = tgt;
      targetLangSelect.value = src;
    }
    autoSave();
  });

  // ─── Shortcut radio change: auto-save + update hint ───
  shortcutRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      updateHintText();
      autoSave();
    });
  });

  // ─── Selection mode radio change: auto-save + update hint ───
  selectionModeRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      updateHintText();
      autoSave();
    });
  });

  // ─── Save settings (manual button click) ───
  saveSettingsBtn.addEventListener('click', () => {
    const shortcut = document.querySelector('input[name="shortcut"]:checked').value;
    const selMode = document.querySelector('input[name="selectionMode"]:checked').value;
    const sourceLang = sourceLangSelect.value;
    const targetLang = targetLangSelect.value;

    // Clear any pending auto-save
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer);
      autoSaveTimer = null;
    }

    chrome.storage.sync.set({
      triggerShortcut: shortcut,
      selectionMode: selMode,
      sourceLang: sourceLang,
      targetLang: targetLang
    }, () => {
      showSaveStatus('Settings saved!', 'success');
    });
  });

  // ─── Auto-save: persist current form values after a short delay ───
  function autoSave() {
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
      const shortcut = document.querySelector('input[name="shortcut"]:checked').value;
      const selMode = document.querySelector('input[name="selectionMode"]:checked').value;
      const sourceLang = sourceLangSelect.value;
      const targetLang = targetLangSelect.value;

      chrome.storage.sync.set({
        triggerShortcut: shortcut,
        selectionMode: selMode,
        sourceLang: sourceLang,
        targetLang: targetLang
      }, () => {
        showSaveStatus('Auto-saved', 'success');
      });
    }, 600);
  }

  // ─── Update hint text based on selected shortcut and selection mode ───
  function updateHintText() {
    const shortcut = document.querySelector('input[name="shortcut"]:checked').value;
    const selMode = document.querySelector('input[name="selectionMode"]:checked').value;

    if (selMode === 'hover') {
      if (hintText) {
        hintText.innerHTML = 'Hover + <strong>Ctrl</strong> = word, Hover + <strong>Alt</strong> = sentence';
      }
    } else {
      if (hintShortcut) {
        hintShortcut.textContent = SHORTCUT_LABELS[shortcut] || SHORTCUT_LABELS['ctrl'];
      }
      if (hintText) {
        hintText.innerHTML = `<strong id="hintShortcut">${SHORTCUT_LABELS[shortcut] || SHORTCUT_LABELS['ctrl']}</strong> text on any page to translate`;
      }
    }
  }

  // ─── Load settings from storage ───
  function loadSettings() {
    // Load both sync settings and local UI state
    chrome.storage.sync.get(
      { triggerShortcut: 'ctrl', selectionMode: 'manual', sourceLang: 'auto', targetLang: 'zh-CN' },
      (items) => {
        // Set shortcut radio
        const shortcutRadio = document.querySelector(`input[name="shortcut"][value="${items.triggerShortcut}"]`);
        if (shortcutRadio) shortcutRadio.checked = true;

        // Set selection mode radio
        const selModeRadio = document.querySelector(`input[name="selectionMode"][value="${items.selectionMode}"]`);
        if (selModeRadio) selModeRadio.checked = true;

        // Set language selects
        if (sourceLangSelect) sourceLangSelect.value = items.sourceLang;
        if (targetLangSelect) targetLangSelect.value = items.targetLang;

        // Update hint text
        updateHintText();
      }
    );

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
      // Add all options to source dropdown (including 'auto')
      const srcOption = document.createElement('option');
      srcOption.value = code;
      srcOption.textContent = name;
      sourceLangSelect.appendChild(srcOption);

      // Skip 'auto' for target dropdown — must always have a concrete target
      if (code === 'auto') continue;

      const tgtOption = document.createElement('option');
      tgtOption.value = code;
      tgtOption.textContent = name;
      targetLangSelect.appendChild(tgtOption);
    }

    // Set defaults
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

    // Show loading
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

  // ─── Simple detector (inline, since we can't import content scripts) ───
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

    // Engine badge
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
