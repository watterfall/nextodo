import type { Task, Priority, TaskOrigin, FilterState, UnitInfo, AppData, ActiveData, PomodoroHistoryData } from '$lib/types';
import { createDefaultAppData, isThresholdPassed, isActivePriority, isCountedPriority, isHiddenPriority, isOperablePriority, DEFAULT_PRIORITY, ORIGIN_CONTEXT, withOrigin, isWithinRetentionPeriod } from '$lib/types';
import { loadAppData, saveAppData, reloadFile, archiveTasks } from '$lib/utils/storage';
import { readTodoFile, writeTodoFile, appendTodoLines } from '$lib/utils/todoFile';
import {
  splitLines,
  findSourceLine,
  markLineComplete,
  addContextToLine,
  removeContextFromLine,
  taskFromTodoTxt,
  todoTxtFromTask
} from '$lib/utils/todotxt';
import { applyHighlanderRule, canAddTask, validateQuota, isSingleSlotPriority } from '$lib/utils/quota';
import { createTaskFromInput } from '$lib/utils/parser';
import { processRecurringTasks, createNextOccurrence } from '$lib/utils/recurrence';
import { evaluateCycle, rollUnfinishedIntoWindow } from '$lib/utils/cycleEngine';
import { maybeNotifyDueTasks } from '$lib/utils/reminders';
import { ageDistribution, cycleTimeMedian, estimationFactor, samplesUntilReady } from '$lib/utils/flowMetrics';
import { getCurrentUnit, isToday, isOverdue, isThisWeek, currentUnitStartLocal, parseISODate, formatDateISO } from '$lib/utils/unitCalc';
import { t } from '$lib/i18n';

// Main app state
let appData = $state<AppData>(createDefaultAppData());
let isLoading = $state(true);
let lastError = $state<string | null>(null);

// Current unit
let currentUnit = $state<UnitInfo>(getCurrentUnit());

// Filter state
let filter = $state<FilterState>({
  project: null,
  context: null,
  tag: null,
  showCompleted: false,
  dueFilter: null,
  showFutureTasks: false,
  priority: null,
  pomodoroFilter: null
});

// Search query
let searchQuery = $state('');

// Helper to cleanup old tasks
function cleanupOldTasks(): void {
  const now = Date.now();
  const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
  // Completed (G) tasks older than this move to cold storage. Kept >= the 14-day
  // History window so HistoryModal still shows recent completions.
  const archiveAfterMs = 14 * 24 * 60 * 60 * 1000;

  const originalCount = appData.tasks.length;
  const toArchive: Task[] = [];

  appData.tasks = appData.tasks.filter(task => {
    // Cancelled (H): hard-delete after 2 days
    if (task.priority === 'H') {
      if (!task.completedAt) return true; // Keep if no timestamp (shouldn't happen but safe)
      const cancelledTime = new Date(task.completedAt).getTime();
      if (now - cancelledTime > twoDaysMs) {
        return false;
      }
    }

    // Completed (G): archive to cold storage after the History window, drop from active
    if (task.priority === 'G' && task.completedAt) {
      const completedTime = new Date(task.completedAt).getTime();
      if (now - completedTime > archiveAfterMs) {
        toArchive.push(task);
        return false;
      }
    }

    return true;
  });

  if (toArchive.length > 0) {
    archiveTasks(toArchive).catch(err => console.error('Failed to archive old completed tasks:', err));
  }
  if (appData.tasks.length !== originalCount) {
    // Don't await save here to avoid blocking init, but trigger it
    saveAppData(appData).catch(err => console.error('Failed to save after cleanup:', err));
  }
}

// Initialize data
export async function initializeData(): Promise<void> {
  try {
    isLoading = true;
    lastError = null;
    appData = await loadAppData();

    // One-time normalization: unitStart was historically the creation day; make it
    // the unit's start date so the field is canonical across the app. Idempotent.
    let normalized = false;
    appData.tasks = appData.tasks.map(task => {
      if (!task.unitStart) return task;
      const canonical = currentUnitStartLocal(parseISODate(task.unitStart));
      if (canonical !== task.unitStart) {
        normalized = true;
        return { ...task, unitStart: canonical };
      }
      return task;
    });

    // Cleanup old tasks (Cancelled > 2 days)
    cleanupOldTasks();

    // Evaluate the dynamic 2-day cycle: advance to the new period, and merge
    // (roll unfinished A-E tasks forward) when the prior period was under-completed.
    const cycleResult = evaluateCycle(appData);

    // Process recurring tasks. This is the catch-up net for completions that did
    // not go through completeTask() — chiefly the CLI, which writes active.json
    // directly. It must include G (completed) tasks: getTasksNeedingRecurrence
    // keys on `completed`, and every completion also sets priority 'G', so
    // filtering to A-F here made this branch permanently unreachable.
    const newRecurringTasks = processRecurringTasks(
      appData.tasks.filter(t => t.priority !== 'H')
    );
    let dataChanged = newRecurringTasks.length > 0 || cycleResult.changed || normalized;
    if (dataChanged) {
      appData.tasks = [...appData.tasks, ...newRecurringTasks];
    }

    if (dataChanged) {
      await saveAppData(appData);
    }

    // Fire-and-forget: daily due-task summary notification (desktop only)
    maybeNotifyDueTasks(appData).catch(err => console.error('Due reminder failed:', err));
  } catch (error) {
    lastError = error instanceof Error ? error.message : 'Failed to load data';
    console.error('Failed to initialize data:', error);
  } finally {
    isLoading = false;
  }
}

