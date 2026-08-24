import type { Task } from '$lib/types';
import { DEFAULT_PRIORITY } from '$lib/types';
import { demotionTargetFor } from './quotaCore';
import { resolveStatus } from './migrateV6';

/**
 * Data migration 4.0 → 5.0: the F / N / S tiers and embedded subtasks are gone.
 *
 * The governing rule is that **deleting a tier must not delete data**
 * (docs/SLEEK-INTEROP.md §10). Nothing here throws a task away:
 *
 *   F (Idea Pool)        → the candidate pool, i.e. a line in todo.txt
 *   N (Future Progress)  → the candidate pool, carrying its threshold date, or
 *                          `h:1` when it had none (that is what "later, don't
 *                          bother me" means in todo.txt)
 *   S (Sustained)        → an ordinary task, and its `+project` becomes the
 *                          week's focusProject setting
 *   S's subtasks         → ordinary tasks tagged with that same project
 *
 * Anything bound for the candidate pool is parked in `pendingExport` rather
 * than written out here: the user may not have chosen a todo.txt yet, and this
 * module does no file IO. The app shows a banner until the export happens, and
 * the data stays in active.json until it succeeds.
 *
 * Node-safe: no Svelte, no Tauri, no i18n.
 */

// The 4.0 shape, read as data rather than through any current union.
interface LegacyTask extends Omit<Task, 'priority' | 'status'> {
  priority: string;
  status?: undefined;
  completed?: boolean;
  originalPriority?: string;
  subtasks?: Array<{ id: string; content: string; completed: boolean; completedAt?: string | null }>;
}

/**
 * What this migration PRODUCES: the 5.0 shape, where completion is still a
 * priority letter (G/H) plus a `completed` boolean, and the pre-completion tier
 * is parked in `originalPriority`.
 *
 * It deliberately is NOT `Task`. `Task` means the current shape, and 5.0 is one
 * step behind it — `migrateToV6` converts the output of this function onward.
 * Typing both steps as `Task` is how a migration chain quietly stops running.
 */
export type V5Task = Omit<Task, 'priority' | 'status'> & {
  priority: string;
  completed?: boolean;
  originalPriority?: string;
};

export interface V5Migration {
  /** Tasks that stay in the unit. */
  tasks: V5Task[];
  /** Tasks bound for the todo.txt candidate pool, not yet written out. */
  pendingExport: V5Task[];
  /** The `+project` tag lifted out of the old S task, if there was one. */
  focusProject: string | null;
  changed: boolean;
}

/** A todo.txt-safe project name: no whitespace, non-empty. */
export function slugifyProject(text: string): string {
  const slug = text
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[+@#]/g, '') // sigils would re-parse as a different tag
    .slice(0, 40);
  return slug || 'focus';
}

// The priority letters 5.0 still recognised: the five tiers plus the two
// completion states that had not yet been split onto their own axis.
const KNOWN_V5_PRIORITIES = new Set(['A', 'B', 'C', 'D', 'E', 'G', 'H']);

/** Whether a stored priority letter is one 5.0 still recognises. */
function isKnownPriority(priority: string): boolean {
  return KNOWN_V5_PRIORITIES.has(priority);
}

/**
 * Turn one of an old S task's subtasks into a standalone task.
 *
 * Subtasks had no dates, priority or pomodoro estimate of their own, so the
 * new task starts bare and inherits only the parent's classification.
 */
function taskFromSubtask(
  parent: LegacyTask,
  subtask: NonNullable<LegacyTask['subtasks']>[number],
  project: string
): V5Task {
  return {
    id: subtask.id,
    content: subtask.content,
    priority: DEFAULT_PRIORITY,
    completed: !!subtask.completed,
    completedAt: subtask.completedAt ?? null,
    createdAt: parent.createdAt,
    unitStart: parent.unitStart,
    projects: [...new Set([...parent.projects, project])],
    contexts: [...parent.contexts],
    customTags: [...parent.customTags],
    dueDate: null,
    thresholdDate: null,
    recurrence: null,
    pomodoros: { estimated: 0, completed: 0 },
    notes: '',
    evolvedFrom: parent.id
  };
}

export function migrateToV5(rawTasks: unknown[], currentFocusProject: string | null = null): V5Migration {
  const legacy = rawTasks as LegacyTask[];

  const tasks: V5Task[] = [];
  const pendingExport: V5Task[] = [];
  let focusProject = currentFocusProject;
  let changed = false;

  // The old S tier held at most one task, but dirty data could hold more. The
  // first one defines the focus project; any others become ordinary tasks.
  const sustained = legacy.filter(t => t.priority === 'S');
  if (sustained.length > 0 && !focusProject) {
    focusProject = sustained[0].projects[0] ?? slugifyProject(sustained[0].content);
  }

  for (const task of legacy) {
    const priority = task.priority;

    if (priority === 'F' || priority === 'N') {
      changed = true;
      // A future task keeps its threshold date; one without a date is simply
      // "not now", which the exporter writes as h:1.
      pendingExport.push({ ...(task as unknown as V5Task), priority: DEFAULT_PRIORITY });
      continue;
    }

    if (priority === 'S') {
      changed = true;
      const project = focusProject ?? slugifyProject(task.content);

      // Its subtasks become real tasks in the candidate pool, tagged with the
      // focus project. They were bullets before; now they can each carry a
      // priority, a due date and a pomodoro estimate.
      for (const subtask of task.subtasks ?? []) {
        pendingExport.push(taskFromSubtask(task, subtask, project));
      }

      // The S task itself stays in the unit. It was the week's headline work,
      // so it lands as high as there is room for; if the unit is completely
      // full it goes to the candidate pool with everything else.
      // `demotionTargetFor` reads the current shape, and these tasks are
      // still 5.0 — no `status` field yet. Project them through the same
      // resolution table migrateV6 uses, or every task would read as
      // "not open", the quota would look empty and the ladder would always
      // answer B regardless of the real load.
      const target = demotionTargetFor(
        tasks.map(t => ({ ...(t as unknown as Task), ...resolveStatus(t) }))
      );
      const promoted: V5Task = {
        ...(task as unknown as V5Task),
        priority: target ?? DEFAULT_PRIORITY,
        projects: [...new Set([...task.projects, project])]
      };
      delete (promoted as Partial<LegacyTask>).subtasks;

      if (target) tasks.push(promoted);
      else pendingExport.push(promoted);
      continue;
    }

    // Anything with an unrecognised letter would otherwise become invisible —
    // it matches no view and no predicate. Send it to the candidate pool.
    if (!isKnownPriority(priority)) {
      changed = true;
      pendingExport.push({ ...(task as unknown as V5Task), priority: DEFAULT_PRIORITY });
      continue;
    }

    // A completed task's originalPriority may name a tier that no longer
    // exists; that would make it vanish from the retention display.
    let migrated = task as unknown as V5Task;
    if (task.originalPriority && !isKnownPriority(task.originalPriority)) {
      changed = true;
      migrated = { ...migrated, originalPriority: DEFAULT_PRIORITY };
    }
    if (task.subtasks) {
      changed = true;
      const stripped = { ...migrated };
      delete (stripped as Partial<LegacyTask>).subtasks;
      migrated = stripped;
    }

    tasks.push(migrated);
  }

  return { tasks, pendingExport, focusProject, changed: changed || pendingExport.length > 0 };
}
