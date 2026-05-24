import type { ActivePriority, ActivePriorityCounts, Task, Priority } from '$lib/types';
import { ACTIVE_PRIORITIES, PRIORITY_CONFIG, isActivePriority, isFuturePriority, isSustainedPriority } from '$lib/types';

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
 * Validate quota before adding a task
 * Returns error message if not allowed, null if ok
 */
export function validateQuota(tasks: Task[], priority: Priority): string | null {
  // Future-progress (N) has no quota
  if (isFuturePriority(priority)) return null;

  // Sustained (S) is quota 1 — replaced via Highlander logic in store
  if (isSustainedPriority(priority)) {
    return canAddTask(tasks, priority) ? null : '本周已有一个持续推进项目（点击替换或先完成现有的）';
  }

  if (!isActivePriority(priority)) {
    return 'Cannot add directly to a hidden priority';
  }

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

/**
 * Validate pomodoro estimate against priority constraints
 * Returns null if valid, or a warning message if out of range
 */
export function validatePomodoroEstimate(priority: Priority, estimatedPomodoros: number): {
  isValid: boolean;
  warning: string | null;
  suggestion: string | null;
} {
  const config = PRIORITY_CONFIG[priority];
  const { min, max, recommended } = config.pomodoroRange;

  // F (Idea Pool), N (Future) and S (Sustained) have no pomodoro constraints
  if (priority === 'F' || priority === 'N' || priority === 'S') {
    return { isValid: true, warning: null, suggestion: null };
  }

  if (estimatedPomodoros < min) {
    return {
      isValid: false,
      warning: `番茄数过少 (${estimatedPomodoros} < ${min})`,
      suggestion: `${priority} 类任务建议 ${min}-${max} 个番茄，推荐 ${recommended} 个`
    };
  }

  if (estimatedPomodoros > max) {
    return {
      isValid: false,
      warning: `番茄数过多 (${estimatedPomodoros} > ${max})`,
      suggestion: `${priority} 类任务建议 ${min}-${max} 个番茄，考虑提高优先级或拆分任务`
    };
  }

  return { isValid: true, warning: null, suggestion: null };
}

/**
 * Get pomodoro estimate hint for a priority level
 */
export function getPomodoroHint(priority: Priority): string {
  const config = PRIORITY_CONFIG[priority];
  const { min, max, recommended } = config.pomodoroRange;

  if (priority === 'F' || priority === 'N' || priority === 'S') {
    return '无番茄限制';
  }

  if (min === 0 && max === 1) {
    return '建议 0-1 个番茄 (<15分钟)';
  }

  if (max === Infinity) {
    return `建议 ${min}+ 个番茄`;
  }

  return `建议 ${min}-${max} 个番茄 🍅`;
}
