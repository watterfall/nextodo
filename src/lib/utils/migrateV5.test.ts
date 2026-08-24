import { describe, it, expect } from 'vitest';
import { migrateToV5, slugifyProject } from './migrateV5';
import type { V5Task } from './migrateV5';
import { createEmptyTask } from '$lib/types';

/**
 * A task as it was stored under data version 4.0, when F / N / S were real
 * tiers and subtasks were embedded. The current Priority union does not admit
 * those letters, which is the whole point — the migration reads them as data.
 */
function legacy(priority: string, overrides: Record<string, unknown> = {}): unknown {
  return { ...createEmptyTask('C'), priority, ...overrides };
}

function ids(tasks: V5Task[]): string[] {
  return tasks.map((t) => t.id).sort();
}

describe('slugifyProject', () => {
  it('produces something todo.txt can hold as a +project', () => {
    expect(slugifyProject('rewrite the exporter')).toBe('rewrite-the-exporter');
    expect(slugifyProject('  spaced  out  ')).toBe('spaced-out');
    expect(slugifyProject('重写导出器')).toBe('重写导出器');
  });

  it('strips sigils that would re-parse as a different tag', () => {
    expect(slugifyProject('+work @home #tag')).toBe('work-home-tag');
  });

  it('never returns an empty name', () => {
    expect(slugifyProject('')).toBe('focus');
    expect(slugifyProject('   ')).toBe('focus');
  });
});

