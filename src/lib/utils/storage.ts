import type { AppData, ActiveData, PomodoroHistoryData, Task } from '$lib/types';
import {
  createDefaultAppData,
  createDefaultActiveData,
  createDefaultPomodoroHistoryData,
  createDefaultSettings
} from '$lib/types';

// Storage keys for web/dev mode
const STORAGE_KEYS = {
  active: 'focusflow_active',
  archive: 'focusflow_archive',
  pomodoroHistory: 'focusflow_pomodoro_history',
  // Legacy key for migration
  legacy: 'focusflow_data'
};

// Anti-deadlock: Use a counter instead of boolean to handle concurrent saves
let saveOperationCount = 0;
let lastSaveCompleteTime = 0;
const SAVE_COOLDOWN_MS = 2000; // Ignore file changes within this window after save

// Debounce timeout for file watcher
let fileWatcherDebounceTimer: ReturnType<typeof setTimeout> | null = null;
const FILE_WATCHER_DEBOUNCE_MS = 500;

/**
 * Mark that a save operation is starting
 */
function beginSave(): void {
  saveOperationCount++;
}

/**
 * Mark that a save operation has completed
 */
function endSave(): void {
  saveOperationCount = Math.max(0, saveOperationCount - 1);
  if (saveOperationCount === 0) {
    lastSaveCompleteTime = Date.now();
  }
}

/**
 * Check if we're currently saving or recently finished saving
 */
function isSaving(): boolean {
  if (saveOperationCount > 0) {
    return true;
  }
  // Also return true if we just finished saving (within cooldown period)
  return Date.now() - lastSaveCompleteTime < SAVE_COOLDOWN_MS;
}

/**
 * Check if running in Tauri environment
 */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

/**
 * Load all app data from storage (combines all separated files)
 */
export async function loadAppData(): Promise<AppData> {
  if (isTauri()) {
    return loadFromTauri();
  }
  return loadFromLocalStorage();
}

/**
 * Save app data to storage (writes to separated files)
 */
export async function saveAppData(data: AppData, filesToSave: ('active' | 'pomodoro_history')[] = ['active', 'pomodoro_history']): Promise<void> {
  data.lastModified = new Date().toISOString();

  if (isTauri()) {
    await saveToTauri(data, filesToSave);
  } else {
    saveToLocalStorage(data);
  }
}

/**
 * Save only active data (hot data)
 */
export async function saveActiveData(data: ActiveData): Promise<void> {
  data.lastModified = new Date().toISOString();

  if (isTauri()) {
    await saveFileTauri('active', data);
  } else {
    localStorage.setItem(STORAGE_KEYS.active, JSON.stringify(data));
  }
}

/**
 * Save only pomodoro history
 */
export async function savePomodoroHistoryData(data: PomodoroHistoryData): Promise<void> {
  data.lastModified = new Date().toISOString();

  if (isTauri()) {
    await saveFileTauri('pomodoro_history', data);
  } else {
    localStorage.setItem(STORAGE_KEYS.pomodoroHistory, JSON.stringify(data));
  }
}

/**
 * Load specific file type
 */
export async function loadFileData<T>(fileType: 'active' | 'archive' | 'pomodoro_history'): Promise<T | null> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    const content = await invoke<string | null>('read_data_file', { fileType });

    if (content) {
      return JSON.parse(content) as T;
    }
    return null;
  } else {
    const key = fileType === 'active' ? STORAGE_KEYS.active :
                fileType === 'archive' ? STORAGE_KEYS.archive :
                STORAGE_KEYS.pomodoroHistory;
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored) as T;
    }
    return null;
  }
}

/**
/**
 * Reload specific file and return updated data
 */
export async function reloadFile(
  fileType: 'active' | 'archive' | 'pomodoro_history'
): Promise<ActiveData | ActiveData | PomodoroHistoryData | null> {
  switch (fileType) {
    case 'active':
      return await loadFileData<ActiveData>('active');
    case 'archive':
      return await loadFileData<ActiveData>('archive');
    case 'pomodoro_history':
      return await loadFileData<PomodoroHistoryData>('pomodoro_history');
    default:
      return null;
  }
}

/**
 * Load from localStorage (web/dev mode) - handles migration
 */
