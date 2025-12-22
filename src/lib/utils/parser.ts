import type { Task, Priority, Recurrence, RecurrencePattern } from '$lib/types';
import { createEmptyTask } from '$lib/types';

interface ParsedTask {
  content: string;
  priority: Priority;
  projects: string[];
  contexts: string[];
  customTags: string[];
  dueDate: string | null;
  thresholdDate: string | null;
  estimatedPomodoros: number;
  recurrence: Recurrence | null;
}

/**
 * Parse task input string with syntax support:
 * - +project for projects
 * - @context for contexts
 * - #tag for custom tags
 * - !A !B !C !D !E for priority
 * - ~2024-12-01 or ~tomorrow or ~today for due date
 * - thr:2024-12-01 or thr:+3d for threshold date
 * - rec:1d rec:1w rec:mon,wed,fri rec:1m@15 for recurrence
 * - 🍅3 or p3 for estimated pomodoros
 */
export function parseTaskInput(input: string): ParsedTask {
  let content = input.trim();
  let priority: Priority = 'F';
  const projects: string[] = [];
  const contexts: string[] = [];
  const customTags: string[] = [];
  let dueDate: string | null = null;
  let thresholdDate: string | null = null;
  let estimatedPomodoros = 0;
  let recurrence: Recurrence | null = null;

  // Extract priority (!A, !B, etc.)
  const priorityMatch = content.match(/!([ABCDEF])\b/i);
  if (priorityMatch) {
    priority = priorityMatch[1].toUpperCase() as Priority;
    content = content.replace(/!([ABCDEF])\b/i, '').trim();
  }

  // Extract projects (+project)
  const projectMatches = content.matchAll(/\+(\S+)/g);
  for (const match of projectMatches) {
    projects.push(match[1]);
  }
  content = content.replace(/\+\S+/g, '').trim();

  // Extract contexts (@context)
  const contextMatches = content.matchAll(/@(\S+)/g);
  for (const match of contextMatches) {
    contexts.push(match[1]);
  }
  content = content.replace(/@\S+/g, '').trim();

  // Extract custom tags (#tag or emoji tags)
  const tagMatches = content.matchAll(/#(\S+)/g);
  for (const match of tagMatches) {
    customTags.push(match[1]);
  }
  content = content.replace(/#\S+/g, '').trim();

  // Extract pomodoros (🍅3 or p3) - MUST happen BEFORE emoji tags to prevent 🍅3 from being captured as a tag
  const pomodoroMatch = content.match(/(?:🍅|p)(\d+)/);
  if (pomodoroMatch) {
    estimatedPomodoros = parseInt(pomodoroMatch[1], 10);
    content = content.replace(/(?:🍅|p)\d+/g, '').trim();
  }

  // Extract emoji tags (⚡高能量, 💻编码, etc.)
  const emojiTagMatches = content.matchAll(/([\u{1F300}-\u{1F9FF}][\u4e00-\u9fa5\w]+)/gu);
  for (const match of emojiTagMatches) {
    customTags.push(match[1]);
  }
  content = content.replace(/([\u{1F300}-\u{1F9FF}][\u4e00-\u9fa5\w]+)/gu, '').trim();

  // Extract threshold date (thr:date)
  const thresholdMatch = content.match(/thr:(\S+)/i);
  if (thresholdMatch) {
    thresholdDate = parseDateString(thresholdMatch[1]);
    content = content.replace(/thr:\S+/gi, '').trim();
  }

  // Extract recurrence pattern (rec:pattern)
  const recurrenceMatch = content.match(/rec:(\S+)/i);
  if (recurrenceMatch) {
    recurrence = parseRecurrence(recurrenceMatch[1]);
    content = content.replace(/rec:\S+/gi, '').trim();
  }

  // Extract due date (~date)
  const dueDateMatch = content.match(/~(\S+)/);
  if (dueDateMatch) {
    dueDate = parseDateString(dueDateMatch[1]);
    content = content.replace(/~\S+/g, '').trim();
  }

  // Clean up extra spaces
  content = content.replace(/\s+/g, ' ').trim();

  return {
    content,
    priority,
    projects,
    contexts,
    customTags,
    dueDate,
    thresholdDate,
    estimatedPomodoros,
    recurrence
  };
}

/**
 * Parse relative or absolute date string
 */
function parseDateString(dateStr: string): string | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lowerStr = dateStr.toLowerCase();

  if (lowerStr === 'today' || lowerStr === '今天') {
    return formatDate(today);
  }

  if (lowerStr === 'tomorrow' || lowerStr === '明天') {
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    return formatDate(tomorrow);
  }

  if (lowerStr === '后天') {
    const dayAfter = new Date(today);
    dayAfter.setDate(today.getDate() + 2);
    return formatDate(dayAfter);
  }

  // Match relative days (+3d)
  const relativeDayMatch = lowerStr.match(/^\+?(\d+)d$/);
  if (relativeDayMatch) {
    const days = parseInt(relativeDayMatch[1], 10);
    const future = new Date(today);
    future.setDate(today.getDate() + days);
    return formatDate(future);
  }

  // Match relative weeks (+2w)
  const relativeWeekMatch = lowerStr.match(/^\+?(\d+)w$/);
  if (relativeWeekMatch) {
    const weeks = parseInt(relativeWeekMatch[1], 10);
    const future = new Date(today);
    future.setDate(today.getDate() + weeks * 7);
    return formatDate(future);
  }

  // Match relative months (+1m)
  const relativeMonthMatch = lowerStr.match(/^\+?(\d+)m$/);
  if (relativeMonthMatch) {
    const months = parseInt(relativeMonthMatch[1], 10);
    const future = new Date(today);
    future.setMonth(today.getMonth() + months);
    return formatDate(future);
  }

  // Try to parse as ISO date
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }

  // Try to parse as MM-DD or MM/DD
  const shortMatch = dateStr.match(/^(\d{1,2})[-/](\d{1,2})$/);
  if (shortMatch) {
    const month = parseInt(shortMatch[1], 10) - 1;
    const day = parseInt(shortMatch[2], 10);
    const year = today.getFullYear();
    const date = new Date(year, month, day);

    // If date is in the past, assume next year
    if (date < today) {
      date.setFullYear(year + 1);
    }

    return formatDate(date);
  }

  return null;
}

