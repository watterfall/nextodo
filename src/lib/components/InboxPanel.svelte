<script lang="ts">
  import type { Task, Priority } from '$lib/types';
  import { PRIORITY_CONFIG } from '$lib/types';
  import TaskCard from './TaskCard.svelte';
  import { getTasksStore, changePriority, reorderTask } from '$lib/stores/tasks.svelte';
  import { getPomodoroStore } from '$lib/stores/pomodoro.svelte';
  import { getUIStore, showToast } from '$lib/stores/ui.svelte';
  import { getI18nStore } from '$lib/i18n';
  import { dndzone, TRIGGERS, SHADOW_ITEM_MARKER_PROPERTY_NAME } from 'svelte-dnd-action';
  import { flip } from 'svelte/animate';
  import { dndConfig, areTaskArraysEqual, type DndConsiderEvent, type DndFinalizeEvent } from '$lib/utils/motion';
  import { isTauri } from '$lib/utils/storage';

  const tasks = getTasksStore();
  const pomodoro = getPomodoroStore();
  const ui = getUIStore();
  const i18n = getI18nStore();
  const t = i18n.t;

  // Shared DnD type for cross-zone dragging - must match ListView and KanbanView
  const DND_TYPE = 'task-priority-zone';

  interface Props {
    isDrawer?: boolean; // New prop to style as drawer
  }

  let { isDrawer = false }: Props = $props();

  // Focus mode - dim inbox when pomodoro is active on non-inbox task
  let isFocusMode = $derived(pomodoro.state === 'work' && pomodoro.activeTaskId !== null);
  let hasActiveTask = $derived(tasks.tasksByPriority['F'].some(task => task.id === pomodoro.activeTaskId));

  let inboxTasks = $derived(tasks.tasksByPriority['F'].filter(task => !task.completed));
  let completedTasks = $derived(tasks.tasksByPriority['F'].filter(task => task.completed));
  let showCompleted = $state(false);

  // DnD state
  let dndItems = $state<Task[]>([]);
  let isDndActive = $state(false);

  // Keep dndItems in sync with inboxTasks (with shallow comparison)
  $effect(() => {
    if (!isDndActive && !areTaskArraysEqual(dndItems, inboxTasks)) {
      dndItems = [...inboxTasks];
    }
  });

  // Check if any task is being dragged (from ui store for legacy support)
  let isDragging = $derived(ui.draggedTaskId !== null || isDndActive);

  const priorityTargets = $derived([
    { priority: 'A' as Priority, label: t('priority.A'), color: PRIORITY_CONFIG.A.color, time: t('priority.time.A') },
    { priority: 'B' as Priority, label: t('priority.B'), color: PRIORITY_CONFIG.B.color, time: t('priority.time.B') },
    { priority: 'C' as Priority, label: t('priority.C'), color: PRIORITY_CONFIG.C.color, time: t('priority.time.C') },
    { priority: 'D' as Priority, label: t('priority.D'), color: PRIORITY_CONFIG.D.color, time: t('priority.time.D') },
    { priority: 'E' as Priority, label: t('priority.E'), color: PRIORITY_CONFIG.E.color, time: t('priority.time.E') },
  ]);

  function handleMoveToPriority(taskId: string, priority: Priority) {
    changePriority(taskId, priority);
  }

  // Legacy drop handler for native drag events
  function handleDrop(e: DragEvent, priority: Priority) {
    e.preventDefault();
    const taskId = e.dataTransfer!.getData('text/plain');
    if (taskId) {
      handleMoveToPriority(taskId, priority);
    }
  }

  // DnD handlers for svelte-dnd-action
  function handleDndConsider(e: DndConsiderEvent) {
    const { items, info } = e.detail;
    dndItems = items;

    if (info.trigger === TRIGGERS.DRAG_STARTED) {
      isDndActive = true;
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
        const droppedTask = cleanItems.find(task => task.id === info.id);
        if (droppedTask && droppedTask.priority !== 'F') {
          // Item came from another priority - change its priority to F
          const result = await changePriority(info.id, 'F');
          if (!result.success) {
            // Show error feedback to user
            showToast(result.error || t('error.quotaExceeded'), 'error');
            // Revert on failure
            dndItems = [...inboxTasks];
          } else {
            // Refresh with fresh data from store
            dndItems = [...inboxTasks];
          }
        } else {
          // Reorder within inbox (F zone)
          const newOrder = cleanItems.map(task => task.id);
          await reorderTask('F', newOrder);
        }
      } else if (info.trigger === TRIGGERS.DROPPED_OUTSIDE_OF_ANY) {
        // Reset if dropped outside
        dndItems = [...inboxTasks];
      }
    } finally {
      isDndActive = false;
      // Resume file watcher
      if (isTauri()) {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('resume_watcher');
      }
    }
  }
