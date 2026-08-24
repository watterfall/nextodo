import { describe, it, expect } from 'vitest';
import {
  calculateNextDue,
  createNextOccurrence,
  parseRecurrencePattern,
  recurrenceLabelKey,
  getTasksNeedingRecurrence,
  processRecurringTasks,
  hasRecurrence,
} from './recurrence';
import { createEmptyTask } from '$lib/types';
import type { Task, Priority, Recurrence } from '$lib/types';

function task(priority: Priority, overrides: Partial<Task> = {}): Task {
  return { ...createEmptyTask(priority), ...overrides };
}

const rec = (pattern: Recurrence['pattern']): Recurrence => ({ pattern, nextDue: null });

const from = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

describe('calculateNextDue', () => {
  it('advances each standard interval', () => {
    expect(calculateNextDue(rec('1d'), from('2026-01-04'))).toBe('2026-01-05');
    expect(calculateNextDue(rec('2d'), from('2026-01-04'))).toBe('2026-01-06');
    expect(calculateNextDue(rec('3d'), from('2026-01-04'))).toBe('2026-01-07');
    expect(calculateNextDue(rec('1w'), from('2026-01-04'))).toBe('2026-01-11');
    expect(calculateNextDue(rec('2w'), from('2026-01-04'))).toBe('2026-01-18');
    expect(calculateNextDue(rec('1m'), from('2026-01-15'))).toBe('2026-02-15');
    expect(calculateNextDue(rec('3m'), from('2026-01-15'))).toBe('2026-04-15');
  });

  // Regression: the old engine formatted via toISOString() while parsing local
  // midnight, so east of UTC a '1d' step returned the SAME day forever.
  it('advances by exactly one calendar day in the local zone', () => {
    for (const day of ['2026-01-04', '2026-03-15', '2026-06-30', '2026-12-31']) {
      const next = calculateNextDue(rec('1d'), from(day))!;
      const diffDays = Math.round((from(next).getTime() - from(day).getTime()) / 86400000);
      expect(diffDays).toBe(1);
    }
  });

  // Regression: bare setMonth(+1) on Jan 31 produced "Feb 31" → Mar 3.
  it('clamps a monthly step to the last day of a shorter target month', () => {
    expect(calculateNextDue(rec('1m'), from('2026-01-31'))).toBe('2026-02-28');
    expect(calculateNextDue(rec('1m'), from('2026-03-31'))).toBe('2026-04-30');
    expect(calculateNextDue(rec('1m'), from('2024-01-31'))).toBe('2024-02-29'); // leap year
  });

  it('resolves weekday lists and day-of-month selectors', () => {
    const weekly = { pattern: null, customPattern: 'mon,wed,fri', nextDue: null } as Recurrence;
    expect(calculateNextDue(weekly, from('2026-01-04'))).toBe('2026-01-05'); // Sun → Mon
    expect(calculateNextDue(weekly, from('2026-01-09'))).toBe('2026-01-12'); // Fri → next Mon

    const fifteenth = { pattern: '1m', customPattern: '1m@15', nextDue: null } as Recurrence;
    expect(calculateNextDue(fifteenth, from('2026-01-20'))).toBe('2026-02-15');

    const last = { pattern: '1m', customPattern: '1m@last', nextDue: null } as Recurrence;
    expect(calculateNextDue(last, from('2026-01-10'))).toBe('2026-02-28');
  });

  it('does not mutate the date it was given', () => {
    const base = from('2026-01-04');
    calculateNextDue(rec('1w'), base);
    expect(base.getDate()).toBe(4);
  });

  it('returns null for a null recurrence or empty pattern', () => {
    expect(calculateNextDue(null, from('2026-01-04'))).toBeNull();
    expect(calculateNextDue(rec(null), from('2026-01-04'))).toBeNull();
  });
});