// Reload specific data file (called when file changes externally)
export async function reloadData(fileType: string): Promise<void> {
  try {
    if (fileType === 'legacy') {
      appData = await loadAppData();
      return;
    }

    if (fileType !== 'active' && fileType !== 'archive' && fileType !== 'pomodoro_history') {
      return;
    }

    const data = await reloadFile(fileType);
    if (!data) return;

    switch (fileType) {
      case 'active': {
        const activeData = data as ActiveData;
        appData = {
          ...appData,
          version: activeData.version,
          lastModified: activeData.lastModified,
          tasks: activeData.tasks || [],
          reviews: activeData.reviews || [],
          customTagGroups: activeData.customTagGroups || appData.customTagGroups,
          settings: activeData.settings || appData.settings,
          cycleState: activeData.cycleState ?? appData.cycleState,
          cycleHistory: activeData.cycleHistory ?? appData.cycleHistory
        };
        break;
      }
      case 'pomodoro_history': {
        const pomodoroData = data as PomodoroHistoryData;
        appData = {
          ...appData,
          pomodoroHistory: pomodoroData.sessions || []
        };
        break;
      }
    }
  } catch (error) {
    console.error('Failed to reload data:', error);
  }
}

// Persist changes
async function persist(filesToSave: ('active' | 'pomodoro_history')[] = ['active']): Promise<void> {
  try {
    await saveAppData(appData, filesToSave);
  } catch (error) {
    lastError = error instanceof Error ? error.message : 'Failed to save data';
    console.error('Failed to persist data:', error);
  }
}

// Task operations
/**
 * Result of an add attempt. `quotaExceeded` lets callers detect a quota refusal
 * structurally — matching on the localized `error` text broke the moment the
 * user switched language.
 */
export interface AddTaskResult {
  success: boolean;
  error?: string;
  quotaExceeded?: boolean;
  /** An incumbent A pushed down a tier to make room for this one. */
  demoted?: { name: string; to: Priority } | null;
  /**
   * An incumbent A with nowhere left to go. It has been removed from the unit
   * and belongs back in the candidate pool — callers must say so, or the task
   * looks like it vanished.
   */
  evicted?: { name: string } | null;
}

interface HighlanderOutcome {
  tasks: Task[];
  demoted: { name: string; to: Priority } | null;
  evicted: { name: string } | null;
}

/**
 * Run the Highlander rule and flatten its result into something the UI can
 * report. Every add/move path goes through here so they cannot drift.
 */
function runHighlander(tasks: Task[], newTask: Task): HighlanderOutcome {
  const result = applyHighlanderRule(tasks, newTask);
  const demoted = result.demoted[0];
  const evicted = result.evicted[0];
  return {
    tasks: result.tasks,
    demoted: demoted ? { name: demoted.task.content, to: demoted.to } : null,
    evicted: evicted ? { name: evicted.content } : null
  };
}

export async function addTask(input: string, force = false): Promise<AddTaskResult> {
  return addTaskDirect(createTaskFromInput(input), force);
}

export async function addTaskDirect(task: Task, force = false): Promise<AddTaskResult> {
  // A single-slot tier is exempt from the quota check: Highlander unseats the
  // incumbent instead of refusing the add.
  const quotaError = isSingleSlotPriority(task.priority) ? null : validateQuota(appData.tasks, task.priority);
  if (quotaError && !force) {
    return { success: false, error: quotaError, quotaExceeded: true };
  }

  const outcome = runHighlander(appData.tasks, task);
  appData.tasks = [...outcome.tasks, task];
  await persist();

  return { success: true, demoted: outcome.demoted, evicted: outcome.evicted };
}

export async function updateTask(taskId: string, updates: Partial<Task>): Promise<void> {
  const existingTask = appData.tasks.find(task => task.id === taskId);
  let nextTasks = appData.tasks.map(task => {
    if (task.id === taskId) {
      return { ...task, ...updates };
    }
    return task;
  });

  // Handle priority change with Highlander rule after the task has been updated.
  if (existingTask && updates.priority === 'A' && existingTask.priority !== 'A') {
    const promotedTask = nextTasks.find(task => task.id === taskId);
    if (promotedTask) {
      nextTasks = runHighlander(nextTasks, promotedTask).tasks;
    }
  }

  appData.tasks = nextTasks;

  await persist();
}

// Cancel a task (move to H priority)
export async function cancelTask(taskId: string): Promise<void> {
  appData.tasks = appData.tasks.map(task => {
    if (task.id === taskId && isOperablePriority(task.priority)) {
      return {
        ...task,
        originalPriority: task.priority, // Save original priority for retention period calculation
        priority: 'H' as Priority,
        completedAt: new Date().toISOString()
      };
    }
    return task;
  });
  await persist();
}

