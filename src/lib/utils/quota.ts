import type { Task, Priority } from '$lib/types';
import { PRIORITY_CONFIG } from '$lib/types';
import { t } from '$lib/i18n';
import { canAddTask, isSingleSlotPriority } from './quotaCore';

// Pure quota helpers live in quotaCore (Node-safe, no i18n). Re-export them so
// existing imports from '$lib/utils/quota' keep working.
export * from './quotaCore';

/**
 * Validate quota before adding a task.
 * Returns a localized error message if not allowed, null if ok.
 */
export function validateQuota(tasks: Task[], priority: Priority): string | null {
  // The "is this even a real tier?" guard that used to open this function is
  // gone: every Priority is a tier now, and completion lives on `status`.

  // A single-slot tier never refuses an add: Highlander unseats the incumbent,
  // so there is always room by the time the task lands.
  if (isSingleSlotPriority(priority)) return null;

  if (canAddTask(tasks, priority)) {
    return null;
  }

  const config = PRIORITY_CONFIG[priority];
  return t('message.quotaFull', { name: t(`priority.${priority}`), priority, quota: config.quota });
}
