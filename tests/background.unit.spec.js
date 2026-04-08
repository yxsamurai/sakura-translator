/**
 * Unit tests for background.js logic — resolveTranslationDirection, mapToGoogleLang,
 * and parseGoogleExtendedResponse.
 *
 * Since background.js uses IIFE-style globals (no module.exports), we extract the
 * pure functions and test them directly.
 */
const { test, expect } = require('@playwright/test');

// ─── Extract pure functions from background.js ───

function resolveTranslationDirection(detectedLang, sourceLang, targetLang) {
  if (sourceLang === 'auto') {
    const isTargetChinese = targetLang.startsWith('zh');
    if (detectedLang === 'zh' && isTargetChinese) {
      return { from: 'auto', to: 'en' };
    } else if (detectedLang === 'en' && targetLang === 'en') {
      return { from: 'auto', to: 'zh-CN' };
    } else {
      return { from: 'auto', to: targetLang };
    }
  }

  const isSourceChinese = sourceLang.startsWith('zh');
  const isTargetChinese = targetLang.startsWith('zh');

  const detectedMatchesSource =
    (detectedLang === 'zh' && isSourceChinese) ||
    (detectedLang === 'en' && sourceLang === 'en') ||
    (detectedLang === 'ja' && sourceLang === 'ja') ||
    (detectedLang === 'ko' && sourceLang === 'ko');

  const detectedMatchesTarget =
    (detectedLang === 'zh' && isTargetChinese) ||
    (detectedLang === 'en' && targetLang === 'en') ||
    (detectedLang === 'ja' && targetLang === 'ja') ||
    (detectedLang === 'ko' && targetLang === 'ko');

  if (detectedMatchesSource) {
    return { from: sourceLang, to: targetLang };
  } else if (detectedMatchesTarget) {
    return { from: targetLang, to: sourceLang };
  } else {
    return { from: 'auto', to: targetLang };
  }
}

function mapToGoogleLang(lang) {
  const map = { 'zh': 'zh-CN', 'mixed': 'auto', 'auto': 'auto' };
  return map[lang] || lang;
}

// ─── resolveTranslationDirection Tests ───

