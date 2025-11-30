<script lang="ts">
  import type { Priority } from '$lib/types';
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

  const recurrenceOptions = [
    { value: '', label: t('taskForm.noRecurrence') },
    { value: '1d', label: t('taskForm.daily') },
    { value: '2d', label: t('taskForm.every2Days') },
    { value: '3d', label: t('taskForm.every3Days') },
    { value: '1w', label: t('taskForm.weekly') },
    { value: '2w', label: t('taskForm.biweekly') },
    { value: '1m', label: t('taskForm.monthly') },
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
  }
</script>

<div class="task-form" class:expanded={isExpanded}>
  <div class="form-main">
    <input
      type="text"
      class="content-input"
      bind:value={content}
      onkeydown={handleKeydown}
      onfocus={() => isExpanded = true}
      placeholder={isExpanded ? t('taskForm.placeholder') : `${t('taskForm.placeholder')} (+project @context #tag due:date est:4)`}
    />

    <button
      class="expand-btn"
      onclick={() => isExpanded = !isExpanded}
      title={isExpanded ? t('action.close') : 'More options'}
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

  {#if isExpanded}
    <div class="form-details">
      <div class="form-grid">
        <div class="form-field">
          <input
            type="text"
            class="field-input"
            bind:value={project}
            placeholder="+project"
          />
        </div>

        <div class="form-field">
          <input
            type="text"
            class="field-input"
            bind:value={context}
            placeholder="@context"
          />
        </div>

        <div class="form-field">
          <input
            type="text"
            class="field-input"
            bind:value={tags}
            placeholder="#tags"
          />
        </div>

        <div class="form-field">
          <input
            type="number"
            class="field-input pomodoro-input"
            bind:value={estimatedPomodoros}
            min="1"
            max="20"
            placeholder="🍅"
          />
        </div>

        <div class="form-field">
          <input
            type="date"
            class="field-input"
            bind:value={dueDate}
            title={t('taskForm.dueDate')}
          />
        </div>

        <div class="form-field">
          <input
            type="date"
            class="field-input"
            bind:value={thresholdDate}
            title={t('taskForm.thresholdDate')}
          />
        </div>

        <div class="form-field">
          <select class="field-input" bind:value={recurrence} title={t('taskForm.recurrence')}>
            {#each recurrenceOptions as option}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
        </div>
      </div>

      <div class="form-hint">
        <span class="hint-text">Ctrl+Enter</span>
      </div>
    </div>
  {/if}
</div>

<style>
  .task-form {
    background: var(--card-bg);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    transition: all var(--transition-normal);
  }

  .task-form.expanded {
    border-color: var(--primary);
    box-shadow: 0 0 0 2px var(--primary-bg);
  }

  .form-main {
    display: flex;
    gap: 8px;
    padding: 10px 12px;
    align-items: center;
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
    font-size: 13px;
  }

  .expand-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .expand-btn:hover {
    background: var(--hover-bg);
    color: var(--text-secondary);
  }

  .expand-btn svg {
    width: 16px;
    height: 16px;
    transition: transform var(--transition-fast);
  }

  .expand-btn svg.rotated {
    transform: rotate(180deg);
  }

  .submit-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    border-radius: var(--radius-sm);
    background: var(--primary);
    color: white;
    cursor: pointer;
    transition: all var(--transition-fast);
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
    width: 16px;
    height: 16px;
  }

  .form-details {
    padding: 8px 12px 12px;
    border-top: 1px solid var(--border-subtle);
    animation: slideDown 0.15s ease-out;
  }

  .form-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .form-field {
    flex: 1;
    min-width: 100px;
  }

  .field-input {
    width: 100%;
    padding: 8px 10px;
    font-size: 12px;
    background: var(--input-bg);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    outline: none;
    transition: all var(--transition-fast);
  }

  .field-input:focus {
    border-color: var(--primary);
  }

  .field-input::placeholder {
    color: var(--text-muted);
  }

  .field-input.pomodoro-input {
    max-width: 60px;
  }

  select.field-input {
    cursor: pointer;
    min-width: 100px;
  }

  .form-hint {
    display: flex;
    justify-content: flex-end;
    margin-top: 8px;
  }

  .hint-text {
    font-size: 10px;
    color: var(--text-muted);
    padding: 2px 6px;
    background: var(--hover-bg);
    border-radius: var(--radius-sm);
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
    .form-grid {
      flex-direction: column;
    }

    .field-input.pomodoro-input {
      max-width: 100%;
    }
  }
</style>
