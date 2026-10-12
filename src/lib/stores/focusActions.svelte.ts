import type { Task } from '$lib/types';
import { isOpen } from '$lib/types';
import { getPomodoroStore, startPomodoro, resumePomodoro } from './pomodoro.svelte';
import { showConfirmation } from './ui.svelte';
import { t } from '$lib/i18n';

/** UI entry point: a second click must not reset an existing work session. */
export function requestTaskFocus(task: Task): void {
  if (!isOpen(task)) return;
  const timer = getPomodoroStore();
  if (timer.state === 'work' && timer.activeTaskId === task.id) {
    if (!timer.isRunning) resumePomodoro();
    return;
  }
  if (timer.state !== 'idle') {
    showConfirmation({
      title: t('continuity.switchTitle'),
      message: t('continuity.switchMessage', { name: task.content }),
      confirmText: t('continuity.switchAction'),
      cancelText: t('continuity.keepSession'),
      onConfirm: () => startPomodoro(task)
    });
    return;
  }
  startPomodoro(task);
}
