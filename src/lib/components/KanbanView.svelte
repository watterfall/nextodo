<script lang="ts">
  import type { Task, Priority } from '$lib/types';
  import { PRIORITY_CONFIG } from '$lib/types';
  import TaskCard from './TaskCard.svelte';
  import { getTasksStore, changePriority, reorderTask } from '$lib/stores/tasks.svelte';
  import { getPomodoroStore } from '$lib/stores/pomodoro.svelte';
  import { setDropTarget, clearDragState, getUIStore } from '$lib/stores/ui.svelte';
  import { countActiveByPriority } from '$lib/utils/quota';
  import { getI18nStore } from '$lib/i18n';
  import { dndzone, TRIGGERS, SHADOW_ITEM_MARKER_PROPERTY_NAME } from 'svelte-dnd-action';
  import { flip } from 'svelte/animate';
  import { slide } from 'svelte/transition';
  import { dndConfig, areTaskArraysEqual, type DndConsiderEvent, type DndFinalizeEvent } from '$lib/utils/motion';
  import { onMount, tick } from 'svelte';

  const tasks = getTasksStore();
  const pomodoro = getPomodoroStore();
  const ui = getUIStore();
  const i18n = getI18nStore();
  const t = i18n.t;

  // Main priorities (A-D) shown as columns, E shown separately at top
  const mainPriorities: Priority[] = ['A', 'B', 'C', 'D'];
  const priorities: Priority[] = ['A', 'B', 'C', 'D', 'E'];
  const counts = $derived(countActiveByPriority(tasks.tasks));

  // Idea Pool expand state
  let isIdeaPoolExpanded = $state(true);

  // Focus mode check
  const isFocusMode = $derived(pomodoro.state === 'work' && pomodoro.activeTaskId !== null);

  // DnD state for each column
  let dndItemsByPriority = $state<Record<Priority, Task[]>>({
    A: [], B: [], C: [], D: [], E: []
  });
  let activeDndColumn = $state<Priority | null>(null);

  // Keyboard navigation state
  let focusedPriority = $state<Priority | null>(null);
  let focusedTaskIndex = $state<number>(-1);
  let focusedTaskId = $state<string | null>(null);

  function getTasksForPriority(priority: Priority) {
    return tasks.tasksByPriority[priority].filter(task => !task.completed);
  }

  function getCompletedForPriority(priority: Priority) {
    return tasks.tasksByPriority[priority].filter(task => task.completed);
  }

  function hasActiveTaskInColumn(priority: Priority) {
    return tasks.tasksByPriority[priority].some(task => task.id === pomodoro.activeTaskId);
  }

  // Sync dndItems with actual tasks for each priority (with shallow comparison)
  $effect(() => {
    if (!activeDndColumn) {
      const newItems = {
        A: getTasksForPriority('A'),
        B: getTasksForPriority('B'),
        C: getTasksForPriority('C'),
        D: getTasksForPriority('D'),
        E: getTasksForPriority('E')
      };
      // Only update if any priority's tasks changed
      let needsUpdate = false;
      for (const p of priorities) {
        if (!areTaskArraysEqual(dndItemsByPriority[p], newItems[p])) {
          needsUpdate = true;
          break;
        }
      }
      if (needsUpdate) {
        dndItemsByPriority = newItems;
      }
    }
  });

  // DnD handlers
  function handleDndConsider(priority: Priority) {
    return (e: DndConsiderEvent) => {
      const { items, info } = e.detail;
      dndItemsByPriority[priority] = items;

      if (info.trigger === TRIGGERS.DRAG_STARTED) {
        activeDndColumn = priority;
        setDropTarget(priority);
      }
    };
  }

  function handleDndFinalize(priority: Priority) {
    return (e: DndFinalizeEvent) => {
      const { items, info } = e.detail;

      // Filter out shadow placeholders
      const cleanItems = items.filter(item => !item[SHADOW_ITEM_MARKER_PROPERTY_NAME as keyof Task]);
      dndItemsByPriority[priority] = cleanItems;

      if (info.trigger === TRIGGERS.DROPPED_INTO_ZONE) {
        const droppedTask = cleanItems.find(task => task.id === info.id);
        if (droppedTask && droppedTask.priority !== priority) {
          // Item came from another column - change its priority
          changePriority(info.id, priority);
        } else {
          // Reorder within column
          const newOrder = cleanItems.map(task => task.id);
          reorderTask(priority, newOrder);
        }
      } else if (info.trigger === TRIGGERS.DROPPED_OUTSIDE_OF_ANY) {
        // Reset
        dndItemsByPriority[priority] = getTasksForPriority(priority);
      }

      activeDndColumn = null;
      clearDragState();
    };
  }

  // Legacy drag handlers for fallback
  function handleDragOver(e: DragEvent, priority: Priority) {
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'move';
    setDropTarget(priority);
  }

  function handleDragLeave() {
    clearDragState();
  }

  function handleDrop(e: DragEvent, priority: Priority) {
    e.preventDefault();
    const taskId = e.dataTransfer!.getData('text/plain');
    if (taskId) {
      changePriority(taskId, priority);
    }
    clearDragState();
  }

  // Keyboard Navigation
  function handleKeyDown(e: KeyboardEvent) {
    // Only handle if no modal is open and not editing
    if (ui.editingTaskId || document.querySelector('.modal-overlay')) return;

    // Start navigation with arrow keys if nothing focused
    if (!focusedPriority && (e.key === 'ArrowDown' || e.key === 'ArrowRight')) {
      e.preventDefault();
      focusedPriority = 'A';
      focusedTaskIndex = 0;
      updateFocus();
      return;
    }

    if (!focusedPriority) return;

    const currentTasks = dndItemsByPriority[focusedPriority];
    const priorityIndex = priorities.indexOf(focusedPriority);

    switch (e.key) {
      case 'ArrowDown':
      case 'j':
        e.preventDefault();
        if (focusedTaskIndex < currentTasks.length - 1) {
          focusedTaskIndex++;
        } else {
          // Wrap to top? Or maybe stop
          // focusedTaskIndex = 0; 
        }
        updateFocus();
        break;
      
      case 'ArrowUp':
      case 'k':
        e.preventDefault();
        if (focusedTaskIndex > 0) {
          focusedTaskIndex--;
        }
        updateFocus();
        break;

      case 'ArrowRight':
      case 'l':
        e.preventDefault();
        if (priorityIndex < priorities.length - 1) {
          focusedPriority = priorities[priorityIndex + 1];
          // Try to maintain relative position or reset to 0
          const newTasks = dndItemsByPriority[focusedPriority];
          focusedTaskIndex = Math.min(focusedTaskIndex, Math.max(0, newTasks.length - 1));
          if (newTasks.length === 0) focusedTaskIndex = -1; // Header focus?
          updateFocus();
        }
        break;

      case 'ArrowLeft':
      case 'h':
        e.preventDefault();
        if (priorityIndex > 0) {
          focusedPriority = priorities[priorityIndex - 1];
          const newTasks = dndItemsByPriority[focusedPriority];
          focusedTaskIndex = Math.min(focusedTaskIndex, Math.max(0, newTasks.length - 1));
          if (newTasks.length === 0) focusedTaskIndex = -1;
          updateFocus();
        }
        break;
        
      case 'Enter':
        e.preventDefault();
        if (focusedPriority && focusedTaskIndex >= 0) {
          const task = dndItemsByPriority[focusedPriority][focusedTaskIndex];
          if (task) {
            // Edit task
            // Dispatch a custom event or call a method on the TaskCard component?
            // For now, simpler to just start editing
            // setEditingTask(task.id); 
            // Better: Start Pomodoro if not active, or edit if modifier key held?
            // Let's match standard behavior: Enter -> Toggle Detail/Edit
          }
        }
        break;

      case 'Escape':
        focusedPriority = null;
        focusedTaskIndex = -1;
        focusedTaskId = null;
        // Blur any active element
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        break;
    }
  }

  function updateFocus() {
    if (focusedPriority && focusedTaskIndex >= 0) {
      const task = dndItemsByPriority[focusedPriority][focusedTaskIndex];
      if (task) {
        focusedTaskId = task.id;
        // Scroll into view if needed
        tick().then(() => {
          const el = document.getElementById(`task-${task.id}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            el.focus();
          }
        });
      }
    } else {
      focusedTaskId = null;
    }
  }

  // Reset focus when clicking outside
  function handleContainerClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      focusedPriority = null;
      focusedTaskIndex = -1;
      focusedTaskId = null;
    }
  }
</script>

<svelte:window onkeydown={handleKeyDown} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="kanban-container" onclick={handleContainerClick}>
  <!-- Idea Pool (E zone) at top as horizontal strip -->
  {@const ideaPoolTasks = dndItemsByPriority['E']}
  {@const ideaPoolDropTarget = ui.dropTargetPriority === 'E' || activeDndColumn === 'E'}
  {@const ideaPoolDimmed = isFocusMode && !hasActiveTaskInColumn('E')}

  <div
    class="idea-pool-strip"
    class:expanded={isIdeaPoolExpanded}
    class:drop-target={ideaPoolDropTarget}
    class:focus-dimmed={ideaPoolDimmed}
    ondragover={(e) => handleDragOver(e, 'E')}
    ondragleave={handleDragLeave}
    ondrop={(e) => handleDrop(e, 'E')}
  >
    <button class="pool-header" onclick={() => isIdeaPoolExpanded = !isIdeaPoolExpanded}>
      <span class="pool-badge" style:background={PRIORITY_CONFIG.E.color}>💡</span>
      <span class="pool-title">{t('inbox.title')}</span>
      <span class="pool-count">{ideaPoolTasks.length}</span>
      <svg class="expand-icon" class:rotated={isIdeaPoolExpanded} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    </button>

    {#if isIdeaPoolExpanded}
      <div
        class="pool-tasks"
        transition:slide={{ duration: 200 }}
        use:dndzone={{
          items: ideaPoolTasks,
          flipDurationMs: dndConfig.flipDurationMs,
          dropTargetStyle: {},
          dropTargetClasses: ['dnd-drop-target-active'],
          dragDisabled: ideaPoolDimmed
        }}
        onconsider={handleDndConsider('E')}
        onfinalize={handleDndFinalize('E')}
      >
        {#if ideaPoolTasks.length > 0}
          {#each ideaPoolTasks as task (task.id)}
            <div animate:flip={{ duration: dndConfig.flipDurationMs }} class="pool-task-item">
              <TaskCard {task} compact />
            </div>
          {/each}
        {:else}
          <div class="pool-empty">{t('inbox.empty')}</div>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Main priority columns (A-D) -->
  <div class="kanban-columns">
    {#each mainPriorities as priority}
      {@const config = PRIORITY_CONFIG[priority]}
      {@const activeTasks = dndItemsByPriority[priority]}
      {@const completedTasks = getCompletedForPriority(priority)}
      {@const isDropTarget = ui.dropTargetPriority === priority || activeDndColumn === priority}
      {@const isFull = counts[priority] >= config.quota}
      {@const isDimmed = isFocusMode && !hasActiveTaskInColumn(priority)}

      <div
        class="kanban-column"
        class:drop-target={isDropTarget}
        class:is-full={isFull}
        class:focus-dimmed={isDimmed}
        style:--column-color={config.color}
        ondragover={(e) => handleDragOver(e, priority)}
        ondragleave={handleDragLeave}
        ondrop={(e) => handleDrop(e, priority)}
        role="region"
        aria-label={t(`priority.${priority}`)}
      >
        <div class="column-header" title={config.description}>
          <span class="column-letter" style:background={config.color}>{priority}</span>
          <span class="column-name">{t(`priority.${priority}`)}</span>
          <span class="column-count">{counts[priority]}/{config.quota}</span>
        </div>

        <div
          class="column-tasks"
          use:dndzone={{
            items: activeTasks,
            flipDurationMs: dndConfig.flipDurationMs,
            dropTargetStyle: {},
            dropTargetClasses: ['dnd-drop-target-active'],
            dragDisabled: isDimmed
          }}
          onconsider={handleDndConsider(priority)}
          onfinalize={handleDndFinalize(priority)}
        >
          {#if activeTasks.length > 0}
            {#each activeTasks as task, index (task.id)}
              <div
                animate:flip={{ duration: dndConfig.flipDurationMs }}
                class="task-item-wrapper"
                id={`task-${task.id}`}
                tabindex={focusedTaskId === task.id ? 0 : -1}
              >
                <TaskCard
                  {task}
                  compact={priority === 'D'}
                  isFocused={focusedTaskId === task.id}
                />
              </div>
            {/each}
          {:else}
            <div class="empty-column" class:very-subtle={!isDropTarget}>
              <span class="empty-text">{t('zone.dropHere')}</span>
            </div>
          {/if}
        </div>

        {#if completedTasks.length > 0}
          <div class="completed-section">
            <span class="completed-label">{t('filter.completed')} ({completedTasks.length})</span>
            {#each completedTasks.slice(0, 3) as task (task.id)}
              <TaskCard {task} compact={true} />
            {/each}
            {#if completedTasks.length > 3}
              <span class="more-count">+{completedTasks.length - 3} more</span>
            {/if}
          </div>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .kanban-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    gap: 16px;
    overflow: hidden;
    outline: none;
  }

  /* Idea Pool Strip at top */
  .idea-pool-strip {
    flex-shrink: 0;
    background: var(--card-bg);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    transition: all var(--transition-normal);
    opacity: 0.7;
  }

  .idea-pool-strip:hover,
  .idea-pool-strip.expanded {
    opacity: 1;
  }

  .idea-pool-strip.drop-target {
    border-color: var(--primary);
    box-shadow: 0 0 0 2px var(--primary);
    opacity: 1;
  }

  .idea-pool-strip.focus-dimmed {
    opacity: 0.3;
    filter: grayscale(0.4) blur(0.5px);
    pointer-events: none;
  }

  .pool-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    width: 100%;
    border: none;
    background: transparent;
    cursor: pointer;
    transition: background 0.15s;
    color: var(--text-primary);
  }

  .pool-header:hover {
    background: var(--hover-bg);
  }

  .pool-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 6px;
    font-size: 13px;
    flex-shrink: 0;
  }

  .pool-title {
    font-size: 14px;
    font-weight: 600;
    flex: 1;
    text-align: left;
  }

  .pool-count {
    padding: 3px 10px;
    font-size: 12px;
    font-weight: 600;
    background: var(--primary-bg);
    color: var(--primary);
    border-radius: var(--radius-full);
  }

  .expand-icon {
    width: 16px;
    height: 16px;
    color: var(--text-muted);
    transition: transform 0.2s;
  }

  .expand-icon.rotated {
    transform: rotate(180deg);
  }

  .pool-tasks {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 0 16px 14px;
    max-height: 180px;
    overflow-y: auto;
  }

  .pool-task-item {
    opacity: 0.7;
    transition: opacity 0.15s;
    flex: 1;
    min-width: 200px;
    max-width: 300px;
  }

  .pool-task-item:hover {
    opacity: 1;
  }

  .pool-empty {
    color: var(--text-muted);
    font-size: 13px;
    font-style: italic;
    padding: 8px 0;
    width: 100%;
    text-align: center;
  }

  /* Main kanban columns area */
  .kanban-columns {
    display: flex;
    gap: 12px;
    flex: 1;
    overflow-x: auto;
    padding-bottom: 8px;
  }

  .kanban-column {
    flex: 1;
    min-width: 200px;
    max-width: 280px;
    display: flex;
    flex-direction: column;
    background: var(--card-bg);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    transition: all var(--transition-normal);
    /* Glassmorphism */
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }

  .kanban-column.drop-target {
    border-color: var(--column-color);
    box-shadow: 0 0 0 2px var(--column-color);
    transform: scale(1.01);
  }

  .kanban-column.is-full {
    opacity: 0.7;
  }

  .kanban-column.focus-dimmed {
    opacity: 0.3;
    filter: grayscale(0.4) blur(0.5px);
    pointer-events: none;
    transition: all 0.4s ease;
  }

  .column-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 14px;
    border-bottom: 1px solid var(--border-subtle);
    cursor: help;
  }

  .column-letter {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 700;
    color: white;
  }

  .column-name {
    flex: 1;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .column-count {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-muted);
  }

  .column-tasks {
    flex: 1;
    overflow-y: auto;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 60px;
  }

  .task-item-wrapper {
    transform-origin: center center;
    outline: none;
  }
  
  .task-item-wrapper:focus {
    outline: none;
  }

  .empty-column {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    border: 1px dashed var(--border-color);
    border-radius: var(--radius-md);
    min-height: 80px;
    transition: all var(--transition-normal);
  }

  .empty-column.very-subtle {
    opacity: 0.2;
    border-color: transparent;
  }

  .kanban-column:hover .empty-column.very-subtle {
    opacity: 0.5;
    border-color: var(--border-color);
  }

  .empty-text {
    font-size: 12px;
    color: var(--text-muted);
    font-style: italic;
  }

  .completed-section {
    padding: 10px;
    border-top: 1px solid var(--border-subtle);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .completed-label {
    font-size: 10px;
    font-weight: 500;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 4px;
  }

  .more-count {
    font-size: 11px;
    color: var(--text-muted);
    text-align: center;
    padding: 4px;
  }
</style>
