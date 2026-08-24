import { describe, it, expect } from 'vitest';
import {
  ageInDays,
  ageDistribution,
  cycleTimeMedian,
  estimationFactor,
  commitmentCount,
  samplesUntilReady,
  MIN_SAMPLE
} from './flowMetrics';
import { createEmptyTask } from '$lib/types';
import type { Task, Priority } from '$lib/types';

/** Local midnight N days before `from`, as an ISO string. */
function daysAgo(n: number, from = new Date(2026, 7, 24, 10, 0, 0)): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() - n, 9, 0, 0);
  return d.toISOString();
}

const NOW = new Date(2026, 7, 24, 10, 0, 0); // 2026-08-24 local

function open(ageDays: number, priority: Priority = 'C'): Task {
  const t = createEmptyTask(priority);
  t.createdAt = daysAgo(ageDays);
  return t;
}

function done(opts: {
  createdDaysAgo: number;
  completedDaysAgo: number;
  tier?: Priority;
  estimated?: number;
  completed?: number;
}): Task {
  const t = createEmptyTask(opts.tier ?? 'C');
  t.status = 'completed';
  t.createdAt = daysAgo(opts.createdDaysAgo);
  t.completedAt = daysAgo(opts.completedDaysAgo);
  t.pomodoros.estimated = opts.estimated ?? 0;
  t.pomodoros.completed = opts.completed ?? 0;
  return t;
}

describe('ageInDays', () => {
  it('counts calendar days, not 24-hour blocks', () => {
    // Created late yesterday, read early today: one day old, not zero.
    const created = new Date(2026, 7, 23, 23, 30, 0).toISOString();
    expect(ageInDays(created, new Date(2026, 7, 24, 0, 15, 0))).toBe(1);
  });

  it('is zero on the day of creation', () => {
    const created = new Date(2026, 7, 24, 1, 0, 0).toISOString();
    expect(ageInDays(created, new Date(2026, 7, 24, 23, 0, 0))).toBe(0);
  });

  it('never goes negative for a future timestamp', () => {
    const created = new Date(2026, 7, 30).toISOString();
    expect(ageInDays(created, NOW)).toBe(0);
  });

  it('survives a DST transition', () => {
    // US DST forward is 2026-03-08; the 8th is a 23-hour day in most US zones.
    const created = new Date(2026, 2, 6, 12, 0, 0).toISOString();
    expect(ageInDays(created, new Date(2026, 2, 10, 12, 0, 0))).toBe(4);
  });

  it('returns 0 for an unparseable timestamp rather than NaN', () => {
    expect(ageInDays('not a date', NOW)).toBe(0);
  });
});

describe('ageDistribution', () => {
  it('reports nulls, not zeros, when there is nothing open', () => {
    expect(ageDistribution([], NOW)).toEqual({ count: 0, p50: null, p90: null, oldest: null });
  });

  it('finds the oldest open task', () => {
    const tasks = [open(3), open(47), open(1)];
    const dist = ageDistribution(tasks, NOW);
    expect(dist.oldest?.days).toBe(47);
    expect(dist.oldest?.task).toBe(tasks[1]);
    expect(dist.count).toBe(3);
  });

  it('ignores completed and cancelled tasks', () => {
    const cancelled = createEmptyTask('C');
    cancelled.status = 'cancelled';
    cancelled.createdAt = daysAgo(90);
    const tasks = [open(2), cancelled, done({ createdDaysAgo: 80, completedDaysAgo: 1 })];
    const dist = ageDistribution(tasks, NOW);
    expect(dist.count).toBe(1);
    expect(dist.oldest?.days).toBe(2);
  });

  it('puts p90 in the tail, where avoidance hides', () => {
    const tasks = [1, 1, 2, 2, 3, 3, 4, 4, 5, 60].map((d) => open(d));
    const dist = ageDistribution(tasks, NOW);
    expect(dist.p50).toBe(3);
    expect(dist.p90).toBe(5);
    expect(dist.oldest?.days).toBe(60);
  });
});

