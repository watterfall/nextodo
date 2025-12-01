<script lang="ts">
  import { getTasksStore } from '$lib/stores/tasks.svelte';
  import TaskCard from './TaskCard.svelte';
  import { getI18nStore } from '$lib/i18n';
  import { slide } from 'svelte/transition';
  import { PRIORITY_CONFIG, type Priority } from '$lib/types';

  const tasks = getTasksStore();
  const i18n = getI18nStore();
  const t = i18n.t;

  // Main priorities (A-D), E is handled separately as Idea Pool
  const mainPriorities: Priority[] = ['A', 'B', 'C', 'D'];

  // Group tasks by priority
  const groupedTasks = $derived({
    A: tasks.tasksByPriority['A'].filter(task => !task.completed),
    B: tasks.tasksByPriority['B'].filter(task => !task.completed),
    C: tasks.tasksByPriority['C'].filter(task => !task.completed),
    D: tasks.tasksByPriority['D'].filter(task => !task.completed),
    E: tasks.tasksByPriority['E'].filter(task => !task.completed)
  });

  const completedTasks = $derived(tasks.tasks.filter(task => task.completed));
  let showCompleted = $state(false);
  let showIdeaPool = $state(true);
</script>

<div class="list-view-container">
  <!-- Main tasks area with horizontal grid for A/B/C/D -->
  <div class="list-main">
    <div class="tasks-grid">
      {#each mainPriorities as priority}
        {@const priorityTasks = groupedTasks[priority]}
        <section class="task-section" style:--section-color={PRIORITY_CONFIG[priority].color}>
          <div class="section-header">
            <div class="header-left">
              <span class="priority-badge">{priority}</span>
              <h3 class="section-title">{t(`priority.${priority}`)}</h3>
            </div>
            <span class="count-badge">{priorityTasks.length}</span>
          </div>

          <div class="task-list">
            {#each priorityTasks as task (task.id)}
              <div animate:slide={{ duration: 200 }}>
                <TaskCard {task} />
              </div>
            {/each}
            {#if priorityTasks.length === 0}
               <div class="empty-section-hint">{t('zone.empty')}</div>
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
  <aside class="idea-pool-panel" class:collapsed={!showIdeaPool}>
    <div class="pool-header" onclick={() => showIdeaPool = !showIdeaPool}>
      <div class="header-left">
        <span class="pool-badge" style:background={PRIORITY_CONFIG.E.color}>💡</span>
        <h3 class="pool-title">{t('inbox.title')}</h3>
      </div>
      <span class="pool-count">{groupedTasks.E.length}</span>
      <svg class="expand-icon" class:rotated={showIdeaPool} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="15 18 9 12 15 6"></polyline>
      </svg>
    </div>

    {#if showIdeaPool}
      <div class="pool-tasks" transition:slide>
        {#each groupedTasks.E as task (task.id)}
          <div class="pool-task-item">
            <TaskCard {task} compact />
          </div>
        {/each}
        {#if groupedTasks.E.length === 0}
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
    overflow-y: auto;
    padding-right: 4px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  /* Single column layout for A/B/C/D sections - each row full width */
  .tasks-grid {
    display: flex;
    flex-direction: column;
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
    min-height: 80px;
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
    width: 24px;
    height: 24px;
    border-radius: 6px;
    background: var(--section-color);
    color: white;
    font-size: 13px;
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
    padding: 2px 8px;
    border-radius: 10px;
  }

  .task-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1;
  }

  .empty-section-hint {
    font-size: 13px;
    color: var(--text-muted);
    font-style: italic;
    padding: 12px 0;
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

  /* Idea Pool (E-zone) panel on right side - vertical strip filling height */
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
    align-self: stretch;
  }

  .idea-pool-panel.collapsed {
    width: 52px;
  }

  .idea-pool-panel.collapsed .pool-title,
  .idea-pool-panel.collapsed .pool-count {
    display: none;
  }

  .pool-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    border-bottom: 1px solid var(--border-subtle);
    cursor: pointer;
    transition: background 0.15s;
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
  }

  .pool-task-item {
    opacity: 0.7;
    transition: opacity 0.15s;
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
  @media (max-width: 900px) {
    .list-view-container {
      flex-direction: column;
    }

    .idea-pool-panel {
      width: 100%;
      max-height: 200px;
    }

    .idea-pool-panel.collapsed {
      width: 100%;
    }
  }
</style>

