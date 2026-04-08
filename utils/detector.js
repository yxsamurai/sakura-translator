/**
 * Sakura Translator - Text Type Detector
 * Determines whether the selected text is a word or a sentence.
 */

const SakuraDetector = (() => {
  const CHINESE_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf]/;
  const CHINESE_RANGE_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf]/g;
  const JAPANESE_KANA_REGEX = /[\u3040-\u309f\u30a0-\u30ff]/;
  const JAPANESE_KANA_RANGE_REGEX = /[\u3040-\u309f\u30a0-\u30ff]/g;
  const KOREAN_REGEX = /[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/;
  const KOREAN_RANGE_REGEX = /[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/g;

  /**
   * Detect if text is a single word or a sentence
   * @param {string} text - The selected text
   * @returns {{ type: 'word' | 'sentence', lang: 'en' | 'zh' | 'ja' | 'ko' | 'mixed', text: string }}
   */
  function detect(text) {
    const trimmed = text.trim();
    if (!trimmed) return { type: 'sentence', lang: 'en', text: trimmed };

    const lang = detectLanguage(trimmed);
    const type = detectType(trimmed, lang);

    // For words, return the cleaned text (stripped of surrounding punctuation)
    // so the translation API gets "programming" instead of "programming,"
    let cleanedText = trimmed;
    if (type === 'word' && lang !== 'zh' && lang !== 'ja' && lang !== 'ko') {
      cleanedText = stripSurroundingPunctuation(trimmed);
    }

    return { type, lang, text: cleanedText };
  }

  /**
   * Detect primary language
   * Priority: Japanese (kana presence is definitive) > Korean > Chinese > mixed > English
   */
  function detectLanguage(text) {
    // Japanese detection: if hiragana/katakana present, it's Japanese
    // (even if kanji is also present, kana makes it definitively Japanese)
    const japaneseKana = text.match(JAPANESE_KANA_RANGE_REGEX);
    if (japaneseKana && japaneseKana.length > 0) return 'ja';

    // Korean detection
    const koreanChars = text.match(KOREAN_RANGE_REGEX);
    const koreanRatio = koreanChars ? koreanChars.length / text.length : 0;
    if (koreanRatio > 0.2) return 'ko';

    // Chinese detection (only if no Japanese kana detected above)
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

    if (lang === 'ja') {
      // Japanese: short text (≤6 chars) without punctuation is a word
      const cleanLen = text.replace(/\s/g, '').length;
      if (cleanLen <= 6 && !hasPunctuation(text)) {
        return 'word';
      }
      return 'sentence';
    }

    if (lang === 'ko') {
      // Korean: short text (≤4 chars) without punctuation is a word
      const cleanLen = text.replace(/\s/g, '').length;
      if (cleanLen <= 4 && !hasPunctuation(text)) {
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
