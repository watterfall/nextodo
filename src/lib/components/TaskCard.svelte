<script lang="ts">
  import type { Task, Priority } from '$lib/types';
  import { PRIORITY_CONFIG, isThresholdPassed } from '$lib/types';
  import { completeTask, uncompleteTask, deleteTask, changePriority } from '$lib/stores/tasks.svelte';
  import { openEditModal, getUIStore, showToast } from '$lib/stores/ui.svelte';
  import { startPomodoro, getPomodoroStore } from '$lib/stores/pomodoro.svelte';
  import { formatRecurrence } from '$lib/utils/recurrence';
  import { isOverdue, getRelativeDayLabel, parseISODate } from '$lib/utils/unitCalc';
  import { getI18nStore } from '$lib/i18n';

  interface Props {
    task: Task;
    compact?: boolean;
    showPriority?: boolean;
    isFocused?: boolean;
    kanbanMode?: boolean;
  }

  let { task, compact = false, showPriority = false, isFocused = false, kanbanMode = false }: Props = $props();

  const ui = getUIStore();
  const pomodoro = getPomodoroStore();
  const i18n = getI18nStore();

  let isActive = $derived(pomodoro.activeTaskId === task.id);
  let isFocusMode = $derived(pomodoro.state === 'work' && pomodoro.activeTaskId !== null);
  let isFocusDimmed = $derived(isFocusMode && !isActive);
  let isHovered = $state(false);

  // Derived energy level
  const energyTag = $derived(task.customTags.find(t => ['⚡高能量', '😴低能量', '☕中等'].includes(t)));
  const energyLevel = $derived(
    energyTag === '⚡高能量' ? 'high' :
    energyTag === '😴低能量' ? 'low' :
    energyTag === '☕中等' ? 'medium' : null
  );

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
    openEditModal(task);
  }

  function handleDelete() {
    deleteTask(task.id);
    showToast(i18n.t('message.taskMovedToTrash'), 'info');
  }

  function handlePriorityChange(newPriority: Priority) {
    const result = changePriority(task.id, newPriority);
    if (!result.success && result.error) {
      showToast(result.error, 'error');
    }
  }

  const config = $derived(PRIORITY_CONFIG[task.priority]);
  const isTaskOverdue = $derived(isOverdue(task.dueDate));
  const dueDateLabel = $derived(task.dueDate ? getRelativeDayLabel(parseISODate(task.dueDate)) : null);

  // Check if task is dormant (has threshold date in the future)
  const isDormant = $derived(!isThresholdPassed(task));
  const thresholdLabel = $derived(task.thresholdDate ? getRelativeDayLabel(parseISODate(task.thresholdDate)) : null);

  // Check if task is scheduled too far in advance for its priority
  // A: current cycle only, B: +1 cycle (4 days), C: within a week, D/E: no restriction
  const isScheduledTooFar = $derived.by(() => {
    if (!task.dueDate || task.completed) return false;
    const dueDate = parseISODate(task.dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysDiff = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    switch (task.priority) {
      case 'A': return daysDiff > 2;  // A tasks should be within 2 days (current cycle)
      case 'B': return daysDiff > 4;  // B tasks can be +1 cycle (4 days)
      case 'C': return daysDiff > 7;  // C tasks within a week
      default: return false;          // D/E have no restriction
    }
  });
</script>

<div
  class="task-card"
  class:compact
  class:kanban-mode={kanbanMode}
  class:completed={task.completed}
  class:active={isActive}
  class:overdue={isTaskOverdue && !task.completed}
  class:dormant={isDormant}
  class:scheduled-too-far={isScheduledTooFar}
  class:focus-dimmed={isFocusDimmed}
  class:focus-spotlight={isActive && isFocusMode}
  class:hovered={isHovered}
  class:keyboard-focused={isFocused}
  style:--priority-color={config.color}
  style:--priority-bg={config.bgColor}
  style:--priority-border={config.borderColor}
  onmouseenter={() => isHovered = true}
  onmouseleave={() => isHovered = false}
  role="listitem"
>

  <div class="task-main">
    <button
      class="checkbox"
      class:checked={task.completed}
      onclick={handleCheck}
      aria-label={task.completed ? i18n.t('task.markIncomplete') : i18n.t('task.markComplete')}
    >
      {#if task.completed}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      {/if}
    </button>

    {#if !task.completed && task.pomodoros.estimated > 0}
      {@const remaining = task.pomodoros.estimated - task.pomodoros.completed}
      {#if remaining > 0}
        <button
          class="pomodoro-btn-left"
          class:active={isActive}
          class:kanban-hidden={kanbanMode}
          title={isActive ? i18n.t('task.focusInProgress') : i18n.t('task.pomodoroRemaining', { remaining })}
          onclick={(e) => { e.stopPropagation(); handleStartPomodoro(); }}
          disabled={isActive}
        >
          <span class="tomato-icon">🍅</span>
          <span class="pomodoro-count">{remaining}</span>
        </button>
      {/if}
    {/if}

    <div class="task-content">
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
            {@const displayInfo = getDisplayText(project)}
            <span class="meta-tag project" class:emoji-only={displayInfo.isEmoji} title={project}>{displayInfo.display}</span>
          {/each}
          {#each task.contexts as context}
            {@const displayInfo = getDisplayText(context)}
            <span class="meta-tag context" class:emoji-only={displayInfo.isEmoji} title={context}>{displayInfo.display}</span>
          {/each}
          {#each task.customTags as tag}
            {#if !['⚡高能量', '😴低能量', '☕中等'].includes(tag)}
              {@const displayInfo = getDisplayText(tag)}
              <span class="meta-tag custom" class:emoji-only={displayInfo.isEmoji} title={tag}>{displayInfo.display}</span>
            {/if}
          {/each}

          <!-- Energy Level Visualization -->
          {#if energyLevel}
            <span class="meta-tag energy {energyLevel}" title={`${i18n.t('task.energyLevel')}: ${energyTag}`}>
              {#if energyLevel === 'high'}⚡{:else if energyLevel === 'medium'}☕{:else}😴{/if}
            </span>
          {/if}
        </div>
      {/if}
    </div>

    {#if !task.completed && task.pomodoros.estimated === 0}
      <button
        class="pomodoro-btn"
        class:active={isActive}
        class:kanban-hidden={kanbanMode}
        title={isActive ? i18n.t('task.focusInProgress') : i18n.t('task.clickToStartFocus')}
        onclick={(e) => { e.stopPropagation(); handleStartPomodoro(); }}
        disabled={isActive}
      >
        <span class="tomato-icon">🍅</span>
      </button>
    {/if}
  </div>

  {#if !compact && !kanbanMode && (task.dueDate || task.recurrence || task.thresholdDate)}
    <div class="task-footer">
      {#if task.thresholdDate && isDormant}
        <span class="threshold-date" title={i18n.t('task.dormantUntil')}>
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

  <!-- Action buttons - hover reveal -->
  <div class="task-actions" class:visible={isHovered || isFocused}>
    {#if !task.completed && !compact}
      <button
        class="action-btn play"
        onclick={handleStartPomodoro}
        title={i18n.t('task.startFocus')}
        disabled={isActive}
      >
        <svg viewBox="0 0 24 24" fill="currentColor">
          <polygon points="5 3 19 12 5 21 5 3"></polygon>
        </svg>
      </button>
    {/if}
    <button class="action-btn edit" onclick={handleEdit} title={i18n.t('action.edit')}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
      </svg>
    </button>
    <button class="action-btn delete" onclick={handleDelete} title={i18n.t('action.delete')}>
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
    padding: 10px 12px;
    background: var(--card-bg);
    border: 1px solid var(--border-subtle);
    border-left: 2px solid var(--priority-color);
    border-radius: var(--radius-sm);
    transition: all var(--transition-normal);
    cursor: default;
    position: relative;
    max-height: 100px;
    overflow: hidden;
  }

  .task-card:hover,
  .task-card.keyboard-focused {
    max-height: none;
    overflow: visible;
  }

  .task-card:hover {
    background: var(--card-hover-bg);
    border-color: var(--border-color);
  }

  /* Keyboard focus state - distinct from hover but similar */
  .task-card.keyboard-focused {
    background: var(--card-hover-bg);
    border-color: var(--primary);
    box-shadow: 0 0 0 2px var(--primary-bg);
    z-index: 5;
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

  /* Focus spotlight glow for active task during focus mode */
  .task-card.focus-spotlight {
    box-shadow: 0 0 0 2px var(--priority-color),
                0 0 30px var(--priority-bg),
                var(--shadow-md);
    z-index: 10;
  }

  .task-card.completed {
    opacity: 0.55;
    border-left-color: var(--text-muted);
  }

  .task-card.completed .task-text {
    text-decoration: line-through;
    color: var(--text-muted);
  }

  /* Focus mode dimming */
  .task-card.focus-dimmed {
    opacity: 0.25;
    filter: grayscale(0.5) blur(0.5px);
    pointer-events: none;
    transform: scale(0.98);
    transition: all 0.4s ease;
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

  /* Scheduled too far in advance for priority level */
  .task-card.scheduled-too-far {
    opacity: 0.5;
    border-left-style: dashed;
  }

  .task-card.scheduled-too-far:hover {
    opacity: 0.75;
  }

  .task-card.scheduled-too-far .due-date {
    color: var(--warning, #f59f00);
    font-style: italic;
  }

  .task-card.scheduled-too-far .due-date::after {
    content: ' ⚠️';
    font-size: 10px;
  }

  .task-card.compact {
    padding: 8px 10px;
  }

  /* Kanban mode - consistent card heights and hover-reveal pomodoro */
  .task-card.kanban-mode {
    min-height: 60px;
    max-height: 60px;
    overflow: hidden;
  }

  .task-card.kanban-mode:hover,
  .task-card.kanban-mode.keyboard-focused {
    max-height: none;
  }

  .task-card.kanban-mode .task-meta {
    display: none;
  }

  .task-card.kanban-mode:hover .task-meta,
  .task-card.kanban-mode.keyboard-focused .task-meta {
    display: flex;
  }

  /* Hide pomodoro button in kanban mode when not hovered */
  .pomodoro-btn-left.kanban-hidden,
  .pomodoro-btn.kanban-hidden {
    display: none !important;
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
    cursor: pointer;
    transition: color var(--transition-fast);
  }

  .task-text:hover {
    color: var(--primary);
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
  
  .meta-tag.energy.high {
    background: rgba(255, 107, 107, 0.12);
    color: #ff6b6b;
  }
  
  .meta-tag.energy.medium {
    background: rgba(255, 146, 43, 0.12);
    color: #ff922b;
  }
  
  .meta-tag.energy.low {
    background: rgba(81, 207, 102, 0.12);
    color: #51cf66;
  }

  /* Emoji-only meta tags - compact display */
  .meta-tag.emoji-only {
    padding: 2px 4px;
    font-size: 13px;
    background: transparent;
  }

  /* Pomodoro button on the left (next to checkbox) */
  .pomodoro-btn-left {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 3px;
    color: var(--error, #ff6b6b);
    font-size: 12px;
    font-weight: 600;
    padding: 3px 8px;
    background: var(--error-bg, rgba(255, 107, 107, 0.12));
    border-radius: var(--radius-sm);
    border: none;
    transition: all var(--transition-fast);
    cursor: pointer;
  }

  .pomodoro-btn-left:hover:not(:disabled) {
    background: var(--error, #ff6b6b);
    color: white;
    transform: scale(1.05);
  }

  .pomodoro-btn-left.active {
    background: var(--error, #ff6b6b);
    color: white;
    animation: subtlePulse 2s ease-in-out infinite;
  }

  .pomodoro-btn-left:disabled {
    cursor: default;
  }

  .pomodoro-btn-left .tomato-icon {
    font-size: 12px;
    line-height: 1;
  }

  .pomodoro-btn-left .pomodoro-count {
    font-size: 11px;
    font-weight: 600;
  }

  .pomodoro-btn {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--text-muted);
    font-size: 12px;
    font-weight: 500;
    padding: 3px 8px;
    background: transparent;
    border-radius: var(--radius-sm);
    border: none;
    transition: all var(--transition-fast);
    cursor: pointer;
    opacity: 0.5;
  }

  .task-card:hover .pomodoro-btn,
  .task-card.keyboard-focused .pomodoro-btn {
    opacity: 1;
  }

  .pomodoro-btn.has-estimate {
    opacity: 0.8;
    background: var(--hover-bg);
  }

  .task-card:hover .pomodoro-btn.has-estimate {
    opacity: 1;
  }

  .pomodoro-btn:hover:not(:disabled) {
    background: var(--primary-bg);
    color: var(--primary);
    transform: scale(1.08);
    opacity: 1;
  }

  .pomodoro-btn.active {
    background: var(--primary-bg);
    color: var(--primary);
    opacity: 1;
    animation: subtlePulse 2s ease-in-out infinite;
  }

  .pomodoro-btn:disabled {
    cursor: default;
  }

  .tomato-icon {
    font-size: 13px;
    line-height: 1;
  }

  .pomodoro-count {
    font-size: 11px;
    font-weight: 600;
  }

  .task-footer {
    display: flex;
    gap: 10px;
    margin-top: 8px;
    padding-left: 0;
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

  /* Action buttons - progressive disclosure */
  .task-actions {
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    gap: 3px;
    opacity: 0;
    transform: translateY(-50%) translateX(4px);
    transition: opacity var(--transition-fast), transform var(--transition-fast);
    background: var(--card-bg);
    padding: 2px;
    border-radius: var(--radius-sm);
    pointer-events: none;
    z-index: 20;
  }

  .task-actions.visible {
    opacity: 1;
    transform: translateY(-50%) translateX(0);
    pointer-events: auto;
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

  .action-btn.edit:hover {
    color: var(--primary);
    background: var(--primary-bg);
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
