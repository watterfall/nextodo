<script lang="ts">
  import type { Task, Priority } from '$lib/types';
  import { PRIORITY_CONFIG, getRetentionRemaining } from '$lib/types';
  import TaskCard from './TaskCard.svelte';
  import { getUIStore } from '$lib/stores/ui.svelte';
  import { getTasksStore } from '$lib/stores/tasks.svelte';
  import { getPomodoroStore } from '$lib/stores/pomodoro.svelte';
  import { countActiveByPriority } from '$lib/utils/quota';
  import { getI18nStore } from '$lib/i18n';

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

  let showCompleted = $state(false);
  let showRecentlyCompleted = $state(true);

  const counts = $derived(countActiveByPriority(tasksStore.tasks));
  const remaining = $derived(config.quota === Infinity ? Infinity : config.quota - counts[priority]);
  const isFull = $derived(priority !== 'F' && config.quota !== Infinity && remaining <= 0);

  // Check if pomodoro is actively running on a task
  const isFocusMode = $derived(pomodoro.state === 'work' && pomodoro.activeTaskId !== null);
  const hasActiveTask = $derived(tasks.some(task => task.id === pomodoro.activeTaskId));

  // Filter out completed tasks for display
  let activeTasks = $derived(tasks.filter(task => !task.completed));
  let completedTasks = $derived(tasks.filter(task => task.completed));

  // Recently completed tasks within retention period for this zone
  const recentlyCompletedTasks = $derived(tasksStore.recentlyCompletedTasksByPriority[priority] || []);

  // Get tooltip text for priority
  const tooltipText = $derived(t(`priority.tooltip.${priority}`));

  // Format retention time remaining
  function formatRetention(task: Task): string {
    const remaining = getRetentionRemaining(task);
    if (!remaining) return '';
    if (remaining.hours > 0) {
      return t('task.retentionHours', { hours: remaining.hours }) || `${remaining.hours}h`;
    }
    return t('task.retentionMinutes', { minutes: remaining.minutes }) || `${remaining.minutes}m`;
  }
</script>

<div
  class="zone-container zone-{priority.toLowerCase()}"
  class:is-priority-a={priority === 'A'}
  class:is-full={isFull}
  class:focus-dimmed={isFocusMode && !hasActiveTask}
  style:--zone-color={config.color}
  style:--zone-bg={config.bgColor}
  style:--zone-border={config.borderColor}
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
    {#if activeTasks.length > 0}
      <div class="tasks-grid" class:compact={priority === 'D'}>
        {#each activeTasks as task (task.id)}
          <div class="task-item-wrapper">
            <TaskCard {task} compact={priority === 'D'} />
          </div>
        {/each}
      </div>
    {:else}
      <div class="empty-zone very-subtle">
        <span class="empty-text">
          {#if isFull}
            {t('zone.full')}
          {:else}
            {t('zone.empty')}
          {/if}
        </span>
      </div>
    {/if}
  </div>

  {#if recentlyCompletedTasks.length > 0}
    <div class="recently-completed-section">
      <button
        class="recently-completed-toggle"
        onclick={() => showRecentlyCompleted = !showRecentlyCompleted}
        title={t('task.recentlyCompletedHint') || 'Recently completed tasks - will fade after retention period'}
      >
        <svg class="toggle-icon" class:rotated={showRecentlyCompleted} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
        <span class="recently-completed-label">
          <span class="checkmark">✓</span>
          {t('task.recentlyCompleted') || 'Recently completed'} ({recentlyCompletedTasks.length})
        </span>
      </button>

      {#if showRecentlyCompleted}
        <div class="recently-completed-list">
          {#each recentlyCompletedTasks as task (task.id)}
            <div class="recently-completed-task">
              <TaskCard {task} compact={true} />
              <span class="retention-badge" title={t('task.retentionHint') || 'Will disappear after retention period'}>
                {formatRetention(task)}
              </span>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}

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

  /* Recently completed tasks section */
  .recently-completed-section {
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px dashed var(--border-subtle);
  }

  .recently-completed-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 6px 0;
    border: none;
    background: transparent;
    color: var(--success, #51cf66);
    font-size: 11px;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .recently-completed-toggle:hover {
    color: var(--text-secondary);
  }

  .recently-completed-label {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .recently-completed-label .checkmark {
    font-size: 10px;
    opacity: 0.8;
  }

  .recently-completed-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-top: 6px;
  }

  .recently-completed-task {
    position: relative;
    opacity: 0.6;
    transition: opacity var(--transition-fast);
  }

  .recently-completed-task:hover {
    opacity: 0.85;
  }

  .retention-badge {
    position: absolute;
    top: 4px;
    right: 4px;
    font-size: 9px;
    font-weight: 500;
    color: var(--text-muted);
    background: var(--bg-secondary);
    padding: 1px 5px;
    border-radius: var(--radius-sm);
    opacity: 0;
    transition: opacity var(--transition-fast);
  }

  .recently-completed-task:hover .retention-badge {
    opacity: 1;
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
