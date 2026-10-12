import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { createDefaultActiveData, createEmptyTask, type Task } from '$lib/types';
import { initializeData, getTasksStore, addTask, completeTask, cancelTask, evolveTask, exportPendingTasks } from './tasks.svelte';

let files: Map<string, string>;
let failKey: string | null;
const active = () => JSON.parse(files.get('focusflow_active')!);
function seed(tasks: Task[]) {
  files.set('focusflow_active', JSON.stringify({ ...createDefaultActiveData(), tasks }));
}
beforeEach(() => {
  files = new Map(); failKey = null;
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => files.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (key === failKey) throw new Error('simulated write failure');
      files.set(key, value);
    }
  });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('task mutations and durable storage', () => {
  it('retains the active record when archive writing fails', async () => {
    const task = { ...createEmptyTask('B'), status: 'completed' as const, completedAt: '2020-01-01T00:00:00Z' };
    seed([task]); failKey = 'focusflow_archive';
    await initializeData();
    expect(active().tasks.map((t: Task) => t.id)).toContain(task.id);
    expect(getTasksStore().tasks.map(t => t.id)).toContain(task.id);
    expect(getTasksStore().lastError).toBeTruthy();
  });
  it('can retry an interrupted archive transfer without duplicating tasks', async () => {
    const task = { ...createEmptyTask('B'), status: 'completed' as const, completedAt: '2020-01-01T00:00:00Z' };
    seed([task]); failKey = 'focusflow_active';
    await initializeData();
    expect(active().tasks).toHaveLength(1);
    expect(JSON.parse(files.get('focusflow_archive')!).tasks).toHaveLength(1);
    failKey = null; await initializeData();
    expect(active().tasks).toHaveLength(0);
    expect(JSON.parse(files.get('focusflow_archive')!).tasks).toHaveLength(1);
  });
  it('reports a failed add, rolls it back, and allows exactly one successful retry', async () => {
    seed([]); await initializeData(); failKey = 'focusflow_active';
    expect((await addTask('retry me !C')).success).toBe(false);
    expect(getTasksStore().tasks).toHaveLength(0);
    expect(active().tasks).toHaveLength(0);
    failKey = null;
    expect((await addTask('retry me !C')).success).toBe(true);
    expect(active().tasks).toHaveLength(1);
  });
  it('does not write completion to the source file when the local save fails', async () => {
    const task = createEmptyTask('B');
    task.source = { file: '/audit/todo.txt', raw: 'source task', pulledAt: new Date().toISOString() };
    seed([task]); files.set('focusflow_todofile:/audit/todo.txt', 'source task\n');
    await initializeData(); failKey = 'focusflow_active';
    await expect(completeTask(task.id)).rejects.toThrow('simulated');
    expect(getTasksStore().tasks[0].status).toBe('open');
    expect(files.get('focusflow_todofile:/audit/todo.txt')).toBe('source task\n');
  });
  it('preserves an unsourced evicted A across a reload', async () => {
    const tasks: Task[] = [];
    for (const [p, n] of Object.entries({ A: 1, B: 2, C: 3, D: 4, E: 5 })) {
      for (let i = 0; i < n; i++) tasks.push(createEmptyTask(p as Task['priority']));
    }
    const old = tasks[0]; seed(tasks); await initializeData();
    expect((await addTask('new A !A')).success).toBe(true);
    expect(active().pendingExport.map((t: Task) => t.id)).toContain(old.id);
    await initializeData();
    expect(getTasksStore().pendingExport.map(t => t.id)).toContain(old.id);
  });
  it('retries pending export without losing the queue or duplicating lines', async () => {
    const data = createDefaultActiveData();
    data.pendingExport = [{ ...createEmptyTask('A'), content: 'retained work' }];
    data.settings.todoFilePath = '/audit/todo.txt';
    files.set('focusflow_active', JSON.stringify(data)); await initializeData();
    failKey = 'focusflow_active';
    expect((await exportPendingTasks()).error).toBeTruthy();
    expect(getTasksStore().pendingExport).toHaveLength(1);
    const firstWrite = files.get('focusflow_todofile:/audit/todo.txt');
    expect(firstWrite).toContain('retained work');
    failKey = null;
    expect((await exportPendingTasks()).exported).toBe(1);
    expect(files.get('focusflow_todofile:/audit/todo.txt')).toBe(firstWrite);
    expect(getTasksStore().pendingExport).toHaveLength(0);
    expect(active().pendingExport).toBeUndefined();
  });
  it('a failed queued edit does not discard the following successful edit', async () => {
    seed([]); await initializeData();
    const set = localStorage.setItem;
    let failed = false;
    localStorage.setItem = (key, value) => {
      if (key === 'focusflow_active' && !failed) { failed = true; throw new Error('once'); }
      set(key, value);
    };
    const results = await Promise.all([addTask('failed !B'), addTask('saved !B')]);
    expect(results.map(r => r.success)).toEqual([false, true]);
    expect(active().tasks.map((t: Task) => t.content)).toEqual(['saved']);
  });
  it('serializes concurrent adds and keeps both changes', async () => {
    seed([]); await initializeData();
    const results = await Promise.all([addTask('first !B'), addTask('second !B')]);
    expect(results.every(r => r.success)).toBe(true);
    expect(active().tasks.map((t: Task) => t.content)).toEqual(['first', 'second']);
  });
  it('cancels and evolves via status without retired priority letters', async () => {
    const cancelled = createEmptyTask('B'), evolved = createEmptyTask('C');
    seed([cancelled, evolved]); await initializeData();
    await cancelTask(cancelled.id); await evolveTask(evolved.id, 'next');
    expect(active().tasks.find((t: Task) => t.id === cancelled.id)).toMatchObject({ priority: 'B', status: 'cancelled' });
    expect(active().tasks.find((t: Task) => t.id === evolved.id)).toMatchObject({ priority: 'C', status: 'completed' });
    expect(active().tasks.find((t: Task) => t.content === 'next')).toMatchObject({ priority: 'C', status: 'open' });
  });
});

