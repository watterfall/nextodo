import type { Task, RecurrencePattern } from '$lib/types';
import { formatDateISO, parseISODate } from './unitCalc';

/**
 * Calculate next due date based on recurrence pattern
 */
export function calculateNextDue(currentDue: string, pattern: RecurrencePattern): string | null {
  if (!pattern) return null;

  const date = parseISODate(currentDue);

  switch (pattern) {
    case '1d':
      date.setDate(date.getDate() + 1);
      break;
    case '2d':
      date.setDate(date.getDate() + 2);
      break;
    case '3d':
      date.setDate(date.getDate() + 3);
      break;
    case '1w':
      date.setDate(date.getDate() + 7);
      break;
    case '2w':
      date.setDate(date.getDate() + 14);
      break;
    case '1m':
      date.setMonth(date.getMonth() + 1);
      break;
    case '3m':
      date.setMonth(date.getMonth() + 3);
      break;
    default:
      return null;
  }

  return formatDateISO(date);
}

/**
 * Create next occurrence of a recurring task when completed
 */
export function createNextOccurrence(task: Task): Task | null {
  if (!task.recurrence?.pattern || !task.dueDate) {
    return null;
  }

  const nextDue = calculateNextDue(task.dueDate, task.recurrence.pattern);
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
      ...task.recurrence,
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
 * Format recurrence pattern for display
 */
export function formatRecurrence(pattern: RecurrencePattern): string {
  if (!pattern) return '';

  const labels: Record<string, string> = {
    '1d': '每日',
    '2d': '每2天',
    '3d': '每3天',
    '1w': '每周',
    '2w': '每两周',
    '1m': '每月',
    '3m': '每季度'
  };

  return labels[pattern] || pattern;
}

/**
 * Get tasks that need recurrence processing
 */
export function getTasksNeedingRecurrence(tasks: Task[]): Task[] {
  return tasks.filter(task =>
    task.completed &&
    task.recurrence?.pattern &&
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
      // Check if next occurrence already exists
      const exists = tasks.some(t =>
        t.content === nextTask.content &&
        t.dueDate === nextTask.dueDate &&
        !t.completed
      );

      if (!exists) {
        newTasks.push(nextTask);
      }
    }
  }

  return newTasks;
}

/**
 * Check if task has active recurrence
 */
export function hasRecurrence(task: Task): boolean {
  return !!task.recurrence?.pattern;
}
