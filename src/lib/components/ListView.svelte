<script lang="ts">
  import { getTasksStore, changePriority, reorderTask, completeTask, uncompleteTask } from '$lib/stores/tasks.svelte';
  import { getI18nStore } from '$lib/i18n';
  import { slide } from 'svelte/transition';
  import { flip } from 'svelte/animate';
  import { PRIORITY_CONFIG, type Priority, type Task, isThresholdPassed } from '$lib/types';
  import { dndzone, TRIGGERS, SHADOW_ITEM_MARKER_PROPERTY_NAME } from 'svelte-dnd-action';
  import { dndConfig, areTaskArraysEqual, type DndConsiderEvent, type DndFinalizeEvent } from '$lib/utils/motion';
  import { setDropTarget, clearDragState, getUIStore, setEditingTask, showToast } from '$lib/stores/ui.svelte';
  import { startPomodoro, getPomodoroStore } from '$lib/stores/pomodoro.svelte';
  import { isOverdue, getRelativeDayLabel, parseISODate } from '$lib/utils/unitCalc';
  import { validatePomodoroEstimate } from '$lib/utils/quota';
  import { isTauri } from '$lib/utils/storage';
  import { invoke } from '@tauri-apps/api/core';

  const tasks = getTasksStore();
  const ui = getUIStore();
  const pomodoro = getPomodoroStore();
  const i18n = getI18nStore();
  const t = i18n.t;

  // Shared DnD type for cross-zone dragging
  const DND_TYPE = 'task-priority-zone';

  // Main priorities (A-E with quotas), F is handled separately as Idea Pool
  const mainPriorities: Priority[] = ['A', 'B', 'C', 'D', 'E'];
  const allPriorities: Priority[] = ['A', 'B', 'C', 'D', 'E', 'F'];

  // DnD state for each priority
  let dndItemsByPriority = $state<Record<Priority, Task[]>>({
    A: [], B: [], C: [], D: [], E: [], F: []
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
        E: getTasksForPriority('E'),
        F: getTasksForPriority('F')
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
    return async (e: DndConsiderEvent) => {
      const { items, info } = e.detail;
      // Clone the items array to ensure reactivity
      dndItemsByPriority[priority] = [...items];

      if (info.trigger === TRIGGERS.DRAG_STARTED) {
        activeDndPriority = priority;
        setDropTarget(priority);
        // Suspend file watcher when drag starts to prevent race condition
        if (isTauri()) {
          await invoke('suspend_watcher');
        }
      }
    };
  }

  function handleDndFinalize(priority: Priority) {
    return async (e: DndFinalizeEvent) => {
      const { items, info } = e.detail;
      // Filter out shadow items using the correct property access
      const cleanItems = items.filter(item => !(item as any)[SHADOW_ITEM_MARKER_PROPERTY_NAME]);
      // 1. Optimistic UI Update
      dndItemsByPriority[priority] = [...cleanItems];

      try {
        if (info.trigger === TRIGGERS.DROPPED_INTO_ZONE) {
          const droppedTask = cleanItems.find(task => task.id === info.id);
          // Only process if droppedTask exists (this is the target zone)
          // If droppedTask is undefined, this is the source zone and we should skip processing
          if (droppedTask) {
            if (droppedTask.priority !== priority) {
              // Task came from another zone - change its priority
              const sourcePriority = droppedTask.priority;
              const result = await changePriority(info.id, priority);
              if (!result.success) {
                // Show error feedback to user
                showToast(result.error || t('error.quotaExceeded'), 'error');
                // Revert all zones if failed
                for (const p of allPriorities) {
                  dndItemsByPriority[p] = getTasksForPriority(p);
                }
              } else {
                // Update both source and target zones with fresh data from store
                dndItemsByPriority[sourcePriority] = getTasksForPriority(sourcePriority);
                dndItemsByPriority[priority] = getTasksForPriority(priority);
              }
            } else {
              // Reorder within zone
              await reorderTask(priority, cleanItems.map(task => task.id));
            }
            // Clear drag state only when we've processed the drop (target zone)
            activeDndPriority = null;
            clearDragState();
          }
          // If droppedTask is undefined, this is the source zone - don't clear state yet
        } else if (info.trigger === TRIGGERS.DROPPED_OUTSIDE_OF_ANY) {
          // Revert all zones
          for (const p of allPriorities) {
            dndItemsByPriority[p] = getTasksForPriority(p);
          }
          // Clear drag state for cancelled drops
          activeDndPriority = null;
          clearDragState();
        }
      } finally {
        // 2. Resume Watcher (Always run this, even on error)
        if (isTauri()) {
          await invoke('resume_watcher');
        }
      }
    };
  }

  // Task actions
  function handleCheck(task: Task) {
    if (task.completed) {
      uncompleteTask(task.id);
    } else {
      completeTask(task.id);
    }
  }

  function handleStartPomodoro(task: Task) {
    startPomodoro(task);
  }

  // Helper functions for task display
  function getTaskDueLabel(task: Task): string | null {
    if (!task.dueDate) return null;
    return getRelativeDayLabel(parseISODate(task.dueDate));
  }

  function isTaskOverdue(task: Task): boolean {
    return isOverdue(task.dueDate);
  }

  function isDormant(task: Task): boolean {
    return !isThresholdPassed(task);
  }

  function isPomodoroOutOfRange(task: Task): { outOfRange: boolean; warning: string | null } {
    if (task.pomodoros.estimated === 0) {
      return { outOfRange: false, warning: null };
    }
    const validation = validatePomodoroEstimate(task.priority, task.pomodoros.estimated);
    return {
      outOfRange: !validation.isValid,
      warning: validation.warning
    };
  }

  const completedTasks = $derived(tasks.tasks.filter(task => task.completed));
  let showCompleted = $state(false);
  let showIdeaPool = $state(true);

  // Idea Pool (F zone) state
  const ideaPoolTasks = $derived(dndItemsByPriority['F']);
  const ideaPoolDropTarget = $derived(ui.dropTargetPriority === 'F' || activeDndPriority === 'F');
</script>

<div class="list-view-container">
  <!-- Main tasks area - clean list style grouped by priority -->
  <div class="list-main" class:expanded={!showIdeaPool}>
    {#each mainPriorities as priority}
      {@const priorityTasks = dndItemsByPriority[priority]}
      {@const isDropTarget = ui.dropTargetPriority === priority || activeDndPriority === priority}
      {@const config = PRIORITY_CONFIG[priority]}
      <section
        class="priority-section"
        class:drop-target={isDropTarget}
        class:has-tasks={priorityTasks.length > 0}
        style:--section-color={config.color}
      >
        <!-- Priority Header - Sleek badge style with full name and tooltip -->
        <div class="section-header">
          <span class="priority-badge" style:background={config.color}>{priority}</span>
          <span class="priority-name">{t(`priority.${priority}`)}</span>
          <div class="priority-info-wrapper">
            <button class="priority-info-btn" aria-label="查看优先级说明">?</button>
            <div class="priority-tooltip">
              <div class="tooltip-title">{priority} · {t(`priority.${priority}`)}</div>
              <div class="tooltip-row">
                <span class="tooltip-label">配额</span>
                <span class="tooltip-value">{t(`priority.quota.${priority}`)}</span>
              </div>
              <div class="tooltip-row">
                <span class="tooltip-label">难度</span>
                <span class="tooltip-value">{t(`priority.difficulty.${priority}`)}</span>
              </div>
              <div class="tooltip-row">
                <span class="tooltip-label">时间</span>
                <span class="tooltip-value">{t(`priority.time.${priority}`)}</span>
              </div>
              <div class="tooltip-desc">{t(`priority.description.${priority}`)}</div>
            </div>
          </div>
          <span class="priority-count">{priorityTasks.length}</span>
        </div>

        <!-- Task List - Clean horizontal list items -->
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
            {@const dueLabel = getTaskDueLabel(task)}
            {@const taskOverdue = isTaskOverdue(task)}
            {@const taskDormant = isDormant(task)}
            {@const isActive = pomodoro.activeTaskId === task.id}
            {@const pomodoroCheck = isPomodoroOutOfRange(task)}
            <div
              animate:flip={{ duration: dndConfig.flipDurationMs }}
              class="task-row-item"
              class:completed={task.completed}
              class:overdue={taskOverdue && !task.completed}
              class:dormant={taskDormant}
              class:active={isActive}
              class:pomodoro-warning={pomodoroCheck.outOfRange}
              style:--priority-color={config.color}
            >
              <!-- Left priority border indicator -->
              <div class="priority-indicator"></div>

              <!-- Checkbox -->
              <button
                class="task-checkbox"
                class:checked={task.completed}
                onclick={(e) => { e.stopPropagation(); handleCheck(task); }}
                aria-label={task.completed ? '标记未完成' : '标记完成'}
              >
                {#if task.completed}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                {/if}
              </button>

              <!-- Task content -->
              <span class="task-content" class:completed={task.completed}>
                {task.content}
              </span>

              <!-- Task metadata -->
              <div class="task-meta">
                {#if dueLabel}
                  <span class="due-badge" class:overdue={taskOverdue}>
                    <span class="due-label">due:</span>
                    <span class="due-date">{dueLabel}</span>
                  </span>
                {/if}

                {#if task.pomodoros.estimated > 0}
                  <button
                    class="pomodoro-badge"
                    class:active={isActive}
                    class:warning={pomodoroCheck.outOfRange}
                    onclick={(e) => { e.stopPropagation(); handleStartPomodoro(task); }}
                    title={pomodoroCheck.warning || "开始番茄钟"}
                    aria-label={`${task.pomodoros.estimated} 番茄${pomodoroCheck.outOfRange ? '，' + pomodoroCheck.warning : ''}`}
                  >
                    🍅 {task.pomodoros.completed > 0 ? `${task.pomodoros.completed}/` : ''}{task.pomodoros.estimated}
                    {#if pomodoroCheck.outOfRange}
                      <span class="warning-icon">⚠</span>
                    {/if}
                  </button>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </section>
    {/each}

    <!-- Completed Section -->
    {#if completedTasks.length > 0}
      <section class="priority-section completed-section">
        <button class="section-header clickable" onclick={() => showCompleted = !showCompleted}>
          <span class="toggle-arrow" class:rotated={showCompleted}>▶</span>
          <span class="section-label">{t('filter.completed')}</span>
          <span class="section-count">{completedTasks.length}</span>
        </button>

        {#if showCompleted}
          <div class="task-list" transition:slide>
            {#each completedTasks as task (task.id)}
              {@const config = PRIORITY_CONFIG[task.priority]}
              <div
                class="task-row-item completed"
                style:--priority-color={config.color}
              >
                <div class="priority-indicator"></div>
                <button
                  class="task-checkbox checked"
                  onclick={() => handleCheck(task)}
                  aria-label="标记未完成"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </button>
                <span class="task-content completed">{task.content}</span>
                <span class="priority-tag" style:background={config.color}>{task.priority}</span>
              </div>
            {/each}
          </div>
        {/if}
      </section>
    {/if}
  </div>

  <!-- Idea Pool (F-zone) - fixed on right side, toggleable -->
  <aside class="idea-pool-panel" class:collapsed={!showIdeaPool} class:drop-target={ideaPoolDropTarget}>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="pool-header" onclick={() => showIdeaPool = !showIdeaPool}>
      <span class="pool-badge" style:background={PRIORITY_CONFIG.F.color}>💡</span>
      {#if showIdeaPool}
        <h3 class="pool-title">{t('inbox.title')}</h3>
        <span class="pool-count">{ideaPoolTasks.length}</span>
      {/if}
      <svg class="toggle-chevron" class:rotated={!showIdeaPool} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="9 18 15 12 9 6"></polyline>
      </svg>
    </div>

    {#if showIdeaPool}
      <div
        class="pool-tasks"
        transition:slide
        use:dndzone={{
          items: ideaPoolTasks,
          flipDurationMs: dndConfig.flipDurationMs,
          dropTargetStyle: {},
          dropTargetClasses: ['dnd-drop-target-active'],
          type: DND_TYPE
        }}
        onconsider={handleDndConsider('F')}
        onfinalize={handleDndFinalize('F')}
      >
        {#each ideaPoolTasks as task (task.id)}
          {@const dueLabel = getTaskDueLabel(task)}
          {@const taskOverdue = isTaskOverdue(task)}
          <div
            animate:flip={{ duration: dndConfig.flipDurationMs }}
            class="pool-task-row"
            style:--priority-color={PRIORITY_CONFIG.F.color}
          >
            <button
              class="task-checkbox"
              class:checked={task.completed}
              onclick={(e) => { e.stopPropagation(); handleCheck(task); }}
            >
              {#if task.completed}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              {/if}
            </button>
            <span class="task-content">{task.content}</span>
            <div class="task-meta">
              {#if dueLabel}
                <span class="due-badge" class:overdue={taskOverdue}>
                  {dueLabel}
                </span>
              {/if}
              {#if task.pomodoros.estimated > 0}
                <span class="pomodoro-badge">🍅 {task.pomodoros.estimated}</span>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </aside>
</div>

<style>
  .list-view-container {
    display: flex;
    width: 100%;
    height: 100%;
    overflow: hidden;
    gap: 16px;
  }

  /* Main area - fills remaining space, sections stack vertically */
  .list-main {
    flex: 1;
    min-width: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding: 4px;
    transition: all 0.3s ease;
  }

  /* Priority Section - Clean grouped list style like sleek */
  .priority-section {
    display: flex;
    flex-direction: column;
    transition: all var(--transition-normal);
  }

  .priority-section.drop-target {
    background: var(--hover-bg);
    border-radius: var(--radius-md);
  }

  /* Section Header - Just the priority badge */
  .section-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 4px 0;
    margin-bottom: 8px;
  }

  .section-header.clickable {
    cursor: pointer;
    padding: 8px 12px;
    margin: 0 -12px;
    border-radius: var(--radius-md);
    border: none;
    background: transparent;
    width: calc(100% + 24px);
  }

  .section-header.clickable:hover {
    background: var(--hover-bg);
  }

  .priority-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    color: white;
    font-size: 14px;
    font-weight: 700;
    flex-shrink: 0;
  }

  .priority-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .priority-count {
    margin-left: auto;
    padding: 2px 8px;
    font-size: 12px;
    font-weight: 500;
    background: var(--bg-secondary);
    color: var(--text-muted);
    border-radius: var(--radius-full);
  }

  /* Priority Info Tooltip */
  .priority-info-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .priority-info-btn {
    width: 18px;
    height: 18px;
    border: 1px solid var(--border-color);
    border-radius: 50%;
    background: transparent;
    color: var(--text-muted);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .priority-info-btn:hover {
    background: var(--hover-bg);
    color: var(--text-primary);
    border-color: var(--text-muted);
  }

  .priority-tooltip {
    position: absolute;
    top: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%);
    width: 200px;
    padding: 12px;
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    z-index: 1000;
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.15s ease, visibility 0.15s ease;
    pointer-events: none;
  }

  .priority-info-wrapper:hover .priority-tooltip,
  .priority-info-btn:focus + .priority-tooltip {
    opacity: 1;
    visibility: visible;
    pointer-events: auto;
  }

  .priority-tooltip::before {
    content: '';
    position: absolute;
    top: -6px;
    left: 50%;
    transform: translateX(-50%);
    border: 6px solid transparent;
    border-bottom-color: var(--border-color);
  }

  .priority-tooltip::after {
    content: '';
    position: absolute;
    top: -5px;
    left: 50%;
    transform: translateX(-50%);
    border: 5px solid transparent;
    border-bottom-color: var(--card-bg);
  }

  .tooltip-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 8px;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--border-subtle);
  }

  .tooltip-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
  }

  .tooltip-label {
    font-size: 11px;
    color: var(--text-muted);
  }

  .tooltip-value {
    font-size: 11px;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .tooltip-desc {
    font-size: 11px;
    color: var(--text-muted);
    margin-top: 8px;
    padding-top: 6px;
    border-top: 1px solid var(--border-subtle);
    line-height: 1.4;
  }

  .toggle-arrow {
    font-size: 10px;
    color: var(--text-muted);
    transition: transform 0.2s;
  }

  .toggle-arrow.rotated {
    transform: rotate(90deg);
  }

  .section-label {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .section-count {
    font-size: 12px;
    color: var(--text-muted);
    margin-left: auto;
  }

  /* Task List - Clean vertical list */
  .task-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-height: 50px;
    padding: 4px;
    border-radius: var(--radius-md);
    transition: background 0.15s ease;
  }

  .task-list:empty::before {
    content: '';
    min-height: 20px;
  }

  /* Task Row Item - Sleek horizontal row style */
  .task-row-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    background: var(--card-bg);
    border-radius: var(--radius-md);
    transition: all var(--transition-fast);
    cursor: grab;
    position: relative;
    user-select: none;
    -webkit-user-select: none;
    touch-action: manipulation;
  }

  .task-row-item:hover {
    background: var(--card-hover-bg);
  }

  .task-row-item:active {
    cursor: grabbing;
  }

  /* DnD active states - from svelte-dnd-action */
  :global(.task-row-item[data-is-dnd-shadow-item]) {
    opacity: 0.5;
    background: var(--primary-bg);
    border: 2px dashed var(--primary);
  }

  :global(.dnd-drop-target-active) {
    background: var(--hover-bg);
    border-radius: var(--radius-md);
  }

  .task-row-item.active {
    background: var(--primary-bg);
    box-shadow: 0 0 0 1px var(--primary);
  }

  .task-row-item.overdue {
    background: var(--error-bg, rgba(239, 68, 68, 0.08));
  }

  .task-row-item.dormant {
    opacity: 0.5;
  }

  .task-row-item.completed {
    opacity: 0.6;
  }

  .task-row-item.pomodoro-warning {
    border-left: 3px solid var(--warning, #ffc107);
  }

  .task-row-item.pomodoro-warning .priority-indicator {
    background: var(--warning, #ffc107);
  }

  /* Priority Indicator - Left colored border */
  .priority-indicator {
    position: absolute;
    left: 0;
    top: 4px;
    bottom: 4px;
    width: 3px;
    background: var(--priority-color);
    border-radius: 2px;
    pointer-events: none; /* Prevent interference with drag */
  }

  /* Checkbox - Circular style like sleek */
  .task-checkbox {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    border: 2px solid var(--priority-color, var(--border-color));
    border-radius: 50%;
    background: transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--transition-fast);
    padding: 0;
    margin-left: 8px;
  }

  .task-checkbox:hover {
    background: var(--priority-color);
    opacity: 0.3;
  }

  .task-checkbox.checked {
    background: var(--priority-color, var(--success));
    border-color: var(--priority-color, var(--success));
  }

  .task-checkbox svg {
    width: 12px;
    height: 12px;
    color: white;
    stroke-width: 3;
  }

  /* Task Content */
  .task-content {
    flex: 1;
    font-size: 14px;
    font-weight: 450;
    color: var(--text-primary);
    line-height: 1.4;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .task-content.completed {
    text-decoration: line-through;
    color: var(--text-muted);
  }

  /* Task Metadata */
  .task-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  /* Due Date Badge - Like sleek's yellow/red badges */
  .due-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    font-size: 11px;
    font-weight: 500;
    background: var(--bg-tertiary, rgba(255, 193, 7, 0.15));
    color: var(--warning, #ffc107);
    border-radius: var(--radius-sm);
  }

  .due-badge.overdue {
    background: var(--error-bg, rgba(239, 68, 68, 0.15));
    color: var(--error, #ef4444);
  }

  .due-label {
    color: var(--text-muted);
    font-weight: 400;
  }

  .due-date {
    font-weight: 600;
  }

  /* Pomodoro Badge */
  .pomodoro-badge {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 3px 8px;
    font-size: 11px;
    font-weight: 600;
    background: var(--error-bg, rgba(239, 68, 68, 0.12));
    color: var(--error, #ef4444);
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .pomodoro-badge:hover {
    background: var(--error, #ef4444);
    color: white;
  }

  .pomodoro-badge.active {
    background: var(--error, #ef4444);
    color: white;
    animation: pulse 2s infinite;
  }

  .pomodoro-badge.warning {
    background: var(--warning, #ffc107);
    color: #1a1a1a;
  }

  .pomodoro-badge.warning:hover {
    background: #e6ae00;
    color: #1a1a1a;
  }

  .warning-icon {
    font-size: 10px;
    margin-left: 2px;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }

  /* Priority Tag for completed tasks */
  .priority-tag {
    padding: 2px 6px;
    font-size: 10px;
    font-weight: 600;
    color: white;
    border-radius: var(--radius-sm);
  }

  /* Empty state hint */
  .empty-hint {
    padding: 16px 24px;
    font-size: 12px;
    color: var(--text-muted);
    font-style: italic;
    text-align: center;
    opacity: 0.6;
  }

  /* Completed Section */
  .completed-section {
    opacity: 0.8;
  }

  /* Idea Pool Panel - Right sidebar */
  .idea-pool-panel {
    width: 280px;
    flex-shrink: 0;
    background: var(--card-bg);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    transition: all 0.3s ease;
    height: 100%;
  }

  .idea-pool-panel.collapsed {
    width: 52px;
  }

  .idea-pool-panel.drop-target {
    border-color: var(--primary);
    box-shadow: 0 0 0 2px var(--primary);
  }

  .pool-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 16px;
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
    width: 28px;
    height: 28px;
    border-radius: 8px;
    font-size: 14px;
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

  .toggle-chevron {
    width: 16px;
    height: 16px;
    color: var(--text-muted);
    transition: transform 0.2s;
    flex-shrink: 0;
  }

  .toggle-chevron.rotated {
    transform: rotate(180deg);
  }

  .pool-tasks {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-height: 60px;
  }

  /* Pool Task Row - Similar to main task rows */
  .pool-task-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    background: var(--bg-secondary);
    border-radius: var(--radius-md);
    transition: all var(--transition-fast);
    cursor: grab;
    user-select: none;
    -webkit-user-select: none;
    touch-action: manipulation;
  }

  .pool-task-row:hover {
    background: var(--hover-bg);
  }

  .pool-task-row:active {
    cursor: grabbing;
  }

  /* DnD shadow item for pool */
  :global(.pool-task-row[data-is-dnd-shadow-item]) {
    opacity: 0.5;
    background: var(--primary-bg);
    border: 2px dashed var(--primary);
  }

  .pool-task-row .task-checkbox {
    width: 18px;
    height: 18px;
    margin-left: 0;
  }

  .pool-task-row .task-content {
    font-size: 13px;
  }

  .pool-task-row .task-meta {
    gap: 6px;
  }

  .pool-task-row .due-badge,
  .pool-task-row .pomodoro-badge {
    padding: 2px 6px;
    font-size: 10px;
  }

  .pool-empty {
    text-align: center;
    padding: 24px;
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
      flex: 1;
      min-height: 0;
      gap: 16px;
      overflow-y: auto;
    }

    .idea-pool-panel {
      width: 100%;
      flex-shrink: 0;
      max-height: 180px;
      position: relative;
      order: 1; /* Put at the end on mobile */
    }

    .idea-pool-panel.collapsed {
      width: 100%;
      max-height: 44px;
    }

    .list-main {
      order: 0; /* Main content first */
    }

    .pool-tasks {
      max-height: 120px;
    }

    .priority-tooltip {
      left: 0;
      transform: translateX(0);
    }

    .priority-tooltip::before,
    .priority-tooltip::after {
      left: 20px;
      transform: none;
    }
  }

  @media (max-width: 600px) {
    .section-header {
      gap: 8px;
    }

    .priority-name {
      font-size: 13px;
    }

    .priority-info-btn {
      width: 16px;
      height: 16px;
      font-size: 10px;
    }
  }
</style>

