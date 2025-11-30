<script lang="ts">
  import type { Task, Priority } from '$lib/types';
  import { PRIORITY_CONFIG } from '$lib/types';
  import TaskCard from './TaskCard.svelte';
  import { getTasksStore, changePriority } from '$lib/stores/tasks.svelte';
  import { t } from '$lib/i18n';

  const tasks = getTasksStore();

  let inboxTasks = $derived(tasks.tasksByPriority['E'].filter(t => !t.completed));
  let completedTasks = $derived(tasks.tasksByPriority['E'].filter(t => t.completed));
  let showCompleted = $state(false);
  let draggedTaskId = $state<string | null>(null);

  const priorityTargets: { priority: Priority; label: string; color: string }[] = [
    { priority: 'A', label: t('priority.A'), color: PRIORITY_CONFIG.A.color },
    { priority: 'B', label: t('priority.B'), color: PRIORITY_CONFIG.B.color },
    { priority: 'C', label: t('priority.C'), color: PRIORITY_CONFIG.C.color },
    { priority: 'D', label: t('priority.D'), color: PRIORITY_CONFIG.D.color },
  ];

  function handleDragStart(taskId: string) {
    draggedTaskId = taskId;
  }

  function handleDragEnd() {
    draggedTaskId = null;
  }

  function handleMoveToPriority(taskId: string, priority: Priority) {
    changePriority(taskId, priority);
  }
</script>

<div class="inbox-panel">
  <div class="panel-header">
    <div class="header-title">
      <span class="title-icon">📥</span>
      <h3 class="title-text">{t('inbox.title')}</h3>
      <span class="task-count">{inboxTasks.length}</span>
    </div>
    <p class="header-hint">{t('inbox.hint')}</p>
  </div>

  <!-- Quick Move Buttons (shown when dragging) -->
  {#if draggedTaskId}
    <div class="quick-move-bar">
      <span class="move-label">{t('inbox.moveTo')}</span>
      {#each priorityTargets as target}
        <button
          class="move-target"
          style:--target-color={target.color}
          onclick={() => handleMoveToPriority(draggedTaskId!, target.priority)}
          ondragover={(e) => e.preventDefault()}
          ondrop={() => handleMoveToPriority(draggedTaskId!, target.priority)}
        >
          {target.priority}
        </button>
      {/each}
    </div>
  {/if}

  <div class="tasks-container">
    {#if inboxTasks.length > 0}
      <div class="tasks-list">
        {#each inboxTasks as task (task.id)}
          <div
            class="task-wrapper"
            draggable="true"
            ondragstart={() => handleDragStart(task.id)}
            ondragend={handleDragEnd}
          >
            <TaskCard {task} compact={true} />

            <!-- Quick Priority Buttons -->
            <div class="priority-actions">
              {#each priorityTargets as target}
                <button
                  class="priority-btn"
                  style:--btn-color={target.color}
                  onclick={() => handleMoveToPriority(task.id, target.priority)}
                  title={`${t('inbox.moveTo')} ${target.label}`}
                >
                  {target.priority}
                </button>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <div class="empty-state">
        <span class="empty-icon">✨</span>
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
  }

  .panel-header {
    padding: 16px;
    border-bottom: 1px solid var(--border-subtle);
    flex-shrink: 0;
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 6px;
  }

  .title-icon {
    font-size: 20px;
  }

  .title-text {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .task-count {
    padding: 2px 8px;
    font-size: 12px;
    font-weight: 600;
    background: var(--primary-bg);
    color: var(--primary);
    border-radius: var(--radius-full);
  }

  .header-hint {
    margin: 0;
    font-size: 12px;
    color: var(--text-muted);
  }

  .quick-move-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-subtle);
    animation: slideDown 0.2s ease;
  }

  .move-label {
    font-size: 12px;
    color: var(--text-muted);
  }

  .move-target {
    width: 32px;
    height: 32px;
    border: 2px dashed var(--target-color);
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--target-color);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .move-target:hover {
    background: var(--target-color);
    color: white;
    border-style: solid;
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
  }

  .task-wrapper {
    position: relative;
    cursor: grab;
  }

  .task-wrapper:active {
    cursor: grabbing;
  }

  .priority-actions {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    gap: 4px;
    opacity: 0;
    transition: opacity var(--transition-fast);
  }

  .task-wrapper:hover .priority-actions {
    opacity: 1;
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
    opacity: 0.8;
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
    font-size: 40px;
    margin-bottom: 12px;
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

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
