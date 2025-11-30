import type { AppData } from '$lib/types';
import { createDefaultAppData } from '$lib/types';

// For development/web mode, use localStorage
// For Tauri, use the file system

const STORAGE_KEY = 'focusflow_data';
const BACKUP_KEY = 'focusflow_backup';

/**
 * Check if running in Tauri environment
 */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

/**
 * Load app data from storage
 */
export async function loadAppData(): Promise<AppData> {
  if (isTauri()) {
    return loadFromTauri();
  }
  return loadFromLocalStorage();
}

/**
 * Save app data to storage
 */
export async function saveAppData(data: AppData): Promise<void> {
  // Update last modified timestamp
  data.lastModified = new Date().toISOString();

  if (isTauri()) {
    await saveToTauri(data);
  } else {
    saveToLocalStorage(data);
  }
}

/**
 * Load from localStorage (web/dev mode)
 */
function loadFromLocalStorage(): AppData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored) as AppData;
      return migrateData(data);
    }
  } catch (error) {
    console.error('Failed to load from localStorage:', error);
  }

  return createDefaultAppData();
}

/**
 * Save to localStorage (web/dev mode)
 */
function saveToLocalStorage(data: AppData): void {
  try {
    // Create backup before saving
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) {
      localStorage.setItem(BACKUP_KEY, existing);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save to localStorage:', error);
    throw error;
  }
}

/**
 * Load from Tauri file system
 */
async function loadFromTauri(): Promise<AppData> {
  try {
    const { readTextFile, BaseDirectory } = await import('@tauri-apps/plugin-fs');

    const content = await readTextFile('focusflow_data.json', {
      baseDir: BaseDirectory.AppData
    });

    const data = JSON.parse(content) as AppData;
    return migrateData(data);
  } catch (error) {
    // File doesn't exist, return default
    console.log('No existing data file, creating default');
    return createDefaultAppData();
  }
}

/**
 * Save to Tauri file system
 */
async function saveToTauri(data: AppData): Promise<void> {
  try {
    const { writeTextFile, mkdir, exists, BaseDirectory } = await import('@tauri-apps/plugin-fs');

    // Ensure directory exists
    const dirExists = await exists('', { baseDir: BaseDirectory.AppData });
    if (!dirExists) {
      await mkdir('', { baseDir: BaseDirectory.AppData, recursive: true });
    }

    // Create backup if auto-backup is enabled
    if (data.settings.autoBackup) {
      try {
        const { readTextFile } = await import('@tauri-apps/plugin-fs');
        const existing = await readTextFile('focusflow_data.json', {
          baseDir: BaseDirectory.AppData
        });

        const backupName = `focusflow_backup_${new Date().toISOString().split('T')[0]}.json`;
        await writeTextFile(backupName, existing, {
          baseDir: BaseDirectory.AppData
        });
      } catch {
        // No existing file to backup
      }
    }

    // Write main data file
    await writeTextFile('focusflow_data.json', JSON.stringify(data, null, 2), {
      baseDir: BaseDirectory.AppData
    });
  } catch (error) {
    console.error('Failed to save to Tauri:', error);
    throw error;
  }
}

/**
 * Migrate data from older versions
 */
function migrateData(data: AppData): AppData {
  // Add version if missing
  if (!data.version) {
    data.version = '1.0';
  }

  // Migrate from 1.0 to 2.0
  if (data.version === '1.0') {
    // Add new fields that might be missing
    data.reviews = data.reviews || [];
    data.pomodoroHistory = data.pomodoroHistory || [];
    data.customTagGroups = data.customTagGroups || {
      energy: ['⚡高能量', '😴低能量', '☕中等'],
      type: ['📞电话', '💻编码', '✍️写作', '🤝会议']
    };

    // Migrate tasks
    data.tasks = data.tasks.map(task => ({
      ...task,
      pomodoros: task.pomodoros || { estimated: 0, completed: 0 },
      recurrence: task.recurrence || null
    }));

    data.version = '2.0';
  }

  // Ensure settings have all required fields
  data.settings = {
    theme: 'dark',
    pomodoroWork: 25,
    pomodoroShortBreak: 5,
    pomodoroLongBreak: 20,
    autoBackup: true,
    sidebarCollapsed: false,
    ...data.settings
  };

  return data;
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
    try {
      await remove('focusflow_data.json', { baseDir: BaseDirectory.AppData });
    } catch {
      // File doesn't exist
    }
  } else {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(BACKUP_KEY);
  }
}
