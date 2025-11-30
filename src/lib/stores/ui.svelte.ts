import type { ViewMode, Priority } from '$lib/types';

// UI State
let sidebarCollapsed = $state(false);
let theme = $state<'dark' | 'light'>('dark');
let viewMode = $state<ViewMode>('zones');
let activeModal = $state<string | null>(null);
let modalData = $state<unknown>(null);
let toastMessage = $state<string | null>(null);
let toastType = $state<'success' | 'error' | 'info'>('info');
let isSearchOpen = $state(false);
let editingTaskId = $state<string | null>(null);
let draggedTaskId = $state<string | null>(null);
let dropTargetPriority = $state<Priority | null>(null);

// Toast timeout
let toastTimeout: ReturnType<typeof setTimeout> | null = null;

// Toggle sidebar
export function toggleSidebar(): void {
  sidebarCollapsed = !sidebarCollapsed;
}

export function setSidebarCollapsed(collapsed: boolean): void {
  sidebarCollapsed = collapsed;
}

// Theme
export function setTheme(newTheme: 'dark' | 'light'): void {
  theme = newTheme;

  // Apply to document
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', newTheme);
  }
}

export function toggleTheme(): void {
  setTheme(theme === 'dark' ? 'light' : 'dark');
}

// View mode
export function setViewMode(mode: ViewMode): void {
  viewMode = mode;
}

// Modal
export function openModal(name: string, data?: unknown): void {
  activeModal = name;
  modalData = data ?? null;
}

export function closeModal(): void {
  activeModal = null;
  modalData = null;
}

// Toast notifications
export function showToast(message: string, type: 'success' | 'error' | 'info' = 'info', duration = 3000): void {
  // Clear existing timeout
  if (toastTimeout) {
    clearTimeout(toastTimeout);
  }

  toastMessage = message;
  toastType = type;

  // Auto-hide after duration
  toastTimeout = setTimeout(() => {
    toastMessage = null;
  }, duration);
}

export function hideToast(): void {
  if (toastTimeout) {
    clearTimeout(toastTimeout);
    toastTimeout = null;
  }
  toastMessage = null;
}

// Search
export function toggleSearch(): void {
  isSearchOpen = !isSearchOpen;
}

export function openSearch(): void {
  isSearchOpen = true;
}

export function closeSearch(): void {
  isSearchOpen = false;
}

// Task editing
export function setEditingTask(taskId: string | null): void {
  editingTaskId = taskId;
}

// Drag and drop
export function setDraggedTask(taskId: string | null): void {
  draggedTaskId = taskId;
}

export function setDropTarget(priority: Priority | null): void {
  dropTargetPriority = priority;
}

export function clearDragState(): void {
  draggedTaskId = null;
  dropTargetPriority = null;
}

// Keyboard shortcuts
export function initKeyboardShortcuts(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('keydown', (e) => {
    // Cmd/Ctrl + K for search
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      toggleSearch();
    }

    // Escape to close modals/search
    if (e.key === 'Escape') {
      if (activeModal) {
        closeModal();
      } else if (isSearchOpen) {
        closeSearch();
      } else if (editingTaskId) {
        setEditingTask(null);
      }
    }

    // Cmd/Ctrl + B for sidebar
    if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
      e.preventDefault();
      toggleSidebar();
    }
  });
}

// Export store interface
export function getUIStore() {
  return {
    get sidebarCollapsed() { return sidebarCollapsed; },
    get theme() { return theme; },
    get viewMode() { return viewMode; },
    get activeModal() { return activeModal; },
    get modalData() { return modalData; },
    get toastMessage() { return toastMessage; },
    get toastType() { return toastType; },
    get isSearchOpen() { return isSearchOpen; },
    get editingTaskId() { return editingTaskId; },
    get draggedTaskId() { return draggedTaskId; },
    get dropTargetPriority() { return dropTargetPriority; }
  };
}