/**
 * Parse recurrence pattern
 */
function parseRecurrence(patternStr: string): Recurrence | null {
  const lowerStr = patternStr.toLowerCase();

  // Standard patterns
  const standardPatterns: Record<string, RecurrencePattern> = {
    '1d': '1d', 'daily': '1d', '每天': '1d',
    '2d': '2d', '隔天': '2d',
    '3d': '3d',
    '1w': '1w', 'weekly': '1w', '每周': '1w',
    '2w': '2w', 'biweekly': '2w', '隔周': '2w',
    '1m': '1m', 'monthly': '1m', '每月': '1m',
    '3m': '3m', 'quarterly': '3m', '每季': '3m'
  };

  if (standardPatterns[lowerStr]) {
    return {
      pattern: standardPatterns[lowerStr],
      nextDue: null
    };
  }

  // Custom patterns like mon,wed,fri or 1m@15 or 3m@last
  const weekdayMatch = lowerStr.match(/^(mon|tue|wed|thu|fri|sat|sun)(,(mon|tue|wed|thu|fri|sat|sun))*$/);
  if (weekdayMatch) {
    return {
      pattern: null,
      customPattern: lowerStr,
      nextDue: null
    };
  }

  // Monthly on specific day: 1m@15 (15th of each month)
  const monthlyDayMatch = lowerStr.match(/^(\d+)m@(\d+|last)$/);
  if (monthlyDayMatch) {
    return {
      pattern: monthlyDayMatch[1] === '1' ? '1m' : '3m',
      customPattern: lowerStr,
      nextDue: null
    };
  }

  return null;
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Create a new task from parsed input
 */
export function createTaskFromInput(input: string): Task {
  const parsed = parseTaskInput(input);
  const task = createEmptyTask(parsed.priority);

  task.content = parsed.content;
  task.projects = parsed.projects;
  task.contexts = parsed.contexts;
  task.customTags = parsed.customTags;
  task.dueDate = parsed.dueDate;
  task.thresholdDate = parsed.thresholdDate;
  task.pomodoros.estimated = parsed.estimatedPomodoros;
  task.recurrence = parsed.recurrence;

  return task;
}

/**
 * Format task as display string with metadata
 */
export function formatTaskDisplay(task: Task): string {
  let display = task.content;

  if (task.projects.length > 0) {
    display += ' ' + task.projects.map(p => '+' + p).join(' ');
  }

  if (task.contexts.length > 0) {
    display += ' ' + task.contexts.map(c => '@' + c).join(' ');
  }

  if (task.customTags.length > 0) {
    display += ' ' + task.customTags.map(t => '#' + t).join(' ');
  }

  return display;
}

/**
 * Highlight syntax in input string
 */
export function highlightSyntax(input: string): string {
  let html = escapeHtml(input);

  // Highlight priority
  html = html.replace(/!([ABCDEF])\b/gi, '<span class="syntax-priority">!$1</span>');

  // Highlight projects
  html = html.replace(/(\+\S+)/g, '<span class="syntax-project">$1</span>');

  // Highlight contexts
  html = html.replace(/(@\S+)/g, '<span class="syntax-context">$1</span>');

  // Highlight tags
  html = html.replace(/(#\S+)/g, '<span class="syntax-tag">$1</span>');

  // Highlight threshold date
  html = html.replace(/(thr:\S+)/gi, '<span class="syntax-threshold">$1</span>');

  // Highlight recurrence
  html = html.replace(/(rec:\S+)/gi, '<span class="syntax-recurrence">$1</span>');

  // Highlight due date
  html = html.replace(/(~\S+)/g, '<span class="syntax-due">$1</span>');

  // Highlight pomodoros
  html = html.replace(/((?:🍅|p)\d+)/g, '<span class="syntax-pomodoro">$1</span>');

  return html;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Calculate next due date based on recurrence pattern
 */
export function calculateNextDue(recurrence: Recurrence, fromDate?: Date): string | null {
  if (!recurrence) return null;

  const base = fromDate || new Date();
  base.setHours(0, 0, 0, 0);

  // Handle custom weekday patterns
  if (recurrence.customPattern && !recurrence.pattern) {
    const weekdays = recurrence.customPattern.split(',');
    const weekdayMap: Record<string, number> = {
      'sun': 0, 'mon': 1, 'tue': 2, 'wed': 3, 'thu': 4, 'fri': 5, 'sat': 6
    };

    const targetDays = weekdays.map(d => weekdayMap[d]).sort((a, b) => a - b);
    const currentDay = base.getDay();

    // Find next matching day
    let nextDay = targetDays.find(d => d > currentDay);
    if (nextDay === undefined) {
      // Wrap to next week
      nextDay = targetDays[0];
      base.setDate(base.getDate() + (7 - currentDay + nextDay));
    } else {
      base.setDate(base.getDate() + (nextDay - currentDay));
    }

    return formatDate(base);
  }

  // Handle standard patterns
  switch (recurrence.pattern) {
    case '1d':
      base.setDate(base.getDate() + 1);
      break;
    case '2d':
      base.setDate(base.getDate() + 2);
      break;
    case '3d':
      base.setDate(base.getDate() + 3);
      break;
    case '1w':
      base.setDate(base.getDate() + 7);
      break;
    case '2w':
      base.setDate(base.getDate() + 14);
      break;
    case '1m':
      base.setMonth(base.getMonth() + 1);
      // Handle monthly with specific day
      if (recurrence.customPattern) {
        const dayMatch = recurrence.customPattern.match(/@(\d+|last)$/);
        if (dayMatch) {
          if (dayMatch[1] === 'last') {
            // Last day of month
            base.setMonth(base.getMonth() + 1, 0);
          } else {
            base.setDate(parseInt(dayMatch[1], 10));
          }
        }
      }
      break;
    case '3m':
      base.setMonth(base.getMonth() + 3);
      // Handle quarterly with specific day
      if (recurrence.customPattern) {
        const dayMatch = recurrence.customPattern.match(/@(\d+|last)$/);
        if (dayMatch) {
          if (dayMatch[1] === 'last') {
            base.setMonth(base.getMonth() + 1, 0);
          } else {
            base.setDate(parseInt(dayMatch[1], 10));
          }
        }
      }
      break;
    default:
      return null;
  }

  return formatDate(base);
}
