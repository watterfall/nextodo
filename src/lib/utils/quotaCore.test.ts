import { describe, it, expect } from 'vitest';
import {
  countActiveByPriority,
  getRemainingQuota,
  canAddTask,
  applyHighlanderRule,
  demotionTargetFor,
  getQuotaSummary,
  suggestPriority,
  canPromote,
  canDemote,
} from './quotaCore';
import { createEmptyTask } from '$lib/types';
import type { Task, Priority } from '$lib/types';

function task(priority: Priority, overrides: Partial<Task> = {}): Task {
  return { ...createEmptyTask(priority), ...overrides };
}

describe('countActiveByPriority', () => {
  it('counts non-completed active (A-F) tasks and ignores others', () => {
    const tasks = [
      task('A'),
      task('A', { completed: true }), // completed → excluded
      task('B'),
      task('C'),
      task('F'),
      task('F'),
      task('G'), // hidden → excluded
      task('N'), // not active → excluded
    ];
    expect(countActiveByPriority(tasks)).toEqual({ A: 1, B: 1, C: 1, D: 0, E: 0, F: 2 });
  });

  it('returns all zeros for an empty list', () => {
    expect(countActiveByPriority([])).toEqual({ A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 });
  });
});

describe('getRemainingQuota', () => {
  it('subtracts used counts from configured quotas', () => {
    const remaining = getRemainingQuota([task('A'), task('B'), task('B')]);
    expect(remaining.A).toBe(0); // quota 1, used 1
    expect(remaining.B).toBe(0); // quota 2, used 2
    expect(remaining.C).toBe(3);
    expect(remaining.D).toBe(4);
    expect(remaining.E).toBe(5);
    expect(remaining.F).toBe(Infinity);
  });

  it('never goes negative', () => {
    const remaining = getRemainingQuota([task('A'), task('A')]);
    expect(remaining.A).toBe(0);
  });
});

describe('canAddTask', () => {
  it('allows an active priority under quota', () => {
    expect(canAddTask([], 'A')).toBe(true);
  });

  it('rejects an active priority at quota', () => {
    expect(canAddTask([task('A')], 'A')).toBe(false);
  });

  it('always allows F (idea pool)', () => {
    const many = Array.from({ length: 50 }, () => task('F'));
    expect(canAddTask(many, 'F')).toBe(true);
  });

  it('always allows N (future) regardless of count', () => {
    expect(canAddTask([task('N'), task('N')], 'N')).toBe(true);
  });

  it('allows S only when no active S exists (quota 1)', () => {
    expect(canAddTask([], 'S')).toBe(true);
    expect(canAddTask([task('S')], 'S')).toBe(false);
    expect(canAddTask([task('S', { completed: true })], 'S')).toBe(true);
  });

  it('rejects hidden priorities', () => {
    expect(canAddTask([], 'G')).toBe(false);
    expect(canAddTask([], 'H')).toBe(false);
  });
});

