import type { Task, Subtask, Priority, FilterState, UnitInfo, AppData, ActiveData, PomodoroHistoryData } from '$lib/types';
import { createEmptyTask, createDefaultAppData, isThresholdPassed, calculateEZoneAge, isActivePriority, isCountedPriority, isFuturePriority, isSustainedPriority, isOperablePriority, createSubtask, ACTIVE_PRIORITIES, isWithinRetentionPeriod } from '$lib/types';
import { loadAppData, saveAppData, reloadFile } from '$lib/utils/storage';
import { applyHighlanderRule, canAddTask, validateQuota } from '$lib/utils/quota';
import { createTaskFromInput } from '$lib/utils/parser';
import { processRecurringTasks, createNextOccurrence } from '$lib/utils/recurrence';
import { getCurrentUnit, isDateInUnit, isToday, isOverdue, isThisWeek } from '$lib/utils/unitCalc';
import { t } from '$lib/i18n';
import { getGamificationStore } from './gamification.svelte';

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
  
  const originalCount = appData.tasks.length;
  
  appData.tasks = appData.tasks.filter(task => {
    // If task is cancelled (H priority)
    if (task.priority === 'H') {
      if (!task.completedAt) return true; // Keep if no timestamp (shouldn't happen but safe)
      
      const cancelledTime = new Date(task.completedAt).getTime();
      // If cancelled more than 2 days ago, delete it
      if (now - cancelledTime > twoDaysMs) {
        return false;
      }
    }
    
    return true;
  });
  
  if (appData.tasks.length !== originalCount) {
    console.log(`Cleaned up ${originalCount - appData.tasks.length} old cancelled tasks`);
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

    // Cleanup old tasks (Cancelled > 2 days)
    cleanupOldTasks();

    // Process recurring tasks
    const newRecurringTasks = processRecurringTasks(appData.tasks.filter(t => isActivePriority(t.priority)));
    let dataChanged = newRecurringTasks.length > 0;
    if (dataChanged) {
      appData.tasks = [...appData.tasks, ...newRecurringTasks];
    }

    if (dataChanged) {
      await saveAppData(appData);
    }
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
          gamification: activeData.gamification || appData.gamification
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
export async function addTask(input: string, force = false): Promise<{ success: boolean; error?: string }> {
  const task = createTaskFromInput(input);

  // Validate quota
  const quotaError = task.priority === 'A' ? null : validateQuota(appData.tasks, task.priority);
  if (quotaError && !force) {
    return { success: false, error: quotaError };
  }

  // Apply Highlander rule for A priority
  if (task.priority === 'A') {
    appData.tasks = applyHighlanderRule(appData.tasks, task);
  }

  appData.tasks = [...appData.tasks, task];
  await persist();

  return { success: true };
}

export async function addTaskDirect(task: Task, force = false): Promise<{ success: boolean; error?: string }> {
  const quotaError = task.priority === 'A' ? null : validateQuota(appData.tasks, task.priority);
  if (quotaError && !force) {
    return { success: false, error: quotaError };
  }

  if (task.priority === 'A') {
    appData.tasks = applyHighlanderRule(appData.tasks, task);
  }

  appData.tasks = [...appData.tasks, task];
  await persist();

  return { success: true };
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
      nextTasks = applyHighlanderRule(nextTasks, promotedTask);
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

  // Create next occurrence before modifying the task
  if (taskToComplete?.recurrence?.pattern && taskToComplete.dueDate) {
    nextRecurringTask = createNextOccurrence(taskToComplete);
  }

  // Record task completion for gamification (before modifying priority)
  if (taskToComplete) {
    const gamification = getGamificationStore();
    gamification.recordTaskCompletion(taskToComplete);
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
    const quotaError = nextRecurringTask.priority === 'A'
      ? null
      : validateQuota(appData.tasks.filter(t => isActivePriority(t.priority)), nextRecurringTask.priority);
    if (!quotaError) {
      if (nextRecurringTask.priority === 'A') {
        appData.tasks = applyHighlanderRule(appData.tasks, nextRecurringTask);
      }
      appData.tasks = [...appData.tasks, nextRecurringTask];
    }
  }

  await persist();
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
    unitStart: now.split('T')[0],
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

  // Record gamification for completing the original task
  const gamification = getGamificationStore();
  gamification.recordTaskCompletion(originalTask);

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

// Restore a task from G (completed) or H (cancelled) back to active state
export async function uncompleteTask(taskId: string): Promise<void> {
  appData.tasks = appData.tasks.map(task => {
    if (task.id === taskId && (task.priority === 'G' || task.priority === 'H')) {
      return {
        ...task,
        priority: 'F' as Priority, // Restore to Idea Pool by default
        completed: false,
        completedAt: null
      };
    }
    return task;
  });

  await persist();
}

// Restore a task to a specific priority
export async function restoreTask(taskId: string, targetPriority: Priority = 'F'): Promise<void> {
  // Only allow restoring to operable (active or future) priorities
  if (!isOperablePriority(targetPriority)) {
    targetPriority = 'F';
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

// ============================================================================
// Subtask operations — embedded lightweight checklist items on a parent Task
// ============================================================================

export async function addSubtask(taskId: string, content: string): Promise<void> {
  const trimmed = content.trim();
  if (!trimmed) return;
  appData.tasks = appData.tasks.map(task => {
    if (task.id === taskId) {
      const subtasks = [...(task.subtasks ?? []), createSubtask(trimmed)];
      return { ...task, subtasks };
    }
    return task;
  });
  await persist();
}

export async function removeSubtask(taskId: string, subtaskId: string): Promise<void> {
  appData.tasks = appData.tasks.map(task => {
    if (task.id === taskId && task.subtasks) {
      return { ...task, subtasks: task.subtasks.filter(s => s.id !== subtaskId) };
    }
    return task;
  });
  await persist();
}

export async function toggleSubtask(taskId: string, subtaskId: string): Promise<void> {
  const nowIso = new Date().toISOString();
  appData.tasks = appData.tasks.map(task => {
    if (task.id === taskId && task.subtasks) {
      return {
        ...task,
        subtasks: task.subtasks.map(s => {
          if (s.id !== subtaskId) return s;
          const next = !s.completed;
          return { ...s, completed: next, completedAt: next ? nowIso : null };
        })
      };
    }
    return task;
  });
  await persist();
}

// Promote a subtask out of its parent into a standalone task at target priority.
// The subtask is removed from the parent. The new task inherits the subtask's
// content and the parent's projects/contexts/tags as default classification.
export async function promoteSubtask(
  parentTaskId: string,
  subtaskId: string,
  targetPriority: Priority
): Promise<{ success: boolean; error?: string }> {
  const parent = appData.tasks.find(t => t.id === parentTaskId);
  if (!parent || !parent.subtasks) {
    return { success: false, error: 'Parent task not found' };
  }
  const subtask = parent.subtasks.find(s => s.id === subtaskId);
  if (!subtask) {
    return { success: false, error: 'Subtask not found' };
  }
  if (!isOperablePriority(targetPriority)) {
    return { success: false, error: 'Invalid target priority' };
  }

  // Quota check (skip for A — handled by Highlander below; skip for F — unlimited).
  // canAddTask handles S and N internally; pass full task list so S count is accurate.
  if (targetPriority !== 'A' && targetPriority !== 'F') {
    if (!canAddTask(appData.tasks, targetPriority)) {
      return { success: false, error: t('message.quotaExceeded', { priority: targetPriority }) };
    }
  }

  // Build the new standalone task from the subtask content
  const now = new Date().toISOString();
  const newTask: Task = {
    id: crypto.randomUUID(),
    content: subtask.content,
    priority: targetPriority,
    completed: false,
    completedAt: null,
    createdAt: now,
    unitStart: now.split('T')[0],
    projects: [...parent.projects],
    contexts: [...parent.contexts],
    customTags: [...parent.customTags],
    dueDate: null,
    thresholdDate: null,
    recurrence: null,
    pomodoros: { estimated: 0, completed: 0 },
    notes: '',
    evolvedFrom: parentTaskId
  };

  // Apply Highlander if needed
  let nextTasks = [...appData.tasks];
  if (targetPriority === 'A') {
    nextTasks = applyHighlanderRule(nextTasks, newTask);
  }
  // Append new task
  nextTasks = [...nextTasks, newTask];
  // Remove subtask from parent
  nextTasks = nextTasks.map(item => {
    if (item.id === parentTaskId && item.subtasks) {
      return { ...item, subtasks: item.subtasks.filter(s => s.id !== subtaskId) };
    }
    return item;
  });
  appData.tasks = nextTasks;
  await persist();
  return { success: true };
}

export async function updateSubtaskContent(taskId: string, subtaskId: string, content: string): Promise<void> {
  const trimmed = content.trim();
  if (!trimmed) {
    return removeSubtask(taskId, subtaskId);
  }
  appData.tasks = appData.tasks.map(task => {
    if (task.id === taskId && task.subtasks) {
      return {
        ...task,
        subtasks: task.subtasks.map(s => s.id === subtaskId ? { ...s, content: trimmed } : s)
      };
    }
    return task;
  });
  await persist();
}

// Activate a future-progress (N) task into an active priority (A-F).
// Subject to the target priority's quota.
export async function activateFutureTask(
  taskId: string,
  targetPriority: Priority = 'F'
): Promise<{ success: boolean; error?: string }> {
  const task = appData.tasks.find(t => t.id === taskId);
  if (!task) return { success: false, error: 'Task not found' };
  if (!isFuturePriority(task.priority)) {
    return { success: false, error: 'Task is not in future-progress' };
  }
  if (!isOperablePriority(targetPriority)) {
    return { success: false, error: 'Invalid target priority' };
  }

  // S Highlander: if activating into S and another S exists, demote it to B first.
  // Surface a quota failure (e.g. B is full) before mutating anything else.
  if (isSustainedPriority(targetPriority)) {
    const existingS = appData.tasks.find(t => t.id !== taskId && t.priority === 'S' && !t.completed);
    if (existingS) {
      const demote = await changePriority(existingS.id, 'B', true);
      if (!demote.success) {
        return { success: false, error: demote.error || t('zone.demoteFailed') };
      }
    }
  }

  // Quota check — skip A (Highlander handles it) and S (handled above).
  // canAddTask understands all priority types; pass full task list so S/N are counted correctly.
  const otherTasks = appData.tasks.filter(t => t.id !== taskId);
  if (targetPriority !== 'A' && !isSustainedPriority(targetPriority) && !canAddTask(otherTasks, targetPriority)) {
    return { success: false, error: t('message.quotaExceeded', { priority: targetPriority }) };
  }

  // Apply Highlander rule if activating to A
  let nextTasks = appData.tasks.map(item => {
    if (item.id === taskId) {
      return {
        ...item,
        priority: targetPriority,
        lastPriorityChangeAt: new Date().toISOString()
      };
    }
    return item;
  });

  if (targetPriority === 'A') {
    const promoted = nextTasks.find(t => t.id === taskId);
    if (promoted) {
      nextTasks = applyHighlanderRule(nextTasks, promoted);
    }
  }

  appData.tasks = nextTasks;
  await persist();
  return { success: true };
}

// Priority tiers for detecting drastic changes
// Tier 1: A, B (high importance tasks)
// Tier 2: C (standard tasks)
// Tier 3: D, E (quick/temp tasks)
// Tier 4: F (idea pool)
function getPriorityTier(priority: Priority): number {
  switch (priority) {
    case 'A': case 'B': return 1;
    case 'C': return 2;
    case 'D': case 'E': return 3;
    case 'F': return 4;
    default: return 4;
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

export async function changePriority(taskId: string, newPriority: Priority, skipConfirmation = false): Promise<{ success: boolean; error?: string; needsConfirmation?: boolean; confirmationReason?: string }> {
  const task = appData.tasks.find(t => t.id === taskId);
  if (!task) {
    return { success: false, error: 'Task not found' };
  }

  // Allow changing to active (A-F) or future (N) priorities through this function
  // Use completeTask or cancelTask for G/H
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

  // Check quota for new priority — pass full task list so canAddTask can correctly
  // count S (Sustained, quota 1) and N (Future, unlimited); the A-F branch
  // internally filters by isActivePriority via getRemainingQuota.
  const otherTasks = appData.tasks.filter(t => t.id !== taskId);
  if (newPriority !== 'A' && !canAddTask(otherTasks, newPriority)) {
    return { success: false, error: t('message.quotaExceeded', { priority: newPriority }) };
  }

  await updateTask(taskId, {
    priority: newPriority,
    lastPriorityChangeAt: new Date().toISOString()
  });
  return { success: true };
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

  // Record pomodoro completion for gamification
  const gamification = getGamificationStore();
  gamification.recordPomodoro();

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

// Derived values - Step 1: Filter active priorities (A-F)
// N (future-progress) is intentionally NOT included here; it is rendered via
// the persistent PriorityTray, not in the main view chain.
const activeTasks = $derived(appData.tasks.filter(t => isActivePriority(t.priority)));

// Tasks that count toward cross-cutting aggregations (sidebar project/context/
// tag badges, etc.). Includes A-F + N + S — everything not hidden (G/H).
const countedTasks = $derived(appData.tasks.filter(t => isCountedPriority(t.priority)));

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
    F: [],
    G: [],
    H: [],
    N: [],
    S: []
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

// Future-progress tasks (N priority) — long-horizon, default hidden from daily views
const futureTasks = $derived(
  appData.tasks.filter(t => isFuturePriority(t.priority))
    .sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA;
    })
);

const futureTasksTotal = $derived(futureTasks.length);

// Sustained tasks (S priority) — week-long projects, surfaced in the tray with progress
const sustainedTasks = $derived(
  appData.tasks.filter(t => isSustainedPriority(t.priority))
    .sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA;
    })
);

const sustainedTasksTotal = $derived(sustainedTasks.length);

// Overall subtask completion across all S tasks (for tray progress display)
const sustainedSubtaskProgress = $derived.by(() => {
  let done = 0;
  let total = 0;
  for (const task of sustainedTasks) {
    const subs = task.subtasks ?? [];
    total += subs.length;
    done += subs.filter(s => s.completed).length;
  }
  return { done, total, ratio: total === 0 ? 0 : done / total };
});

// Project/context aggregations use countedTasks (A-F + N + S) so that tags
// attached to Future (N) and Sustained (S) tasks also surface in the sidebar.
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
  activeTasks.filter(t => t.recurrence?.pattern === '1d').length
);

const weeklyRecurringCount = $derived(
  activeTasks.filter(t => t.recurrence?.pattern === '1w').length
);

const completedTodayCount = $derived(
  appData.tasks.filter(t => t.priority === 'G' && t.completedAt && isToday(t.completedAt)).length
);

// F zone (Idea Pool) aging tasks
const agingFZoneTasks = $derived.by(() => {
  const fZoneTasks = appData.tasks.filter(t => t.priority === 'F' && !t.completed);
  return fZoneTasks.map(task => ({
    ...task,
    ageInUnits: calculateEZoneAge(task, 7) // Uses backward-compatible function
  }));
});

// Backward compatibility alias
const agingEZoneTasks = $derived(agingFZoneTasks);

// Recently completed tasks within retention period, grouped by original priority
// These will be shown with strikethrough in their original zone
const recentlyCompletedTasksByPriority = $derived.by(() => {
  const byPriority: Record<Priority, Task[]> = {
    A: [], B: [], C: [], D: [], E: [], F: [], G: [], H: [], N: [], S: []
  };

  const recentlyCompleted = appData.tasks.filter(t =>
    t.priority === 'G' && isWithinRetentionPeriod(t)
  );

  for (const task of recentlyCompleted) {
    const originalPriority = task.originalPriority || 'F';
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
    get futureTasks() { return futureTasks; },
    get futureTasksTotal() { return futureTasksTotal; },
    get sustainedTasks() { return sustainedTasks; },
    get sustainedTasksTotal() { return sustainedTasksTotal; },
    get sustainedSubtaskProgress() { return sustainedSubtaskProgress; },
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
    get agingEZoneTasks() { return agingEZoneTasks; },
    get recentlyCompletedTasksByPriority() { return recentlyCompletedTasksByPriority; },
    get customTagGroups() { return appData.customTagGroups; },
    get settings() { return appData.settings; }
  };
}
