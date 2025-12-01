<script lang="ts">
  import { getTasksStore, changePriority, reorderTask } from '$lib/stores/tasks.svelte';
  import TaskCard from './TaskCard.svelte';
  import { getI18nStore } from '$lib/i18n';
  import { slide } from 'svelte/transition';
  import { flip } from 'svelte/animate';
  import { PRIORITY_CONFIG, type Priority, type Task } from '$lib/types';
  import { dndzone, TRIGGERS, SHADOW_ITEM_MARKER_PROPERTY_NAME } from 'svelte-dnd-action';
  import { dndConfig, areTaskArraysEqual, type DndConsiderEvent, type DndFinalizeEvent } from '$lib/utils/motion';
  import { setDropTarget, clearDragState, getUIStore } from '$lib/stores/ui.svelte';

  const tasks = getTasksStore();
  const ui = getUIStore();
  const i18n = getI18nStore();
  const t = i18n.t;

  // Shared DnD type for cross-zone dragging
  const DND_TYPE = 'task-priority-zone';

  // Main priorities (A-D), E is handled separately as Idea Pool
  const mainPriorities: Priority[] = ['A', 'B', 'C', 'D'];
  const allPriorities: Priority[] = ['A', 'B', 'C', 'D', 'E'];

  // DnD state for each priority
  let dndItemsByPriority = $state<Record<Priority, Task[]>>({
    A: [], B: [], C: [], D: [], E: []
  });
  let activeDndPriority = $state<Priority | null>(null);

  function getTasksForPriority(priority: Priority) {
    return tasks.tasksByPriority[priority].filter(task => !task.completed);
  }

  // Sync dndItems with actual tasks
  $effect(() => {
    if (!activeDndPriority) {
      const newItems = {
        A: getTasksForPriority('A'),
        B: getTasksForPriority('B'),
        C: getTasksForPriority('C'),
        D: getTasksForPriority('D'),
        E: getTasksForPriority('E')
      };
      let needsUpdate = false;
      for (const p of allPriorities) {
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
        activeDndPriority = priority;
        setDropTarget(priority);
      }
    };
  }

  function handleDndFinalize(priority: Priority) {
    return (e: DndFinalizeEvent) => {
      const { items, info } = e.detail;
      const cleanItems = items.filter(item => !item[SHADOW_ITEM_MARKER_PROPERTY_NAME as keyof Task]);
      dndItemsByPriority[priority] = cleanItems;

      if (info.trigger === TRIGGERS.DROPPED_INTO_ZONE) {
        const droppedTask = cleanItems.find(task => task.id === info.id);
        if (droppedTask && droppedTask.priority !== priority) {
          changePriority(info.id, priority);
        } else {
          const newOrder = cleanItems.map(task => task.id);
          reorderTask(priority, newOrder);
        }
      } else if (info.trigger === TRIGGERS.DROPPED_OUTSIDE_OF_ANY) {
        dndItemsByPriority[priority] = getTasksForPriority(priority);
      }

      activeDndPriority = null;
      clearDragState();
    };
  }

  const completedTasks = $derived(tasks.tasks.filter(task => task.completed));
  let showCompleted = $state(false);
  let showIdeaPool = $state(true);
</script>

<div class="list-view-container">
  <!-- Main tasks area - A/B/C/D as horizontal rows -->
  <div class="list-main" class:expanded={!showIdeaPool}>
    {#each mainPriorities as priority}
      {@const priorityTasks = dndItemsByPriority[priority]}
      {@const isDropTarget = ui.dropTargetPriority === priority || activeDndPriority === priority}
      <section
        class="task-row"
        class:drop-target={isDropTarget}
        style:--section-color={PRIORITY_CONFIG[priority].color}
      >
        <div class="row-header">
          <span class="priority-badge">{priority}</span>
          <h3 class="row-title">{t(`priority.${priority}`)}</h3>
          <span class="count-badge">{priorityTasks.length}</span>
        </div>

        <div
          class="task-list-horizontal"
          use:dndzone={{
            items: priorityTasks,
            flipDurationMs: dndConfig.flipDurationMs,
            dropTargetStyle: {},
            dropTargetClasses: ['dnd-drop-target-active'],
            type: DND_TYPE
          }}
          onconsider={handleDndConsider(priority)}
          onfinalize={handleDndFinalize(priority)}
        >
          {#each priorityTasks as task (task.id)}
            <div animate:flip={{ duration: dndConfig.flipDurationMs }} class="task-item-horizontal">
              <TaskCard {task} compact />
            </div>
          {/each}
          {#if priorityTasks.length === 0}
            <div class="empty-row-hint">{t('zone.dropHere')}</div>
          {/if}
        </div>
      </section>
    {/each}

    <!-- Completed Section -->
    {#if completedTasks.length > 0}
      <section class="task-row completed-row">
        <button class="completed-toggle" onclick={() => showCompleted = !showCompleted}>
          <span class="toggle-icon" class:rotated={showCompleted}>▶</span>
          <h3 class="row-title">{t('filter.completed')}</h3>
          <span class="count-badge">{completedTasks.length}</span>
        </button>

        {#if showCompleted}
          <div class="task-list-horizontal completed-list" transition:slide>
            {#each completedTasks as task (task.id)}
              <div class="task-item-horizontal">
                <TaskCard {task} compact showPriority />
              </div>
            {/each}
          </div>
        {/if}
      </section>
    {/if}
  </div>

  <!-- Idea Pool (E-zone) - fixed on right side, toggleable -->
  <aside class="idea-pool-panel" class:collapsed={!showIdeaPool} class:drop-target={ui.dropTargetPriority === 'E' || activeDndPriority === 'E'}>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="pool-header" onclick={() => showIdeaPool = !showIdeaPool}>
      <span class="pool-badge" style:background={PRIORITY_CONFIG.E.color}>💡</span>
      {#if showIdeaPool}
        <h3 class="pool-title">{t('inbox.title')}</h3>
        <span class="pool-count">{dndItemsByPriority['E'].length}</span>
      {/if}
      <svg class="toggle-icon" class:rotated={!showIdeaPool} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="9 18 15 12 9 6"></polyline>
      </svg>
    </div>

    {#if showIdeaPool}
      <div
        class="pool-tasks"
        transition:slide
        use:dndzone={{
          items: dndItemsByPriority['E'],
          flipDurationMs: dndConfig.flipDurationMs,
          dropTargetStyle: {},
          dropTargetClasses: ['dnd-drop-target-active'],
          type: DND_TYPE
        }}
        onconsider={handleDndConsider('E')}
        onfinalize={handleDndFinalize('E')}
      >
        {#each dndItemsByPriority['E'] as task (task.id)}
          <div animate:flip={{ duration: dndConfig.flipDurationMs }} class="pool-task-item">
            <TaskCard {task} compact />
          </div>
        {/each}
        {#if dndItemsByPriority['E'].length === 0}
          <div class="pool-empty">{t('inbox.empty')}</div>
        {/if}
      </div>
    {/if}
  </aside>
</div>

<style>
  .list-view-container {
    display: flex;
    height: 100%;
    overflow: hidden;
    gap: 12px;
  }

  /* Main area - fills remaining space, rows stack vertically */
  .list-main {
    flex: 1;
    min-width: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
    transition: all 0.3s ease;
  }

  .list-main.expanded {
    /* When idea pool is hidden, main area expands */
  }

  /* Task Row (A/B/C/D) - horizontal rows */
  .task-row {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    background: var(--card-bg);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    overflow: hidden;
    transition: all var(--transition-normal);
  }

  .task-row.drop-target {
    border-color: var(--section-color);
    box-shadow: 0 0 0 2px var(--section-color);
  }

  .row-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--border-subtle);
    flex-shrink: 0;
  }

  .priority-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 6px;
    background: var(--section-color);
    color: white;
    font-size: 13px;
    font-weight: 700;
    flex-shrink: 0;
  }

  .row-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
    flex: 1;
  }

  .count-badge {
    font-size: 11px;
    color: var(--text-muted);
    font-weight: 500;
    background: var(--bg-secondary);
    padding: 2px 8px;
    border-radius: var(--radius-full);
    flex-shrink: 0;
  }

  /* Horizontal task list within each row - uses grid to fill available width */
  .task-list-horizontal {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 10px;
    padding: 10px;
    min-height: 80px;
    align-items: start;
  }

  .task-item-horizontal {
    transform-origin: center center;
    min-width: 0;
  }

  .empty-row-hint {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    color: var(--text-muted);
    font-style: italic;
    padding: 16px 24px;
    opacity: 0.6;
    grid-column: 1 / -1;
  }

  /* Completed section */
  .completed-row {
    opacity: 0.8;
  }

  .completed-toggle {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    border: none;
    border-bottom: 1px solid var(--border-subtle);
    background: transparent;
    width: 100%;
    cursor: pointer;
    color: var(--text-secondary);
  }

  .toggle-icon {
    font-size: 10px;
    transition: transform 0.2s;
    display: inline-block;
    flex-shrink: 0;
  }

  .toggle-icon.rotated {
    transform: rotate(90deg);
  }

  .completed-list {
    /* Inherits grid from .task-list-horizontal */
  }

  /* Idea Pool (E-zone) - fixed on right, toggleable */
  .idea-pool-panel {
    width: 260px;
    flex-shrink: 0;
    background: var(--card-bg);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    transition: all 0.3s ease;
    height: 100%;
  }

  .idea-pool-panel.collapsed {
    width: 52px;
  }

  .idea-pool-panel.drop-target {
    border-color: var(--primary);
    box-shadow: 0 0 0 2px var(--primary);
  }

  .pool-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    border-bottom: 1px solid var(--border-subtle);
    cursor: pointer;
    transition: background 0.15s;
    flex-shrink: 0;
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
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
    flex: 1;
  }

  .pool-count {
    padding: 3px 10px;
    font-size: 12px;
    font-weight: 600;
    background: var(--primary-bg);
    color: var(--primary);
    border-radius: var(--radius-full);
  }

  .toggle-icon {
    width: 16px;
    height: 16px;
    color: var(--text-muted);
    transition: transform 0.2s;
    flex-shrink: 0;
  }

  .toggle-icon.rotated {
    transform: rotate(180deg);
  }

  .pool-tasks {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 60px;
  }

  .pool-task-item {
    opacity: 0.85;
    transition: opacity 0.15s;
    transform-origin: center center;
  }

  .pool-task-item:hover {
    opacity: 1;
  }

  .pool-empty {
    text-align: center;
    padding: 20px;
    color: var(--text-muted);
    font-size: 13px;
    font-style: italic;
  }

  /* Responsive */
  @media (max-width: 1200px) {
    .idea-pool-panel {
      width: 220px;
    }
    .task-list-horizontal {
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    }
  }

  @media (max-width: 900px) {
    .list-view-container {
      flex-direction: column;
    }

    .list-main {
      flex: 1;
      min-height: 0;
    }

    .task-list-horizontal {
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    }

    .idea-pool-panel {
      width: 100%;
      flex-shrink: 0;
      max-height: 200px;
    }

    .idea-pool-panel.collapsed {
      width: 100%;
      max-height: 52px;
    }
  }
</style>

