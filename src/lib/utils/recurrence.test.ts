import { describe, it, expect } from 'vitest';
import {
  calculateNextDue,
  createNextOccurrence,
  parseRecurrence,
  formatRecurrence,
  isTodoTxtExpressible,
  migrateRecurrence,
  recurrenceLabel,
  getTasksNeedingRecurrence,
  processRecurringTasks,
  hasRecurrence,
} from './recurrence';
import { createEmptyTask } from '$lib/types';
import type { Task, Priority, Recurrence, RecurrenceUnit } from '$lib/types';

function task(priority: Priority, overrides: Partial<Task> = {}): Task {
  return { ...createEmptyTask(priority), ...overrides };
}

const rec = (n: number, unit: RecurrenceUnit, extra: Partial<Recurrence> = {}): Recurrence => ({
  n,
  unit,
  strict: false,
  nextDue: null,
  ...extra,
});

const from = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

describe('parseRecurrence', () => {
  it('parses the todo.txt grammar, with the count optional', () => {
    expect(parseRecurrence('1d')).toEqual(rec(1, 'd'));
    expect(parseRecurrence('d')).toEqual(rec(1, 'd')); // rec:d means daily
    expect(parseRecurrence('3m')).toEqual(rec(3, 'm'));
    expect(parseRecurrence('2w')).toEqual(rec(2, 'w'));
    expect(parseRecurrence('1y')).toEqual(rec(1, 'y'));
    expect(parseRecurrence('b')).toEqual(rec(1, 'b'));
  });

  it('reads the + prefix as strict recurrence', () => {
    expect(parseRecurrence('+1m')).toEqual(rec(1, 'm', { strict: true }));
    expect(parseRecurrence('+b')).toEqual(rec(1, 'b', { strict: true }));
    expect(parseRecurrence('1m')!.strict).toBe(false); // todo.txt default is loose
  });

  it('accepts the word aliases that predate the todo.txt alignment', () => {
    expect(parseRecurrence('daily')).toEqual(rec(1, 'd'));
    expect(parseRecurrence('每天')).toEqual(rec(1, 'd'));
    expect(parseRecurrence('WEEKLY')).toEqual(rec(1, 'w')); // case-insensitive
    expect(parseRecurrence('biweekly')).toEqual(rec(2, 'w'));
    expect(parseRecurrence('quarterly')).toEqual(rec(3, 'm'));
    expect(parseRecurrence('每年')).toEqual(rec(1, 'y'));
    expect(parseRecurrence('工作日')).toEqual(rec(1, 'b'));
  });

  it('keeps the two forms todo.txt cannot express in customPattern', () => {
    expect(parseRecurrence('mon,wed,fri')).toEqual(rec(1, 'w', { customPattern: 'mon,wed,fri' }));
    expect(parseRecurrence('1m@15')).toEqual(rec(1, 'm', { customPattern: '1m@15' }));
    expect(parseRecurrence('3m@last')).toEqual(rec(3, 'm', { customPattern: '3m@last' }));
  });

  it('returns null for anything it does not understand', () => {
    // A typo has to become "no recurrence", not a customPattern that no engine
    // can ever resolve — which is what the hand-rolled edit-modal branch did.
    expect(parseRecurrence('nonsense')).toBeNull();
    expect(parseRecurrence('0d')).toBeNull();
    expect(parseRecurrence('')).toBeNull();
    expect(parseRecurrence('1x')).toBeNull();
    expect(parseRecurrence('mon,notaday')).toBeNull();
  });
});

describe('formatRecurrence', () => {
  it('round-trips every form parseRecurrence produces', () => {
    for (const input of ['1d', '2d', '3d', '1w', '2w', '1m', '3m', '1y', '1b', '+1m', 'mon,wed,fri', '1m@15']) {
      const parsed = parseRecurrence(input)!;
      expect(parsed, input).not.toBeNull();
      expect(parseRecurrence(formatRecurrence(parsed))).toEqual(parsed);
    }
  });

  it('normalises the count-less todo.txt forms to an explicit 1', () => {
    expect(formatRecurrence(parseRecurrence('d'))).toBe('1d');
    expect(formatRecurrence(parseRecurrence('+m'))).toBe('+1m');
  });

  it('reports which recurrences a todo.txt file can hold', () => {
    expect(isTodoTxtExpressible(parseRecurrence('1d'))).toBe(true);
    expect(isTodoTxtExpressible(parseRecurrence('+3m'))).toBe(true);
    expect(isTodoTxtExpressible(parseRecurrence('mon,fri'))).toBe(false);
    expect(isTodoTxtExpressible(parseRecurrence('1m@15'))).toBe(false);
    expect(isTodoTxtExpressible(null)).toBe(false);
  });
});

