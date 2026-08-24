<script lang="ts">
  import type { Priority, TaskOrigin } from '$lib/types';
  import { PRIORITY_CONFIG, ACTIVE_PRIORITIES, DEFAULT_PRIORITY } from '$lib/types';
  import { getTasksStore, loadCandidates, pullCandidate, exportPendingTasks, type Candidate } from '$lib/stores/tasks.svelte';
  import { showToast } from '$lib/stores/ui.svelte';
  import { suggestPriority } from '$lib/utils/quota';
  import { getI18nStore } from '$lib/i18n';

  interface Props {
    onClose?: () => void;
  }

  let { onClose }: Props = $props();

  const tasks = getTasksStore();
  const i18n = getI18nStore();
  const t = i18n.t;

  let candidates = $state<Candidate[]>([]);
  let alreadyPulled = $state(0);
  let loadError = $state<string | null>(null);
  let isLoading = $state(false);
  let includeHidden = $state(false);
  let search = $state('');

  // Defaults for the next pull. Origin defaults to "self" so the common case is
  // a single click; only work that was handed to you needs the other button.
  let origin = $state<TaskOrigin>('self');

  const suggested = $derived(suggestPriority(tasks.tasks) ?? DEFAULT_PRIORITY);
  const unitIsFull = $derived(suggestPriority(tasks.tasks) === null);

  const visible = $derived.by(() => {
    const query = search.trim().toLowerCase();
    if (!query) return candidates;
    return candidates.filter(c => c.task.content.toLowerCase().includes(query));
  });

  async function refresh() {
    isLoading = true;
    const result = await loadCandidates(includeHidden);
    candidates = result.candidates;
    alreadyPulled = result.alreadyPulled;
    loadError = result.error ?? null;
    isLoading = false;
  }

  $effect(() => {
    // Re-read whenever the configured file or the hidden toggle changes.
    void tasks.settings.todoFilePath;
    void includeHidden;
    refresh();
  });

  async function handlePull(candidate: Candidate, priority: Priority) {
    const result = await pullCandidate(candidate, priority, origin);
    if (!result.success) {
      showToast(result.error ?? t('inbox.pullFailed'), 'error');
      return;
    }

    if (result.evicted) {
      showToast(t('message.returnedToPool', { name: result.evicted.name }), 'info', 5000);
    } else if (result.demoted) {
      showToast(t('message.demotedTo', { name: result.demoted.name, priority: result.demoted.to }), 'info');
    }

    candidates = candidates.filter(c => c.raw !== candidate.raw);
    alreadyPulled += 1;
  }

  async function handleExportPending() {
    const result = await exportPendingTasks();
    if (result.error) {
      showToast(result.error, 'error');
      return;
    }
    showToast(t('inbox.exported', { count: result.exported }), 'success');
    refresh();
  }
</script>

