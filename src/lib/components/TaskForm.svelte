<script lang="ts">
  import type { Priority } from '$lib/types';
  import { PRIORITY_CONFIG } from '$lib/types';
  import { addTask } from '$lib/stores/tasks.svelte';
  import { showToast } from '$lib/stores/ui.svelte';
  import { t } from '$lib/i18n';

  interface Props {
    onSubmit?: () => void;
  }

  let { onSubmit }: Props = $props();

  let content = $state('');
  let project = $state('');
  let context = $state('');
  let tags = $state('');
  let dueDate = $state('');
  let thresholdDate = $state('');
  let estimatedPomodoros = $state<number | null>(null);
  let recurrence = $state('');
  let isExpanded = $state(false);
  let showSyntaxHint = $state(false);

  const recurrenceOptions = [
    { value: '', label: t('taskForm.noRecurrence') },
    { value: '1d', label: t('taskForm.daily') },
    { value: '2d', label: t('taskForm.every2Days') },
    { value: '3d', label: t('taskForm.every3Days') },
    { value: '1w', label: t('taskForm.weekly') },
    { value: '2w', label: t('taskForm.biweekly') },
    { value: '1m', label: t('taskForm.monthly') },
  ];

  // Syntax patterns for highlighting
  const syntaxPatterns = [
    { pattern: '+', label: t('syntax.project'), color: '#b197fc' },
    { pattern: '@', label: t('syntax.context'), color: '#74c0fc' },
    { pattern: '#', label: t('syntax.tag'), color: '#63e6be' },
    { pattern: 'due:', label: t('syntax.dueDate'), color: '#fcc419' },
    { pattern: 't:', label: t('syntax.threshold'), color: '#a9a9a9' },
    { pattern: 'est:', label: t('syntax.pomodoro'), color: '#ff6b6b' },
  ];

  function buildTaskString(): string {
    let parts: string[] = [content.trim()];

    if (project.trim()) {
      parts.push(`+${project.trim().replace(/\s+/g, '_')}`);
    }
    if (context.trim()) {
      parts.push(`@${context.trim().replace(/\s+/g, '_')}`);
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

    // Always add to inbox (E priority)
    parts.push('!E');

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
    context = '';
    tags = '';
    dueDate = '';
    thresholdDate = '';
    estimatedPomodoros = null;
    recurrence = '';
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
    isExpanded = true;
    showSyntaxHint = true;
  }

  function handleInputBlur() {
    // Delay to allow clicking on syntax hints
    setTimeout(() => {
      if (!content.trim()) {
        showSyntaxHint = false;
      }
    }, 200);
  }

  // Detect syntax patterns being typed
  let detectedPatterns = $derived(
    syntaxPatterns.filter(p =>
      content.includes(p.pattern) ||
      (p.pattern === '+' && project.trim()) ||
      (p.pattern === '@' && context.trim()) ||
      (p.pattern === '#' && tags.trim()) ||
      (p.pattern === 'due:' && dueDate) ||
      (p.pattern === 't:' && thresholdDate) ||
      (p.pattern === 'est:' && estimatedPomodoros)
    )
  );
</script>

<div class="task-form" class:expanded={isExpanded}>
  <div class="form-main">
    <div class="input-wrapper">
      <input
        type="text"
        class="content-input"
        bind:value={content}
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
            {t('taskForm.context')}
          </label>
          <input
            type="text"
            class="field-input"
            bind:value={context}
            placeholder={t('taskForm.contextPlaceholder')}
          />
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

        <div class="field-group small">
          <label class="field-label">
            <span class="label-icon">🍅</span>
            Est.
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

        <div class="field-group">
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

      <div class="form-footer">
        <span class="keyboard-hint">
          <kbd>Ctrl</kbd>+<kbd>Enter</kbd> {t('taskForm.keyboardHint').replace('按 Ctrl+Enter', '').replace('Press Ctrl+Enter to', '')}
        </span>
        <span class="destination-hint">
          → {t('inbox.title')}
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

  .field-group.small {
    flex: 0 0 70px;
    min-width: 70px;
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
    padding: 9px 10px;
    font-size: 13px;
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    outline: none;
    transition: all var(--transition-fast);
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
