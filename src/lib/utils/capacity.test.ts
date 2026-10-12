import { describe, it, expect } from 'vitest';
import { createEmptyTask, type Task } from '$lib/types';
import { capacitySummary, normalizeMinutes } from './capacity';
import { ageDistribution, cycleTimeMedian } from './flowMetrics';
import { createNextOccurrence } from './recurrence';
const task = (patch: Partial<Task> = {}): Task => ({ ...createEmptyTask(), unitStart: '2026-10-12', ...patch });

describe('commitment and time plan semantics', () => {
  it('does not treat missing or invalid estimates as free work', () => {
    const tasks = [task({ estimatedMinutes: 30 }), task(), task({ estimatedMinutes: 0 }), task({ estimatedMinutes: -5 }), task({ estimatedMinutes: NaN })];
    expect(capacitySummary(tasks, '2026-10-12', '2026-10-13')).toEqual({ plannedMinutes: 30, unknownCount: 4, taskCount: 5 });
    expect(normalizeMinutes(Infinity)).toBeNull();
  });
  it('keeps finished estimates, includes carryover, excludes future/cancelled/older finishes', () => {
    const tasks = [task({ estimatedMinutes: 30, unitStart: '2026-10-05' }), task({ estimatedMinutes: 20, status: 'completed', completedAt: '2026-10-12T12:00:00Z' }), task({ estimatedMinutes: 100, status: 'cancelled' }), task({ estimatedMinutes: 100, unitStart: '2026-10-14' }), task({ estimatedMinutes: 100, thresholdDate: '2026-10-14' }), task({ estimatedMinutes: 100, status: 'completed', completedAt: '2026-10-10T12:00:00Z' })];
    expect(capacitySummary(tasks, '2026-10-12', '2026-10-13')).toEqual({ plannedMinutes: 50, unknownCount: 0, taskCount: 2 });
    tasks[0].status = 'completed'; tasks[0].completedAt = '2026-10-13T12:00:00Z';
    expect(capacitySummary(tasks, '2026-10-12', '2026-10-13').plannedMinutes).toBe(50);
  });
  it('distinguishes pool creation, legacy pull date, and explicit commitment', () => {
    const t = task({ createdAt: '2020-01-01T12:00:00Z', source: { file: 'todo.txt', raw: 'old idea', pulledAt: '2026-10-10T12:00:00Z' } });
    const now = new Date('2026-10-12T12:00:00Z');
    expect(ageDistribution([t], now).oldest?.days).toBe(2);
    t.committedAt = '2026-10-11T12:00:00Z';
    expect(ageDistribution([t], now).oldest?.days).toBe(1);
    const finishes = Array.from({ length: 5 }, () => ({ ...t, status: 'completed' as const, completedAt: now.toISOString() }));
    expect(cycleTimeMedian(finishes)).toEqual({ value: 1, sampleSize: 5 });
    expect(t.createdAt).toBe('2020-01-01T12:00:00Z');
  });
  it('new recurring work retains the action and estimate, not the previous interruption note', () => {
    const previous = task({ recurrence: { n: 1, unit: 'd', strict: false, nextDue: null }, dueDate: '2026-10-12', estimatedMinutes: 20, nextAction: 'Open notes', resumeNote: 'Continue paragraph 4', committedAt: '2020-01-01T12:00:00Z' });
    const next = createNextOccurrence(previous);
    expect(next?.resumeNote).toBeNull();
    expect(next?.nextAction).toBe('Open notes');
    expect(next?.estimatedMinutes).toBe(20);
    expect(next?.committedAt).not.toBe(previous.committedAt);
  });
});
