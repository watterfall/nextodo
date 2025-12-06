<script lang="ts">
  import type { Task, Priority } from '$lib/types';
  import { PRIORITY_CONFIG } from '$lib/types';
  import { updateTask, getTasksStore, needsPriorityChangeConfirmation, changePriority } from '$lib/stores/tasks.svelte';
  import { closeEditModal, showToast, showConfirmation } from '$lib/stores/ui.svelte';
  import { getI18nStore } from '$lib/i18n';
  import { highlightSyntax } from '$lib/utils/parser';
  import { formatRecurrence } from '$lib/utils/recurrence';

  interface Props {
    task: Task;
  }

  let { task }: Props = $props();

  const i18n = getI18nStore();
  const t = i18n.t;
  const tasks = getTasksStore();

  // Track if we already confirmed a priority change (to avoid re-prompting)
  let priorityChangeConfirmed = $state(false);

  // Form state - initialized from task
  let content = $state(task.content);
  let selectedPriority = $state<Priority>(task.priority);
  let project = $state(task.projects.map(p => p.replace(/^\+/, '')).join(', '));
  let context = $state(task.contexts.map(c => c.replace(/^@/, '')).join(', '));
  let tags = $state(task.customTags.filter(t => !['⚡高能量', '😴低能量', '☕中等'].includes(t)).map(t => t.replace(/^#/, '')).join(', '));
  let dueDate = $state(task.dueDate || '');
  let thresholdDate = $state(task.thresholdDate || '');
  let estimatedPomodoros = $state<number>(task.pomodoros.estimated);
  let recurrence = $state(task.recurrence?.pattern || task.recurrence?.customPattern || '');

  // Extract unique existing projects, contexts, and tags for autocomplete
  const existingProjects = $derived([...new Set(tasks.tasks.flatMap(t => t.projects.map(p => p.replace(/^\+/, ''))))].sort());
  const existingTags = $derived([...new Set(tasks.tasks.flatMap(t => t.customTags.map(tag => tag.replace(/^#/, ''))))].sort());

  // Mood options
  const moodOptions = $derived([
    { value: '', label: t('taskForm.moodPlaceholder'), emoji: '' },
    { value: 'challenging', label: t('taskForm.moodOptions.challenging'), emoji: '🔥' },
    { value: 'focused', label: t('taskForm.moodOptions.focused'), emoji: '⚡' },
    { value: 'calm', label: t('taskForm.moodOptions.calm'), emoji: '😌' },
    { value: 'motivated', label: t('taskForm.moodOptions.motivated'), emoji: '💪' },
    { value: 'creative', label: t('taskForm.moodOptions.creative'), emoji: '🎨' },
    { value: 'routine', label: t('taskForm.moodOptions.routine'), emoji: '📋' },
    { value: 'tired', label: t('taskForm.moodOptions.tired') || '😴 疲惫', emoji: '😴' },
    { value: 'anxious', label: t('taskForm.moodOptions.anxious') || '😰 焦虑', emoji: '😰' },
    { value: 'excited', label: t('taskForm.moodOptions.excited') || '🤩 兴奋', emoji: '🤩' },
    { value: 'neutral', label: t('taskForm.moodOptions.neutral') || '😐 平淡', emoji: '😐' }
  ]);

  // Extract mood from context
  let mood = $state('');
  $effect(() => {
    // Try to find a mood in existing contexts
    const moodContext = task.contexts.find(c => {
      const val = c.replace(/^@/, '');
      // Check if it matches any mood value (with or without emoji)
      return moodOptions.some(m => m.value && val.includes(m.value));
    });
    
    if (moodContext) {
      // Extract the mood value
      const val = moodContext.replace(/^@/, '');
      const match = moodOptions.find(m => m.value && val.includes(m.value));
      if (match) {
        mood = match.value;
        // Remove mood from context text field to avoid duplication
        context = task.contexts
          .filter(c => c !== moodContext)
          .map(c => c.replace(/^@/, ''))
          .join(', ');
      }
    }
  });

  // Priority options
  const priorityOptions: Priority[] = ['A', 'B', 'C', 'D', 'E', 'F'];

  // Handle priority selection with confirmation check
  function handlePrioritySelect(newPriority: Priority) {
    // If priority is the same, just update
    if (newPriority === task.priority) {
      selectedPriority = newPriority;
      return;
    }

    // If already confirmed, allow change
    if (priorityChangeConfirmed) {
      selectedPriority = newPriority;
      return;
    }

    // Check if confirmation is needed
    const confirmCheck = needsPriorityChangeConfirmation(task, newPriority);
    if (confirmCheck.needsConfirmation) {
      showConfirmation({
        title: t('message.priorityChangeTitle') || 'Priority Change',
        message: confirmCheck.message || t('message.confirmPriorityChange'),
        confirmText: t('action.continueAnyway'),
        cancelText: t('action.cancel'),
        onConfirm: () => {
          priorityChangeConfirmed = true;
          selectedPriority = newPriority;
        }
      });
    } else {
      selectedPriority = newPriority;
    }
  }

  // Recurrence options
  const recurrenceOptions = $derived([
    { value: '', label: t('taskForm.noRecurrence') },
    { value: '1d', label: t('taskForm.daily') },
    { value: '2d', label: t('taskForm.every2Days') },
    { value: '3d', label: t('taskForm.every3Days') },
    { value: '1w', label: t('taskForm.weekly') },
    { value: '2w', label: t('taskForm.biweekly') },
    { value: '1m', label: t('taskForm.monthly') },
  ]);

  // Syntax preview
  const syntaxPreview = $derived.by(() => {
    let preview = content;
    if (project.trim()) {
      preview += ' +' + project.trim().split(/[,\s]+/).filter(Boolean).join(' +');
    }
    if (context.trim()) {
      preview += ' @' + context.trim().split(/[,\s]+/).filter(Boolean).join(' @');
    }
    if (tags.trim()) {
      preview += ' #' + tags.trim().split(/[,\s]+/).filter(Boolean).join(' #');
    }
    if (dueDate) {
      preview += ` ~${dueDate}`;
    }
    if (thresholdDate) {
      preview += ` thr:${thresholdDate}`;
    }
    if (estimatedPomodoros > 0) {
      preview += ` 🍅${estimatedPomodoros}`;
    }
    if (recurrence) {
      preview += ` rec:${recurrence}`;
    }
    preview += ` !${selectedPriority}`;
    return highlightSyntax(preview);
  });

  async function handleSave() {
    if (!content.trim()) {
      showToast(t('error.saveFailed'), 'error');
      return;
    }

    // Build updated task properties
    const projects = project.trim()
      ? project.trim().split(/[,\s]+/).filter(Boolean).map(p => '+' + p)
      : [];
    const contexts = context.trim()
      ? context.trim().split(/[,\s]+/).filter(Boolean).map(c => '@' + c)
      : [];
    
    // Add mood context if selected
    if (mood) {
      const selectedMood = moodOptions.find(m => m.value === mood);
      if (selectedMood && selectedMood.value) {
        // Check if already present (to avoid double add if user manually typed it back)
        const moodStr = '@' + selectedMood.emoji + selectedMood.value;
        const simpleMoodStr = '@' + selectedMood.value;
        if (!contexts.some(c => c.includes(selectedMood.value))) {
          contexts.push(moodStr);
        }
      }
    }

    // Preserve energy tags if they exist
    const existingEnergyTags = task.customTags.filter(t => ['⚡高能量', '😴低能量', '☕中等'].includes(t));
    const customTags = tags.trim()
      ? [...tags.trim().split(/[,\s]+/).filter(Boolean).map(t => '#' + t), ...existingEnergyTags]
      : existingEnergyTags;

    // Build recurrence object
    let recurrenceObj = null;
    if (recurrence) {
      const standardPatterns = ['1d', '2d', '3d', '1w', '2w', '1m', '3m'];
      if (standardPatterns.includes(recurrence)) {
        recurrenceObj = { pattern: recurrence as any, nextDue: null };
      } else {
        recurrenceObj = { pattern: null, customPattern: recurrence, nextDue: null };
      }
    }

    const updates: Partial<Task> = {
      content: content.trim(),
      priority: selectedPriority,
      projects,
      contexts,
      customTags,
      dueDate: dueDate || null,
      thresholdDate: thresholdDate || null,
      pomodoros: {
        ...task.pomodoros,
        estimated: estimatedPomodoros || 0
      },
      recurrence: recurrenceObj
    };

    await updateTask(task.id, updates);
    showToast(t('message.saved'), 'success');
    closeEditModal();
  }

  function handleCancel() {
    closeEditModal();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      handleCancel();
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSave();
    }
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      handleCancel();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="modal-overlay" onclick={handleBackdropClick}>
  <div class="modal-content">
    <div class="modal-header">
      <h2>{t('task.edit')}</h2>
      <button class="close-btn" onclick={handleCancel} aria-label={t('action.close')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>

    <div class="modal-body">
      <!-- Content Input -->
      <div class="field-group content-field">
        <label class="field-label">{t('task.add')}</label>
        <input
          type="text"
          class="field-input content-input"
          bind:value={content}
          placeholder={t('taskForm.placeholder')}
          autofocus
        />
      </div>

      <!-- Syntax Preview -->
      {#if content.trim()}
        <div class="syntax-preview">
          <span class="preview-label">{t('syntax.title')}:</span>
          <div class="preview-content">
            {@html syntaxPreview}
          </div>
        </div>
      {/if}

      <!-- Priority Selector -->
      <div class="field-group priority-group">
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
              onclick={() => handlePrioritySelect(p)}
              title={PRIORITY_CONFIG[p].description}
            >
              <span class="priority-letter">{p}</span>
              <span class="priority-name">{t(`priority.${p}`)}</span>
            </button>
          {/each}
        </div>
      </div>

      <div class="form-grid">
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
            list="edit-project-suggestions"
          />
          <datalist id="edit-project-suggestions">
            {#each existingProjects as p}
              <option value={p}></option>
            {/each}
          </datalist>
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
            list="edit-tag-suggestions"
          />
          <datalist id="edit-tag-suggestions">
            {#each existingTags as tag}
              <option value={tag}></option>
            {/each}
          </datalist>
        </div>
      </div>

      <div class="form-grid">
        <!-- Dates -->
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

        <!-- Pomodoro & Recurrence -->
        <div class="field-group pomodoro-field">
          <label class="field-label">
            <span class="label-icon">🍅</span>
            {t('syntax.pomodoro')}
          </label>
          <input
            type="number"
            class="field-input"
            bind:value={estimatedPomodoros}
            min="0"
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
    </div>

    <div class="modal-footer">
      <div class="footer-info">
        <kbd>Ctrl</kbd>+<kbd>Enter</kbd> {t('action.save')}
        <span class="separator">|</span>
        <kbd>Esc</kbd> {t('action.cancel')}
      </div>
      <div class="footer-actions">
        <button class="btn btn-secondary" onclick={handleCancel}>
          {t('action.cancel')}
        </button>
        <button class="btn btn-primary" onclick={handleSave} disabled={!content.trim()}>
          {t('action.save')}
        </button>
      </div>
    </div>
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 20px;
    animation: fadeIn 0.15s ease-out;
  }

  .modal-content {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    width: 100%;
    max-width: 600px;
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
    animation: slideUp 0.2s ease-out;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-subtle);
  }

  .modal-header h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .close-btn {
    width: 32px;
    height: 32px;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--transition-fast);
  }

  .close-btn:hover {
    background: var(--hover-bg);
    color: var(--text-primary);
  }

  .close-btn svg {
    width: 18px;
    height: 18px;
  }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .field-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .field-group.content-field {
    margin-bottom: 8px;
  }

  .field-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .label-icon {
    font-size: 13px;
  }

  .field-input {
    width: 100%;
    height: 40px;
    padding: 0 12px;
    font-size: 14px;
    background: var(--input-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    color: var(--text-primary);
    outline: none;
    transition: all var(--transition-fast);
  }

  .field-input:focus {
    border-color: var(--primary);
    box-shadow: 0 0 0 2px var(--primary-bg);
  }

  .content-input {
    height: 48px;
    font-size: 15px;
    font-weight: 500;
  }

  input[type="date"].field-input {
    padding-top: 0;
    padding-bottom: 0;
    line-height: 38px;
  }

  select.field-input {
    cursor: pointer;
  }

  .syntax-preview {
    padding: 12px 14px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    font-size: 13px;
  }

  .preview-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted);
    display: block;
    margin-bottom: 6px;
  }

  .preview-content {
    color: var(--text-secondary);
    word-break: break-word;
  }

  .preview-content :global(.syntax-priority) {
    color: var(--primary);
    font-weight: 600;
  }

  .preview-content :global(.syntax-project) {
    color: #b197fc;
    background: rgba(177, 151, 252, 0.1);
    padding: 1px 4px;
    border-radius: 3px;
  }

  .preview-content :global(.syntax-context) {
    color: #74c0fc;
    background: rgba(116, 192, 252, 0.1);
    padding: 1px 4px;
    border-radius: 3px;
  }

  .preview-content :global(.syntax-tag) {
    color: #63e6be;
    background: rgba(99, 230, 190, 0.1);
    padding: 1px 4px;
    border-radius: 3px;
  }

  .preview-content :global(.syntax-due) {
    color: #ffa94d;
    font-weight: 500;
  }

  .preview-content :global(.syntax-threshold) {
    color: #9775fa;
    font-weight: 500;
  }

  .preview-content :global(.syntax-recurrence) {
    color: #f783ac;
    font-weight: 500;
  }

  .preview-content :global(.syntax-pomodoro) {
    color: #ff8787;
    font-weight: 500;
  }

  .priority-group {
    margin-bottom: 8px;
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
    min-width: 65px;
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
    max-width: 65px;
  }

  .form-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 12px;
  }

  .pomodoro-field .field-input {
    width: 80px;
  }

  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 20px;
    border-top: 1px solid var(--border-subtle);
    background: var(--bg-secondary);
  }

  .footer-info {
    font-size: 11px;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .footer-info kbd {
    display: inline-block;
    padding: 2px 5px;
    font-family: inherit;
    font-size: 10px;
    font-weight: 600;
    background: var(--hover-bg);
    border: 1px solid var(--border-color);
    border-radius: 3px;
  }

  .separator {
    margin: 0 8px;
    color: var(--border-color);
  }

  .footer-actions {
    display: flex;
    gap: 8px;
  }

  .btn {
    padding: 8px 16px;
    font-size: 13px;
    font-weight: 500;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .btn-secondary {
    background: transparent;
    border: 1px solid var(--border-color);
    color: var(--text-secondary);
  }

  .btn-secondary:hover {
    background: var(--hover-bg);
    color: var(--text-primary);
  }

  .btn-primary {
    background: var(--primary);
    border: 1px solid var(--primary);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--primary-hover);
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (max-width: 500px) {
    .modal-content {
      max-height: 95vh;
    }

    .form-grid {
      grid-template-columns: 1fr;
    }

    .priority-buttons {
      flex-wrap: wrap;
    }

    .priority-btn {
      flex: 1;
      min-width: 45px;
    }

    .footer-info {
      display: none;
    }
  }
</style>