// Alias for backward compatibility - now cancels task instead of deleting
export async function deleteTask(taskId: string): Promise<void> {
  return cancelTask(taskId);
}

export async function completeTask(taskId: string): Promise<void> {
  // Find the task first to check for recurrence
  const taskToComplete = appData.tasks.find(t => t.id === taskId && isOperablePriority(t.priority));
  let nextRecurringTask: Task | null = null;

  // One completion instant, used both to stamp the task and to seed the next
  // occurrence. A loose recurrence counts from the completion date, and the
  // regeneration happens before `completedAt` is written — so the moment has to
  // be passed in explicitly rather than read back off the task.
  const completedOn = new Date();

  // Create next occurrence before modifying the task
  if (taskToComplete) {
    nextRecurringTask = createNextOccurrence(taskToComplete, completedOn);
  }

  // Move task to G (completed) priority, preserving original priority for retention display
  appData.tasks = appData.tasks.map(task => {
    if (task.id === taskId && isOperablePriority(task.priority)) {
      return {
        ...task,
        originalPriority: task.priority, // Save original priority for retention period calculation
        priority: 'G' as Priority,
        completed: true,
        completedAt: new Date().toISOString()
      };
    }
    return task;
  });

  // Add next recurring task
  if (nextRecurringTask) {
    const quotaError = isSingleSlotPriority(nextRecurringTask.priority)
      ? null
      : validateQuota(appData.tasks.filter(t => isActivePriority(t.priority)), nextRecurringTask.priority);
    if (!quotaError) {
      appData.tasks = [...runHighlander(appData.tasks, nextRecurringTask).tasks, nextRecurringTask];
    }
  }

  await persist();

  // Mark the source line complete in the shared todo.txt. Deliberately after
  // persist: a failure here must not lose the completion the user just made,
  // and the file write is reported separately.
  if (taskToComplete?.source) {
    const outcome = await writeBackCompletion(taskToComplete, completedOn);
    if (outcome) lastWriteBackNotice = outcome;
  }
}

// ============================================================================
// todo.txt candidate pool
// ============================================================================

/**
 * Result of the last write-back attempt, for the UI to surface.
 *
 * Write-back failures are never silent and never fatal: the completion stands
 * in FocusFlow either way, and the user is told the shared file could not be
 * updated so they can fix it by hand.
 */
export interface WriteBackNotice {
  kind: 'missing' | 'ambiguous' | 'error';
  taskName: string;
  detail?: string;
}

let lastWriteBackNotice = $state<WriteBackNotice | null>(null);

export function clearWriteBackNotice(): void {
  lastWriteBackNotice = null;
}

/**
 * Mark a pulled task's source line complete, in place.
 *
 * Everything else on that line survives — this is a single-token edit, not a
 * re-serialisation of the task. See docs/SLEEK-INTEROP.md §5.
 */
async function writeBackCompletion(task: Task, completedOn: Date): Promise<WriteBackNotice | null> {
  const source = task.source;
  if (!source) return null;

  try {
    const paths = [source.file, appData.settings.doneFilePath].filter(Boolean) as string[];

    for (const path of paths) {
      const content = await readTodoFile(path);
      if (content === null) continue;

      const lines = splitLines(content);
      const match = findSourceLine(lines, source.raw);
      if (match.index === -1) continue;

      lines[match.index] = markLineComplete(lines[match.index], formatDateISO(completedOn));
      await writeTodoFile(path, `${lines.join('\n')}\n`);

      return match.ambiguous
        ? { kind: 'ambiguous', taskName: task.content }
        : null;
    }

    // The line is gone — the user may have deleted or rewritten it in sleek.
    // Guessing at a replacement would rewrite somebody else's task.
    return { kind: 'missing', taskName: task.content };
  } catch (error) {
    return { kind: 'error', taskName: task.content, detail: String(error) };
  }
}

export interface Candidate {
  /** The parsed task, not yet added to the unit. */
  task: Task;
  /** The source line, verbatim. */
  raw: string;
  hidden: boolean;
}

export interface CandidateList {
  candidates: Candidate[];
  /** Lines skipped because they are already in the unit. */
  alreadyPulled: number;
  error?: string;
}

/**
 * Read the candidate pool.
 *
 * Completed lines are skipped (they are not candidates), and so are lines
 * already pulled into the unit — matched on the verbatim source text, the same
 * key the write-back uses.
 */
