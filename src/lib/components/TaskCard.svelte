<script lang="ts">
  import type { Task, Priority } from '$lib/types';
  import { PRIORITY_CONFIG, isThresholdPassed } from '$lib/types';
  import { completeTask, uncompleteTask, deleteTask, updateTask, changePriority } from '$lib/stores/tasks.svelte';
  import { setEditingTask, getUIStore, showToast, setDraggedTask, clearDragState } from '$lib/stores/ui.svelte';
  import { startPomodoro, getPomodoroStore } from '$lib/stores/pomodoro.svelte';
  import { formatRecurrence } from '$lib/utils/recurrence';
  import { isOverdue, getRelativeDayLabel, parseISODate } from '$lib/utils/unitCalc';

  interface Props {
    task: Task;
    compact?: boolean;
    showPriority?: boolean;
  }

  let { task, compact = false, showPriority = false }: Props = $props();

  const ui = getUIStore();
  const pomodoro = getPomodoroStore();

  let isEditing = $derived(ui.editingTaskId === task.id);
  let isActive = $derived(pomodoro.activeTaskId === task.id);
  let isDragging = $derived(ui.draggedTaskId === task.id);
  let editContent = $state(task.content);

  function handleCheck() {
    if (task.completed) {
      uncompleteTask(task.id);
    } else {
      completeTask(task.id);
    }
  }

  function handleStartPomodoro() {
    startPomodoro(task);
  }

  function handleEdit() {
    editContent = task.content;
    setEditingTask(task.id);
  }

  function handleSaveEdit() {
    if (editContent.trim()) {
      updateTask(task.id, { content: editContent.trim() });
    }
    setEditingTask(null);
  }

  function handleCancelEdit() {
    setEditingTask(null);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  }

  function handleDelete() {
    deleteTask(task.id);
    showToast('任务已移至回收站', 'info');
  }

  function handlePriorityChange(newPriority: Priority) {
    const result = changePriority(task.id, newPriority);
    if (!result.success && result.error) {
      showToast(result.error, 'error');
    }
  }

  function handleDragStart(e: DragEvent) {
    e.dataTransfer!.effectAllowed = 'move';
    e.dataTransfer!.setData('text/plain', task.id);
    setDraggedTask(task.id);
  }

  function handleDragEnd() {
    clearDragState();
  }

  const config = $derived(PRIORITY_CONFIG[task.priority]);
  const isTaskOverdue = $derived(isOverdue(task.dueDate));
  const dueDateLabel = $derived(task.dueDate ? getRelativeDayLabel(parseISODate(task.dueDate)) : null);

  // Check if task is dormant (has threshold date in the future)
  const isDormant = $derived(!isThresholdPassed(task));
  const thresholdLabel = $derived(task.thresholdDate ? getRelativeDayLabel(parseISODate(task.thresholdDate)) : null);
</script>

<div
  class="task-card"
  class:compact
  class:completed={task.completed}
  class:active={isActive}
  class:dragging={isDragging}
  class:overdue={isTaskOverdue && !task.completed}
  class:dormant={isDormant}
  style:--priority-color={config.color}
  style:--priority-bg={config.bgColor}
  style:--priority-border={config.borderColor}
  draggable="true"
  ondragstart={handleDragStart}
  ondragend={handleDragEnd}
  role="listitem"
