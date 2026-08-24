import type { Task, Recurrence, RecurrenceUnit } from '$lib/types';
import { formatDateISO, parseISODate } from './unitCalc';

/**
 * The recurrence engine. Its data model is the todo.txt `rec:` attribute:
 *
 *     rec:[+]<n?><d|b|w|m|y>
 *
 * so a recurrence typed into FocusFlow and one imported from a sleek todo.txt
 * are the same object and step to the same date. Two refinements have no
 * todo.txt syntax and therefore live only here, in `customPattern`: weekday
 * lists (`mon,wed,fri`) and day-of-month selectors (`1m@15`, `1m@last`).
 *
 * This module is Node-safe — the CLI imports it, so no Svelte, Tauri or i18n.
 */

const WEEKDAY_MAP: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6
};

const WEEKDAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

const UNITS: readonly RecurrenceUnit[] = ['d', 'b', 'w', 'm', 'y'];

// Word forms accepted in the `rec:` slot in addition to the todo.txt grammar.
// They existed before the todo.txt alignment and are kept so old input still
// parses; each maps onto the same {n, unit} the grammar would produce.
const ALIASES: Record<string, { n: number; unit: RecurrenceUnit }> = {
  daily: { n: 1, unit: 'd' }, 每天: { n: 1, unit: 'd' }, 每日: { n: 1, unit: 'd' },
  隔天: { n: 2, unit: 'd' },
  weekly: { n: 1, unit: 'w' }, 每周: { n: 1, unit: 'w' },
  biweekly: { n: 2, unit: 'w' }, 双周: { n: 2, unit: 'w' }, 隔周: { n: 2, unit: 'w' },
  monthly: { n: 1, unit: 'm' }, 每月: { n: 1, unit: 'm' },
  quarterly: { n: 3, unit: 'm' }, 每季: { n: 3, unit: 'm' }, 每季度: { n: 3, unit: 'm' },
  yearly: { n: 1, unit: 'y' }, annually: { n: 1, unit: 'y' }, 每年: { n: 1, unit: 'y' },
  workdays: { n: 1, unit: 'b' }, 工作日: { n: 1, unit: 'b' }
};

// ---------------------------------------------------------------------------
// Date stepping
// ---------------------------------------------------------------------------

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

/** Add whole years, clamping Feb 29 to Feb 28 in a non-leap target year. */
function addYearsClamped(date: Date, years: number): void {
  const day = date.getDate();
  date.setDate(1);
  date.setFullYear(date.getFullYear() + years);
  const lastDayOfTarget = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(day, lastDayOfTarget));
}

/** Step forward n business days, skipping Saturday and Sunday. */
function addBusinessDays(date: Date, n: number): void {
  let remaining = n;
  while (remaining > 0) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) remaining--;
  }
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

/** The weekday numbers of a `mon,wed,fri` style pattern, or null if it isn't one. */
function weekdayList(customPattern: string | undefined | null): number[] | null {
  if (!customPattern) return null;
  const parts = customPattern.split(',').map(p => p.trim().toLowerCase());
  if (parts.some(p => WEEKDAY_MAP[p] === undefined)) return null;
  const days = [...new Set(parts.map(p => WEEKDAY_MAP[p]))].sort((a, b) => a - b);
  return days.length > 0 ? days : null;
}

// ---------------------------------------------------------------------------
// Parse / format
// ---------------------------------------------------------------------------

/**
 * Parse the operand of `rec:` into a Recurrence.
 *
 * Accepts, in order: the todo.txt grammar (`1d`, `d`, `+1m`, `3m`, `b`, `1y`),
 * the word aliases above, weekday lists and day-of-month selectors. Returns
 * null for anything else so a typo becomes "no recurrence" rather than a
 * silently wrong schedule.
 */