export async function loadCandidates(includeHidden = false): Promise<CandidateList> {
  const path = appData.settings.todoFilePath;
  if (!path) {
    return { candidates: [], alreadyPulled: 0, error: t('inbox.noFileConfigured') };
  }

  try {
    const content = await readTodoFile(path);
    if (content === null) return { candidates: [], alreadyPulled: 0 };

    const pulled = new Set(
      appData.tasks.filter(task => task.source?.file === path).map(task => task.source!.raw)
    );

    const candidates: Candidate[] = [];
    let alreadyPulled = 0;

    for (const raw of splitLines(content)) {
      const imported = taskFromTodoTxt(raw, DEFAULT_PRIORITY);
      if (imported.task.completed) continue;
      if (imported.hidden && !includeHidden) continue;
      if (pulled.has(raw)) {
        alreadyPulled++;
        continue;
      }
      candidates.push({ task: imported.task, raw, hidden: imported.hidden });
    }

    return { candidates, alreadyPulled };
  } catch (error) {
    return { candidates: [], alreadyPulled: 0, error: String(error) };
  }
}

/**
 * Pull one candidate into the current unit.
 *
 * The source line stays where it is — pulling copies. The only thing written
 * back is the origin marker, and only when `writeBackOrigin` is on, so that
 * `@主` / `@被` is visible and filterable on the sleek side too.
 */
export async function pullCandidate(
  candidate: Candidate,
  priority: Priority,
  origin: TaskOrigin | null
): Promise<AddTaskResult> {
  const path = appData.settings.todoFilePath;
  if (!path) return { success: false, error: t('inbox.noFileConfigured') };

  const task: Task = {
    ...candidate.task,
    priority,
    unitStart: currentUnitStartLocal(),
    contexts: withOrigin(candidate.task.contexts, origin),
    source: { file: path, raw: candidate.raw, pulledAt: new Date().toISOString() }
  };

  const result = await addTaskDirect(task, true);
  if (!result.success) return result;

  if (origin && appData.settings.writeBackOrigin) {
    await markOriginOnSourceLine(path, candidate.raw, origin, task.id);
  }

  return result;
}

/**
 * Append the origin context to the source line, and remember the new text.
 *
 * The stored `source.raw` has to move with it: the line on disk has changed, so
 * a later write-back matching on the old text would fall through to the fuzzy
 * path for no reason.
 */
async function markOriginOnSourceLine(
  path: string,
  raw: string,
  origin: TaskOrigin,
  taskId: string
): Promise<void> {
  try {
    const content = await readTodoFile(path);
    if (content === null) return;

    const lines = splitLines(content);
    const match = findSourceLine(lines, raw);
    if (match.index === -1) return;

    let line = lines[match.index];
    for (const marker of Object.values(ORIGIN_CONTEXT)) {
      line = removeContextFromLine(line, marker);
    }
    line = addContextToLine(line, ORIGIN_CONTEXT[origin]);
    if (line === lines[match.index]) return;

    lines[match.index] = line;
    await writeTodoFile(path, `${lines.join('\n')}\n`);

    appData.tasks = appData.tasks.map(task =>
      task.id === taskId && task.source ? { ...task, source: { ...task.source, raw: line } } : task
    );
    await persist();
  } catch (error) {
    // Cosmetic on the sleek side; the task is already in the unit either way.
    console.error('Failed to mark origin on source line:', error);
  }
}

/**
 * Write the tasks parked by the 4.0 → 5.0 migration out to the candidate pool.
 *
 * `pendingExport` is only cleared once the write succeeds, so a failure here
 * leaves the data exactly where it was rather than dropping it.
 */
export async function exportPendingTasks(): Promise<{ exported: number; error?: string }> {
  const path = appData.settings.todoFilePath;
  if (!path) return { exported: 0, error: t('inbox.noFileConfigured') };

  const pending = appData.pendingExport ?? [];
  if (pending.length === 0) return { exported: 0 };

  try {
    const lines = pending.map(task => {
      const line = todoTxtFromTask(task);
      // A task with no threshold date was a "not now" item with no date
      // attached; h:1 is how todo.txt says that.
      return task.thresholdDate || task.completed ? line : `${line} h:1`;
    });

    await appendTodoLines(path, lines);

    appData.pendingExport = undefined;
    await persist();

    return { exported: lines.length };
  } catch (error) {
    return { exported: 0, error: String(error) };
  }
}

// Evolve a task: complete the original and create a new evolved task
// The new task inherits priority, projects, contexts, tags, and pomodoro estimates
export async function evolveTask(taskId: string, newContent?: string): Promise<{ success: boolean; newTaskId?: string; error?: string }> {
  const originalTask = appData.tasks.find(t => t.id === taskId && isActivePriority(t.priority));
  if (!originalTask) {
    return { success: false, error: 'Task not found or already completed' };
  }

  // Create the evolved task
  const now = new Date().toISOString();
  const evolvedTask: Task = {
    id: crypto.randomUUID(),
    content: newContent || originalTask.content,
    priority: originalTask.priority,
    completed: false,
    completedAt: null,
    createdAt: now,
    unitStart: currentUnitStartLocal(),
    projects: [...originalTask.projects],
    contexts: [...originalTask.contexts],
    customTags: [...originalTask.customTags],
    dueDate: originalTask.dueDate, // Keep the same due date
    thresholdDate: null, // New evolved task is immediately visible
    recurrence: null, // Don't inherit recurrence - it's a new task
    pomodoros: {
      estimated: originalTask.pomodoros.estimated,
      completed: 0 // Reset completed pomodoros
    },
    notes: originalTask.notes,
    evolvedFrom: taskId // Track lineage
  };

  // Complete the original task
  appData.tasks = appData.tasks.map(task => {
    if (task.id === taskId) {
      return {
        ...task,
        originalPriority: task.priority,
        priority: 'G' as Priority,
        completed: true,
        completedAt: now
      };
    }
    return task;
  });

  // Add the evolved task
  appData.tasks = [...appData.tasks, evolvedTask];

  await persist();

  return { success: true, newTaskId: evolvedTask.id };
}

