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
      placeholder={t('taskForm.placeholder')}
    />

    <button
      class="submit-btn"
      onclick={handleSubmit}
      disabled={!content.trim()}
      title={t('taskForm.addToInbox')}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 5v14M5 12h14"></path>
      </svg>
      <span class="btn-text">{t('taskForm.addToInbox')}</span>
    </button>
  </div>

  {#if isExpanded}
    <div class="form-details">
      <div class="form-row">
        <div class="form-field">
          <label class="field-label">
            <span class="label-icon project">+</span>
            {t('taskForm.project')}
          </label>
          <input
            type="text"
            class="field-input"
            bind:value={project}
            placeholder={t('taskForm.projectPlaceholder')}
          />
        </div>

        <div class="form-field">
          <label class="field-label">
            <span class="label-icon context">@</span>
            {t('taskForm.context')}
          </label>
          <input
            type="text"
            class="field-input"
            bind:value={context}
            placeholder={t('taskForm.contextPlaceholder')}
          />
        </div>
      </div>

      <div class="form-row">
        <div class="form-field">
          <label class="field-label">
            <span class="label-icon tag">#</span>
            {t('taskForm.tags')}
          </label>
          <input
            type="text"
            class="field-input"
            bind:value={tags}
            placeholder={t('taskForm.tagsPlaceholder')}
          />
        </div>

        <div class="form-field">
          <label class="field-label">
            <span class="label-icon pomodoro">🍅</span>
            {t('taskForm.estimatedPomodoros')}
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
      </div>

      <div class="form-row">
        <div class="form-field">
          <label class="field-label">
            <span class="label-icon due">📅</span>
            {t('taskForm.dueDate')}
          </label>
          <input
            type="date"
            class="field-input"
            bind:value={dueDate}
          />
        </div>

        <div class="form-field">
          <label class="field-label">
            <span class="label-icon threshold">💤</span>
            {t('taskForm.thresholdDate')}
          </label>
          <input
            type="date"
            class="field-input"
            bind:value={thresholdDate}
          />
        </div>
      </div>

      <div class="form-row">
        <div class="form-field full">
          <label class="field-label">
            <span class="label-icon recurrence">🔁</span>
            {t('taskForm.recurrence')}
          </label>
          <select class="field-input" bind:value={recurrence}>
            {#each recurrenceOptions as option}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
        </div>
      </div>

      <div class="form-actions">
        <button class="action-btn secondary" onclick={() => { resetForm(); isExpanded = false; }}>
          {t('action.cancel')}
        </button>
        <span class="keyboard-hint">
          {t('taskForm.keyboardHint')}
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
  }

  .task-form.expanded {
    border-color: var(--primary);
    box-shadow: 0 0 0 3px var(--primary-bg), var(--shadow-md);
  }

  .form-main {
    display: flex;
    gap: 12px;
    padding: 16px;
  }

  .content-input {
    flex: 1;
    padding: 14px 16px;
    font-size: 15px;
    font-weight: 450;
    background: var(--input-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    color: var(--text-primary);
    outline: none;
    transition: all var(--transition-fast);
  }

  .content-input:focus {
    border-color: var(--primary);
    background: var(--bg-secondary);
  }

  .content-input::placeholder {
    color: var(--text-muted);
  }

  .submit-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 20px;
    border: none;
    border-radius: var(--radius-md);
    background: var(--primary);
    color: white;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: all var(--transition-fast);
    white-space: nowrap;
  }

  .submit-btn:hover:not(:disabled) {
    background: var(--primary-hover);
    transform: translateY(-1px);
    box-shadow: var(--shadow-glow);
  }

  .submit-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .submit-btn svg {
    width: 18px;
    height: 18px;
  }

  .form-details {
    padding: 0 16px 16px;
    border-top: 1px solid var(--border-subtle);
    animation: slideDown 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .form-row {
    display: flex;
    gap: 12px;
    margin-top: 12px;
  }

  .form-field {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .form-field.full {
    flex: none;
    width: 50%;
  }

  .field-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .label-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
  }

  .label-icon.project {
    background: rgba(177, 151, 252, 0.15);
    color: #b197fc;
  }

  .label-icon.context {
    background: rgba(116, 192, 252, 0.15);
    color: #74c0fc;
  }

  .label-icon.tag {
    background: rgba(99, 230, 190, 0.15);
    color: #63e6be;
  }

  .label-icon.due {
    font-size: 12px;
  }

  .label-icon.threshold {
    font-size: 12px;
  }

  .label-icon.pomodoro {
    font-size: 12px;
  }

  .label-icon.recurrence {
    font-size: 12px;
  }

  .field-input {
    padding: 10px 12px;
    font-size: 13px;
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

  select.field-input {
    cursor: pointer;
  }

  .form-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 16px;
    padding-top: 12px;
    border-top: 1px solid var(--border-subtle);
  }

  .action-btn {
    padding: 8px 16px;
    border-radius: var(--radius-sm);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .action-btn.secondary {
    background: transparent;
    border: 1px solid var(--border-color);
    color: var(--text-secondary);
  }

  .action-btn.secondary:hover {
    background: var(--hover-bg);
    color: var(--text-primary);
  }

  .keyboard-hint {
    font-size: 11px;
    color: var(--text-muted);
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (max-width: 768px) {
    .form-row {
      flex-direction: column;
    }

    .form-field.full {
      width: 100%;
    }

    .submit-btn .btn-text {
      display: none;
    }

    .submit-btn {
      padding: 12px;
    }
  }
</style>
