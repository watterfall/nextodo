import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyTask } from '$lib/types';
import { requestTaskFocus } from './focusActions.svelte';
import { getPomodoroStore, startPomodoro, pausePomodoro, stopPomodoro } from './pomodoro.svelte';
import { getUIStore, handleConfirmationCancel, handleConfirmationConfirm, closeConfirmation } from './ui.svelte';
import { continuationDraft, setContinuationDraft, acknowledgeContinuationDraft } from './continuationDrafts.svelte';

beforeEach(() => { vi.useFakeTimers(); stopPomodoro(); closeConfirmation(); });
afterEach(() => { stopPomodoro(); closeConfirmation(); vi.useRealTimers(); });

describe('focus continuity', () => {
  it('resumes the same task without resetting its remaining time', () => {
    const task = createEmptyTask(); startPomodoro(task);
    vi.advanceTimersByTime(7000); pausePomodoro();
    const remaining = getPomodoroStore().timeRemaining;
    requestTaskFocus(task);
    expect(getPomodoroStore().timeRemaining).toBe(remaining);
    expect(getPomodoroStore().isRunning).toBe(true);
    expect(getUIStore().confirmationData).toBeNull();
  });
  it('keeps the current timer when a task switch is cancelled', () => {
    const original = createEmptyTask(), target = createEmptyTask();
    startPomodoro(original); vi.advanceTimersByTime(4000);
    const remaining = getPomodoroStore().timeRemaining;
    requestTaskFocus(target);
    expect(getUIStore().confirmationData).not.toBeNull();
    expect(getPomodoroStore().activeTaskId).toBe(original.id);
    handleConfirmationCancel();
    expect(getPomodoroStore().timeRemaining).toBe(remaining);
    expect(getPomodoroStore().activeTaskId).toBe(original.id);
  });
  it('switches only after confirmation, without awarding an unfinished block', () => {
    const original = createEmptyTask(), target = createEmptyTask();
    const before = getPomodoroStore().todayCount;
    startPomodoro(original); requestTaskFocus(target); handleConfirmationConfirm();
    expect(getPomodoroStore().activeTaskId).toBe(target.id);
    expect(getPomodoroStore().todayCount).toBe(before);
  });
  it('does not start a completed or cancelled task', () => {
    requestTaskFocus({ ...createEmptyTask(), status: 'completed' });
    requestTaskFocus({ ...createEmptyTask(), status: 'cancelled' });
    expect(getPomodoroStore().state).toBe('idle');
  });
  it('shares unsaved text and retains newer edits after an earlier save finishes', () => {
    const task = { ...createEmptyTask(), resumeNote: 'stored note' };
    expect(continuationDraft(task)).toBe('stored note');
    setContinuationDraft(task.id, 'first draft');
    expect(continuationDraft({ ...task })).toBe('first draft');
    setContinuationDraft(task.id, 'newer draft');
    acknowledgeContinuationDraft(task.id, 'first draft');
    expect(continuationDraft(task)).toBe('newer draft');
    acknowledgeContinuationDraft(task.id, 'newer draft');
    expect(continuationDraft({ ...task, resumeNote: 'newer draft' })).toBe('newer draft');
  });
  it('keeps an intentionally cleared draft instead of falling back to the saved note', () => {
    const task = { ...createEmptyTask(), resumeNote: 'old instruction' };
    setContinuationDraft(task.id, '');
    expect(continuationDraft(task)).toBe('');
    expect(continuationDraft({ ...createEmptyTask(), resumeNote: 'other task' })).toBe('other task');
  });
});
