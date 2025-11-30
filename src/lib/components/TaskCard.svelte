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
    padding: 12px 16px;
    background: var(--card-bg);
    border: 1px solid var(--priority-border);
    border-left: 3px solid var(--priority-color);
    border-radius: 8px;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    cursor: grab;
    position: relative;
  }

  .task-card:hover {
    background: var(--card-hover-bg);
    transform: translateX(4px);
    box-shadow: -4px 0 12px -2px var(--priority-bg);
  }

  .task-card:focus-within {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }

  .task-card.active {
    box-shadow: 0 0 0 2px var(--priority-color);
    animation: pulse 2s infinite;
  }

  .task-card.completed {
    opacity: 0.6;
    border-left-color: var(--text-muted);
  }

  .task-card.completed .task-text {
    text-decoration: line-through;
    color: var(--text-muted);
  }

  .task-card.dragging {
    opacity: 0.5;
    cursor: grabbing;
  }

  .task-card.overdue {
    border-left-color: var(--error);
  }

  /* Dormant (threshold date not reached) - low contrast style */
  .task-card.dormant {
    opacity: 0.5;
    background: var(--bg-secondary);
    border-left-color: var(--text-muted);
    filter: grayscale(30%);
  }

  .task-card.dormant:hover {
    opacity: 0.7;
    filter: grayscale(20%);
  }

  .task-card.dormant .task-text {
    color: var(--text-muted);
  }

  .task-card.dormant .checkbox {
    border-color: var(--text-muted);
  }

  .task-card.compact {
    padding: 8px 12px;
  }

  .task-main {
    display: flex;
    align-items: flex-start;
    gap: 12px;
  }

  .checkbox {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    border: 2px solid var(--priority-color);
    border-radius: 50%;
    background: transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
    padding: 0;
  }

  .checkbox:hover {
    background: var(--priority-bg);
    transform: scale(1.1);
  }

  .checkbox:active {
    transform: scale(0.95);
  }

  .checkbox.checked {
    background: var(--priority-color);
    animation: checkmark 0.3s ease-out;
  }

  @keyframes checkmark {
    0% { transform: scale(0.8); }
    50% { transform: scale(1.2); }
    100% { transform: scale(1); }
  }

  .checkbox svg {
    width: 12px;
    height: 12px;
    color: white;
  }

  .task-content {
    flex: 1;
    min-width: 0;
  }

  .task-text {
    display: block;
    font-size: 14px;
    color: var(--text-primary);
    line-height: 1.4;
    word-break: break-word;
    cursor: text;
  }

  .edit-input {
    width: 100%;
    padding: 4px 8px;
    font-size: 14px;
    background: var(--input-bg);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-primary);
    outline: none;
  }

  .edit-input:focus {
    border-color: var(--primary);
  }

  .task-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
  }

  .meta-tag {
    font-size: 11px;
    padding: 2px 6px;
    border-radius: 4px;
    background: var(--tag-bg);
    color: var(--text-secondary);
  }

  .meta-tag.project {
    background: rgba(139, 92, 246, 0.2);
    color: #a78bfa;
  }

  .meta-tag.context {
    background: rgba(59, 130, 246, 0.2);
    color: #60a5fa;
  }

  .meta-tag.custom {
    background: rgba(16, 185, 129, 0.2);
    color: #34d399;
  }

  .pomodoro-indicator {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--text-muted);
    font-size: 12px;
  }

  .pomodoro-count::before {
    content: '🍅';
    margin-right: 2px;
  }

  .task-footer {
    display: flex;
    gap: 12px;
    margin-top: 8px;
    padding-left: 32px;
    font-size: 12px;
  }

  .threshold-date {
    color: var(--text-muted);
    font-style: italic;
  }

  .due-date {
    color: var(--text-muted);
  }

  .due-date.overdue {
    color: var(--error);
  }

  .recurrence {
    color: var(--text-muted);
  }

  .recurrence::before {
    content: '🔁 ';
  }

  .task-actions {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  .task-card:hover .task-actions {
    opacity: 1;
  }

  .action-btn {
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background: var(--action-btn-bg);
    color: var(--text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    padding: 0;
  }

  .action-btn:hover {
    color: var(--text-primary);
    background: var(--action-btn-hover-bg);
  }

  .action-btn.play:hover {
    color: var(--success);
  }

  .action-btn.delete:hover {
    color: var(--error);
  }

  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .action-btn svg {
    width: 14px;
    height: 14px;
  }

  .priority-badge {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 20px;
    height: 20px;
    border-radius: 4px;
    background: var(--priority-color);
    color: white;
    font-size: 11px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  @keyframes pulse {
    0%, 100% {
      box-shadow: 0 0 0 2px var(--priority-color);
    }
    50% {
      box-shadow: 0 0 0 4px var(--priority-color), 0 0 20px var(--priority-color);
    }
  }
</style>