// Restore a task from G (completed) or H (cancelled) back to active state.
//
// It goes back to the tier it came from. There is no Idea Pool to park it in
// any more, and dropping it into an arbitrary tier would lose the one piece of
// information the record still carries about where it belongs.
export async function uncompleteTask(taskId: string): Promise<void> {
  const task = appData.tasks.find(t => t.id === taskId);
  if (!task || !isHiddenPriority(task.priority)) return;

  const target = task.originalPriority && isActivePriority(task.originalPriority)
    ? task.originalPriority
    : DEFAULT_PRIORITY;

  return restoreTask(taskId, target);
}

/**
 * Restore a task to a specific priority.
 *
 * An explicit restore is allowed to put a tier one over its quota. Quota is a
 * planning guardrail, not an invariant the data has to satisfy — the meter
 * shows the overflow, and refusing the user's own undo would be worse. The one
 * exception is A, where Highlander still applies: the restored task takes the
 * slot and the incumbent moves down.
 */
export async function restoreTask(taskId: string, targetPriority: Priority = DEFAULT_PRIORITY): Promise<void> {
  if (!isOperablePriority(targetPriority)) {
    targetPriority = DEFAULT_PRIORITY;
  }

  appData.tasks = appData.tasks.map(task => {
    if (task.id === taskId && (task.priority === 'G' || task.priority === 'H')) {
      return {
        ...task,
        priority: targetPriority,
        completed: false,
        completedAt: null
      };
    }
    return task;
  });

  await persist();
}

// Permanently delete a task (remove from G/H)
export async function permanentlyDeleteTask(taskId: string): Promise<void> {
  appData.tasks = appData.tasks.filter(t => t.id !== taskId);
  await persist();
}

// Replace the entire dataset (used by import). Persists to storage; callers
// should reload the app afterwards so all stores re-init from the new data.
export async function replaceAllData(newData: AppData): Promise<void> {
  appData = newData;
  await persist();
}

// Resolve a pending low-completion micro-review (W4b). 'rollover' carries the
// under-completed period's unfinished A-E tasks into the current window and
// marks it merged; 'dismiss' leaves tasks where they are. Either clears the prompt.
export async function resolvePendingReview(action: 'rollover' | 'dismiss'): Promise<void> {
  const cs = appData.cycleState;
  if (!cs?.pendingReview) return;

  if (action === 'rollover') {
    appData.tasks = rollUnfinishedIntoWindow(appData.tasks, cs.pendingReview.periodStart, cs.anchorStart, cs.windowEnd);
    appData.cycleState = { ...cs, merged: true, pendingReview: null };
  } else {
    appData.cycleState = { ...cs, pendingReview: null };
  }
  await persist();
}

// Priority tiers for detecting drastic changes
// Tier 1: A, B (high importance tasks)
// Tier 2: C (standard tasks)
// Tier 3: D, E (quick/temp tasks)
function getPriorityTier(priority: Priority): number {
  switch (priority) {
    case 'A': case 'B': return 1;
    case 'C': return 2;
    case 'D': case 'E': return 3;
    default: return 3;
  }
}

// Check if a priority change needs confirmation
export function needsPriorityChangeConfirmation(task: Task, newPriority: Priority): {
  needsConfirmation: boolean;
  reason?: 'drastic_change' | 'frequent_change';
  message?: string;
} {
  // Don't need confirmation if task doesn't exist or priority is the same
  if (!task || task.priority === newPriority) {
    return { needsConfirmation: false };
  }

  // Check for frequent changes (within 5 minutes)
  if (task.lastPriorityChangeAt) {
    const lastChange = new Date(task.lastPriorityChangeAt).getTime();
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;

    if (now - lastChange < fiveMinutes) {
      return {
        needsConfirmation: true,
        reason: 'frequent_change',
        message: t('message.frequentPriorityChange')
      };
    }
  }

  // Check for drastic tier changes (more than 1 tier difference)
  const currentTier = getPriorityTier(task.priority);
  const newTier = getPriorityTier(newPriority);
  const tierDiff = Math.abs(currentTier - newTier);

  if (tierDiff >= 2) {
    return {
      needsConfirmation: true,
      reason: 'drastic_change',
      message: t('message.drasticPriorityChange', { from: task.priority, to: newPriority })
    };
  }

  return { needsConfirmation: false };
}