export function parseRecurrence(input: string): Recurrence | null {
  const raw = input.trim();
  if (!raw) return null;
  const normalized = raw.toLowerCase();

  // todo.txt grammar: optional `+` (strict), optional count, one unit letter.
  const grammar = normalized.match(/^(\+)?(\d+)?([dbwmy])$/);
  if (grammar) {
    const n = grammar[2] ? parseInt(grammar[2], 10) : 1;
    if (n < 1) return null;
    return { n, unit: grammar[3] as RecurrenceUnit, strict: !!grammar[1], nextDue: null };
  }

  const alias = ALIASES[normalized];
  if (alias) {
    return { n: alias.n, unit: alias.unit, strict: false, nextDue: null };
  }

  // Weekday list: mon,wed,fri. Modelled as "every 1 week, on these days".
  if (weekdayList(normalized)) {
    return { n: 1, unit: 'w', strict: false, customPattern: normalized, nextDue: null };
  }

  // Day-of-month selector: 1m@15, 3m@last.
  const dayOfMonth = normalized.match(/^(\d+)m@(\d+|last)$/);
  if (dayOfMonth) {
    const n = parseInt(dayOfMonth[1], 10);
    if (n < 1) return null;
    return { n, unit: 'm', strict: false, customPattern: normalized, nextDue: null };
  }

  return null;
}

/**
 * Render a Recurrence back to the string that would parse into it.
 *
 * For anything without a `customPattern` this is valid todo.txt, which is what
 * makes the round trip through a shared file lossless. A `customPattern` is by
 * definition not expressible in todo.txt and is returned verbatim — callers
 * writing to a todo.txt file must check `isTodoTxtExpressible` first.
 */
export function formatRecurrence(recurrence: Recurrence | null): string {
  if (!recurrence) return '';
  if (recurrence.customPattern) return recurrence.customPattern;
  return `${recurrence.strict ? '+' : ''}${recurrence.n}${recurrence.unit}`;
}

/** Whether this recurrence can be written into a todo.txt `rec:` without loss. */
export function isTodoTxtExpressible(recurrence: Recurrence | null): boolean {
  return !!recurrence && !recurrence.customPattern;
}

/**
 * Upgrade a persisted recurrence written before the todo.txt alignment.
 *
 * The old shape was `{ pattern: '1w' | null, customPattern?: string, nextDue }`,
 * where the two fields could disagree. Both collapse into the same
 * `{ n, unit, ... }` here.
 *
 * Everything that already exists on disk gets `strict: true`, because that is
 * what the old engine did — it always counted from the previous due date. New
 * recurrences default to loose (todo.txt's default), so this is deliberately
 * not the same as the parse default: nobody's existing repeating task should
 * shift its dates because of the migration.
 */
export function migrateRecurrence(raw: unknown): Recurrence | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<Recurrence> & { pattern?: string | null };

  // Already migrated.
  if (typeof value.n === 'number' && typeof value.unit === 'string') {
    return {
      n: value.n,
      unit: value.unit,
      strict: value.strict ?? true,
      ...(value.customPattern ? { customPattern: value.customPattern } : {}),
      nextDue: value.nextDue ?? null
    };
  }

  const source = value.customPattern || value.pattern;
  if (!source) return null;

  const parsed = parseRecurrence(source);
  if (!parsed) return null;

  return { ...parsed, strict: true, nextDue: value.nextDue ?? null };
}

// ---------------------------------------------------------------------------
// Stepping
// ---------------------------------------------------------------------------

/**
 * Calculate the next due date for a recurrence, counting from `fromDate`.
 *
 * Deciding WHICH date to count from is the caller's job — see
 * `createNextOccurrence` for the strict/loose rule. Dates are formatted from
 * local calendar parts and `fromDate` is never mutated.
 */