<div class="inbox-panel">
  <header class="inbox-header">
    <div class="inbox-title">
      <h2>{t('inbox.title')}</h2>
      <span class="inbox-subtitle">{t('inbox.subtitle')}</span>
    </div>
    {#if onClose}
      <button class="close-btn" onclick={onClose} aria-label={t('action.close')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    {/if}
  </header>

  {#if tasks.pendingExport.length > 0}
    <!-- Tasks the 4.0 -> 5.0 migration parked because no todo.txt was
         configured yet. They stay in active.json until this succeeds. -->
    <div class="pending-banner">
      <span>{t('inbox.pendingExport', { count: tasks.pendingExport.length })}</span>
      <button class="pending-btn" onclick={handleExportPending} disabled={!tasks.settings.todoFilePath}>
        {t('inbox.exportNow')}
      </button>
    </div>
  {/if}

  {#if !tasks.settings.todoFilePath}
    <div class="empty-state">
      <p>{t('inbox.noFileConfigured')}</p>
      <p class="empty-hint">{t('inbox.configureHint')}</p>
    </div>
  {:else}
    <div class="inbox-controls">
      <input
        type="search"
        class="inbox-search"
        placeholder={t('inbox.searchPlaceholder')}
        bind:value={search}
      />

      <div class="origin-toggle" role="group" aria-label={t('origin.label')}>
        <button
          class="origin-btn"
          class:selected={origin === 'self'}
          onclick={() => (origin = 'self')}
          title={t('origin.selfHint')}
        >
          {t('origin.self')}
        </button>
        <button
          class="origin-btn"
          class:selected={origin === 'assigned'}
          onclick={() => (origin = 'assigned')}
          title={t('origin.assignedHint')}
        >
          {t('origin.assigned')}
        </button>
      </div>

      <label class="hidden-toggle">
        <input type="checkbox" bind:checked={includeHidden} />
        {t('inbox.includeHidden')}
      </label>

      <button class="refresh-btn" onclick={refresh} disabled={isLoading} title={t('inbox.refresh')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="23 4 23 10 17 10"></polyline>
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
        </svg>
      </button>
    </div>

    {#if loadError}
      <div class="empty-state error">{loadError}</div>
    {:else if unitIsFull}
      <div class="empty-state">
        <p>{t('inbox.unitFull')}</p>
        <p class="empty-hint">{t('inbox.unitFullHint')}</p>
      </div>
    {:else if visible.length === 0}
      <div class="empty-state">
        <p>{isLoading ? t('app.loading') : t('inbox.empty')}</p>
        {#if alreadyPulled > 0}
          <p class="empty-hint">{t('inbox.alreadyPulled', { count: alreadyPulled })}</p>
        {/if}
      </div>
    {:else}
      <ul class="candidate-list">
        {#each visible as candidate (candidate.raw)}
          <li class="candidate" class:hidden-line={candidate.hidden}>
            <div class="candidate-body">
              <span class="candidate-text">{candidate.task.content}</span>
              <div class="candidate-meta">
                {#each candidate.task.projects as project}
                  <span class="meta-chip project">+{project}</span>
                {/each}
                {#each candidate.task.contexts as context}
                  <span class="meta-chip context">@{context}</span>
                {/each}
                {#if candidate.task.dueDate}
                  <span class="meta-chip due">{candidate.task.dueDate}</span>
                {/if}
                {#if candidate.task.pomodoros.estimated > 0}
                  <span class="meta-chip pomodoro">🍅{candidate.task.pomodoros.estimated}</span>
                {/if}
                {#if candidate.hidden}
                  <span class="meta-chip hidden-chip">h:1</span>
                {/if}
              </div>
            </div>

            <div class="candidate-actions">
              {#each ACTIVE_PRIORITIES as priority}
                <button
                  class="pull-btn"
                  class:suggested={priority === suggested}
                  style:--btn-color={PRIORITY_CONFIG[priority].color}
                  onclick={() => handlePull(candidate, priority)}
                  title={t('inbox.pullInto', { priority, name: t(`priority.${priority}`) })}
                >
                  {priority}
                </button>
              {/each}
            </div>
          </li>
        {/each}
      </ul>

      {#if alreadyPulled > 0}
        <footer class="inbox-footer">{t('inbox.alreadyPulled', { count: alreadyPulled })}</footer>
      {/if}
    {/if}
  {/if}
</div>

<style>
  .inbox-panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
    height: 100%;
    min-height: 0;
    padding: 16px;
  }

  .inbox-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  .inbox-title h2 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .inbox-subtitle {
    font-size: 12px;
    color: var(--text-muted);
  }

  .close-btn {
    display: flex;
    padding: 6px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
  }

  .close-btn:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .close-btn svg {
    width: 16px;
    height: 16px;
  }

  .pending-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 12px;
    border: 1px solid var(--priority-b-border, rgba(255, 146, 43, 0.25));
    border-radius: 8px;
    background: var(--priority-b-bg, rgba(255, 146, 43, 0.12));
    font-size: 12px;
    color: var(--text-primary);
  }

  .pending-btn {
    flex-shrink: 0;
    padding: 4px 10px;
    border: none;
    border-radius: 6px;
    background: var(--priority-b-color, #ff922b);
    color: #fff;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }

  .pending-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .inbox-controls {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .inbox-search {
    flex: 1;
    min-width: 140px;
    padding: 6px 10px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 13px;
  }

  .origin-toggle {
    display: flex;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    overflow: hidden;
  }

  .origin-btn {
    padding: 5px 10px;
    border: none;
    background: var(--bg-secondary);
    color: var(--text-muted);
    font-size: 12px;
    cursor: pointer;
  }

  .origin-btn.selected {
    background: var(--primary);
    color: #fff;
  }

  .hidden-toggle {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: var(--text-muted);
    cursor: pointer;
  }

  .refresh-btn {
    display: flex;
    padding: 6px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-secondary);
    color: var(--text-muted);
    cursor: pointer;
  }

  .refresh-btn svg {
    width: 14px;
    height: 14px;
  }

  .empty-state {
    padding: 24px 12px;
    text-align: center;
    color: var(--text-muted);
    font-size: 13px;
  }

  .empty-state p {
    margin: 0 0 6px;
  }

  .empty-state.error {
    color: var(--danger, #ff6b6b);
  }

  .empty-hint {
    font-size: 12px;
    opacity: 0.8;
  }

  .candidate-list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .candidate {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 10px;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    background: var(--card-bg);
  }

  .candidate.hidden-line {
    opacity: 0.65;
    border-style: dashed;
  }

  .candidate-body {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .candidate-text {
    font-size: 13px;
    color: var(--text-primary);
    overflow-wrap: anywhere;
  }

  .candidate-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .meta-chip {
    padding: 1px 5px;
    border-radius: 4px;
    background: var(--bg-tertiary);
    font-size: 10px;
    color: var(--text-muted);
    font-family: var(--font-mono);
  }

  .meta-chip.project {
    color: #b197fc;
  }

  .meta-chip.context {
    color: #74c0fc;
  }

  .candidate-actions {
    display: flex;
    gap: 3px;
    flex-shrink: 0;
  }

  .pull-btn {
    width: 24px;
    height: 24px;
    border: 1px solid transparent;
    border-radius: 5px;
    background: var(--bg-tertiary);
    color: var(--text-muted);
    font-size: 11px;
    font-weight: 700;
    font-family: var(--font-mono);
    cursor: pointer;
    transition: background 0.12s ease, color 0.12s ease;
  }

  .pull-btn:hover {
    background: var(--btn-color);
    color: #fff;
  }

  .pull-btn.suggested {
    border-color: var(--btn-color);
    color: var(--btn-color);
  }

  .inbox-footer {
    font-size: 11px;
    color: var(--text-muted);
    text-align: center;
  }
</style>
