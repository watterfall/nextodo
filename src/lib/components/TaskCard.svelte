<script lang="ts">
  import type { Task, Priority } from '$lib/types';
  import { PRIORITY_CONFIG, isThresholdPassed, isActivePriority, isFuturePriority, isSustainedPriority, isOperablePriority, subtaskProgress } from '$lib/types';
  import { completeTask, uncompleteTask, cancelTask, changePriority, evolveTask, toggleFilterAttribute, isFilterActive, activateFutureTask } from '$lib/stores/tasks.svelte';
  import { openEditModal, getUIStore, showToast, setDraggingTask } from '$lib/stores/ui.svelte';
  import { clearDragPayload, startTaskDrag } from '$lib/utils/dnd';
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
  let justCompleted = $state(false);

  // Right-click context menu — quick priority changes without dragging
  let ctxMenuOpen = $state(false);
  let ctxMenuX = $state(0);
  let ctxMenuY = $state(0);
  const ctxPriorityOptions: Priority[] = ['A', 'S', 'B', 'C', 'D', 'E', 'F', 'N'];

  function handleContextMenu(e: MouseEvent) {
    e.preventDefault();
    ctxMenuX = e.clientX;
    ctxMenuY = e.clientY;
    ctxMenuOpen = true;
  }

  async function handleCtxMove(target: Priority) {
    ctxMenuOpen = false;
    if (target === task.priority) return;
    const result = await changePriority(task.id, target);
    if (!result.success && result.error) {
      showToast(result.error, 'error');
    } else if (result.success) {
      showToast(i18n.t('message.taskMoved', { priority: target }), 'success');
    }
  }

  function closeCtxMenu(e?: PointerEvent | KeyboardEvent) {
    if (!ctxMenuOpen) return;
    if (e && 'target' in e) {
      const target = (e as PointerEvent).target as Element | null;
      if (target && target.closest('.task-ctx-menu')) return;
    }
    ctxMenuOpen = false;
  }

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

  async function handleActivate() {
    // Activate N task to F (inbox) by default — user can then reprioritize.
    const result = await activateFutureTask(task.id, 'F');
    if (result.success) {
      showToast(i18n.t('message.taskActivated', { priority: 'F' }) || '任务已激活', 'success');
    } else if (result.error) {
      showToast(result.error, 'error');
    }
  }

  function handleCheck() {
    if (task.priority === 'G') {
      // Task is completed, restore it
      uncompleteTask(task.id);
    } else if (isOperablePriority(task.priority)) {
      // Capture priority BEFORE completion (completeTask mutates it to 'G')
      const wasAPriority = task.priority === 'A';
      // Trigger press micro-interaction
      justCompleted = true;
      setTimeout(() => { justCompleted = false; }, 400);
      completeTask(task.id);
      // Sacred A-completion moment — the most important thing of the day is done
      if (wasAPriority) {
        showToast(
          i18n.t('task.aCompleteCelebration') || '🌿 今日的最重要的事完成了 · 该休息片刻了',
          'success',
          4500
        );
      }
    }
  }

  function handleStartPomodoro() {
    startPomodoro(task);
  }

  function handleEdit() {
    openEditModal(task);
  }

  function handleCancel() {
    cancelTask(task.id);
    showToast(i18n.t('message.taskCancelled') || '任务已取消', 'info');
  }

  async function handleEvolve() {
    const result = await evolveTask(task.id);
    if (result.success) {
      showToast(i18n.t('message.taskEvolved') || '任务已演化，新任务已创建', 'success');
    } else if (result.error) {
      showToast(result.error, 'error');
    }
  }

  async function handlePriorityChange(newPriority: Priority) {
    const result = await changePriority(task.id, newPriority);
    if (!result.success && result.error) {
      showToast(result.error, 'error');
    }
  }

  const effectivePriority = $derived(task.completed && task.originalPriority ? task.originalPriority : task.priority);
  const config = $derived(PRIORITY_CONFIG[effectivePriority]);
  const isTaskOverdue = $derived(isActivePriority(task.priority) && isOverdue(task.dueDate));
  const dueDateLabel = $derived(task.dueDate ? getRelativeDayLabel(parseISODate(task.dueDate)) : null);
  const isCompleted = $derived(task.priority === 'G');
  const isCancelled = $derived(task.priority === 'H');
  // Visually de-emphasize lower-pressure zones so they do not compete with A-E
  const isLowPressure = $derived(task.priority === 'F' || task.priority === 'N');
  const isFuture = $derived(task.priority === 'N');
  const isSustained = $derived(task.priority === 'S');
  const subProgress = $derived(subtaskProgress(task));

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
  class:completed={isCompleted}
  class:cancelled={isCancelled}
  class:active={isActive}
  class:overdue={isTaskOverdue}
  class:dormant={isDormant}
  class:scheduled-too-far={isScheduledTooFar}
  class:focus-dimmed={isFocusDimmed}
  class:focus-spotlight={isActive && isFocusMode}
  class:hovered={isHovered}
  class:keyboard-focused={isFocused}
  class:just-completed={justCompleted}
  class:low-pressure={isLowPressure}
  class:future-progress={isFuture}
  class:sustained-progress={isSustained}
  style:--priority-color={config.color}
  style:--priority-bg={config.bgColor}
  style:--priority-border={config.borderColor}
  onmouseenter={() => isHovered = true}
  onmouseleave={() => isHovered = false}
  oncontextmenu={handleContextMenu}
  draggable="true"
  ondragstart={(e) => {
    if (!isOperablePriority(task.priority)) {
      e.preventDefault();
      return;
    }
    startTaskDrag(e, { taskId: task.id, fromPriority: task.priority });
    setDraggingTask(true, task.priority);
  }}
  ondragend={() => {
    clearDragPayload();
    setDraggingTask(false);
  }}
  role="listitem"
