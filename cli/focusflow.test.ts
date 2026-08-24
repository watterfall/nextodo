import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { createDefaultActiveData, createEmptyTask } from '../src/lib/types';
import type { ActiveData, Task } from '../src/lib/types';

/**
 * End-to-end tests for the CLI binary.
 *
 * The CLI runs `main()` at module load and exports nothing, so it is driven as a
 * real subprocess against a throwaway `--data` file. That is the honest shape
 * anyway: this is the one surface that mutates the user's `active.json` from
 * outside the app, with no Svelte store or file watcher in between.
 */
const repoRoot = fileURLToPath(new URL('..', import.meta.url));

let bundlePath: string;
let workDir: string;
let dataPath: string;

beforeAll(async () => {
  workDir = mkdtempSync(join(tmpdir(), 'focusflow-cli-test-'));
  bundlePath = join(workDir, 'focusflow.mjs');
  await build({
    entryPoints: [join(repoRoot, 'cli/focusflow.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    alias: { $lib: join(repoRoot, 'src/lib') },
    outfile: bundlePath,
  });
}, 30_000);

afterAll(() => {
  rmSync(workDir, { recursive: true, force: true });
});

beforeEach(() => {
  dataPath = join(workDir, `data-${Math.floor(process.hrtime()[1])}.json`);
  writeFileSync(dataPath, JSON.stringify(createDefaultActiveData()), 'utf8');
});

function run(...args: string[]): string {
  return execFileSync(process.execPath, [bundlePath, ...args, '--data', dataPath], {
    encoding: 'utf8',
  });
}

function read(): ActiveData {
  return JSON.parse(readFileSync(dataPath, 'utf8')) as ActiveData;
}

function seed(tasks: Task[]): void {
  const data = createDefaultActiveData();
  data.tasks = tasks;
  writeFileSync(dataPath, JSON.stringify(data), 'utf8');
}

describe('focusflow CLI', () => {
  it('adds a task and reads it back through list', () => {
    run('add', 'write the report !C +work ~2026-03-15');

    const [task] = read().tasks;
    expect(task.content).toContain('write the report');
    expect(task.priority).toBe('C');
    expect(task.projects).toContain('work');
    expect(task.dueDate).toBe('2026-03-15');

    expect(run('list')).toContain('write the report');
  });

  it('completes a task by content substring', () => {
    run('add', 'water plants !E');
    run('done', 'water');

    const [task] = read().tasks;
    expect(task.priority).toBe('G');
    expect(task.completed).toBe(true);
    expect(task.completedAt).not.toBeNull();
  });

  it('regenerates a strict recurring task from its previous due date', () => {
    seed([
      {
        ...createEmptyTask('C'),
        id: 'standup',
        content: 'daily standup',
        dueDate: '2026-03-15',
        recurrence: { n: 1, unit: 'd', strict: true, nextDue: null },
      },
    ]);

    run('done', 'standup');
    const tasks = read().tasks;

    const completed = tasks.find((t) => t.id === 'standup')!;
    expect(completed.priority).toBe('G');

    // Without this the user's daily standup silently disappeared forever.
    const next = tasks.find((t) => t.id !== 'standup')!;
    expect(next).toBeDefined();
    expect(next.content).toBe('daily standup');
    expect(next.dueDate).toBe('2026-03-16');
    expect(next.completed).toBe(false);
  });

  it('regenerates a loose recurring task from the completion date', () => {
    // todo.txt's default. The CLI stamps completedAt *after* it regenerates, so
    // this also pins that the completion instant is threaded through explicitly
    // rather than read back off the task.
    seed([
      {
        ...createEmptyTask('C'),
        id: 'chore',
        content: 'water plants',
        dueDate: '2020-01-01', // long overdue; a loose recurrence must ignore it
        recurrence: { n: 1, unit: 'd', strict: false, nextDue: null },
      },
    ]);

    run('done', 'chore');

    const tomorrow = new Date();
    tomorrow.setHours(0, 0, 0, 0);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const expected = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

    const next = read().tasks.find((t) => t.id !== 'chore')!;
    expect(next.dueDate).toBe(expected);
  });

  it('cancels without marking the task completed', () => {
    run('add', 'draft memo !D');
    run('cancel', 'memo');

    const [task] = read().tasks;
    expect(task.priority).toBe('H');
    // The app's cancelTask leaves this false; both surfaces must agree, or
    // predicates keyed on `completed` disagree depending on who cancelled.
    expect(task.completed).toBe(false);
  });

  it('does not regenerate a recurring task that was cancelled', () => {
    seed([
      {
        ...createEmptyTask('C'),
        id: 'standup',
        content: 'daily standup',
        dueDate: '2026-03-15',
        recurrence: { n: 1, unit: 'd', strict: true, nextDue: null },
      },
    ]);

    run('cancel', 'standup');
    expect(read().tasks).toHaveLength(1);
  });

  it('replaces the incumbent S instead of refusing a second one', () => {
    run('add', 'rewrite the exporter !S');
    run('add', 'migrate the database !S');

    const tasks = read().tasks;
    const sustained = tasks.filter((t) => t.priority === 'S');
    expect(sustained).toHaveLength(1);
    expect(sustained[0].content).toBe('migrate the database');
    // The unseated one is demoted, not dropped — same as the A Highlander.
    expect(tasks.find((t) => t.content === 'rewrite the exporter')?.priority).toBe('B');
  });

  it('preserves unrelated data across a write', () => {
    const before = read();
    run('add', 'something !E');
    const after = read();

    expect(after.version).toBe(before.version);
    expect(after.settings).toEqual(before.settings);
    expect(after.lastModified).not.toBe(before.lastModified);
  });

  it('exits non-zero when nothing matches', () => {
    expect(() => run('done', 'no-such-task')).toThrow();
  });
});
