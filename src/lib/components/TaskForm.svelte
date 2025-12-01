<script lang="ts">
  import type { Priority } from '$lib/types';
  import { PRIORITY_CONFIG } from '$lib/types';
  import { addTask } from '$lib/stores/tasks.svelte';
  import { showToast } from '$lib/stores/ui.svelte';
  import { getI18nStore } from '$lib/i18n';

  interface Props {
    onSubmit?: () => void;
  }

  let { onSubmit }: Props = $props();

  const i18n = getI18nStore();
  const t = i18n.t;

  let content = $state('');
  let project = $state('');
  let mood = $state('');
  let tags = $state('');
  let dueDate = $state('');
  let thresholdDate = $state('');
  let estimatedPomodoros = $state<number | null>(null);
  let recurrence = $state('');
  let selectedPriority = $state<Priority>('F'); // Default to Idea Pool
  let isExpanded = $state(false);
  let showSyntaxHint = $state(false);
  let hasStartedTyping = $state(false);

  // Priority options for selector (A-E have quotas, F is default Idea Pool)
  const priorityOptions: Priority[] = ['A', 'B', 'C', 'D', 'E', 'F'];

  const moodOptions = $derived([
    { value: '', label: t('taskForm.moodPlaceholder'), emoji: '' },
    { value: 'challenging', label: t('taskForm.moodOptions.challenging'), emoji: '🔥' },
    { value: 'focused', label: t('taskForm.moodOptions.focused'), emoji: '⚡' },
    { value: 'calm', label: t('taskForm.moodOptions.calm'), emoji: '😌' },
    { value: 'motivated', label: t('taskForm.moodOptions.motivated'), emoji: '💪' },
    { value: 'creative', label: t('taskForm.moodOptions.creative'), emoji: '🎨' },
    { value: 'routine', label: t('taskForm.moodOptions.routine'), emoji: '📋' },
  ]);

  const recurrenceOptions = $derived([
    { value: '', label: t('taskForm.noRecurrence') },
    { value: '1d', label: t('taskForm.daily') },
    { value: '2d', label: t('taskForm.every2Days') },
    { value: '3d', label: t('taskForm.every3Days') },
    { value: '1w', label: t('taskForm.weekly') },
    { value: '2w', label: t('taskForm.biweekly') },
    { value: '1m', label: t('taskForm.monthly') },
  ]);

  // Syntax patterns for highlighting
  const syntaxPatterns = $derived([
    { pattern: '!A-F', label: t('syntax.priority'), color: '#ff7b7b' },
    { pattern: '+', label: t('syntax.project'), color: '#9384bc' },
    { pattern: '@', label: t('syntax.context'), color: '#6b9cbc' },
    { pattern: '#', label: t('syntax.tag'), color: '#6ca88c' },
    { pattern: 'due:', label: t('syntax.dueDate'), color: '#d4a84a' },
    { pattern: 't:', label: t('syntax.threshold'), color: '#8a8a8a' },
  ]);

  function buildTaskString(): string {
    let parts: string[] = [content.trim()];

    if (project.trim()) {
      parts.push(`+${project.trim().replace(/\s+/g, '_')}`);
    }
    if (mood) {
      // Add mood as context with emoji
      const selectedMood = moodOptions.find(m => m.value === mood);
      if (selectedMood && selectedMood.value) {
        parts.push(`@${selectedMood.emoji}${selectedMood.value}`);
      }
    }
    if (tags.trim()) {
      tags.trim().split(/[,\s]+/).forEach(tag => {
        if (tag) parts.push(`#${tag}`);
      });
    }
    if (dueDate) {
      parts.push(`due:${dueDate}`);
    }
    if (thresholdDate) {
      parts.push(`t:${thresholdDate}`);
    }
    if (recurrence) {
      parts.push(`rec:${recurrence}`);
    }
    if (estimatedPomodoros && estimatedPomodoros > 0) {
      parts.push(`est:${estimatedPomodoros}`);
    }

    // Add selected priority
    parts.push(`!${selectedPriority}`);

    return parts.join(' ');
  }

  function handleSubmit() {
    if (!content.trim()) return;

    const taskString = buildTaskString();
    const result = addTask(taskString);

    if (result.success) {
      resetForm();
      showToast(t('message.taskAdded'), 'success');
      onSubmit?.();
    } else if (result.error) {
      showToast(result.error, 'error');
    }
  }

  function resetForm() {
    content = '';
    project = '';
    mood = '';
    tags = '';
    dueDate = '';
    thresholdDate = '';
    estimatedPomodoros = null;
    recurrence = '';
    selectedPriority = 'F';
    hasStartedTyping = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      isExpanded = false;
    }
  }

  function handleInputFocus() {
    showSyntaxHint = true;
  }

  function handleInputBlur() {
    // Delay to allow clicking on other fields
    setTimeout(() => {
      if (!content.trim()) {
        showSyntaxHint = false;
        hasStartedTyping = false;
      }
    }, 200);
  }

  function handleContentInput(e: Event) {
    const input = e.target as HTMLInputElement;
    content = input.value;
    if (input.value.trim().length > 0 && !hasStartedTyping) {
      hasStartedTyping = true;
      // Show expanded form after user starts typing
      isExpanded = true;
    }
  }

  // Detect syntax patterns being typed
  let detectedPatterns = $derived(
    syntaxPatterns.filter(p =>
      content.includes(p.pattern) ||
      (p.pattern === '!A-F' && /![A-Fa-f]/.test(content)) ||
      (p.pattern === '!A-F' && selectedPriority !== 'F') ||
      (p.pattern === '+' && project.trim()) ||
      (p.pattern === '@' && mood) ||
      (p.pattern === '#' && tags.trim()) ||
      (p.pattern === 'due:' && dueDate) ||
      (p.pattern === 't:' && thresholdDate)
    )
  );
