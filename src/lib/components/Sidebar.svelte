<script lang="ts">
  import { getTasksStore, setFilter, clearFilters } from '$lib/stores/tasks.svelte';
  import { getUIStore, toggleSidebar } from '$lib/stores/ui.svelte';
  import { getSettingsStore, toggleTheme } from '$lib/stores/settings.svelte';
  import { t, availableLanguages, setLanguage, currentLanguage } from '$lib/i18n';
  import type { Language } from '$lib/types';

  interface Props {
    onOpenSettings?: () => void;
    onOpenReview?: () => void;
  }

  let { onOpenSettings, onOpenReview }: Props = $props();

  const tasks = getTasksStore();
  const ui = getUIStore();
  const settings = getSettingsStore();

  function handleDueFilter(filter: 'today' | 'thisWeek' | 'overdue' | null) {
    if (tasks.filter.dueFilter === filter) {
      setFilter({ dueFilter: null });
    } else {
      setFilter({ dueFilter: filter });
    }
  }

  function handleLanguageToggle() {
    const currentLang = currentLanguage();
    const newLang: Language = currentLang === 'zh-CN' ? 'en-US' : 'zh-CN';
    setLanguage(newLang);
  }

  function getThemeIcon(): 'dark' | 'light' | 'system' {
    return settings.theme;
  }
</script>

