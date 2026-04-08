/**
 * Unit tests for SakuraDetector — word vs sentence detection.
 */
const { test, expect } = require('@playwright/test');
const SakuraDetector = require('../utils/detector');

test.describe('Detector', () => {
  // ─── English ───
  test('single English word → word/en', () => {
    const r = SakuraDetector.detect('hello');
    expect(r.type).toBe('word');
    expect(r.lang).toBe('en');
  });

  test('English word with apostrophe → word/en', () => {
    expect(SakuraDetector.detect("don't").type).toBe('word');
  });

  test('hyphenated English word → word/en', () => {
    expect(SakuraDetector.detect('well-known').type).toBe('word');
  });

  test('English word with punctuation is stripped', () => {
    expect(SakuraDetector.detect('hello.').text).toBe('hello');
    expect(SakuraDetector.detect('(hello)').text).toBe('hello');
    expect(SakuraDetector.detect('programming,').text).toBe('programming');
  });

  test('multiple English words → sentence/en', () => {
    const r = SakuraDetector.detect('hello world');
    expect(r.type).toBe('sentence');
    expect(r.lang).toBe('en');
  });

  // ─── Chinese ───
  test('single Chinese character → word/zh', () => {
    const r = SakuraDetector.detect('好');
    expect(r.type).toBe('word');
    expect(r.lang).toBe('zh');
  });

  test('Chinese word (≤4 chars) → word/zh', () => {
    expect(SakuraDetector.detect('你好').type).toBe('word');
    expect(SakuraDetector.detect('人工智能').type).toBe('word');
  });

  test('Chinese (≥5 chars) → sentence/zh', () => {
    expect(SakuraDetector.detect('我爱你中国').type).toBe('sentence');
  });

  test('Chinese with punctuation → sentence/zh', () => {
    expect(SakuraDetector.detect('你好！').type).toBe('sentence');
    expect(SakuraDetector.detect('你好，世界').type).toBe('sentence');
  });

  // ─── Mixed ───
  test('English with some Chinese → mixed/sentence', () => {
    const r = SakuraDetector.detect('hello 你');
    expect(r.lang).toBe('mixed');
    expect(r.type).toBe('sentence');
  });

  // ─── Japanese ───
  test('Japanese hiragana word → word/ja', () => {
    const r = SakuraDetector.detect('ありがとう');
    expect(r.type).toBe('word');
    expect(r.lang).toBe('ja');
  });

  test('Japanese katakana word → word/ja', () => {
    const r = SakuraDetector.detect('コンピュータ');
    expect(r.type).toBe('word');
    expect(r.lang).toBe('ja');
  });

  test('Japanese with kanji+kana → ja (not zh)', () => {
    const r = SakuraDetector.detect('日本語');
    // Has kanji + no kana → could be zh, but '語' is CJK
    // '日本語を勉強する' has kana → definitively ja
    const r2 = SakuraDetector.detect('日本語を勉強する');
    expect(r2.lang).toBe('ja');
    expect(r2.type).toBe('sentence');
  });

  test('Japanese sentence → sentence/ja', () => {
    const r = SakuraDetector.detect('これは日本語のテストです');
    expect(r.type).toBe('sentence');
    expect(r.lang).toBe('ja');
  });

  // ─── Korean ───
  test('Korean word → word/ko', () => {
    const r = SakuraDetector.detect('안녕');
    expect(r.type).toBe('word');
    expect(r.lang).toBe('ko');
  });

  test('Korean sentence → sentence/ko', () => {
    const r = SakuraDetector.detect('한국어를 공부하고 있습니다');
    expect(r.type).toBe('sentence');
    expect(r.lang).toBe('ko');
  });

  // ─── Edge cases ───
  test('empty string → sentence/en', () => {
    const r = SakuraDetector.detect('');
    expect(r.type).toBe('sentence');
    expect(r.lang).toBe('en');
  });

  test('whitespace-only → sentence/en', () => {
    const r = SakuraDetector.detect('   ');
    expect(r.type).toBe('sentence');
    expect(r.lang).toBe('en');
  });
});
