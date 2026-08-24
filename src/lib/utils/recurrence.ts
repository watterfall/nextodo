import type { Task, Recurrence, RecurrencePattern } from '$lib/types';
import { formatDateISO, parseISODate } from './unitCalc';

const WEEKDAY_MAP: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6
};

const DAY_STEPS: Record<string, number> = {
  '1d': 1, '2d': 2, '3d': 3, '1w': 7, '2w': 14
};

/**
 * Add whole months, clamping to the last valid day of the target month.
 *
 * A bare setMonth(+1) on Jan 31 produces "Feb 31", which normalizes to Mar 3 —
 * skipping February entirely for a monthly task.
 */
function addMonthsClamped(date: Date, months: number): void {
  const day = date.getDate();
  date.setDate(1); // park on a day every month has, so the month step can't overflow
  date.setMonth(date.getMonth() + months);
  const lastDayOfTarget = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(day, lastDayOfTarget));
}

/** Apply a trailing `@15` / `@last` day-of-month selector, if the pattern has one. */
function applyDayOfMonthSelector(date: Date, customPattern: string | undefined | null): void {
  const match = customPattern?.match(/@(\d+|last)$/);
  if (!match) return;

  if (match[1] === 'last') {
    date.setMonth(date.getMonth() + 1, 0); // day 0 of next month = last day of this one
    return;
  }
  const lastDayOfTarget = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(parseInt(match[1], 10), lastDayOfTarget));
}

/**
 * Calculate the next due date for a recurrence.
 *
 * This is the single recurrence engine for the app — `parser.ts` re-exports it.
 * It supports the standard intervals, weekday lists (`mon,wed,fri`) and the
 * monthly/quarterly day selectors (`1m@15`, `1m@last`). Dates are formatted from
 * local calendar parts, and `fromDate` is never mutated.
 */
export function calculateNextDue(recurrence: Recurrence | null, fromDate?: Date): string | null {
  if (!recurrence) return null;

  const base = fromDate ? new Date(fromDate) : new Date();
  base.setHours(0, 0, 0, 0);

  // Weekday list (`mon,wed,fri`) — only when no fixed interval is set.
  if (recurrence.customPattern && !recurrence.pattern) {
    const targetDays = recurrence.customPattern
      .split(',')
      .map(d => WEEKDAY_MAP[d.trim().toLowerCase()])
      .filter(d => d !== undefined)
      .sort((a, b) => a - b);
    if (targetDays.length === 0) return null;

    const currentDay = base.getDay();
    const nextDay = targetDays.find(d => d > currentDay);
    base.setDate(
      base.getDate() +
        (nextDay === undefined ? 7 - currentDay + targetDays[0] : nextDay - currentDay)
    );
    return formatDateISO(base);
  }

  const pattern = recurrence.pattern;
  if (!pattern) return null;

  if (pattern in DAY_STEPS) {
    base.setDate(base.getDate() + DAY_STEPS[pattern]);
  } else if (pattern === '1m' || pattern === '3m') {
    addMonthsClamped(base, pattern === '1m' ? 1 : 3);
    applyDayOfMonthSelector(base, recurrence.customPattern);
  } else {
    return null;
  }

  return formatDateISO(base);
}

/**
 * Create next occurrence of a recurring task when completed
 */
export function createNextOccurrence(task: Task): Task | null {
  const recurrence = task.recurrence;
  if (!recurrence || !hasRecurrence(task) || !task.dueDate) {
    return null;
  }

  // Pass the whole recurrence so `customPattern` (weekday lists, `@15`, `@last`)
  // survives into the next occurrence instead of being dropped.
  const nextDue = calculateNextDue(recurrence, parseISODate(task.dueDate));
  if (!nextDue) return null;

  return {
    ...task,
    id: crypto.randomUUID(),
    completed: false,
    completedAt: null,
    createdAt: new Date().toISOString(),
    unitStart: nextDue,
    dueDate: nextDue,
    recurrence: {
      ...recurrence,
      nextDue
    },
    pomodoros: {
      estimated: task.pomodoros.estimated,
      completed: 0
    }
  };
}

/**
 * Parse recurrence pattern from string input
 */
export function parseRecurrencePattern(input: string): RecurrencePattern {
  const normalized = input.toLowerCase().trim();

  const patterns: Record<string, RecurrencePattern> = {
    'daily': '1d',
    '每天': '1d',
    '每日': '1d',
    '1d': '1d',
    '2d': '2d',
    '3d': '3d',
    'weekly': '1w',
    '每周': '1w',
    '1w': '1w',
    '2w': '2w',
    'biweekly': '2w',
    '双周': '2w',
    'monthly': '1m',
    '每月': '1m',
    '1m': '1m',
    'quarterly': '3m',
    '每季': '3m',
    '3m': '3m'
  };

  return patterns[normalized] || null;
}

/**
 * i18n key for a recurrence pattern's display label.
 *
 * Returns a key rather than text because this module is Node-safe (the CLI
 * imports it) and cannot reach the Svelte i18n store. Callers render it with
 * `t(...)`; hardcoding the labels here leaked Chinese onto every en-US card.
 */
export function recurrenceLabelKey(pattern: RecurrencePattern): string {
  return pattern ? `recurrence.pattern.${pattern}` : '';
}

/**
 * Get tasks that need recurrence processing
 */
export function getTasksNeedingRecurrence(tasks: Task[]): Task[] {
  return tasks.filter(task =>
    task.completed &&
    hasRecurrence(task) &&
    task.dueDate
  );
}

/**
 * Process all recurring tasks and return new tasks to add
 */
export function processRecurringTasks(tasks: Task[]): Task[] {
  const needsProcessing = getTasksNeedingRecurrence(tasks);
  const newTasks: Task[] = [];

  for (const task of needsProcessing) {
    const nextTask = createNextOccurrence(task);
    if (nextTask) {
      // Check if the next occurrence already exists — completed ones count too.
      // Ignoring completed matches would re-create an occurrence the user has
      // already finished, every time the app starts.
      const exists = tasks.some(t =>
        t.id !== task.id &&
        t.content === nextTask.content &&
        t.dueDate === nextTask.dueDate
      );

      if (!exists) {
        newTasks.push(nextTask);
      }
    }
  }

  return newTasks;
}

/**
 * Check if task has active recurrence.
 *
 * A weekday list (`rec:mon,wed,fri`) sets only `customPattern`, so keying on
 * `pattern` alone would treat a documented recurrence form as non-recurring.
 */
export function hasRecurrence(task: Task): boolean {
  return !!(task.recurrence?.pattern || task.recurrence?.customPattern);
}
