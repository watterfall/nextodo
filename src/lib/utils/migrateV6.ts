import type { Task, Priority, TaskStatus } from '$lib/types';
import { asPriority } from '$lib/types';

/**
 * Data migration 5.0 → 6.0: completion stops being a priority.
 *
 * Until 5.0 a finished task was stored by *overwriting* its tier — priority
 * became 'G' (completed) or 'H' (cancelled) — and the tier it used to have was
 * parked in `originalPriority` so the UI could put it back. Two fields
 * describing one thing, and a `Priority` union with two members that were not
 * priorities at all.
 *
 * 6.0 splits the axes: `priority` is always one of A–E and survives untouched,
 * `status` says what happened. `originalPriority` and the old `completed`
 * boolean both disappear because they become derivable — or rather, they stop
 * needing to be derived at all.
 *
 * The mapping, in the order the checks have to run:
 *
 *   priority 'G'                   → status 'completed', priority = originalPriority
 *   priority 'H'                   → status 'cancelled', priority = originalPriority
 *   completed === true (any tier)  → status 'completed'   (the CLI's shape)
 *   otherwise                      → status 'open'
 *
 * That third case is not hypothetical. The CLI writes `active.json` directly,
 * and older builds of it set `completed: true` alongside priority 'G'; a
 * partially-written record with one and not the other has to resolve to
 * "finished", because the alternative is resurrecting a task the user completed.
 *
 * Node-safe: no Svelte, no Tauri, no i18n.
 */

/** The 5.0 shape, read as data rather than through the current union. */
interface LegacyTask extends Omit<Task, 'priority' | 'status'> {
  priority: string;
  status?: string;
  completed?: boolean;
  originalPriority?: string;
}

export interface V6Migration {
  tasks: Task[];
  changed: boolean;
}

const VALID_STATUS = new Set<string>(['open', 'completed', 'cancelled']);

/**
 * Resolve one legacy task's (priority, status) pair.
 *
 * Exported for the tests, which care about this table more than about the
 * array plumbing around it.
 */
export function resolveStatus(raw: {
  priority?: unknown;
  status?: unknown;
  completed?: unknown;
  originalPriority?: unknown;
}): { priority: Priority; status: TaskStatus } {
  // Already migrated (or written by a 6.0 build): trust it, but still clamp the
  // tier — a file hand-edited to `priority: "F"` should land somewhere real
  // rather than poisoning every Record<Priority, …> that indexes by it.
  if (typeof raw.status === 'string' && VALID_STATUS.has(raw.status)) {
    return { priority: asPriority(raw.priority), status: raw.status as TaskStatus };
  }

  const legacy = raw.priority;

  if (legacy === 'G' || legacy === 'H') {
    return {
      // The tier it had before it ended. Missing or unrecognised falls back to
      // the default rather than to the letter that is about to stop existing.
      priority: asPriority(raw.originalPriority),
      status: legacy === 'G' ? 'completed' : 'cancelled'
    };
  }

  if (raw.completed === true) {
    return { priority: asPriority(legacy), status: 'completed' };
  }

  return { priority: asPriority(legacy), status: 'open' };
}

export function migrateToV6(rawTasks: unknown[]): V6Migration {
  let changed = false;
  const tasks: Task[] = [];

  for (const raw of rawTasks as LegacyTask[]) {
    if (!raw || typeof raw !== 'object') {
      changed = true;
      continue;
    }

    const { priority, status } = resolveStatus(raw);

    // Drop the two retired fields by rebuilding rather than spreading-and-
    // deleting, so they cannot survive into the next save.
    const { completed: _completed, originalPriority: _originalPriority, ...rest } =
      raw as LegacyTask & { completed?: boolean; originalPriority?: string };

    if (
      raw.priority !== priority ||
      raw.status !== status ||
      'completed' in raw ||
      'originalPriority' in raw
    ) {
      changed = true;
    }

    tasks.push({ ...(rest as unknown as Task), priority, status });
  }

  return { tasks, changed };
}
