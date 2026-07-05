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

// TZ pinned to UTC in vitest.config. Reference dates:
//   Sunday 2026-01-04 → Unit 1 (start 2026-01-04, end 2026-01-05)
//   Tuesday 2026-01-06 → Unit 2 (start 2026-01-06, end 2026-01-07)
//   Saturday 2026-01-10 → review day

describe('weightedCompletionForPeriod', () => {
  it('scores priority-weighted completion of a period', () => {
    const openA = task('A', { unitStart: '2026-01-04' }); // weight 5, not done
    const doneA = task('G', { unitStart: '2026-01-04', completed: true, originalPriority: 'A' }); // weight 5, done
    expect(weightedCompletionForPeriod([openA, doneA], '2026-01-04')).toBeCloseTo(0.5);
  });

  it('returns 1 when everything planned is done', () => {
    const doneC = task('G', { unitStart: '2026-01-04', completed: true, originalPriority: 'C' });
    expect(weightedCompletionForPeriod([doneC], '2026-01-04')).toBeCloseTo(1);
  });

  it('returns null when nothing A-F was planned', () => {
    expect(weightedCompletionForPeriod([], '2026-01-04')).toBeNull();
    const cancelled = task('H', { unitStart: '2026-01-04' });
    expect(weightedCompletionForPeriod([cancelled], '2026-01-04')).toBeNull();
  });

  it('ignores tasks belonging to a different period', () => {
    const other = task('A', { unitStart: '2026-01-06' });
    expect(weightedCompletionForPeriod([other], '2026-01-04')).toBeNull();
  });
});

describe('rollUnfinishedIntoWindow', () => {
  it('moves only open active tasks of the given period into the window', () => {
    const openA = task('A', { id: 'open', unitStart: '2026-01-04' });
    const doneA = task('G', { id: 'done', unitStart: '2026-01-04', completed: true, originalPriority: 'A' });
    const other = task('B', { id: 'other', unitStart: '2026-01-06' });

    const result = rollUnfinishedIntoWindow(
      [openA, doneA, other],
      '2026-01-04',
      '2026-01-06',
      '2026-01-07'
    );

    const moved = result.find((t) => t.id === 'open')!;
    expect(moved.unitStart).toBe('2026-01-06');
    expect(moved.unitOverride?.extendedUntil).toBe('2026-01-07');
    expect(result.find((t) => t.id === 'done')!.unitStart).toBe('2026-01-04'); // completed → stays
    expect(result.find((t) => t.id === 'other')!.unitStart).toBe('2026-01-06'); // other period → unchanged
  });
});

describe('evaluateCycle', () => {
  it('is a no-op on the review day (Saturday)', () => {
    const app = createDefaultAppData();
    const res = evaluateCycle(app, new Date(2026, 0, 10, 12, 0, 0));
    expect(res).toEqual({ changed: false, merged: false });
    expect(app.cycleState).toBeUndefined();
  });

  it('seeds cycle state on the first run', () => {
    const app = createDefaultAppData();
    const res = evaluateCycle(app, new Date(2026, 0, 4, 12, 0, 0));
    expect(res).toEqual({ changed: true, merged: false });
    expect(app.cycleState?.anchorStart).toBe('2026-01-04');
    expect(app.cycleState?.windowEnd).toBe('2026-01-05');
    expect(app.cycleState?.lastEvaluatedStart).toBe('');
  });

  it('does nothing while still inside the same window', () => {
    const app = createDefaultAppData();
    app.cycleState = {
      anchorStart: '2026-01-04',
      windowEnd: '2026-01-05',
      merged: false,
      lastEvaluatedStart: '',
    };
    const res = evaluateCycle(app, new Date(2026, 0, 4, 12, 0, 0));
    expect(res).toEqual({ changed: false, merged: false });
  });

  it('auto-merges an under-completed period when prompting is off', () => {
    const app = createDefaultAppData();
    app.settings.lowCompletionPrompt = false;
    app.cycleState = {
      anchorStart: '2026-01-04',
      windowEnd: '2026-01-05',
      merged: false,
      lastEvaluatedStart: '2025-12-01',
    };
    app.tasks = [task('A', { id: 'roll', unitStart: '2026-01-04', completed: false })];

    const res = evaluateCycle(app, new Date(2026, 0, 6, 12, 0, 0)); // Tuesday → new window
    expect(res).toEqual({ changed: true, merged: true });
    expect(app.tasks[0].unitStart).toBe('2026-01-06'); // rolled forward
    expect(app.tasks[0].unitOverride?.extendedUntil).toBe('2026-01-07');
    expect(app.cycleState?.anchorStart).toBe('2026-01-06');
    expect(app.cycleHistory?.some((h) => h.periodStart === '2026-01-04' && h.merged)).toBe(true);
  });

  it('defers the merge (pendingReview) when prompting is on', () => {
    const app = createDefaultAppData();
    app.settings.lowCompletionPrompt = true;
    app.cycleState = {
      anchorStart: '2026-01-04',
      windowEnd: '2026-01-05',
      merged: false,
      lastEvaluatedStart: '2025-12-01',
    };
    app.tasks = [task('A', { id: 'roll', unitStart: '2026-01-04', completed: false })];

    const res = evaluateCycle(app, new Date(2026, 0, 6, 12, 0, 0));
    expect(res).toEqual({ changed: true, merged: false });
    expect(app.tasks[0].unitStart).toBe('2026-01-04'); // NOT moved yet
    expect(app.cycleState?.pendingReview?.periodStart).toBe('2026-01-04');
  });
});
