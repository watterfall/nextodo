/** Descriptive commitment metrics, not performance targets or causal diagnoses.
 * The five-sample threshold controls display only; it does not establish reliability.
 * Local calendar days are used throughout. Legacy counts are not elapsed minutes.
 */
import type { Task, Priority } from '$lib/types';
import { isOpen } from '$lib/types';

/** Below this many samples, the medians refuse to answer. */
export const MIN_SAMPLE = 5;

/** How many recent completions the medians look back over by default. */
export const DEFAULT_WINDOW = 20;

export interface AgeDistribution {
  /** How many unfinished tasks were measured. */
  count: number;
  /** Median age in days, or null when there is nothing to measure. */
  p50: number | null;
  /** 90th percentile commitment age in days; not a diagnosis of avoidance. */
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

/**
 * A delivered task, and the tier it was delivered at.
 *
 * Cancelled tasks return null on purpose — cancelling is a legitimate outcome,
 * but it is not a delivery, and counting it as one would make the cycle time
 * look better the more work you abandon.
 */
function deliveredTier(task: Task): Priority | null {
  return task.status === 'completed' ? task.priority : null;
}

/** Old records retain their dates: source acceptance when known, otherwise creation. */
export function commitmentDate(task: Task): string {
  return task.committedAt ?? task.source?.pulledAt ?? task.createdAt;
}

/** Age since acceptance, not time spent waiting in the candidate pool. */
export function ageDistribution(tasks: Task[], now: Date = new Date()): AgeDistribution {
  const open = tasks.filter(isOpen);
  if (open.length === 0) {
    return { count: 0, p50: null, p90: null, oldest: null };
  }

  const aged = open.map((task) => ({ task, days: ageInDays(commitmentDate(task), now) }));
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
 * Median days from commitment to completion, over the most recent completions.
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
    .filter((t) => deliveredTier(t) !== null && t.completedAt)
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
    .slice(0, window);

  if (done.length < MIN_SAMPLE) return null;

  const spans = done.map((t) => ageInDays(commitmentDate(t), new Date(t.completedAt as string)));
  return { value: median(spans), sampleSize: spans.length };
}

/** Median completed/estimated block counts. Block lengths vary, so this is
 * not a time or effort calibration factor. Zero-count records are excluded.
 */
export function estimationFactor(
  tasks: Task[],
  opts: { priority?: Priority; window?: number } = {}
): Sampled | null {
  const window = opts.window ?? DEFAULT_WINDOW;

  const usable = tasks
    .filter((t) => {
      const tier = deliveredTier(t);
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
  return tasks.filter(isOpen).length;
}

/**
 * How many more completions are needed before a median can be reported.
 * Drives the empty state, so it can say "4 more" instead of showing a fake 0.
 */
export function samplesUntilReady(tasks: Task[]): number {
  const done = tasks.filter((t) => deliveredTier(t) !== null && t.completedAt).length;
  return Math.max(0, MIN_SAMPLE - done);
}
