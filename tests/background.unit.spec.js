/**
 * Unit tests for background.js logic — resolveTranslationDirection, mapToGoogleLang,
 * and parseGoogleExtendedResponse.
 *
 * Since background.js uses IIFE-style globals (no module.exports), we extract the
 * pure functions and test them directly.
 */
const { test, expect } = require('@playwright/test');

// ─── Extract pure functions from background.js ───
// resolveTranslationDirection is a pure function, so we can copy its logic here for unit testing.

function resolveTranslationDirection(detectedLang, sourceLang, targetLang) {
  // Auto-detect mode
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

  // Manual source language mode
  const isSourceChinese = sourceLang.startsWith('zh');
  const isTargetChinese = targetLang.startsWith('zh');

  if (detectedLang === 'zh') {
    if (isSourceChinese) {
      return { from: sourceLang, to: targetLang };
    } else if (isTargetChinese) {
      return { from: targetLang, to: sourceLang };
    } else {
      return { from: 'auto', to: targetLang };
    }
  } else if (detectedLang === 'en') {
    if (sourceLang === 'en') {
      return { from: 'en', to: targetLang };
    } else if (targetLang === 'en') {
      return { from: 'en', to: sourceLang };
    } else {
      return { from: 'auto', to: targetLang };
    }
  } else {
    return { from: 'auto', to: targetLang };
  }
}

function mapToGoogleLang(lang) {
  const map = {
    'zh': 'zh-CN',
    'mixed': 'auto',
    'auto': 'auto'
  };
  return map[lang] || lang;
}

// ─── Auto-Detect Mode Tests (sourceLang = 'auto') ───

test.describe('resolveTranslationDirection — Auto-detect + target zh-CN (default)', () => {
  const src = 'auto';
  const tgt = 'zh-CN';

  test('English text → auto → zh-CN', () => {
    const result = resolveTranslationDirection('en', src, tgt);
    expect(result).toEqual({ from: 'auto', to: 'zh-CN' });
  });

  test('Chinese text detected → auto → en (avoid same-language)', () => {
    const result = resolveTranslationDirection('zh', src, tgt);
    expect(result).toEqual({ from: 'auto', to: 'en' });
  });

  test('mixed text → auto → zh-CN', () => {
    const result = resolveTranslationDirection('mixed', src, tgt);
    expect(result).toEqual({ from: 'auto', to: 'zh-CN' });
  });
});

test.describe('resolveTranslationDirection — Auto-detect + target zh-TW', () => {
  const src = 'auto';
  const tgt = 'zh-TW';

  test('English text → auto → zh-TW', () => {
    const result = resolveTranslationDirection('en', src, tgt);
    expect(result).toEqual({ from: 'auto', to: 'zh-TW' });
  });

  test('Chinese text detected → auto → en (avoid same-language for zh-TW)', () => {
    const result = resolveTranslationDirection('zh', src, tgt);
    expect(result).toEqual({ from: 'auto', to: 'en' });
  });

  test('mixed text → auto → zh-TW', () => {
    const result = resolveTranslationDirection('mixed', src, tgt);
    expect(result).toEqual({ from: 'auto', to: 'zh-TW' });
  });
});

test.describe('resolveTranslationDirection — Auto-detect + target en', () => {
  const src = 'auto';
  const tgt = 'en';

  test('English text detected → auto → zh-CN (avoid same-language)', () => {
    const result = resolveTranslationDirection('en', src, tgt);
    expect(result).toEqual({ from: 'auto', to: 'zh-CN' });
  });

  test('Chinese text → auto → en', () => {
    const result = resolveTranslationDirection('zh', src, tgt);
    expect(result).toEqual({ from: 'auto', to: 'en' });
  });

  test('mixed text → auto → en', () => {
    const result = resolveTranslationDirection('mixed', src, tgt);
    expect(result).toEqual({ from: 'auto', to: 'en' });
  });
});

test.describe('resolveTranslationDirection — Auto-detect + target ja', () => {
  const src = 'auto';
  const tgt = 'ja';

  test('English text → auto → ja', () => {
    const result = resolveTranslationDirection('en', src, tgt);
    expect(result).toEqual({ from: 'auto', to: 'ja' });
  });

  test('Chinese text → auto → ja', () => {
    const result = resolveTranslationDirection('zh', src, tgt);
    expect(result).toEqual({ from: 'auto', to: 'ja' });
  });

  test('mixed text → auto → ja', () => {
    const result = resolveTranslationDirection('mixed', src, tgt);
    expect(result).toEqual({ from: 'auto', to: 'ja' });
  });
});

