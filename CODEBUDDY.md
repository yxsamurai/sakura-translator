# CODEBUDDY.md

This file provides guidance to CodeBuddy Code when working with code in this repository.

## Project Overview

**Sakura Translator** is a Chrome extension (Manifest v3) that provides instant Chinese-English translation with dictionary-level detail. It uses Google Translate Extended API and Free Dictionary API without requiring authentication.

**Architecture**: Service worker (background) + content script (webpage injection) + popup UI

---

## Commands

### Setup
```bash
npm install                                    # Install dependencies (Playwright)
node generate-icons.js                        # Generate icon assets
```

### Testing (MANDATORY after code modifications)

**Key Policy**: All tests run in headless mode. After ANY code change, run the targeted module tests (not the full suite) unless the user explicitly requests it.

**By Modified File**:
```bash
# After editing background.js
npx playwright test --project=unit tests/background.unit.spec.js --reporter=line

# After editing utils/*.js
npx playwright test --project=unit --reporter=line

# After editing content/content.js or content/content.css
npx playwright test --project=extension tests/content-script.spec.js --reporter=line

# After editing popup/* files
npx playwright test --project=extension tests/popup-ui.spec.js --reporter=line

# Full test suite (ONLY on explicit user request: "run all tests", "full suite", etc.)
npm test

# All unit tests
npm run test:unit

# All extension (e2e) tests
npm run test:extension

# Popup UI tests only
npm run test:popup

# Content script tests only
npm run test:content
```

### Local Development

1. Run `npm install` to install Playwright
2. Run `node generate-icons.js` to generate icon assets
3. Go to `chrome://extensions/` → Enable Developer mode
4. Click **Load unpacked** → Select `d:\projects\samurai-translator`
5. Look for 🌸 icon in toolbar

---

## Code Architecture

### 1. Service Worker (`background.js` - 445 lines)

**Role**: Core translation engine; routes all translation requests

**Key Functions**:
- `handleTranslation(request)` - Routes to word or sentence translation based on request type
- `translateWord(word, detectedLang, sourceLang, targetLang)` - Returns dictionary-level data (phonetics, definitions, examples)
- `translateSentence(text, detectedLang, sourceLang, targetLang)` - Returns simple direct translation
- `fetchGoogleExtended(text, fromLang, toLang)` - Calls Google Translate with extended `dt` parameters
- `parseGoogleExtendedResponse(data)` - Extracts translation, romanization, dictionary, definitions
- `resolveTranslationDirection(detectedLang, sourceLang, targetLang)` - Smart language swapping logic (e.g., if both source and target are Chinese, swap to English)

**API Endpoints**:
- Google Translate Extended: `https://translate.googleapis.com/translate_a/single`
- Free Dictionary: `https://api.dictionaryapi.dev/api/v2/entries/en/`

**Response Types**:
- Word: `{ type, original, translation, phonetic, phonetics[], meanings[], definitions[], examples[], lang, engine }`
- Sentence: `{ type, original, translation, lang, engine }`

**Supported Languages**: 30+ (English, Chinese Simplified/Traditional, Japanese, Korean, French, German, Spanish, Portuguese, Russian, Arabic, Hindi, Italian, Dutch, Thai, Vietnamese, Indonesian, Malay, Turkish, Polish, Ukrainian, Swedish, Danish, Finnish, Norwegian, Greek, Czech, Romanian, Hungarian, Hebrew)

---

### 2. Content Script (`content/content.js` - 1000+ lines)

**Role**: Injects into webpages; detects hotkey+selection; displays shadow DOM popup

**Key Features**:
- Shadow DOM popup rendering near cursor position
- Two selection modes: **hover-auto-select** (automatic detection on hover) and **manual-select** (drag to select)
- Configurable hotkeys (Ctrl/Alt/Shift combinations)
- Real-time settings synchronization via Chrome storage
- Audio playback for English word pronunciation
- Keyboard shortcuts: `Esc` (dismiss), `Ctrl+C` (copy), arrow keys (navigate results)

**State Variables**:
- `popupRoot` - Shadow DOM container
- `currentAudio` - Audio playback reference
- `selectionMode` - 'hover' or 'manual'
- `hoverWordKey`, `hoverSentenceKey`, `manualKey` - Modifier key combinations
- `sourceLang`, `targetLang` - Translation language settings
- `hoverTriggeredPopup` - Flag for mode tracking

**Localization**: Supports part-of-speech labels in 7+ languages (Chinese, Japanese, Korean, French, German, Spanish)

**Styling**: `content/content.css` (9166 bytes) - Material Design-inspired dark mode support via `prefers-color-scheme`

---

### 3. Popup UI (`popup/` - 187 lines HTML)

**Role**: Settings panel + manual translation input

**Key Components**:
- Language selector (source/target with swap button)
- Mode tabs: Hover Select vs Manual Select
- Hotkey configuration dropdowns for each mode
- Mode-specific options with hint text
- Manual translation textarea + result display
- Loading indicator during translation

**Code**:
- `popup.html` - Structure and form layout
- `popup.js` (13KB) - Settings persistence, UI state management, translation requests
- `popup.css` (12KB) - Responsive Material Design styling