describe('migrateRecurrence', () => {
  it('converts the old { pattern } shape', () => {
    expect(migrateRecurrence({ pattern: '1w', nextDue: null })).toEqual(rec(1, 'w', { strict: true }));
    expect(migrateRecurrence({ pattern: '3m', nextDue: '2026-04-15' })).toEqual(
      rec(3, 'm', { strict: true, nextDue: '2026-04-15' })
    );
  });

  it('prefers customPattern when the old pair disagreed', () => {
    // The old shape let `pattern` and `customPattern` describe different things;
    // the selector is the more specific of the two, so it wins.
    expect(migrateRecurrence({ pattern: '1m', customPattern: '1m@15', nextDue: null })).toEqual(
      rec(1, 'm', { strict: true, customPattern: '1m@15' })
    );
    expect(migrateRecurrence({ pattern: null, customPattern: 'mon,wed,fri', nextDue: null })).toEqual(
      rec(1, 'w', { strict: true, customPattern: 'mon,wed,fri' })
    );
  });

  // §4.3 of docs/SLEEK-INTEROP.md: the old engine always counted from the
  // previous due date, so existing data must keep doing that even though new
  // recurrences default to loose.
  it('marks everything already on disk as strict', () => {
    expect(migrateRecurrence({ pattern: '1d', nextDue: null })!.strict).toBe(true);
    expect(parseRecurrence('1d')!.strict).toBe(false);
  });

  it('leaves an already-migrated recurrence alone', () => {
    const current = rec(2, 'b', { strict: false, nextDue: '2026-02-02' });
    expect(migrateRecurrence(current)).toEqual(current);
  });

  it('returns null for absent or unrecoverable values', () => {
    expect(migrateRecurrence(null)).toBeNull();
    expect(migrateRecurrence(undefined)).toBeNull();
    expect(migrateRecurrence({ pattern: null, nextDue: null })).toBeNull();
    expect(migrateRecurrence({ pattern: 'garbage', nextDue: null })).toBeNull();
  });
});

