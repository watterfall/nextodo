import type { Task, Priority } from '$lib/types';
import { PRIORITY_CONFIG, createEmptyTask } from '$lib/types';
import { formatDateISO, parseISODate } from './unitCalc';
import { parseRecurrence, formatRecurrence, isTodoTxtExpressible } from './recurrence';
import { parseDateInput } from './parser';

/**
 * todo.txt reading and writing, byte-compatible with the `jstodotxt@1.0.0-alpha.3`
 * parser that sleek uses. See docs/SLEEK-INTEROP.md for the full contract.
 *
 * The grammar is deliberately transcribed from jstodotxt's `Item.ts` rather
 * than from the todo.txt spec prose, because the two differ in edge cases and
 * it is sleek's behaviour we have to match — a line we write has to survive a
 * round trip through sleek unchanged, and vice versa.
 *
 * This module is Node-safe: no Svelte, no Tauri, no i18n. File IO belongs to
 * the caller.
 */

// x flag, (P) priority, then either "completed created" or just "created", then the body.
const LINE =
  /^((x) )?(\(([A-Z])\) )?(((\d{4}-\d{2}-\d{2}) (\d{4}-\d{2}-\d{2})|(\d{4}-\d{2}-\d{2})) )?(.*)$/;

// Every tag in a body: a key:value extension, or a +project / @context.
//
// Two consequences worth knowing, both inherited from jstodotxt:
//   - The extension alternative is tried FIRST, so `@a:b` matches as
//     `@a:b` and is then classified by its first character — it becomes a
//     CONTEXT named "a:b", not an extension.
//   - Neither key nor value may contain a colon or whitespace, so `a:b:c`
//     yields the extension a=b and leaves `:c` as plain text.
const TAGS = /(^|\s)([^\s:]+:[^\s:]+|[+@]\S+)/g;

// Extensions this app understands and lifts out of the body into Task fields.
// Anything else stays in the content, visible to the user, rather than being
// silently dropped — another tool may own it.
const KNOWN_EXTENSIONS = new Set(['due', 't', 'rec', 'pm', 'pri', 'h']);

// sleek encodes a line break inside a single todo as this control character
// (see its Shared.ts). Nothing here renders multi-line bodies, so it collapses
// to a space rather than corrupting the line.
const LINE_BREAK_PLACEHOLDER = String.fromCharCode(16);

export interface TodoTxtExtension {
  key: string;
  value: string;
}

export interface TodoTxtItem {
  complete: boolean;
  /** A single letter A-Z, or null. */
  priority: string | null;
  /** YYYY-MM-DD, or null. Only meaningful together with `createdDate`. */
  completedDate: string | null;
  /** YYYY-MM-DD, or null. */
  createdDate: string | null;
  /** Everything after the header, verbatim — tags included. */
  body: string;
  contexts: string[];
  projects: string[];
  extensions: TodoTxtExtension[];
}

export interface TodoTxtImport {
  task: Task;
  /** The line carried `h:1`. sleek hides these; the pull list does too by default. */
  hidden: boolean;
  /** The source line, verbatim, for later write-back. */
  raw: string;
}

// ---------------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------------

/** Split a body into its tags, classified exactly the way jstodotxt does. */
function parseBody(body: string): Pick<TodoTxtItem, 'contexts' | 'projects' | 'extensions'> {
  const contexts: string[] = [];
  const projects: string[] = [];
  const extensions: TodoTxtExtension[] = [];

  for (const match of body.matchAll(TAGS)) {
    const tag = match[2];
    if (tag[0] === '@') {
      contexts.push(tag.slice(1));
    } else if (tag[0] === '+') {
      projects.push(tag.slice(1));
    } else {
      const colon = tag.indexOf(':');
      extensions.push({ key: tag.slice(0, colon), value: tag.slice(colon + 1) });
    }
  }

  return { contexts, projects, extensions };
}