export interface ChangePriorityResult {
  success: boolean;
  error?: string;
  needsConfirmation?: boolean;
  confirmationReason?: string;
  /** The incumbent A this move pushed down a tier, if any. */
  demotedIncumbent?: { name: string; to: Priority } | null;
  /** The incumbent A that had nowhere to go and left the unit, if any. */
  evictedIncumbent?: { name: string } | null;
}

export async function changePriority(taskId: string, newPriority: Priority, skipConfirmation = false): Promise<ChangePriorityResult> {
  const task = appData.tasks.find(t => t.id === taskId);
  if (!task) {
    return { success: false, error: 'Task not found' };
  }

  // A-E only through this function; use completeTask or cancelTask for G/H.
  if (!isOperablePriority(newPriority)) {
    return { success: false, error: 'Cannot change to hidden priority directly' };
  }

  // Check if confirmation is needed
  if (!skipConfirmation) {
    const confirmCheck = needsPriorityChangeConfirmation(task, newPriority);
    if (confirmCheck.needsConfirmation) {
      return {
        success: false,
        needsConfirmation: true,
        confirmationReason: confirmCheck.message,
        error: confirmCheck.message
      };
    }
  }

  const otherTasks = appData.tasks.filter(t => t.id !== taskId);

  // A is skipped: it is single-slot, and Highlander (inside updateTask) unseats
  // the incumbent rather than refusing the move.
  if (!isSingleSlotPriority(newPriority) && !canAddTask(otherTasks, newPriority)) {
    return { success: false, error: t('message.quotaExceeded', { priority: newPriority }) };
  }

  // Run Highlander here rather than leaning on updateTask's copy of it, so the
  // caller can report what happened to the incumbent.
  const moved: Task = { ...task, priority: newPriority, lastPriorityChangeAt: new Date().toISOString() };
  const outcome = runHighlander(
    appData.tasks.map(item => (item.id === taskId ? moved : item)),
    moved
  );

  appData.tasks = outcome.tasks;
  await persist();

  return { success: true, demotedIncumbent: outcome.demoted, evictedIncumbent: outcome.evicted };
}

export async function incrementPomodoro(taskId: string): Promise<void> {
  appData.tasks = appData.tasks.map(task => {
    if (task.id === taskId) {
      return {
        ...task,
        pomodoros: {
          ...task.pomodoros,
          completed: task.pomodoros.completed + 1
        }
      };
    }
    return task;
  });

  await persist();
}

// Reorder tasks within a priority zone (for drag-and-drop) or move between zones
export async function reorderTask(priority: Priority, newOrderedTasks: Task[], promotedTaskId?: string): Promise<void> {
  // Only allow reordering to active priorities
  if (!isActivePriority(priority)) {
    return;
  }

  const newIds = new Set(newOrderedTasks.map(t => t.id));

  // Get all tasks that are NOT in the new list
  const otherTasks = appData.tasks.filter(t => !newIds.has(t.id));

  // Update priority for tasks in the new list
  let updatedNewTasks = newOrderedTasks.map(t => {
    if (t.priority !== priority) {
       return { ...t, priority };
    }
    return t;
  });

  let nextTasks = [...otherTasks, ...updatedNewTasks];

  if (priority === 'A') {
    const keeperId = promotedTaskId || newOrderedTasks[0]?.id;
    nextTasks = nextTasks.map(task => {
      if (task.id !== keeperId && task.priority === 'A' && !task.completed) {
        return { ...task, priority: 'B' as Priority };
      }
      return task;
    });
  }

  appData.tasks = nextTasks;

  await persist();
}

// Filter operations
export function setFilter(newFilter: Partial<FilterState>): void {
  filter = { ...filter, ...newFilter };
}

/**
 * Toggle a single filter attribute. If the current value matches `value`,
 * the filter is cleared. Otherwise it's set to `value`. Used by clickable
 * chips on TaskCard (sleek-style attribute interactivity).
 */
export function toggleFilterAttribute(
  attribute: 'project' | 'context' | 'tag' | 'priority',
  value: string
): void {
  const current = filter[attribute];
  filter = { ...filter, [attribute]: current === value ? null : value };
}

/**
 * Check if a given attribute/value is currently the active filter.
 * Used by TaskCard to render the 'active' visual state on chips.
 */
export function isFilterActive(
  attribute: 'project' | 'context' | 'tag' | 'priority',
  value: string
): boolean {
  return filter[attribute] === value;
}

export function clearFilters(): void {
  filter = {
    project: null,
    context: null,
    tag: null,
    showCompleted: false,
    dueFilter: null,
    showFutureTasks: false,
    priority: null,
    pomodoroFilter: null
  };
}

export function setSearchQuery(query: string): void {
  searchQuery = query;
}

// Unit navigation
export function setCurrentUnit(unit: UnitInfo): void {
  currentUnit = unit;
}

// Derived values - Step 1: the quota-bearing A-E tiers.
const activeTasks = $derived(appData.tasks.filter(t => isActivePriority(t.priority)));

// Tasks that count toward cross-cutting aggregations (sidebar project/context/
// tag badges, etc.) — everything not hidden (G/H).
const countedTasks = $derived(appData.tasks.filter(t => isCountedPriority(t.priority)));

