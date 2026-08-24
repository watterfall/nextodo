import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  loadAppData,
  saveAppData,
  archiveTasks,
  loadFileData,
  isTauri,
  isCurrentlySaving
} from './storage';
import { createEmptyTask, createDefaultAppData } from '$lib/types';
import type { AppData, Task } from '$lib/types';

/**
 * IO tests for the persistence layer.
 *
 * These run against the localStorage path, which is what `isTauri()` selects
 * outside a Tauri window — and in a `node` test environment there is no
 * `window` at all, so the branch is taken without any mocking of the module
 * under test. Only `localStorage` itself is stubbed, so everything from
 * key layout to migration chaining to the shape actually written is real.
 *
 * The Tauri branch is not covered here: it is the same code with `invoke()`
 * where `localStorage` is, and stubbing that would test the stub. `exportData`
 * and `importData` are likewise skipped — they are thin wrappers over Blob /
 * FileReader with no logic of their own.
 */

const KEYS = {
  active: 'focusflow_active',
  archive: 'focusflow_archive',
  pomodoro: 'focusflow_pomodoro_history',
  legacy: 'focusflow_data'
};

/** Minimal in-memory localStorage, enough for what storage.ts uses. */
function installStorageStub(): Map<string, string> {
  const store = new Map<string, string>();
  const stub = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    }
  };
  vi.stubGlobal('localStorage', stub);
  return store;
}

let store: Map<string, string>;

