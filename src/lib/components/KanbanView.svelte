<script lang="ts">
  import type { Task, Priority } from '$lib/types';
  import { PRIORITY_CONFIG, getRetentionRemaining } from '$lib/types';
  import TaskCard from './TaskCard.svelte';
  import ZoneRail from './ZoneRail.svelte';
  import DropZone from './DropZone.svelte';
  import QuickAddRow from './QuickAddRow.svelte';
  import type { TaskDragPayload, SubtaskDragPayload } from '$lib/utils/dnd';
  import { getTasksStore, reorderTask, changePriority, promoteSubtask } from '$lib/stores/tasks.svelte';
  import { getPomodoroStore } from '$lib/stores/pomodoro.svelte';
  import { getUIStore, openEditModal } from '$lib/stores/ui.svelte';
  import { countActiveByPriority } from '$lib/utils/quota';
  import { getI18nStore } from '$lib/i18n';
  import { slide } from 'svelte/transition';
  import { tick } from 'svelte';
  import { flip } from 'svelte/animate';
  import { dndConfig } from '$lib/utils/motion';
  import { validateQuota, canAddTask } from '$lib/utils/quota';
  import { showToast } from '$lib/stores/ui.svelte';

  const tasks = getTasksStore();
  const pomodoro = getPomodoroStore();
  const ui = getUIStore();
  const i18n = getI18nStore();
  const t = i18n.t;

  // Main priorities (A-E with quotas). F/N/S live in the persistent
  // ReservoirPanel above the view to avoid duplication.
  const mainPriorities: Priority[] = ['A', 'B', 'C', 'D', 'E'];
  const priorities: Priority[] = ['A', 'B', 'C', 'D', 'E'];
  const counts = $derived(countActiveByPriority(tasks.tasks));

  // Focus mode check
  const isFocusMode = $derived(pomodoro.state === 'work' && pomodoro.activeTaskId !== null);

  // Derived view onto tasks per priority (no local mirror needed —
  // native DnD doesn't require items array bookkeeping).
  const columnItems = $derived.by(() => {
    const r: Record<Priority, Task[]> = { A: [], B: [], C: [], D: [], E: [], F: [], G: [], H: [], N: [], S: [] };
    for (const p of priorities) {
      r[p] = (tasks.tasksByPriority[p] ?? []).filter(t => !t.completed);
    }
    return r;
  });

  // Native HTML5 DnD drop handlers — called by DropZone wrapper
  async function handleDropTaskInColumn(priority: Priority, payload: TaskDragPayload) {
    if (payload.fromPriority === priority) return null;
    const result = await changePriority(payload.taskId, priority, true);
    if (!result.success) return { success: false, error: result.error || t('message.moveFailed') };
    return { success: true, toast: t('message.movedTo', { priority, name: t(`priority.${priority}`) }) };
  }

  async function handleDropSubtaskInColumn(priority: Priority, payload: SubtaskDragPayload) {
    const result = await promoteSubtask(payload.parentTaskId, payload.subtaskId, priority);
    if (!result.success) return { success: false, error: result.error || t('message.promoteFailed') };
    return { success: true, toast: t('message.promotedTo', { priority, name: t(`priority.${priority}`) }) };
  }

  // Idea Pool (F zone) derived values
  // Use columnItems for F zone as well to support DnD
  const ideaPoolTasks = $derived(columnItems['F']);
  const ideaPoolDimmed = $derived(isFocusMode && !hasActiveTaskInColumn('F'));

  // Recently completed tasks display state (per priority)
  let showRecentlyCompleted = $state<Record<Priority, boolean>>({
    A: true, B: true, C: true, D: true, E: true, F: true, G: false, H: false
  });

  // Format retention time remaining
  function formatRetention(task: Task): string {
    const remaining = getRetentionRemaining(task);
    if (!remaining) return '';
    if (remaining.hours > 0) {
      return t('task.retentionHours', { hours: remaining.hours }) || `${remaining.hours}h`;
    }
    return t('task.retentionMinutes', { minutes: remaining.minutes }) || `${remaining.minutes}m`;
  }

  // Get recently completed tasks for a priority
  function getRecentlyCompletedForPriority(priority: Priority): Task[] {
    return tasks.recentlyCompletedTasksByPriority[priority] || [];
  }

  // Priority change confirmation state
  let pendingPriorityChange = $state<{ taskId: string; newPriority: Priority; reason: string } | null>(null);

  async function confirmPriorityChange() {
    if (pendingPriorityChange) {
      await changePriority(pendingPriorityChange.taskId, pendingPriorityChange.newPriority, true);
      pendingPriorityChange = null;
    }
  }

  function cancelPriorityChange() {
    pendingPriorityChange = null;
    // columnItems is derived; nothing to manually refresh
  }

  // Keyboard navigation state
  let focusedPriority = $state<Priority | null>(null);
  let focusedTaskIndex = $state<number>(-1);
  let focusedTaskId = $state<string | null>(null);

  // Quick Action panel toggle state
  let showQuickAction = $state(true);

  function getCompletedForPriority(priority: Priority) {
    return tasks.tasksByPriority[priority].filter(task => task.completed);
  }

  function hasActiveTaskInColumn(priority: Priority) {
    return tasks.tasksByPriority[priority].some(task => task.id === pomodoro.activeTaskId);
  }

  // Keyboard Navigation
  function handleKeyDown(e: KeyboardEvent) {
    // Only handle if no modal is open and not editing
    if (ui.editingTaskId || ui.editingTask || document.querySelector('.modal-overlay')) return;

    // Start navigation with arrow keys if nothing focused
    if (!focusedPriority && (e.key === 'ArrowDown' || e.key === 'ArrowRight')) {
      e.preventDefault();
      focusedPriority = 'A';
      focusedTaskIndex = 0;
      updateFocus();
      return;
    }

    if (!focusedPriority) return;

    const currentTasks = columnItems[focusedPriority];
    const priorityIndex = priorities.indexOf(focusedPriority);

    switch (e.key) {
      case 'ArrowDown':
      case 'j':
        e.preventDefault();
        if (focusedTaskIndex < currentTasks.length - 1) {
          focusedTaskIndex++;
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
          const newTasks = columnItems[focusedPriority];
          focusedTaskIndex = Math.min(focusedTaskIndex, Math.max(0, newTasks.length - 1));
          if (newTasks.length === 0) focusedTaskIndex = -1;
          updateFocus();
        }
        break;

      case 'ArrowLeft':
      case 'h':
        e.preventDefault();
        if (priorityIndex > 0) {
          focusedPriority = priorities[priorityIndex - 1];
          const newTasks = columnItems[focusedPriority];
          focusedTaskIndex = Math.min(focusedTaskIndex, Math.max(0, newTasks.length - 1));
          if (newTasks.length === 0) focusedTaskIndex = -1;
          updateFocus();
        }
        break;

      case 'Enter':
        e.preventDefault();
        if (focusedPriority && focusedTaskIndex >= 0) {
          const task = columnItems[focusedPriority][focusedTaskIndex];
          if (task) {
            // Open edit modal for the task
            openEditModal(task);
          }
        }
        break;

      case 'Escape':
        focusedPriority = null;
        focusedTaskIndex = -1;
        focusedTaskId = null;
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        break;
    }
  }

  function updateFocus() {
    if (focusedPriority && focusedTaskIndex >= 0) {
      const task = columnItems[focusedPriority][focusedTaskIndex];
      if (task) {
        focusedTaskId = task.id;
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
  <!-- Main priority columns (A-E) as horizontal kanban columns. F lives in ReservoirPanel. -->
  <div class="kanban-main expanded">
    {#each mainPriorities as priority}
      {@const config = PRIORITY_CONFIG[priority]}
      {@const activeTasks = tasks.tasksByPriority[priority].filter(t => !t.completed)}
      {@const completedTasks = getCompletedForPriority(priority)}
      {@const isFull = counts[priority] >= config.quota}
      {@const isDimmed = isFocusMode && !hasActiveTaskInColumn(priority)}
      {@const recentlyCompletedTasks = getRecentlyCompletedForPriority(priority)}

      <DropZone
        color={config.color}
        class="priority-column drop-zone-column {isFull ? 'is-full' : ''} {isDimmed ? 'focus-dimmed' : ''}"
        onTaskDrop={(p) => handleDropTaskInColumn(priority, p)}
        onSubtaskDrop={(p) => handleDropSubtaskInColumn(priority, p)}
      >
        <div class="column-header" title={t(`priority.tooltip.${priority}`)} style:--card-color={config.color}>
          <span class="column-letter" style:background={config.color}>{priority}</span>
          <span class="column-name">{t(`priority.${priority}`)}</span>
          <span class="column-count">{counts[priority]}</span>
        </div>

        <div
          class="column-tasks"
          role="listbox"
          aria-label={t(`priority.${priority}`)}
        >
          {#each activeTasks as task (task.id)}
            <div
              class="task-item-wrapper"
              id={`task-${task.id}`}
              role="option"
              aria-selected={focusedTaskId === task.id}
              tabindex={focusedTaskId === task.id ? 0 : -1}
            >
              <TaskCard
                {task}
                compact={priority === 'D'}
                isFocused={focusedTaskId === task.id}
                kanbanMode={true}
              />
            </div>
          {/each}
          {#if activeTasks.length === 0}
            <div class="empty-column-hint">
              {t('message.dropHere')} ↓
            </div>
          {/if}

          <QuickAddRow {priority} />
        </div>

        <!-- Recently completed tasks within retention period -->
        {#if recentlyCompletedTasks.length > 0}
          <div class="recently-completed-section">
            <button
              class="recently-completed-toggle"
              onclick={() => showRecentlyCompleted[priority] = !showRecentlyCompleted[priority]}
              title={t('task.recentlyCompletedHint') || 'Recently completed tasks - will fade after retention period'}
            >
              <svg class="toggle-icon" class:rotated={showRecentlyCompleted[priority]} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
              <span class="recently-completed-label">
                <span class="checkmark">✓</span>
                {t('task.recentlyCompleted') || 'Recently completed'} ({recentlyCompletedTasks.length})
              </span>
            </button>

            {#if showRecentlyCompleted[priority]}
              <div class="recently-completed-list" transition:slide>
                {#each recentlyCompletedTasks as task (task.id)}
                  <div class="recently-completed-task">
                    <TaskCard {task} compact={true} kanbanMode={true} />
                    <span class="retention-badge" title={t('task.retentionHint') || 'Will disappear after retention period'}>
                      {formatRetention(task)}
                    </span>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {/if}
      </DropZone>
    {/each}
  </div>

  <!-- Bottom rail: S / F / N as a horizontal 3-zone strip below A-E.
       Spatially adjacent for short-distance DnD. -->
  <div class="kanban-rail">
    <ZoneRail orientation="horizontal" />
  </div>

  <!-- Priority change confirmation dialog -->
  {#if pendingPriorityChange}
    <div class="modal-overlay" onclick={cancelPriorityChange}>
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div class="confirmation-modal" onclick={(e) => e.stopPropagation()}>
        <div class="modal-icon">⚠️</div>
        <p class="modal-message">{pendingPriorityChange.reason}</p>
        <div class="modal-actions">
          <button class="btn-cancel" onclick={cancelPriorityChange}>
            {t('action.cancel') || 'Cancel'}
          </button>
          <button class="btn-confirm" onclick={confirmPriorityChange}>
            {t('action.continueAnyway') || 'Continue Anyway'}
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  /* Two-row layout: A-E top, S/F/N rail bottom */
  .kanban-container {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    gap: 10px;
    overflow: hidden;
    outline: none;
  }

  /* Main area with A/B/C/D/E as horizontal columns */
  .kanban-main {
    flex: 1.7;
    min-height: 0;
    display: flex;
    gap: 12px;
    overflow-x: auto;
    transition: all 0.3s ease;
  }

  /* Bottom rail — S/F/N strip */
  .kanban-rail {
    flex: 1;
    min-height: 180px;
    max-height: 38%;
    overflow: hidden;
  }

  /* Priority Column (A/B/C/D) - vertical kanban columns */
  :global(.priority-column) {
    flex: 1 1 0;
    min-width: 180px;
    display: flex;
    flex-direction: column;
    background: var(--card-bg);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    transition: all var(--transition-normal);
    overflow: hidden;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }

  :global(.priority-column.drop-target) {
    border-color: var(--card-color);
    box-shadow: 0 0 0 2px var(--card-color);
  }

  :global(.priority-column.is-full) {
    opacity: 0.7;
  }

  :global(.priority-column.focus-dimmed) {
    opacity: 0.3;
    filter: grayscale(0.4) blur(0.5px);
    pointer-events: none;
    transition: all 0.4s ease;
  }

  .column-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    border-bottom: 1px solid var(--border-subtle);
    cursor: help;
    flex-shrink: 0;
  }

  .column-letter {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 700;
    color: white;
  }

  .column-name {
    flex: 1;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .column-count {
    padding: 3px 10px;
    font-size: 12px;
    font-weight: 600;
    background: var(--bg-secondary);
    color: var(--text-muted);
    border-radius: var(--radius-full);
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

  .empty-column-spacer {
    min-height: 40px;
    flex: 1;
  }

  .pool-empty-spacer {
    min-height: 40px;
  }

  /* Recently completed tasks section */
  .recently-completed-section {
    padding: 10px;
    border-top: 1px dashed var(--border-subtle);
    flex-shrink: 0;
  }

  .recently-completed-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 4px 0;
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
    max-height: 150px;
    overflow-y: auto;
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

  .toggle-icon {
    width: 12px;
    height: 12px;
    transition: transform var(--transition-fast);
  }

  .toggle-icon.rotated {
    transform: rotate(90deg);
  }

  /* Confirmation Modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(2px);
  }

  .confirmation-modal {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    padding: 24px;
    max-width: 360px;
    text-align: center;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  }

  .modal-icon {
    font-size: 32px;
    margin-bottom: 12px;
  }

  .modal-message {
    font-size: 14px;
    color: var(--text-secondary);
    margin: 0 0 20px;
    line-height: 1.5;
  }

  .modal-actions {
    display: flex;
    gap: 12px;
    justify-content: center;
  }

  .btn-cancel,
  .btn-confirm {
    padding: 8px 16px;
    border-radius: var(--radius-md);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .btn-cancel {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    color: var(--text-secondary);
  }

  .btn-cancel:hover {
    background: var(--hover-bg);
  }

  .btn-confirm {
    background: var(--primary);
    border: 1px solid var(--primary);
    color: white;
  }

  .btn-confirm:hover {
    opacity: 0.9;
  }

  /* Idea Pool Panel (F zone) - fixed on right, toggleable */
  .idea-pool-panel {
    width: 260px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    background: var(--card-bg);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    overflow: hidden;
    transition: all 0.3s ease;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }

  .idea-pool-panel.collapsed {
    width: 52px;
  }

  .idea-pool-panel.focus-dimmed {
    opacity: 0.3;
    filter: grayscale(0.4) blur(0.5px);
    pointer-events: none;
  }

  .pool-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    border-bottom: 1px solid var(--border-subtle);
    flex-shrink: 0;
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
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 60px;
  }

  .pool-task-item {
    opacity: 0.85;
    transition: opacity 0.15s;
  }

  .pool-task-item:hover {
    opacity: 1;
  }

  /* Responsive adjustments */
  @media (max-width: 1200px) {
    :global(.priority-column) {
      min-width: 160px;
    }
    .idea-pool-panel {
      width: 220px;
    }
  }

  @media (max-width: 900px) {
    .kanban-container {
      flex-direction: column;
    }

    .kanban-main {
      flex: 1;
      min-height: 0;
      overflow-x: hidden;
      overflow-y: auto;
      flex-direction: column;
    }

    :global(.priority-column) {
      flex: none;
      min-width: unset;
      max-width: unset;
      min-height: 150px;
      max-height: 250px;
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
