<script lang="ts">
  import { getTasksStore, setFilter, clearFilters } from '$lib/stores/tasks.svelte';
  import { getUIStore, toggleSidebar, setViewMode, enterImmersiveMode } from '$lib/stores/ui.svelte';
  import { getSettingsStore, toggleTheme, setAppLanguage } from '$lib/stores/settings.svelte';
  import { getPomodoroStore } from '$lib/stores/pomodoro.svelte';
  import { getI18nStore, setLanguage } from '$lib/i18n';
  import PomodoroTimer from './PomodoroTimer.svelte';
  import type { Language, Priority } from '$lib/types';
  import { PRIORITY_CONFIG } from '$lib/types';

  // Get translation function from store to ensure stable reference
  const i18n = getI18nStore();
  const pomodoro = getPomodoroStore();
  const t = i18n.t;

  interface Props {
    onOpenSettings?: () => void;
    onOpenReview?: () => void;
    onOpenBadges?: () => void;
    onOpenTrash?: () => void;
  }

  let { onOpenSettings, onOpenReview, onOpenBadges, onOpenTrash }: Props = $props();

  const tasks = getTasksStore();
  const ui = getUIStore();
  const settings = getSettingsStore();

  // Priority list for filtering
  const priorities: Priority[] = ['A', 'B', 'C', 'D', 'E', 'F'];

  // Extract unique projects, contexts, and tags from tasks
  let allProjects = $derived([...new Set(tasks.tasks.flatMap(task => task.projects))].sort());
  let allContexts = $derived([...new Set(tasks.tasks.flatMap(task => task.contexts))].sort());
  let allTags = $derived([...new Set(tasks.tasks.flatMap(task => task.customTags))].sort());

  // Count active tasks per priority
  function getPriorityCount(priority: Priority): number {
    return tasks.tasks.filter(task => !task.completed && task.priority === priority).length;
  }

  // Get unique due dates and their counts
  let dueDateGroups = $derived(() => {
    const groups: { date: string; count: number }[] = [];
    const dateMap = new Map<string, number>();

    tasks.tasks.forEach(task => {
      if (!task.completed && task.dueDate) {
        dateMap.set(task.dueDate, (dateMap.get(task.dueDate) || 0) + 1);
      }
    });

    // Sort by date
    [...dateMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([date, count]) => {
        groups.push({ date, count });
      });

    return groups;
  });

  // Get pomodoro count groups
  let pomodoroGroups = $derived(() => {
    const groups: { pomodoros: number; count: number }[] = [];
    const pomoMap = new Map<number, number>();

    tasks.tasks.forEach(task => {
      if (!task.completed && task.pomodoros.estimated > 0) {
        pomoMap.set(task.pomodoros.estimated, (pomoMap.get(task.pomodoros.estimated) || 0) + 1);
      }
    });

    // Sort by pomodoro count
    [...pomoMap.entries()]
      .sort((a, b) => a[0] - b[0])
      .forEach(([pomodoros, count]) => {
        groups.push({ pomodoros, count });
      });

    return groups;
  });

  // Count tasks per project/context/tag
  function getProjectCount(project: string): number {
    return tasks.tasks.filter(task => !task.completed && task.projects.includes(project)).length;
  }
  function getContextCount(context: string): number {
    return tasks.tasks.filter(task => !task.completed && task.contexts.includes(context)).length;
  }
  function getTagCount(tag: string): number {
    return tasks.tasks.filter(task => !task.completed && task.customTags.includes(tag)).length;
  }

  let dueDatesExpanded = $state(true);
  let pomodorosExpanded = $state(true);
  let projectsExpanded = $state(true);
  let contextsExpanded = $state(true);
  let tagsExpanded = $state(false);

  // Priority filter state
  let selectedPriority = $state<Priority | null>(null);

  function handlePriorityFilter(priority: Priority) {
    if (selectedPriority === priority) {
      selectedPriority = null;
      setFilter({ priority: null });
    } else {
      selectedPriority = priority;
      setFilter({ priority });
    }
  }

  // Due date filter
  function handleDueDateFilter(date: string) {
    // Toggle filter
    if (tasks.filter.dueFilter === date) {
      setFilter({ dueFilter: null });
    } else {
      setFilter({ dueFilter: date as any });
    }
  }

  // Pomodoro filter
  function handlePomodoroFilter(pomodoros: number) {
    if (tasks.filter.pomodoroFilter === pomodoros) {
      setFilter({ pomodoroFilter: null });
    } else {
      setFilter({ pomodoroFilter: pomodoros });
    }
  }

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
    const currentLang = i18n.language;
    const newLang: Language = currentLang === 'zh-CN' ? 'en-US' : 'zh-CN';
    setLanguage(newLang);
    setAppLanguage(newLang); // Also persist to settings
  }

  function handleImmersiveMode() {
    if (pomodoro.state !== 'idle') {
      enterImmersiveMode();
    }
  }

  function getThemeIcon(): 'dark' | 'light' | 'system' {
    return settings.theme;
  }

  const hasActiveFilter = $derived(
    tasks.filter.project !== null ||
    tasks.filter.context !== null ||
    tasks.filter.tag !== null ||
    tasks.filter.dueFilter !== null ||
    tasks.filter.priority !== null ||
    tasks.filter.pomodoroFilter !== null
  );

  // Sync selectedPriority with filter state
  $effect(() => {
    selectedPriority = tasks.filter.priority ?? null;
  });

  // Helper to extract emoji from string (for minimal display)
  const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;

  function extractEmoji(text: string): string | null {
    const match = text.match(emojiRegex);
    return match ? match.join('') : null;
  }

  function getDisplayText(text: string): { display: string; isEmoji: boolean } {
    const emoji = extractEmoji(text);
    if (emoji && emoji.length > 0) {
      return { display: emoji, isEmoji: true };
    }
    return { display: text, isEmoji: false };
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
      <!-- Due Dates Section - Date chips with counts -->
      {#if dueDateGroups().length > 0}
        <div class="nav-section">
          <button class="section-header" onclick={() => dueDatesExpanded = !dueDatesExpanded}>
            <svg class="section-icon" class:rotated={dueDatesExpanded} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
            <span class="section-label">{t('sidebar.dueDate') || '截止日期'}</span>
          </button>
          {#if dueDatesExpanded}
            <div class="badge-group date-badges">
              {#each dueDateGroups() as { date, count }}
                <button
                  class="date-badge-btn"
                  onclick={() => handleDueDateFilter(date)}
                >
                  <span class="date-text">{date}</span>
                  <span class="badge-count">{count}</span>
                </button>
              {/each}
            </div>
          {/if}
        </div>
      {/if}

      <!-- Pomodoro Section - Pomodoro chips with counts -->
      {#if pomodoroGroups().length > 0}
        <div class="nav-section">
          <button class="section-header" onclick={() => pomodorosExpanded = !pomodorosExpanded}>
            <svg class="section-icon" class:rotated={pomodorosExpanded} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
            <span class="section-label">{t('sidebar.pomodoro') || '番茄工作法'}</span>
          </button>
          {#if pomodorosExpanded}
            <div class="badge-group pomodoro-badges">
              {#each pomodoroGroups() as { pomodoros, count }}
                <button
                  class="pomodoro-badge-btn"
                  class:active={tasks.filter.pomodoroFilter === pomodoros}
                  onclick={() => handlePomodoroFilter(pomodoros)}
                >
                  <span class="pomodoro-icon">🍅</span>
                  <span class="pomodoro-num">{pomodoros}</span>
                  <span class="badge-count">{count}</span>
                </button>
              {/each}
            </div>
          {/if}
        </div>
      {/if}

      <!-- Projects Section - Badge style with superscript counts -->
      {#if allProjects.length > 0}
        <div class="nav-section">
          <button class="section-header" onclick={() => projectsExpanded = !projectsExpanded}>
            <svg class="section-icon" class:rotated={projectsExpanded} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
            <span class="section-label">{t('sidebar.projects')}</span>
          </button>
          {#if projectsExpanded}
            <div class="badge-group tag-badges">
              {#each allProjects as project}
                {@const count = getProjectCount(project)}
                {@const displayInfo = getDisplayText(project)}
                <button
                  class="tag-badge-btn project"
                  class:active={tasks.filter.project === project}
                  class:emoji-only={displayInfo.isEmoji}
                  onclick={() => handleProjectFilter(project)}
                  title={project}
                >
                  <span class="badge-text">{displayInfo.display}</span>
                  {#if count > 0}
                    <span class="badge-sup">{count}</span>
                  {/if}
                </button>
              {/each}
            </div>
          {/if}
        </div>
      {/if}

      <!-- Contexts Section - Badge style with superscript counts -->
      {#if allContexts.length > 0}
        <div class="nav-section">
          <button class="section-header" onclick={() => contextsExpanded = !contextsExpanded}>
            <svg class="section-icon" class:rotated={contextsExpanded} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
            <span class="section-label">{t('sidebar.contexts')}</span>
          </button>
          {#if contextsExpanded}
            <div class="badge-group tag-badges">
              {#each allContexts as context}
                {@const count = getContextCount(context)}
                {@const displayInfo = getDisplayText(context)}
                <button
                  class="tag-badge-btn context"
                  class:active={tasks.filter.context === context}
                  class:emoji-only={displayInfo.isEmoji}
                  onclick={() => handleContextFilter(context)}
                  title={context}
                >
                  <span class="badge-text">{displayInfo.display}</span>
                  {#if count > 0}
                    <span class="badge-sup">{count}</span>
                  {/if}
                </button>
              {/each}
            </div>
          {/if}
        </div>
      {/if}

      <!-- Tags Section - Badge style with superscript counts -->
      {#if allTags.length > 0}
        <div class="nav-section">
          <button class="section-header" onclick={() => tagsExpanded = !tagsExpanded}>
            <svg class="section-icon" class:rotated={tagsExpanded} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
            <span class="section-label">{t('sidebar.tags')}</span>
          </button>
          {#if tagsExpanded}
            <div class="badge-group tag-badges">
              {#each allTags as tag}
                {@const count = getTagCount(tag)}
                {@const displayInfo = getDisplayText(tag)}
                <button
                  class="tag-badge-btn tag"
                  class:active={tasks.filter.tag === tag}
                  class:emoji-only={displayInfo.isEmoji}
                  onclick={() => handleTagFilter(tag)}
                  title={tag}
                >
                  <span class="badge-text">{displayInfo.display}</span>
                  {#if count > 0}
                    <span class="badge-sup">{count}</span>
                  {/if}
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

    <!-- Pomodoro Timer in Sidebar -->
    <div class="sidebar-timer">
      <PomodoroTimer onEnterImmersive={handleImmersiveMode} />
    </div>

    <div class="sidebar-footer">
      <!-- Language Toggle -->
      <button
        class="footer-btn"
        onclick={handleLanguageToggle}
        title={t('settings.language')}
      >
        <span class="lang-label">{i18n.language === 'zh-CN' ? '中' : 'EN'}</span>
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
      <button class="footer-btn" onclick={onOpenBadges} title={t('nav.badges') || '成就'}>
        <span>🏆</span>
      </button>

      <!-- Trash Button -->
      <button class="footer-btn" onclick={onOpenTrash} title={t('nav.trashArchive') || '回收站与归档'}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
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
      <button class="collapsed-btn" onclick={onOpenBadges} title={t('nav.badges') || '成就'}>
        <span>🏆</span>
      </button>
      <button class="collapsed-btn" onclick={onOpenTrash} title={t('nav.trashArchive') || '回收站与归档'}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
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
    position: relative;
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
    color: #9384bc;
  }

  .filter-item.context .item-icon {
    color: #6b9cbc;
  }

  .filter-item.tag .item-icon {
    color: #6ca88c;
  }

  /* Badge count for items */
  .item-badge {
    position: absolute;
    right: 6px;
    top: 50%;
    transform: translateY(-50%);
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    font-size: 10px;
    font-weight: 600;
    background: var(--bg-tertiary, rgba(100, 100, 100, 0.2));
    color: var(--text-muted);
    border-radius: 9px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .filter-item.project .item-badge {
    background: rgba(147, 132, 188, 0.18);
    color: #9384bc;
  }

  .filter-item.context .item-badge {
    background: rgba(107, 156, 188, 0.18);
    color: #6b9cbc;
  }

  .filter-item.tag .item-badge {
    background: rgba(108, 168, 140, 0.18);
    color: #6ca88c;
  }

  .filter-item.active .item-badge {
    background: var(--primary-bg);
    color: var(--primary);
  }

  /* Badge Group Styles - Like the reference image */
  .badge-group {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 8px 6px;
  }

  /* Priority Badge Button */
  .priority-badge-btn {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: none;
    border-radius: 10px;
    background: var(--badge-color);
    color: white;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .priority-badge-btn:hover {
    transform: scale(1.08);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  .priority-badge-btn.active {
    box-shadow: 0 0 0 3px var(--badge-color), 0 0 0 5px var(--bg-secondary);
  }

  .priority-badge-btn .badge-letter {
    font-size: 16px;
    font-weight: 700;
  }

  .priority-badge-btn .badge-count {
    position: absolute;
    top: -6px;
    right: -6px;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    font-size: 11px;
    font-weight: 600;
    background: var(--error, #ff6b6b);
    color: white;
    border-radius: 9px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  /* Date Badge Button */
  .date-badges {
    gap: 6px;
  }

  .date-badge-btn {
    position: relative;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 10px;
    border: none;
    border-radius: 6px;
    background: var(--bg-tertiary, rgba(100, 100, 100, 0.15));
    color: var(--text-secondary);
    cursor: pointer;
    transition: all var(--transition-fast);
    font-size: 12px;
    font-weight: 500;
  }

  .date-badge-btn:hover {
    background: var(--hover-bg);
    color: var(--text-primary);
  }

  .date-badge-btn .date-text {
    font-weight: 500;
  }

  .date-badge-btn .badge-count {
    position: absolute;
    top: -5px;
    right: -5px;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    font-size: 10px;
    font-weight: 600;
    background: var(--primary, #ff6b6b);
    color: white;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  /* Pomodoro Badge Button */
  .pomodoro-badges {
    gap: 6px;
  }

  .pomodoro-badge-btn {
    position: relative;
    display: flex;
    align-items: center;
    gap: 3px;
    padding: 6px 10px;
    border: none;
    border-radius: 6px;
    background: var(--error-bg, rgba(255, 107, 107, 0.12));
    color: var(--error, #ff6b6b);
    cursor: pointer;
    transition: all var(--transition-fast);
    font-size: 12px;
    font-weight: 500;
  }

  .pomodoro-badge-btn:hover {
    background: var(--error, #ff6b6b);
    color: white;
  }

  .pomodoro-badge-btn.active {
    background: var(--error, #ff6b6b);
    color: white;
    box-shadow: 0 0 0 2px var(--bg-secondary), 0 0 0 4px var(--error, #ff6b6b);
  }

  .pomodoro-badge-btn .pomodoro-icon {
    font-size: 12px;
  }

  .pomodoro-badge-btn .pomodoro-num {
    font-weight: 600;
  }

  .pomodoro-badge-btn .badge-count {
    position: absolute;
    top: -5px;
    right: -5px;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    font-size: 10px;
    font-weight: 600;
    background: var(--text-muted, #888);
    color: white;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
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

  .sidebar-timer {
    padding: 12px;
    border-top: 1px solid var(--border-subtle);
    border-bottom: 1px solid var(--border-subtle);
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

  /* Tag Badge Styles - Compact with superscript counts */
  .tag-badges {
    gap: 6px;
  }

  .tag-badge-btn {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 2px;
    padding: 5px 10px;
    border: none;
    border-radius: 6px;
    background: var(--bg-tertiary, rgba(100, 100, 100, 0.12));
    color: var(--text-secondary);
    cursor: pointer;
    transition: all var(--transition-fast);
    font-size: 12px;
    font-weight: 500;
  }

  .tag-badge-btn:hover {
    background: var(--hover-bg);
    color: var(--text-primary);
  }

  .tag-badge-btn.active {
    background: var(--primary-bg);
    color: var(--primary);
  }

  .tag-badge-btn.project {
    background: rgba(147, 132, 188, 0.15);
    color: #9384bc;
  }

  .tag-badge-btn.project:hover {
    background: rgba(147, 132, 188, 0.22);
  }

  .tag-badge-btn.project.active {
    background: rgba(147, 132, 188, 0.28);
    box-shadow: 0 0 0 1px #9384bc;
  }

  .tag-badge-btn.context {
    background: rgba(107, 156, 188, 0.15);
    color: #6b9cbc;
  }

  .tag-badge-btn.context:hover {
    background: rgba(107, 156, 188, 0.22);
  }

  .tag-badge-btn.context.active {
    background: rgba(107, 156, 188, 0.28);
    box-shadow: 0 0 0 1px #6b9cbc;
  }

  .tag-badge-btn.tag {
    background: rgba(108, 168, 140, 0.15);
    color: #6ca88c;
  }

  .tag-badge-btn.tag:hover {
    background: rgba(108, 168, 140, 0.22);
  }

  .tag-badge-btn.tag.active {
    background: rgba(108, 168, 140, 0.28);
    box-shadow: 0 0 0 1px #6ca88c;
  }

  .badge-text {
    font-weight: 500;
  }

  .badge-sup {
    position: absolute;
    top: -5px;
    right: -5px;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    font-size: 10px;
    font-weight: 600;
    background: var(--text-muted);
    color: white;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }

  .tag-badge-btn.project .badge-sup {
    background: #9384bc;
  }

  .tag-badge-btn.context .badge-sup {
    background: #6b9cbc;
  }

  .tag-badge-btn.tag .badge-sup {
    background: #6ca88c;
  }

  /* Emoji-only display mode - compact square badges */
  .tag-badge-btn.emoji-only {
    width: 32px;
    height: 32px;
    padding: 0;
    justify-content: center;
    font-size: 16px;
  }

  .tag-badge-btn.emoji-only .badge-text {
    font-size: 16px;
    line-height: 1;
  }

  .tag-badge-btn.emoji-only .badge-sup {
    top: -6px;
    right: -6px;
  }
</style>
