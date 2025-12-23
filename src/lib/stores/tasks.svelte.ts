import type { Task, Priority, FilterState, UnitInfo, AppData, ActiveData, PomodoroHistoryData } from '$lib/types';
import { createEmptyTask, createDefaultAppData, isThresholdPassed, calculateEZoneAge, isActivePriority, ACTIVE_PRIORITIES, isWithinRetentionPeriod } from '$lib/types';
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
          settings: activeData.settings || appData.settings
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
      case 'legacy': {
        // Full reload for legacy file
        appData = await loadAppData();
        break;
      }
    }
  } catch (error) {
    console.error('Failed to reload data:', error);
  }
}

// Persist changes
async function persist(filesToSave: ('active' | 'archive' | 'pomodoro_history')[] = ['active']): Promise<void> {
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
  const quotaError = validateQuota(appData.tasks, task.priority);
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
  const quotaError = validateQuota(appData.tasks, task.priority);
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
  appData.tasks = appData.tasks.map(task => {
    if (task.id === taskId) {
      const updated = { ...task, ...updates };

      // Handle priority change with Highlander rule
      if (updates.priority === 'A' && task.priority !== 'A') {
        appData.tasks = applyHighlanderRule(appData.tasks, updated);
      }

      return updated;
    }
    return task;
  });

  await persist();
}

// Cancel a task (move to H priority)
export async function cancelTask(taskId: string): Promise<void> {
  appData.tasks = appData.tasks.map(task => {
    if (task.id === taskId && isActivePriority(task.priority)) {
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
  const taskToComplete = appData.tasks.find(t => t.id === taskId && isActivePriority(t.priority));
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
    if (task.id === taskId && isActivePriority(task.priority)) {
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
    const quotaError = validateQuota(appData.tasks.filter(t => isActivePriority(t.priority)), nextRecurringTask.priority);
    if (!quotaError) {
      if (nextRecurringTask.priority === 'A') {
        appData.tasks = applyHighlanderRule(appData.tasks.filter(t => isActivePriority(t.priority)), nextRecurringTask);
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
  // Only allow restoring to active priorities
  if (!isActivePriority(targetPriority)) {
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

  // Only allow changing to active priorities (A-F) through this function
  // Use completeTask or cancelTask for G/H
  if (!isActivePriority(newPriority)) {
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

  // Check quota for new priority (only among active tasks)
  const otherActiveTasks = appData.tasks.filter(t => t.id !== taskId && isActivePriority(t.priority));
  if (!canAddTask(otherActiveTasks, newPriority)) {
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
export async function reorderTask(priority: Priority, newOrderedTasks: Task[]): Promise<void> {
  // Only allow reordering to active priorities
  if (!isActivePriority(priority)) {
    return;
  }

  const newIds = new Set(newOrderedTasks.map(t => t.id));

  // Get all tasks that are NOT in the new list
  const otherTasks = appData.tasks.filter(t => !newIds.has(t.id));

  // Update priority for tasks in the new list
  const updatedNewTasks = newOrderedTasks.map(t => {
    if (t.priority !== priority) {
       return { ...t, priority };
    }
    return t;
  });

  appData.tasks = [...otherTasks, ...updatedNewTasks];

  await persist();
}

// Filter operations
export function setFilter(newFilter: Partial<FilterState>): void {
  filter = { ...filter, ...newFilter };
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
const activeTasks = $derived(appData.tasks.filter(t => isActivePriority(t.priority)));

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

// Only count active tasks for projects/contexts (use visibleTasks to respect threshold, or activeTasks to show all available?)
// Typically project lists should show all active projects even if tasks are dormant?
// Let's use activeTasks to be safe so counts don't fluctuate wildly based on threshold visibility
// const activeTasks = ... is already defined above

const allProjects = $derived.by(() => {
  const projects = new Set<string>();
  for (const task of activeTasks) {
    for (const project of task.projects) {
      projects.add(project);
    }
  }
  return Array.from(projects).sort();
});

const allContexts = $derived.by(() => {
  const contexts = new Set<string>();
  for (const task of activeTasks) {
    for (const context of task.contexts) {
      contexts.add(context);
    }
  }
  return Array.from(contexts).sort();
});

const projectCounts = $derived.by(() => {
  const counts: Record<string, number> = {};
  for (const task of activeTasks) {
    for (const project of task.projects) {
      counts[project] = (counts[project] || 0) + 1;
    }
  }
  return counts;
});

const contextCounts = $derived.by(() => {
  const counts: Record<string, number> = {};
  for (const task of activeTasks) {
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
    A: [], B: [], C: [], D: [], E: [], F: [], G: [], H: []
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
    get completedTasks() { return completedTasks; },
    get cancelledTasks() { return cancelledTasks; },
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
