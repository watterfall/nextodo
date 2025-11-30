<script lang="ts">
  import type { Task, Priority } from '$lib/types';
  import { PRIORITY_CONFIG } from '$lib/types';
  import TaskCard from './TaskCard.svelte';
  import { getUIStore, setDropTarget, clearDragState } from '$lib/stores/ui.svelte';
  import { changePriority, getTasksStore } from '$lib/stores/tasks.svelte';
  import { countActiveByPriority } from '$lib/utils/quota';
  import { t } from '$lib/i18n';

  interface Props {
    priority: Priority;
    tasks: Task[];
  }

  let { priority, tasks }: Props = $props();

  const config = PRIORITY_CONFIG[priority];
  const ui = getUIStore();
  const tasksStore = getTasksStore();

  let isDropTarget = $derived(ui.dropTargetPriority === priority);

  const counts = $derived(countActiveByPriority(tasksStore.tasks));
  const remaining = $derived(config.quota === Infinity ? Infinity : config.quota - counts[priority]);
  const isFull = $derived(priority !== 'E' && remaining <= 0);

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
  class="zone-container"
  class:drop-target={isDropTarget}
  class:is-priority-a={priority === 'A'}
  class:is-full={isFull}
  style:--zone-color={config.color}
  style:--zone-bg={config.bgColor}
  style:--zone-border={config.borderColor}
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
  role="region"
  aria-label="{config.name}"
>
  <div class="zone-header">
    <div class="zone-title">
      {#if priority === 'A'}
        <span class="zone-icon">🎯</span>
      {:else if priority === 'B'}
        <span class="zone-icon">⚡</span>
      {:else if priority === 'C'}
        <span class="zone-icon">📋</span>
      {:else if priority === 'D'}
        <span class="zone-icon">⏱️</span>
      {/if}
      <span class="zone-name">{config.name}</span>
      <span class="zone-priority">({priority})</span>
    </div>

    <div class="zone-quota">
      <span class="quota-dots">
        {#each Array(config.quota) as _, i}
          <span class="quota-dot" class:filled={i < counts[priority]}></span>
        {/each}
      </span>
      <span class="quota-text">{counts[priority]}/{config.quota}</span>
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
    border-radius: var(--radius-lg);
    padding: 14px 16px;
    transition: all var(--transition-normal);
    min-height: 80px;
  }

  .zone-container.drop-target {
    border-color: var(--zone-color);
    box-shadow: 0 0 0 2px var(--zone-color), var(--shadow-md);
    background: rgba(var(--zone-color-rgb), 0.08);
  }

  .zone-container.is-full {
    opacity: 0.7;
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
    gap: 10px;
    margin-bottom: 12px;
    position: relative;
  }

  .zone-title {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
  }

  .zone-icon {
    font-size: 16px;
  }

  .zone-name {
    font-weight: 600;
    font-size: 14px;
    color: var(--text-primary);
    letter-spacing: -0.01em;
  }

  .zone-priority {
    font-size: 12px;
    color: var(--zone-color);
    font-weight: 600;
    opacity: 0.9;
  }

  .zone-quota {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .quota-dots {
    display: flex;
    gap: 3px;
  }

  .quota-dot {
    width: 6px;
    height: 6px;
    border-radius: var(--radius-full);
    background: var(--border-color);
    transition: all var(--transition-fast);
  }

  .quota-dot.filled {
    background: var(--zone-color);
    box-shadow: 0 0 4px var(--zone-color);
  }

  .quota-text {
    font-size: 11px;
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
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .empty-zone {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    border: 1px dashed var(--border-color);
    border-radius: var(--radius-md);
    min-height: 60px;
  }

  .empty-text {
    font-size: 12px;
    color: var(--text-muted);
    font-style: italic;
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
