import type { Task, Priority, Recurrence } from '$lib/types';
import { createEmptyTask, DEFAULT_PRIORITY } from '$lib/types';
import { parseRecurrence } from './recurrence';

// The recurrence engine lives in ./recurrence — re-exported here so existing
// `from './parser'` importers keep working against one implementation. The
// `rec:` operand is parsed there too: this file used to carry a second, subtly
// different table of patterns, which is exactly the drift the consolidation
// was meant to end.
export { calculateNextDue, parseRecurrence } from './recurrence';

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
  trigger: string | null;
}

/**
 * Parse task input string with syntax support:
 * - +project for projects
 * - @context for contexts
 * - #tag for custom tags
 * - !A .. !E for priority (or 【A】…【E】 with Chinese full-width brackets)
 * - ~2024-12-01 or ~tomorrow or ~today for due date
 * - thr:2024-12-01 or thr:+3d for threshold date
 * - rec:1d rec:1w rec:mon,wed,fri rec:1m@15 for recurrence
 * - 🍅3 or p3 for estimated pomodoros
 * - when:<situational cue> for an if-then start trigger (takes the rest of the
 *   line, so it has to come last)
 */
export function parseTaskInput(input: string): ParsedTask {
  let content = input.trim();
  let priority: Priority = DEFAULT_PRIORITY;
  const projects: string[] = [];
  const contexts: string[] = [];
  const customTags: string[] = [];
  let dueDate: string | null = null;
  let thresholdDate: string | null = null;
  let estimatedPomodoros = 0;
  let recurrence: Recurrence | null = null;
  let trigger: string | null = null;

  // `when:` — the situational cue, extracted before anything else because it
  // is the one field whose value is a phrase rather than a token. Every other
  // marker here matches a run of non-space characters; a cue like "坐下打开电脑
  // 后" has spaces in it and no closing delimiter that would not itself be
  // legal inside a cue. So it takes the rest of the line, and the rule is that
  // it goes last. Running it first is what makes `写报告 !A when:坐下后` work.
  // `.*` rather than `.+`: a bare `when:` with nothing after it still has to
  // be stripped from the content, it just yields no cue.
  const triggerMatch = content.match(/(^|\s)when:\s*(.*)$/i);
  if (triggerMatch) {
    let cue = triggerMatch[2].trim();

    // "Rest of the line" means the rest of what the *user* typed. Callers
    // append a default priority token — QuickAddRow puts the column's `!X` at
    // the end, relying on the parser preferring the first `!X` so a typed one
    // still wins — and without this that token lands inside the cue, giving
    // a trigger of "午饭回来倒完水坐下后 !C" and no priority at all.
    const appended: string[] = [];
    let tail = cue.match(/(^|\s)(![ABCDE](?![A-Za-z])|【\s*[ABCDE]\s*】)$/i);
    while (tail) {
      appended.unshift(tail[2]);
      cue = cue.slice(0, tail.index).trim();
      tail = cue.match(/(^|\s)(![ABCDE](?![A-Za-z])|【\s*[ABCDE]\s*】)$/i);
    }

    if (cue) trigger = cue;
    content = [content.slice(0, triggerMatch.index).trim(), ...appended].join(' ').trim();
  }

  // Extract priority — prefer !X, fall back to 【X】 (Chinese full-width brackets, easier
  // to type on CN IME). The bracket form requires anchor at start/end or surrounding
  // whitespace so that pasted content like "见【A】部分" does not silently reassign priority.
  const bracketPriority = /(^|\s)【\s*([ABCDE])\s*】(\s|$)/i;
  let priorityMatch = content.match(/!([ABCDE])(?![A-Za-z])/i);
  let usedBracketForm = false;
  if (!priorityMatch) {
    const m = content.match(bracketPriority);
    if (m) {
      priorityMatch = [m[0], m[2]] as RegExpMatchArray;
      usedBracketForm = true;
    }
  }
  if (priorityMatch) {
    priority = priorityMatch[1].toUpperCase() as Priority;
    content = content.replace(/!([ABCDE])(?![A-Za-z])/gi, '');
    if (usedBracketForm) {
      content = content.replace(new RegExp(bracketPriority.source, 'gi'), ' ');
    }
    content = content.replace(/\s+/g, ' ').trim();
  }

  // Prefixed fields FIRST. `+project` / `@context` / `#tag` match any
  // non-space run, so running them earlier ate the operand out of `~+3d`,
  // `thr:+7d` and `rec:1m@15` — the token was consumed as a project or context
  // and the documented syntax silently did nothing.
  // Extract threshold date (thr:date)
  const thresholdMatch = content.match(/thr:(\S+)/i);
  if (thresholdMatch) {
    thresholdDate = parseDateInput(thresholdMatch[1]);
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
    dueDate = parseDateInput(dueDateMatch[1]);
    content = content.replace(/~\S+/g, '').trim();
  }

  // `+project`, `@context` and `#tag` must start at the beginning of the input
  // or right after whitespace — the same boundary rule todo.txt uses.
  //
  // Without it these matched mid-word, and the matched run was then DELETED
  // from the content: "mail bob@example.com about c++ and issue#42" parsed as
  // context "example.com", project "+" and tag "42", leaving the user with
  // "mail bob about c and issue". Aligning with todo.txt fixes that and keeps
  // typed input and imported lines parsing identically.

  // Extract projects (+project)
  for (const match of content.matchAll(/(^|\s)\+(\S+)/g)) {
    projects.push(match[2]);
  }
  content = content.replace(/(^|\s)\+\S+/g, '$1').trim();

  // Extract contexts (@context)
  for (const match of content.matchAll(/(^|\s)@(\S+)/g)) {
    contexts.push(match[2]);
  }
  content = content.replace(/(^|\s)@\S+/g, '$1').trim();

  // Extract custom tags (#tag or emoji tags)
  for (const match of content.matchAll(/(^|\s)#(\S+)/g)) {
    customTags.push(match[2]);
  }
  content = content.replace(/(^|\s)#\S+/g, '$1').trim();

  // Extract pomodoros (🍅3 or p3). Must run BEFORE emoji tags so 🍅3 is not
  // captured as a tag. The token must stand alone: an unanchored /p\d+/ matched
  // inside ordinary words, so "step2 done" silently became "ste done" with a
  // 2-pomodoro estimate.
  const pomodoroMatch = content.match(/(^|\s)(?:🍅|p)(\d+)(?=\s|$)/);
  if (pomodoroMatch) {
    estimatedPomodoros = parseInt(pomodoroMatch[2], 10);
    content = content.replace(/(^|\s)(?:🍅|p)\d+(?=\s|$)/g, '$1').trim();
  }

  // Extract emoji tags (⚡高能量, 💻编码, etc.)
  const emojiTagMatches = content.matchAll(/([\u{1F300}-\u{1F9FF}][\u4e00-\u9fa5\w]+)/gu);
  for (const match of emojiTagMatches) {
    customTags.push(match[1]);
  }
  content = content.replace(/([\u{1F300}-\u{1F9FF}][\u4e00-\u9fa5\w]+)/gu, '').trim();

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
    recurrence,
    trigger
  };
}

/**
 * Parse a relative or absolute date operand into YYYY-MM-DD, or null.
 *
 * Exported because the todo.txt importer needs the same rules: sleek writes
 * speaking dates like `due:tomorrow` into the file and only resolves them on
 * read, so both sides have to agree on what "tomorrow" means.
 */
export function parseDateInput(dateStr: string): string | null {
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
  task.trigger = parsed.trigger;

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

  // Highlight priority — both !X and 【X】 forms
  html = html.replace(/!([ABCDE])(?![A-Za-z])/gi, '<span class="syntax-priority">!$1</span>');
  html = html.replace(/【\s*([ABCDE])\s*】/gi, '<span class="syntax-priority">【$1】</span>');

  // Projects / contexts / tags use the same whitespace boundary as the parser,
  // so the preview cannot highlight something that will not actually be
  // extracted — an email address used to light up as a context.
  html = html.replace(/(^|\s)(\+\S+)/g, '$1<span class="syntax-project">$2</span>');
  html = html.replace(/(^|\s)(@\S+)/g, '$1<span class="syntax-context">$2</span>');
  html = html.replace(/(^|\s)(#\S+)/g, '$1<span class="syntax-tag">$2</span>');

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

/**
 * Escape the three characters that would otherwise be read as markup.
 *
 * This used to go through `document.createElement`, which made the whole module
 * DOM-dependent even though the CLI imports it — the crash was latent only
 * because nothing outside the browser happened to call `highlightSyntax`.
 * A `textContent` → `innerHTML` round trip escapes exactly `&`, `<` and `>`,
 * so this matches what it replaced.
 */
function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

