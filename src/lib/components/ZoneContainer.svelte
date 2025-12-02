<script lang="ts">
  import type { Task, Priority } from '$lib/types';
  import { PRIORITY_CONFIG } from '$lib/types';
  import TaskCard from './TaskCard.svelte';
  import { getUIStore, setDropTarget, clearDragState, showToast } from '$lib/stores/ui.svelte';
  import { changePriority, getTasksStore, reorderTask } from '$lib/stores/tasks.svelte';
  import { getPomodoroStore } from '$lib/stores/pomodoro.svelte';
  import { countActiveByPriority } from '$lib/utils/quota';
  import { getI18nStore } from '$lib/i18n';
  import { dndzone, TRIGGERS, SHADOW_ITEM_MARKER_PROPERTY_NAME } from 'svelte-dnd-action';
  import { flip } from 'svelte/animate';
  import { dndConfig, areTaskArraysEqual, type DndConsiderEvent, type DndFinalizeEvent } from '$lib/utils/motion';
  import { isTauri } from '$lib/utils/storage';

  // Shared DnD type for cross-zone dragging
  const DND_TYPE = 'task-priority-zone';

  interface Props {
    priority: Priority;
    tasks: Task[];
  }

  let { priority, tasks }: Props = $props();

  const pomodoro = getPomodoroStore();
  const i18n = getI18nStore();
  const t = i18n.t;

  const config = PRIORITY_CONFIG[priority];
  const ui = getUIStore();
  const tasksStore = getTasksStore();

  let isDropTarget = $derived(ui.dropTargetPriority === priority);
  let showCompleted = $state(false);
  let isDndActive = $state(false);

  const counts = $derived(countActiveByPriority(tasksStore.tasks));
  const remaining = $derived(config.quota === Infinity ? Infinity : config.quota - counts[priority]);
  const isFull = $derived(priority !== 'F' && config.quota !== Infinity && remaining <= 0);

  // Check if pomodoro is actively running on a task
  const isFocusMode = $derived(pomodoro.state === 'work' && pomodoro.activeTaskId !== null);
  const hasActiveTask = $derived(tasks.some(task => task.id === pomodoro.activeTaskId));

  // Filter out completed tasks for display
  let activeTasks = $derived(tasks.filter(task => !task.completed));
  let completedTasks = $derived(tasks.filter(task => task.completed));

  // DnD items - need to be reactive and include shadow marker handling
  let dndItems = $state<Task[]>([]);

  // Keep dndItems in sync with activeTasks (with shallow comparison to avoid unnecessary updates)
  $effect(() => {
    // Only update if not currently dragging and arrays are different
    if (!isDndActive && !areTaskArraysEqual(dndItems, activeTasks)) {
      dndItems = [...activeTasks];
    }
  });

  // Get tooltip text for priority
  const tooltipText = $derived(t(`priority.tooltip.${priority}`));

  // Handle DnD events from svelte-dnd-action
  function handleDndConsider(e: DndConsiderEvent) {
    const { items, info } = e.detail;
    dndItems = items;

    if (info.trigger === TRIGGERS.DRAG_STARTED) {
      isDndActive = true;
      setDropTarget(priority);
      // Suspend file watcher
      if (isTauri()) {
        import('@tauri-apps/api/core').then(({ invoke }) => {
          invoke('suspend_watcher');
        });
      }
    }
  }

  async function handleDndFinalize(e: DndFinalizeEvent) {
    const { items, info } = e.detail;

    // Filter out shadow placeholders
    const cleanItems = items.filter(item => !item[SHADOW_ITEM_MARKER_PROPERTY_NAME as keyof Task]);
    dndItems = cleanItems;

    try {
      if (info.trigger === TRIGGERS.DROPPED_INTO_ZONE) {
        // Item was dropped into this zone
        const droppedTask = cleanItems.find(task => task.id === info.id);
        if (droppedTask && droppedTask.priority !== priority) {
          // Change priority for items from other zones
          const result = await changePriority(info.id, priority);
          if (!result.success) {
            // Show error feedback to user
            showToast(result.error || t('error.quotaExceeded'), 'error');
            // Revert on failure
            dndItems = [...activeTasks];
          } else {
            // Refresh with fresh data from store
            dndItems = [...activeTasks];
          }
        } else {
          // Reorder within same zone
          const newOrder = cleanItems.map(task => task.id);
          await reorderTask(priority, newOrder);
        }
      } else if (info.trigger === TRIGGERS.DROPPED_OUTSIDE_OF_ANY) {
        // Reset if dropped outside
        dndItems = [...activeTasks];
      }
    } finally {
      isDndActive = false;
      clearDragState();
      // Resume file watcher
      if (isTauri()) {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('resume_watcher');
      }
    }
  }

  // Legacy drag handlers for fallback
  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'move';
    setDropTarget(priority);
  }

  function handleDragLeave() {
    clearDragState();
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    const taskId = e.dataTransfer!.getData('text/plain');

    if (taskId && taskId !== ui.draggedTaskId) {
      changePriority(taskId, priority);
    }

    clearDragState();
  }
</script>

<div
  class="zone-container zone-{priority.toLowerCase()}"
  class:drop-target={isDropTarget || isDndActive}
  class:is-priority-a={priority === 'A'}
  class:is-full={isFull}
  class:focus-dimmed={isFocusMode && !hasActiveTask}
  style:--zone-color={config.color}
  style:--zone-bg={config.bgColor}
  style:--zone-border={config.borderColor}
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
  role="region"
  aria-label="{config.name}"
