<script lang="ts">
  import { getTasksStore, setFilter, clearFilters } from '$lib/stores/tasks.svelte';
  import { getUIStore, toggleSidebar, setViewMode } from '$lib/stores/ui.svelte';
  import { getSettingsStore, toggleTheme, setAppLanguage } from '$lib/stores/settings.svelte';
  import { t, setLanguage, currentLanguage } from '$lib/i18n';
  import type { Language } from '$lib/types';

  interface Props {
    onOpenSettings?: () => void;
    onOpenReview?: () => void;
    onOpenBadges?: () => void; // New prop
  }

  let { onOpenSettings, onOpenReview, onOpenBadges }: Props = $props();

  const tasks = getTasksStore();
  const ui = getUIStore();
  const settings = getSettingsStore();

  // Extract unique projects, contexts, and tags from tasks
  let allProjects = $derived([...new Set(tasks.tasks.flatMap(t => t.projects))].sort());
  let allContexts = $derived([...new Set(tasks.tasks.flatMap(t => t.contexts))].sort());
  let allTags = $derived([...new Set(tasks.tasks.flatMap(t => t.customTags))].sort());

  // Count tasks per project/context/tag
  function getProjectCount(project: string): number {
    return tasks.tasks.filter(t => !t.completed && t.projects.includes(project)).length;
  }
  function getContextCount(context: string): number {
    return tasks.tasks.filter(t => !t.completed && t.contexts.includes(context)).length;
  }
  function getTagCount(tag: string): number {
    return tasks.tasks.filter(t => !t.completed && t.customTags.includes(tag)).length;
  }

  let projectsExpanded = $state(true);
  let contextsExpanded = $state(true);
  let tagsExpanded = $state(false);
  let dueDatesExpanded = $state(false);

  function handleProjectFilter(project: string) {
    if (tasks.filter.project === project) {
      setFilter({ project: null });
    } else {
      setFilter({ project });
    }
  }

  function handleContextFilter(context: string) {
    if (tasks.filter.context === context) {
      setFilter({ context: null });
    } else {
      setFilter({ context });
    }
  }

  function handleTagFilter(tag: string) {
    if (tasks.filter.tag === tag) {
      setFilter({ tag: null });
    } else {
      setFilter({ tag });
    }
  }

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
    setAppLanguage(newLang); // Also persist to settings
  }

  function getThemeIcon(): 'dark' | 'light' | 'system' {
    return settings.theme;
  }

  const hasActiveFilter = $derived(
    tasks.filter.project !== null ||
    tasks.filter.context !== null ||
    tasks.filter.tag !== null ||
    tasks.filter.dueFilter !== null
  );
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
      <!-- Removed View Navigation for Minimalism -->

      <!-- Projects Section -->
      {#if allProjects.length > 0}
        <div class="nav-section">
          <button class="section-header" onclick={() => projectsExpanded = !projectsExpanded}>
            <svg class="section-icon" class:rotated={projectsExpanded} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
            <span class="section-label">{t('sidebar.projects')}</span>
            <span class="section-count">{allProjects.length}</span>
          </button>
          {#if projectsExpanded}
            <div class="filter-list">
              {#each allProjects as project}
                <button
                  class="filter-item project"
                  class:active={tasks.filter.project === project}
                  onclick={() => handleProjectFilter(project)}
                >
                  <span class="item-icon">+</span>
                  <span class="item-text">{project}</span>
                  <span class="item-count">{getProjectCount(project)}</span>
                </button>
              {/each}
            </div>
          {/if}
        </div>
      {/if}

      <!-- Contexts Section -->
      {#if allContexts.length > 0}
        <div class="nav-section">
          <button class="section-header" onclick={() => contextsExpanded = !contextsExpanded}>
            <svg class="section-icon" class:rotated={contextsExpanded} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
            <span class="section-label">{t('sidebar.contexts')}</span>
            <span class="section-count">{allContexts.length}</span>
          </button>
          {#if contextsExpanded}
            <div class="filter-list">
              {#each allContexts as context}
                <button
                  class="filter-item context"
                  class:active={tasks.filter.context === context}
                  onclick={() => handleContextFilter(context)}
                >
                  <span class="item-icon">@</span>
                  <span class="item-text">{context}</span>
                  <span class="item-count">{getContextCount(context)}</span>
                </button>
              {/each}
            </div>
          {/if}
        </div>
      {/if}

      <!-- Tags Section -->
      {#if allTags.length > 0}
        <div class="nav-section">
          <button class="section-header" onclick={() => tagsExpanded = !tagsExpanded}>
            <svg class="section-icon" class:rotated={tagsExpanded} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
            <span class="section-label">{t('sidebar.tags')}</span>
            <span class="section-count">{allTags.length}</span>
          </button>
          {#if tagsExpanded}
            <div class="filter-list">
              {#each allTags as tag}
                <button
                  class="filter-item tag"
                  class:active={tasks.filter.tag === tag}
                  onclick={() => handleTagFilter(tag)}
                >
                  <span class="item-icon">#</span>
                  <span class="item-text">{tag}</span>
                  <span class="item-count">{getTagCount(tag)}</span>
                </button>
              {/each}
            </div>
          {/if}
        </div>
      {/if}

      <!-- Review Button -->
      <button class="action-btn review-btn" onclick={onOpenReview}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
        </svg>
        <span>{t('review.title')}</span>
      </button>

      <!-- Clear Filter -->
      {#if hasActiveFilter}
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

      <!-- Badges Button -->
      <button class="footer-btn" onclick={onOpenBadges} title="成就">
        <span>🏆</span>
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
      <button class="collapsed-btn" onclick={onOpenBadges} title="成就">
        <span>🏆</span>
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
    width: 240px;
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

  .divider {
    height: 1px;
    background: var(--border-subtle);
    margin: 4px 0;
  }

  /* Nav Items */
  .nav-item {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 10px 12px;
    border: none;
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    text-align: left;
    transition: all var(--transition-fast);
    font-size: 14px;
    font-weight: 500;
  }

  .nav-item:hover {
    background: var(--hover-bg);
    color: var(--text-primary);
  }

  .nav-item.active {
    background: var(--primary-bg);
    color: var(--primary);
  }

  .item-icon {
    font-size: 16px;
    width: 20px;
    text-align: center;
  }

  .item-text {
    flex: 1;
  }

  .item-count {
    font-size: 11px;
    color: var(--text-muted);
    background: var(--hover-bg);
    padding: 2px 6px;
    border-radius: var(--radius-sm);
  }

  /* Navigation Sections */
  .nav-section {
    display: flex;
    flex-direction: column;
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 4px;
    border: none;
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all var(--transition-fast);
    width: 100%;
    text-align: left;
  }

  .section-header:hover {
    color: var(--text-primary);
  }

  .section-icon {
    width: 14px;
    height: 14px;
    transition: transform var(--transition-fast);
    flex-shrink: 0;
  }

  .section-icon.rotated {
    transform: rotate(90deg);
  }

  .section-label {
    flex: 1;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .section-count {
    font-size: 10px;
    color: var(--text-muted);
    background: var(--hover-bg);
    padding: 2px 6px;
    border-radius: var(--radius-sm);
  }

  .filter-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding-left: 6px;
  }

  .filter-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 10px;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    text-align: left;
    transition: all var(--transition-fast);
    font-size: 13px;
  }

  .filter-item:hover {
    background: var(--hover-bg);
    color: var(--text-primary);
  }

  .filter-item.active {
    background: var(--primary-bg);
    color: var(--primary);
  }

  .filter-item .item-icon {
    font-size: 12px;
    font-weight: 600;
    width: 16px;
    text-align: center;
    flex-shrink: 0;
  }

  .filter-item.project .item-icon {
    color: #b197fc;
  }

  .filter-item.context .item-icon {
    color: #74c0fc;
  }

  .filter-item.tag .item-icon {
    color: #63e6be;
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