function loadFromLocalStorage(): AppData {
  // Check for legacy data first
  const legacy = localStorage.getItem(STORAGE_KEYS.legacy);
  if (legacy && !localStorage.getItem(STORAGE_KEYS.active)) {
    // Migrate from legacy format
    try {
      const legacyData = JSON.parse(legacy);
      const migrated = migrateData(legacyData);

      // Save to new format
      saveToLocalStorage(migrated);

      // Keep legacy as backup
      localStorage.setItem(STORAGE_KEYS.legacy + '_backup', legacy);
      localStorage.removeItem(STORAGE_KEYS.legacy);

      return migrated;
    } catch (error) {
      console.error('Failed to migrate legacy data:', error);
    }
  }

  // Load from separated files
  try {
    const activeStr = localStorage.getItem(STORAGE_KEYS.active);
    const pomodoroStr = localStorage.getItem(STORAGE_KEYS.pomodoroHistory);

    const active = activeStr ? JSON.parse(activeStr) as ActiveData : createDefaultActiveData();
    const pomodoro = pomodoroStr ? JSON.parse(pomodoroStr) as PomodoroHistoryData : createDefaultPomodoroHistoryData();

    // Combine into AppData - migrate old trash/archive to G/H priorities
    let tasks = migrateTasks(active.tasks || []);

    // Migrate old trash to H (cancelled) and old completed tasks to G (completed)
    const oldTrash = (active as any).trash || [];
    const oldArchive = localStorage.getItem(STORAGE_KEYS.archive);
    if (oldTrash.length > 0) {
      const migratedTrash = migrateTasks(oldTrash).map((t: any) => ({ ...t, priority: 'H' }));
      tasks = [...tasks, ...migratedTrash];
    }
    if (oldArchive) {
      try {
        const archiveData = JSON.parse(oldArchive);
        const migratedArchive = migrateTasks(archiveData.tasks || []).map((t: any) => ({ ...t, priority: 'G', completed: true }));
        tasks = [...tasks, ...migratedArchive];
        localStorage.removeItem(STORAGE_KEYS.archive); // Clean up old archive
      } catch (e) {
        console.error('Failed to migrate archive:', e);
      }
    }

    return {
      version: active.version || '4.0',
      lastModified: active.lastModified,
      tasks,
      reviews: active.reviews || [],
      customTagGroups: active.customTagGroups || {
        energy: ['⚡高能量', '😴低能量', '☕中等'],
        type: ['📞电话', '💻编码', '✍️写作', '🤝会议']
      },
      pomodoroHistory: pomodoro.sessions || [],
      settings: migrateSettings(active.settings)
    };
  } catch (error) {
    console.error('Failed to load from localStorage:', error);
    return createDefaultAppData();
  }
}

/**
 * Save to localStorage (web/dev mode)
 */
function saveToLocalStorage(data: AppData): void {
  try {
    // Separate into different files
    const active: ActiveData = {
      version: data.version,
      lastModified: data.lastModified,
      tasks: data.tasks,
      reviews: data.reviews,
      customTagGroups: data.customTagGroups,
      settings: data.settings
    };

    const pomodoroHistory: PomodoroHistoryData = {
      version: data.version,
      lastModified: data.lastModified,
      sessions: data.pomodoroHistory
    };

    localStorage.setItem(STORAGE_KEYS.active, JSON.stringify(active));
    localStorage.setItem(STORAGE_KEYS.pomodoroHistory, JSON.stringify(pomodoroHistory));
  } catch (error) {
    console.error('Failed to save to localStorage:', error);
    throw error;
  }
}

/**
 * Load from Tauri file system - handles migration
 */
async function loadFromTauri(): Promise<AppData> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');

    // Check if migration is needed
    const migrated = await invoke<boolean>('migrate_legacy_data');
    if (migrated) {
      console.log('Migrated from legacy data format');
    }

    // Read separated files
    const activeContent = await invoke<string | null>('read_data_file', { fileType: 'active' });
    const pomodoroContent = await invoke<string | null>('read_data_file', { fileType: 'pomodoro_history' });

    const active = activeContent ? JSON.parse(activeContent) as ActiveData : createDefaultActiveData();
    const pomodoro = pomodoroContent ? JSON.parse(pomodoroContent) as PomodoroHistoryData : createDefaultPomodoroHistoryData();

    // Migrate old trash/archive to G/H priorities
    let tasks = migrateTasks(active.tasks || []);
    const oldTrash = (active as any).trash || [];
    if (oldTrash.length > 0) {
      const migratedTrash = migrateTasks(oldTrash).map((t: any) => ({ ...t, priority: 'H' }));
      tasks = [...tasks, ...migratedTrash];
    }

    // Migrate old archive file if it exists
    try {
      const archiveContent = await invoke<string | null>('read_data_file', { fileType: 'archive' });
      if (archiveContent) {
        const archiveData = JSON.parse(archiveContent);
        const migratedArchive = migrateTasks(archiveData.tasks || []).map((t: any) => ({ ...t, priority: 'G', completed: true }));
        tasks = [...tasks, ...migratedArchive];
        console.log('Migrated archive tasks to G priority');
      }
    } catch (e) {
      // Archive file doesn't exist or failed to parse - that's fine
    }

    // Combine into AppData
    return {
      version: active.version || '4.0',
      lastModified: active.lastModified,
      tasks,
      reviews: active.reviews || [],
      customTagGroups: active.customTagGroups || {
        energy: ['⚡高能量', '😴低能量', '☕中等'],
        type: ['📞电话', '💻编码', '✍️写作', '🤝会议']
      },
      pomodoroHistory: pomodoro.sessions || [],
      settings: migrateSettings(active.settings)
    };
  } catch (error) {
    console.error('Failed to load from Tauri:', error);
    return createDefaultAppData();
  }
}

