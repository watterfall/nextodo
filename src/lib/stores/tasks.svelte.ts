import type { Task, Priority, FilterState, UnitInfo, AppData, ActiveData, ArchiveData, PomodoroHistoryData } from '$lib/types';
import { createEmptyTask, createDefaultAppData, isThresholdPassed, calculateEZoneAge } from '$lib/types';
import { loadAppData, saveAppData, reloadFile } from '$lib/utils/storage';
import { applyHighlanderRule, canAddTask, validateQuota } from '$lib/utils/quota';
import { createTaskFromInput } from '$lib/utils/parser';
import { processRecurringTasks, createNextOccurrence } from '$lib/utils/recurrence';
import { getCurrentUnit, isDateInUnit, isToday, isOverdue, isThisWeek } from '$lib/utils/unitCalc';

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
  showFutureTasks: false
});

// Search query
let searchQuery = $state('');

// Initialize data
export async function initializeData(): Promise<void> {
  try {
    isLoading = true;
    lastError = null;
    appData = await loadAppData();

    // Process recurring tasks
    const newRecurringTasks = processRecurringTasks(appData.tasks);
    if (newRecurringTasks.length > 0) {
      appData.tasks = [...appData.tasks, ...newRecurringTasks];
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
          trash: activeData.trash || [],
          reviews: activeData.reviews || [],
          customTagGroups: activeData.customTagGroups || appData.customTagGroups,
          settings: activeData.settings || appData.settings
        };
        break;
      }
      case 'archive': {
        const archiveData = data as ArchiveData;
        appData = {
          ...appData,
          archive: archiveData.tasks || []
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
async function persist(): Promise<void> {
  try {
    await saveAppData(appData);
  } catch (error) {
    lastError = error instanceof Error ? error.message : 'Failed to save data';
    console.error('Failed to persist data:', error);
  }
}

// Task operations
export function addTask(input: string): { success: boolean; error?: string } {
  const task = createTaskFromInput(input);

  // Validate quota
  const quotaError = validateQuota(appData.tasks, task.priority);
  if (quotaError) {
    return { success: false, error: quotaError };
  }

  // Apply Highlander rule for A priority
  if (task.priority === 'A') {
    appData.tasks = applyHighlanderRule(appData.tasks, task);
  }

  appData.tasks = [...appData.tasks, task];
  persist();

  return { success: true };
}

export function addTaskDirect(task: Task): { success: boolean; error?: string } {
  const quotaError = validateQuota(appData.tasks, task.priority);
  if (quotaError) {
    return { success: false, error: quotaError };
  }

  if (task.priority === 'A') {
    appData.tasks = applyHighlanderRule(appData.tasks, task);
  }

  appData.tasks = [...appData.tasks, task];
  persist();

  return { success: true };
}

export function updateTask(taskId: string, updates: Partial<Task>): void {
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

  persist();
}

export function deleteTask(taskId: string): void {
  const task = appData.tasks.find(t => t.id === taskId);
  if (task) {
    // Move to trash
    appData.trash = [...appData.trash, { ...task, completedAt: new Date().toISOString() }];
    appData.tasks = appData.tasks.filter(t => t.id !== taskId);
    persist();
  }
}

export function completeTask(taskId: string): void {
  appData.tasks = appData.tasks.map(task => {
    if (task.id === taskId && !task.completed) {
      const completed = {
        ...task,
        completed: true,
        completedAt: new Date().toISOString()
      };

      // Handle recurring task
      if (task.recurrence?.pattern && task.dueDate) {
        const nextTask = createNextOccurrence(task);
        if (nextTask) {
          // Add next occurrence
          setTimeout(() => {
            addTaskDirect(nextTask);
          }, 0);
        }
      }

      return completed;
    }
    return task;
  });

  persist();
}

export function uncompleteTask(taskId: string): void {
  appData.tasks = appData.tasks.map(task => {
    if (task.id === taskId && task.completed) {
      return {
        ...task,
        completed: false,
        completedAt: null
      };
    }
    return task;
  });

  persist();
}

export function archiveCompleted(): void {
  const completed = appData.tasks.filter(t => t.completed);
  appData.archive = [...appData.archive, ...completed];
  appData.tasks = appData.tasks.filter(t => !t.completed);
  persist();
}

export function restoreFromTrash(taskId: string): void {
  const task = appData.trash.find(t => t.id === taskId);
  if (task) {
    appData.tasks = [...appData.tasks, { ...task, completed: false, completedAt: null }];
    appData.trash = appData.trash.filter(t => t.id !== taskId);
    persist();
  }
}

export function emptyTrash(): void {
  appData.trash = [];
  persist();
}

export function changePriority(taskId: string, newPriority: Priority): { success: boolean; error?: string } {
  const task = appData.tasks.find(t => t.id === taskId);
  if (!task) {
    return { success: false, error: 'Task not found' };
  }

  // Check quota for new priority
  const otherTasks = appData.tasks.filter(t => t.id !== taskId);
  if (!canAddTask(otherTasks, newPriority)) {
    return { success: false, error: `${newPriority} 类已达配额上限` };
  }

  updateTask(taskId, { priority: newPriority });
  return { success: true };
}

export function incrementPomodoro(taskId: string): void {
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

  persist();
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
    showFutureTasks: false
  };
}

export function setSearchQuery(query: string): void {
  searchQuery = query;
}

// Unit navigation
export function setCurrentUnit(unit: UnitInfo): void {
  currentUnit = unit;
}

// Derived values
const filteredTasks = $derived.by(() => {
  let tasks = appData.tasks;

  // Filter by threshold date (unless showing future tasks)
  if (!filter.showFutureTasks) {
    tasks = tasks.filter(t => isThresholdPassed(t));
  } else {
    // Show only future tasks
    tasks = tasks.filter(t => !isThresholdPassed(t));
  }

  // Apply search
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    tasks = tasks.filter(t =>
      t.content.toLowerCase().includes(query) ||
      t.projects.some(p => p.toLowerCase().includes(query)) ||
      t.contexts.some(c => c.toLowerCase().includes(query)) ||
      t.customTags.some(tag => tag.toLowerCase().includes(query))
    );
  }

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

  // Apply completed filter
  if (!filter.showCompleted) {
    tasks = tasks.filter(t => !t.completed);
  }

  // Apply due filter
  if (filter.dueFilter === 'today') {
    tasks = tasks.filter(t => t.dueDate && isToday(t.dueDate));
  } else if (filter.dueFilter === 'thisWeek') {
    tasks = tasks.filter(t => t.dueDate && isThisWeek(t.dueDate));
  } else if (filter.dueFilter === 'overdue') {
    tasks = tasks.filter(t => isOverdue(t.dueDate));
  }

  return tasks;
});

const tasksByPriority = $derived.by(() => {
  const byPriority: Record<Priority, Task[]> = {
    A: [],
    B: [],
    C: [],
    D: [],
    E: []
  };

  for (const task of filteredTasks) {
    byPriority[task.priority].push(task);
  }

  return byPriority;
});

const allProjects = $derived.by(() => {
  const projects = new Set<string>();
  for (const task of appData.tasks) {
    for (const project of task.projects) {
      projects.add(project);
    }
  }
  return Array.from(projects).sort();
});

const allContexts = $derived.by(() => {
  const contexts = new Set<string>();
  for (const task of appData.tasks) {
    for (const context of task.contexts) {
      contexts.add(context);
    }
  }
  return Array.from(contexts).sort();
});

const projectCounts = $derived.by(() => {
  const counts: Record<string, number> = {};
  for (const task of appData.tasks.filter(t => !t.completed)) {
    for (const project of task.projects) {
      counts[project] = (counts[project] || 0) + 1;
    }
  }
  return counts;
});

const contextCounts = $derived.by(() => {
  const counts: Record<string, number> = {};
  for (const task of appData.tasks.filter(t => !t.completed)) {
    for (const context of task.contexts) {
      counts[context] = (counts[context] || 0) + 1;
    }
  }
  return counts;
});

const dueTodayCount = $derived(
  appData.tasks.filter(t => !t.completed && t.dueDate && isToday(t.dueDate)).length
);

const dueThisWeekCount = $derived(
  appData.tasks.filter(t => !t.completed && t.dueDate && isThisWeek(t.dueDate)).length
);

const overdueCount = $derived(
  appData.tasks.filter(t => !t.completed && isOverdue(t.dueDate)).length
);

const futureTasksCount = $derived(
  appData.tasks.filter(t => !t.completed && !isThresholdPassed(t)).length
);

const dailyRecurringCount = $derived(
  appData.tasks.filter(t => !t.completed && t.recurrence?.pattern === '1d').length
);

const weeklyRecurringCount = $derived(
  appData.tasks.filter(t => !t.completed && t.recurrence?.pattern === '1w').length
);

const completedTodayCount = $derived(
  appData.tasks.filter(t => t.completed && t.completedAt && isToday(t.completedAt)).length
);

// E zone aging tasks
const agingEZoneTasks = $derived.by(() => {
  const eZoneTasks = appData.tasks.filter(t => t.priority === 'E' && !t.completed);
  return eZoneTasks.map(task => ({
    ...task,
    ageInUnits: calculateEZoneAge(task, 7)
  }));
});

// Export store interface
export function getTasksStore() {
  return {
    get appData() { return appData; },
    get tasks() { return appData.tasks; },
    get archive() { return appData.archive; },
    get trash() { return appData.trash; },
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
    get customTagGroups() { return appData.customTagGroups; },
    get settings() { return appData.settings; }
  };
}
