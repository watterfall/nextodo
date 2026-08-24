import { describe, it, expect, vi } from 'vitest';

// quota.ts imports $lib/i18n, whose store.svelte.ts uses Svelte $state runes that
// can't run under the plain-node vitest environment. Mock it so validateQuota can
// be exercised without loading the rune module. The mock echoes the key so we can
// assert which message path was taken.
vi.mock('$lib/i18n', () => ({
  t: (key: string, params?: Record<string, unknown>) =>
    params ? `${key} ${JSON.stringify(params)}` : key,
}));

import { validateQuota, canAddTask } from './quota';
import { createEmptyTask } from '$lib/types';
import type { Task, Priority } from '$lib/types';

function task(priority: Priority, overrides: Partial<Task> = {}): Task {
  return { ...createEmptyTask(priority), ...overrides };
}

describe('validateQuota', () => {
  it('returns null for future priority N (no quota)', () => {
    expect(validateQuota([], 'N')).toBeNull();
  });

  it('returns null when an active priority is under quota', () => {
    expect(validateQuota([], 'A')).toBeNull();
  });

  it('returns a quota-full message when the priority is at quota', () => {
    const msg = validateQuota([task('A')], 'A');
    expect(msg).not.toBeNull();
    expect(msg).toContain('message.quotaFull');
  });

  it('rejects adding directly to a hidden priority, via a translated message', () => {
    // Was an untranslated English literal — every other refusal goes through t().
    expect(validateQuota([], 'G')).toContain('message.hiddenPriority');
  });

  it('validates the sustained (S) single-slot rule', () => {
    expect(validateQuota([], 'S')).toBeNull();
    expect(validateQuota([task('S')], 'S')).toContain('message.sustainedExists');
  });
});

describe('quota.ts re-exports quotaCore', () => {
  it('exposes canAddTask through the wrapper module', () => {
    expect(canAddTask([], 'A')).toBe(true);
    expect(canAddTask([task('A')], 'A')).toBe(false);
  });
});
