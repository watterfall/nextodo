import { describe, it, expect } from 'vitest';
import zhCN from './zh-CN';
import enUS from './en-US';

/**
 * Both locales must expose exactly the same key set.
 *
 * Components fall back to hardcoded Chinese (`t('x') || '中文'`) all over the
 * codebase, so a key missing from en-US does not fail loudly — it silently
 * renders Chinese to an English user. This test is the loud failure.
 */
function flatten(obj: unknown, prefix = ''): string[] {
  if (obj === null || typeof obj !== 'object') return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    flatten(v, prefix ? `${prefix}.${k}` : k)
  );
}

describe('i18n locale parity', () => {
  const zhKeys = new Set(flatten(zhCN));
  const enKeys = new Set(flatten(enUS));

  it('en-US defines every zh-CN key', () => {
    expect([...zhKeys].filter((k) => !enKeys.has(k))).toEqual([]);
  });

  it('zh-CN defines every en-US key', () => {
    expect([...enKeys].filter((k) => !zhKeys.has(k))).toEqual([]);
  });

  it('has no empty translation values', () => {
    const empties = Object.entries({ 'zh-CN': zhCN, 'en-US': enUS }).flatMap(([locale, dict]) =>
      flatten(dict)
        .filter((key) => {
          const value = key.split('.').reduce<unknown>(
            (acc, part) => (acc as Record<string, unknown>)?.[part],
            dict
          );
          return typeof value === 'string' && value.trim() === '';
        })
        .map((key) => `${locale}:${key}`)
    );
    expect(empties).toEqual([]);
  });
});
