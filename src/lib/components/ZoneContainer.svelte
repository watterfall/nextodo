<script lang="ts">
  import type { Task, Priority } from '$lib/types';
  import { PRIORITY_CONFIG } from '$lib/types';
  import TaskCard from './TaskCard.svelte';
  import { getUIStore, setDropTarget, clearDragState } from '$lib/stores/ui.svelte';
  import { changePriority, getTasksStore } from '$lib/stores/tasks.svelte';
  import { getPomodoroStore } from '$lib/stores/pomodoro.svelte';
  import { countActiveByPriority } from '$lib/utils/quota';
  import { t } from '$lib/i18n';

  interface Props {
    priority: Priority;
    tasks: Task[];
  }

  let { priority, tasks }: Props = $props();

  const pomodoro = getPomodoroStore();

  const config = PRIORITY_CONFIG[priority];
  const ui = getUIStore();
  const tasksStore = getTasksStore();

  let isDropTarget = $derived(ui.dropTargetPriority === priority);

  const counts = $derived(countActiveByPriority(tasksStore.tasks));
  const remaining = $derived(config.quota === Infinity ? Infinity : config.quota - counts[priority]);
  const isFull = $derived(priority !== 'E' && remaining <= 0);

  // Check if pomodoro is actively running on a task
  const isFocusMode = $derived(pomodoro.state === 'work' && pomodoro.activeTaskId !== null);
  const hasActiveTask = $derived(tasks.some(t => t.id === pomodoro.activeTaskId));

  // Filter out completed tasks for display
  let activeTasks = $derived(tasks.filter(t => !t.completed));
  let completedTasks = $derived(tasks.filter(t => t.completed));

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
  class:drop-target={isDropTarget}
  class:is-priority-a={priority === 'A'}
  class:is-full={isFull}
  class:focus-dimmed={isFocusMode && !hasActiveTask}
  style:--zone-color={config.color}
  style:--zone-bg={config.bgColor}
  style:--zone-border={config.borderColor}
  style:--zone-columns={priority === 'B' ? 2 : priority === 'C' ? 3 : priority === 'D' ? 5 : 1}
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
  role="region"
  aria-label="{config.name}"
>
  <div class="zone-header" title={config.description}>
    <div class="zone-title">
      <span class="zone-letter" style:background={config.color}>{priority}</span>
      <span class="zone-quota-inline">{counts[priority]}/{config.quota}</span>
    </div>

    {#if priority === 'A' && activeTasks.length > 0}
      <span class="breathing-light"></span>
    {/if}
  </div>

  <div class="zone-tasks">
    {#if activeTasks.length > 0}
      {#each activeTasks as task (task.id)}
        <TaskCard {task} compact={priority === 'D'} />
      {/each}
    {:else}
      <div class="empty-zone">
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
    <div class="completed-section">
      <div class="completed-divider">
        <span class="completed-label">{t('filter.completed')} ({completedTasks.length})</span>
      </div>
      {#each completedTasks as task (task.id)}
        <TaskCard {task} compact={true} />
      {/each}
    </div>
  {/if}
</div>

<style>
  .zone-container {
    background: var(--zone-bg);
    border: 1px solid var(--zone-border);
    border-radius: var(--radius-md);
    padding: 12px;
    transition: all var(--transition-normal);
    min-height: 60px;
  }

  .zone-container.drop-target {
    border-color: var(--zone-color);
    box-shadow: 0 0 0 2px var(--zone-color), var(--shadow-md);
    background: rgba(var(--zone-color-rgb), 0.08);
  }

  .zone-container.is-full {
    opacity: 0.7;
  }

  /* Focus mode dimming - when pomodoro is active on another task */
  .zone-container.focus-dimmed {
    opacity: 0.35;
    filter: grayscale(0.3);
    pointer-events: none;
    transition: all 0.4s ease;
  }

  .zone-container.focus-dimmed:hover {
    opacity: 0.5;
  }

  .zone-container.is-priority-a {
    background: var(--zone-bg);
    position: relative;
    overflow: hidden;
    border-color: var(--priority-a-border);
  }

  .zone-container.is-priority-a::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(218, 119, 242, 0.08), rgba(151, 117, 250, 0.03));
    pointer-events: none;
  }

  .zone-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 10px;
    position: relative;
    cursor: help;
  }

  .zone-title {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .zone-letter {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 700;
    color: white;
    letter-spacing: 0;
  }

  .zone-quota-inline {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-muted);
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
    display: grid;
    grid-template-columns: repeat(var(--zone-columns, 1), 1fr);
    gap: 8px;
  }

  /* Responsive: reduce columns on smaller screens */
  @media (max-width: 1200px) {
    .zone-d .zone-tasks {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  @media (max-width: 900px) {
    .zone-b .zone-tasks,
    .zone-c .zone-tasks,
    .zone-d .zone-tasks {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (max-width: 600px) {
    .zone-tasks {
      grid-template-columns: 1fr !important;
    }
  }

  .empty-zone {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    border: 1px dashed var(--border-color);
    border-radius: var(--radius-sm);
    min-height: 40px;
    opacity: 0.6;
  }

  .empty-text {
    font-size: 11px;
    color: var(--text-muted);
  }

  .completed-section {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--border-subtle);
  }

  .completed-divider {
    margin-bottom: 8px;
  }

  .completed-label {
    font-size: 11px;
    font-weight: 500;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
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
</style>