</script>

<div class="task-form" class:expanded={isExpanded}>
  <div class="form-main">
    <div class="input-wrapper">
      <input
        type="text"
        class="content-input"
        value={content}
        oninput={handleContentInput}
        onkeydown={handleKeydown}
        onfocus={handleInputFocus}
        onblur={handleInputBlur}
        placeholder={t('taskForm.placeholder')}
      />

      <!-- Syntax Preview Tags -->
      {#if detectedPatterns.length > 0 && content.trim()}
        <div class="syntax-tags">
          {#each detectedPatterns as p}
            <span class="syntax-tag" style:background={p.color + '25'} style:color={p.color}>
              {p.pattern}
            </span>
          {/each}
        </div>
      {/if}
    </div>

    <button
      class="expand-btn"
      onclick={() => isExpanded = !isExpanded}
      title={isExpanded ? t('action.close') : t('action.expand')}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class:rotated={isExpanded}>
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    </button>

    <button
      class="submit-btn"
      onclick={handleSubmit}
      disabled={!content.trim()}
      title={t('taskForm.addToInbox')}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 5v14M5 12h14"></path>
      </svg>
    </button>
  </div>

  <!-- Syntax Hint Bar -->
  {#if showSyntaxHint && !isExpanded}
    <div class="syntax-hint-bar">
      <span class="hint-label">{t('syntax.title')}:</span>
      <div class="hint-items">
        {#each syntaxPatterns as hint}
          <span class="hint-item" style:color={hint.color}>
            <code>{hint.pattern}</code>
            <span class="hint-desc">{hint.label}</span>
          </span>
        {/each}
      </div>
    </div>
  {/if}

  {#if isExpanded}
    <div class="form-details">
      <div class="form-row">
        <!-- Project & Context -->
        <div class="field-group">
          <label class="field-label">
            <span class="label-icon" style:color="#b197fc">+</span>
            {t('taskForm.project')}
          </label>
          <input
            type="text"
            class="field-input"
            bind:value={project}
            placeholder={t('taskForm.projectPlaceholder')}
          />
        </div>

        <div class="field-group">
          <label class="field-label">
            <span class="label-icon" style:color="#74c0fc">@</span>
            {t('taskForm.mood')}
          </label>
          <select class="field-input mood-select" bind:value={mood}>
            {#each moodOptions as option}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
        </div>

        <div class="field-group">
          <label class="field-label">
            <span class="label-icon" style:color="#63e6be">#</span>
            {t('taskForm.tags')}
          </label>
          <input
            type="text"
            class="field-input"
            bind:value={tags}
            placeholder={t('taskForm.tagsPlaceholder')}
          />
        </div>
      </div>

      <div class="form-row">
        <!-- Dates & Pomodoro -->
        <div class="field-group">
          <label class="field-label">
            <span class="label-icon">📅</span>
            {t('taskForm.dueDate')}
          </label>
          <input
            type="date"
            class="field-input"
            bind:value={dueDate}
          />
        </div>

        <div class="field-group">
          <label class="field-label">
            <span class="label-icon">⏳</span>
            {t('taskForm.thresholdDate')}
          </label>
          <input
            type="date"
            class="field-input"
            bind:value={thresholdDate}
            title={t('taskForm.thresholdHint')}
          />
        </div>

        <div class="field-group pomodoro-input">
          <label class="field-label pomodoro-label">
            <span class="label-icon">🍅</span>
          </label>
          <input
            type="number"
            class="field-input"
            bind:value={estimatedPomodoros}
            min="1"
            max="20"
            placeholder="0"
          />
        </div>

        <div class="field-group recurrence-input">
          <label class="field-label">
            <span class="label-icon">🔄</span>
            {t('taskForm.recurrence')}
          </label>
          <select class="field-input" bind:value={recurrence}>
            {#each recurrenceOptions as option}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
        </div>
      </div>

      <!-- Priority Selector -->
      <div class="form-row priority-row">
        <div class="field-group priority-selector">
          <label class="field-label">
            <span class="label-icon">🎯</span>
            {t('syntax.priority')}
          </label>
          <div class="priority-buttons">
            {#each priorityOptions as p}
              <button
                type="button"
                class="priority-btn"
                class:selected={selectedPriority === p}
                style:--btn-color={PRIORITY_CONFIG[p].color}
                onclick={() => selectedPriority = p}
                title={PRIORITY_CONFIG[p].description}
              >
                <span class="priority-letter">{p}</span>
                <span class="priority-name">{PRIORITY_CONFIG[p].name}</span>
              </button>
            {/each}
          </div>
        </div>
      </div>

      <div class="form-footer">
        <span class="keyboard-hint">
          <kbd>Ctrl</kbd>+<kbd>Enter</kbd> {t('taskForm.keyboardHint').replace('按 Ctrl+Enter', '').replace('Press Ctrl+Enter to', '')}
        </span>
        <span class="destination-hint">
          → {PRIORITY_CONFIG[selectedPriority].name}
        </span>
      </div>
    </div>
  {/if}
</div>

<style>
  .task-form {
    background: var(--card-bg);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    transition: all var(--transition-normal);
    overflow: hidden;
  }

  .task-form.expanded {
    border-color: var(--primary);
    box-shadow: 0 0 0 2px var(--primary-bg);
  }

  .form-main {
    display: flex;
    gap: 8px;
    padding: 12px 14px;
    align-items: center;
  }

  .input-wrapper {
    flex: 1;
    position: relative;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .content-input {
    flex: 1;
    padding: 10px 12px;
    font-size: 14px;
    font-weight: 450;
    background: transparent;
    border: none;
    color: var(--text-primary);
    outline: none;
  }

  .content-input::placeholder {
    color: var(--text-muted);
    font-size: 14px;
  }

  .syntax-tags {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }

  .syntax-tag {
    padding: 2px 6px;
    font-size: 10px;
    font-weight: 600;
    border-radius: var(--radius-sm);
  }

  .expand-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    transition: all var(--transition-fast);
    flex-shrink: 0;
  }

  .expand-btn:hover {
    background: var(--hover-bg);
    color: var(--text-secondary);
  }

  .expand-btn svg {
    width: 18px;
    height: 18px;
    transition: transform var(--transition-fast);
  }

  .expand-btn svg.rotated {
    transform: rotate(180deg);
  }

  .submit-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: none;
    border-radius: var(--radius-md);
    background: var(--primary);
    color: white;
    cursor: pointer;
    transition: all var(--transition-fast);
    flex-shrink: 0;
  }

  .submit-btn:hover:not(:disabled) {
    background: var(--primary-hover);
    transform: scale(1.05);
  }

  .submit-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .submit-btn svg {
    width: 18px;
    height: 18px;
  }

  /* Syntax Hint Bar */
  .syntax-hint-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 14px;
    background: var(--bg-secondary);
    border-top: 1px solid var(--border-subtle);
    overflow-x: auto;
  }

  .hint-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .hint-items {
    display: flex;
    gap: 12px;
  }

  .hint-item {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    white-space: nowrap;
  }

  .hint-item code {
    font-family: inherit;
    font-weight: 600;
  }

  .hint-desc {
    color: var(--text-muted);
    font-weight: 400;
  }

  /* Form Details */
  .form-details {
    padding: 14px;
    border-top: 1px solid var(--border-subtle);
    background: var(--bg-secondary);
    animation: slideDown 0.15s ease-out;
  }

  .form-row {
    display: flex;
    gap: 12px;
    margin-bottom: 12px;
    flex-wrap: wrap;
  }

  .form-row:last-of-type {
    margin-bottom: 0;
  }

  .field-group {
    flex: 1;
    min-width: 140px;
  }

  .field-group.pomodoro-input {
    flex: 0 0 70px;
    min-width: 70px;
  }

  .field-group.recurrence-input {
    flex: 0 0 140px;
    min-width: 140px;
  }

  .pomodoro-label {
    justify-content: center;
  }

  .mood-select {
    cursor: pointer;
  }

  .field-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-secondary);
    margin-bottom: 6px;
  }

  .label-icon {
    font-size: 12px;
  }

  .field-input {
    width: 100%;
    height: 36px; /* Explicit height for consistency */
    padding: 0 10px;
    font-size: 13px;
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    outline: none;
    transition: all var(--transition-fast);
    box-sizing: border-box; /* Ensure padding doesn't affect width/height */
  }

  /* Specific fix for file input type date which might behave differently */
  input[type="date"].field-input {
    padding-top: 0;
    padding-bottom: 0;
    line-height: 34px;
  }

  .field-input:focus {
    border-color: var(--primary);
    box-shadow: 0 0 0 2px var(--primary-bg);
  }

  .field-input::placeholder {
    color: var(--text-muted);
  }

  select.field-input {
    cursor: pointer;
  }

  .form-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 14px;
    padding-top: 12px;
    border-top: 1px solid var(--border-subtle);
  }

  .keyboard-hint {
    font-size: 11px;
    color: var(--text-muted);
  }

  .keyboard-hint kbd {
    display: inline-block;
    padding: 2px 5px;
    font-family: inherit;
    font-size: 10px;
    font-weight: 600;
    background: var(--hover-bg);
    border: 1px solid var(--border-color);
    border-radius: 3px;
    margin: 0 2px;
  }

  .destination-hint {
    font-size: 11px;
    color: var(--text-muted);
    font-weight: 500;
  }

  /* Priority Selector */
  .priority-row {
    margin-bottom: 12px;
  }

  .priority-selector {
    flex: 1;
    min-width: 100%;
  }

  .priority-buttons {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .priority-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 8px 12px;
    min-width: 60px;
    border: 2px solid var(--border-color);
    border-radius: var(--radius-md);
    background: var(--card-bg);
    color: var(--text-secondary);
    cursor: pointer;
    transition: all var(--transition-fast);
    gap: 2px;
  }

  .priority-btn:hover {
    border-color: var(--btn-color);
    background: var(--hover-bg);
  }

  .priority-btn.selected {
    border-color: var(--btn-color);
    background: var(--btn-color);
    color: white;
  }

  .priority-letter {
    font-size: 14px;
    font-weight: 700;
  }

  .priority-name {
    font-size: 10px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 60px;
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

  @media (max-width: 600px) {
    .form-row {
      flex-direction: column;
      gap: 10px;
    }

    .field-group,
    .field-group.small {
      flex: none;
      min-width: 100%;
    }

    .syntax-hint-bar {
      display: none;
    }
  }
</style>
