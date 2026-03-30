/**
 * Sakura Translator - Text Type Detector
 * Determines whether the selected text is a word or a sentence.
 */

const SakuraDetector = (() => {
  const CHINESE_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf]/;
  const CHINESE_RANGE_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf]/g;

  /**
   * Detect if text is a single word or a sentence
   * @param {string} text - The selected text
   * @returns {{ type: 'word' | 'sentence', lang: 'en' | 'zh' | 'mixed', text: string }}
   */
  function detect(text) {
    const trimmed = text.trim();
    if (!trimmed) return { type: 'sentence', lang: 'en', text: trimmed };

    const lang = detectLanguage(trimmed);
    const type = detectType(trimmed, lang);

    // For words, return the cleaned text (stripped of surrounding punctuation)
    // so the translation API gets "programming" instead of "programming,"
    let cleanedText = trimmed;
    if (type === 'word' && lang !== 'zh') {
      cleanedText = stripSurroundingPunctuation(trimmed);
    }

    return { type, lang, text: cleanedText };
  }

  /**
   * Detect primary language
   */
  function detectLanguage(text) {
    const chineseChars = text.match(CHINESE_RANGE_REGEX);
    const chineseRatio = chineseChars ? chineseChars.length / text.length : 0;

    if (chineseRatio > 0.3) return 'zh';
    if (chineseRatio > 0 && chineseRatio <= 0.3) return 'mixed';
    return 'en';
  }

  /**
   * Strip leading and trailing punctuation from text
   * (commas, periods, colons, semicolons, quotes, brackets, etc.)
   */
  function stripSurroundingPunctuation(text) {
    return text.replace(/^[^\w\u00C0-\u024F\u4e00-\u9fff\u3400-\u4dbf]+/, '')
               .replace(/[^\w\u00C0-\u024F\u4e00-\u9fff\u3400-\u4dbf]+$/, '');
  }

  /**
   * Detect whether text is a word or sentence
   */
  function detectType(text, lang) {
    if (lang === 'zh') {
      // Chinese: 4 chars or fewer is treated as a "word" (e.g. 你好, 计算机, 人工智能)
      const chineseChars = text.match(CHINESE_RANGE_REGEX);
      if (chineseChars && chineseChars.length <= 4 && !hasPunctuation(text)) {
        return 'word';
      }
      return 'sentence';
    }

    // English: single word detection
    // Strip surrounding punctuation so "programming," or "(hello)" → "programming" / "hello"
    const words = text.split(/\s+/).filter(w => w.length > 0);
    if (words.length === 1) {
      const cleaned = stripSurroundingPunctuation(words[0]);
      if (cleaned.length > 0 && /^[a-zA-Z'-]+$/.test(cleaned)) {
        return 'word';
      }
    }

    return 'sentence';
  }

  /**
   * Check if text contains sentence punctuation
   */
  function hasPunctuation(text) {
    return /[。！？；，、,.!?;]/.test(text);
  }

  return { detect, detectLanguage, detectType, stripSurroundingPunctuation };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SakuraDetector;
}