describe('calculateNextDue', () => {
  it('advances each unit', () => {
    expect(calculateNextDue(rec(1, 'd'), from('2026-01-04'))).toBe('2026-01-05');
    expect(calculateNextDue(rec(2, 'd'), from('2026-01-04'))).toBe('2026-01-06');
    expect(calculateNextDue(rec(3, 'd'), from('2026-01-04'))).toBe('2026-01-07');
    expect(calculateNextDue(rec(1, 'w'), from('2026-01-04'))).toBe('2026-01-11');
    expect(calculateNextDue(rec(2, 'w'), from('2026-01-04'))).toBe('2026-01-18');
    expect(calculateNextDue(rec(1, 'm'), from('2026-01-15'))).toBe('2026-02-15');
    expect(calculateNextDue(rec(3, 'm'), from('2026-01-15'))).toBe('2026-04-15');
    expect(calculateNextDue(rec(1, 'y'), from('2026-01-15'))).toBe('2027-01-15');
  });

  it('skips weekends for business-day recurrence', () => {
    // 2026-01-02 is a Friday: one business day later is Monday the 5th.
    expect(calculateNextDue(rec(1, 'b'), from('2026-01-02'))).toBe('2026-01-05');
    // Five business days from Monday the 5th is the following Monday.
    expect(calculateNextDue(rec(5, 'b'), from('2026-01-05'))).toBe('2026-01-12');
    // Starting on a Saturday still lands on the next weekday.
    expect(calculateNextDue(rec(1, 'b'), from('2026-01-03'))).toBe('2026-01-05');
  });

  // Regression: the old engine formatted via toISOString() while parsing local
  // midnight, so east of UTC a '1d' step returned the SAME day forever.
  it('advances by exactly one calendar day in the local zone', () => {
    for (const day of ['2026-01-04', '2026-03-15', '2026-06-30', '2026-12-31']) {
      const next = calculateNextDue(rec(1, 'd'), from(day))!;
      const diffDays = Math.round((from(next).getTime() - from(day).getTime()) / 86400000);
      expect(diffDays).toBe(1);
    }
  });

  // Regression: bare setMonth(+1) on Jan 31 produced "Feb 31" → Mar 3.
  it('clamps a monthly step to the last day of a shorter target month', () => {
    expect(calculateNextDue(rec(1, 'm'), from('2026-01-31'))).toBe('2026-02-28');
    expect(calculateNextDue(rec(1, 'm'), from('2026-03-31'))).toBe('2026-04-30');
    expect(calculateNextDue(rec(1, 'm'), from('2024-01-31'))).toBe('2024-02-29'); // leap year
  });

  it('clamps Feb 29 to Feb 28 in a non-leap target year', () => {
    expect(calculateNextDue(rec(1, 'y'), from('2024-02-29'))).toBe('2025-02-28');
    expect(calculateNextDue(rec(4, 'y'), from('2024-02-29'))).toBe('2028-02-29');
  });

  it('resolves weekday lists and day-of-month selectors', () => {
    const weekly = parseRecurrence('mon,wed,fri')!;
    expect(calculateNextDue(weekly, from('2026-01-04'))).toBe('2026-01-05'); // Sun → Mon
    expect(calculateNextDue(weekly, from('2026-01-09'))).toBe('2026-01-12'); // Fri → next Mon

    expect(calculateNextDue(parseRecurrence('1m@15'), from('2026-01-20'))).toBe('2026-02-15');
    expect(calculateNextDue(parseRecurrence('1m@last'), from('2026-01-10'))).toBe('2026-02-28');
  });

  it('does not mutate the date it was given', () => {
    const base = from('2026-01-04');
    calculateNextDue(rec(1, 'w'), base);
    expect(base.getDate()).toBe(4);
  });

  it('returns null for a null or malformed recurrence', () => {
    expect(calculateNextDue(null, from('2026-01-04'))).toBeNull();
    expect(calculateNextDue({ n: 0, unit: 'd', strict: false, nextDue: null }, from('2026-01-04'))).toBeNull();
    expect(
      calculateNextDue({ n: 1, unit: 'x' as RecurrenceUnit, strict: false, nextDue: null }, from('2026-01-04'))
    ).toBeNull();
  });
});

describe('createNextOccurrence', () => {
  it('clones a completed recurring task forward with a fresh identity', () => {
    const done = task('C', {
      id: 'orig',
      content: 'water plants',
      status: 'completed',
      completedAt: '2026-01-04T10:00:00.000Z',
      dueDate: '2026-01-04',
      recurrence: rec(1, 'w', { strict: true }),
      pomodoros: { estimated: 3, completed: 2 },
    });
    const next = createNextOccurrence(done);
    expect(next).not.toBeNull();
    expect(next!.id).not.toBe('orig');
    expect(next!.status).toBe('open');
    expect(next!.completedAt).toBeNull();
    expect(next!.dueDate).toBe('2026-01-11');
    expect(next!.unitStart).toBe('2026-01-11');
    expect(next!.recurrence?.nextDue).toBe('2026-01-11');
    expect(next!.pomodoros).toEqual({ estimated: 3, completed: 0 });
  });

  // The strict/loose split is todo.txt's, and sleek implements the same one.
  it('counts a strict recurrence from the previous due date', () => {
    const late = task('C', {
      status: 'completed',
      completedAt: '2026-01-20T09:00:00',
      dueDate: '2026-01-15',
      recurrence: rec(1, 'm', { strict: true }),
    });
    // Ticked off five days late, but rent is still due on the 15th.
    expect(createNextOccurrence(late)!.dueDate).toBe('2026-02-15');
  });

  it('counts a loose recurrence from the completion date', () => {
    const late = task('C', {
      status: 'completed',
      completedAt: '2026-01-20T09:00:00',
      dueDate: '2026-01-15',
      recurrence: rec(1, 'd'),
    });
    // A daily chore finished five days late should not immediately produce
    // five overdue copies — it restarts from when it was actually done.
    expect(createNextOccurrence(late)!.dueDate).toBe('2026-01-21');
  });

  it('uses the passed-in completion moment when the task is not stamped yet', () => {
    // The CLI regenerates before it writes completedAt, so reading that field
    // alone would silently fall back to the wrong base date.
    const unstamped = task('C', { dueDate: '2026-01-15', recurrence: rec(1, 'd') });
    expect(createNextOccurrence(unstamped, from('2026-03-01'))!.dueDate).toBe('2026-03-02');
  });

  it('regenerates a loose recurrence that never had a due date', () => {
    // sleek does this too: the duplicate gets completion date + interval.
    const noDue = task('C', {
      status: 'completed',
      completedAt: '2026-01-20T09:00:00',
      dueDate: null,
      recurrence: rec(1, 'w'),
    });
    expect(createNextOccurrence(noDue)!.dueDate).toBe('2026-01-27');
  });

  it('returns null without a recurrence, or for a strict one with no due date', () => {
    expect(createNextOccurrence(task('C', { recurrence: null, dueDate: '2026-01-04' }))).toBeNull();
    expect(
      createNextOccurrence(task('C', { recurrence: rec(1, 'w', { strict: true }), dueDate: null }))
    ).toBeNull();
  });
});