</script>

<div class="inbox-panel" class:focus-dimmed={isFocusMode && !hasActiveTask} class:drawer-mode={isDrawer}>
  <!-- Header with Sleek-style badge -->
  <div class="panel-header">
    <div class="header-main">
      <div class="inbox-badge" style:background={PRIORITY_CONFIG.F.color}>💡</div>
      <div class="header-info">
        <h3 class="title-text">{t('inbox.title')}</h3>
        {#if !isDrawer}
          <span class="subtitle">{t('inbox.subtitle')}</span>
        {/if}
      </div>
      <span class="task-count">{inboxTasks.length}</span>
    </div>
  </div>

  <!-- Drag Drop Targets - Expanded when dragging (Hidden in Drawer mode) -->
  {#if !isDrawer && (isDragging || inboxTasks.length > 0)}
    <div class="drag-targets" class:active={isDragging} class:expanded={isDragging}>
      <div class="drag-hint" class:visible={isDragging}>{t('inbox.dragHint')}</div>
      <div class="target-row">
        {#each priorityTargets as target}
          <div
            class="drop-target"
            class:pulse={isDragging}
            style:--target-color={target.color}
            ondragover={(e) => e.preventDefault()}
            ondrop={(e) => handleDrop(e, target.priority)}
            title={t(`priority.tooltip.${target.priority}`)}
            role="button"
            tabindex="0"
          >
            <span class="target-letter">{target.priority}</span>
            <span class="target-time">{target.time}</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <div class="tasks-container">
    {#if dndItems.length > 0 || inboxTasks.length > 0}
      <div
        class="tasks-list"
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
          <div animate:flip={{ duration: dndConfig.flipDurationMs }} class="task-wrapper">
            <TaskCard {task} compact={true} />

            <!-- Quick Priority Buttons (shown on hover, hidden in drawer) -->
            {#if !isDrawer}
              <div class="priority-actions">
                {#each priorityTargets as target}
                  <button
                    class="priority-btn"
                    style:--btn-color={target.color}
                    onclick={() => handleMoveToPriority(task.id, target.priority)}
                    title={`${t('inbox.moveTo')} ${target.label} (${target.time})`}
                  >
                    {target.priority}
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {:else}
      <div class="empty-state">
        <div class="empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M9 12l2 2 4-4"></path>
            <circle cx="12" cy="12" r="10"></circle>
          </svg>
        </div>
        <p class="empty-text">{t('inbox.empty')}</p>
        <p class="empty-hint">{t('inbox.emptyHint')}</p>
      </div>
    {/if}
  </div>

  {#if completedTasks.length > 0}
    <button
      class="completed-toggle"
      onclick={() => showCompleted = !showCompleted}
    >
      <svg class="toggle-icon" class:rotated={showCompleted} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="9 18 15 12 9 6"></polyline>
      </svg>
      <span>{t('inbox.completed')} ({completedTasks.length})</span>
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
  .inbox-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--card-bg);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    overflow: hidden;
    transition: all 0.4s ease;
    /* Glassmorphism */
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }

  .inbox-panel.drawer-mode {
    border-radius: 0;
    border: none;
    border-left: 1px solid var(--border-subtle);
    background: var(--bg-secondary);
  }

  .inbox-panel.focus-dimmed {
    opacity: 0.3;
    filter: grayscale(0.4) blur(0.5px);
    pointer-events: none;
  }

  .panel-header {
    padding: 16px;
    border-bottom: 1px solid var(--border-subtle);
    flex-shrink: 0;
  }

  .header-main {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .inbox-badge {
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

  .header-info {
    flex: 1;
    min-width: 0;
  }

  .title-text {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .subtitle {
    font-size: 11px;
    color: var(--text-muted);
  }

  .task-count {
    padding: 3px 10px;
    font-size: 12px;
    font-weight: 600;
    background: var(--primary-bg);
    color: var(--primary);
    border-radius: var(--radius-full);
    flex-shrink: 0;
  }

  /* Drag targets - centralized in inbox */
  .drag-targets {
    padding: 12px 16px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-subtle);
    opacity: 0.5;
    transition: all var(--transition-normal);
    max-height: 48px;
    overflow: hidden;
  }

  .drag-targets.active,
  .drag-targets.expanded {
    opacity: 1;
    background: var(--hover-bg);
    max-height: 100px;
    padding: 14px 16px;
  }

  .drag-hint {
    font-size: 11px;
    color: var(--text-muted);
    margin-bottom: 8px;
    text-align: center;
    opacity: 0;
    transform: translateY(-4px);
    transition: all var(--transition-fast);
  }

  .drag-hint.visible {
    opacity: 1;
    transform: translateY(0);
  }

  .target-row {
    display: flex;
    gap: 8px;
    justify-content: center;
  }

  .drop-target {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 48px;
    border: 2px dashed var(--target-color);
    border-radius: var(--radius-md);
    background: transparent;
    cursor: pointer;
    transition: all var(--transition-fast);
    gap: 2px;
  }

  .drop-target.pulse {
    animation: targetPulse 1.5s ease-in-out infinite;
  }

  @keyframes targetPulse {
    0%, 100% {
      transform: scale(1);
      box-shadow: none;
    }
    50% {
      transform: scale(1.02);
      box-shadow: 0 0 8px var(--target-color);
    }
  }

  .drop-target:hover {
    background: var(--target-color);
    border-style: solid;
    transform: scale(1.05);
  }

  .drop-target:hover .target-letter,
  .drop-target:hover .target-time {
    color: white;
  }

  .target-letter {
    font-size: 14px;
    font-weight: 700;
    color: var(--target-color);
    transition: color var(--transition-fast);
  }

  .target-time {
    font-size: 9px;
    color: var(--text-muted);
    transition: color var(--transition-fast);
  }

  .tasks-container {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
  }

  .tasks-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 20px;
  }

  .task-wrapper {
    position: relative;
    transform-origin: center center;
  }

  .priority-actions {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    gap: 4px;
    opacity: 0;
    transform: translateY(-50%) translateX(4px);
    transition: all var(--transition-fast);
    pointer-events: none;
  }

  .task-wrapper:hover .priority-actions {
    opacity: 1;
    transform: translateY(-50%) translateX(0);
    pointer-events: auto;
  }

  .priority-btn {
    width: 24px;
    height: 24px;
    border: none;
    border-radius: var(--radius-sm);
    background: var(--btn-color);
    color: white;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition-fast);
    opacity: 0.85;
  }

  .priority-btn:hover {
    opacity: 1;
    transform: scale(1.1);
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    text-align: center;
  }

  .empty-icon {
    width: 48px;
    height: 48px;
    margin-bottom: 12px;
    color: var(--success);
    opacity: 0.7;
  }

  .empty-icon svg {
    width: 100%;
    height: 100%;
  }

  .empty-text {
    margin: 0 0 6px;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .empty-hint {
    margin: 0;
    font-size: 12px;
    color: var(--text-muted);
  }

  .completed-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 12px 16px;
    border: none;
    border-top: 1px solid var(--border-subtle);
    background: transparent;
    color: var(--text-muted);
    font-size: 12px;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .completed-toggle:hover {
    background: var(--hover-bg);
    color: var(--text-secondary);
  }

  .toggle-icon {
    width: 14px;
    height: 14px;
    transition: transform var(--transition-fast);
  }

  .toggle-icon.rotated {
    transform: rotate(90deg);
  }

  .completed-list {
    padding: 8px 12px 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
</style>