/** Parse one todo.txt line. Never throws: an unparseable line is all body. */
export function parseLine(line: string): TodoTxtItem {
  const normalized = line.replace(new RegExp(LINE_BREAK_PLACEHOLDER, 'g'), ' ');
  // The trailing .* means this cannot fail to match.
  const match = LINE.exec(normalized) as RegExpExecArray;

  const body = match[10];
  return {
    complete: match[2] === 'x',
    priority: match[4] ?? null,
    // Two dates means completed-then-created; one date is the creation date.
    completedDate: match[7] ?? null,
    createdDate: match[8] ?? match[9] ?? null,
    body,
    ...parseBody(body)
  };
}

/** The first value of an extension key, or null. */
function extensionValue(item: TodoTxtItem, key: string): string | null {
  return item.extensions.find(e => e.key === key)?.value ?? null;
}

// ---------------------------------------------------------------------------
// Serialize
// ---------------------------------------------------------------------------

/**
 * Render an item back to a todo.txt line.
 *
 * Field order and the single-space join match jstodotxt's `toString`, so a
 * parse/serialize round trip of an untouched item is the identity.
 */
export function serializeItem(item: TodoTxtItem): string {
  // todo.txt only allows a completion date when a creation date is also
  // present — with one date, a reader takes it as the creation date and the
  // completion date is lost. FocusFlow tasks always carry `createdAt`, so this
  // only guards hand-built items against producing a misreadable line.
  const createdDate = item.createdDate ?? (item.completedDate ? item.completedDate : null);

  return [
    item.complete ? 'x' : '',
    item.priority ? `(${item.priority})` : '',
    createdDate && item.completedDate ? item.completedDate : '',
    createdDate ?? '',
    item.body
  ]
    .filter(part => part !== '')
    .join(' ');
}

// ---------------------------------------------------------------------------
// Body editing (used by the write-back path)
// ---------------------------------------------------------------------------