// Flow metrics: how work is moving, as opposed to how much of it there has been.
//
// Measured over the tasks in this unit only — the candidate pool is deliberately
// excluded. A line sitting untouched in the todo.txt is inventory, and inventory
// is supposed to sit; counting its age as debt would punish the user for keeping
// a backlog, which is the one thing the backlog is for. What these numbers
// measure is work already promised.
const flowAge = $derived(ageDistribution(appData.tasks));
// Completions live in active.json for 14 days before moving to cold storage, so
// this window is "recently finished", not "ever finished". That is the right
// window anyway: an estimation habit from six months ago is not evidence about
// the current one.
const flowCycleTime = $derived(cycleTimeMedian(appData.tasks));
const flowEstimation = $derived(estimationFactor(appData.tasks));
const flowSamplesNeeded = $derived(samplesUntilReady(appData.tasks));

// Derived values - Step 2: Filter by threshold date
const visibleTasks = $derived.by(() => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  if (filter.showFutureTasks) {
    return activeTasks.filter(t => {
      if (!t.thresholdDate) return false;
      const threshold = new Date(t.thresholdDate);
      threshold.setHours(0, 0, 0, 0);
      return threshold > now;
    });
  }

  return activeTasks.filter(t => {
    if (!t.thresholdDate) return true;
    const threshold = new Date(t.thresholdDate);
    threshold.setHours(0, 0, 0, 0);
    return threshold <= now;
  });
});

// Derived values - Step 3: Apply search
const searchedTasks = $derived.by(() => {
  if (!searchQuery) return visibleTasks;
  
  const query = searchQuery.toLowerCase();
  return visibleTasks.filter(t =>
    t.content.toLowerCase().includes(query) ||
    t.projects.some(p => p.toLowerCase().includes(query)) ||
    t.contexts.some(c => c.toLowerCase().includes(query)) ||
    t.customTags.some(tag => tag.toLowerCase().includes(query))
  );
});

// Derived values - Step 4: Apply filters (Project, Context, Tag, Due, Pomodoro)
const filteredTasks = $derived.by(() => {
  let tasks = searchedTasks;

  // Apply project filter
  if (filter.project) {
    tasks = tasks.filter(t => t.projects.includes(filter.project!));
  }

  // Apply context filter
  if (filter.context) {
    tasks = tasks.filter(t => t.contexts.includes(filter.context!));
  }

  // Apply tag filter
  if (filter.tag) {
    tasks = tasks.filter(t => t.customTags.includes(filter.tag!));
  }

  // Apply due filter
  if (filter.dueFilter === 'today') {
    tasks = tasks.filter(t => t.dueDate && (isToday(t.dueDate) || isOverdue(t.dueDate)));
  } else if (filter.dueFilter === 'thisWeek') {
    tasks = tasks.filter(t => t.dueDate && isThisWeek(t.dueDate));
  } else if (filter.dueFilter === 'overdue') {
    tasks = tasks.filter(t => isOverdue(t.dueDate));
  }

  // Apply pomodoro filter
  if (filter.pomodoroFilter !== null) {
    tasks = tasks.filter(t => t.pomodoros.estimated === filter.pomodoroFilter);
  }

  if (filter.priority) {
    tasks = tasks.filter(t => t.priority === filter.priority);
  }

  return tasks;
});

const tasksByPriority = $derived.by(() => {
  const byPriority: Record<Priority, Task[]> = {
    A: [],
    B: [],
    C: [],
    D: [],
    E: [],
    G: [],
    H: []
  };

  for (const task of filteredTasks) {
    if (byPriority[task.priority]) {
      byPriority[task.priority].push(task);
    }
  }

  return byPriority;
});

// Completed tasks (G priority)
const completedTasks = $derived(
  appData.tasks.filter(t => t.priority === 'G')
    .sort((a, b) => {
      const dateA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const dateB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      return dateB - dateA;
    })
);

// Cancelled tasks (H priority)
const cancelledTasks = $derived(
  appData.tasks.filter(t => t.priority === 'H')
    .sort((a, b) => {
      const dateA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const dateB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      return dateB - dateA;
    })
);

// The week's focus project — what the S tier used to be, expressed as an
// ordinary todo.txt `+project` tag. Its "subtasks" are just tasks carrying the
// same tag, so unlike the old embedded checklist they can each hold their own
// priority, due date and pomodoro estimate.
const focusProjectTasks = $derived.by(() => {
  const project = appData.settings.focusProject;
  if (!project) return [];
  return appData.tasks.filter(t => isActivePriority(t.priority) && t.projects.includes(project));
});

// Progress across everything tagged with the focus project, completed tasks
// included — the number the old subtask checklist used to show.
const focusProjectProgress = $derived.by(() => {
  const project = appData.settings.focusProject;
  if (!project) return { done: 0, total: 0, ratio: 0 };

  const tagged = appData.tasks.filter(t => t.projects.includes(project) && t.priority !== 'H');
  const done = tagged.filter(t => t.completed).length;
  return { done, total: tagged.length, ratio: tagged.length === 0 ? 0 : done / tagged.length };
});

