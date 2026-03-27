/**
 * Unit tests for background.js logic — resolveTranslationDirection and mapToGoogleLang.
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