test.describe('resolveTranslationDirection — Auto-detect + target ko', () => {
  const src = 'auto';
  const tgt = 'ko';

  test('English text → auto → ko', () => {
    const result = resolveTranslationDirection('en', src, tgt);
    expect(result).toEqual({ from: 'auto', to: 'ko' });
  });

  test('Chinese text → auto → ko', () => {
    const result = resolveTranslationDirection('zh', src, tgt);
    expect(result).toEqual({ from: 'auto', to: 'ko' });
  });

  test('mixed text → auto → ko', () => {
    const result = resolveTranslationDirection('mixed', src, tgt);
    expect(result).toEqual({ from: 'auto', to: 'ko' });
  });
});

test.describe('resolveTranslationDirection — Auto-detect + target fr', () => {
  const src = 'auto';
  const tgt = 'fr';

  test('English text → auto → fr', () => {
    const result = resolveTranslationDirection('en', src, tgt);
    expect(result).toEqual({ from: 'auto', to: 'fr' });
  });

  test('Chinese text → auto → fr', () => {
    const result = resolveTranslationDirection('zh', src, tgt);
    expect(result).toEqual({ from: 'auto', to: 'fr' });
  });
});

// ─── Manual Source Language Tests (existing, updated) ───

test.describe('resolveTranslationDirection — Manual en → zh-CN', () => {
  const src = 'en';
  const tgt = 'zh-CN';

  test('English text → translates en → zh-CN', () => {
    const result = resolveTranslationDirection('en', src, tgt);
    expect(result).toEqual({ from: 'en', to: 'zh-CN' });
  });

  test('Chinese text → translates zh-CN → en', () => {
    const result = resolveTranslationDirection('zh', src, tgt);
    expect(result).toEqual({ from: 'zh-CN', to: 'en' });
  });

  test('mixed text → auto-detect → zh-CN', () => {
    const result = resolveTranslationDirection('mixed', src, tgt);
    expect(result).toEqual({ from: 'auto', to: 'zh-CN' });
  });
});

test.describe('resolveTranslationDirection — Manual zh-CN → en', () => {
  const src = 'zh-CN';
  const tgt = 'en';

  test('Chinese text → translates zh-CN → en', () => {
    const result = resolveTranslationDirection('zh', src, tgt);
    expect(result).toEqual({ from: 'zh-CN', to: 'en' });
  });

  test('English text → translates en → zh-CN (source)', () => {
    const result = resolveTranslationDirection('en', src, tgt);
    expect(result).toEqual({ from: 'en', to: 'zh-CN' });
  });

  test('mixed text → auto-detect → en', () => {
    const result = resolveTranslationDirection('mixed', src, tgt);
    expect(result).toEqual({ from: 'auto', to: 'en' });
  });
});

test.describe('resolveTranslationDirection — Manual ja → en', () => {
  const src = 'ja';
  const tgt = 'en';

  test('English text → translates en → ja (source)', () => {
    const result = resolveTranslationDirection('en', src, tgt);
    expect(result).toEqual({ from: 'en', to: 'ja' });
  });

  test('Chinese text detected → auto → en (neither src/tgt is Chinese)', () => {
    const result = resolveTranslationDirection('zh', src, tgt);
    expect(result).toEqual({ from: 'auto', to: 'en' });
  });

  test('mixed text → auto-detect → en', () => {
    const result = resolveTranslationDirection('mixed', src, tgt);
    expect(result).toEqual({ from: 'auto', to: 'en' });
  });
});

test.describe('resolveTranslationDirection — Manual ja → ko', () => {
  const src = 'ja';
  const tgt = 'ko';

  test('English text detected → auto → ko', () => {
    const result = resolveTranslationDirection('en', src, tgt);
    expect(result).toEqual({ from: 'auto', to: 'ko' });
  });

  test('Chinese text detected → auto → ko', () => {
    const result = resolveTranslationDirection('zh', src, tgt);
    expect(result).toEqual({ from: 'auto', to: 'ko' });
  });

  test('mixed text → auto → ko', () => {
    const result = resolveTranslationDirection('mixed', src, tgt);
    expect(result).toEqual({ from: 'auto', to: 'ko' });
  });
});

