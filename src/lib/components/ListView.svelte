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
  <!-- Main tasks area with responsive grid for A/B/C/D -->
  <div class="list-main">
    <div class="tasks-grid">
      {#each mainPriorities as priority}
        {@const priorityTasks = dndItemsByPriority[priority]}
        {@const isDropTarget = ui.dropTargetPriority === priority || activeDndPriority === priority}
        <section
          class="task-section"
          class:drop-target={isDropTarget}
          style:--section-color={PRIORITY_CONFIG[priority].color}
        >
          <div class="section-header">
            <div class="header-left">
              <span class="priority-badge">{priority}</span>
              <h3 class="section-title">{t(`priority.${priority}`)}</h3>
            </div>
            <span class="count-badge">{priorityTasks.length}</span>
          </div>

          <div
            class="task-list"
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
              <div animate:flip={{ duration: dndConfig.flipDurationMs }} class="task-item">
                <TaskCard {task} />
              </div>
            {/each}
            {#if priorityTasks.length === 0}
               <div class="empty-section-hint">{t('zone.dropHere')}</div>
            {/if}
          </div>
        </section>
      {/each}
    </div>

    <!-- Completed Section -->
    {#if completedTasks.length > 0}
      <section class="task-section completed-section">
        <button class="completed-toggle" onclick={() => showCompleted = !showCompleted}>
          <div class="header-left">
            <span class="toggle-icon" class:rotated={showCompleted}>▶</span>
            <h3 class="section-title">{t('filter.completed')}</h3>
          </div>
          <span class="count-badge">{completedTasks.length}</span>
        </button>

        {#if showCompleted}
          <div class="task-list" transition:slide>
            {#each completedTasks as task (task.id)}
              <TaskCard {task} compact showPriority />
            {/each}
          </div>
        {/if}
      </section>
    {/if}
  </div>

  <!-- Idea Pool (E-zone) on the right side -->
  <aside class="idea-pool-panel" class:collapsed={!showIdeaPool} class:drop-target={ui.dropTargetPriority === 'E' || activeDndPriority === 'E'}>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="pool-header" onclick={() => showIdeaPool = !showIdeaPool}>
      <div class="header-left">
        <span class="pool-badge" style:background={PRIORITY_CONFIG.E.color}>💡</span>
        <h3 class="pool-title">{t('inbox.title')}</h3>
      </div>
      <span class="pool-count">{dndItemsByPriority['E'].length}</span>
      <svg class="expand-icon" class:rotated={showIdeaPool} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="15 18 9 12 15 6"></polyline>
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
    gap: 16px;
  }

  .list-main {
    flex: 1;
    min-width: 0;
    overflow-y: auto;
    padding-right: 4px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  /* Responsive grid for A/B/C/D sections */
  .tasks-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 16px;
    padding-bottom: 20px;
  }

  .task-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
    background: var(--card-bg);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    padding: 14px;
    min-height: 120px;
    transition: all var(--transition-normal);
  }

  .task-section.drop-target {
    border-color: var(--section-color);
    box-shadow: 0 0 0 2px var(--section-color);
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--border-subtle);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .priority-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 6px;
    background: var(--section-color);
    color: white;
    font-size: 14px;
    font-weight: 700;
  }

  .section-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }

  .count-badge {
    font-size: 12px;
    color: var(--text-muted);
    font-weight: 500;
    background: var(--bg-secondary);
    padding: 3px 10px;
    border-radius: var(--radius-full);
  }

  .task-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1;
    min-height: 40px;
  }

  .task-item {
    transform-origin: center center;
  }

  .empty-section-hint {
    font-size: 13px;
    color: var(--text-muted);
    font-style: italic;
    padding: 16px 0;
    opacity: 0.6;
    text-align: center;
  }

  .completed-section {
    opacity: 0.8;
    background: var(--card-bg);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    padding: 14px;
  }

  .completed-toggle {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 8px;
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
  }

  .toggle-icon.rotated {
    transform: rotate(90deg);
  }

  /* Idea Pool (E-zone) panel on right side */
  .idea-pool-panel {
    width: 280px;
    flex-shrink: 0;
    background: var(--card-bg);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    transition: all var(--transition-normal);
    height: 100%;
    align-self: stretch;
  }

  .idea-pool-panel.collapsed {
    width: 52px;
  }

  .idea-pool-panel.collapsed .pool-title,
  .idea-pool-panel.collapsed .pool-count {
    display: none;
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

  .expand-icon {
    width: 16px;
    height: 16px;
    color: var(--text-muted);
    transition: transform 0.2s;
    flex-shrink: 0;
  }

  .expand-icon.rotated {
    transform: rotate(-90deg);
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
      width: 240px;
    }
  }

  @media (max-width: 900px) {
    .list-view-container {
      flex-direction: column;
    }

    .list-main {
      flex: none;
      overflow: visible;
    }

    .tasks-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .idea-pool-panel {
      width: 100%;
      max-height: 250px;
    }

    .idea-pool-panel.collapsed {
      width: 100%;
    }
  }

  @media (max-width: 600px) {
    .tasks-grid {
      grid-template-columns: 1fr;
    }
  }
</style>

