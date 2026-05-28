/**
 * FocusFlow CLI — a headless control surface over the same data file the
 * desktop app uses (`active.json`). Writing the file triggers the app's file
 * watcher, so changes appear live in a running app. Designed to be driven by a
 * local CLI LLM / agent (machine-readable `--json` output).
 *
 * Build:  npm run cli:build   →  dist-cli/focusflow.mjs
 * Run:    node dist-cli/focusflow.mjs <command> [...]
 */
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';

import { createTaskFromInput } from '$lib/utils/parser';
import { applyHighlanderRule, canAddTask } from '$lib/utils/quotaCore';
import { createDefaultActiveData } from '$lib/types';
import type { ActiveData, Task, Priority } from '$lib/types';

const APP_ID = 'com.focusflow.app';
const OPERABLE = new Set<Priority>(['A', 'B', 'C', 'D', 'E', 'F', 'S', 'N']);

// ---------- data file ----------

function defaultDataPath(): string {
  // macOS Tauri app_data_dir = ~/Library/Application Support/<identifier>/
  return join(homedir(), 'Library', 'Application Support', APP_ID, 'active.json');
}

function load(path: string): ActiveData {
  if (!existsSync(path)) return createDefaultActiveData();
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as ActiveData;
  } catch (e) {
    fail(`Failed to read/parse ${path}: ${(e as Error).message}`);
  }
}

function save(path: string, data: ActiveData): void {
  data.lastModified = new Date().toISOString();
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  renameSync(tmp, path); // atomic
}

// ---------- helpers ----------

function fail(msg: string): never {
  console.error(`focusflow: ${msg}`);
  process.exit(1);
}

function parseArgs(argv: string[]): { positional: string[]; flags: Record<string, string | boolean> } {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(a);
    }
  }
  return { positional, flags };
}

function findTask(tasks: Task[], query: string): Task | null {
  const operable = tasks.filter(t => OPERABLE.has(t.priority) && !t.completed);
  const byId = operable.find(t => t.id === query);
  if (byId) return byId;
  const matches = operable.filter(t => t.content.toLowerCase().includes(query.toLowerCase()));
  if (matches.length === 0) return null;
  if (matches.length > 1) {
    fail(`"${query}" matches ${matches.length} tasks; be more specific:\n` +
      matches.map(t => `  - [${t.priority}] ${t.content}`).join('\n'));
  }
  return matches[0];
}

// ---------- commands ----------

function cmdAdd(positional: string[], flags: Record<string, string | boolean>, path: string): void {
  let text = positional.join(' ').trim();
  if (!text) fail('add: task content required, e.g. focusflow add "写方案 !B +项目 ~2026-06-01 🍅3"');
  if (typeof flags.priority === 'string') text += ` !${flags.priority}`;

  const data = load(path);
  const task = createTaskFromInput(text);

  // A is exempt — Highlander demotes any existing A, so it always has room.
  if (task.priority !== 'A' && !canAddTask(data.tasks, task.priority)) {
    console.error(`focusflow: warning — ${task.priority} zone is over quota (added anyway).`);
  }
  let tasks = data.tasks;
  if (task.priority === 'A') tasks = applyHighlanderRule(tasks, task);
  tasks.push(task);
  data.tasks = tasks;
  save(path, data);

  if (flags.json) console.log(JSON.stringify({ ok: true, id: task.id, priority: task.priority, content: task.content }));
  else console.log(`added [${task.priority}] ${task.content}  (id ${task.id.slice(0, 8)})`);
}

function cmdList(flags: Record<string, string | boolean>, path: string): void {
  const data = load(path);
  let tasks = data.tasks.filter(t => OPERABLE.has(t.priority) && !t.completed);
  if (typeof flags.priority === 'string') {
    const p = flags.priority.toUpperCase();
    tasks = tasks.filter(t => t.priority === p);
  }

  if (flags.json) {
    console.log(JSON.stringify(tasks.map(t => ({
      id: t.id, priority: t.priority, content: t.content,
      dueDate: t.dueDate, projects: t.projects, contexts: t.contexts, tags: t.customTags
    })), null, 2));
    return;
  }

  if (tasks.length === 0) { console.log('(no active tasks)'); return; }
  const order: Priority[] = ['A', 'B', 'C', 'D', 'E', 'S', 'N', 'F'];
  tasks.sort((a, b) => order.indexOf(a.priority) - order.indexOf(b.priority));
  for (const t of tasks) {
    const due = t.dueDate ? `  ~${t.dueDate}` : '';
    console.log(`[${t.priority}] ${t.content}${due}  (${t.id.slice(0, 8)})`);
  }
}