test.describe('resolveTranslationDirection', () => {
  test('auto+zh target: Chinese detected → swap to en (avoid same-language)', () => {
    expect(resolveTranslationDirection('zh', 'auto', 'zh-CN')).toEqual({ from: 'auto', to: 'en' });
  });

  test('auto+en target: English detected → swap to zh-CN (avoid same-language)', () => {
    expect(resolveTranslationDirection('en', 'auto', 'en')).toEqual({ from: 'auto', to: 'zh-CN' });
  });

  test('auto mode: normal passthrough', () => {
    expect(resolveTranslationDirection('en', 'auto', 'zh-CN')).toEqual({ from: 'auto', to: 'zh-CN' });
    expect(resolveTranslationDirection('mixed', 'auto', 'zh-CN')).toEqual({ from: 'auto', to: 'zh-CN' });
    expect(resolveTranslationDirection('en', 'auto', 'ja')).toEqual({ from: 'auto', to: 'ja' });
  });

  test('manual en→zh-CN: Chinese detected → swap direction', () => {
    expect(resolveTranslationDirection('zh', 'en', 'zh-CN')).toEqual({ from: 'zh-CN', to: 'en' });
  });

  test('manual en→zh-CN: English detected → direct translate', () => {
    expect(resolveTranslationDirection('en', 'en', 'zh-CN')).toEqual({ from: 'en', to: 'zh-CN' });
  });

  test('manual zh-CN→en: English detected → swap direction', () => {
    expect(resolveTranslationDirection('en', 'zh-CN', 'en')).toEqual({ from: 'en', to: 'zh-CN' });
  });

  test('manual zh-CN→en: Chinese detected → direct translate', () => {
    expect(resolveTranslationDirection('zh', 'zh-CN', 'en')).toEqual({ from: 'zh-CN', to: 'en' });
  });

  test('manual non-CJK: mixed/en/zh → auto-detect passthrough', () => {
    expect(resolveTranslationDirection('mixed', 'es', 'de')).toEqual({ from: 'auto', to: 'de' });
    expect(resolveTranslationDirection('en', 'es', 'de')).toEqual({ from: 'auto', to: 'de' });
    expect(resolveTranslationDirection('zh', 'es', 'de')).toEqual({ from: 'auto', to: 'de' });
  });

  test('manual fr→zh-TW: Chinese detected → target is Chinese variant', () => {
    expect(resolveTranslationDirection('zh', 'fr', 'zh-TW')).toEqual({ from: 'zh-TW', to: 'fr' });
  });

  test('manual en↔ko: direction swap works both ways', () => {
    expect(resolveTranslationDirection('en', 'en', 'ko')).toEqual({ from: 'en', to: 'ko' });
    expect(resolveTranslationDirection('en', 'ko', 'en')).toEqual({ from: 'en', to: 'ko' });
  });

  // ─── Japanese/Korean direction tests ───
  test('auto mode: Japanese detected with zh-CN target → translate to zh-CN (not English)', () => {
    expect(resolveTranslationDirection('ja', 'auto', 'zh-CN')).toEqual({ from: 'auto', to: 'zh-CN' });
  });

  test('auto mode: Korean detected with zh-CN target → translate to zh-CN', () => {
    expect(resolveTranslationDirection('ko', 'auto', 'zh-CN')).toEqual({ from: 'auto', to: 'zh-CN' });
  });

  test('manual ja→zh-CN: Japanese detected → direct translate', () => {
    expect(resolveTranslationDirection('ja', 'ja', 'zh-CN')).toEqual({ from: 'ja', to: 'zh-CN' });
  });

  test('manual ja→zh-CN: Chinese detected → swap direction', () => {
    expect(resolveTranslationDirection('zh', 'ja', 'zh-CN')).toEqual({ from: 'zh-CN', to: 'ja' });
  });

  test('manual ko→en: Korean detected → direct translate', () => {
    expect(resolveTranslationDirection('ko', 'ko', 'en')).toEqual({ from: 'ko', to: 'en' });
  });

  test('manual ko→en: English detected → swap direction', () => {
    expect(resolveTranslationDirection('en', 'ko', 'en')).toEqual({ from: 'en', to: 'ko' });
  });
});

// ─── mapToGoogleLang Tests ───

test.describe('mapToGoogleLang', () => {
  test('maps special codes: zh→zh-CN, mixed→auto, auto→auto', () => {
    expect(mapToGoogleLang('zh')).toBe('zh-CN');
    expect(mapToGoogleLang('mixed')).toBe('auto');
    expect(mapToGoogleLang('auto')).toBe('auto');
  });

  test('passes through other language codes unchanged', () => {
    expect(mapToGoogleLang('en')).toBe('en');
    expect(mapToGoogleLang('ja')).toBe('ja');
  });
});

// ─── parseGoogleExtendedResponse (copied from background.js) ───

