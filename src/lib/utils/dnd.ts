/**
 * Native HTML5 Drag-and-Drop helpers for task / subtask movement.
 *
 * We deliberately use native DnD instead of svelte-dnd-action because:
 *   - Native gives us a single, stable, well-understood event model
 *   - DataTransfer text payloads let us encode payload type (task vs subtask)
 *   - No magic about DOM/items array correspondence — each draggable handles
 *     its own dragstart, each drop zone handles its own drop
 *   - Drop validation + visual feedback is fully under our control
 */

import type { Priority } from '$lib/types';

// Legacy custom MIME types. WebKit/WKWebView does not expose these reliably
// across dragover/drop, so new drags use text/plain JSON payloads instead.
export const TASK_DRAG_MIME = 'application/x-focusflow-task';
export const SUBTASK_DRAG_MIME = 'application/x-focusflow-subtask';

const TEXT_DRAG_MIME = 'text/plain';
const TASK_TEXT_PREFIX = 'focusflow-task:';
const SUBTASK_TEXT_PREFIX = 'focusflow-subtask:';

export interface TaskDragPayload {
  taskId: string;
  fromPriority: Priority;
}

export interface SubtaskDragPayload {
  parentTaskId: string;
  subtaskId: string;
  content: string;
}

function parseJsonPayload<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function getTextPayload(e: DragEvent, prefix: string): string | null {
  if (!e.dataTransfer) return null;
  const raw = e.dataTransfer.getData(TEXT_DRAG_MIME);
  if (!raw.startsWith(prefix)) return null;
  return raw.slice(prefix.length);
}

/**
 * Apply WKWebView-friendly drag setup on a dragstart event.
 *
 * On macOS WebKit (Tauri/WKWebView) HTML5 drag on a plain <div draggable="true">
 * fires dragstart but the visual drag often fails to materialize — cursor
 * doesn't change, no ghost image, no subsequent dragover. The fix is to:
 *   1. Explicitly call setDragImage() with the dragged element
 *   2. Ensure dataTransfer has at least one non-empty piece of data
 *   3. Set effectAllowed before any other access
 */
function applyDragImage(e: DragEvent): void {
  if (!e.dataTransfer) return;
  const target = e.currentTarget as HTMLElement | null;
  if (target && typeof e.dataTransfer.setDragImage === 'function') {
    // Use the actual element as the drag image, offset to cursor position
    const rect = target.getBoundingClientRect();
    const offsetX = Math.min(Math.max(0, e.clientX - rect.left), rect.width);
    const offsetY = Math.min(Math.max(0, e.clientY - rect.top), rect.height);
    try {
      e.dataTransfer.setDragImage(target, offsetX, offsetY);
    } catch {
      // Some WebKit versions throw if the element can't be snapshotted
    }
  }
}

/**
 * Write a task payload into a dragstart event.
 * text/plain is the primary transport because WKWebView preserves it reliably.
 */
export function startTaskDrag(e: DragEvent, payload: TaskDragPayload): void {
  if (!e.dataTransfer) return;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData(TEXT_DRAG_MIME, `${TASK_TEXT_PREFIX}${JSON.stringify(payload)}`);
  applyDragImage(e);
}

export function startSubtaskDrag(e: DragEvent, payload: SubtaskDragPayload): void {
  if (!e.dataTransfer) return;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData(TEXT_DRAG_MIME, `${SUBTASK_TEXT_PREFIX}${JSON.stringify(payload)}`);
  applyDragImage(e);
}

// Kept for callers that still invoke it; it is a no-op now that the singleton
// fallback was removed. State cleanup is the source's (TaskCard) responsibility
// via ondragend plus a window-level safety net in App.svelte.
export function clearDragPayload(): void {
  /* no-op — payload now lives only in DataTransfer */
}

export function getTaskDragPayload(e: DragEvent): TaskDragPayload | null {
  if (!e.dataTransfer) return null;
  const textPayload = getTextPayload(e, TASK_TEXT_PREFIX);
  if (textPayload) return parseJsonPayload<TaskDragPayload>(textPayload);

  const legacyPayload = e.dataTransfer.getData(TASK_DRAG_MIME);
  if (legacyPayload) return parseJsonPayload<TaskDragPayload>(legacyPayload);

  return null;
}

export function getSubtaskDragPayload(e: DragEvent): SubtaskDragPayload | null {
  if (!e.dataTransfer) return null;
  const textPayload = getTextPayload(e, SUBTASK_TEXT_PREFIX);
  if (textPayload) return parseJsonPayload<SubtaskDragPayload>(textPayload);

  const legacyPayload = e.dataTransfer.getData(SUBTASK_DRAG_MIME);
  if (legacyPayload) return parseJsonPayload<SubtaskDragPayload>(legacyPayload);

  return null;
}

/**
 * Quick check during dragenter/dragover to decide whether to call
 * preventDefault (which is required for the drop to fire).
 *
 * Note: this is only a coarse check. During dragover browsers do not expose
 * the actual text/plain data, so DropZone primarily relies on the app-level
 * `isDraggingTask` state and validates the payload during drop.
 */
export function isTaskDragType(e: DragEvent): boolean {
  if (!e.dataTransfer) return false;
  return e.dataTransfer.types.includes(TEXT_DRAG_MIME);
}