describe('createNextOccurrence', () => {
  it('clones a completed recurring task forward with a fresh identity', () => {
    const done = task('C', {
      id: 'orig',
      content: 'water plants',
      completed: true,
      completedAt: '2026-01-04T10:00:00.000Z',
      dueDate: '2026-01-04',
      recurrence: rec('1w'),
      pomodoros: { estimated: 3, completed: 2 },
    });
    const next = createNextOccurrence(done);
    expect(next).not.toBeNull();
    expect(next!.id).not.toBe('orig');
    expect(next!.completed).toBe(false);
    expect(next!.completedAt).toBeNull();
    expect(next!.dueDate).toBe('2026-01-11');
    expect(next!.unitStart).toBe('2026-01-11');
    expect(next!.recurrence?.nextDue).toBe('2026-01-11');
    expect(next!.pomodoros).toEqual({ estimated: 3, completed: 0 });
  });

  it('returns null without a pattern or without a due date', () => {
    expect(createNextOccurrence(task('C', { recurrence: null, dueDate: '2026-01-04' }))).toBeNull();
    expect(createNextOccurrence(task('C', { recurrence: rec('1w'), dueDate: null }))).toBeNull();
  });
});

describe('parseRecurrencePattern', () => {
  it('normalizes aliases and codes', () => {
    expect(parseRecurrencePattern('daily')).toBe('1d');
    expect(parseRecurrencePattern('每天')).toBe('1d');
    expect(parseRecurrencePattern('WEEKLY')).toBe('1w'); // case-insensitive
    expect(parseRecurrencePattern('monthly')).toBe('1m');
    expect(parseRecurrencePattern('2w')).toBe('2w');
  });

  it('returns null for unknown input', () => {
    expect(parseRecurrencePattern('nonsense')).toBeNull();
  });
});

describe('recurrenceLabelKey', () => {
  it('returns an i18n key, never literal text', () => {
    expect(recurrenceLabelKey('1d')).toBe('recurrence.pattern.1d');
    expect(recurrenceLabelKey('3m')).toBe('recurrence.pattern.3m');
    expect(recurrenceLabelKey(null)).toBe('');
  });
});

describe('getTasksNeedingRecurrence', () => {
  it('selects only completed tasks with a pattern and a due date', () => {
    const eligible = task('C', { id: 'ok', completed: true, dueDate: '2026-01-04', recurrence: rec('1w') });
    const notDone = task('C', { id: 'open', completed: false, dueDate: '2026-01-04', recurrence: rec('1w') });
    const noDue = task('C', { id: 'nodue', completed: true, dueDate: null, recurrence: rec('1w') });
    const result = getTasksNeedingRecurrence([eligible, notDone, noDue]);
    expect(result.map((t) => t.id)).toEqual(['ok']);
  });
});

describe('processRecurringTasks', () => {
  it('creates the next occurrence for eligible tasks', () => {
    const done = task('C', { content: 'water plants', completed: true, dueDate: '2026-01-04', recurrence: rec('1w') });
    const result = processRecurringTasks([done]);
    expect(result).toHaveLength(1);
    expect(result[0].dueDate).toBe('2026-01-11');
  });

  it('skips creation when an open occurrence already exists', () => {
    const done = task('C', { content: 'water plants', completed: true, dueDate: '2026-01-04', recurrence: rec('1w') });
    const existing = task('C', { content: 'water plants', completed: false, dueDate: '2026-01-11' });
    expect(processRecurringTasks([done, existing])).toHaveLength(0);
  });
});

describe('hasRecurrence', () => {
  it('is true only when a concrete pattern is set', () => {
    expect(hasRecurrence(task('C', { recurrence: rec('1w') }))).toBe(true);
    expect(hasRecurrence(task('C', { recurrence: null }))).toBe(false);
    // A weekday list sets only customPattern, and is still a real recurrence.
    expect(hasRecurrence(task('C', { recurrence: { pattern: null, customPattern: 'mon', nextDue: null } }))).toBe(true);
    expect(hasRecurrence(task('C', { recurrence: { pattern: null, customPattern: '', nextDue: null } }))).toBe(false);
  });
});
