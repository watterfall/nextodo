import type { PriorityCounts, Task, Priority } from '$lib/types';
import { ACTIVE_PRIORITIES, PRIORITY_CONFIG, emptyPriorityCounts, isOpen } from '$lib/types';

// Pure quota logic — no i18n / Svelte / Tauri dependencies, so it is safe to
// import from a plain Node context (the FocusFlow CLI). The i18n-flavoured
// validateQuota() lives in quota.ts and re-exports everything here.
//
// A unit now holds at most 15 tasks: A×1 B×2 C×3 D×4 E×5. There is no unbounded
// tier any more — F (Idea Pool) is gone, because unsorted work lives in the
// todo.txt candidate pool instead. That has one consequence worth stating
// loudly: an add that has nowhere to go can no longer be absorbed, and is
// returned to the candidate pool instead. See docs/SLEEK-INTEROP.md §6.2.

/**
 * Count active (non-completed) tasks by priority
 */
export function countActiveByPriority(tasks: Task[]): PriorityCounts {
  const counts = emptyPriorityCounts();

  for (const task of tasks) {
    if (isOpen(task)) {
      counts[task.priority]++;
    }
  }

  return counts;
}

/**
 * Get remaining quota for each priority
 */
export function getRemainingQuota(tasks: Task[]): PriorityCounts {
  const counts = countActiveByPriority(tasks);
  const remaining = emptyPriorityCounts();

  for (const priority of ACTIVE_PRIORITIES) {
    remaining[priority] = Math.max(0, PRIORITY_CONFIG[priority].quota - counts[priority]);
  }

  return remaining;
}

/**
 * Check if adding a task of given priority is allowed
 */
export function canAddTask(tasks: Task[], priority: Priority): boolean {
  return getRemainingQuota(tasks)[priority] > 0;
}

// Tiers an unseated single-slot task can fall back to, best first.
const DEMOTION_LADDER: Priority[] = ['B', 'C', 'D', 'E'];

/**
 * Where an incumbent A should land when it is unseated, or null when every
 * lower tier is full.
 *
 * Null used to be impossible: the ladder ended at F, the unbounded Idea Pool,
 * so there was always somewhere to put the loser. With F gone, "nowhere" is a
 * real answer and callers must handle it by returning the task to the candidate
 * pool rather than quietly overfilling a tier.
 */
export function demotionTargetFor(tasks: Task[]): Priority | null {
  const remaining = getRemainingQuota(tasks);
  return DEMOTION_LADDER.find(p => remaining[p] > 0) ?? null;
}

/**
 * Tiers that hold exactly one task: adding a second unseats the incumbent
 * rather than being refused.
 *
 * Only A now. S was the other one, and it is gone — the week's single sustained
 * project is a `+project` tag (settings.focusProject), not a priority tier.
 */
export function isSingleSlotPriority(priority: Priority): boolean {
  return priority === 'A';
}

export interface HighlanderResult {
  /** The task list with incumbents demoted and evicted ones removed. */
  tasks: Task[];
  /** Incumbents that were pushed down a tier. */
  demoted: Array<{ task: Task; to: Priority }>;
  /**
   * Incumbents with nowhere left to go. They are removed from the unit and
   * belong back in the candidate pool; the caller must say so.
   */
  evicted: Task[];
}

/**
 * Apply the Highlander Rule: adding into a single-slot tier unseats the incumbent.
 *
 * The incumbent lands in the highest tier that still has room, not
 * unconditionally in B — a board already holding B×2 would otherwise end up at
 * B×3 against a quota of 2, which every quota reader then reports as full.
 * When no tier has room the incumbent is evicted rather than overfilling one.
 */
export function applyHighlanderRule(tasks: Task[], newTask: Task): HighlanderResult {
  if (!isSingleSlotPriority(newTask.priority)) {
    return { tasks, demoted: [], evicted: [] };
  }

  const remaining = getRemainingQuota(tasks);
  const demoted: HighlanderResult['demoted'] = [];
  const evicted: Task[] = [];

  const next: Task[] = [];
  for (const task of tasks) {
    const isIncumbent =
      task.id !== newTask.id && task.priority === newTask.priority && isOpen(task);

    if (!isIncumbent) {
      next.push(task);
      continue;
    }

    const target = DEMOTION_LADDER.find(p => remaining[p] > 0);
    if (!target) {
      evicted.push(task);
      continue;
    }

    remaining[target]--; // reserve the slot in case of multiple incumbents
    const moved = { ...task, priority: target };
    next.push(moved);
    demoted.push({ task: moved, to: target });
  }

  return { tasks: next, demoted, evicted };
}

/**
 * Get quota usage summary for display
 */
export function getQuotaSummary(tasks: Task[]): Array<{
  priority: Priority;
  name: string;
  used: number;
  quota: number;
  isFull: boolean;
}> {
  const counts = countActiveByPriority(tasks);

  return ACTIVE_PRIORITIES.map(priority => {
    const config = PRIORITY_CONFIG[priority];
    const used = counts[priority];

    return {
      priority,
      name: config.name,
      used,
      quota: config.quota,
      isFull: used >= config.quota
    };
  });
}

/**
 * Suggest a priority based on available quota, or null when the unit is full.
 *
 * Null is a real outcome now that there is no unbounded tier to fall back on:
 * 15 tasks is the whole unit, and the honest answer is "this does not fit".
 */
export function suggestPriority(tasks: Task[]): Priority | null {
  const remaining = getRemainingQuota(tasks);

  // Prefer lower priorities first (E, D, C, B, A)
  for (const priority of [...ACTIVE_PRIORITIES].reverse()) {
    if (remaining[priority] > 0) return priority;
  }

  return null;
}

/**
 * Check if task can be promoted to higher priority
 */
export function canPromote(tasks: Task[], task: Task): { canPromote: boolean; targetPriority: Priority | null } {
  const currentIndex = ACTIVE_PRIORITIES.indexOf(task.priority);

  if (currentIndex === 0) {
    return { canPromote: false, targetPriority: null };
  }

  const targetPriority = ACTIVE_PRIORITIES[currentIndex - 1];

  // Special case for promoting to A - Highlander rule will apply
  if (targetPriority === 'A') {
    return { canPromote: true, targetPriority: 'A' };
  }

  const remaining = getRemainingQuota(tasks);
  if (remaining[targetPriority] > 0) {
    return { canPromote: true, targetPriority };
  }

  return { canPromote: false, targetPriority: null };
}

/**
 * Check if task can be demoted to lower priority
 */
export function canDemote(task: Task): { canDemote: boolean; targetPriority: Priority | null } {
  const currentIndex = ACTIVE_PRIORITIES.indexOf(task.priority);

  if (currentIndex === ACTIVE_PRIORITIES.length - 1) {
    return { canDemote: false, targetPriority: null };
  }

  return { canDemote: true, targetPriority: ACTIVE_PRIORITIES[currentIndex + 1] };
}