export function calculateNextDue(recurrence: Recurrence | null, fromDate?: Date): string | null {
  if (!recurrence) return null;
  if (!Number.isFinite(recurrence.n) || recurrence.n < 1) return null;
  if (!UNITS.includes(recurrence.unit)) return null;

  const base = fromDate ? new Date(fromDate) : new Date();
  base.setHours(0, 0, 0, 0);

  // A weekday list ignores n/unit entirely: the next occurrence is simply the
  // next listed weekday after the base date.
  const days = weekdayList(recurrence.customPattern);
  if (days) {
    const currentDay = base.getDay();
    const nextDay = days.find(d => d > currentDay);
    base.setDate(
      base.getDate() + (nextDay === undefined ? 7 - currentDay + days[0] : nextDay - currentDay)
    );
    return formatDateISO(base);
  }

  switch (recurrence.unit) {
    case 'd':
      base.setDate(base.getDate() + recurrence.n);
      break;
    case 'b':
      addBusinessDays(base, recurrence.n);
      break;
    case 'w':
      base.setDate(base.getDate() + recurrence.n * 7);
      break;
    case 'm':
      addMonthsClamped(base, recurrence.n);
      applyDayOfMonthSelector(base, recurrence.customPattern);
      break;
    case 'y':
      addYearsClamped(base, recurrence.n);
      break;
  }

  return formatDateISO(base);
}

/**
 * Create the next occurrence of a recurring task that has just been resolved.
 *
 * The strict/loose distinction is todo.txt's and sleek implements the same one:
 * a strict recurrence (`rec:+1m`) counts from the previous DUE date, so "pay
 * rent on the 15th" stays on the 15th however late it was ticked off; a loose
 * one counts from the COMPLETION date, so a daily chore finished three days
 * late does not immediately produce three overdue copies.
 *
 * `completedOn` is explicit because callers resolve a task in different orders —
 * the CLI regenerates before it stamps `completedAt`, so reading that field
 * alone would silently fall back to the wrong base date.
 */
export function createNextOccurrence(task: Task, completedOn: Date = new Date()): Task | null {
  const recurrence = task.recurrence;
  if (!recurrence) return null;

  let base: Date;
  if (recurrence.strict) {
    // No previous due date means there is nothing to be strict about.
    if (!task.dueDate) return null;
    base = parseISODate(task.dueDate);
  } else {
    base = task.completedAt ? new Date(task.completedAt) : completedOn;
  }

  const nextDue = calculateNextDue(recurrence, base);
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

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

/**
 * i18n key + params for a recurrence's display label.
 *
 * Returns a key rather than text because this module is Node-safe (the CLI
 * imports it) and cannot reach the Svelte i18n store. Callers render it with
 * `t(key, params)`; hardcoding the labels here leaked Chinese onto every
 * en-US card.
 */
export function recurrenceLabel(
  recurrence: Recurrence | null
): { key: string; params: Record<string, string | number> } | null {
  if (!recurrence) return null;

  const days = weekdayList(recurrence.customPattern);
  if (days) {
    return {
      key: 'recurrence.weekdays',
      params: { days: days.map(d => WEEKDAY_NAMES[d]).join(',') }
    };
  }

  const selector = recurrence.customPattern?.match(/@(\d+|last)$/);
  if (selector) {
    return selector[1] === 'last'
      ? { key: 'recurrence.lastDayOfMonth', params: {} }
      : { key: 'recurrence.dayOfMonth', params: { day: parseInt(selector[1], 10) } };
  }

  // n === 1 gets its own keys so the common cases read naturally ("Daily",
  // "每周") instead of "Every 1 day".
  const bucket = recurrence.n === 1 ? 'every' : 'everyN';
  return { key: `recurrence.${bucket}.${recurrence.unit}`, params: { n: recurrence.n } };
}

// ---------------------------------------------------------------------------
// Batch processing
// ---------------------------------------------------------------------------

/**
 * Completed tasks whose recurrence can still produce a next occurrence.
 *
 * A strict recurrence needs a due date to count from; a loose one does not,
 * because it counts from the completion date — which every completed task has.
 */
export function getTasksNeedingRecurrence(tasks: Task[]): Task[] {
  return tasks.filter(task =>
    task.completed &&
    hasRecurrence(task) &&
    (!task.recurrence!.strict || !!task.dueDate)
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
 * Check if a task has an active recurrence.
 *
 * Now that `n` and `unit` are always present, a recurrence object simply is a
 * recurrence — the old shape could hold a null pattern with only a
 * `customPattern` set, and half the call sites keyed on the wrong one.
 */
export function hasRecurrence(task: Task): boolean {
  return !!task.recurrence;
}
