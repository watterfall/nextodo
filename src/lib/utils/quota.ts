import type { Task, Priority } from '$lib/types';
import { PRIORITY_CONFIG, isActivePriority, isFuturePriority, isSustainedPriority } from '$lib/types';
import { t } from '$lib/i18n';
import { canAddTask } from './quotaCore';

// Pure quota helpers live in quotaCore (Node-safe, no i18n). Re-export them so
// existing imports from '$lib/utils/quota' keep working.
export * from './quotaCore';

/**
 * Validate quota before adding a task.
 * Returns a localized error message if not allowed, null if ok.
 */
export function validateQuota(tasks: Task[], priority: Priority): string | null {
  // Future-progress (N) has no quota
  if (isFuturePriority(priority)) return null;

  // Sustained (S) is quota 1 — replaced via Highlander logic in store
  if (isSustainedPriority(priority)) {
    return canAddTask(tasks, priority) ? null : t('message.sustainedExists');
  }

  if (!isActivePriority(priority)) {
    return 'Cannot add directly to a hidden priority';
  }

  if (canAddTask(tasks, priority)) {
    return null;
  }

  const config = PRIORITY_CONFIG[priority];
  return t('message.quotaFull', { name: t(`priority.${priority}`), priority, quota: config.quota });
}
