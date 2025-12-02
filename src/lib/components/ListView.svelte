<script lang="ts">
  import { getTasksStore, completeTask, uncompleteTask, reorderTask } from '$lib/stores/tasks.svelte';
  import { getI18nStore } from '$lib/i18n';
  import { slide } from 'svelte/transition';
  import { PRIORITY_CONFIG, type Priority, type Task, isThresholdPassed } from '$lib/types';
  import { openEditModal, getUIStore, showToast } from '$lib/stores/ui.svelte';
  import { startPomodoro, getPomodoroStore } from '$lib/stores/pomodoro.svelte';
  import { isOverdue, getRelativeDayLabel, parseISODate } from '$lib/utils/unitCalc';
  import { validatePomodoroEstimate } from '$lib/utils/quota';
  import { dndzone } from 'svelte-dnd-action';
  import { flip } from 'svelte/animate';
  import { dndConfig } from '$lib/utils/motion';

  const tasks = getTasksStore();
  const ui = getUIStore();
  const pomodoro = getPomodoroStore();
  const i18n = getI18nStore();
  const t = i18n.t;

  // Helper to extract emoji from string (for minimal display)
  const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;

  function extractEmoji(text: string): string | null {
    const match = text.match(emojiRegex);
    return match ? match.join('') : null;
  }

  function getDisplayText(text: string): { display: string; isEmoji: boolean } {
    const emoji = extractEmoji(text);
    if (emoji && emoji.length > 0) {
      return { display: emoji, isEmoji: true };
    }
    return { display: text, isEmoji: false };
  }

  // Main priorities (A-E with quotas), F is handled separately as Idea Pool
  const mainPriorities: Priority[] = ['A', 'B', 'C', 'D', 'E'];
  const priorities: Priority[] = ['A', 'B', 'C', 'D', 'E', 'F'];

  // Local state for DnD items
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

  function handleDndFinalize(priority: Priority, e: CustomEvent<DndEvent<Task>>) {
    isDragging = false;
    columnItems[priority] = e.detail.items;
    reorderTask(priority, e.detail.items);
  }

  function getTasksForPriority(priority: Priority) {
    return columnItems[priority];
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

  function handleEdit(task: Task) {
    openEditModal(task);
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
  const ideaPoolTasks = $derived(columnItems['F']);
</script>

<div class="list-view-container">
  <!-- Main tasks area - clean list style grouped by priority -->
  <div class="list-main" class:expanded={!showIdeaPool}>
    {#each mainPriorities as priority}
      {@const priorityTasks = columnItems[priority]}
      {@const config = PRIORITY_CONFIG[priority]}
      <section
        class="priority-section"
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
          use:dndzone={{ items: priorityTasks, flipDurationMs: dndConfig.flipDurationMs, dropTargetStyle: { outline: `2px solid ${config.color}`, outlineOffset: '-2px', borderRadius: '8px' } }}
          onconsider={(e) => handleDndConsider(priority, e)}
          onfinalize={(e) => handleDndFinalize(priority, e)}
        >
          {#each priorityTasks as task (task.id)}
            {@const dueLabel = getTaskDueLabel(task)}
            {@const taskOverdue = isTaskOverdue(task)}
            {@const taskDormant = isDormant(task)}
            {@const isActive = pomodoro.activeTaskId === task.id}
            {@const pomodoroCheck = isPomodoroOutOfRange(task)}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="task-row-item"
              class:completed={task.completed}
              class:overdue={taskOverdue && !task.completed}
              class:dormant={taskDormant}
              class:active={isActive}
              class:pomodoro-warning={pomodoroCheck.outOfRange}
              style:--priority-color={config.color}
              ondblclick={() => handleEdit(task)}
              animate:flip={{ duration: dndConfig.flipDurationMs }}
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
                {#if task.pomodoros.estimated > 0}
                  {@const remaining = task.pomodoros.estimated - task.pomodoros.completed}
                  {#if remaining > 0}
                    <button
                      class="pomodoro-badge"
                      class:active={isActive}
                      class:warning={pomodoroCheck.outOfRange}
                      onclick={(e) => { e.stopPropagation(); handleStartPomodoro(task); }}
                      title={pomodoroCheck.warning || `剩余 ${remaining} 个番茄钟`}
                      aria-label={`剩余 ${remaining} 个番茄钟${pomodoroCheck.outOfRange ? '，' + pomodoroCheck.warning : ''}`}
                    >
                      🍅 {remaining}
                      {#if pomodoroCheck.outOfRange}
                        <span class="warning-icon">⚠</span>
                      {/if}
                    </button>
                  {/if}
                {/if}

                {#each task.projects as project}
                  {@const displayInfo = getDisplayText(project)}
                  <span class="emoji-tag project" class:emoji-only={displayInfo.isEmoji} title={project}>{displayInfo.display}</span>
                {/each}
                {#each task.contexts as context}
                  {@const displayInfo = getDisplayText(context)}
                  <span class="emoji-tag context" class:emoji-only={displayInfo.isEmoji} title={context}>{displayInfo.display}</span>
                {/each}
                {#each task.customTags as tag}
                  {#if !['⚡高能量', '😴低能量', '☕中等'].includes(tag)}
                    {@const displayInfo = getDisplayText(tag)}
                    <span class="emoji-tag custom" class:emoji-only={displayInfo.isEmoji} title={tag}>{displayInfo.display}</span>
                  {/if}
                {/each}

                {#if dueLabel}
                  <span class="due-badge" class:overdue={taskOverdue}>
                    <span class="due-date">{dueLabel}</span>
                  </span>
                {/if}

                <!-- Edit button -->
                <button
                  class="edit-btn"
                  onclick={(e) => { e.stopPropagation(); handleEdit(task); }}
                  title="编辑任务"
                  aria-label="编辑任务"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                </button>
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
  <aside class="idea-pool-panel" class:collapsed={!showIdeaPool}>
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
        use:dndzone={{ items: ideaPoolTasks, flipDurationMs: dndConfig.flipDurationMs, dropTargetStyle: { outline: `2px solid ${PRIORITY_CONFIG.F.color}`, outlineOffset: '-2px', borderRadius: '8px' } }}
        onconsider={(e) => handleDndConsider('F', e)}
        onfinalize={(e) => handleDndFinalize('F', e)}
      >
        {#each ideaPoolTasks as task (task.id)}
          {@const dueLabel = getTaskDueLabel(task)}
          {@const taskOverdue = isTaskOverdue(task)}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="pool-task-row"
            style:--priority-color={PRIORITY_CONFIG.F.color}
            ondblclick={() => handleEdit(task)}
            animate:flip={{ duration: dndConfig.flipDurationMs }}
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
              {#if task.pomodoros.estimated > 0}
                {@const remaining = task.pomodoros.estimated - task.pomodoros.completed}
                {#if remaining > 0}
                  <span class="pomodoro-badge">🍅 {remaining}</span>
                {/if}
              {/if}
              {#each task.projects as project}
                {@const displayInfo = getDisplayText(project)}
                <span class="emoji-tag project" class:emoji-only={displayInfo.isEmoji} title={project}>{displayInfo.display}</span>
              {/each}
              {#each task.contexts as context}
                {@const displayInfo = getDisplayText(context)}
                <span class="emoji-tag context" class:emoji-only={displayInfo.isEmoji} title={context}>{displayInfo.display}</span>
              {/each}
              {#each task.customTags as tag}
                {#if !['⚡高能量', '😴低能量', '☕中等'].includes(tag)}
                  {@const displayInfo = getDisplayText(tag)}
                  <span class="emoji-tag custom" class:emoji-only={displayInfo.isEmoji} title={tag}>{displayInfo.display}</span>
                {/if}
              {/each}
              {#if dueLabel}
                <span class="due-badge" class:overdue={taskOverdue}>
                  {dueLabel}
                </span>
              {/if}
              <!-- Edit button -->
              <button
                class="edit-btn"
                onclick={(e) => { e.stopPropagation(); handleEdit(task); }}
                title="编辑任务"
                aria-label="编辑任务"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
              </button>
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
    cursor: pointer;
    position: relative;
  }

  .task-row-item:hover {
    background: var(--card-hover-bg);
  }

  .task-row-item:hover .edit-btn {
    opacity: 1;
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

  .due-date {
    font-weight: 600;
  }

  /* Emoji tag styles */
  .emoji-tag {
    display: inline-flex;
    align-items: center;
    padding: 2px 6px;
    font-size: 11px;
    font-weight: 500;
    border-radius: var(--radius-sm);
    cursor: default;
  }

  .emoji-tag.project {
    background: rgba(177, 151, 252, 0.12);
    color: #b197fc;
  }

  .emoji-tag.context {
    background: rgba(116, 192, 252, 0.12);
    color: #74c0fc;
  }

  .emoji-tag.custom {
    background: rgba(99, 230, 190, 0.12);
    color: #63e6be;
  }

  .emoji-tag.emoji-only {
    padding: 2px 3px;
    font-size: 13px;
    background: transparent;
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

  /* Edit button */
  .edit-btn {
    width: 24px;
    height: 24px;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--transition-fast);
    padding: 0;
    opacity: 0;
  }

  .edit-btn:hover {
    background: var(--primary-bg);
    color: var(--primary);
  }

  .edit-btn svg {
    width: 14px;
    height: 14px;
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
    cursor: pointer;
  }

  .pool-task-row:hover {
    background: var(--hover-bg);
  }

  .pool-task-row:hover .edit-btn {
    opacity: 1;
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