describe('cycleTimeMedian', () => {
  it('refuses to answer below the minimum sample', () => {
    const tasks = Array.from({ length: MIN_SAMPLE - 1 }, (_, i) =>
      done({ createdDaysAgo: 10 + i, completedDaysAgo: i })
    );
    expect(cycleTimeMedian(tasks)).toBeNull();
  });

  it('measures creation to completion', () => {
    // Five tasks that each took exactly 4 days.
    const tasks = Array.from({ length: 5 }, (_, i) =>
      done({ createdDaysAgo: 10 + i, completedDaysAgo: 6 + i })
    );
    expect(cycleTimeMedian(tasks)).toEqual({ value: 4, sampleSize: 5 });
  });

  it('averages the two middle values on an even sample', () => {
    const spans = [2, 4, 6, 8, 10, 12];
    const tasks = spans.map((s, i) => done({ createdDaysAgo: s + i, completedDaysAgo: i }));
    expect(cycleTimeMedian(tasks)?.value).toBe(7);
  });

  it('excludes cancelled tasks, so abandoning work cannot improve the number', () => {
    const quick = Array.from({ length: 5 }, (_, i) =>
      done({ createdDaysAgo: 20 + i, completedDaysAgo: 10 + i })
    );
    const abandoned = createEmptyTask('C');
    abandoned.status = 'cancelled';
    abandoned.createdAt = daysAgo(100);
    abandoned.completedAt = daysAgo(0);
    expect(cycleTimeMedian([...quick, abandoned])).toEqual({ value: 10, sampleSize: 5 });
  });

  it('only looks at the most recent window', () => {
    const oldSlow = Array.from({ length: 10 }, (_, i) =>
      done({ createdDaysAgo: 200 + i, completedDaysAgo: 100 + i })
    );
    const recentFast = Array.from({ length: 5 }, (_, i) =>
      done({ createdDaysAgo: 12 + i, completedDaysAgo: 10 + i })
    );
    expect(cycleTimeMedian([...oldSlow, ...recentFast], 5)).toEqual({ value: 2, sampleSize: 5 });
  });
});

describe('estimationFactor', () => {
  it('is null below the minimum sample', () => {
    const tasks = Array.from({ length: 4 }, (_, i) =>
      done({ createdDaysAgo: 5, completedDaysAgo: i, estimated: 2, completed: 4 })
    );
    expect(estimationFactor(tasks)).toBeNull();
  });

  it('reports the median over/under-run', () => {
    const tasks = Array.from({ length: 5 }, (_, i) =>
      done({ createdDaysAgo: 5, completedDaysAgo: i, estimated: 2, completed: 3 })
    );
    expect(estimationFactor(tasks)).toEqual({ value: 1.5, sampleSize: 5 });
  });

  it('ignores tasks whose timer was never started', () => {
    // Zero completed pomodoros means "did not use the timer", not "took no
    // effort". Counting them would drag the factor toward zero and tell the
    // user they systematically over-estimate.
    const timed = Array.from({ length: 5 }, (_, i) =>
      done({ createdDaysAgo: 5, completedDaysAgo: i, estimated: 2, completed: 4 })
    );
    const untimed = Array.from({ length: 20 }, (_, i) =>
      done({ createdDaysAgo: 5, completedDaysAgo: i, estimated: 2, completed: 0 })
    );
    expect(estimationFactor([...timed, ...untimed])).toEqual({ value: 2, sampleSize: 5 });
  });

  it('can restrict the reference class to one tier', () => {
    const bTasks = Array.from({ length: 5 }, (_, i) =>
      done({ createdDaysAgo: 5, completedDaysAgo: i, tier: 'B', estimated: 4, completed: 8 })
    );
    const eTasks = Array.from({ length: 5 }, (_, i) =>
      done({ createdDaysAgo: 5, completedDaysAgo: i, tier: 'E', estimated: 1, completed: 1 })
    );
    const all = [...bTasks, ...eTasks];
    expect(estimationFactor(all, { priority: 'B' })?.value).toBe(2);
    expect(estimationFactor(all, { priority: 'E' })?.value).toBe(1);
    // Not enough of any single other tier to answer.
    expect(estimationFactor(all, { priority: 'A' })).toBeNull();
  });

  it('keeps the tier through completion, so no second field is needed', () => {
    const tasks = Array.from({ length: 5 }, (_, i) =>
      done({ createdDaysAgo: 5, completedDaysAgo: i, tier: 'A', estimated: 5, completed: 10 })
    );
    expect(tasks[0].priority).toBe('A');
    expect(tasks[0].status).toBe('completed');
    expect(estimationFactor(tasks, { priority: 'A' })?.value).toBe(2);
  });
});

describe('commitmentCount', () => {
  it('counts only what is still owed', () => {
    const tasks = [
      open(1),
      open(2),
      done({ createdDaysAgo: 5, completedDaysAgo: 1 }),
      { ...createEmptyTask('C'), status: 'cancelled' as const }
    ];
    expect(commitmentCount(tasks)).toBe(2);
  });
});

describe('samplesUntilReady', () => {
  it('counts down to the first honest median', () => {
    expect(samplesUntilReady([])).toBe(MIN_SAMPLE);
    const two = Array.from({ length: 2 }, (_, i) =>
      done({ createdDaysAgo: 5, completedDaysAgo: i })
    );
    expect(samplesUntilReady(two)).toBe(MIN_SAMPLE - 2);
    const plenty = Array.from({ length: 40 }, (_, i) =>
      done({ createdDaysAgo: 5, completedDaysAgo: i })
    );
    expect(samplesUntilReady(plenty)).toBe(0);
  });
});
