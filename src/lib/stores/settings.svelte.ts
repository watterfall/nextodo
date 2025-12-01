import type { Settings, CustomTagGroups, Theme, Language } from '$lib/types';
import { createDefaultSettings } from '$lib/types';
import { setLanguage } from '$lib/i18n';

// Settings state
let settings = $state<Settings>(createDefaultSettings());

let customTagGroups = $state<CustomTagGroups>({
  energy: ['⚡高能量', '😴低能量', '☕中等'],
  type: ['📞电话', '💻编码', '✍️写作', '🤝会议']
});

// Callback for persisting changes
let persistCallback: (() => void) | null = null;

// System theme preference
let systemTheme = $state<'dark' | 'light'>('dark');

// Initialize settings
export function initSettings(
  existingSettings: Settings,
  existingTagGroups: CustomTagGroups,
  onPersist: () => void
): void {
  settings = { ...createDefaultSettings(), ...existingSettings };
  customTagGroups = { ...customTagGroups, ...existingTagGroups };
  persistCallback = onPersist;

  // Initialize language
  setLanguage(settings.language);

  // Listen for system theme changes
  if (typeof window !== 'undefined' && window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    systemTheme = mediaQuery.matches ? 'dark' : 'light';

    mediaQuery.addEventListener('change', (e) => {
      systemTheme = e.matches ? 'dark' : 'light';
      if (settings.theme === 'system') {
        applyTheme('system');
      }
    });
  }

  // Apply initial theme
  applyTheme(settings.theme);
}

// Apply theme to document
function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;

  const effectiveTheme = theme === 'system' ? systemTheme : theme;

  // Add transition class for smooth theme change
  document.documentElement.classList.add('theme-transition');

  // Set theme attribute
  document.documentElement.setAttribute('data-theme', effectiveTheme);

  // Remove transition class after animation
  setTimeout(() => {
    document.documentElement.classList.remove('theme-transition');
  }, 200);
}

// Get effective theme (resolves 'system' to actual theme)
export function getEffectiveTheme(): 'dark' | 'light' {
  return settings.theme === 'system' ? systemTheme : settings.theme;
}

// Update settings
export function updateSettings(updates: Partial<Settings>): void {
  settings = { ...settings, ...updates };

  // Apply theme if changed
  if (updates.theme !== undefined) {
    applyTheme(updates.theme);
  }

  // Apply language if changed
  if (updates.language !== undefined) {
    setLanguage(updates.language);
  }

  persistCallback?.();
}

// Set theme
export function setTheme(theme: Theme): void {
  updateSettings({ theme });
}

// Toggle theme (switches between light and dark based on effective theme)
export function toggleTheme(): void {
  const current = getEffectiveTheme();
  setTheme(current === 'dark' ? 'light' : 'dark');
}

// Set language
export function setAppLanguage(language: Language): void {
  updateSettings({ language });
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

// Auto archive days
export function setAutoArchiveDays(days: number): void {
  updateSettings({ autoArchiveDays: Math.max(1, Math.min(365, days)) });
}

// E zone aging days
export function setEZoneAgingDays(days: number): void {
  updateSettings({ eZoneAgingDays: Math.max(1, Math.min(30, days)) });
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
    get effectiveTheme() { return getEffectiveTheme(); },
    get language() { return settings.language; },
    get pomodoroWork() { return settings.pomodoroWork; },
    get pomodoroShortBreak() { return settings.pomodoroShortBreak; },
    get pomodoroLongBreak() { return settings.pomodoroLongBreak; },
    get autoArchiveDays() { return settings.autoArchiveDays; },
    get eZoneAgingDays() { return settings.eZoneAgingDays; },
    get showFutureTasks() { return settings.showFutureTasks; }
  };
}
