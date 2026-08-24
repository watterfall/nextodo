import { describe, it, expect } from 'vitest';
import { migrateToV6, resolveStatus } from './migrateV6';
import { createEmptyTask } from '$lib/types';

/**
 * A task as stored under data version 5.0: completion was a priority letter
 * ('G' / 'H') plus a `completed` boolean, and the tier it had before ending was
 * parked in `originalPriority`.
 */
function v5(priority: string, overrides: Record<string, unknown> = {}): unknown {
  const base = createEmptyTask('C') as unknown as Record<string, unknown>;
  delete base.status;
  return { ...base, priority, completed: false, ...overrides };
}

describe('resolveStatus', () => {
  it('maps an open tier straight through', () => {
    expect(resolveStatus({ priority: 'B' })).toEqual({ priority: 'B', status: 'open' });
  });

  it("puts a 'G' task's original tier back and marks it completed", () => {
    expect(resolveStatus({ priority: 'G', originalPriority: 'A', completed: true }))
      .toEqual({ priority: 'A', status: 'completed' });
  });

  it("maps 'H' to cancelled, keeping the tier", () => {
    expect(resolveStatus({ priority: 'H', originalPriority: 'D' }))
      .toEqual({ priority: 'D', status: 'cancelled' });
  });

  it('falls back to the default tier when originalPriority is missing', () => {
    expect(resolveStatus({ priority: 'G', completed: true }))
      .toEqual({ priority: 'C', status: 'completed' });
  });

  it('falls back when originalPriority names a letter that is not a tier', () => {
    // F/N/S were tiers two versions ago; a file that skipped the 5.0 step, or
    // was hand-edited, can still carry one.
    expect(resolveStatus({ priority: 'G', originalPriority: 'F', completed: true }))
      .toEqual({ priority: 'C', status: 'completed' });
  });

  it('honours a bare completed flag even when the priority is a live tier', () => {
    // Older CLI builds wrote `completed: true` alongside priority 'G'. A record
    // with one and not the other has to resolve to finished — the alternative
    // is resurrecting a task the user completed.
    expect(resolveStatus({ priority: 'B', completed: true }))
      .toEqual({ priority: 'B', status: 'completed' });
  });

  it('is idempotent on data that already has a status', () => {
    expect(resolveStatus({ priority: 'A', status: 'completed' }))
      .toEqual({ priority: 'A', status: 'completed' });
    expect(resolveStatus({ priority: 'E', status: 'open' }))
      .toEqual({ priority: 'E', status: 'open' });
  });

  it('clamps an unrecognised tier even on already-migrated data', () => {
    // Whatever the source, the result has to be indexable by every
    // Record<Priority, …> in the app.
    expect(resolveStatus({ priority: 'Z', status: 'open' }))
      .toEqual({ priority: 'C', status: 'open' });
  });

  it('treats an unrecognised status string as unmigrated rather than trusting it', () => {
    expect(resolveStatus({ priority: 'B', status: 'archived', completed: true }))
      .toEqual({ priority: 'B', status: 'completed' });
  });
});

describe('migrateToV6', () => {
  it('converts a whole 5.0 list without losing anything', () => {
    const input = [
      v5('A', { id: 'open-a' }),
      v5('G', { id: 'done-b', completed: true, originalPriority: 'B' }),
      v5('H', { id: 'dropped-e', originalPriority: 'E' }),
      v5('D', { id: 'open-d' })
    ];

    const { tasks, changed } = migrateToV6(input);

    expect(tasks.map(t => t.id)).toEqual(['open-a', 'done-b', 'dropped-e', 'open-d']);
    expect(tasks.map(t => [t.priority, t.status])).toEqual([
      ['A', 'open'],
      ['B', 'completed'],
      ['E', 'cancelled'],
      ['D', 'open']
    ]);
    expect(changed).toBe(true);
  });

  it('drops the two retired fields instead of carrying them forward', () => {
    const [task] = migrateToV6([
      v5('G', { id: 'x', completed: true, originalPriority: 'A' })
    ]).tasks;

    expect('completed' in task).toBe(false);
    expect('originalPriority' in task).toBe(false);
  });

  it('preserves every other field verbatim', () => {
    const [task] = migrateToV6([
      v5('G', {
        id: 'keep',
        content: 'finish report',
        completed: true,
        originalPriority: 'B',
        completedAt: '2026-01-07T09:00:00.000Z',
        projects: ['work'],
        contexts: ['主'],
        customTags: ['urgent'],
        dueDate: '2026-01-06',
        notes: 'some notes',
        trigger: '坐下打开电脑后',
        source: { file: '/tmp/todo.txt', raw: 'finish report +work', pulledAt: '2026-01-01T00:00:00.000Z' }
      })
    ]).tasks;

    expect(task.content).toBe('finish report');
    expect(task.projects).toEqual(['work']);
    expect(task.contexts).toEqual(['主']);
    expect(task.customTags).toEqual(['urgent']);
    expect(task.dueDate).toBe('2026-01-06');
    expect(task.notes).toBe('some notes');
    expect(task.trigger).toBe('坐下打开电脑后');
    expect(task.source?.raw).toBe('finish report +work');
    expect(task.completedAt).toBe('2026-01-07T09:00:00.000Z');
  });

  it('reports no change for data that is already 6.0', () => {
    const already = [createEmptyTask('A'), createEmptyTask('C')];
    const { tasks, changed } = migrateToV6(already);

    expect(changed).toBe(false);
    expect(tasks.map(t => [t.priority, t.status])).toEqual([['A', 'open'], ['C', 'open']]);
  });

  it('is idempotent — running it twice changes nothing the second time', () => {
    const input = [
      v5('G', { id: 'a', completed: true, originalPriority: 'A' }),
      v5('H', { id: 'b', originalPriority: 'E' }),
      v5('C', { id: 'c' })
    ];

    const once = migrateToV6(input);
    const twice = migrateToV6(once.tasks);

    expect(twice.changed).toBe(false);
    expect(twice.tasks).toEqual(once.tasks);
  });

  it('skips a null or non-object entry rather than throwing', () => {
    const { tasks, changed } = migrateToV6([null, v5('B', { id: 'ok' }), 'garbage']);
    expect(tasks.map(t => t.id)).toEqual(['ok']);
    expect(changed).toBe(true);
  });

  it('returns an empty list unchanged', () => {
    expect(migrateToV6([])).toEqual({ tasks: [], changed: false });
  });
});
