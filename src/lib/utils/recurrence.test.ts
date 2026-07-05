import { describe, it, expect } from 'vitest';
import {
  calculateNextDue,
  createNextOccurrence,
  parseRecurrencePattern,
  formatRecurrence,
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

describe('calculateNextDue (string + pattern)', () => {
  it('advances each standard interval (TZ=UTC deterministic)', () => {
    expect(calculateNextDue('2026-01-04', '1d')).toBe('2026-01-05');
    expect(calculateNextDue('2026-01-04', '2d')).toBe('2026-01-06');
    expect(calculateNextDue('2026-01-04', '3d')).toBe('2026-01-07');
    expect(calculateNextDue('2026-01-04', '1w')).toBe('2026-01-11');
    expect(calculateNextDue('2026-01-04', '2w')).toBe('2026-01-18');
    expect(calculateNextDue('2026-01-15', '1m')).toBe('2026-02-15');
    expect(calculateNextDue('2026-01-15', '3m')).toBe('2026-04-15');
  });

  it('returns null for a null pattern', () => {
    expect(calculateNextDue('2026-01-04', null)).toBeNull();
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

describe('formatRecurrence', () => {
  it('renders labels and empty string for null', () => {
    expect(formatRecurrence('1d')).toBe('每日');
    expect(formatRecurrence('1w')).toBe('每周');
    expect(formatRecurrence('3m')).toBe('每季度');
    expect(formatRecurrence(null)).toBe('');
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
    expect(hasRecurrence(task('C', { recurrence: { pattern: null, customPattern: 'mon', nextDue: null } }))).toBe(false);
  });
});
