import type { Task, Priority } from '$lib/types';
import { PRIORITY_CONFIG } from '$lib/types';

/**
 * Count active (non-completed) tasks by priority
 */
export function countActiveByPriority(tasks: Task[]): Record<Priority, number> {
  const counts: Record<Priority, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };

  for (const task of tasks) {
    if (!task.completed) {
      counts[task.priority]++;
    }
  }

  return counts;
}

/**
 * Get remaining quota for each priority
 */
export function getRemainingQuota(tasks: Task[]): Record<Priority, number> {
  const counts = countActiveByPriority(tasks);
  const remaining: Record<Priority, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };

  for (const priority of Object.keys(PRIORITY_CONFIG) as Priority[]) {
    const quota = PRIORITY_CONFIG[priority].quota;
    remaining[priority] = Math.max(0, quota - counts[priority]);
  }

  return remaining;
}

/**
 * Check if adding a task of given priority is allowed
 */
export function canAddTask(tasks: Task[], priority: Priority): boolean {
  // E category has unlimited quota
  if (priority === 'E') return true;

  const remaining = getRemainingQuota(tasks);
  return remaining[priority] > 0;
}

/**
 * Validate quota before adding a task
 * Returns error message if not allowed, null if ok
 */
export function validateQuota(tasks: Task[], priority: Priority): string | null {
  if (canAddTask(tasks, priority)) {
    return null;
  }

  const config = PRIORITY_CONFIG[priority];
  return `${config.name} (${priority}) 已达配额上限 ${config.quota} 个`;
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
  priority: Priority;
  name: string;
  used: number;
  quota: number;
  isFull: boolean;
}> {
  const counts = countActiveByPriority(tasks);

  return (['A', 'B', 'C', 'D', 'E'] as Priority[]).map(priority => {
    const config = PRIORITY_CONFIG[priority];
    const used = counts[priority];
    const quota = config.quota;

    return {
      priority,
      name: config.name,
      used,
      quota,
      isFull: priority !== 'E' && used >= quota
    };
  });
}

/**
 * Suggest priority based on available quota
 */
export function suggestPriority(tasks: Task[]): Priority {
  const remaining = getRemainingQuota(tasks);

  // Prefer lower priorities first (C, D, then B, A)
  if (remaining['D'] > 0) return 'D';
  if (remaining['C'] > 0) return 'C';
  if (remaining['B'] > 0) return 'B';
  if (remaining['A'] > 0) return 'A';

  return 'E';
}

/**
 * Check if task can be promoted to higher priority
 */
export function canPromote(tasks: Task[], task: Task): { canPromote: boolean; targetPriority: Priority | null } {
  const priorities: Priority[] = ['A', 'B', 'C', 'D', 'E'];
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
  const priorities: Priority[] = ['A', 'B', 'C', 'D', 'E'];
  const currentIndex = priorities.indexOf(task.priority);

  if (currentIndex === priorities.length - 1) {
    return { canDemote: false, targetPriority: null };
  }

  return { canDemote: true, targetPriority: priorities[currentIndex + 1] };
}
