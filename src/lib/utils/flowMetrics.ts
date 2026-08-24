/**
 * Flow metrics — measures of movement, not of accumulation.
 *
 * Every number here answers "how is work flowing?" rather than "how much have
 * you done?". That distinction is the whole point: a cumulative counter can be
 * driven up by splitting tasks or by picking easy ones, so it stops measuring
 * the thing it was meant to measure as soon as anybody looks at it. Age,
 * cycle time and in-progress count cannot be gamed that way — the only way to
 * improve them is to actually finish things.
 *
 * Node-safe on purpose: no Svelte, no Tauri, no i18n. The CLI imports this, and
 * so do the tests.
 *
 * Two rules hold everywhere in this file:
 *
 * 1. **Dates are local calendar days.** Never `toISOString()`; a task created
 *    at 23:00 and looked at the next morning is one day old, not zero.
 * 2. **Too little data returns null, never a number.** A median over three
 *    samples is noise wearing a decimal point, and showing it would invite
 *    exactly the false confidence this module exists to avoid.
 */

import type { Task, ActivePriority } from '$lib/types';

/** Below this many samples, the medians refuse to answer. */
export const MIN_SAMPLE = 5;

/** How many recent completions the medians look back over by default. */
export const DEFAULT_WINDOW = 20;

export interface AgeDistribution {
  /** How many unfinished tasks were measured. */
  count: number;
  /** Median age in days, or null when there is nothing to measure. */
  p50: number | null;
  /** 90th percentile age in days — the tail is where avoidance hides. */
  p90: number | null;
  /** The single oldest unfinished task, which is the one worth acting on. */
  oldest: { task: Task; days: number } | null;
}

export interface Sampled {
  /** The measured value. */
  value: number;
  /** How many tasks it was computed from — always shown next to the value. */
  sampleSize: number;
}

/** Local midnight of the day `d` falls on. */
function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Whole calendar days between an ISO timestamp and `now`.
 *
 * Rounding after zeroing both ends to local midnight is what makes this
 * DST-proof: the 23- and 25-hour days round to 1, not to 0.96 and 1.04.
 */
export function ageInDays(iso: string, now: Date = new Date()): number {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return 0;
  const diff = startOfLocalDay(now).getTime() - startOfLocalDay(then).getTime();
  return Math.max(0, Math.round(diff / 86_400_000));
}

/** Nearest-rank percentile over an ascending array. `p` is 0–1. */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const rank = Math.ceil(p * sorted.length);
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank - 1))];
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** A task still owed: not finished, not cancelled. */
function isUnfinished(task: Task): boolean {
  return !task.completed && task.priority !== 'G' && task.priority !== 'H';
}

/**
 * A finished task, and the tier it was finished at.
 *
 * Completion rewrites `priority` to 'G', so anything that wants to know what
 * kind of task it was has to read `originalPriority`. Cancelled ('H') tasks are
 * deliberately excluded — cancelling is a legitimate outcome, but it is not a
 * delivery, and counting it as one would make the cycle time look better the
 * more work you abandon.
 */
function finishedTier(task: Task): ActivePriority | null {
  const done = task.completed || task.priority === 'G';
  if (!done) return null;
  const tier = task.originalPriority ?? task.priority;
  return tier === 'G' || tier === 'H' ? null : tier;
}

/**
 * Age distribution of everything still owed.
 *
 * `createdAt` is the clock. For a task pulled out of a todo.txt this is the
 * line's own creation date when it has one, so pulling does not reset the
 * clock — which matters, because a line that has sat in the file for seven
 * weeks is exactly what this metric exists to surface. When the line carries no
 * creation date the age starts at the pull, making the number a lower bound.
 * That is the safe direction to be wrong in: it under-reports debt rather than
 * inventing it.
 */
export function ageDistribution(tasks: Task[], now: Date = new Date()): AgeDistribution {
  const open = tasks.filter(isUnfinished);
  if (open.length === 0) {
    return { count: 0, p50: null, p90: null, oldest: null };
  }

  const aged = open.map((task) => ({ task, days: ageInDays(task.createdAt, now) }));
  const days = aged.map((a) => a.days).sort((a, b) => a - b);
  const oldest = aged.reduce((a, b) => (b.days > a.days ? b : a));

  return {
    count: open.length,
    p50: percentile(days, 0.5),
    p90: percentile(days, 0.9),
    oldest
  };
}

/**
 * Median days from creation to completion, over the most recent completions.
 *
 * This is the one number that says whether work is moving. It has no target
 * value and must never be given one — the moment it becomes a goal, the way to
 * hit it is to only start things that are nearly finished already.
 */
export function cycleTimeMedian(
  tasks: Task[],
  window: number = DEFAULT_WINDOW
): Sampled | null {
  const done = tasks
    .filter((t) => finishedTier(t) !== null && t.completedAt)
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
    .slice(0, window);

  if (done.length < MIN_SAMPLE) return null;

  const spans = done.map((t) => ageInDays(t.createdAt, new Date(t.completedAt as string)));
  return { value: median(spans), sampleSize: spans.length };
}

/**
 * How far off your pomodoro estimates run — the automated form of
 * reference-class forecasting.
 *
 * 1.0 means calibrated; 1.8 means the things you finish take almost twice the
 * effort you predicted. Asking "how long will this take?" is the question
 * people are reliably bad at; "how long did things like this actually take?"
 * is the one that has an answer, and this computes it from data already on
 * every task.
 *
 * Only tasks with both a non-zero estimate and non-zero recorded effort count.
 * A task with zero completed pomodoros means the timer was never started, not
 * that the work took no time, and folding those in would drag the factor toward
 * zero and tell the user they over-estimate everything.
 */
export function estimationFactor(
  tasks: Task[],
  opts: { priority?: ActivePriority; window?: number } = {}
): Sampled | null {
  const window = opts.window ?? DEFAULT_WINDOW;

  const usable = tasks
    .filter((t) => {
      const tier = finishedTier(t);
      if (!tier) return false;
      if (opts.priority && tier !== opts.priority) return false;
      return t.pomodoros.estimated > 0 && t.pomodoros.completed > 0;
    })
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
    .slice(0, window);

  if (usable.length < MIN_SAMPLE) return null;

  const ratios = usable.map((t) => t.pomodoros.completed / t.pomodoros.estimated);
  return { value: median(ratios), sampleSize: ratios.length };
}

/**
 * Work in progress: how much is currently promised.
 *
 * The quota system already caps this at 15. Showing the number turns the cap
 * from a rule the app enforces into a load the user can see, which is the only
 * honest thing a tool can offer at the structural level — it cannot make the
 * queue shorter, it can make it visible enough to argue with.
 */
export function commitmentCount(tasks: Task[]): number {
  return tasks.filter(isUnfinished).length;
}

/**
 * How many more completions are needed before a median can be reported.
 * Drives the empty state, so it can say "4 more" instead of showing a fake 0.
 */
export function samplesUntilReady(tasks: Task[]): number {
  const done = tasks.filter((t) => finishedTier(t) !== null && t.completedAt).length;
  return Math.max(0, MIN_SAMPLE - done);
}