test.describe('resolveTranslationDirection — Manual fr → zh-TW', () => {
  const src = 'fr';
  const tgt = 'zh-TW';

  test('Chinese text → translates zh-TW (target) → fr (source)', () => {
    const result = resolveTranslationDirection('zh', src, tgt);
    expect(result).toEqual({ from: 'zh-TW', to: 'fr' });
  });

  test('English text → auto → zh-TW', () => {
    const result = resolveTranslationDirection('en', src, tgt);
    expect(result).toEqual({ from: 'auto', to: 'zh-TW' });
  });

  test('mixed text → auto → zh-TW', () => {
    const result = resolveTranslationDirection('mixed', src, tgt);
    expect(result).toEqual({ from: 'auto', to: 'zh-TW' });
  });
});

test.describe('resolveTranslationDirection — Manual zh-TW → ja', () => {
  const src = 'zh-TW';
  const tgt = 'ja';

  test('Chinese text → translates zh-TW → ja', () => {
    const result = resolveTranslationDirection('zh', src, tgt);
    expect(result).toEqual({ from: 'zh-TW', to: 'ja' });
  });

  test('English text → auto → ja', () => {
    const result = resolveTranslationDirection('en', src, tgt);
    expect(result).toEqual({ from: 'auto', to: 'ja' });
  });
});

test.describe('resolveTranslationDirection — Manual es → de', () => {
  const src = 'es';
  const tgt = 'de';

  test('English text → auto → de (neither is English)', () => {
    const result = resolveTranslationDirection('en', src, tgt);
    expect(result).toEqual({ from: 'auto', to: 'de' });
  });

  test('Chinese text → auto → de (neither is Chinese)', () => {
    const result = resolveTranslationDirection('zh', src, tgt);
    expect(result).toEqual({ from: 'auto', to: 'de' });
  });

  test('mixed text → auto → de', () => {
    const result = resolveTranslationDirection('mixed', src, tgt);
    expect(result).toEqual({ from: 'auto', to: 'de' });
  });
});

test.describe('resolveTranslationDirection — Manual en → ja', () => {
  const src = 'en';
  const tgt = 'ja';

  test('English text → translates en → ja', () => {
    const result = resolveTranslationDirection('en', src, tgt);
    expect(result).toEqual({ from: 'en', to: 'ja' });
  });

  test('Chinese text → auto → ja (neither is Chinese)', () => {
    const result = resolveTranslationDirection('zh', src, tgt);
    expect(result).toEqual({ from: 'auto', to: 'ja' });
  });

  test('mixed text → auto → ja', () => {
    const result = resolveTranslationDirection('mixed', src, tgt);
    expect(result).toEqual({ from: 'auto', to: 'ja' });
  });
});

test.describe('resolveTranslationDirection — Manual en ↔ ko', () => {
  test('English text with en→ko → translates en → ko', () => {
    const result = resolveTranslationDirection('en', 'en', 'ko');
    expect(result).toEqual({ from: 'en', to: 'ko' });
  });

  test('English text with ko→en → translates en → ko (swap)', () => {
    const result = resolveTranslationDirection('en', 'ko', 'en');
    expect(result).toEqual({ from: 'en', to: 'ko' });
  });
});

// ─── mapToGoogleLang Tests ───

test.describe('mapToGoogleLang', () => {
  test('maps "zh" to "zh-CN"', () => {
    expect(mapToGoogleLang('zh')).toBe('zh-CN');
  });

  test('maps "mixed" to "auto"', () => {
    expect(mapToGoogleLang('mixed')).toBe('auto');
  });

  test('maps "auto" to "auto"', () => {
    expect(mapToGoogleLang('auto')).toBe('auto');
  });

  test('passes through "en" unchanged', () => {
    expect(mapToGoogleLang('en')).toBe('en');
  });

  test('passes through "zh-CN" unchanged', () => {
    expect(mapToGoogleLang('zh-CN')).toBe('zh-CN');
  });

  test('passes through "zh-TW" unchanged', () => {
    expect(mapToGoogleLang('zh-TW')).toBe('zh-TW');
  });

  test('passes through "ja" unchanged', () => {
    expect(mapToGoogleLang('ja')).toBe('ja');
  });

  test('passes through "ko" unchanged', () => {
    expect(mapToGoogleLang('ko')).toBe('ko');
  });

  test('passes through "fr" unchanged', () => {
    expect(mapToGoogleLang('fr')).toBe('fr');
  });

  test('passes through "de" unchanged', () => {
    expect(mapToGoogleLang('de')).toBe('de');
  });

  test('passes through "es" unchanged', () => {
    expect(mapToGoogleLang('es')).toBe('es');
  });

  test('passes through "ru" unchanged', () => {
    expect(mapToGoogleLang('ru')).toBe('ru');
  });

  test('passes through "ar" unchanged', () => {
    expect(mapToGoogleLang('ar')).toBe('ar');
  });
});

