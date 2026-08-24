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
  it('returns null when a priority is under quota', () => {
    expect(validateQuota([], 'C')).toBeNull();
  });

  it('returns a quota-full message when the priority is at quota', () => {
    const msg = validateQuota([task('B'), task('B')], 'B');
    expect(msg).not.toBeNull();
    expect(msg).toContain('message.quotaFull');
  });

  it('never refuses the single-slot tier — Highlander makes room instead', () => {
    expect(validateQuota([], 'A')).toBeNull();
    expect(validateQuota([task('A')], 'A')).toBeNull();
  });

  it('ignores finished tasks when measuring the load', () => {
    // Three completed Cs do not fill the C tier — they are not owed any more.
    const done = [task('C'), task('C'), task('C')].map(t => ({ ...t, status: 'completed' as const }));
    expect(validateQuota(done, 'C')).toBeNull();
  });
});

describe('quota.ts re-exports quotaCore', () => {
  it('exposes canAddTask through the wrapper module', () => {
    expect(canAddTask([], 'A')).toBe(true);
    expect(canAddTask([task('A')], 'A')).toBe(false);
  });
});
