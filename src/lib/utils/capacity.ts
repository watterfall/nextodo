import type { Task } from '$lib/types';
import { formatDateISO } from './unitCalc';

/** Explicit minutes only: priority and block counts are not time estimates. */
export function normalizeMinutes(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.round(value) || null : null;
}

/** Current-window planning load, not remaining work or a historical snapshot.
 * Include carried-over open work and this window's finishes; exclude future
 * assignments, future threshold dates and cancelled work. Completed estimates
 * stay in the total so finishing a task cannot create fictitious free time.
 */
export function capacitySummary(tasks: Task[], start: string, end: string) {
  const included = tasks.filter(task => {
    if (task.status === 'cancelled' || task.unitStart > end || (task.thresholdDate && task.thresholdDate > end)) return false;
    if (task.status === 'open') return true;
    if (!task.completedAt) return false;
    const day = formatDateISO(new Date(task.completedAt));
    return day >= start && day <= end;
  });
  let plannedMinutes = 0;
  let unknownCount = 0;
  for (const task of included) {
    const minutes = normalizeMinutes(task.estimatedMinutes);
    if (minutes === null) unknownCount++;
    else plannedMinutes += minutes;
  }
  return { plannedMinutes, unknownCount, taskCount: included.length };
}
