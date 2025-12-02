import type { AppData, ActiveData, ArchiveData, PomodoroHistoryData, Task } from '$lib/types';
import {
  createDefaultAppData,
  createDefaultActiveData,
  createDefaultArchiveData,
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
const FILE_WATCHER_DEBOUNCE_MS = 300;

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
export async function saveAppData(data: AppData): Promise<void> {
  data.lastModified = new Date().toISOString();

  if (isTauri()) {
    await saveToTauri(data);
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
 * Save only archive data (cold data)
 */
export async function saveArchiveData(data: ArchiveData): Promise<void> {
  data.lastModified = new Date().toISOString();

  if (isTauri()) {
    await saveFileTauri('archive', data);
  } else {
    localStorage.setItem(STORAGE_KEYS.archive, JSON.stringify(data));
  }
}

/**
 * Append tasks to archive (optimized for performance)
 */
export async function appendArchiveTasks(tasks: Task[]): Promise<void> {
  if (tasks.length === 0) return;

  if (isTauri()) {
    beginSave();
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('append_archive_tasks', {
        newTasksJson: JSON.stringify(tasks)
      });
    } catch (error) {
      console.error('Failed to append to archive:', error);
      throw error;
    } finally {
      endSave();
    }
  } else {
    // Web fallback: read, append, write
    try {
      const archiveStr = localStorage.getItem(STORAGE_KEYS.archive);
      const archive = archiveStr ? JSON.parse(archiveStr) as ArchiveData : createDefaultArchiveData();
      archive.tasks = [...archive.tasks, ...tasks];
      archive.lastModified = new Date().toISOString();
      localStorage.setItem(STORAGE_KEYS.archive, JSON.stringify(archive));
    } catch (error) {
      console.error('Failed to append to archive (web):', error);
      throw error;
    }
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
 * Reload specific file and return updated data
 */
export async function reloadFile(fileType: string): Promise<ActiveData | ArchiveData | PomodoroHistoryData | null> {
  switch (fileType) {
    case 'active':
      return await loadFileData<ActiveData>('active');
    case 'archive':
      return await loadFileData<ArchiveData>('archive');
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
      const legacyData = JSON.parse(legacy) as AppData;
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
    const archiveStr = localStorage.getItem(STORAGE_KEYS.archive);
    const pomodoroStr = localStorage.getItem(STORAGE_KEYS.pomodoroHistory);

    const active = activeStr ? JSON.parse(activeStr) as ActiveData : createDefaultActiveData();
    // In web mode, we still load archive to be consistent, but in Tauri we skip it
    const archive = archiveStr ? JSON.parse(archiveStr) as ArchiveData : createDefaultArchiveData();
    const pomodoro = pomodoroStr ? JSON.parse(pomodoroStr) as PomodoroHistoryData : createDefaultPomodoroHistoryData();

    // Combine into AppData
    return {
      version: active.version,
      lastModified: active.lastModified,
      tasks: migrateTasks(active.tasks || []),
      archive: migrateTasks(archive.tasks || []),
      trash: migrateTasks(active.trash || []),
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
      trash: data.trash,
      reviews: data.reviews,
      customTagGroups: data.customTagGroups,
      settings: data.settings
    };

    const archive: ArchiveData = {
      version: data.version,
      lastModified: data.lastModified,
      tasks: data.archive
    };

    const pomodoroHistory: PomodoroHistoryData = {
      version: data.version,
      lastModified: data.lastModified,
      sessions: data.pomodoroHistory
    };

    localStorage.setItem(STORAGE_KEYS.active, JSON.stringify(active));
    localStorage.setItem(STORAGE_KEYS.archive, JSON.stringify(archive));
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
    // OPTIMIZATION: Do NOT load archive data into memory on startup
    // const archiveContent = await invoke<string | null>('read_data_file', { fileType: 'archive' });
    const pomodoroContent = await invoke<string | null>('read_data_file', { fileType: 'pomodoro_history' });

    const active = activeContent ? JSON.parse(activeContent) as ActiveData : createDefaultActiveData();
    // const archive = archiveContent ? JSON.parse(archiveContent) as ArchiveData : createDefaultArchiveData();
    const pomodoro = pomodoroContent ? JSON.parse(pomodoroContent) as PomodoroHistoryData : createDefaultPomodoroHistoryData();

    // Combine into AppData
    return {
      version: active.version || '3.0',
      lastModified: active.lastModified,
      tasks: migrateTasks(active.tasks || []),
      archive: [], // Empty archive in memory to save RAM
      trash: migrateTasks(active.trash || []),
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
async function saveToTauri(data: AppData): Promise<void> {
  // Mark save operation as starting
  beginSave();

  try {
    const { invoke } = await import('@tauri-apps/api/core');

    // Separate into different files
    const active: ActiveData = {
      version: data.version,
      lastModified: data.lastModified,
      tasks: data.tasks,
      trash: data.trash,
      reviews: data.reviews,
      customTagGroups: data.customTagGroups,
      settings: data.settings
    };

    // NOTE: We no longer save archive here because it's managed via appendArchiveTasks
    // But if we ever need to update the whole archive, we should use a dedicated method
    
    // However, if data.archive contains something (e.g. from web fallback or full load),
    // we might inadvertently overwrite the file with partial data if we are not careful.
    // In the new "offload" model, appData.archive is expected to be EMPTY.
    // If it is NOT empty, it means we might have loaded it.
    // For safety, we will NOT write archive.json here. Archive updates should be append-only.

    const pomodoroHistory: PomodoroHistoryData = {
      version: data.version,
      lastModified: data.lastModified,
      sessions: data.pomodoroHistory
    };

    // Write all files atomically (in parallel)
    await Promise.all([
      invoke('atomic_write_file', {
        fileType: 'active',
        content: JSON.stringify(active, null, 2)
      }),
      // SKIP archive write
      invoke('atomic_write_file', {
        fileType: 'pomodoro_history',
        content: JSON.stringify(pomodoroHistory, null, 2)
      })
    ]);
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
 * Migrate tasks to add new fields
 */
function migrateTasks(tasks: Task[]): Task[] {
  return tasks.map(task => ({
    ...task,
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
    showFutureTasks: settings?.showFutureTasks ?? defaults.showFutureTasks
  };
}

/**
 * Migrate data from older versions
 */
function migrateData(data: AppData): AppData {
  // Add version if missing
  if (!data.version) {
    data.version = '1.0';
  }

  // Migrate from older versions
  if (data.version < '3.0') {
    // Add new fields that might be missing
    data.reviews = data.reviews || [];
    data.pomodoroHistory = data.pomodoroHistory || [];
    data.customTagGroups = data.customTagGroups || {
      energy: ['⚡高能量', '😴低能量', '☕中等'],
      type: ['📞电话', '💻编码', '✍️写作', '🤝会议']
    };

    // Migrate tasks
    data.tasks = migrateTasks(data.tasks || []);
    data.archive = migrateTasks(data.archive || []);
    data.trash = migrateTasks(data.trash || []);

    // Migrate settings
    data.settings = migrateSettings(data.settings);

    data.version = '3.0';
  }

  return data;
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