>

  <div class="task-main">
    <button
      class="checkbox"
      class:checked={isCompleted}
      class:cancelled={isCancelled}
      onclick={handleCheck}
      aria-label={isCompleted ? i18n.t('task.markIncomplete') : i18n.t('task.markComplete')}
    >
      {#if isCompleted}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
          <polyline class="checkmark-path" points="20 6 9 17 4 12"></polyline>
        </svg>
      {:else if isCancelled}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      {/if}
    </button>

    {#if isActivePriority(task.priority) && task.pomodoros.estimated > 0}
      {@const remaining = Math.max(0, task.pomodoros.estimated - task.pomodoros.completed)}
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
            <button
              class="meta-tag project"
              class:emoji-only={displayInfo.isEmoji}
              class:active={isFilterActive('project', project)}
              title={`${i18n.t('filter.filterBy') || 'Filter by'}: +${project}`}
              onclick={(e) => { e.stopPropagation(); toggleFilterAttribute('project', project); }}
            >{displayInfo.display}</button>
          {/each}
          {#each task.contexts as context}
            {@const displayInfo = getDisplayText(context)}
            <button
              class="meta-tag context"
              class:emoji-only={displayInfo.isEmoji}
              class:active={isFilterActive('context', context)}
              title={`${i18n.t('filter.filterBy') || 'Filter by'}: @${context}`}
              onclick={(e) => { e.stopPropagation(); toggleFilterAttribute('context', context); }}
            >{displayInfo.display}</button>
          {/each}
          {#each task.customTags as tag}
            {#if !['⚡高能量', '😴低能量', '☕中等'].includes(tag)}
              {@const displayInfo = getDisplayText(tag)}
              <button
                class="meta-tag custom"
                class:emoji-only={displayInfo.isEmoji}
                class:active={isFilterActive('tag', tag)}
                title={`${i18n.t('filter.filterBy') || 'Filter by'}: #${tag}`}
                onclick={(e) => { e.stopPropagation(); toggleFilterAttribute('tag', tag); }}
              >{displayInfo.display}</button>
            {/if}
          {/each}

          <!-- Energy Level Visualization (non-interactive) -->
          {#if energyLevel}
            <span class="meta-tag energy {energyLevel}" title={`${i18n.t('task.energyLevel')}: ${energyTag}`}>
              {#if energyLevel === 'high'}⚡{:else if energyLevel === 'medium'}☕{:else}😴{/if}
            </span>
          {/if}
        </div>
      {/if}
    </div>

    {#if !task.completed && task.pomodoros.estimated === 0}
      <!-- Show nothing for tasks with no estimate or exceeded estimate to keep interface clean -->
    {/if}
  </div>

  {#if subProgress.total > 0 && !isCompleted && !isCancelled}
    <!-- Subtask progress bar — surfaces breakdown completion at a glance.
         Compact (single bar + count), most useful on S Sustained tasks. -->
    <div class="subtask-progress" title={i18n.t('taskCard.subtasksDone', { done: subProgress.done, total: subProgress.total })}>
      <div class="progress-track">
        <div class="progress-fill" style:width="{Math.round(subProgress.ratio * 100)}%"></div>
      </div>
      <span class="progress-count">{subProgress.done}/{subProgress.total}</span>
    </div>
  {/if}

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

  <!-- Action buttons - hover reveal (hidden in compact mode as parent provides its own actions) -->
  {#if !compact}
    <div class="task-actions" class:visible={isHovered || isFocused}>
      {#if isActivePriority(task.priority)}
        <button
          class="action-btn play"
          onclick={handleStartPomodoro}
          title={i18n.t('task.startFocus')}
          disabled={isActive}
        >
          {#if kanbanMode && task.pomodoros.estimated > 0}
            <span style="font-size: 12px; margin-right: 2px;">🍅</span>
            {@const remaining = Math.max(0, task.pomodoros.estimated - task.pomodoros.completed)}
            {#if remaining > 0}
               <span style="font-size: 10px; font-weight: 700;">{remaining}</span>
            {/if}
          {:else}
            <svg viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
          {/if}
        </button>
      {/if}
      <button class="action-btn edit" onclick={handleEdit} title={i18n.t('action.edit')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
      </button>
      {#if isFuturePriority(task.priority)}
        <button class="action-btn activate" onclick={handleActivate} title={i18n.t('action.activate') || '激活到当前周期'}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
          </svg>
        </button>
      {/if}
      {#if isActivePriority(task.priority)}
        <button class="action-btn evolve" onclick={handleEvolve} title={i18n.t('message.evolveTaskHint') || '完成并演化'}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14"></path>
            <path d="M5 12h14"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
        </button>
      {/if}
      {#if isOperablePriority(task.priority)}
        <button class="action-btn cancel" onclick={handleCancel} title={i18n.t('action.cancel') || '取消任务'}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      {/if}
    </div>
  {/if}

  {#if showPriority}
    <div class="priority-badge">
      {task.priority}
    </div>
  {/if}
</div>

{#if ctxMenuOpen}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="task-ctx-menu"
    style:left="{ctxMenuX}px"
    style:top="{ctxMenuY}px"
    role="menu"
  >
    <div class="ctx-section-label">{i18n.t('taskCard.moveToPriority')}</div>
    <div class="ctx-priority-grid">
      {#each ctxPriorityOptions as p}
        <button
          class="ctx-priority-btn"
          class:current={p === task.priority}
          style:--p-color={PRIORITY_CONFIG[p].color}
          onclick={() => handleCtxMove(p)}
          title={PRIORITY_CONFIG[p].description}
          disabled={p === task.priority}
        >
          <span class="ctx-letter">{p}</span>
          <span class="ctx-name">{i18n.t(`priority.${p}`)}</span>
        </button>
      {/each}
    </div>
    <div class="ctx-divider"></div>
    <button class="ctx-action" onclick={() => { ctxMenuOpen = false; handleEdit(); }}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
      </svg>
      {i18n.t('taskCard.editDetails')}
    </button>
    {#if isActivePriority(task.priority)}
      <button class="ctx-action" onclick={() => { ctxMenuOpen = false; handleCheck(); }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        {i18n.t('taskCard.markComplete')}
      </button>
      <button class="ctx-action danger" onclick={() => { ctxMenuOpen = false; handleCancel(); }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
        {i18n.t('taskCard.cancelTask')}
      </button>
    {/if}
  </div>
{/if}

<svelte:window onpointerdown={closeCtxMenu} onkeydown={(e) => e.key === 'Escape' && (ctxMenuOpen = false)} />

<style>
  .task-card {
    display: flex;
    flex-direction: column;
    padding: 11px 14px 11px 16px;
    background: var(--card-bg);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-md);
    box-shadow: var(--elevation-1);
    transition: background var(--transition-fast),
                border-color var(--transition-fast),
                box-shadow var(--transition-fast),
                transform var(--transition-fast),
                max-height var(--transition-normal),
                filter var(--transition-fast);
    cursor: grab;
    position: relative;
    max-height: 100px;
    overflow: hidden;
    /* Subtle entry animation — fade-in with small rise so newly added cards
       have a moment of "settled into place". Backwards fill prevents flash. */
    animation: card-enter 0.22s cubic-bezier(0.16, 1, 0.3, 1) backwards;
  }

  @keyframes card-enter {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .task-card {
      animation: none;
    }
  }

  /* Priority accent — subtle dot at top-left corner instead of side-tab border.
     Replaces the aggressive border-left strip; reads as a label, not a tell. */
  .task-card::before {
    content: '';
    position: absolute;
    top: 12px;
    left: 6px;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--priority-color);
    opacity: 0.85;
    pointer-events: none;
  }

  .task-card:hover,
  .task-card.keyboard-focused {
    max-height: none;
    overflow: visible;
  }

  .task-card:hover {
    background: var(--card-hover-bg);
    border-color: var(--border-subtle);
    box-shadow: var(--elevation-2);
    transform: translateY(-2px);
    filter: brightness(1.04);
  }

  /* Press response — momentary press-in. Excluded when clicking a child button
     (the button gets its own active state). */
  .task-card:active {
    transform: translateY(0) scale(0.992);
    transition-duration: 0.08s;
    filter: brightness(1.02);
    cursor: grabbing;
  }

  /* Keyboard focus state — primary ring (not background change) */
  .task-card.keyboard-focused {
    background: var(--card-hover-bg);
    border-color: var(--border-subtle);
    box-shadow: var(--elevation-2), var(--ring-focus);
    z-index: 5;
  }

  .task-card:focus-within {
    outline: none;
    box-shadow: var(--elevation-2), var(--ring-focus);
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

  /* Low-pressure zones (F idea pool, N future progress) — quieter visual weight
     so they do not compete with A-E daily flow. Reduce opacity, slightly lighter
     text. Restore on hover so they remain fully accessible. */
  .task-card.low-pressure {
    opacity: 0.78;
    background: var(--card-bg);
  }

  .task-card.low-pressure .task-text {
    font-weight: 400;
    color: var(--text-secondary);
  }

  .task-card.low-pressure::before {
    opacity: 0.55;
  }

  .task-card.low-pressure:hover,
  .task-card.low-pressure.keyboard-focused {
    opacity: 1;
  }

  .task-card.low-pressure:hover .task-text,
  .task-card.low-pressure.keyboard-focused .task-text {
    color: var(--text-primary);
  }

  /* Future-progress (N) — subtle dashed border hint that this is "in the queue" */
  .task-card.future-progress {
    border-style: dashed;
    border-color: var(--priority-n-border, rgba(116, 143, 252, 0.22));
  }

  .task-card.future-progress:hover {
    border-style: solid;
  }

  /* Sustained (S) — left edge accent in S color, denotes "持续推进" */
  .task-card.sustained-progress {
    border-left: 2px solid var(--priority-s-color, #20c997);
    padding-left: 14px;
  }

  /* Subtask progress strip — slim, sits below content */
  .subtask-progress {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
    padding: 0 2px;
  }

  .progress-track {
    flex: 1;
    height: 4px;
    background: var(--bg-tertiary, rgba(128, 128, 128, 0.15));
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--priority-s-color, #20c997);
    border-radius: 2px;
    transition: width 0.3s var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1));
  }

  .progress-count {
    font-size: 10px;
    font-weight: 600;
    color: var(--text-muted);
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    min-width: 28px;
    text-align: right;
  }

  .action-btn.activate:hover {
    color: var(--priority-n-color, #748ffc);
    background: var(--priority-n-bg, rgba(116, 143, 252, 0.12));
  }

  .task-card.completed {
    opacity: 0.55;
  }

  .task-card.completed .task-text {
    text-decoration: line-through;
    color: var(--text-muted);
  }

  /* Cancelled — text + dot get muted, no side-bar */
  .task-card.cancelled {
    opacity: 0.45;
  }

  .task-card.cancelled::before {
    background: var(--text-muted);
  }

  .task-card.cancelled .task-text {
    text-decoration: line-through;
    color: var(--text-muted);
    font-style: italic;
  }

  /* Focus mode dimming */
  .task-card.focus-dimmed {
    opacity: 0.25;
    filter: grayscale(0.5) blur(0.5px);
    pointer-events: none;
    transform: scale(0.98);
    transition: all 0.4s ease;
  }

  /* Overdue — dot turns red, due-date label also red (no animated side-strip) */
  .task-card.overdue::before {
    background: var(--error);
    box-shadow: 0 0 6px var(--error);
  }

  /* Dormant (threshold not reached) — "patiently waiting", not broken.
     Cool blue-grey tint + reduced contrast suggests rest, not failure. */
  .task-card.dormant {
    opacity: 0.72;
    background: linear-gradient(
      to right,
      rgba(116, 192, 252, 0.04),
      var(--card-bg) 40%
    );
  }

  .task-card.dormant::before {
    background: #74c0fc;
    opacity: 0.55;
    box-shadow: 0 0 4px rgba(116, 192, 252, 0.3);
  }

  .task-card.dormant:hover {
    opacity: 0.92;
  }

  .task-card.dormant .task-text {
    color: var(--text-secondary);
    font-style: italic;
  }

  .task-card.dormant .checkbox {
    border-color: rgba(116, 192, 252, 0.5);
    opacity: 0.8;
  }

  /* Scheduled too far — slight ring around dot to flag the issue */
  .task-card.scheduled-too-far {
    opacity: 0.5;
  }

  .task-card.scheduled-too-far::before {
    box-shadow: 0 0 0 1.5px var(--warning, #ffc107);
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

  .task-card.kanban-mode .pomodoro-btn-left {
    padding: 2px 4px;
    gap: 2px;
    font-size: 10px;
  }

  .task-card.kanban-mode .pomodoro-btn-left .tomato-icon {
    font-size: 10px;
  }

  .task-card.kanban-mode .pomodoro-btn-left .pomodoro-count {
    font-size: 10px;
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

  /* Adjust action-btn for text content */
  .action-btn.play {
    width: auto;
    min-width: 26px;
    padding: 0 6px;
    gap: 2px;
  }

  .task-main {
    display: flex;
    align-items: flex-start;
    gap: 8px; /* Reduced gap from 12px */
  }

  .task-card.kanban-mode .task-main {
    gap: 6px; /* Even tighter gap for kanban mode */
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
    animation: check-burst 0.36s var(--ease-out-expo);
  }

  .checkbox.cancelled {
    background: var(--text-muted);
    border-color: var(--text-muted);
  }

  .checkbox.cancelled svg {
    width: 10px;
    height: 10px;
    color: white;
  }

  .checkbox svg {
    width: 10px;
    height: 10px;
    color: white;
    stroke-width: 3;
  }

  /* SVG checkmark stroke draws in (uses keyframe from app.css) */
  .checkmark-path {
    stroke-dasharray: 24;
    stroke-dashoffset: 24;
    animation: check-stroke-draw 0.22s var(--ease-out-expo) 0.08s forwards;
  }

  /* Card press response — brief tactile feedback when completing */
  .task-card.just-completed {
    animation: card-press 0.22s var(--ease-out-expo);
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
    border: 1px solid transparent;
    line-height: 1.5;
    /* button-specific resets */
    font-family: inherit;
    cursor: pointer;
  }

  /* Interactive chip (button) hover: subtle lift, color amp */
  button.meta-tag:hover {
    transform: translateY(-1px);
    filter: brightness(1.15);
  }

  /* Active state: chip is the current filter — inverted colors */
  button.meta-tag.active {
    color: var(--bg-primary);
    border-color: currentColor;
    font-weight: 600;
    box-shadow: var(--elevation-1);
  }

  .meta-tag.project {
    background: rgba(177, 151, 252, 0.12);
    color: #b197fc;
  }

  button.meta-tag.project.active {
    background: #b197fc;
  }

  .meta-tag.context {
    background: rgba(116, 192, 252, 0.12);
    color: #74c0fc;
  }

  button.meta-tag.context.active {
    background: #74c0fc;
  }

  .meta-tag.custom {
    background: rgba(99, 230, 190, 0.12);
    color: #63e6be;
  }

  button.meta-tag.custom.active {
    background: #63e6be;
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
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
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
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
  }

  .task-footer {
    display: flex;
    gap: 10px;
    margin-top: 8px;
    padding-left: 0;
    font-size: 11px;
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.01em;
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

  .action-btn.cancel:hover {
    color: var(--text-muted);
    background: var(--hover-bg);
  }

  .action-btn.evolve:hover {
    color: var(--priority-a-color, #da77f2);
    background: var(--priority-a-bg, rgba(218, 119, 242, 0.12));
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

  /* Right-click context menu — quick priority change without dragging.
     Floats at the cursor position via fixed positioning. */
  :global(.task-ctx-menu) {
    position: fixed;
    z-index: 200;
    min-width: 240px;
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.22);
    padding: 8px;
    animation: ctx-pop 0.14s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes ctx-pop {
    from { opacity: 0; transform: translateY(-4px) scale(0.96); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }

  :global(.ctx-section-label) {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--text-muted);
    padding: 4px 6px 6px;
    letter-spacing: 0.04em;
  }

  :global(.ctx-priority-grid) {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 3px;
  }

  :global(.ctx-priority-btn) {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all var(--transition-fast);
    font-family: inherit;
    text-align: left;
  }

  :global(.ctx-priority-btn:hover:not(:disabled)) {
    border-color: var(--p-color);
    background: color-mix(in srgb, var(--p-color) 12%, transparent);
    color: var(--p-color);
  }

  :global(.ctx-priority-btn.current) {
    background: color-mix(in srgb, var(--p-color) 18%, transparent);
    border-color: var(--p-color);
    color: var(--p-color);
    opacity: 0.6;
    cursor: default;
  }

  :global(.ctx-letter) {
    font-size: 12px;
    font-weight: 700;
    color: var(--p-color);
    font-family: var(--font-mono);
    min-width: 10px;
  }

  :global(.ctx-name) {
    font-size: 11px;
  }

  :global(.ctx-divider) {
    height: 1px;
    background: var(--border-subtle);
    margin: 6px 0;
  }

  :global(.ctx-action) {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 6px 8px;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 12px;
    font-family: inherit;
    text-align: left;
    transition: all var(--transition-fast);
  }

  :global(.ctx-action:hover) {
    background: var(--hover-bg);
    color: var(--text-primary);
  }

  :global(.ctx-action.danger:hover) {
    background: rgba(255, 107, 107, 0.1);
    color: var(--error, #ff6b6b);
  }

  :global(.ctx-action svg) {
    width: 13px;
    height: 13px;
  }

</style>