describe('recurrenceLabel', () => {
  it('returns an i18n key and params, never literal text', () => {
    expect(recurrenceLabel(rec(1, 'd'))).toEqual({ key: 'recurrence.every.d', params: { n: 1 } });
    expect(recurrenceLabel(rec(3, 'm'))).toEqual({ key: 'recurrence.everyN.m', params: { n: 3 } });
    expect(recurrenceLabel(rec(1, 'b'))).toEqual({ key: 'recurrence.every.b', params: { n: 1 } });
    expect(recurrenceLabel(null)).toBeNull();
  });

  it('describes the custom forms separately', () => {
    expect(recurrenceLabel(parseRecurrence('mon,fri'))).toEqual({
      key: 'recurrence.weekdays',
      params: { days: 'mon,fri' },
    });
    expect(recurrenceLabel(parseRecurrence('1m@15'))).toEqual({
      key: 'recurrence.dayOfMonth',
      params: { day: 15 },
    });
    expect(recurrenceLabel(parseRecurrence('1m@last'))).toEqual({
      key: 'recurrence.lastDayOfMonth',
      params: {},
    });
  });
});

describe('getTasksNeedingRecurrence', () => {
  it('requires a due date only for strict recurrences', () => {
    const strictOk = task('C', { id: 'strict', status: 'completed' as const, dueDate: '2026-01-04', recurrence: rec(1, 'w', { strict: true }) });
    const strictNoDue = task('C', { id: 'strict-nodue', status: 'completed', dueDate: null, recurrence: rec(1, 'w', { strict: true }) });
    const looseNoDue = task('C', { id: 'loose-nodue', status: 'completed', dueDate: null, recurrence: rec(1, 'w') });
    const notDone = task('C', { id: 'open', status: 'open', dueDate: '2026-01-04', recurrence: rec(1, 'w') });

    const result = getTasksNeedingRecurrence([strictOk, strictNoDue, looseNoDue, notDone]);
    expect(result.map((t) => t.id).sort()).toEqual(['loose-nodue', 'strict']);
  });
});

describe('processRecurringTasks', () => {
  it('creates the next occurrence for eligible tasks', () => {
    const done = task('C', {
      content: 'water plants',
      status: 'completed',
      completedAt: '2026-01-04T10:00:00',
      dueDate: '2026-01-04',
      recurrence: rec(1, 'w', { strict: true }),
    });
    const result = processRecurringTasks([done]);
    expect(result).toHaveLength(1);
    expect(result[0].dueDate).toBe('2026-01-11');
  });

  it('skips creation when an occurrence already exists', () => {
    const done = task('C', {
      content: 'water plants',
      status: 'completed',
      completedAt: '2026-01-04T10:00:00',
      dueDate: '2026-01-04',
      recurrence: rec(1, 'w', { strict: true }),
    });
    const existing = task('C', { content: 'water plants', status: 'open', dueDate: '2026-01-11' });
    expect(processRecurringTasks([done, existing])).toHaveLength(0);
  });
});

describe('hasRecurrence', () => {
  it('is true whenever a recurrence object is present', () => {
    // n and unit are always set now, so the old "pattern null but customPattern
    // set" state — which half the call sites keyed on wrongly — cannot occur.
    expect(hasRecurrence(task('C', { recurrence: rec(1, 'w') }))).toBe(true);
    expect(hasRecurrence(task('C', { recurrence: parseRecurrence('mon') }))).toBe(true);
    expect(hasRecurrence(task('C', { recurrence: null }))).toBe(false);
  });
});