/**
 * Save to Tauri file system using atomic writes
 */
async function saveToTauri(data: AppData, filesToSave: string[] = ['active', 'pomodoro_history']): Promise<void> {
  // Mark save operation as starting
  beginSave();

  try {
    const { invoke } = await import('@tauri-apps/api/core');

    // Separate into different files
    const active: ActiveData = {
      version: data.version,
      lastModified: data.lastModified,
      tasks: data.tasks,
      reviews: data.reviews,
      customTagGroups: data.customTagGroups,
      settings: data.settings
    };

    const pomodoroHistory: PomodoroHistoryData = {
      version: data.version,
      lastModified: data.lastModified,
      sessions: data.pomodoroHistory
    };

    const promises = [];

    if (filesToSave.includes('active')) {
      promises.push(invoke('atomic_write_file', {
        fileType: 'active',
        content: JSON.stringify(active, null, 2)
      }));
    }

    if (filesToSave.includes('pomodoro_history')) {
      promises.push(invoke('atomic_write_file', {
        fileType: 'pomodoro_history',
        content: JSON.stringify(pomodoroHistory, null, 2)
      }));
    }

    // Write all files atomically (in parallel)
    await Promise.all(promises);
  } catch (error) {
    console.error('Failed to save to Tauri:', error);
    throw error;
  } finally {
    // Mark save operation as complete (cooldown handled by isSaving())
    endSave();
  }
}

/**
 * Save a specific file to Tauri using atomic write
 */
async function saveFileTauri(fileType: string, data: unknown): Promise<void> {
  // Mark save operation as starting
  beginSave();

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('atomic_write_file', {
      fileType,
      content: JSON.stringify(data, null, 2)
    });
  } finally {
    // Mark save operation as complete (cooldown handled by isSaving())
    endSave();
  }
}

/**
 * Migrate tasks to add new fields and remove symbol prefixes
 */
