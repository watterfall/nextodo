import { describe, it, expect } from 'vitest';
import {
  weightedCompletionForPeriod,
  evaluateCycle,
  rollUnfinishedIntoWindow,
} from './cycleEngine';
import { createDefaultAppData, createEmptyTask } from '$lib/types';
import type { Task, Priority } from '$lib/types';

function task(priority: Priority, overrides: Partial<Task> = {}): Task {
  return { ...createEmptyTask(priority), ...overrides };
}

// Reference dates (local; the suite runs in two zones, see vitest.config):
//   Monday 2026-01-05 → Unit 1 (start 2026-01-05, end 2026-01-06)
//   Wednesday 2026-01-07 → Unit 2 (start 2026-01-07, end 2026-01-08)
//   Sunday 2026-01-11 → review day

describe('weightedCompletionForPeriod', () => {
  it('scores priority-weighted completion of a period', () => {
    const openA = task('A', { unitStart: '2026-01-05' }); // weight 5, not done
    const doneA = task('A', { unitStart: '2026-01-05', status: 'completed' }); // weight 5, done
    expect(weightedCompletionForPeriod([openA, doneA], '2026-01-05')).toBeCloseTo(0.5);
  });

  it('returns 1 when everything planned is done', () => {
    const doneC = task('C', { unitStart: '2026-01-05', status: 'completed' });
    expect(weightedCompletionForPeriod([doneC], '2026-01-05')).toBeCloseTo(1);
  });

  it('returns null when nothing A-F was planned', () => {
    expect(weightedCompletionForPeriod([], '2026-01-05')).toBeNull();
    const cancelled = task('C', { unitStart: '2026-01-05', status: 'cancelled' });
    expect(weightedCompletionForPeriod([cancelled], '2026-01-05')).toBeNull();
  });

  it('ignores tasks belonging to a different period', () => {
    const other = task('A', { unitStart: '2026-01-07' });
    expect(weightedCompletionForPeriod([other], '2026-01-05')).toBeNull();
  });
});

describe('rollUnfinishedIntoWindow', () => {
  it('moves only open active tasks of the given period into the window', () => {
    const openA = task('A', { id: 'open', unitStart: '2026-01-05' });
    const doneA = task('A', { id: 'done', unitStart: '2026-01-05', status: 'completed' });
    const other = task('B', { id: 'other', unitStart: '2026-01-07' });

    const result = rollUnfinishedIntoWindow(
      [openA, doneA, other],
      '2026-01-05',
      '2026-01-07',
      '2026-01-08'
    );

    const moved = result.find((t) => t.id === 'open')!;
    expect(moved.unitStart).toBe('2026-01-07');
    expect(moved.unitOverride?.extendedUntil).toBe('2026-01-08');
    expect(result.find((t) => t.id === 'done')!.unitStart).toBe('2026-01-05'); // completed → stays
    expect(result.find((t) => t.id === 'other')!.unitStart).toBe('2026-01-07'); // other period → unchanged
  });
});