function cmdResolve(kind: 'done' | 'cancel', positional: string[], path: string): void {
  const query = positional.join(' ').trim();
  if (!query) fail(`${kind}: provide a task id or content substring`);
  const data = load(path);
  const task = findTask(data.tasks, query);
  if (!task) fail(`${kind}: no active task matches "${query}"`);

  task.originalPriority = task.priority;
  task.priority = kind === 'done' ? 'G' : 'H';
  task.completed = true;
  task.completedAt = new Date().toISOString();
  save(path, data);
  console.log(`${kind === 'done' ? 'completed' : 'cancelled'}: ${task.content}`);
}

function cmdAgentGuide(): void {
  console.log(`FocusFlow CLI — operate the FocusFlow task app from the command line.

Data file: ${defaultDataPath()}  (override with --data <path>)
A running FocusFlow app auto-reloads when this file changes.

Commands:
  add "<text>" [--priority A-F|S|N] [--json]
      Add a task. Inline syntax (parsed):
        !A..!F !S !N   priority        +project   @context   #tag
        ~2026-06-01 | ~tomorrow | ~today   due date
        thr:2026-06-01 | thr:+3d           hidden-until date
        🍅3 (or p3)    estimated pomodoros
        rec:1d|1w|...  recurrence
  list [--priority X] [--json]      List active tasks (A-F/S/N).
  done <id|substring>               Mark a task complete.
  cancel <id|substring>             Cancel a task.
  import-reminders [--list <name>] [--priority X]
      Import macOS Reminders (incomplete) as tasks (title→content, due→date).
  agent-guide                       Print this guide.

Priorities: A core(1) B key(2) C steady(3) D adhoc(4) E quick(5) F idea-pool(∞) S sustained N future.
Exit code 0 on success, 1 on error. Errors go to stderr.`);
}

// ---------- reminders import (N1) ----------

function cmdImportReminders(flags: Record<string, string | boolean>, path: string): void {
  const listName = typeof flags.list === 'string' ? flags.list : null;
  const priority = typeof flags.priority === 'string' ? flags.priority : 'F';

  // AppleScript: emit one reminder per line as  name\tdueISO  (incomplete only).
  const scope = listName
    ? `reminders of list "${listName.replace(/"/g, '\\"')}"`
    : `reminders`;
  const script = `
set out to ""
tell application "Reminders"
  repeat with r in (${scope} whose completed is false)
    set theName to name of r
    set d to due date of r
    if d is missing value then
      set dueStr to ""
    else
      set dueStr to (year of d as string) & "-" & text -2 thru -1 of ("0" & ((month of d as integer) as string)) & "-" & text -2 thru -1 of ("0" & (day of d as string))
    end if
    set out to out & theName & tab & dueStr & linefeed
  end repeat
end tell
return out`;

  let raw = '';
  try {
    raw = execFileSync('osascript', ['-e', script], { encoding: 'utf8' });
  } catch (e) {
    fail(`import-reminders: osascript failed (grant Automation permission to your terminal). ${(e as Error).message}`);
  }

  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) { console.log('import-reminders: nothing to import'); return; }

  const data = load(path);
  const existing = new Set(data.tasks.map(t => t.content.trim()));
  let added = 0;
  for (const line of lines) {
    const [name, dueStr] = line.split('\t');
    const title = (name ?? '').trim();
    if (!title || existing.has(title)) continue; // de-dupe by title
    let input = `${title} !${priority}`;
    if (dueStr && /^\d{4}-\d{2}-\d{2}$/.test(dueStr.trim())) input += ` ~${dueStr.trim()}`;
    const task = createTaskFromInput(input);
    data.tasks.push(task);
    existing.add(title);
    added++;
  }
  if (added > 0) save(path, data);
  console.log(`import-reminders: imported ${added} reminder(s)${listName ? ` from "${listName}"` : ''} (skipped ${lines.length - added} existing/empty)`);
}

// ---------- entry ----------

function main(): void {
  const argv = process.argv.slice(2);
  const { positional, flags } = parseArgs(argv);
  const cmd = positional.shift();
  const dataPath = typeof flags.data === 'string' ? flags.data : defaultDataPath();

  switch (cmd) {
    case 'add': return cmdAdd(positional, flags, dataPath);
    case 'list': return cmdList(flags, dataPath);
    case 'done': return cmdResolve('done', positional, dataPath);
    case 'cancel': return cmdResolve('cancel', positional, dataPath);
    case 'import-reminders': return cmdImportReminders(flags, dataPath);
    case 'agent-guide':
    case 'help':
    case undefined:
      return cmdAgentGuide();
    default:
      fail(`unknown command "${cmd}". Run "focusflow agent-guide".`);
  }
}

main();