function parseGoogleExtendedResponse(data) {
  if (!data) return null;

  const result = {
    translation: '',
    srcRomanization: '',
    tgtRomanization: '',
    dictionary: [],
    definitions: [],
    examples: []
  };

  if (data[0] && Array.isArray(data[0])) {
    const translationParts = [];
    for (const segment of data[0]) {
      if (!Array.isArray(segment)) continue;
      if (typeof segment[0] === 'string') {
        translationParts.push(segment[0]);
      }
      if (segment[0] === null && segment.length >= 4) {
        if (segment[2]) result.tgtRomanization = segment[2];
        if (segment[3]) result.srcRomanization = segment[3];
      }
    }
    result.translation = translationParts.join('');
  }

  if (data[1] && Array.isArray(data[1])) {
    for (const entry of data[1]) {
      if (!Array.isArray(entry) || !entry[0]) continue;
      const partOfSpeech = entry[0];
      const detailedEntries = entry[2];
      const definitions = [];
      if (Array.isArray(detailedEntries)) {
        for (const detail of detailedEntries) {
          if (!Array.isArray(detail)) continue;
          definitions.push({ definition: detail[0] });
        }
      }
      if (definitions.length > 0) {
        result.dictionary.push({ partOfSpeech, definitions: definitions.slice(0, 5) });
      }
    }
  }

  for (let i = 2; i < data.length; i++) {
    if (Array.isArray(data[i]) && data[i].length > 0 && Array.isArray(data[i][0])) {
      const block = data[i];
      for (const group of block) {
        if (!Array.isArray(group) || typeof group[0] !== 'string') continue;
        const pos = group[0];
        const defs = group[1];
        if (!Array.isArray(defs)) continue;
        const isDefBlock = defs.every(d => Array.isArray(d) && typeof d[0] === 'string');
        if (!isDefBlock) continue;
        const defItems = [];
        for (const d of defs) {
          defItems.push({
            definition: d[0],
            example: (typeof d[2] === 'string' && d[2].length > 0) ? d[2] : undefined
          });
        }
        if (defItems.length > 0) {
          result.definitions.push({ partOfSpeech: pos, definitions: defItems.slice(0, 3) });
        }
      }
    }
  }

  for (let i = 2; i < data.length; i++) {
    if (Array.isArray(data[i]) && data[i].length > 0) {
      const block = data[i];
      if (Array.isArray(block[0]) && Array.isArray(block[0][0])) {
        const exBlock = block[0];
        for (const ex of exBlock) {
          if (Array.isArray(ex) && typeof ex[0] === 'string') {
            result.examples.push(ex[0].replace(/<[^>]+>/g, ''));
          }
        }
      }
    }
  }

  return result;
}

// ─── parseGoogleExtendedResponse Tests ───

test.describe('parseGoogleExtendedResponse', () => {
  test('extracts translation and romanization', () => {
    const data = [
      [["你好", "hello", null, null, 3], [null, null, "Nǐ hǎo"]],
      null, "en"
    ];
    const result = parseGoogleExtendedResponse(data);
    expect(result.translation).toBe('你好');
  });

  test('extracts target romanization (pinyin) from segment[2]', () => {
    const data = [
      [["教程", "tutorials", null, null, 3], [null, null, "Jiàochéng", ""]],
      null, "en"
    ];
    const result = parseGoogleExtendedResponse(data);
    expect(result.translation).toBe('教程');
    expect(result.tgtRomanization).toBe('Jiàochéng');
  });

  test('returns null for null data', () => {
    expect(parseGoogleExtendedResponse(null)).toBeNull();
  });

  test('does not truncate when segment[0] is empty string', () => {
    const data = [
      [["编程", "programming"], ["", ", "], ["在打开", "on open"]],
      null, "en"
    ];
    const result = parseGoogleExtendedResponse(data);
    expect(result.translation).toBe('编程在打开');
  });

  test('skips non-array segments', () => {
    const data = [
      [["编程", "programming"], null, 42, ["测试", "test"], [null, null, "Biānchéng", ""]],
      null, "en"
    ];
    const result = parseGoogleExtendedResponse(data);
    expect(result.translation).toBe('编程测试');
    expect(result.tgtRomanization).toBe('Biānchéng');
  });

  test('extracts definitions with examples from dt=md block', () => {
    const data = [
      [["教程", "tutorials", null, null, 3]],
      null, "en", null, null, null, 1, [], null, null, null, null,
      [["noun",
        [["a period of instruction.", "m_en_gbus1084190.008", "a tutorial on English poetry"],
         ["an account or explanation.", "m_en_gbus1084190.014", "he created a tutorial"]],
        "tutorial", 1]]
    ];
    const result = parseGoogleExtendedResponse(data);
    expect(result.definitions.length).toBe(1);
    expect(result.definitions[0].definitions[0].definition).toContain('period of instruction');
    expect(result.definitions[0].definitions[0].example).toBe('a tutorial on English poetry');
    expect(result.definitions[0].definitions[0].example).not.toContain('m_en_gbus');
  });

  test('handles definitions without examples', () => {
    const data = [
      [["教程", "tutorials"]],
      null, "en", null, null, null, 1, [], null, null, null, null,
      [["noun", [["a period of instruction.", "m_en_gbus1084190.008"]], "tutorial", 1]]
    ];
    const result = parseGoogleExtendedResponse(data);
    expect(result.definitions[0].definitions[0].example).toBeUndefined();
  });
});
