import type { AppData, Task, Priority } from '$lib/types';
import { PRIORITY_CONFIG, isActivePriority } from '$lib/types';
import { getUnitForDate, parseISODate } from './unitCalc';

// A 2-day period whose priority-weighted completion falls below this ratio is
// considered under-completed: the next period continues it (merged window) and
// the unfinished A-E tasks roll forward into the new window.
const MERGE_THRESHOLD = 0.30;

// Importance weight per active priority: A is heaviest, E lightest.
// Derived from the quota (A=1 … E=5), so weight = 6 - quota → A=5 … E=1.
function priorityWeight(p: Priority): number {
  const quota = PRIORITY_CONFIG[p]?.quota;
  if (!quota || !isFinite(quota)) return 1;
  return 6 - quota;
}

// Effective A-E priority for cycle accounting. Completed tasks (G) keep the
// priority they had before completion; open tasks use their current priority.
// Returns null for anything that isn't an A-E task.
function effectiveActivePriority(task: Task): Priority | null {
  const p = task.priority === 'G' ? task.originalPriority : task.priority;
  return p && isActivePriority(p) ? p : null;
}

// Local YYYY-MM-DD (avoids the UTC day-shift that toISOString can introduce).
function localISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Stable key identifying the 2-day period a date belongs to (its unit start).
function periodKeyOfDate(d: Date): string {
  return localISO(getUnitForDate(d).startDate);
}

function taskPeriodKey(task: Task): string {
  return periodKeyOfDate(parseISODate(task.unitStart));
}

// Priority-weighted completion of one 2-day period, identified by its key.
// Counts A-E tasks (open A-E + completed-from-A-E) belonging to that period;
// cancelled (H) tasks are excluded. Returns null when nothing was planned.
export function weightedCompletionForPeriod(tasks: Task[], periodKey: string): number | null {
  let total = 0;
  let done = 0;
  for (const task of tasks) {
    if (task.priority === 'H') continue;
    const p = effectiveActivePriority(task);
    if (!p) continue;
    if (taskPeriodKey(task) !== periodKey) continue;
    const w = priorityWeight(p);
    total += w;
    if (task.priority === 'G' && task.completed) done += w;
  }
  if (total === 0) return null;
  return done / total;
}

export interface CycleEvaluation {
  changed: boolean;
  merged: boolean;
}

/**
 * Evaluate the dynamic 2-day cycle at startup and advance/merge as needed.
 *
 * The active work window normally equals the calendar unit. When a new work
 * period begins, the period that just ended is scored (priority-weighted A-E
 * completion). If it scored below MERGE_THRESHOLD, the new period is flagged as
 * a continued ("merged") window and that period's unfinished A-E tasks roll
 * forward into it. Saturday (review day) never participates — the engine is a
 * no-op on Saturdays, so Saturday stays empty.
 *
 * Mutates `appData.tasks` and `appData.cycleState` in place. Idempotent within a
 * period (guarded by `lastEvaluatedStart`), so it won't re-fire each launch.
 */
export function evaluateCycle(appData: AppData, now: Date = new Date()): CycleEvaluation {
  const cal = getUnitForDate(now);

  // Saturday / review day: leave the work window untouched, never merge into it.
  if (cal.isReviewDay) return { changed: false, merged: false };

  const calStart = localISO(cal.startDate);
  const calEnd = localISO(cal.endDate);

  // First run — seed state to the current calendar unit; nothing to evaluate yet.
  if (!appData.cycleState) {
    appData.cycleState = {
      anchorStart: calStart,
      windowEnd: calEnd,
      merged: false,
      lastEvaluatedStart: ''
    };
    return { changed: true, merged: false };
  }

  const state = appData.cycleState;

  // Still inside the same window — nothing to do.
  if (state.anchorStart === calStart) return { changed: false, merged: false };

  // A new work period has begun. Score the period that just ended (once).
  let merged = false;
  let pendingReview: { periodStart: string; completion: number } | null = null;

  if (state.lastEvaluatedStart !== state.anchorStart) {
    const completion = weightedCompletionForPeriod(appData.tasks, state.anchorStart);
    const low = completion !== null && completion < MERGE_THRESHOLD;

    // Record the scored period for the completion history (keep last 60).
    const history = appData.cycleHistory ?? [];
    appData.cycleHistory = [
      ...history.filter(h => h.periodStart !== state.anchorStart),
      { periodStart: state.anchorStart, completion, merged: low }
    ].slice(-60);

    if (low) {
      if (appData.settings?.lowCompletionPrompt === false) {
        // Auto-merge: immediately roll the period's unfinished A-E tasks forward.
        appData.tasks = rollUnfinishedIntoWindow(appData.tasks, state.anchorStart, calStart, calEnd);
        merged = true;
      } else {
        // Prompt mode: defer the merge until the user resolves the micro-review banner.
        pendingReview = { periodStart: state.anchorStart, completion: completion as number };
      }
    }
  }

  appData.cycleState = {
    anchorStart: calStart,
    windowEnd: calEnd,
    merged,
    lastEvaluatedStart: state.anchorStart,
    pendingReview
  };
  return { changed: true, merged };
}

// Move a period's unfinished A-E tasks into the given window. Used by the
// auto-merge path and by the manual "roll over" action of the micro-review banner.
export function rollUnfinishedIntoWindow(
  tasks: Task[],
  periodStart: string,
  windowStart: string,
  windowEnd: string
): Task[] {
  return tasks.map(task => {
    if (isActivePriority(task.priority) && !task.completed && taskPeriodKey(task) === periodStart) {
      return {
        ...task,
        unitStart: windowStart,
        unitOverride: { ...(task.unitOverride ?? {}), extendedUntil: windowEnd }
      };
    }
    return task;
  });
}