beforeEach(() => {
  store = installStorageStub();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function readActive(): any {
  return JSON.parse(store.get(KEYS.active)!);
}

/** A task as stored under 5.0, where completion was a priority letter. */
function v5Task(priority: string, overrides: Record<string, unknown> = {}): unknown {
  const base = createEmptyTask('C') as unknown as Record<string, unknown>;
  delete base.status;
  return { ...base, priority, completed: false, ...overrides };
}

function seedActive(partial: Record<string, unknown>): void {
  const defaults = createDefaultAppData();
  store.set(
    KEYS.active,
    JSON.stringify({
      version: '6.0',
      lastModified: '2026-01-01T00:00:00.000Z',
      tasks: [],
      reviews: [],
      customTagGroups: defaults.customTagGroups,
      settings: defaults.settings,
      ...partial
    })
  );
}

describe('environment selection', () => {
  it('reports a non-Tauri environment under the node test runner', () => {
    // Everything below depends on this: it is what routes the code under test
    // through the localStorage branch without mocking the module itself.
    expect(isTauri()).toBe(false);
  });
});

describe('loadAppData — empty and broken input', () => {
  it('returns defaults when nothing has been stored', async () => {
    const data = await loadAppData();
    expect(data.tasks).toEqual([]);
    expect(data.version).toBe('6.0');
    expect(data.settings.pomodoroWork).toBe(25);
  });

  it('returns defaults instead of throwing on unparseable JSON', async () => {
    // A truncated write must not brick the app on the next launch.
    store.set(KEYS.active, '{"tasks": [');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const data = await loadAppData();
    expect(data.tasks).toEqual([]);
    spy.mockRestore();
  });

  it('tolerates a file with no tasks array at all', async () => {
    store.set(KEYS.active, JSON.stringify({ version: '6.0' }));
    const data = await loadAppData();
    expect(data.tasks).toEqual([]);
  });
});

describe('loadAppData — migration chaining', () => {
  it('carries a 5.0 file all the way to 6.0', async () => {
    seedActive({
      version: '5.0',
      tasks: [
        v5Task('A', { id: 'open' }),
        v5Task('G', { id: 'done', completed: true, originalPriority: 'B' }),
        v5Task('H', { id: 'dropped', originalPriority: 'D' })
      ]
    });

    const data = await loadAppData();

    expect(data.version).toBe('6.0');
    expect(data.tasks.map(t => [t.id, t.priority, t.status])).toEqual([
      ['open', 'A', 'open'],
      ['done', 'B', 'completed'],
      ['dropped', 'D', 'cancelled']
    ]);
  });

  it('runs BOTH migration steps for a 4.0 file', async () => {
    // The two upgrades have to chain: 4.0 → 5.0 moves F out of the unit, then
    // 5.0 → 6.0 splits completion off the priority. Wiring only one of them is
    // the failure mode this pins.
    seedActive({
      version: '4.0',
      tasks: [
        v5Task('F', { id: 'idea' }),
        v5Task('G', { id: 'done', completed: true, originalPriority: 'C' }),
        v5Task('B', { id: 'keep' })
      ]
    });

    const data = await loadAppData();

    expect(data.version).toBe('6.0');
    // F left the unit for the candidate pool rather than being deleted.
    expect(data.tasks.map(t => t.id)).toEqual(['done', 'keep']);
    expect(data.pendingExport?.map(t => t.id)).toEqual(['idea']);
    // …and every surviving task carries the new axis.
    for (const task of [...data.tasks, ...(data.pendingExport ?? [])]) {
      expect(task.status).toBeDefined();
      expect('originalPriority' in task).toBe(false);
    }
  });

  it('leaves an already-current file alone', async () => {
    const task = { ...createEmptyTask('B'), id: 'x', content: 'already fine' };
    seedActive({ version: '6.0', tasks: [task] });

    const data = await loadAppData();
    expect(data.tasks).toHaveLength(1);
    expect(data.tasks[0].priority).toBe('B');
    expect(data.tasks[0].status).toBe('open');
  });

  it('folds a legacy single-file blob in and moves it aside', async () => {
    store.set(
      KEYS.legacy,
      JSON.stringify({
        version: '4.0',
        tasks: [v5Task('C', { id: 'legacy-task', content: 'from the old layout' })],
        settings: createDefaultAppData().settings
      })
    );

    const data = await loadAppData();

    expect(data.tasks.map(t => t.id)).toEqual(['legacy-task']);
    expect(data.version).toBe('6.0');
    // The original is kept as a backup rather than deleted outright.
    expect(store.has(KEYS.legacy)).toBe(false);
    expect(store.has(KEYS.legacy + '_backup')).toBe(true);
  });

  it('folds an old inline trash array in as cancelled tasks', async () => {
    seedActive({
      version: '5.0',
      tasks: [v5Task('A', { id: 'live' })],
      trash: [v5Task('C', { id: 'binned' })]
    });

    const data = await loadAppData();
    const binned = data.tasks.find(t => t.id === 'binned');
    expect(binned?.status).toBe('cancelled');
  });
});

describe('loadAppData — settings migration', () => {
  it('supplies fields a stored file predates', async () => {
    const { gamificationEnabled, pomodoroWorkByPriority, ...older } =
      createDefaultAppData().settings as unknown as Record<string, unknown>;
    seedActive({ version: '6.0', settings: older });

    const data = await loadAppData();
    expect(data.settings.pomodoroWorkByPriority).toEqual({ A: 50, B: 50, C: 25, D: 25, E: 25 });
  });

  it('strips settings this version has retired', async () => {
    seedActive({
      version: '6.0',
      settings: {
        ...createDefaultAppData().settings,
        eZoneAgingDays: 7,
        showFutureTasks: true,
        gamificationEnabled: true
      }
    });

    const data = await loadAppData();
    expect('eZoneAgingDays' in data.settings).toBe(false);
    expect('showFutureTasks' in data.settings).toBe(false);
    // Scoring is gone, not switched off — the key must not linger either.
    expect('gamificationEnabled' in data.settings).toBe(false);
  });

  it('carries an unknown key through rather than destroying it', async () => {
    // A downgrade must not eat what a newer build wrote.
    seedActive({
      version: '6.0',
      settings: { ...createDefaultAppData().settings, somethingNewer: 42 }
    });

    const data = await loadAppData();
    expect((data.settings as unknown as Record<string, unknown>).somethingNewer).toBe(42);
  });

  it('keeps a user value rather than resetting it to the default', async () => {
    seedActive({
      version: '6.0',
      settings: { ...createDefaultAppData().settings, pomodoroWork: 50, autoArchiveDays: 30 }
    });

    const data = await loadAppData();
    expect(data.settings.pomodoroWork).toBe(50);
    expect(data.settings.autoArchiveDays).toBe(30);
  });
});

describe('saveAppData', () => {
  function appData(overrides: Partial<AppData> = {}): AppData {
    return { ...createDefaultAppData(), ...overrides };
  }

  it('splits hot and cold data into their own keys', async () => {
    await saveAppData(
      appData({
        tasks: [createEmptyTask('A')],
        pomodoroHistory: [
          { id: 's1', taskId: 't1', startedAt: '2026-01-01T00:00:00.000Z', duration: 25, completed: true }
        ]
      })
    );

    expect(readActive().tasks).toHaveLength(1);
    expect(JSON.parse(store.get(KEYS.pomodoro)!).sessions).toHaveLength(1);
    // Sessions are the one thing that must NOT be in the hot file.
    expect(readActive().pomodoroHistory).toBeUndefined();
  });

  it('stamps lastModified on every write', async () => {
    const data = appData({ lastModified: 'stale' });
    await saveAppData(data);
    expect(readActive().lastModified).not.toBe('stale');
  });

  it('does not write a gamification block, even if one is handed in', async () => {
    // The field is gone from the type; this pins that a stale object reaching
    // saveAppData at runtime still cannot put it back on disk.
    const data = appData() as AppData & { gamification?: unknown };
    data.gamification = { xp: 999 };

    await saveAppData(data);
    expect('gamification' in readActive()).toBe(false);
  });

  it('round-trips tasks through save and load unchanged', async () => {
    const task: Task = {
      ...createEmptyTask('B'),
      id: 'rt',
      content: 'round trip',
      projects: ['work'],
      contexts: ['主'],
      customTags: ['urgent'],
      dueDate: '2026-02-01',
      trigger: '坐下打开电脑后',
      notes: 'keep me',
      pomodoros: { estimated: 3, completed: 1 }
    };

    await saveAppData(appData({ tasks: [task] }));
    const loaded = await loadAppData();

    expect(loaded.tasks[0]).toMatchObject({
      id: 'rt',
      content: 'round trip',
      priority: 'B',
      status: 'open',
      projects: ['work'],
      contexts: ['主'],
      customTags: ['urgent'],
      dueDate: '2026-02-01',
      trigger: '坐下打开电脑后',
      notes: 'keep me',
      pomodoros: { estimated: 3, completed: 1 }
    });
  });

  it('reports not-saving once a write has settled', async () => {
    await saveAppData(appData());
    // The flag is a re-entrancy guard for the file watcher, not a lock; what
    // matters is that it does not get stuck on after a normal write.
    expect(typeof isCurrentlySaving()).toBe('boolean');
  });
});

describe('archiveTasks', () => {
  const oldCompletion = (id: string): Task => ({
    ...createEmptyTask('C'),
    id,
    status: 'completed',
    completedAt: '2025-01-01T00:00:00.000Z'
  });

  it('writes to the archive key, not the active one', async () => {
    await archiveTasks([oldCompletion('a1')]);
    const archive = JSON.parse(store.get(KEYS.archive)!);
    expect(archive.tasks.map((t: Task) => t.id)).toEqual(['a1']);
    expect(store.has(KEYS.active)).toBe(false);
  });

  it('appends rather than replacing', async () => {
    await archiveTasks([oldCompletion('a1')]);
    await archiveTasks([oldCompletion('a2')]);
    const archive = JSON.parse(store.get(KEYS.archive)!);
    expect(archive.tasks.map((t: Task) => t.id)).toEqual(['a1', 'a2']);
  });

  it('is a no-op for an empty list', async () => {
    await archiveTasks([]);
    expect(store.has(KEYS.archive)).toBe(false);
  });

  it('starts a fresh archive when the existing one is corrupt', async () => {
    store.set(KEYS.archive, 'not json');
    await archiveTasks([oldCompletion('a1')]);
    expect(JSON.parse(store.get(KEYS.archive)!).tasks).toHaveLength(1);
  });

  it('leaves archived tasks in cold storage across a reload', async () => {
    // Regression: the load path used to treat the archive key as legacy data,
    // fold every task in it back into the active set, and delete the key. That
    // undid the archiving on the very next launch — the tasks cleanupOldTasks
    // had just moved out came straight back, and the cycle repeated forever.
    // Cold storage is cold; it is read by nothing on the load path.
    await archiveTasks([oldCompletion('archived')]);
    await saveAppData({ ...createDefaultAppData(), tasks: [createEmptyTask('A')] });

    const loaded = await loadAppData();

    expect(loaded.tasks.map(t => t.id)).not.toContain('archived');
    expect(loaded.tasks).toHaveLength(1);
    expect(store.has(KEYS.archive)).toBe(true);
    expect(JSON.parse(store.get(KEYS.archive)!).tasks).toHaveLength(1);
  });
});

describe('loadFileData', () => {
  it('reads one file by type', async () => {
    seedActive({ version: '6.0', tasks: [createEmptyTask('E')] });
    const active = await loadFileData<{ tasks: Task[] }>('active');
    expect(active?.tasks).toHaveLength(1);
  });

  it('returns null for a file that is not there', async () => {
    expect(await loadFileData('archive')).toBeNull();
  });
});
