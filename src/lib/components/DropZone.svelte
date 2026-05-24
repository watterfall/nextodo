<script lang="ts">
  import type { Snippet } from 'svelte';
  import {
    getTaskDragPayload,
    getSubtaskDragPayload,
    type TaskDragPayload,
    type SubtaskDragPayload
  } from '$lib/utils/dnd';
  import { getUIStore, showToast } from '$lib/stores/ui.svelte';

  interface Props {
    /**
     * Called when a task is dropped here. Return success/error to control toast.
     * Return null/undefined if the drop should be silently ignored.
     */
    onTaskDrop?: (payload: TaskDragPayload) => Promise<{ success: boolean; error?: string; toast?: string } | null | void> | null | void;
    /** Same shape for subtasks. */
    onSubtaskDrop?: (payload: SubtaskDragPayload) => Promise<{ success: boolean; error?: string; toast?: string } | null | void> | null | void;
    /** Accent color for the drop indicator (border + bg tint). */
    color?: string;
    /** When true, this zone advertises itself as a drop target while ANY drag is active. */
    showHintWhileDragging?: boolean;
    /** Extra class to apply to the wrapper. */
    class?: string;
    children?: Snippet;
  }

  let {
    onTaskDrop,
    onSubtaskDrop,
    color = 'var(--primary)',
    showHintWhileDragging = true,
    class: extraClass = '',
    children
  }: Props = $props();

  const ui = getUIStore();

  // dragenter/leave fire for every child as the pointer moves through the
  // subtree. Use a depth counter so the `isOver` flag stays true until the
  // pointer truly leaves the outer container.
  let depth = $state(0);
  let isOver = $derived(depth > 0);

  // WKWebView/Tauri is strict about HTML5 DnD: a drop will not fire unless
  // dragenter/dragover call preventDefault. Keep this unconditional for app
  // drop zones and validate the actual payload during drop.
  function handleDragEnter(e: DragEvent) {
    e.preventDefault();
    depth += 1;
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  }

  function handleDragLeave(e: DragEvent) {
    depth = Math.max(0, depth - 1);
  }

  async function handleDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    depth = 0;

    // Cleanup of global drag state lives on the source's ondragend handler.
    // DropZone only consumes the payload — it does NOT mutate global state,
    // so a passively-traversed nested zone can't kill the in-flight drag.
    // Try subtask first (more specific), then task.
    const subPayload = getSubtaskDragPayload(e);
    if (subPayload && onSubtaskDrop) {
      const result = await onSubtaskDrop(subPayload);
      if (result && typeof result === 'object') {
        if (!result.success && result.error) {
          showToast(result.error, 'error');
        } else if (result.success && result.toast) {
          showToast(result.toast, 'success');
        }
      }
      return;
    }

    const taskPayload = getTaskDragPayload(e);
    if (taskPayload && onTaskDrop) {
      const result = await onTaskDrop(taskPayload);
      if (result && typeof result === 'object') {
        if (!result.success && result.error) {
          showToast(result.error, 'error');
        } else if (result.success && result.toast) {
          showToast(result.toast, 'success');
        }
      }
    }
  }
</script>

<div
  class={`drop-zone ${extraClass}`}
  class:is-over={isOver}
  class:drag-eligible={showHintWhileDragging && ui.isDraggingTask}
  style:--dz-color={color}
  ondragenter={handleDragEnter}
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
  role="region"
>
  {@render children?.()}
</div>

<style>
  .drop-zone {
    position: relative;
    transition:
      box-shadow 0.16s cubic-bezier(0.16, 1, 0.3, 1),
      background 0.16s cubic-bezier(0.16, 1, 0.3, 1),
      outline-color 0.12s ease,
      transform 0.16s cubic-bezier(0.16, 1, 0.3, 1);
  }

  /* Subtle ambient hint while a drag is happening anywhere — invites the drop */
  .drop-zone.drag-eligible {
    outline: 1px dashed color-mix(in srgb, var(--dz-color) 55%, transparent);
    outline-offset: -2px;
  }

  /* Hover — strong signal that THIS is the active drop target */
  .drop-zone.is-over {
    outline: 2.5px solid var(--dz-color);
    outline-offset: -2px;
    background: color-mix(in srgb, var(--dz-color) 10%, transparent);
    box-shadow:
      0 0 0 4px color-mix(in srgb, var(--dz-color) 22%, transparent),
      inset 0 0 24px color-mix(in srgb, var(--dz-color) 14%, transparent);
    transform: scale(1.005);
  }

  /* Optional pulse animation on the active drop target */
  .drop-zone.is-over::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    pointer-events: none;
    box-shadow: inset 0 0 0 1px var(--dz-color);
    opacity: 0;
    animation: dz-pulse 1.3s ease-in-out infinite;
  }

  @keyframes dz-pulse {
    0%, 100% { opacity: 0; }
    50%      { opacity: 0.75; }
  }
</style>
