# 🌸 Sakura Translator

> A clean, minimal translation Chrome extension. Hover or select text on any webpage to instantly translate words and sentences.

**[中文](README_CN.md)** | **[日本語](README_JP.md)**

---

## ✨ Features

- **Hover / Select Translation** — Two selection modes to choose from:
  - **Hover Mode**: Just hover over text and press a modifier key to auto-select and translate
  - **Manual Mode**: Drag to highlight text, then press a modifier key to trigger translation
- **Smart Detection** — Automatically detects whether you selected a word or sentence
- **Dictionary Mode** — Single words get detailed dictionary-level translations with phonetics, parts of speech, definitions, and usage examples
- **Sentence Mode** — Sentences get clean, direct translations
- **30+ Languages** — English, Chinese (Simplified/Traditional), Japanese, Korean, French, German, Spanish, Portuguese, Russian, Arabic, Hindi, Italian, Dutch, Thai, Vietnamese, Indonesian, Malay, Turkish, Polish, Ukrainian, Swedish, Danish, Finnish, Norwegian, Greek, Czech, Romanian, and more
- **Dark Mode** — Automatically respects your system theme
- **Configurable Hotkeys** — Customize which modifier key (Ctrl / Alt / Shift) triggers word selection vs sentence selection, with automatic conflict prevention
- **Popup Translator** — Click the extension icon for a manual translation input box
- **Zero Config** — Works out of the box with free APIs, no API keys needed

## 📦 Installation

1. Clone or download this repository:
   ```bash
   git clone https://github.com/user/sakura-translator.git
   ```
2. Generate icons (one-time):
   ```bash
   node generate-icons.js
   ```
3. Open Chrome and navigate to `chrome://extensions/`
4. Enable **Developer mode** (top-right toggle)
5. Click **Load unpacked** and select this project folder
6. The extension is ready! Look for the **🌸** icon in your toolbar

## 🎯 Usage

### On-Page Translation (Hover Mode — Default)

1. **Hover** your mouse over any text on a webpage
2. Press **Ctrl** to select and translate the word under your cursor
3. Press **Alt** to select and translate the entire sentence
4. A floating popup appears with the translation
5. Press **Escape** or click elsewhere to dismiss

### On-Page Translation (Manual Mode)

1. **Drag** to highlight any text on a webpage
2. While holding the modifier key (default: **Ctrl**), release the selection
3. Or select first, then press the modifier key
4. A floating popup appears with the translation

### Popup Translation

1. Click the extension icon in the toolbar
2. Type or paste text in the input box
3. Press **Ctrl+Enter** or click **Translate**

### Settings

Click the ⚙️ gear icon in the popup to configure:
- **Source / Target Language** — Choose from 30+ languages with a swap button
- **Selection Mode** — Switch between Hover Mode and Manual Mode
- **Hotkeys** — Customize modifier keys for word/sentence selection (keys are auto-prevented from conflicting)

All settings auto-save immediately.

## 🔌 APIs Used

| API | Purpose | Cost |
|-----|---------|------|
| [Google Translate](https://translate.googleapis.com/) | Multi-language translation with extended dictionary data | Free |
| [Free Dictionary API](https://dictionaryapi.dev/) | English word definitions, phonetics & examples | Free, unlimited |

## 📁 Project Structure

```
sakura-translator/
├── manifest.json           # Chrome Extension Manifest V3
├── background.js           # Service Worker (API calls, language routing)
├── content/
│   ├── content.js          # Content Script (selection detection, popup UI)
│   └── content.css         # Floating popup styling
├── popup/
│   ├── popup.html          # Extension popup page
│   ├── popup.js            # Popup logic & settings management
│   └── popup.css           # Popup styling
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── utils/
│   ├── detector.js         # Word vs Sentence detection
│   ├── translator.js       # Translation API abstraction
│   └── md5.js              # MD5 utility
├── tests/
│   ├── background.unit.spec.js
│   ├── detector.unit.spec.js
│   ├── md5.unit.spec.js
│   ├── content-script.spec.js
│   ├── popup-ui.spec.js
│   └── fixtures.js
├── playwright.config.js    # Test configuration
├── generate-icons.js       # Icon generator script
└── package.json
```

## 🧪 Testing

This project uses **Playwright** for both unit and end-to-end tests.

```bash
# Run all tests
npm test

# Unit tests only
npm run test:unit

# Extension e2e tests
npm run test:extension

# Popup UI tests only
npm run test:popup

# Content script tests only
npm run test:content
```

## 📄 License

MIT