describe('applyHighlanderRule', () => {
  it('demotes an existing active A to B when adding a new A', () => {
    const existingA = task('A', { id: 'a1' });
    const completedA = task('A', { id: 'a2', completed: true });
    const b = task('B', { id: 'b1' });
    const newA = task('A', { id: 'new' });

    const result = applyHighlanderRule([existingA, completedA, b], newA);
    expect(result.find((t) => t.id === 'a1')?.priority).toBe('B');
    expect(result.find((t) => t.id === 'a2')?.priority).toBe('A'); // completed untouched
    expect(result.find((t) => t.id === 'b1')?.priority).toBe('B');
  });

  it('demotes past a full tier instead of overfilling it', () => {
    // B is at its quota of 2, so the unseated A must land in C, not B×3.
    const existingA = task('A', { id: 'a1' });
    const board = [existingA, task('B', { id: 'b1' }), task('B', { id: 'b2' })];

    const result = applyHighlanderRule(board, task('A', { id: 'new' }));
    expect(result.find((t) => t.id === 'a1')?.priority).toBe('C');
    expect(result.filter((t) => t.priority === 'B')).toHaveLength(2);
  });

  it('falls back to the unbounded Idea Pool when B-E are all full', () => {
    const existingA = task('A', { id: 'a1' });
    const full = [
      existingA,
      ...Array.from({ length: 2 }, (_, i) => task('B', { id: `b${i}` })),
      ...Array.from({ length: 3 }, (_, i) => task('C', { id: `c${i}` })),
      ...Array.from({ length: 4 }, (_, i) => task('D', { id: `d${i}` })),
      ...Array.from({ length: 5 }, (_, i) => task('E', { id: `e${i}` })),
    ];

    const result = applyHighlanderRule(full, task('A', { id: 'new' }));
    expect(result.find((t) => t.id === 'a1')?.priority).toBe('F');
  });

  it('unseats an incumbent S the same way it unseats an incumbent A', () => {
    // S is single-slot like A. Adding a second one must demote the incumbent,
    // not be refused — S used to be the one tier where the add was rejected.
    const existingS = task('S', { id: 's1' });
    const result = applyHighlanderRule([existingS, task('C', { id: 'c1' })], task('S', { id: 'new' }));
    expect(result.find((t) => t.id === 's1')?.priority).toBe('B');
  });

  it('leaves the other single-slot tier alone', () => {
    // Adding an S must not disturb the day's A, and vice versa.
    const board = [task('A', { id: 'a1' }), task('S', { id: 's1' })];
    expect(applyHighlanderRule(board, task('S', { id: 'new' })).find((t) => t.id === 'a1')?.priority).toBe('A');
    expect(applyHighlanderRule(board, task('A', { id: 'new' })).find((t) => t.id === 's1')?.priority).toBe('S');
  });

  it('ignores tiers that are not single-slot', () => {
    const board = [task('C', { id: 'c1' })];
    expect(applyHighlanderRule(board, task('C', { id: 'new' })).find((t) => t.id === 'c1')?.priority).toBe('C');
  });

  it('shares its demotion target with the S (sustained) Highlander', () => {
    // Both A and S are single-slot. demotionTargetFor is the one place that
    // decides where an unseated incumbent lands, so the two rules cannot drift.
    expect(demotionTargetFor([])).toBe('B');
    expect(demotionTargetFor([task('B', { id: 'b1' }), task('B', { id: 'b2' })])).toBe('C');
    expect(
      demotionTargetFor([
        ...Array.from({ length: 2 }, (_, i) => task('B', { id: `b${i}` })),
        ...Array.from({ length: 3 }, (_, i) => task('C', { id: `c${i}` })),
        ...Array.from({ length: 4 }, (_, i) => task('D', { id: `d${i}` })),
        ...Array.from({ length: 5 }, (_, i) => task('E', { id: `e${i}` })),
      ])
    ).toBe('F');
  });

  it('does not touch the new task itself', () => {
    const newA = task('A', { id: 'new' });
    const result = applyHighlanderRule([newA], newA);
    expect(result.find((t) => t.id === 'new')?.priority).toBe('A');
  });

  it('returns the array unchanged when the new task is not A', () => {
    const tasks = [task('A'), task('B')];
    expect(applyHighlanderRule(tasks, task('C'))).toBe(tasks);
  });
});

describe('getQuotaSummary', () => {
  it('reports usage and full flags for A-F', () => {
    const summary = getQuotaSummary([task('A'), task('C')]);
    expect(summary).toHaveLength(6);
    const a = summary.find((s) => s.priority === 'A')!;
    expect(a.used).toBe(1);
    expect(a.quota).toBe(1);
    expect(a.isFull).toBe(true);
    const f = summary.find((s) => s.priority === 'F')!;
    expect(f.isFull).toBe(false);
  });
});

describe('suggestPriority', () => {
  it('suggests the lowest priority with room first (E when empty)', () => {
    expect(suggestPriority([])).toBe('E');
  });

  it('skips a full priority and suggests the next available', () => {
    const fullE = Array.from({ length: 5 }, () => task('E'));
    expect(suggestPriority(fullE)).toBe('D');
  });

  it('falls back to F when A-E are all full', () => {
    const tasks = [
      task('A'),
      task('B'), task('B'),
      task('C'), task('C'), task('C'),
      task('D'), task('D'), task('D'), task('D'),
      task('E'), task('E'), task('E'), task('E'), task('E'),
    ];
    expect(suggestPriority(tasks)).toBe('F');
  });
});

describe('canPromote / canDemote', () => {
  it('promotes C to B when B has room', () => {
    expect(canPromote([], task('C'))).toEqual({ canPromote: true, targetPriority: 'B' });
  });

  it('cannot promote A (already top)', () => {
    expect(canPromote([], task('A'))).toEqual({ canPromote: false, targetPriority: null });
  });

  it('always allows promoting B to A (Highlander applies)', () => {
    const fullA = [task('A')];
    expect(canPromote(fullA, task('B'))).toEqual({ canPromote: true, targetPriority: 'A' });
  });

  it('cannot promote C when the target B is full', () => {
    const fullB = [task('B'), task('B')];
    expect(canPromote(fullB, task('C'))).toEqual({ canPromote: false, targetPriority: null });
  });

  it('demotes A to B and refuses to demote F (bottom)', () => {
    expect(canDemote(task('A'))).toEqual({ canDemote: true, targetPriority: 'B' });
    expect(canDemote(task('F'))).toEqual({ canDemote: false, targetPriority: null });
  });

  it('refuses promote/demote on a non-active priority', () => {
    expect(canPromote([], task('G'))).toEqual({ canPromote: false, targetPriority: null });
    expect(canDemote(task('G'))).toEqual({ canDemote: false, targetPriority: null });
  });
});
