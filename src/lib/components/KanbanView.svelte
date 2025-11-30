<script lang="ts">
  import type { Task, Priority } from '$lib/types';
  import { PRIORITY_CONFIG } from '$lib/types';
  import TaskCard from './TaskCard.svelte';
  import { getTasksStore, changePriority } from '$lib/stores/tasks.svelte';
  import { getPomodoroStore } from '$lib/stores/pomodoro.svelte';
  import { setDropTarget, clearDragState, getUIStore } from '$lib/stores/ui.svelte';
  import { countActiveByPriority } from '$lib/utils/quota';
  import { t } from '$lib/i18n';

  const tasks = getTasksStore();
  const pomodoro = getPomodoroStore();
  const ui = getUIStore();

  const priorities: Priority[] = ['A', 'B', 'C', 'D', 'E'];
  const counts = $derived(countActiveByPriority(tasks.tasks));

  // Focus mode check
  const isFocusMode = $derived(pomodoro.state === 'work' && pomodoro.activeTaskId !== null);

  function getTasksForPriority(priority: Priority) {
    return tasks.tasksByPriority[priority].filter(t => !t.completed);
  }

  function getCompletedForPriority(priority: Priority) {
    return tasks.tasksByPriority[priority].filter(t => t.completed);
  }

  function hasActiveTaskInColumn(priority: Priority) {
    return tasks.tasksByPriority[priority].some(t => t.id === pomodoro.activeTaskId);
  }

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
</script>

<div class="kanban-view">
  {#each priorities as priority}
    {@const config = PRIORITY_CONFIG[priority]}
    {@const activeTasks = getTasksForPriority(priority)}
    {@const completedTasks = getCompletedForPriority(priority)}
    {@const isDropTarget = ui.dropTargetPriority === priority}
    {@const isFull = priority !== 'E' && counts[priority] >= config.quota}
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
    >
      <div class="column-header" title={config.description}>
        <span class="column-letter" style:background={config.color}>{priority}</span>
        <span class="column-count">{counts[priority]}/{config.quota === Infinity ? '∞' : config.quota}</span>
      </div>

      <div class="column-tasks">
        {#if activeTasks.length > 0}
          {#each activeTasks as task (task.id)}
            <TaskCard {task} compact={priority === 'D' || priority === 'E'} />
          {/each}
        {:else}
          <div class="empty-column">
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

<style>
  .kanban-view {
    display: flex;
    gap: 12px;
    height: 100%;
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
  }

  .kanban-column.drop-target {
    border-color: var(--column-color);
    box-shadow: 0 0 0 2px var(--column-color);
  }

  .kanban-column.is-full {
    opacity: 0.7;
  }

  .kanban-column.focus-dimmed {
    opacity: 0.35;
    filter: grayscale(0.3);
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
  }

  .empty-column {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    border: 1px dashed var(--border-color);
    border-radius: var(--radius-md);
    min-height: 80px;
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