>
  <div class="task-main">
    <button
      class="checkbox"
      class:checked={task.completed}
      onclick={handleCheck}
      aria-label={task.completed ? '标记未完成' : '标记完成'}
    >
      {#if task.completed}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      {/if}
    </button>

    <div class="task-content">
      {#if isEditing}
        <input
          type="text"
          class="edit-input"
          bind:value={editContent}
          onkeydown={handleKeydown}
          onblur={handleSaveEdit}
        />
      {:else}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <span
          class="task-text"
          ondblclick={handleEdit}
          onkeydown={(e) => e.key === 'Enter' && handleEdit()}
          role="textbox"
          aria-readonly="true"
          tabindex="0"
        >
          {task.content}
        </span>

        {#if !compact}
          <div class="task-meta">
            {#each task.projects as project}
              <span class="meta-tag project">{project}</span>
            {/each}
            {#each task.contexts as context}
              <span class="meta-tag context">{context}</span>
            {/each}
            {#each task.customTags as tag}
              <span class="meta-tag custom">{tag}</span>
            {/each}
          </div>
        {/if}
      {/if}
    </div>

    {#if task.pomodoros.estimated > 0}
      <div class="pomodoro-indicator" title="番茄钟进度">
        <span class="pomodoro-count">
          {task.pomodoros.completed}/{task.pomodoros.estimated}
        </span>
      </div>
    {/if}
  </div>

  {#if !compact && (task.dueDate || task.recurrence || task.thresholdDate)}
    <div class="task-footer">
      {#if task.thresholdDate && isDormant}
        <span class="threshold-date" title="休眠至">
          💤 {thresholdLabel}
        </span>
      {/if}
      {#if task.dueDate}
        <span class="due-date" class:overdue={isTaskOverdue}>
          {dueDateLabel}
        </span>
      {/if}
      {#if task.recurrence?.pattern}
        <span class="recurrence">
          {formatRecurrence(task.recurrence.pattern)}
        </span>
      {/if}
    </div>
  {/if}

  <div class="task-actions">
    {#if !task.completed && !compact}
      <button
        class="action-btn play"
        onclick={handleStartPomodoro}
        title="开始专注"
        disabled={isActive}
      >
        <svg viewBox="0 0 24 24" fill="currentColor">
          <polygon points="5 3 19 12 5 21 5 3"></polygon>
        </svg>
      </button>
    {/if}
    <button class="action-btn delete" onclick={handleDelete} title="删除">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
      </svg>
    </button>
  </div>

  {#if showPriority}
    <div class="priority-badge">
      {task.priority}
    </div>
  {/if}
</div>

<style>
  .task-card {
    display: flex;
    flex-direction: column;
    padding: 14px 16px;
    background: var(--card-bg);
    border: 1px solid var(--border-subtle);
    border-left: 3px solid var(--priority-color);
    border-radius: var(--radius-md);
    transition: all var(--transition-normal);
    cursor: grab;
    position: relative;
  }

  .task-card:hover {
    background: var(--card-hover-bg);
    border-color: var(--border-color);
    transform: translateY(-1px);
    box-shadow: var(--shadow-sm);
  }

  .task-card:focus-within {
    outline: none;
    box-shadow: 0 0 0 2px var(--primary-bg);
  }

  .task-card.active {
    background: var(--priority-bg);
    border-color: var(--priority-color);
    box-shadow: 0 0 0 1px var(--priority-color);
    animation: subtlePulse 2.5s ease-in-out infinite;
  }

  .task-card.completed {
    opacity: 0.55;
    border-left-color: var(--text-muted);
  }

  .task-card.completed .task-text {
    text-decoration: line-through;
    color: var(--text-muted);
  }

  .task-card.dragging {
    opacity: 0.4;
    cursor: grabbing;
    transform: scale(0.98);
  }

  .task-card.overdue {
    border-left-color: var(--error);
  }

  .task-card.overdue::after {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: var(--error);
    animation: overdueGlow 2s ease-in-out infinite;
  }

  /* Dormant (threshold date not reached) */
  .task-card.dormant {
    opacity: 0.45;
    background: var(--bg-secondary);
    border-left-color: var(--text-muted);
  }

  .task-card.dormant:hover {
    opacity: 0.65;
  }

  .task-card.dormant .task-text {
    color: var(--text-muted);
  }

  .task-card.dormant .checkbox {
    border-color: var(--text-muted);
    opacity: 0.7;
  }

  .task-card.compact {
    padding: 10px 14px;
  }

  .task-main {
    display: flex;
    align-items: flex-start;
    gap: 12px;
  }

  .checkbox {
    flex-shrink: 0;
    width: 18px;
    height: 18px;
    margin-top: 2px;
    border: 2px solid var(--priority-color);
    border-radius: var(--radius-full);
    background: transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--transition-fast);
    padding: 0;
  }

  .checkbox:hover {
    background: var(--priority-bg);
    transform: scale(1.08);
  }

  .checkbox:active {
    transform: scale(0.92);
  }

  .checkbox.checked {
    background: var(--priority-color);
    animation: checkComplete 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes checkComplete {
    0% { transform: scale(0.8); }
    50% { transform: scale(1.15); }
    100% { transform: scale(1); }
  }

  .checkbox svg {
    width: 10px;
    height: 10px;
    color: white;
    stroke-width: 3;
  }

  .task-content {
    flex: 1;
    min-width: 0;
  }

  .task-text {
    display: block;
    font-size: 14px;
    font-weight: 450;
    color: var(--text-primary);
    line-height: 1.5;
    word-break: break-word;
    cursor: text;
    transition: color var(--transition-fast);
  }

  .edit-input {
    width: 100%;
    padding: 6px 10px;
    font-size: 14px;
    background: var(--input-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    outline: none;
    transition: all var(--transition-fast);
  }

  .edit-input:focus {
    border-color: var(--primary);
    box-shadow: 0 0 0 3px var(--primary-bg);
  }

  .task-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-top: 8px;
  }

  .meta-tag {
    font-size: 11px;
    font-weight: 500;
    padding: 2px 7px;
    border-radius: var(--radius-sm);
    background: var(--tag-bg);
    color: var(--text-secondary);
    transition: all var(--transition-fast);
  }

  .meta-tag.project {
    background: rgba(177, 151, 252, 0.12);
    color: #b197fc;
  }

  .meta-tag.context {
    background: rgba(116, 192, 252, 0.12);
    color: #74c0fc;
  }

  .meta-tag.custom {
    background: rgba(99, 230, 190, 0.12);
    color: #63e6be;
  }

  .pomodoro-indicator {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--text-muted);
    font-size: 12px;
    font-weight: 500;
    padding: 2px 6px;
    background: var(--hover-bg);
    border-radius: var(--radius-sm);
  }

  .pomodoro-count::before {
    content: '🍅';
    margin-right: 3px;
    font-size: 11px;
  }

  .task-footer {
    display: flex;
    gap: 10px;
    margin-top: 8px;
    padding-left: 30px;
    font-size: 11px;
  }

  .threshold-date {
    color: var(--text-muted);
    font-style: italic;
    display: flex;
    align-items: center;
    gap: 3px;
  }

  .due-date {
    color: var(--text-muted);
    font-weight: 500;
  }

  .due-date.overdue {
    color: var(--error);
  }

  .recurrence {
    color: var(--text-muted);
    display: flex;
    align-items: center;
    gap: 3px;
  }

  .recurrence::before {
    content: '🔁';
    font-size: 10px;
  }

  .task-actions {
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    gap: 3px;
    opacity: 0;
    transition: opacity var(--transition-fast);
    background: var(--card-bg);
    padding: 2px;
    border-radius: var(--radius-sm);
  }

  .task-card:hover .task-actions {
    opacity: 1;
  }

  .action-btn {
    width: 26px;
    height: 26px;
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
  }

  .action-btn:hover {
    color: var(--text-primary);
    background: var(--hover-bg);
  }

  .action-btn.play:hover {
    color: var(--success);
    background: var(--success-bg);
  }

  .action-btn.delete:hover {
    color: var(--error);
    background: var(--error-bg);
  }

  .action-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .action-btn svg {
    width: 13px;
    height: 13px;
  }

  .priority-badge {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 18px;
    height: 18px;
    border-radius: var(--radius-sm);
    background: var(--priority-color);
    color: white;
    font-size: 10px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  @keyframes subtlePulse {
    0%, 100% {
      box-shadow: 0 0 0 1px var(--priority-color);
    }
    50% {
      box-shadow: 0 0 0 2px var(--priority-color), 0 0 12px var(--priority-bg);
    }
  }

  @keyframes overdueGlow {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
</style>