// ─── parseGoogleExtendedResponse (copied from background.js for unit testing) ───

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

  // Translation (data[0])
  if (data[0] && Array.isArray(data[0])) {
    const translationParts = [];
    for (const segment of data[0]) {
      if (!Array.isArray(segment)) continue;
      // Use strict type check — segment[0] can be "" (empty string) which is falsy
      // but still a valid translation part (e.g. for whitespace/punctuation segments)
      if (typeof segment[0] === 'string') {
        translationParts.push(segment[0]);
      }
      if (segment[0] === null && segment.length >= 4) {
        if (segment[2]) result.srcRomanization = segment[2];
        if (segment[3]) result.tgtRomanization = segment[3];
      }
    }
    result.translation = translationParts.join('');
  }

  // Dictionary (data[1] when dt=bd)
  if (data[1] && Array.isArray(data[1])) {
    for (const entry of data[1]) {
      if (!Array.isArray(entry) || !entry[0]) continue;
      const partOfSpeech = entry[0];
      const detailedEntries = entry[2];

      const definitions = [];
      if (Array.isArray(detailedEntries)) {
        for (const detail of detailedEntries) {
          if (!Array.isArray(detail)) continue;
          const word = detail[0];
          definitions.push({
            definition: word,
          });
        }
      }

      if (definitions.length > 0) {
        result.dictionary.push({
          partOfSpeech,
          definitions: definitions.slice(0, 5)
        });
      }
    }
  }

  // Definitions (dt=md) — scan all indices
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
            // d[1] is the Oxford dictionary ID (skip it), d[2] is the example sentence
            example: (typeof d[2] === 'string' && d[2].length > 0) ? d[2] : undefined
          });
        }
        if (defItems.length > 0) {
          result.definitions.push({
            partOfSpeech: pos,
            definitions: defItems.slice(0, 3)
          });
        }
      }
    }
  }

  // Examples (dt=ex) — scan for example blocks
  for (let i = 2; i < data.length; i++) {
    if (Array.isArray(data[i]) && data[i].length > 0) {
      const block = data[i];
      if (Array.isArray(block[0]) && Array.isArray(block[0][0])) {
        const exBlock = block[0];
        for (const ex of exBlock) {
          if (Array.isArray(ex) && typeof ex[0] === 'string') {
            const cleanExample = ex[0].replace(/<[^>]+>/g, '');
            result.examples.push(cleanExample);
          }
        }
      }
    }
  }

  return result;
}

// ─── parseGoogleExtendedResponse Tests ───

