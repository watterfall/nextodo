<script lang="ts">
  import type { Task, Priority } from '$lib/types';
  import { PRIORITY_CONFIG, getRetentionRemaining } from '$lib/types';
  import TaskCard from './TaskCard.svelte';
  import { getTasksStore, reorderTask, needsPriorityChangeConfirmation, changePriority } from '$lib/stores/tasks.svelte';
  import { getPomodoroStore } from '$lib/stores/pomodoro.svelte';
  import { getUIStore, openEditModal } from '$lib/stores/ui.svelte';
  import { countActiveByPriority } from '$lib/utils/quota';
  import { getI18nStore } from '$lib/i18n';
  import { slide } from 'svelte/transition';
  import { tick } from 'svelte';
  import { dndzone } from 'svelte-dnd-action';
  import { flip } from 'svelte/animate';
  import { dndConfig } from '$lib/utils/motion';
  import { validateQuota, canAddTask } from '$lib/utils/quota';
  import { showToast } from '$lib/stores/ui.svelte';

  const tasks = getTasksStore();
  const pomodoro = getPomodoroStore();
  const ui = getUIStore();
  const i18n = getI18nStore();
  const t = i18n.t;

  // Main priorities (A-E with quotas) shown in grid, F (Idea Pool) shown on the right side
  const mainPriorities: Priority[] = ['A', 'B', 'C', 'D', 'E'];
  const priorities: Priority[] = ['A', 'B', 'C', 'D', 'E', 'F'];
  const counts = $derived(countActiveByPriority(tasks.tasks));

  // Focus mode check
  const isFocusMode = $derived(pomodoro.state === 'work' && pomodoro.activeTaskId !== null);

  // Local state for DnD items
  // We need to maintain a local copy because dndzone updates it during drag
  let columnItems = $state<Record<Priority, Task[]>>({
    A: [], B: [], C: [], D: [], E: [], F: []
  });

  let isDragging = $state(false);

  // Sync from store when not dragging
  $effect(() => {
    if (!isDragging) {
      priorities.forEach(p => {
        columnItems[p] = tasks.tasksByPriority[p].filter(t => !t.completed);
      });
    }
  });

  function handleDndConsider(priority: Priority, e: CustomEvent<DndEvent<Task>>) {
    isDragging = true;
    columnItems[priority] = e.detail.items;
  }

  async function handleDndFinalize(priority: Priority, e: CustomEvent<DndEvent<Task>>) {
    isDragging = false;
    columnItems[priority] = e.detail.items;

    // Check for tasks that changed priority
    const previousTasks = tasks.tasksByPriority[priority].filter(t => !t.completed);
    const previousIds = new Set(previousTasks.map(t => t.id));
    const newTasks = e.detail.items;

    // Find tasks that were moved TO this priority
    const movedTasks = newTasks.filter(t => !previousIds.has(t.id) && t.priority !== priority);

    // Check for priority change confirmation for each moved task
    for (const task of movedTasks) {
      const confirmCheck = needsPriorityChangeConfirmation(task, priority);
      if (confirmCheck.needsConfirmation && confirmCheck.message) {
        // Show confirmation dialog
        pendingPriorityChange = {
          taskId: task.id,
          newPriority: priority,
          reason: confirmCheck.message
        };
        return; // Don't proceed until user confirms
      }
    }

    // Check quota if item was moved
    if (priority !== 'F') { // F has no quota
      const newCount = newTasks.length;
      const quota = PRIORITY_CONFIG[priority].quota;

      if (newCount > quota && quota !== Infinity) {
        showToast(t('message.quotaExceeded', { priority }), 'warning');
      }
    }

    reorderTask(priority, e.detail.items);
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
    // Refresh columnItems to revert the visual change
    priorities.forEach(p => {
      columnItems[p] = tasks.tasksByPriority[p].filter(t => !t.completed);
    });
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
  <!-- Main priority columns (A-D) as horizontal kanban columns -->
  <div class="kanban-main" class:expanded={!showQuickAction}>
    {#each mainPriorities as priority}
      {@const config = PRIORITY_CONFIG[priority]}
      {@const activeTasks = columnItems[priority]}
      {@const completedTasks = getCompletedForPriority(priority)}
      {@const isFull = counts[priority] >= config.quota}
      {@const isDimmed = isFocusMode && !hasActiveTaskInColumn(priority)}

      <div
        class="priority-column"
        class:is-full={isFull}
        class:focus-dimmed={isDimmed}
        class:drop-target={false} 
        style:--card-color={config.color}
        role="region"
        aria-label={t(`priority.${priority}`)}
      >
        <div class="column-header" title={t(`priority.tooltip.${priority}`)}>
          <span class="column-letter" style:background={config.color}>{priority}</span>
          <span class="column-name">{t(`priority.${priority}`)}</span>
          <span class="column-count">{counts[priority]}</span>
        </div>

        <div 
          class="column-tasks" 
          use:dndzone={{ items: activeTasks, flipDurationMs: dndConfig.flipDurationMs, dropTargetStyle: { outline: `2px solid ${config.color}`, outlineOffset: '-2px', borderRadius: '8px' } }}
          onconsider={(e) => handleDndConsider(priority, e)}
          onfinalize={(e) => handleDndFinalize(priority, e)}
        >
          {#each activeTasks as task (task.id)}
            <div
              class="task-item-wrapper"
              id={`task-${task.id}`}
              tabindex={focusedTaskId === task.id ? 0 : -1}
              animate:flip={{ duration: dndConfig.flipDurationMs }}
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
            <div class="empty-column-spacer"></div>
          {/if}
        </div>

        <!-- Recently completed tasks within retention period -->
        {@const recentlyCompletedTasks = getRecentlyCompletedForPriority(priority)}
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
      </div>
    {/each}
  </div>

  <!-- Idea Pool (F zone) - fixed on right side, toggleable -->
  <aside
    class="idea-pool-panel"
    class:collapsed={!showQuickAction}
    class:focus-dimmed={ideaPoolDimmed}
  >
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="pool-header" onclick={() => showQuickAction = !showQuickAction} title={t('priority.tooltip.F')}>
      <span class="pool-badge" style:background={PRIORITY_CONFIG.F.color}>💡</span>
      {#if showQuickAction}
        <span class="pool-title">{t('inbox.title')}</span>
        <span class="pool-count">{ideaPoolTasks.length}</span>
      {/if}
      <svg class="toggle-icon" class:rotated={!showQuickAction} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="9 18 15 12 9 6"></polyline>
      </svg>
    </div>

    {#if showQuickAction}
      <div 
        class="pool-tasks" 
        transition:slide
        use:dndzone={{ items: ideaPoolTasks, flipDurationMs: dndConfig.flipDurationMs, dropTargetStyle: { outline: `2px solid ${PRIORITY_CONFIG.F.color}`, outlineOffset: '-2px', borderRadius: '8px' } }}
        onconsider={(e) => handleDndConsider('F', e)}
        onfinalize={(e) => handleDndFinalize('F', e)}
      >
        {#each ideaPoolTasks as task (task.id)}
          <div
            class="pool-task-item"
            animate:flip={{ duration: dndConfig.flipDurationMs }}
          >
            <TaskCard {task} compact kanbanMode={true} />
          </div>
        {/each}
        {#if ideaPoolTasks.length === 0}
          <div class="pool-empty-spacer"></div>
        {/if}
      </div>
    {/if}
  </aside>

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
  .kanban-container {
    display: flex;
    width: 100%;
    height: 100%;
    gap: 12px;
    overflow: hidden;
    outline: none;
  }

  /* Main area with A/B/C/D as horizontal columns */
  .kanban-main {
    flex: 1;
    min-width: 0;
    display: flex;
    gap: 12px;
    overflow-x: auto;
    transition: all 0.3s ease;
  }

  /* Priority Column (A/B/C/D) - vertical kanban columns */
  .priority-column {
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

  .priority-column.drop-target {
    border-color: var(--card-color);
    box-shadow: 0 0 0 2px var(--card-color);
  }

  .priority-column.is-full {
    opacity: 0.7;
  }

  .priority-column.focus-dimmed {
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

  .completed-section {
    padding: 10px;
    border-top: 1px solid var(--border-subtle);
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex-shrink: 0;
    max-height: 120px;
    overflow-y: auto;
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

  .idea-pool-panel.drop-target {
    border-color: var(--primary);
    box-shadow: 0 0 0 2px var(--primary);
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
    .priority-column {
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

    .priority-column {
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