describe('evaluateCycle', () => {
  it('is a no-op on the review day (Sunday)', () => {
    const app = createDefaultAppData();
    const res = evaluateCycle(app, new Date(2026, 0, 11, 12, 0, 0));
    expect(res).toEqual({ changed: false, merged: false });
    expect(app.cycleState).toBeUndefined();
  });

  it('seeds cycle state on the first run', () => {
    const app = createDefaultAppData();
    const res = evaluateCycle(app, new Date(2026, 0, 5, 12, 0, 0));
    expect(res).toEqual({ changed: true, merged: false });
    expect(app.cycleState?.anchorStart).toBe('2026-01-05');
    expect(app.cycleState?.windowEnd).toBe('2026-01-06');
    expect(app.cycleState?.lastEvaluatedStart).toBe('');
  });

  it('does nothing while still inside the same window', () => {
    const app = createDefaultAppData();
    app.cycleState = {
      anchorStart: '2026-01-05',
      windowEnd: '2026-01-06',
      merged: false,
      lastEvaluatedStart: '',
    };
    const res = evaluateCycle(app, new Date(2026, 0, 5, 12, 0, 0));
    expect(res).toEqual({ changed: false, merged: false });
  });

  it('auto-merges an under-completed period when prompting is off', () => {
    const app = createDefaultAppData();
    app.settings.lowCompletionPrompt = false;
    app.cycleState = {
      anchorStart: '2026-01-05',
      windowEnd: '2026-01-06',
      merged: false,
      lastEvaluatedStart: '2025-12-01',
    };
    app.tasks = [task('A', { id: 'roll', unitStart: '2026-01-05' })];

    const res = evaluateCycle(app, new Date(2026, 0, 7, 12, 0, 0)); // Wednesday → new window
    expect(res).toEqual({ changed: true, merged: true });
    expect(app.tasks[0].unitStart).toBe('2026-01-07'); // rolled forward
    expect(app.tasks[0].unitOverride?.extendedUntil).toBe('2026-01-08');
    expect(app.cycleState?.anchorStart).toBe('2026-01-07');
    expect(app.cycleHistory?.some((h) => h.periodStart === '2026-01-05' && h.merged)).toBe(true);
  });

  it('defers the merge (pendingReview) when prompting is on', () => {
    const app = createDefaultAppData();
    app.settings.lowCompletionPrompt = true;
    app.cycleState = {
      anchorStart: '2026-01-05',
      windowEnd: '2026-01-06',
      merged: false,
      lastEvaluatedStart: '2025-12-01',
    };
    app.tasks = [task('A', { id: 'roll', unitStart: '2026-01-05' })];

    const res = evaluateCycle(app, new Date(2026, 0, 7, 12, 0, 0));
    expect(res).toEqual({ changed: true, merged: false });
    expect(app.tasks[0].unitStart).toBe('2026-01-05'); // NOT moved yet
    expect(app.cycleState?.pendingReview?.periodStart).toBe('2026-01-05');
  });

  it('keeps an unresolved pendingReview when the next period scores fine', () => {
    const app = createDefaultAppData();
    app.settings.lowCompletionPrompt = true;
    app.cycleState = {
      anchorStart: '2026-01-07',
      windowEnd: '2026-01-08',
      merged: false,
      lastEvaluatedStart: '2025-12-01',
      pendingReview: { periodStart: '2026-01-05', completion: 0.2 },
    };
    // Unit 2 finished everything, so nothing new is flagged...
    app.tasks = [task('A', { unitStart: '2026-01-07', status: 'completed' })];

    evaluateCycle(app, new Date(2026, 0, 9, 12, 0, 0)); // Friday → new window
    // ...but the banner the user never answered must survive, or Unit 1's
    // unfinished tasks are stranded in a window that no longer displays.
    expect(app.cycleState?.pendingReview?.periodStart).toBe('2026-01-05');
  });
});

describe('only planned work counts toward the cycle', () => {
  it('ignores cancelled tasks when scoring a period', () => {
    // A cancelled task is not unfinished work — counting it would drag the
    // period under the merge threshold and trigger a rollover nobody asked for.
    const done = task('A', { unitStart: '2026-01-05', status: 'completed' });
    const cancelled = Array.from({ length: 20 }, (_, i) =>
      task('C', { id: `drop${i}`, unitStart: '2026-01-05', status: 'cancelled' })
    );
    expect(weightedCompletionForPeriod([done, ...cancelled], '2026-01-05')).toBeCloseTo(1);
  });

  it('rolls forward only open A-E tasks', () => {
    const cancelled = task('C', { id: 'drop', unitStart: '2026-01-05', status: 'cancelled' });
    const done = task('C', { id: 'done', unitStart: '2026-01-05', status: 'completed' });
    const planned = task('C', { id: 'plan', unitStart: '2026-01-05' });

    const rolled = rollUnfinishedIntoWindow(
      [cancelled, done, planned],
      '2026-01-05',
      '2026-01-07',
      '2026-01-08'
    );
    expect(rolled.find((t) => t.id === 'drop')?.unitStart).toBe('2026-01-05');
    expect(rolled.find((t) => t.id === 'done')?.unitStart).toBe('2026-01-05');
    expect(rolled.find((t) => t.id === 'plan')?.unitStart).toBe('2026-01-07');
  });
});