it('persists optional planning data and per-window budgets across reloads', async () => {
  const { setUnitCapacity, updateTask } = await import('./tasks.svelte');
  seed([]); await initializeData();
  await addTask('A concrete step !C', false, { estimatedMinutes: 35, nextAction: 'Open the draft' });
  const task = getTasksStore().tasks[0];
  await updateTask(task.id, { resumeNote: 'Continue paragraph 3' });
  await setUnitCapacity('2026-10-12', 90);
  await setUnitCapacity('2026-10-14', 0);
  await initializeData();
  expect(getTasksStore().tasks[0]).toMatchObject({ estimatedMinutes: 35, nextAction: 'Open the draft', resumeNote: 'Continue paragraph 3', committedAt: expect.any(String) });
  expect(getTasksStore().unitPlans).toEqual({ '2026-10-12': { availableMinutes: 90 }, '2026-10-14': { availableMinutes: 0 } });
});

it('rolls back failed capacity and resume-note writes without losing existing values', async () => {
  const { setUnitCapacity, updateTask } = await import('./tasks.svelte');
  const task = { ...createEmptyTask(), resumeNote: 'Saved instruction' };
  seed([task]); await initializeData(); await setUnitCapacity('2026-10-12', 90);
  failKey = 'focusflow_active';
  await expect(setUnitCapacity('2026-10-12', 45)).rejects.toThrow();
  await expect(updateTask(task.id, { resumeNote: 'Unwritten instruction' })).rejects.toThrow();
  expect(getTasksStore().unitPlans['2026-10-12'].availableMinutes).toBe(90);
  expect(getTasksStore().tasks[0].resumeNote).toBe('Saved instruction');
});