>
  <!-- Sleek-style Header with hover reveal -->
  <div class="zone-header" title={tooltipText}>
    <div class="zone-badge" style:background={config.color}>
      {priority}
    </div>
    <div class="zone-info">
      <span class="zone-name">{t(`priority.${priority}`)}</span>
      <span class="zone-meta">
        <span class="zone-quota">{counts[priority]}/{config.quota === Infinity ? '∞' : config.quota}</span>
        <span class="zone-time">{t(`priority.time.${priority}`)}</span>
      </span>
    </div>
    {#if priority === 'A' && activeTasks.length > 0}
      <span class="breathing-light"></span>
    {/if}
  </div>

  <div class="zone-tasks">
    {#if dndItems.length > 0 || activeTasks.length > 0}
      <div
        class="tasks-grid"
        class:compact={priority === 'D'}
        use:dndzone={{
          items: dndItems,
          flipDurationMs: dndConfig.flipDurationMs,
          dropTargetStyle: {},
          dropTargetClasses: ['dnd-drop-target-active'],
          dragDisabled: isFocusMode && !hasActiveTask,
          type: DND_TYPE
        }}
        onconsider={handleDndConsider}
        onfinalize={handleDndFinalize}
      >
        {#each dndItems as task (task.id)}
          <div animate:flip={{ duration: dndConfig.flipDurationMs }} class="task-item-wrapper">
            <TaskCard {task} compact={priority === 'D'} />
          </div>
        {/each}
      </div>
    {:else}
      <div class="empty-zone" class:very-subtle={!isDropTarget}>
        <span class="empty-text">
          {#if isFull}
            {t('zone.full')}
          {:else}
            {t('zone.dropHere')}
          {/if}
        </span>
      </div>
    {/if}
  </div>

  {#if completedTasks.length > 0}
    <button
      class="completed-toggle hover-reveal-parent"
      onclick={() => showCompleted = !showCompleted}
    >
      <svg class="toggle-icon" class:rotated={showCompleted} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="9 18 15 12 9 6"></polyline>
      </svg>
      <span>{t('filter.completed')} ({completedTasks.length})</span>
    </button>

    {#if showCompleted}
      <div class="completed-list">
        {#each completedTasks as task (task.id)}
          <TaskCard {task} compact={true} />
        {/each}
      </div>
    {/if}
  {/if}
</div>

<style>
  .zone-container {
    background: var(--card-bg);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    padding: 16px;
    transition: all var(--transition-normal);
    min-height: 80px;
    /* Glassmorphism */
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }

  .zone-container:hover {
    border-color: var(--border-color);
  }

  .zone-container.drop-target {
    border-color: var(--zone-color);
    box-shadow: 0 0 0 2px var(--zone-color), var(--shadow-md);
    background: var(--zone-bg);
    transform: scale(1.01);
  }

  .zone-container.is-full {
    opacity: 0.7;
  }

  /* Focus mode dimming - now in global CSS but keeping local override */
  .zone-container.focus-dimmed {
    opacity: 0.3;
    filter: grayscale(0.4) blur(0.5px);
    pointer-events: none;
    transition: all 0.4s ease;
  }

  .zone-container.is-priority-a {
    position: relative;
    overflow: hidden;
  }

  .zone-container.is-priority-a::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(218, 119, 242, 0.06), rgba(151, 117, 250, 0.02));
    pointer-events: none;
  }

  /* Sleek-style Header */
  .zone-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 14px;
    position: relative;
    cursor: help;
  }

  .zone-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 700;
    color: white;
    flex-shrink: 0;
  }

  .zone-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0;
  }

  .zone-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .zone-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    color: var(--text-muted);
  }

  .zone-quota {
    font-weight: 500;
    color: var(--zone-color);
  }

  .zone-time {
    opacity: 0.8;
  }

  .breathing-light {
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 8px;
    height: 8px;
    border-radius: var(--radius-full);
    background: var(--zone-color);
    animation: breathe 2.5s ease-in-out infinite;
  }

  .zone-tasks {
    min-height: 40px;
  }

  .tasks-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 20px;
  }

  .tasks-grid.compact {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 8px;
  }

  .task-item-wrapper {
    /* Required for FLIP animation */
    transform-origin: center center;
  }

  .empty-zone {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px 16px;
    border: 1px dashed var(--border-color);
    border-radius: var(--radius-md);
    min-height: 50px;
    transition: all var(--transition-normal);
  }

  /* Very subtle empty state until hovered */
  .empty-zone.very-subtle {
    opacity: 0.25;
    border-color: transparent;
  }

  .zone-container:hover .empty-zone.very-subtle {
    opacity: 0.6;
    border-color: var(--border-color);
  }

  .empty-text {
    font-size: 12px;
    color: var(--text-muted);
  }

  .completed-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 10px 0;
    margin-top: 12px;
    border: none;
    border-top: 1px solid var(--border-subtle);
    background: transparent;
    color: var(--text-muted);
    font-size: 11px;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .completed-toggle:hover {
    color: var(--text-secondary);
  }

  .toggle-icon {
    width: 12px;
    height: 12px;
    transition: transform var(--transition-fast);
  }

  .toggle-icon.rotated {
    transform: rotate(90deg);
  }

  .completed-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-top: 8px;
  }

  @keyframes breathe {
    0%, 100% {
      opacity: 0.5;
      transform: translateY(-50%) scale(1);
      box-shadow: 0 0 4px var(--zone-color);
    }
    50% {
      opacity: 1;
      transform: translateY(-50%) scale(1.1);
      box-shadow: 0 0 12px var(--zone-color), 0 0 20px var(--zone-color);
    }
  }

  /* Responsive */
  @media (max-width: 768px) {
    .tasks-grid.compact {
      grid-template-columns: 1fr;
    }
  }
</style>
