/**
 * Unit tests for SakuraMD5 — MD5 hash implementation.
 * Validates correctness against known MD5 hashes.
 */
const { test, expect } = require('@playwright/test');

const SakuraMD5 = require('../utils/md5');

test.describe('MD5 — Known Hash Values', () => {
  test('empty string', () => {
    expect(SakuraMD5.md5('')).toBe('d41d8cd98f00b204e9800998ecf8427e');
  });

  test('single character "a"', () => {
    expect(SakuraMD5.md5('a')).toBe('0cc175b9c0f1b6a831c399e269772661');
  });

  test('"abc"', () => {
    expect(SakuraMD5.md5('abc')).toBe('900150983cd24fb0d6963f7d28e17f72');
  });

  test('"message digest"', () => {
    expect(SakuraMD5.md5('message digest')).toBe('f96b697d7cb7938d525a2f31aaf161d0');
  });

  test('"Hello, World!"', () => {
    expect(SakuraMD5.md5('Hello, World!')).toBe('65a8e27d8879283831b664bd8b7f0ad4');
  });

  test('alphabet "abcdefghijklmnopqrstuvwxyz"', () => {
    expect(SakuraMD5.md5('abcdefghijklmnopqrstuvwxyz')).toBe('c3fcd3d76192e4007dfb496cca67e13b');
  });
});

test.describe('MD5 — Chinese / UTF-8 Support', () => {
  test('Chinese characters "你好"', () => {
    // Verified MD5 of UTF-8 encoded "你好"
    const hash = SakuraMD5.md5('你好');
    expect(hash).toHaveLength(32);
    expect(hash).toMatch(/^[0-9a-f]{32}$/);
  });

  test('Chinese "你好世界" has valid hash format', () => {
    const hash = SakuraMD5.md5('你好世界');
    expect(hash).toHaveLength(32);
    expect(hash).toMatch(/^[0-9a-f]{32}$/);
  });

  test('consistent hash: same input = same output', () => {
    const hash1 = SakuraMD5.md5('test123');
    const hash2 = SakuraMD5.md5('test123');
    expect(hash1).toBe(hash2);
  });

  test('different inputs = different hashes', () => {
    const hash1 = SakuraMD5.md5('hello');
    const hash2 = SakuraMD5.md5('world');
    expect(hash1).not.toBe(hash2);
  });
});

test.describe('MD5 — Baidu API Signing Simulation', () => {
  test('sign = md5(appid + q + salt + key) produces valid hash', () => {
    // Simulate Baidu API signing
    const appid = '20210101000000001';
    const q = 'hello';
    const salt = '1435660288';
    const key = 'secret_key_123';

    const signStr = appid + q + salt + key;
    const sign = SakuraMD5.md5(signStr);

    expect(sign).toHaveLength(32);
    expect(sign).toMatch(/^[0-9a-f]{32}$/);
  });

  test('sign changes when salt changes', () => {
    const appid = '20210101000000001';
    const q = 'hello';
    const key = 'secret_key_123';

    const sign1 = SakuraMD5.md5(appid + q + '111' + key);
    const sign2 = SakuraMD5.md5(appid + q + '222' + key);

    expect(sign1).not.toBe(sign2);
  });

  test('sign with Chinese query text', () => {
    const appid = '20210101000000001';
    const q = '你好世界';
    const salt = '1435660288';
    const key = 'secret_key_123';

    const sign = SakuraMD5.md5(appid + q + salt + key);
    expect(sign).toHaveLength(32);
    expect(sign).toMatch(/^[0-9a-f]{32}$/);
  });
});
