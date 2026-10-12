import { isTauri } from './storage';

/**
 * Access to the todo.txt candidate pool — the file this app shares with sleek.
 *
 * Reads and writes go through the `read_external_file` / `write_external_file`
 * Rust commands rather than tauri-plugin-fs, because the path is chosen by the
 * user at runtime and the fs plugin scopes paths at build time. See
 * src-tauri/src/commands.rs.
 *
 * In the browser (npm run dev, no Tauri) there is no filesystem, so the same
 * API is backed by localStorage keyed on the path. That is not a real shared
 * file, but it makes the whole pull/write-back flow exercisable without
 * building the desktop app.
 */

const WEB_PREFIX = 'focusflow_todofile:';

/** Read a todo.txt. Returns null when the file does not exist yet. */
export async function readTodoFile(path: string): Promise<string | null> {
  if (!path) return null;

  if (!isTauri()) {
    return localStorage.getItem(WEB_PREFIX + path);
  }

  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<string | null>('read_external_file', { path });
}

/** Write a todo.txt atomically. */
export async function writeTodoFile(path: string, content: string): Promise<void> {
  if (!path) throw new Error('No todo.txt path configured');

  if (!isTauri()) {
    localStorage.setItem(WEB_PREFIX + path, content);
    return;
  }

  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('write_external_file', { path, content });
}

/**
 * Ask the user to pick a file.
 *
 * Returns null when they cancel, and also when there is no picker available
 * (browser mode) — callers fall back to the path text field, which is why the
 * field exists rather than the picker being the only way in.
 */
export async function pickTodoFile(title: string): Promise<string | null> {
  if (!isTauri()) return null;

  const { open } = await import('@tauri-apps/plugin-dialog');
  const selected = await open({
    title,
    multiple: false,
    directory: false,
    filters: [{ name: 'todo.txt', extensions: ['txt'] }]
  });

  return typeof selected === 'string' ? selected : null;
}

/**
 * Append lines to a todo.txt, preserving everything already there.
 *
 * Read-modify-write rather than an append: the write path is a temp file plus
 * a rename, which replaces the file wholesale. Reading first is what keeps the
 * user's existing todos.
 */
export async function appendTodoLines(path: string, lines: string[]): Promise<void> {
  if (lines.length === 0) return;

  const existing = (await readTodoFile(path)) ?? '';
  const trimmed = existing.replace(/\s+$/, '');
  // Retrying after the shared file was saved but active.json failed must not
  // duplicate exported lines. Count occurrences so identical pending tasks survive.
  const counts = new Map<string, number>();
  for (const line of existing.split(/\r?\n/)) counts.set(line, (counts.get(line) ?? 0) + 1);
  const missing = lines.filter(line => {
    const count = counts.get(line) ?? 0;
    if (count > 0) { counts.set(line, count - 1); return false; }
    return true;
  });
  if (missing.length === 0) return;
  const body = trimmed ? `${trimmed}\n${missing.join('\n')}` : missing.join('\n');

  await writeTodoFile(path, `${body}\n`);
}
