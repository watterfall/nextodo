import type { Settings, CustomTagGroups } from '$lib/types';

// Settings state
let settings = $state<Settings>({
  theme: 'dark',
  pomodoroWork: 25,
  pomodoroShortBreak: 5,
  pomodoroLongBreak: 20,
  autoBackup: true,
  sidebarCollapsed: false
});

let customTagGroups = $state<CustomTagGroups>({
  energy: ['⚡高能量', '😴低能量', '☕中等'],
  type: ['📞电话', '💻编码', '✍️写作', '🤝会议']
});

// Callback for persisting changes
let persistCallback: (() => void) | null = null;

// Initialize settings
export function initSettings(
  existingSettings: Settings,
  existingTagGroups: CustomTagGroups,
  onPersist: () => void
): void {
  settings = { ...settings, ...existingSettings };
  customTagGroups = { ...customTagGroups, ...existingTagGroups };
  persistCallback = onPersist;

  // Apply theme
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', settings.theme);
  }
}

// Update settings
export function updateSettings(updates: Partial<Settings>): void {
  settings = { ...settings, ...updates };

  // Apply theme if changed
  if (updates.theme && typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', updates.theme);
  }

  persistCallback?.();
}

// Toggle theme
export function toggleTheme(): void {
  const newTheme = settings.theme === 'dark' ? 'light' : 'dark';
  updateSettings({ theme: newTheme });
}

// Pomodoro settings
export function setPomodoroWork(minutes: number): void {
  updateSettings({ pomodoroWork: Math.max(1, Math.min(60, minutes)) });
}

export function setPomodoroShortBreak(minutes: number): void {
  updateSettings({ pomodoroShortBreak: Math.max(1, Math.min(30, minutes)) });
}

export function setPomodoroLongBreak(minutes: number): void {
  updateSettings({ pomodoroLongBreak: Math.max(1, Math.min(60, minutes)) });
}

// Tag groups
export function addTagGroup(name: string): void {
  if (!customTagGroups[name]) {
    customTagGroups = { ...customTagGroups, [name]: [] };
    persistCallback?.();
  }
}

export function removeTagGroup(name: string): void {
  if (name !== 'energy' && name !== 'type') {
    const newGroups = { ...customTagGroups };
    delete newGroups[name];
    customTagGroups = newGroups;
    persistCallback?.();
  }
}

export function addTagToGroup(groupName: string, tag: string): void {
  if (customTagGroups[groupName] && !customTagGroups[groupName].includes(tag)) {
    customTagGroups = {
      ...customTagGroups,
      [groupName]: [...customTagGroups[groupName], tag]
    };
    persistCallback?.();
  }
}

export function removeTagFromGroup(groupName: string, tag: string): void {
  if (customTagGroups[groupName]) {
    customTagGroups = {
      ...customTagGroups,
      [groupName]: customTagGroups[groupName].filter(t => t !== tag)
    };
    persistCallback?.();
  }
}

// Get all available tags as flat array
function getAllTags(): string[] {
  const tags: string[] = [];
  for (const group of Object.values(customTagGroups)) {
    tags.push(...group);
  }
  return tags;
}

// Export store interface
export function getSettingsStore() {
  return {
    get settings() { return settings; },
    get customTagGroups() { return customTagGroups; },
    get allTags() { return getAllTags(); },
    get theme() { return settings.theme; },
    get pomodoroWork() { return settings.pomodoroWork; },
    get pomodoroShortBreak() { return settings.pomodoroShortBreak; },
    get pomodoroLongBreak() { return settings.pomodoroLongBreak; }
  };
}