function migrateTasks(tasks: Task[]): Task[] {
  return tasks.map(task => ({
    ...task,
    // Remove symbol prefixes from projects, contexts, and tags (data format change)
    projects: task.projects.map(p => p.replace(/^\+/, '')),
    contexts: task.contexts.map(c => c.replace(/^@/, '')),
    customTags: task.customTags.map(t => t.replace(/^#/, '')),
    thresholdDate: task.thresholdDate ?? null,
    recurrence: task.recurrence ?? null,
    pomodoros: task.pomodoros ?? { estimated: 0, completed: 0 }
  }));
}

/**
 * Migrate settings to add new fields
 */
function migrateSettings(settings: any): AppData['settings'] {
  const defaults = createDefaultSettings();
  return {
    ...defaults,
    ...settings,
    theme: settings?.theme ?? defaults.theme,
    language: settings?.language ?? defaults.language,
    autoArchiveDays: settings?.autoArchiveDays ?? defaults.autoArchiveDays,
    eZoneAgingDays: settings?.eZoneAgingDays ?? defaults.eZoneAgingDays,
    showFutureTasks: settings?.showFutureTasks ?? defaults.showFutureTasks,
    unitBoundaryFlexHours: settings?.unitBoundaryFlexHours ?? defaults.unitBoundaryFlexHours
  };
}

/**
 * Migrate data from older versions
 */
function migrateData(data: any): AppData {
  // Add version if missing
  if (!data.version) {
    data.version = '1.0';
  }

  // Ensure required fields exist
  data.reviews = data.reviews || [];
  data.pomodoroHistory = data.pomodoroHistory || [];
  data.customTagGroups = data.customTagGroups || {
    energy: ['⚡高能量', '😴低能量', '☕中等'],
    type: ['📞电话', '💻编码', '✍️写作', '🤝会议']
  };
  data.settings = migrateSettings(data.settings);

  // Migrate tasks
  let tasks = migrateTasks(data.tasks || []);

  // Migrate from version < 4.0 (convert archive/trash to G/H priorities)
  if (data.version < '4.0') {
    // Migrate old archive to G (completed) priority
    if (data.archive && data.archive.length > 0) {
      const migratedArchive = migrateTasks(data.archive).map((t: any) => ({ ...t, priority: 'G', completed: true }));
      tasks = [...tasks, ...migratedArchive];
    }

    // Migrate old trash to H (cancelled) priority
    if (data.trash && data.trash.length > 0) {
      const migratedTrash = migrateTasks(data.trash).map((t: any) => ({ ...t, priority: 'H' }));
      tasks = [...tasks, ...migratedTrash];
    }

    // Also migrate any completed tasks that are still in active tasks to G
    tasks = tasks.map((t: any) => {
      if (t.completed && t.priority !== 'G' && t.priority !== 'H') {
        return { ...t, priority: 'G' };
      }
      return t;
    });

    data.version = '4.0';
  }

  return {
    version: data.version,
    lastModified: data.lastModified || new Date().toISOString(),
    tasks,
    reviews: data.reviews,
    customTagGroups: data.customTagGroups,
    pomodoroHistory: data.pomodoroHistory,
    settings: data.settings
  };
}

/**
 * Check if currently saving (for external use)
 */
export function isCurrentlySaving(): boolean {
  return isSaving();
}

/**
 * Setup file change listener with debounce and isSaving protection
 */
export async function setupFileWatcher(onFileChange: (fileType: string) => void): Promise<() => void> {
  if (!isTauri()) {
    return () => {}; // No-op for web
  }

  // Track pending file changes for debounce
  const pendingChanges = new Set<string>();

  const { listen } = await import('@tauri-apps/api/event');
  const unlisten = await listen<string>('data-file-changed', (event) => {
    const fileType = event.payload;

    // Skip if we're currently saving (self-triggered event)
    if (isSaving()) {
      console.log('Ignoring file change (isSaving):', fileType);
      return;
    }

    // Add to pending changes
    pendingChanges.add(fileType);

    // Clear existing debounce timer
    if (fileWatcherDebounceTimer) {
      clearTimeout(fileWatcherDebounceTimer);
    }

    // Set new debounce timer
    fileWatcherDebounceTimer = setTimeout(() => {
      // Double-check isSaving after debounce
      if (isSaving()) {
        console.log('Ignoring debounced file changes (isSaving)');
        pendingChanges.clear();
        return;
      }

      // Process all pending changes
      for (const type of pendingChanges) {
        console.log('Processing external file change:', type);
        onFileChange(type);
      }
      pendingChanges.clear();
      fileWatcherDebounceTimer = null;
    }, FILE_WATCHER_DEBOUNCE_MS);
  });

  return () => {
    // Clear debounce timer on cleanup
    if (fileWatcherDebounceTimer) {
      clearTimeout(fileWatcherDebounceTimer);
      fileWatcherDebounceTimer = null;
    }
    unlisten();
  };
}

/**
 * Export data as JSON file
 */
export async function exportData(data: AppData): Promise<void> {
  const content = JSON.stringify(data, null, 2);
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `focusflow_export_${new Date().toISOString().split('T')[0]}.json`;
  a.click();

  URL.revokeObjectURL(url);
}

/**
 * Import data from JSON file
 */
export async function importData(file: File): Promise<AppData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const data = JSON.parse(content) as AppData;
        resolve(migrateData(data));
      } catch (error) {
        reject(new Error('Invalid JSON file'));
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

/**
 * Clear all data (for testing/reset)
 */
export async function clearAllData(): Promise<void> {
  if (isTauri()) {
    const { remove, BaseDirectory } = await import('@tauri-apps/plugin-fs');
    const files = ['active.json', 'archive.json', 'pomodoro_history.json'];

    for (const file of files) {
      try {
        await remove(file, { baseDir: BaseDirectory.AppData });
      } catch {
        // File doesn't exist
      }
    }
  } else {
    localStorage.removeItem(STORAGE_KEYS.active);
    localStorage.removeItem(STORAGE_KEYS.archive);
    localStorage.removeItem(STORAGE_KEYS.pomodoroHistory);
    localStorage.removeItem(STORAGE_KEYS.legacy);
  }
}

/**
 * Create backup
 */
export async function createBackup(): Promise<string> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<string>('backup_data');
  } else {
    // For web, just export to file
    const data = await loadAppData();
    await exportData(data);
    return 'Exported to downloads';
  }
}