describe('migrateToV5', () => {
  it('leaves A-E, G and H tasks in the unit untouched', () => {
    const keep = ['A', 'B', 'C', 'D', 'E', 'G', 'H'].map((p) => legacy(p, { id: `t${p}` }));
    const result = migrateToV5(keep);

    expect(ids(result.tasks)).toEqual(['tA', 'tB', 'tC', 'tD', 'tE', 'tG', 'tH']);
    expect(result.pendingExport).toEqual([]);
    expect(result.changed).toBe(false);
  });

  it('moves F and N tasks to the candidate pool instead of deleting them', () => {
    const result = migrateToV5([
      legacy('F', { id: 'idea', content: 'someday maybe' }),
      legacy('N', { id: 'later', content: 'learn rust', thresholdDate: '2026-06-01' }),
      legacy('C', { id: 'keep' }),
    ]);

    expect(ids(result.tasks)).toEqual(['keep']);
    expect(ids(result.pendingExport)).toEqual(['idea', 'later']);
    // Nothing is lost — the threshold date rides along so the exporter can
    // write it back out as `t:`.
    expect(result.pendingExport.find((t) => t.id === 'later')?.thresholdDate).toBe('2026-06-01');
    expect(result.changed).toBe(true);
  });

  it('lifts the S task’s project into focusProject and keeps the task', () => {
    const result = migrateToV5([
      legacy('S', { id: 'sustained', content: 'rewrite exporter', projects: ['exporter'] }),
    ]);

    expect(result.focusProject).toBe('exporter');
    expect(ids(result.tasks)).toEqual(['sustained']);
    expect(result.tasks[0].priority).toBe('B'); // highest tier with room
    expect(result.tasks[0].projects).toContain('exporter');
  });

  it('invents a project name when the S task had none', () => {
    const result = migrateToV5([legacy('S', { id: 's', content: 'rewrite exporter', projects: [] })]);
    expect(result.focusProject).toBe('rewrite-exporter');
    expect(result.tasks[0].projects).toEqual(['rewrite-exporter']);
  });

  it('respects a focusProject the user already set', () => {
    const result = migrateToV5(
      [legacy('S', { id: 's', content: 'thing', projects: ['other'] })],
      'already-chosen'
    );
    expect(result.focusProject).toBe('already-chosen');
  });

  it('turns the S task’s subtasks into real tasks in the candidate pool', () => {
    const result = migrateToV5([
      legacy('S', {
        id: 'sustained',
        content: 'rewrite exporter',
        projects: ['exporter'],
        contexts: ['office'],
        subtasks: [
          { id: 'sub1', content: 'unpick the old logic', completed: true, completedAt: '2026-01-05T00:00:00' },
          { id: 'sub2', content: 'write the encoder', completed: false },
        ],
      }),
    ]);

    expect(ids(result.pendingExport)).toEqual(['sub1', 'sub2']);

    const sub1 = result.pendingExport.find((t) => t.id === 'sub1')!;
    expect(sub1.content).toBe('unpick the old logic');
    expect(sub1.completed).toBe(true);
    // They carry the focus project, so the grouping the checklist provided is
    // preserved — and each can now hold its own priority, due date and estimate.
    expect(sub1.projects).toContain('exporter');
    expect(sub1.contexts).toContain('office');
    expect(sub1.evolvedFrom).toBe('sustained');

    // The parent keeps no embedded checklist.
    expect((result.tasks[0] as unknown as Record<string, unknown>).subtasks).toBeUndefined();
  });

  it('sends the S task to the candidate pool when the unit is already full', () => {
    // B-E all at quota, so demotionTargetFor has nowhere to put it.
    const full = [
      ...Array.from({ length: 2 }, (_, i) => legacy('B', { id: `b${i}` })),
      ...Array.from({ length: 3 }, (_, i) => legacy('C', { id: `c${i}` })),
      ...Array.from({ length: 4 }, (_, i) => legacy('D', { id: `d${i}` })),
      ...Array.from({ length: 5 }, (_, i) => legacy('E', { id: `e${i}` })),
    ];
    const result = migrateToV5([...full, legacy('S', { id: 'sustained', content: 'thing' })]);

    expect(ids(result.pendingExport)).toEqual(['sustained']);
    expect(result.tasks.find((t) => t.id === 'sustained')).toBeUndefined();
  });

  it('strips a leftover subtask array off an ordinary task', () => {
    const result = migrateToV5([
      legacy('C', { id: 'c', subtasks: [{ id: 'x', content: 'y', completed: false }] }),
    ]);
    expect((result.tasks[0] as unknown as Record<string, unknown>).subtasks).toBeUndefined();
    expect(result.changed).toBe(true);
  });

  it('rewrites an originalPriority that names a tier 5.0 no longer had', () => {
    // Otherwise a completed task vanishes from the retention display, because
    // it is grouped by a key nothing renders.
    const result = migrateToV5([legacy('G', { id: 'done', completed: true, originalPriority: 'F' })]);
    expect(result.tasks[0].originalPriority).toBe('C');
  });

  it('rescues a task whose priority letter is not recognised at all', () => {
    // A letter no view and no predicate matches would make the task invisible
    // rather than deleted, which is worse: the user cannot even find it.
    const result = migrateToV5([legacy('Q', { id: 'weird' })]);
    expect(ids(result.pendingExport)).toEqual(['weird']);
    expect(result.tasks).toEqual([]);
  });

  it('accounts for every input task exactly once', () => {
    const input = [
      legacy('A', { id: 'a' }),
      legacy('F', { id: 'f' }),
      legacy('N', { id: 'n' }),
      legacy('G', { id: 'g', completed: true }),
      legacy('S', {
        id: 's',
        content: 'proj',
        subtasks: [{ id: 'sub', content: 'step', completed: false }],
      }),
    ];
    const result = migrateToV5(input);

    // 5 in, 6 out — the extra one is the promoted subtask. Deleting a tier must
    // never delete data.
    expect(ids([...result.tasks, ...result.pendingExport])).toEqual(['a', 'f', 'g', 'n', 's', 'sub']);
  });

  it('is a no-op on data that has already been migrated', () => {
    const clean = ['A', 'C', 'G'].map((p) => legacy(p, { id: `t${p}` }));
    const once = migrateToV5(clean);
    const twice = migrateToV5(once.tasks as unknown[]);

    expect(ids(twice.tasks)).toEqual(ids(once.tasks));
    expect(twice.pendingExport).toEqual([]);
    expect(twice.changed).toBe(false);
  });
});
