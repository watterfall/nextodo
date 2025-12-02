<script lang="ts">
  import { getTasksStore, uncompleteTask, permanentlyDeleteTask } from '$lib/stores/tasks.svelte';
  import { getI18nStore } from '$lib/i18n';
  import TaskCard from './TaskCard.svelte';

  interface Props {
    onClose: () => void;
  }

  let { onClose }: Props = $props();

  const tasks = getTasksStore();
  const i18n = getI18nStore();

  let activeTab: 'completed' | 'cancelled' = $state('completed');

  function handleRestore(taskId: string) {
    uncompleteTask(taskId);
  }

  function handlePermanentDelete(taskId: string) {
    if (confirm(i18n.t('message.confirmPermanentDelete') || '确定要永久删除这个任务吗？此操作不可撤销。')) {
      permanentlyDeleteTask(taskId);
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onClose();
    }
  }

  // Format date for display
  function formatDate(dateStr: string | null): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString(i18n.language === 'zh-CN' ? 'zh-CN' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="modal-overlay" onclick={onClose}>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="modal-content" onclick={(e) => e.stopPropagation()}>
    <div class="modal-header">
      <h2>{i18n.t('history.title') || '任务历史'}</h2>
      <button class="close-btn" onclick={onClose}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>

    <div class="tabs">
      <button
        class="tab"
        class:active={activeTab === 'completed'}
        onclick={() => activeTab = 'completed'}
      >
        <span class="tab-icon">✓</span>
        <span>{i18n.t('history.completed') || '已完成'}</span>
        <span class="tab-count">{tasks.completedTasks.length}</span>
      </button>
      <button
        class="tab"
        class:active={activeTab === 'cancelled'}
        onclick={() => activeTab = 'cancelled'}
      >
        <span class="tab-icon">✕</span>
        <span>{i18n.t('history.cancelled') || '已取消'}</span>
        <span class="tab-count">{tasks.cancelledTasks.length}</span>
      </button>
    </div>

    <div class="modal-body">
      {#if activeTab === 'completed'}
        {#if tasks.completedTasks.length === 0}
          <div class="empty-state">
            <span class="empty-icon">✓</span>
            <p>{i18n.t('history.noCompleted') || '暂无已完成的任务'}</p>
          </div>
        {:else}
          <div class="task-list">
            {#each tasks.completedTasks as task (task.id)}
              <div class="task-item">
                <div class="task-info">
                  <TaskCard {task} compact />
                  <div class="task-meta">
                    {#if task.completedAt}
                      <span class="completed-date">
                        {i18n.t('history.completedAt') || '完成于'}: {formatDate(task.completedAt)}
                      </span>
                    {/if}
                  </div>
                </div>
                <div class="task-actions">
                  <button
                    class="action-btn restore"
                    onclick={() => handleRestore(task.id)}
                    title={i18n.t('action.restore') || '恢复'}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="1 4 1 10 7 10"></polyline>
                      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                    </svg>
                  </button>
                  <button
                    class="action-btn delete"
                    onclick={() => handlePermanentDelete(task.id)}
                    title={i18n.t('action.permanentDelete') || '永久删除'}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      {:else}
        {#if tasks.cancelledTasks.length === 0}
          <div class="empty-state">
            <span class="empty-icon">✕</span>
            <p>{i18n.t('history.noCancelled') || '暂无已取消的任务'}</p>
          </div>
        {:else}
          <div class="task-list">
            {#each tasks.cancelledTasks as task (task.id)}
              <div class="task-item">
                <div class="task-info">
                  <TaskCard {task} compact />
                  <div class="task-meta">
                    {#if task.completedAt}
                      <span class="cancelled-date">
                        {i18n.t('history.cancelledAt') || '取消于'}: {formatDate(task.completedAt)}
                      </span>
                    {/if}
                  </div>
                </div>
                <div class="task-actions">
                  <button
                    class="action-btn restore"
                    onclick={() => handleRestore(task.id)}
                    title={i18n.t('action.restore') || '恢复'}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="1 4 1 10 7 10"></polyline>
                      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                    </svg>
                  </button>
                  <button
                    class="action-btn delete"
                    onclick={() => handlePermanentDelete(task.id)}
                    title={i18n.t('action.permanentDelete') || '永久删除'}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      {/if}
    </div>
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(4px);
  }

  .modal-content {
    width: 90%;
    max-width: 600px;
    max-height: 80vh;
    background: var(--card-bg);
    border-radius: var(--radius-lg);
    display: flex;
    flex-direction: column;
    box-shadow: var(--shadow-xl);
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-subtle);
  }

  .modal-header h2 {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
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

  .tabs {
    display: flex;
    padding: 0 16px;
    border-bottom: 1px solid var(--border-subtle);
    background: var(--bg-secondary);
  }

  .tab {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 16px;
    border: none;
    background: transparent;
    color: var(--text-muted);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-fast);
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
  }

  .tab:hover {
    color: var(--text-primary);
    background: var(--hover-bg);
  }

  .tab.active {
    color: var(--primary);
    border-bottom-color: var(--primary);
  }

  .tab-icon {
    font-size: 14px;
  }

  .tab-count {
    font-size: 12px;
    padding: 2px 6px;
    background: var(--hover-bg);
    border-radius: var(--radius-sm);
    color: var(--text-muted);
  }

  .tab.active .tab-count {
    background: var(--primary-bg);
    color: var(--primary);
  }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 24px;
    color: var(--text-muted);
  }

  .empty-icon {
    font-size: 48px;
    opacity: 0.3;
    margin-bottom: 16px;
  }

  .empty-state p {
    margin: 0;
    font-size: 14px;
  }

  .task-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .task-item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 8px;
    background: var(--bg-secondary);
    border-radius: var(--radius-md);
  }

  .task-info {
    flex: 1;
    min-width: 0;
  }

  .task-meta {
    margin-top: 4px;
    padding-left: 28px;
  }

  .completed-date,
  .cancelled-date {
    font-size: 11px;
    color: var(--text-muted);
  }

  .task-actions {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }

  .action-btn {
    width: 28px;
    height: 28px;
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

  .action-btn:hover {
    background: var(--hover-bg);
    color: var(--text-primary);
  }

  .action-btn.restore:hover {
    color: var(--success);
    background: var(--success-bg);
  }

  .action-btn.delete:hover {
    color: var(--error);
    background: var(--error-bg);
  }

  .action-btn svg {
    width: 14px;
    height: 14px;
  }
</style>
