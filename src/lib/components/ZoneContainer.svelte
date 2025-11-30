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
  let showCompleted = $state(false);

  const counts = $derived(countActiveByPriority(tasksStore.tasks));
  const remaining = $derived(config.quota === Infinity ? Infinity : config.quota - counts[priority]);
  const isFull = $derived(priority !== 'E' && remaining <= 0);

  // Check if pomodoro is actively running on a task
  const isFocusMode = $derived(pomodoro.state === 'work' && pomodoro.activeTaskId !== null);
  const hasActiveTask = $derived(tasks.some(t => t.id === pomodoro.activeTaskId));

  // Filter out completed tasks for display
  let activeTasks = $derived(tasks.filter(t => !t.completed));
  let completedTasks = $derived(tasks.filter(t => t.completed));

  // Get tooltip text for priority
  const tooltipText = $derived(t(`priority.tooltip.${priority}`));

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
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
  role="region"
  aria-label="{config.name}"
>
  <!-- Sleek-style Header -->
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
    {#if activeTasks.length > 0}
      <div class="tasks-grid" class:compact={priority === 'D'}>
        {#each activeTasks as task (task.id)}
          <TaskCard {task} compact={priority === 'D'} />
        {/each}
      </div>
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
    <button
      class="completed-toggle"
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
  }

  .zone-container:hover {
    border-color: var(--border-color);
  }

  .zone-container.drop-target {
    border-color: var(--zone-color);
    box-shadow: 0 0 0 2px var(--zone-color), var(--shadow-md);
    background: var(--zone-bg);
  }

  .zone-container.is-full {
    opacity: 0.7;
  }

  /* Focus mode dimming */
  .zone-container.focus-dimmed {
    opacity: 0.35;
    filter: grayscale(0.3);
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
  }

  .tasks-grid.compact {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 8px;
  }

  .empty-zone {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px 16px;
    border: 1px dashed var(--border-color);
    border-radius: var(--radius-md);
    min-height: 50px;
    opacity: 0.5;
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
