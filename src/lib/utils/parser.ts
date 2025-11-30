import type { Task, Priority } from '$lib/types';
import { createEmptyTask } from '$lib/types';

interface ParsedTask {
  content: string;
  priority: Priority;
  projects: string[];
  contexts: string[];
  customTags: string[];
  dueDate: string | null;
  estimatedPomodoros: number;
}

/**
 * Parse task input string with syntax support:
 * - +project for projects
 * - @context for contexts
 * - #tag for custom tags
 * - !A !B !C !D !E for priority
 * - ~2024-12-01 or ~tomorrow or ~today for due date
 * - 🍅3 or p3 for estimated pomodoros
 */
export function parseTaskInput(input: string): ParsedTask {
  let content = input.trim();
  let priority: Priority = 'E';
  const projects: string[] = [];
  const contexts: string[] = [];
  const customTags: string[] = [];
  let dueDate: string | null = null;
  let estimatedPomodoros = 0;

  // Extract priority (!A, !B, etc.)
  const priorityMatch = content.match(/!([ABCDE])\b/i);
  if (priorityMatch) {
    priority = priorityMatch[1].toUpperCase() as Priority;
    content = content.replace(/!([ABCDE])\b/i, '').trim();
  }

  // Extract projects (+project)
  const projectMatches = content.matchAll(/\+(\S+)/g);
  for (const match of projectMatches) {
    projects.push('+' + match[1]);
  }
  content = content.replace(/\+\S+/g, '').trim();

  // Extract contexts (@context)
  const contextMatches = content.matchAll(/@(\S+)/g);
  for (const match of contextMatches) {
    contexts.push('@' + match[1]);
  }
  content = content.replace(/@\S+/g, '').trim();

  // Extract custom tags (#tag or emoji tags)
  const tagMatches = content.matchAll(/#(\S+)/g);
  for (const match of tagMatches) {
    customTags.push('#' + match[1]);
  }
  content = content.replace(/#\S+/g, '').trim();

  // Extract emoji tags (⚡高能量, 💻编码, etc.)
  const emojiTagMatches = content.matchAll(/([\u{1F300}-\u{1F9FF}][\u4e00-\u9fa5\w]+)/gu);
  for (const match of emojiTagMatches) {
    customTags.push(match[1]);
  }
  content = content.replace(/([\u{1F300}-\u{1F9FF}][\u4e00-\u9fa5\w]+)/gu, '').trim();

  // Extract due date (~date)
  const dueDateMatch = content.match(/~(\S+)/);
  if (dueDateMatch) {
    dueDate = parseDueDate(dueDateMatch[1]);
    content = content.replace(/~\S+/g, '').trim();
  }

  // Extract pomodoros (🍅3 or p3)
  const pomodoroMatch = content.match(/(?:🍅|p)(\d+)/);
  if (pomodoroMatch) {
    estimatedPomodoros = parseInt(pomodoroMatch[1], 10);
    content = content.replace(/(?:🍅|p)\d+/g, '').trim();
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
    estimatedPomodoros
  };
}

/**
 * Parse relative or absolute due date
 */
function parseDueDate(dateStr: string): string | null {
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

  // Match relative days (+3d, +1w, etc.)
  const relativeDayMatch = lowerStr.match(/^\+?(\d+)d$/);
  if (relativeDayMatch) {
    const days = parseInt(relativeDayMatch[1], 10);
    const future = new Date(today);
    future.setDate(today.getDate() + days);
    return formatDate(future);
  }

  const relativeWeekMatch = lowerStr.match(/^\+?(\d+)w$/);
  if (relativeWeekMatch) {
    const weeks = parseInt(relativeWeekMatch[1], 10);
    const future = new Date(today);
    future.setDate(today.getDate() + weeks * 7);
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
  task.pomodoros.estimated = parsed.estimatedPomodoros;

  return task;
}

/**
 * Format task as display string with metadata
 */
export function formatTaskDisplay(task: Task): string {
  let display = task.content;

  if (task.projects.length > 0) {
    display += ' ' + task.projects.join(' ');
  }

  if (task.contexts.length > 0) {
    display += ' ' + task.contexts.join(' ');
  }

  if (task.customTags.length > 0) {
    display += ' ' + task.customTags.join(' ');
  }

  return display;
}

/**
 * Highlight syntax in input string
 */
export function highlightSyntax(input: string): string {
  let html = escapeHtml(input);

  // Highlight priority
  html = html.replace(/!([ABCDE])\b/gi, '<span class="syntax-priority">!$1</span>');

  // Highlight projects
  html = html.replace(/(\+\S+)/g, '<span class="syntax-project">$1</span>');

  // Highlight contexts
  html = html.replace(/(@\S+)/g, '<span class="syntax-context">$1</span>');

  // Highlight tags
  html = html.replace(/(#\S+)/g, '<span class="syntax-tag">$1</span>');

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
