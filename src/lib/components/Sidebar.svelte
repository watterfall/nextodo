<script lang="ts">
  import { getTasksStore, setFilter, clearFilters } from '$lib/stores/tasks.svelte';
  import { getUIStore, toggleSidebar } from '$lib/stores/ui.svelte';
  import { getSettingsStore, toggleTheme } from '$lib/stores/settings.svelte';

  const tasks = getTasksStore();
  const ui = getUIStore();
  const settings = getSettingsStore();

  let activeSection = $state<string | null>(null);

  function handleProjectClick(project: string) {
    if (tasks.filter.project === project) {
      setFilter({ project: null });
    } else {
      setFilter({ project });
    }
  }

  function handleContextClick(context: string) {
    if (tasks.filter.context === context) {
      setFilter({ context: null });
    } else {
      setFilter({ context });
    }
  }

  function handleDueFilter(filter: 'today' | 'thisWeek' | 'overdue' | null) {
    if (tasks.filter.dueFilter === filter) {
      setFilter({ dueFilter: null });
    } else {
      setFilter({ dueFilter: filter });
    }
  }

  function toggleSection(section: string) {
    activeSection = activeSection === section ? null : section;
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
    <button class="collapse-btn" onclick={toggleSidebar} title="收起侧边栏">
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
      <!-- Today Stats -->
      <div class="stats-section">
        <div class="stat-item">
          <span class="stat-icon">🍅</span>
          <span class="stat-label">今日完成</span>
          <span class="stat-value success">×{tasks.completedTodayCount}</span>
        </div>
      </div>

      <!-- Projects -->
      <div class="nav-section">
        <button class="section-header" onclick={() => toggleSection('projects')}>
          <span class="section-icon">📁</span>
          <span class="section-title">项目</span>
          <span class="section-toggle">{activeSection === 'projects' ? '−' : '+'}</span>
        </button>

        {#if activeSection === 'projects' || tasks.allProjects.length <= 5}
          <div class="section-items">
            {#each tasks.allProjects as project}
              <button
                class="nav-item"
                class:active={tasks.filter.project === project}
                onclick={() => handleProjectClick(project)}
              >
                <span class="item-name">{project}</span>
                <span class="item-count">({tasks.projectCounts[project] || 0})</span>
              </button>
            {/each}
            {#if tasks.allProjects.length === 0}
              <div class="empty-hint">暂无项目</div>
            {/if}
          </div>
        {/if}
      </div>

      <!-- Contexts -->
      <div class="nav-section">
        <button class="section-header" onclick={() => toggleSection('contexts')}>
          <span class="section-icon">📍</span>
          <span class="section-title">上下文</span>
          <span class="section-toggle">{activeSection === 'contexts' ? '−' : '+'}</span>
        </button>

        {#if activeSection === 'contexts' || tasks.allContexts.length <= 5}
          <div class="section-items">
            {#each tasks.allContexts as context}
              <button
                class="nav-item"
                class:active={tasks.filter.context === context}
                onclick={() => handleContextClick(context)}
              >
                <span class="item-name">{context}</span>
                <span class="item-count">({tasks.contextCounts[context] || 0})</span>
              </button>
            {/each}
            {#if tasks.allContexts.length === 0}
              <div class="empty-hint">暂无上下文</div>
            {/if}
          </div>
        {/if}
      </div>

      <!-- Tags -->
      <div class="nav-section">
        <button class="section-header" onclick={() => toggleSection('tags')}>
          <span class="section-icon">🏷️</span>
          <span class="section-title">标签</span>
          <span class="section-toggle">{activeSection === 'tags' ? '−' : '+'}</span>
        </button>

        {#if activeSection === 'tags'}
          <div class="section-items">
            {#each Object.entries(tasks.customTagGroups) as [groupName, tags]}
              <div class="tag-group">
                <span class="tag-group-name">{groupName}</span>
                <div class="tag-list">
                  {#each tags as tag}
                    <button
                      class="tag-item"
                      class:active={tasks.filter.tag === tag}
                      onclick={() => setFilter({ tag: tasks.filter.tag === tag ? null : tag })}
                    >
                      {tag}
                    </button>
                  {/each}
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Due Dates -->
      <div class="nav-section">
        <div class="section-header static">
          <span class="section-icon">📅</span>
          <span class="section-title">截止日期</span>
        </div>

        <div class="section-items">
          <button
            class="nav-item"
            class:active={tasks.filter.dueFilter === 'today'}
            onclick={() => handleDueFilter('today')}
          >
            <span class="item-name">今天</span>
            <span class="item-count" class:highlight={tasks.dueTodayCount > 0}>
              ({tasks.dueTodayCount})
            </span>
          </button>

          <button
            class="nav-item"
            class:active={tasks.filter.dueFilter === 'thisWeek'}
            onclick={() => handleDueFilter('thisWeek')}
          >
            <span class="item-name">本周</span>
            <span class="item-count">({tasks.dueThisWeekCount})</span>
          </button>

          <button
            class="nav-item"
            class:active={tasks.filter.dueFilter === 'overdue'}
            onclick={() => handleDueFilter('overdue')}
          >
            <span class="item-name">已过期</span>
            <span class="item-count" class:error={tasks.overdueCount > 0}>
              ({tasks.overdueCount})
            </span>
          </button>
        </div>
      </div>

      <!-- Recurring -->
      <div class="nav-section">
        <div class="section-header static">
          <span class="section-icon">🔁</span>
          <span class="section-title">重复任务</span>
        </div>

        <div class="section-items">
          <div class="nav-item static">
            <span class="item-name">每日</span>
            <span class="item-count">({tasks.dailyRecurringCount})</span>
          </div>
          <div class="nav-item static">
            <span class="item-name">每周</span>
            <span class="item-count">({tasks.weeklyRecurringCount})</span>
          </div>
        </div>
      </div>

      <!-- Actions -->
      {#if tasks.filter.project || tasks.filter.context || tasks.filter.tag || tasks.filter.dueFilter}
        <div class="filter-actions">
          <button class="clear-filter-btn" onclick={clearFilters}>
            清除筛选
          </button>
        </div>
      {/if}
    </div>

    <div class="sidebar-footer">
      <button class="footer-btn" onclick={toggleTheme} title="切换主题">
        {#if settings.theme === 'dark'}
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
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
          </svg>
        {/if}
      </button>
    </div>
  {/if}
</aside>

<style>
  .sidebar {
    width: 230px;
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
    padding: 14px 16px;
    border-bottom: 1px solid var(--border-subtle);
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .logo-icon {
    font-size: 22px;
  }

  .logo-text {
    font-size: 16px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--text-primary);
    background: linear-gradient(135deg, var(--primary), #f783ac);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .collapse-btn {
    width: 26px;
    height: 26px;
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
    width: 14px;
    height: 14px;
  }

  .sidebar-content {
    flex: 1;
    overflow-y: auto;
    padding: 12px 0;
  }

  .stats-section {
    padding: 0 12px 12px;
    border-bottom: 1px solid var(--border-subtle);
    margin-bottom: 12px;
  }

  .stat-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    background: var(--card-bg);
    border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
  }

  .stat-icon {
    font-size: 15px;
  }

  .stat-label {
    flex: 1;
    font-size: 12px;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .stat-value {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .stat-value.success {
    color: var(--success);
  }

  .nav-section {
    margin-bottom: 4px;
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 14px;
    border: none;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    text-align: left;
    transition: all var(--transition-fast);
  }

  .section-header:hover:not(.static) {
    color: var(--text-secondary);
  }

  .section-header.static {
    cursor: default;
  }

  .section-icon {
    font-size: 13px;
    opacity: 0.8;
  }

  .section-title {
    flex: 1;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .section-toggle {
    font-size: 12px;
    color: var(--text-muted);
    opacity: 0.6;
  }

  .section-items {
    padding: 2px 8px;
  }

  .nav-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 7px 10px;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    text-align: left;
    transition: all var(--transition-fast);
    font-size: 13px;
    font-weight: 450;
  }

  .nav-item:hover:not(.static) {
    background: var(--hover-bg);
    color: var(--text-primary);
  }

  .nav-item.active {
    background: var(--primary-bg);
    color: var(--primary);
    font-weight: 500;
  }

  .nav-item:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px var(--primary-bg);
  }

  .nav-item.static {
    cursor: default;
    opacity: 0.7;
  }

  .item-count {
    font-size: 11px;
    font-weight: 500;
    color: var(--text-muted);
    min-width: 24px;
    text-align: right;
  }

  .item-count.highlight {
    color: var(--primary);
    font-weight: 600;
  }

  .item-count.error {
    color: var(--error);
    font-weight: 600;
  }

  .tag-group {
    margin-bottom: 10px;
  }

  .tag-group-name {
    display: block;
    font-size: 10px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 4px 10px;
    margin-bottom: 4px;
  }

  .tag-list {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 0 6px;
  }

  .tag-item {
    font-size: 11px;
    font-weight: 500;
    padding: 4px 8px;
    border: none;
    border-radius: var(--radius-sm);
    background: var(--tag-bg);
    color: var(--text-secondary);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .tag-item:hover {
    background: var(--hover-bg);
    color: var(--text-primary);
  }

  .tag-item.active {
    background: var(--primary-bg);
    color: var(--primary);
  }

  .empty-hint {
    padding: 8px 10px;
    font-size: 11px;
    color: var(--text-muted);
    font-style: italic;
  }

  .filter-actions {
    padding: 12px;
    border-top: 1px solid var(--border-subtle);
  }

  .clear-filter-btn {
    width: 100%;
    padding: 8px;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
    transition: all var(--transition-fast);
  }

  .clear-filter-btn:hover {
    background: var(--hover-bg);
    border-color: var(--text-muted);
    color: var(--text-primary);
  }

  .sidebar-footer {
    padding: 12px;
    border-top: 1px solid var(--border-subtle);
    display: flex;
    justify-content: center;
  }

  .footer-btn {
    width: 32px;
    height: 32px;
    border: none;
    border-radius: var(--radius-md);
    background: var(--hover-bg);
    color: var(--text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--transition-fast);
  }

  .footer-btn:hover {
    background: var(--action-btn-hover-bg);
    color: var(--text-primary);
  }

  .footer-btn svg {
    width: 16px;
    height: 16px;
  }
</style>
