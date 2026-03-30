/**
 * Unit tests for SakuraDetector — word vs sentence detection.
 * These run in Node.js, no browser needed.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

// The detector.js uses IIFE + module.exports.
// In Node, `const SakuraDetector` in the file doesn't leak to global.
// But module.exports is set, so we can require it directly.
const SakuraDetector = require('../utils/detector');

// ─── English Word Detection ───

test.describe('Detector — English Words', () => {
  test('single English word detected as word/en', () => {
    const result = SakuraDetector.detect('hello');
    expect(result.type).toBe('word');
    expect(result.lang).toBe('en');
    expect(result.text).toBe('hello');
  });

  test('word with apostrophe (don\'t) is a word', () => {
    const result = SakuraDetector.detect("don't");
    expect(result.type).toBe('word');
    expect(result.lang).toBe('en');
  });

  test('hyphenated word (well-known) is a word', () => {
    const result = SakuraDetector.detect('well-known');
    expect(result.type).toBe('word');
    expect(result.lang).toBe('en');
  });

  test('UPPERCASE word is a word', () => {
    const result = SakuraDetector.detect('HELLO');
    expect(result.type).toBe('word');
    expect(result.lang).toBe('en');
  });

  test('word with leading/trailing spaces is trimmed', () => {
    const result = SakuraDetector.detect('  hello  ');
    expect(result.type).toBe('word');
    expect(result.text).toBe('hello');
  });

  test('word with trailing comma is detected as word with clean text', () => {
    const result = SakuraDetector.detect('programming,');
    expect(result.type).toBe('word');
    expect(result.lang).toBe('en');
    expect(result.text).toBe('programming');
  });

  test('word with trailing period is detected as word with clean text', () => {
    const result = SakuraDetector.detect('hello.');
    expect(result.type).toBe('word');
    expect(result.lang).toBe('en');
    expect(result.text).toBe('hello');
  });

  test('word with leading and trailing punctuation is detected as word', () => {
    const result = SakuraDetector.detect('(hello)');
    expect(result.type).toBe('word');
    expect(result.lang).toBe('en');
    expect(result.text).toBe('hello');
  });

  test('word with trailing semicolon is detected as word', () => {
    const result = SakuraDetector.detect('return;');
    expect(result.type).toBe('word');
    expect(result.lang).toBe('en');
    expect(result.text).toBe('return');
  });

  test('word with surrounding quotes is detected as word', () => {
    const result = SakuraDetector.detect('"world"');
    expect(result.type).toBe('word');
    expect(result.lang).toBe('en');
    expect(result.text).toBe('world');
  });
});

// ─── English Sentence Detection ───

test.describe('Detector — English Sentences', () => {
  test('multiple English words detected as sentence/en', () => {
    const result = SakuraDetector.detect('hello world');
    expect(result.type).toBe('sentence');
    expect(result.lang).toBe('en');
  });

  test('long English phrase is a sentence', () => {
    const result = SakuraDetector.detect('The quick brown fox jumps over the lazy dog');
    expect(result.type).toBe('sentence');
    expect(result.lang).toBe('en');
  });

  test('word with number is a sentence (not pure alpha)', () => {
    const result = SakuraDetector.detect('hello123');
    expect(result.type).toBe('sentence');
    expect(result.lang).toBe('en');
  });
});

// ─── Chinese Word Detection ───

test.describe('Detector — Chinese Words', () => {
  test('single Chinese character is a word', () => {
    const result = SakuraDetector.detect('好');
    expect(result.type).toBe('word');
    expect(result.lang).toBe('zh');
  });

  test('two Chinese characters (你好) is a word', () => {
    const result = SakuraDetector.detect('你好');
    expect(result.type).toBe('word');
    expect(result.lang).toBe('zh');
  });

  test('four Chinese characters (人工智能) is a word', () => {
    const result = SakuraDetector.detect('人工智能');
    expect(result.type).toBe('word');
    expect(result.lang).toBe('zh');
  });

  test('five Chinese characters is a sentence', () => {
    const result = SakuraDetector.detect('我爱你中国');
    expect(result.type).toBe('sentence');
    expect(result.lang).toBe('zh');
  });

  test('Chinese with punctuation is a sentence', () => {
    const result = SakuraDetector.detect('你好！');
    expect(result.type).toBe('sentence');
    expect(result.lang).toBe('zh');
  });

  test('Chinese with comma is a sentence', () => {
    const result = SakuraDetector.detect('你好，世界');
    expect(result.type).toBe('sentence');
    expect(result.lang).toBe('zh');
  });
});

// ─── Chinese Sentence Detection ───

test.describe('Detector — Chinese Sentences', () => {
  test('long Chinese text is a sentence', () => {
    const result = SakuraDetector.detect('今天天气很好，我想出去走走');
    expect(result.type).toBe('sentence');
    expect(result.lang).toBe('zh');
  });
});

// ─── Mixed Language Detection ───

test.describe('Detector — Mixed Language', () => {
  test('mostly English with a few Chinese chars is mixed', () => {
    const result = SakuraDetector.detect('hello 你');
    expect(result.lang).toBe('mixed');
  });

  test('mixed content is treated as sentence', () => {
    const result = SakuraDetector.detect('I love 中国');
    expect(result.type).toBe('sentence');
    expect(result.lang).toBe('mixed');
  });
});

// ─── Edge Cases ───

test.describe('Detector — Edge Cases', () => {
  test('empty string returns sentence/en', () => {
    const result = SakuraDetector.detect('');
    expect(result.type).toBe('sentence');
    expect(result.lang).toBe('en');
  });

  test('whitespace-only string returns sentence/en', () => {
    const result = SakuraDetector.detect('   ');
    expect(result.type).toBe('sentence');
    expect(result.lang).toBe('en');
  });
});