// Project/context aggregations use countedTasks (everything not completed or
// cancelled) so the sidebar counts match what the user can still act on.
const allProjects = $derived.by(() => {
  const projects = new Set<string>();
  for (const task of countedTasks) {
    for (const project of task.projects) {
      projects.add(project);
    }
  }
  return Array.from(projects).sort();
});

const allContexts = $derived.by(() => {
  const contexts = new Set<string>();
  for (const task of countedTasks) {
    for (const context of task.contexts) {
      contexts.add(context);
    }
  }
  return Array.from(contexts).sort();
});

const projectCounts = $derived.by(() => {
  const counts: Record<string, number> = {};
  for (const task of countedTasks) {
    for (const project of task.projects) {
      counts[project] = (counts[project] || 0) + 1;
    }
  }
  return counts;
});

const contextCounts = $derived.by(() => {
  const counts: Record<string, number> = {};
  for (const task of countedTasks) {
    for (const context of task.contexts) {
      counts[context] = (counts[context] || 0) + 1;
    }
  }
  return counts;
});

const dueTodayCount = $derived(
  activeTasks.filter(t => t.dueDate && (isToday(t.dueDate) || isOverdue(t.dueDate))).length
);

const dueThisWeekCount = $derived(
  activeTasks.filter(t => t.dueDate && isThisWeek(t.dueDate)).length
);

const overdueCount = $derived(
  activeTasks.filter(t => isOverdue(t.dueDate)).length
);

const futureTasksCount = $derived(
  activeTasks.filter(t => !isThresholdPassed(t)).length
);

const dailyRecurringCount = $derived(
  activeTasks.filter(t => t.recurrence?.n === 1 && t.recurrence.unit === 'd').length
);

const weeklyRecurringCount = $derived(
  activeTasks.filter(t => t.recurrence?.n === 1 && t.recurrence.unit === 'w').length
);

const completedTodayCount = $derived(
  appData.tasks.filter(t => t.priority === 'G' && t.completedAt && isToday(t.completedAt)).length
);

// Recently completed tasks within retention period, grouped by original priority
// These will be shown with strikethrough in their original zone
const recentlyCompletedTasksByPriority = $derived.by(() => {
  const byPriority: Record<Priority, Task[]> = {
    A: [], B: [], C: [], D: [], E: [], G: [], H: []
  };

  const recentlyCompleted = appData.tasks.filter(t =>
    t.priority === 'G' && isWithinRetentionPeriod(t)
  );

  for (const task of recentlyCompleted) {
    const originalPriority = task.originalPriority || DEFAULT_PRIORITY;
    if (byPriority[originalPriority]) {
      byPriority[originalPriority].push(task);
    }
  }

  // Sort each group by completion time (most recent first)
  for (const priority of Object.keys(byPriority) as Priority[]) {
    byPriority[priority].sort((a, b) => {
      const dateA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const dateB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      return dateB - dateA;
    });
  }

  return byPriority;
});

// Export store interface
export function getTasksStore() {
  return {
    get appData() { return appData; },
    get tasks() { return appData.tasks; },
    get activeTasks() { return activeTasks; },
    get countedTasks() { return countedTasks; },
    get completedTasks() { return completedTasks; },
    get cancelledTasks() { return cancelledTasks; },
    get focusProjectTasks() { return focusProjectTasks; },
    get focusProjectProgress() { return focusProjectProgress; },
    get pendingExport() { return appData.pendingExport ?? []; },
    get lastWriteBackNotice() { return lastWriteBackNotice; },
    get isLoading() { return isLoading; },
    get lastError() { return lastError; },
    get currentUnit() { return currentUnit; },
    get filter() { return filter; },
    get searchQuery() { return searchQuery; },
    get filteredTasks() { return filteredTasks; },
    get tasksByPriority() { return tasksByPriority; },
    get allProjects() { return allProjects; },
    get allContexts() { return allContexts; },
    get projectCounts() { return projectCounts; },
    get contextCounts() { return contextCounts; },
    get dueTodayCount() { return dueTodayCount; },
    get dueThisWeekCount() { return dueThisWeekCount; },
    get overdueCount() { return overdueCount; },
    get futureTasksCount() { return futureTasksCount; },
    get dailyRecurringCount() { return dailyRecurringCount; },
    get weeklyRecurringCount() { return weeklyRecurringCount; },
    get completedTodayCount() { return completedTodayCount; },
    get recentlyCompletedTasksByPriority() { return recentlyCompletedTasksByPriority; },
    get customTagGroups() { return appData.customTagGroups; },
    get settings() { return appData.settings; },
    get cycleState() { return appData.cycleState; },
    get cycleHistory() { return appData.cycleHistory ?? []; },
    get flowAge() { return flowAge; },
    get flowCycleTime() { return flowCycleTime; },
    get flowEstimation() { return flowEstimation; },
    get flowSamplesNeeded() { return flowSamplesNeeded; }
  };
}