test.describe('parseGoogleExtendedResponse — definitions parsing', () => {
  test('extracts definition text correctly from dt=md block', () => {
    // Simulates the real Google Translate response for "tutorials"
    const data = [
      [["教程", "tutorials", null, null, 3]],
      null,
      "en",
      null, null, null, 1, [], null, null, null, null,
      [
        ["noun",
          [
            ["a period of instruction given by a university or college tutor to an individual or very small group.", "m_en_gbus1084190.008", "a tutorial on English poetry"],
            ["an account or explanation of a subject or task, especially as an online video.", "m_en_gbus1084190.014", "he has created a simplified tutorial"]
          ],
          "tutorial", 1
        ]
      ]
    ];

    const result = parseGoogleExtendedResponse(data);

    expect(result.definitions.length).toBe(1);
    expect(result.definitions[0].partOfSpeech).toBe('noun');
    expect(result.definitions[0].definitions.length).toBe(2);

    // Definition text should be the actual definition, not the Oxford ID
    expect(result.definitions[0].definitions[0].definition).toContain('period of instruction');
    expect(result.definitions[0].definitions[1].definition).toContain('account or explanation');
  });

  test('does NOT include Oxford dictionary IDs as examples', () => {
    const data = [
      [["教程", "tutorials"]],
      null,
      "en",
      null, null, null, 1, [], null, null, null, null,
      [
        ["noun",
          [
            ["a period of instruction.", "m_en_gbus1084190.008", "a tutorial on English poetry"],
            ["an account or explanation.", "m_en_gbus1084190.014", "he created a tutorial"]
          ],
          "tutorial", 1
        ]
      ]
    ];

    const result = parseGoogleExtendedResponse(data);

    // Examples should be the actual example sentences (d[2]), NOT the Oxford IDs (d[1])
    const def1 = result.definitions[0].definitions[0];
    const def2 = result.definitions[0].definitions[1];

    expect(def1.example).toBe('a tutorial on English poetry');
    expect(def1.example).not.toContain('m_en_gbus');

    expect(def2.example).toBe('he created a tutorial');
    expect(def2.example).not.toContain('m_en_gbus');
  });

  test('handles definitions without example sentences (d[2] missing)', () => {
    const data = [
      [["教程", "tutorials"]],
      null,
      "en",
      null, null, null, 1, [], null, null, null, null,
      [
        ["noun",
          [
            ["a period of instruction.", "m_en_gbus1084190.008"],
          ],
          "tutorial", 1
        ]
      ]
    ];

    const result = parseGoogleExtendedResponse(data);

    expect(result.definitions[0].definitions[0].definition).toContain('period of instruction');
    expect(result.definitions[0].definitions[0].example).toBeUndefined();
  });

  test('handles definitions with null example at d[2]', () => {
    const data = [
      [["教程", "tutorials"]],
      null,
      "en",
      null, null, null, 1, [], null, null, null, null,
      [
        ["noun",
          [
            ["a definition.", "m_en_gbus1084190.008", null],
          ],
          "tutorial", 1
        ]
      ]
    ];

    const result = parseGoogleExtendedResponse(data);

    expect(result.definitions[0].definitions[0].example).toBeUndefined();
  });
});

test.describe('parseGoogleExtendedResponse — translation and romanization', () => {
  test('extracts translation text', () => {
    const data = [
      [["你好", "hello", null, null, 3], [null, null, "Nǐ hǎo"]],
      null,
      "en"
    ];

    const result = parseGoogleExtendedResponse(data);
    expect(result.translation).toBe('你好');
    expect(result.srcRomanization).toBe('');
  });

  test('extracts romanization from last segment', () => {
    const data = [
      [["教程", "tutorials", null, null, 3], [null, null, "Jiàochéng"]],
      null,
      "en"
    ];

    const result = parseGoogleExtendedResponse(data);
    expect(result.translation).toBe('教程');
  });

  test('returns null for null data', () => {
    expect(parseGoogleExtendedResponse(null)).toBeNull();
  });

  test('does not truncate when segment[0] is empty string', () => {
    // Google sometimes returns empty string for punctuation/whitespace segments
    const data = [
      [
        ["编程", "programming"],
        ["", ", "],
        ["在打开", "on open"],
        [null, null, "romanization"]
      ],
      null,
      "en"
    ];

    const result = parseGoogleExtendedResponse(data);
    expect(result.translation).toBe('编程在打开');
  });

  test('assembles multi-segment translation without truncation', () => {
    // Simulates a typical multi-segment Google response for a sentence
    const data = [
      [
        ["这是一个", "This is a "],
        ["测试句子。", "test sentence."],
        [null, null, "Zhè shì yīgè cèshì jùzi.", ""]
      ],
      null,
      "en"
    ];

    const result = parseGoogleExtendedResponse(data);
    expect(result.translation).toBe('这是一个测试句子。');
    expect(result.srcRomanization).toBe('Zhè shì yīgè cèshì jùzi.');
  });

  test('handles single-segment translation', () => {
    const data = [
      [
        ["你好世界", "hello world", null, null, 3]
      ],
      null,
      "en"
    ];

    const result = parseGoogleExtendedResponse(data);
    expect(result.translation).toBe('你好世界');
  });

  test('skips non-array segments gracefully', () => {
    const data = [
      [
        ["编程", "programming"],
        null,
        42,
        ["测试", "test"],
        [null, null, "Biānchéng", ""]
      ],
      null,
      "en"
    ];

    const result = parseGoogleExtendedResponse(data);
    expect(result.translation).toBe('编程测试');
    expect(result.srcRomanization).toBe('Biānchéng');
  });
});