<aside class="sidebar" class:collapsed={ui.sidebarCollapsed}>
  <div class="sidebar-header">
    <div class="logo">
      <span class="logo-icon">🍅</span>
      {#if !ui.sidebarCollapsed}
        <span class="logo-text">FocusFlow</span>
      {/if}
    </div>
    <button class="collapse-btn" onclick={toggleSidebar} title={t('sidebar.collapse')}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        {#if ui.sidebarCollapsed}
          <polyline points="9 18 15 12 9 6"></polyline>
        {:else}
          <polyline points="15 18 9 12 15 6"></polyline>
        {/if}
      </svg>
    </button>
  </div>

  {#if !ui.sidebarCollapsed}
    <div class="sidebar-content">
      <!-- Stats Overview -->
      <div class="stats-card">
        <div class="stat-row">
          <span class="stat-icon">🍅</span>
          <span class="stat-label">{t('sidebar.todayCompleted')}</span>
          <span class="stat-value">{tasks.completedTodayCount}</span>
        </div>
      </div>

      <!-- Quick Filters -->
      <div class="nav-section">
        <div class="section-label">{t('sidebar.dueDates')}</div>
        <div class="filter-buttons">
          <button
            class="filter-btn"
            class:active={tasks.filter.dueFilter === 'today'}
            class:has-items={tasks.dueTodayCount > 0}
            onclick={() => handleDueFilter('today')}
          >
            <span class="filter-icon">📅</span>
            <span class="filter-text">{t('sidebar.dueToday')}</span>
            <span class="filter-count">{tasks.dueTodayCount}</span>
          </button>

          <button
            class="filter-btn"
            class:active={tasks.filter.dueFilter === 'thisWeek'}
            onclick={() => handleDueFilter('thisWeek')}
          >
            <span class="filter-icon">📆</span>
            <span class="filter-text">{t('sidebar.dueThisWeek')}</span>
            <span class="filter-count">{tasks.dueThisWeekCount}</span>
          </button>

          <button
            class="filter-btn warning"
            class:active={tasks.filter.dueFilter === 'overdue'}
            class:has-items={tasks.overdueCount > 0}
            onclick={() => handleDueFilter('overdue')}
          >
            <span class="filter-icon">⚠️</span>
            <span class="filter-text">{t('sidebar.overdue')}</span>
            <span class="filter-count">{tasks.overdueCount}</span>
          </button>
        </div>
      </div>

      <!-- Review Button -->
      <button class="action-btn review-btn" onclick={onOpenReview}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
        <span>{t('review.title')}</span>
      </button>

      <!-- Clear Filter -->
      {#if tasks.filter.project || tasks.filter.context || tasks.filter.tag || tasks.filter.dueFilter}
        <button class="clear-btn" onclick={clearFilters}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
          <span>{t('filter.clearFilter')}</span>
        </button>
      {/if}
    </div>

    <div class="sidebar-footer">
      <!-- Language Toggle -->
      <button
        class="footer-btn"
        onclick={handleLanguageToggle}
        title={t('settings.language')}
      >
        <span class="lang-label">{currentLanguage() === 'zh-CN' ? '中' : 'EN'}</span>
      </button>

      <!-- Theme Toggle -->
      <button class="footer-btn" onclick={toggleTheme} title={t('settings.theme')}>
        {#if getThemeIcon() === 'dark'}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
          </svg>
        {:else if getThemeIcon() === 'light'}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="5"></circle>
            <line x1="12" y1="1" x2="12" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="23"></line>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
            <line x1="1" y1="12" x2="3" y2="12"></line>
            <line x1="21" y1="12" x2="23" y2="12"></line>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
          </svg>
        {:else}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
            <line x1="8" y1="21" x2="16" y2="21"></line>
            <line x1="12" y1="17" x2="12" y2="21"></line>
          </svg>
        {/if}
      </button>

      <!-- Settings Button -->
      <button class="footer-btn primary" onclick={onOpenSettings} title={t('settings.title')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
      </button>
    </div>
  {:else}
    <!-- Collapsed State -->
    <div class="sidebar-collapsed-content">
      <button class="collapsed-btn" onclick={onOpenReview} title={t('review.title')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
        </svg>
      </button>
      <button class="collapsed-btn" onclick={onOpenSettings} title={t('settings.title')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
      </button>
    </div>
  {/if}
</aside>

<style>
  .sidebar {
    width: 220px;
    height: 100vh;
    background: var(--sidebar-bg);
    border-right: 1px solid var(--border-subtle);
    display: flex;
    flex-direction: column;
    transition: width var(--transition-slow);
    overflow: hidden;
  }

  .sidebar.collapsed {
    width: 56px;
  }

  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    border-bottom: 1px solid var(--border-subtle);
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .logo-icon {
    font-size: 24px;
  }

  .logo-text {
    font-size: 17px;
    font-weight: 700;
    letter-spacing: -0.02em;
    background: linear-gradient(135deg, var(--primary), #f783ac);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .collapse-btn {
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

  .collapse-btn:hover {
    background: var(--hover-bg);
    color: var(--text-primary);
  }

  .collapse-btn svg {
    width: 16px;
    height: 16px;
  }

  .sidebar-content {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .stats-card {
    background: var(--card-bg);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    padding: 14px;
  }

  .stat-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .stat-icon {
    font-size: 18px;
  }

  .stat-label {
    flex: 1;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .stat-value {
    font-size: 18px;
    font-weight: 700;
    color: var(--success);
  }

  .nav-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .section-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding-left: 4px;
  }

  .filter-buttons {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .filter-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 10px 12px;
    border: none;
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    text-align: left;
    transition: all var(--transition-fast);
  }

  .filter-btn:hover {
    background: var(--hover-bg);
    color: var(--text-primary);
  }

  .filter-btn.active {
    background: var(--primary-bg);
    color: var(--primary);
  }

  .filter-btn.has-items .filter-count {
    color: var(--primary);
    font-weight: 600;
  }

  .filter-btn.warning.has-items .filter-count {
    color: var(--error);
  }

  .filter-icon {
    font-size: 14px;
  }

  .filter-text {
    flex: 1;
    font-size: 13px;
    font-weight: 500;
  }

  .filter-count {
    font-size: 12px;
    color: var(--text-muted);
    min-width: 20px;
    text-align: right;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 12px 14px;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    transition: all var(--transition-fast);
  }

  .action-btn:hover {
    background: var(--hover-bg);
    border-color: var(--text-muted);
    color: var(--text-primary);
  }

  .action-btn svg {
    width: 16px;
    height: 16px;
  }

  .review-btn {
    margin-top: auto;
  }

  .clear-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 100%;
    padding: 8px;
    border: none;
    border-radius: var(--radius-sm);
    background: var(--error);
    background: rgba(var(--error-rgb, 255, 107, 107), 0.1);
    color: var(--error);
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
    transition: all var(--transition-fast);
  }

  .clear-btn:hover {
    background: rgba(var(--error-rgb, 255, 107, 107), 0.2);
  }

  .clear-btn svg {
    width: 14px;
    height: 14px;
  }

  .sidebar-footer {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 16px;
    border-top: 1px solid var(--border-subtle);
  }

  .footer-btn {
    width: 36px;
    height: 36px;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    background: var(--card-bg);
    color: var(--text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--transition-fast);
  }

  .footer-btn:hover {
    background: var(--hover-bg);
    border-color: var(--border-color);
    color: var(--text-primary);
  }

  .footer-btn.primary {
    background: var(--primary-bg);
    border-color: var(--primary);
    color: var(--primary);
  }

  .footer-btn.primary:hover {
    background: var(--primary);
    color: white;
  }

  .footer-btn svg {
    width: 16px;
    height: 16px;
  }

  .lang-label {
    font-size: 12px;
    font-weight: 600;
  }

  .sidebar-collapsed-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 16px 0;
    gap: 8px;
  }

  .collapsed-btn {
    width: 36px;
    height: 36px;
    border: none;
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--transition-fast);
  }

  .collapsed-btn:hover {
    background: var(--hover-bg);
    color: var(--text-primary);
  }

  .collapsed-btn svg {
    width: 18px;
    height: 18px;
  }
</style>
