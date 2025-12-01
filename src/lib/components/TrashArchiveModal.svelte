<script lang="ts">
  import { getTasksStore, restoreFromTrash, emptyTrash } from '$lib/stores/tasks.svelte';
  import { fade, scale } from 'svelte/transition';
  import { getI18nStore } from '$lib/i18n';
  import type { Task } from '$lib/types';
  import { PRIORITY_CONFIG } from '$lib/types';

  interface Props {
    onClose: () => void;
  }

  let { onClose }: Props = $props();

  const tasks = getTasksStore();
  const i18n = getI18nStore();
  const t = i18n.t;

  // Tabs
  type TabType = 'trash' | 'completed' | 'archived';
  let activeTab = $state<TabType>('trash');

  // Get trash items with age calculation (with defensive null check)
  const trashItems = $derived.by(() => {
    const trash = tasks.trash ?? [];
    return trash.map(task => {
      const deletedAt = task.completedAt ? new Date(task.completedAt) : new Date(task.createdAt);
      const now = new Date();
      const ageInDays = Math.floor((now.getTime() - deletedAt.getTime()) / (1000 * 60 * 60 * 24));
      const daysRemaining = Math.max(0, 7 - ageInDays);
      return { ...task, ageInDays, daysRemaining };
    }).sort((a, b) => b.ageInDays - a.ageInDays);
  });

  // Get completed tasks (not yet archived)
  const completedItems = $derived.by(() => {
    const allTasks = tasks.tasks ?? [];
    return allTasks.filter(task => task.completed).sort((a, b) => {
      const dateA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const dateB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      return dateB - dateA;
    });
  });

  // Get archived tasks (with defensive null check)
  const archivedItems = $derived.by(() => {
    const archive = tasks.archive ?? [];
    return [...archive].sort((a, b) => {
      const dateA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const dateB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      return dateB - dateA;
    });
  });

  function handleRestore(taskId: string) {
    restoreFromTrash(taskId);
  }

  function handleEmptyTrash() {
    if (confirm(t('task.emptyTrashConfirm') || '确定要清空回收站吗？此操作不可撤销。')) {
      emptyTrash();
    }
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString();
  }

  function getPriorityColor(priority: string): string {
    return PRIORITY_CONFIG[priority as keyof typeof PRIORITY_CONFIG]?.color || 'var(--text-muted)';
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="modal-overlay"
  onclick={onClose}
  transition:fade={{ duration: 200 }}
  role="dialog"
  aria-modal="true"
  tabindex="-1"
>
  <div
    class="modal-content"
    onclick={(e) => e.stopPropagation()}
    transition:scale={{ start: 0.95, duration: 250 }}
  >
    <div class="modal-header">
      <h2>{t('nav.trash') || '回收站与归档'}</h2>
      <button class="close-btn" onclick={onClose}>×</button>
    </div>

    <!-- Tabs -->
    <div class="tabs">
      <button
        class="tab"
        class:active={activeTab === 'trash'}
        onclick={() => activeTab = 'trash'}
      >
        {t('nav.trash') || '回收站'}
        {#if trashItems.length > 0}
          <span class="tab-count">{trashItems.length}</span>
        {/if}
      </button>
      <button
        class="tab"
        class:active={activeTab === 'completed'}
        onclick={() => activeTab = 'completed'}
      >
        {t('filter.completed')}
        {#if completedItems.length > 0}
          <span class="tab-count">{completedItems.length}</span>
        {/if}
      </button>
      <button
        class="tab"
        class:active={activeTab === 'archived'}
        onclick={() => activeTab = 'archived'}
      >
        {t('nav.archive')}
        {#if archivedItems.length > 0}
          <span class="tab-count">{archivedItems.length}</span>
        {/if}
      </button>
    </div>

    <div class="modal-body">
      {#if activeTab === 'trash'}
        {#if trashItems.length > 0}
          <div class="info-bar">
            <span class="info-text">{t('trash.retentionInfo') || '回收站内容保留7天后自动删除'}</span>
            <button class="empty-btn" onclick={handleEmptyTrash}>
              {t('task.emptyTrash')}
            </button>
          </div>
          <div class="items-list">
            {#each trashItems as item (item.id)}
              <div class="item-card">
                <div class="item-main">
                  <span class="item-priority" style:color={getPriorityColor(item.priority)}>{item.priority}</span>
                  <span class="item-content">{item.content}</span>
                </div>
                <div class="item-meta">
                  <span class="days-remaining" class:urgent={item.daysRemaining <= 2}>
                    {item.daysRemaining > 0 ? `${item.daysRemaining}${t('settings.days') || '天'}` : t('trash.expiring') || '即将删除'}
                  </span>
                  <button class="restore-btn" onclick={() => handleRestore(item.id)}>
                    {t('task.restore')}
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <div class="empty-state">
            <span class="empty-icon">🗑️</span>
            <p>{t('trash.empty') || '回收站为空'}</p>
          </div>
        {/if}
      {:else if activeTab === 'completed'}
        {#if completedItems.length > 0}
          <div class="items-list">
            {#each completedItems as item (item.id)}
              <div class="item-card completed">
                <div class="item-main">
                  <span class="item-priority" style:color={getPriorityColor(item.priority)}>{item.priority}</span>
                  <span class="item-content">{item.content}</span>
                </div>
                <div class="item-meta">
                  <span class="completed-date">{formatDate(item.completedAt)}</span>
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <div class="empty-state">
            <span class="empty-icon">✅</span>
            <p>{t('completed.empty') || '暂无已完成任务'}</p>
          </div>
        {/if}
      {:else if activeTab === 'archived'}
        {#if archivedItems.length > 0}
          <div class="items-list">
            {#each archivedItems.slice(0, 50) as item (item.id)}
              <div class="item-card archived">
                <div class="item-main">
                  <span class="item-priority" style:color={getPriorityColor(item.priority)}>{item.priority}</span>
                  <span class="item-content">{item.content}</span>
                </div>
                <div class="item-meta">
                  <span class="completed-date">{formatDate(item.completedAt)}</span>
                </div>
              </div>
            {/each}
            {#if archivedItems.length > 50}
              <div class="more-hint">
                {t('archive.showingRecent') || `显示最近 50 条，共 ${archivedItems.length} 条`}
              </div>
            {/if}
          </div>
        {:else}
          <div class="empty-state">
            <span class="empty-icon">📦</span>
            <p>{t('archive.empty') || '暂无归档任务'}</p>
          </div>
        {/if}
      {/if}
    </div>
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal-content {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-xl);
    width: 90%;
    max-width: 600px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: var(--shadow-lg);
    overflow: hidden;
  }

  .modal-header {
    padding: 20px 24px;
    border-bottom: 1px solid var(--border-subtle);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .modal-header h2 {
    font-size: 20px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }

  .close-btn {
    font-size: 24px;
    color: var(--text-muted);
    background: transparent;
    border: none;
    cursor: pointer;
    line-height: 1;
    padding: 0;
  }

  .close-btn:hover {
    color: var(--text-primary);
  }

  .tabs {
    display: flex;
    gap: 4px;
    padding: 12px 24px;
    border-bottom: 1px solid var(--border-subtle);
    background: var(--bg-primary);
  }

  .tab {
    padding: 8px 16px;
    border: none;
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--text-muted);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .tab:hover {
    background: var(--hover-bg);
    color: var(--text-secondary);
  }

  .tab.active {
    background: var(--primary-bg);
    color: var(--primary);
  }

  .tab-count {
    padding: 2px 6px;
    font-size: 11px;
    background: var(--bg-secondary);
    border-radius: var(--radius-sm);
  }

  .tab.active .tab-count {
    background: var(--primary);
    color: white;
  }

  .modal-body {
    padding: 16px 24px 24px;
    overflow-y: auto;
    flex: 1;
  }

  .info-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    background: var(--bg-primary);
    border-radius: var(--radius-md);
    margin-bottom: 16px;
  }

  .info-text {
    font-size: 12px;
    color: var(--text-muted);
  }

  .empty-btn {
    padding: 6px 12px;
    border: none;
    border-radius: var(--radius-sm);
    background: rgba(var(--error-rgb, 255, 107, 107), 0.1);
    color: var(--error);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }

  .empty-btn:hover {
    background: rgba(var(--error-rgb, 255, 107, 107), 0.2);
  }

  .items-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .item-card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 14px;
    background: var(--card-bg);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    transition: all 0.15s;
  }

  .item-card:hover {
    border-color: var(--border-color);
  }

  .item-card.completed .item-content,
  .item-card.archived .item-content {
    text-decoration: line-through;
    opacity: 0.7;
  }

  .item-main {
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }

  .item-priority {
    font-size: 12px;
    font-weight: 700;
    flex-shrink: 0;
  }

  .item-content {
    flex: 1;
    font-size: 14px;
    color: var(--text-primary);
    line-height: 1.4;
  }

  .item-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding-left: 22px;
  }

  .days-remaining {
    font-size: 11px;
    color: var(--text-muted);
  }

  .days-remaining.urgent {
    color: var(--warning, #ffa94d);
    font-weight: 500;
  }

  .completed-date {
    font-size: 11px;
    color: var(--text-muted);
  }

  .restore-btn {
    padding: 4px 10px;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-secondary);
    font-size: 11px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .restore-btn:hover {
    background: var(--primary-bg);
    border-color: var(--primary);
    color: var(--primary);
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 20px;
    text-align: center;
  }

  .empty-icon {
    font-size: 40px;
    margin-bottom: 12px;
    opacity: 0.6;
  }

  .empty-state p {
    font-size: 14px;
    color: var(--text-muted);
    margin: 0;
  }

  .more-hint {
    text-align: center;
    padding: 12px;
    font-size: 12px;
    color: var(--text-muted);
  }
</style>