---

### 4. Utilities

#### `utils/detector.js` (92 lines)
```javascript
SakuraDetector = {
  detect(text) → { type, lang, text }
  detectLanguage(text) → 'en' | 'zh' | 'mixed'
  detectType(text, lang) → 'word' | 'sentence'
  stripSurroundingPunctuation(text) → cleaned
}
```

**Language Detection**:
- Chinese: ≥30% Chinese chars → 'zh'
- Chinese: 1-30% Chinese chars → 'mixed'
- Otherwise → 'en'

**Type Detection**:
- English: Single word (no spaces, letters only) → 'word'
- Chinese: ≤4 chars, no punctuation → 'word'
- Otherwise → 'sentence'

#### `utils/translator.js` (38 lines)
```javascript
SakuraTranslator = {
  translate(text, type, lang) → Promise<result>
}
```
Wraps Chrome message passing to background service worker.

#### `utils/md5.js` (6382 bytes)
Complete MD5 hash implementation (currently unused; was likely for older Baidu API).

---

### 5. Manifest & Configuration

**`manifest.json` (Manifest v3)**:
- Service worker: `background.js`
- Content scripts: `utils/detector.js`, `utils/translator.js`, `content/content.js` (run at `document_idle`)
- Permissions: `storage`, `activeTab`
- Host permissions: Google Translate Extended, Free Dictionary API
- Action: Popup UI (`popup/popup.html`)

**`playwright.config.js`**:
- **Timeout**: 30 seconds per test
- **Projects**:
  - `unit`: Matches `*.unit.spec.js` (background, detector, md5 tests) - headless
  - `extension`: Matches other `.spec.js` files (content-script, popup-ui e2e) - headless with `--headless=new`
- **Test Directory**: `./tests`
- **No retry on failure**

**`tests/fixtures.js`** (52 lines):
Custom Playwright fixture for extension testing:
- `context`: Persistent Chromium context with extension loaded
- `extensionId`: Helper to extract extension ID from service worker
- `popup`: Helper to open extension popup in new page

---

## Testing Rules (MANDATORY)

**From `.codebuddy/rules/test-sub-agent.mdc`:**

1. **ALWAYS run targeted module tests after EVERY code modification** - This is non-negotiable
2. **Targeted tests ONLY by default** - Never automatically run the full suite
3. **Full suite ONLY on explicit user request** (e.g., "run all tests", "full test suite", "run everything")
4. **All tests run headless** - No browser windows pop up
5. **Fix before finishing** - Never report completion with failing tests
6. **Include test count** - Report final pass count
7. **Update tests when needed** - If code change intentionally changes behavior, update test assertions
8. **Add tests for new features** - When adding new functionality, add corresponding unit or e2e tests

---

## Test Files

| File | Purpose | Module Tested |
|------|---------|---|
| `tests/background.unit.spec.js` (23KB) | Unit tests for service worker API logic | `background.js` |
| `tests/detector.unit.spec.js` (6KB) | Language & type detection tests | `utils/detector.js` |
| `tests/md5.unit.spec.js` (3KB) | MD5 hash validation | `utils/md5.js` |
| `tests/content-script.spec.js` (79KB) | E2E tests for content script UI/interactions | `content/content.js` |
| `tests/popup-ui.spec.js` (37KB) | E2E tests for popup settings panel | `popup/*` |
| `tests/fixtures.js` | Shared test fixtures & helpers | — |

---

## Development Workflow

1. **Make code changes** to `.js`, `.css`, or `.html` files
2. **Run targeted module tests** based on what was modified (see Commands section)
3. **Fix failing tests** if any - do not report completion with failures
4. **Report test results** including pass count

**Example**:
- Edit `background.js` → Run `npx playwright test --project=unit tests/background.unit.spec.js --reporter=line`
- Edit `content/content.js` → Run `npx playwright test --project=extension tests/content-script.spec.js --reporter=line`
- Edit `popup/popup.js` → Run `npx playwright test --project=extension tests/popup-ui.spec.js --reporter=line`

---

## Key Implementation Details

### Language Resolution
The `resolveTranslationDirection()` function in `background.js` implements smart swapping:
- If both source and detected are Chinese and target is English → keep it
- If both source and detected are the same non-English language → swap to English translation
- Otherwise → use as-is

### Shadow DOM Popup
Content script uses Shadow DOM to isolate popup styling from page styles:
- Root container: `document.body.appendChild(popupRoot)`
- Prevents CSS conflicts with webpage
- Supports dark mode via `prefers-color-scheme` media query

### Chrome Storage Sync
Settings persist via Chrome storage sync:
- Synced across user's devices (if user enables sync)
- Keys: `sourceLang`, `targetLang`, `selectionMode`, `hoverWordKey`, `hoverSentenceKey`, `manualKey`, `playAudio`

---

## Important Notes

- **No Authentication Required**: Uses free public APIs (Google Translate, Free Dictionary)
- **Manifest v3**: Modern Chrome extension format; no content_security_policy overrides
- **Service Worker Lifecycle**: Background script may pause/resume; always use async messaging
- **Windows Path**: Use forward slashes in Bash commands: `npm run test` (not backslashes)
