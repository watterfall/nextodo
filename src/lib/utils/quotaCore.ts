import type { ActivePriority, ActivePriorityCounts, Task, Priority } from '$lib/types';
import { ACTIVE_PRIORITIES, PRIORITY_CONFIG, isActivePriority, isFuturePriority, isSustainedPriority } from '$lib/types';

// Pure quota logic — no i18n / Svelte / Tauri dependencies, so it is safe to
// import from a plain Node context (the FocusFlow CLI). The i18n-flavoured
// validateQuota() lives in quota.ts and re-exports everything here.

/**
 * Count active (non-completed) tasks by priority
 */
export function countActiveByPriority(tasks: Task[]): ActivePriorityCounts {
  const counts: ActivePriorityCounts = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 };

  for (const task of tasks) {
    if (!task.completed && isActivePriority(task.priority)) {
      counts[task.priority]++;
    }
  }

  return counts;
}

/**
 * Get remaining quota for each priority
 */
export function getRemainingQuota(tasks: Task[]): ActivePriorityCounts {
  const counts = countActiveByPriority(tasks);
  const remaining: ActivePriorityCounts = { A: 0, B: 0, C: 0, D: 0, E: 0, F: Infinity };

  for (const priority of ACTIVE_PRIORITIES) {
    const quota = PRIORITY_CONFIG[priority].quota;
    remaining[priority] = quota === Infinity ? Infinity : Math.max(0, quota - counts[priority]);
  }

  return remaining;
}

/**
 * Check if adding a task of given priority is allowed
 */
export function canAddTask(tasks: Task[], priority: Priority): boolean {
  // Future-progress (N) has no quota — always allowed
  if (isFuturePriority(priority)) return true;
  // Sustained (S) has quota of 1 — week-long single-project semantics
  if (isSustainedPriority(priority)) {
    const sCount = tasks.filter(t => !t.completed && t.priority === 'S').length;
    return sCount < 1;
  }
  if (!isActivePriority(priority)) return false;

  // F category (Idea Pool) has unlimited quota
  if (priority === 'F') return true;

  const remaining = getRemainingQuota(tasks);
  return remaining[priority] > 0;
}

/**
 * Apply Highlander Rule: when adding an A task, demote existing A to B
 * Returns modified tasks array
 */
export function applyHighlanderRule(tasks: Task[], newTask: Task): Task[] {
  if (newTask.priority !== 'A') {
    return tasks;
  }

  return tasks.map(task => {
    if (task.id !== newTask.id && task.priority === 'A' && !task.completed) {
      return { ...task, priority: 'B' as Priority };
    }
    return task;
  });
}

/**
 * Get quota usage summary for display
 */
export function getQuotaSummary(tasks: Task[]): Array<{
  priority: ActivePriority;
  name: string;
  used: number;
  quota: number;
  isFull: boolean;
}> {
  const counts = countActiveByPriority(tasks);

  return ACTIVE_PRIORITIES.map(priority => {
    const config = PRIORITY_CONFIG[priority];
    const used = counts[priority];
    const quota = config.quota;

    return {
      priority,
      name: config.name,
      used,
      quota,
      isFull: priority !== 'F' && quota !== Infinity && used >= quota
    };
  });
}

/**
 * Suggest priority based on available quota
 */
export function suggestPriority(tasks: Task[]): ActivePriority {
  const remaining = getRemainingQuota(tasks);

  // Prefer lower priorities first (E, D, C, B, A)
  if (remaining['E'] > 0) return 'E';
  if (remaining['D'] > 0) return 'D';
  if (remaining['C'] > 0) return 'C';
  if (remaining['B'] > 0) return 'B';
  if (remaining['A'] > 0) return 'A';

  // Default to idea pool
  return 'F';
}

/**
 * Check if task can be promoted to higher priority
 */
export function canPromote(tasks: Task[], task: Task): { canPromote: boolean; targetPriority: Priority | null } {
  if (!isActivePriority(task.priority)) {
    return { canPromote: false, targetPriority: null };
  }

  const priorities: ActivePriority[] = ACTIVE_PRIORITIES;
  const currentIndex = priorities.indexOf(task.priority);

  if (currentIndex === 0) {
    return { canPromote: false, targetPriority: null };
  }

  const targetPriority = priorities[currentIndex - 1];

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
  if (!isActivePriority(task.priority)) {
    return { canDemote: false, targetPriority: null };
  }

  const priorities: ActivePriority[] = ACTIVE_PRIORITIES;
  const currentIndex = priorities.indexOf(task.priority);

  if (currentIndex === priorities.length - 1) {
    return { canDemote: false, targetPriority: null };
  }

  return { canDemote: true, targetPriority: priorities[currentIndex + 1] };
}
