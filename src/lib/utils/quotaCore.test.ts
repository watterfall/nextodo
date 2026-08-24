import { describe, it, expect } from 'vitest';
import {
  countActiveByPriority,
  getRemainingQuota,
  canAddTask,
  applyHighlanderRule,
  demotionTargetFor,
  isSingleSlotPriority,
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

/** A board with every tier at quota: A1 B2 C3 D4 E5 = 15 tasks, the whole unit. */
function fullBoard(): Task[] {
  return [
    task('A', { id: 'a0' }),
    ...Array.from({ length: 2 }, (_, i) => task('B', { id: `b${i}` })),
    ...Array.from({ length: 3 }, (_, i) => task('C', { id: `c${i}` })),
    ...Array.from({ length: 4 }, (_, i) => task('D', { id: `d${i}` })),
    ...Array.from({ length: 5 }, (_, i) => task('E', { id: `e${i}` })),
  ];
}

describe('countActiveByPriority', () => {
  it('counts non-completed A-E tasks and ignores hidden ones', () => {
    const tasks = [
      task('A'),
      task('A', { completed: true }), // completed → excluded
      task('B'),
      task('C'),
      task('G'), // hidden → excluded
      task('H'), // hidden → excluded
    ];
    expect(countActiveByPriority(tasks)).toEqual({ A: 1, B: 1, C: 1, D: 0, E: 0 });
  });

  it('returns all zeros for an empty list', () => {
    expect(countActiveByPriority([])).toEqual({ A: 0, B: 0, C: 0, D: 0, E: 0 });
  });
});

describe('getRemainingQuota', () => {
  it('subtracts used counts from configured quotas', () => {
    const remaining = getRemainingQuota([task('A'), task('B'), task('B')]);
    expect(remaining).toEqual({ A: 0, B: 0, C: 3, D: 4, E: 5 });
  });

  it('never goes negative', () => {
    // An explicit restore is allowed to put a tier over quota; readers must
    // report "full", not a negative number.
    expect(getRemainingQuota([task('A'), task('A')]).A).toBe(0);
  });
});

describe('canAddTask', () => {
  it('allows a tier under quota and refuses one at quota', () => {
    expect(canAddTask([], 'A')).toBe(true);
    expect(canAddTask([task('A')], 'A')).toBe(false);
    expect(canAddTask([task('E'), task('E')], 'E')).toBe(true);
  });

  it('refuses hidden priorities', () => {
    expect(canAddTask([], 'G')).toBe(false);
    expect(canAddTask([], 'H')).toBe(false);
  });

  it('has no unbounded tier left to absorb an overflow', () => {
    // F used to answer true here no matter what. The unit is now finite: 15
    // tasks and nothing more fits.
    const board = fullBoard();
    for (const priority of ['A', 'B', 'C', 'D', 'E'] as Priority[]) {
      expect(canAddTask(board, priority), priority).toBe(false);
    }
  });
});

describe('isSingleSlotPriority', () => {
  it('is A and nothing else', () => {
    expect(isSingleSlotPriority('A')).toBe(true);
    // S was the other one; the week's sustained project is a +project tag now.
    expect(isSingleSlotPriority('B')).toBe(false);
    expect(isSingleSlotPriority('E')).toBe(false);
    expect(isSingleSlotPriority('G')).toBe(false);
  });
});

describe('demotionTargetFor', () => {
  it('picks the highest tier that still has room', () => {
    expect(demotionTargetFor([])).toBe('B');
    expect(demotionTargetFor([task('B'), task('B')])).toBe('C');
  });

  it('returns null when every lower tier is full', () => {
    // This used to be impossible: the ladder ended at F, the unbounded Idea
    // Pool. Callers now have to handle "nowhere to put it".
    const noRoom = fullBoard().filter(t => t.id !== 'a0');
    expect(demotionTargetFor(noRoom)).toBeNull();
  });
});

describe('applyHighlanderRule', () => {
  it('demotes an existing active A to B when adding a new A', () => {
    const existingA = task('A', { id: 'a1' });
    const completedA = task('A', { id: 'a2', completed: true });
    const b = task('B', { id: 'b1' });

    const result = applyHighlanderRule([existingA, completedA, b], task('A', { id: 'new' }));
    expect(result.tasks.find((t) => t.id === 'a1')?.priority).toBe('B');
    expect(result.tasks.find((t) => t.id === 'a2')?.priority).toBe('A'); // completed untouched
    expect(result.tasks.find((t) => t.id === 'b1')?.priority).toBe('B');
    expect(result.demoted).toEqual([{ task: expect.objectContaining({ id: 'a1' }), to: 'B' }]);
    expect(result.evicted).toEqual([]);
  });

  it('demotes past a full tier instead of overfilling it', () => {
    // B is at its quota of 2, so the unseated A must land in C, not B×3.
    const board = [task('A', { id: 'a1' }), task('B', { id: 'b1' }), task('B', { id: 'b2' })];

    const result = applyHighlanderRule(board, task('A', { id: 'new' }));
    expect(result.tasks.find((t) => t.id === 'a1')?.priority).toBe('C');
    expect(result.tasks.filter((t) => t.priority === 'B')).toHaveLength(2);
  });

  it('evicts the incumbent when no tier has room', () => {
    // The unit is full, so the unseated A goes back to the candidate pool
    // rather than pushing a tier over quota. The caller has to report this or
    // the task looks like it vanished.
    const board = fullBoard();
    const result = applyHighlanderRule(board, task('A', { id: 'new' }));

    expect(result.evicted.map((t) => t.id)).toEqual(['a0']);
    expect(result.tasks.find((t) => t.id === 'a0')).toBeUndefined();
    expect(result.tasks).toHaveLength(board.length - 1);
    expect(result.demoted).toEqual([]);
  });

  it('ignores tiers that are not single-slot', () => {
    const board = [task('C', { id: 'c1' })];
    const result = applyHighlanderRule(board, task('C', { id: 'new' }));
    expect(result.tasks).toBe(board);
    expect(result.demoted).toEqual([]);
    expect(result.evicted).toEqual([]);
  });

  it('does not touch the new task itself', () => {
    const newA = task('A', { id: 'new' });
    expect(applyHighlanderRule([newA], newA).tasks.find((t) => t.id === 'new')?.priority).toBe('A');
  });
});

describe('getQuotaSummary', () => {
  it('reports usage and full flags for A-E', () => {
    const summary = getQuotaSummary([task('A'), task('C')]);
    expect(summary).toHaveLength(5);

    const a = summary.find((s) => s.priority === 'A')!;
    expect(a).toMatchObject({ used: 1, quota: 1, isFull: true });

    const e = summary.find((s) => s.priority === 'E')!;
    expect(e).toMatchObject({ used: 0, quota: 5, isFull: false });
  });
});

describe('suggestPriority', () => {
  it('suggests the lowest priority with room first (E when empty)', () => {
    expect(suggestPriority([])).toBe('E');
  });

  it('skips a full priority and suggests the next available', () => {
    expect(suggestPriority(Array.from({ length: 5 }, () => task('E')))).toBe('D');
  });

  it('returns null when the whole unit is full', () => {
    // The honest answer, now that there is no Idea Pool to sweep it into.
    expect(suggestPriority(fullBoard())).toBeNull();
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
    expect(canPromote([task('A')], task('B'))).toEqual({ canPromote: true, targetPriority: 'A' });
  });

  it('cannot promote C when the target B is full', () => {
    expect(canPromote([task('B'), task('B')], task('C'))).toEqual({
      canPromote: false,
      targetPriority: null,
    });
  });

  it('demotes A to B and refuses to demote E (now the bottom tier)', () => {
    expect(canDemote(task('A'))).toEqual({ canDemote: true, targetPriority: 'B' });
    expect(canDemote(task('E'))).toEqual({ canDemote: false, targetPriority: null });
  });

  it('refuses promote/demote on a hidden priority', () => {
    expect(canPromote([], task('G'))).toEqual({ canPromote: false, targetPriority: null });
    expect(canDemote(task('G'))).toEqual({ canDemote: false, targetPriority: null });
  });
});
