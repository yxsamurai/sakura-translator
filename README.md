# Sakura Translator

A clean, minimal Chinese-English translation Chrome extension. **Ctrl + Select** text on any webpage to instantly translate words and sentences.

## Features

- **Ctrl + Select Translation** — Hold Ctrl and select text on any webpage to see translations in a floating popup
- **Smart Detection** — Automatically detects whether you selected a word or sentence
- **Dictionary Mode** — Single words get detailed dictionary-level translations with phonetics, parts of speech, definitions, and examples
- **Sentence Mode** — Sentences get clean, direct translations
- **Bidirectional** — Supports both Chinese → English and English → Chinese
- **Dark Mode** — Automatically respects your system theme
- **Popup Translator** — Click the extension icon for a manual translation input box
- **Zero Config** — Works out of the box with free APIs, no API keys needed

## Installation

1. Clone or download this repository
2. Generate icons (one-time):
   ```bash
   node generate-icons.js
   ```
3. Open Chrome and go to `chrome://extensions/`
4. Enable **Developer mode** (top right toggle)
5. Click **Load unpacked** and select this project folder
6. The extension is ready! Look for the **T** icon in your toolbar

## Usage

### On-Page Translation
1. Hold **Ctrl** key
2. Select any text on a webpage
3. A popup appears with the translation
4. Press **Escape** or click elsewhere to dismiss

### Popup Translation
1. Click the extension icon in the toolbar
2. Type or paste text in the input box
3. Press **Ctrl+Enter** or click **Translate**

## APIs Used

| API | Purpose | Limit |
|-----|---------|-------|
| [MyMemory](https://mymemory.translated.net/) | Chinese ↔ English translation | 1000 req/day (anonymous) |
| [Free Dictionary API](https://dictionaryapi.dev/) | English word definitions & phonetics | Unlimited |

## Project Structure

```
sakura-translator/
├── manifest.json           # Chrome Extension Manifest V3
├── background.js           # Service Worker (API calls)
├── content/
│   ├── content.js          # Content Script (selection + popup UI)
│   └── content.css         # Popup styling
├── popup/
│   ├── popup.html          # Extension popup page
│   ├── popup.js            # Popup logic
│   └── popup.css           # Popup styling
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── utils/
│   ├── detector.js         # Word vs Sentence detection
│   └── translator.js       # Translation API abstraction
└── generate-icons.js       # Icon generator script
```

## License

MIT