/** Append ` key:value` to a body, replacing an existing entry for that key. */
function setExtension(body: string, key: string, value: string): string {
  const existing = new RegExp(`(^|\\s)${escapeRegExp(key)}:[^\\s:]+`, 'g');
  const replaced = body.replace(existing, '');
  return `${replaced.trim()} ${key}:${value}`.trim();
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Mark a line complete the way sleek does.
 *
 * sleek moves the priority into a `pri:` extension on completion so it can be
 * restored if the todo is reopened (its RestorePreviousPriority). Matching that
 * exactly matters: a shared file should not end up with two styles of completed
 * line depending on which app ticked the box.
 *
 * Idempotent — a line that is already complete is returned unchanged.
 */
export function markLineComplete(line: string, dateISO: string): string {
  const item = parseLine(line);
  if (item.complete) return line;

  if (item.priority) {
    item.body = setExtension(item.body, 'pri', item.priority);
    item.priority = null;
  }

  item.complete = true;
  item.completedDate = dateISO;
  item.createdDate = item.createdDate ?? dateISO;

  return serializeItem(item);
}

/** Append `@context` to a line if it is not already there. Idempotent. */
export function addContextToLine(line: string, context: string): string {
  const item = parseLine(line);
  if (item.contexts.includes(context)) return line;
  item.body = `${item.body.trim()} @${context}`.trim();
  return serializeItem(item);
}

/** Remove `@context` from a line if present. Idempotent. */
export function removeContextFromLine(line: string, context: string): string {
  const item = parseLine(line);
  if (!item.contexts.includes(context)) return line;
  item.body = item.body
    .replace(new RegExp(`(^|\\s)@${escapeRegExp(context)}(?=\\s|$)`, 'g'), ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return serializeItem(item);
}

// ---------------------------------------------------------------------------
// Task bridge
// ---------------------------------------------------------------------------

/**
 * Strip the tags this app owns out of a body, leaving readable content.
 *
 * Unknown extensions survive deliberately: another tool may own `foo:bar`, and
 * showing it in the task text is better than deleting information the user
 * cannot get back.
 */
function contentFromBody(body: string): string {
  return body
    .replace(TAGS, (match, whitespace: string, tag: string) => {
      if (tag[0] === '@' || tag[0] === '+') return whitespace;
      const key = tag.slice(0, tag.indexOf(':'));
      return KNOWN_EXTENSIONS.has(key) ? whitespace : match;
    })
    .replace(/(^|\s)#\S+/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/** `#tag` values in a body, using todo.txt's whitespace-boundary rule. */
function customTagsFromBody(body: string): string[] {
  return [...body.matchAll(/(^|\s)#(\S+)/g)].map(m => m[2]);
}

/**
 * A todo.txt priority letter, if this app has a tier for it.
 *
 * G and H are excluded on purpose: they are this app's completed/cancelled
 * markers, so importing a literal `(G)` line as "already completed" would be
 * a coincidence of lettering, not a translation.
 */
function importPriority(letter: string | null, fallback: Priority): Priority {
  if (!letter) return fallback;
  const priority = letter as Priority;
  if (!(priority in PRIORITY_CONFIG)) return fallback;
  return priority;
}

/**
 * Resolve a `due:` / `t:` operand.
 *
 * sleek accepts speaking dates (`due:tomorrow`, `t:in one week`) and only
 * resolves them when it parses. This understands the subset FocusFlow's own
 * input syntax understands; anything else returns null, and the caller leaves
 * the token in the content so the information is visible rather than lost.
 */
function importDate(value: string | null): string | null {
  if (!value) return null;
  return parseDateInput(value);
}

/**
 * Build a Task from one todo.txt line.
 *
 * Nothing here writes to the file — pulling a line into FocusFlow copies it;
 * the source stays where it is until the task is completed. `raw` is kept so
 * the write-back can find the line again (docs/SLEEK-INTEROP.md §5).
 */
export function taskFromTodoTxt(line: string, defaultPriority: Priority = 'C'): TodoTxtImport {
  const item = parseLine(line);
  const task = createEmptyTask(importPriority(item.priority, defaultPriority));

  task.content = contentFromBody(item.body);
  task.projects = item.projects;
  task.contexts = item.contexts;
  task.customTags = customTagsFromBody(item.body);

  task.dueDate = importDate(extensionValue(item, 'due'));
  task.thresholdDate = importDate(extensionValue(item, 't'));

  const rec = extensionValue(item, 'rec');
  task.recurrence = rec ? parseRecurrence(rec) : null;

  const pm = extensionValue(item, 'pm');
  const estimated = pm ? parseInt(pm, 10) : NaN;
  task.pomodoros.estimated = Number.isFinite(estimated) && estimated >= 0 ? estimated : 0;

  // todo.txt dates have no time component. Anchoring at local midnight keeps
  // the calendar day the file shows, which is what every date helper here
  // works on.
  if (item.createdDate) task.createdAt = parseISODate(item.createdDate).toISOString();

  if (item.complete) {
    task.status = 'completed';
    task.completedAt = item.completedDate
      ? parseISODate(item.completedDate).toISOString()
      : task.createdAt;
    // sleek moves the pre-completion priority into `pri:` when it marks a line
    // done, because todo.txt has no way to carry `(A)` on a completed line.
    // That is the same idea as this app's status/priority split, so it maps
    // straight onto `priority` — and unlike before, nothing has to be stashed
    // in a second field to survive the completion.
    const pri = extensionValue(item, 'pri');
    task.priority = importPriority(pri, defaultPriority);
  }

  return {
    task,
    hidden: extensionValue(item, 'h') === '1',
    raw: line
  };
}

/**
 * Render a Task as a todo.txt line.
 *
 * Used for exporting tasks back to the candidate pool (the 4.0 → 5.0 migration
 * in docs/SLEEK-INTEROP.md §10). The normal completion path does NOT go through
 * here — it edits the existing source line in place via `markLineComplete`, so
 * that everything else on that line survives untouched.
 */
export function todoTxtFromTask(task: Task): string {
  const completed = task.status === 'completed';

  const parts: string[] = [task.content.trim()];

  // A tag with whitespace in it cannot be expressed in todo.txt and would
  // silently split into two tags on the next read, so it is dropped.
  for (const project of task.projects) if (!/\s/.test(project)) parts.push(`+${project}`);
  for (const context of task.contexts) if (!/\s/.test(context)) parts.push(`@${context}`);
  for (const tag of task.customTags) if (!/\s/.test(tag)) parts.push(`#${tag}`);

  if (task.dueDate) parts.push(`due:${task.dueDate}`);
  if (task.thresholdDate) parts.push(`t:${task.thresholdDate}`);
  // A weekday list or day-of-month selector has no todo.txt syntax; writing it
  // would produce a `rec:` value sleek cannot read, so it stays FocusFlow-side.
  if (isTodoTxtExpressible(task.recurrence)) parts.push(`rec:${formatRecurrence(task.recurrence)}`);
  if (task.pomodoros.estimated > 0) parts.push(`pm:${task.pomodoros.estimated}`);
  // todo.txt cannot carry `(A)` on a completed line, so sleek moves the tier
  // into `pri:` when it marks something done. Same rule here, and the tier is
  // simply `task.priority` on both branches now that completion no longer
  // overwrites it.
  if (completed) parts.push(`pri:${task.priority}`);

  return serializeItem({
    complete: completed,
    priority: completed ? null : task.priority,
    completedDate: task.completedAt ? formatDateISO(new Date(task.completedAt)) : null,
    createdDate: task.createdAt ? formatDateISO(new Date(task.createdAt)) : null,
    body: parts.filter(Boolean).join(' '),
    contexts: [],
    projects: [],
    extensions: []
  });
}

// ---------------------------------------------------------------------------
// Locating a source line for write-back
// ---------------------------------------------------------------------------

/** Content of a line with its header and tags removed, for fuzzy matching. */
function matchKey(line: string): string {
  return contentFromBody(parseLine(line).body).toLowerCase();
}

export interface SourceLineMatch {
  index: number;
  /** true when the line was found by content rather than verbatim. */
  fuzzy: boolean;
  /** More than one line matched; the first open one was chosen. */
  ambiguous: boolean;
}

/**
 * Find the line a pulled task came from.
 *
 * todo.txt has no stable identity — the line IS the record — so this matches on
 * the verbatim text first and falls back to the tag-stripped content, which
 * survives the user editing the line's priority or dates in sleek.
 *
 * Returns index -1 when nothing matches. The caller must NOT guess in that
 * case: writing to the wrong line silently rewrites a different task, which is
 * far worse than not writing back at all.
 */
export function findSourceLine(lines: string[], raw: string): SourceLineMatch {
  const exact = lines.indexOf(raw);
  if (exact !== -1) return { index: exact, fuzzy: false, ambiguous: false };

  const key = matchKey(raw);
  if (!key) return { index: -1, fuzzy: false, ambiguous: false };

  const candidates: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (matchKey(lines[i]) === key) candidates.push(i);
  }
  if (candidates.length === 0) return { index: -1, fuzzy: false, ambiguous: false };

  // Prefer a line that is still open — a completed duplicate is almost
  // certainly a previous occurrence of the same recurring todo.
  const open = candidates.find(i => !parseLine(lines[i]).complete);
  return {
    index: open ?? candidates[0],
    fuzzy: true,
    ambiguous: candidates.length > 1
  };
}

/**
 * Split file content into lines the way sleek does: blank lines are dropped,
 * so indices here line up with what sleek shows the user.
 */
export function splitLines(content: string): string[] {
  return content.split(/[\r\n]+/).filter(line => line.trim() !== '');
}
