import type { ViewMode, Priority, Task } from '$lib/types';

// Confirmation dialog data
interface ConfirmationData {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

// UI State
let sidebarCollapsed = $state(false);
let viewMode = $state<ViewMode>('list');
let activeModal = $state<string | null>(null);
let modalData = $state<unknown>(null);
let toastMessage = $state<string | null>(null);
let toastType = $state<'success' | 'error' | 'info' | 'warning'>('info');
let isSearchOpen = $state(false);
let editingTaskId = $state<string | null>(null);
let editingTask = $state<Task | null>(null);
let confirmationData = $state<ConfirmationData | null>(null);

// Immersive mode
let isImmersiveMode = $state(false);
let isBadgesOpen = $state(false);

// Global drag state — true whenever ANY task is being dragged anywhere in the
// app. EdgeDock and other peripheral drop zones use this to surface themselves
// as visible drop magnets only when relevant.
let isDraggingTask = $state(false);
let dragSourcePriority = $state<Priority | null>(null);

// Toast timeout
let toastTimeout: ReturnType<typeof setTimeout> | null = null;

// Toggle sidebar
export function toggleSidebar(): void {
  sidebarCollapsed = !sidebarCollapsed;
}

export function setSidebarCollapsed(collapsed: boolean): void {
  sidebarCollapsed = collapsed;
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
export function showToast(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info', duration = 3000): void {
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

// Global drag tracking — called by every dndzone on DRAG_STARTED / finalize
export function setDraggingTask(active: boolean, sourcePriority: Priority | null = null): void {
  isDraggingTask = active;
  dragSourcePriority = active ? sourcePriority : null;
  // Toggle body class so the global user-select suppression in app.css only
  // applies during an active drag, leaving task text selectable normally.
  if (typeof document !== 'undefined') {
    document.body.classList.toggle('is-dragging-task', active);
  }
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

// Task editing (inline - deprecated, kept for compatibility)
export function setEditingTask(taskId: string | null): void {
  editingTaskId = taskId;
}

// Task edit modal
export function openEditModal(task: Task): void {
  editingTask = task;
}

export function closeEditModal(): void {
  editingTask = null;
}

// Confirmation dialog
export function showConfirmation(data: ConfirmationData): void {
  confirmationData = data;
}

export function closeConfirmation(): void {
  confirmationData = null;
}

export function handleConfirmationConfirm(): void {
  if (confirmationData?.onConfirm) {
    confirmationData.onConfirm();
  }
  confirmationData = null;
}

export function handleConfirmationCancel(): void {
  if (confirmationData?.onCancel) {
    confirmationData.onCancel();
  }
  confirmationData = null;
}

// Immersive mode
export function enterImmersiveMode(): void {
  isImmersiveMode = true;
}

export function exitImmersiveMode(): void {
  isImmersiveMode = false;
}

export function toggleImmersiveMode(): void {
  isImmersiveMode = !isImmersiveMode;
}

export function setBadgesOpen(open: boolean): void {
  isBadgesOpen = open;
}

// Callback for focusing new task input
let focusNewTaskCallback: (() => void) | null = null;

// Callback for toggling pomodoro
let togglePomodoroCallback: (() => void) | null = null;

// Register callbacks for keyboard shortcuts
export function registerKeyboardCallbacks(callbacks: {
  focusNewTask?: () => void;
  togglePomodoro?: () => void;
}): void {
  if (callbacks.focusNewTask) {
    focusNewTaskCallback = callbacks.focusNewTask;
  }
  if (callbacks.togglePomodoro) {
    togglePomodoroCallback = callbacks.togglePomodoro;
  }
}

// Keyboard shortcuts
export function initKeyboardShortcuts(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('keydown', (e) => {
    // Don't handle shortcuts when typing in input fields (except for specific keys)
    const target = e.target as HTMLElement;
    const isInInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

    // Cmd/Ctrl + K for search
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      toggleSearch();
      return;
    }

    // Cmd/Ctrl + N for new task (focus input)
    if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
      e.preventDefault();
      if (focusNewTaskCallback) {
        focusNewTaskCallback();
      }
      return;
    }

    // Escape to close modals/search/immersive/editing
    if (e.key === 'Escape') {
      if (editingTask) {
        closeEditModal();
      } else if (isImmersiveMode) {
        exitImmersiveMode();
      } else if (activeModal) {
        closeModal();
      } else if (isSearchOpen) {
        closeSearch();
      } else if (editingTaskId) {
        setEditingTask(null);
      }
      return;
    }

    // Don't handle remaining shortcuts if in input
    if (isInInput) return;

    // Space to toggle pomodoro (only when not typing)
    if (e.key === ' ') {
      e.preventDefault();
      if (togglePomodoroCallback) {
        togglePomodoroCallback();
      }
      return;
    }

    // Cmd/Ctrl + B for sidebar
    if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
      e.preventDefault();
      toggleSidebar();
      return;
    }

    // Cmd/Ctrl + Shift + F for immersive mode
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'f') {
      e.preventDefault();
      toggleImmersiveMode();
      return;
    }
  });
}

// Export store interface
export function getUIStore() {
  return {
    get sidebarCollapsed() { return sidebarCollapsed; },
    set sidebarCollapsed(v: boolean) { sidebarCollapsed = v; },
    get viewMode() { return viewMode; },
    get activeModal() { return activeModal; },
    get modalData() { return modalData; },
    get toastMessage() { return toastMessage; },
    get toastType() { return toastType; },
    get isSearchOpen() { return isSearchOpen; },
    set isSearchOpen(v: boolean) { isSearchOpen = v; },
    get editingTaskId() { return editingTaskId; },
    get editingTask() { return editingTask; },
    get isImmersiveMode() { return isImmersiveMode; },
    get confirmationData() { return confirmationData; },
    get isBadgesOpen() { return isBadgesOpen; },
    get isDraggingTask() { return isDraggingTask; },
    get dragSourcePriority() { return dragSourcePriority; }
  };
}

// Export type for external use
export type { ConfirmationData };
