import type { AppData } from '$lib/types';
import { isActivePriority } from '$lib/types';
import { isToday, isOverdue } from './unitCalc';
import { t } from '$lib/i18n';

const LAST_NOTICE_KEY = 'focusflow_last_due_notice';

function localDateKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Send a once-per-day summary notification for tasks due today or overdue.
 * Called at startup; the per-day dedupe key means re-launching the same day
 * won't re-notify, while launching on a new day will. Desktop (Tauri) only.
 */
export async function maybeNotifyDueTasks(appData: AppData): Promise<void> {
  if (appData.settings?.dueReminders === false) return;
  if (typeof window === 'undefined' || !('__TAURI__' in window)) return;

  // Per-day dedupe — don't notify twice on the same calendar day.
  const today = localDateKey();
  try {
    if (localStorage.getItem(LAST_NOTICE_KEY) === today) return;
  } catch {
    // localStorage unavailable — proceed without dedupe
  }

  const dueCount = appData.tasks.filter(task =>
    !task.completed &&
    isActivePriority(task.priority) &&
    task.dueDate &&
    (isToday(task.dueDate) || isOverdue(task.dueDate))
  ).length;

  if (dueCount === 0) return;

  try {
    const { isPermissionGranted, requestPermission, sendNotification } =
      await import('@tauri-apps/plugin-notification');
    let granted = await isPermissionGranted();
    if (!granted) {
      const perm = await requestPermission();
      granted = perm === 'granted';
    }
    if (!granted) return;

    sendNotification({
      title: t('reminders.dueTitle'),
      body: t('reminders.dueBody', { count: dueCount }),
    });

    try {
      localStorage.setItem(LAST_NOTICE_KEY, today);
    } catch {
      // ignore
    }
  } catch {
    // Notification plugin unavailable
  }
}
