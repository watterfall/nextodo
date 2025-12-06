<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import KanbanView from '$lib/components/KanbanView.svelte';
  import ListView from '$lib/components/ListView.svelte';
  import TaskForm from '$lib/components/TaskForm.svelte';
  import QuotaMeter from '$lib/components/QuotaMeter.svelte';
  import UnitNav from '$lib/components/UnitNav.svelte';
  import ReviewPanel from '$lib/components/ReviewPanel.svelte';
  import SettingsModal from '$lib/components/SettingsModal.svelte';
  import Confetti from '$lib/components/Confetti.svelte';
  import ImmersivePomodoro from '$lib/components/ImmersivePomodoro.svelte';
  import HistoryModal from '$lib/components/HistoryModal.svelte';
  import TaskEditModal from '$lib/components/TaskEditModal.svelte';
  import ConfirmationModal from '$lib/components/ConfirmationModal.svelte';

  import {
    initializeData,
    getTasksStore,
    setSearchQuery,
    incrementPomodoro,
    reloadData,
    setFilter
  } from '$lib/stores/tasks.svelte';
  import {
    getUIStore,
    initKeyboardShortcuts,
    registerKeyboardCallbacks,
    hideToast,
    showToast,
    closeSearch,
    exitImmersiveMode,
    setViewMode // Import this
  } from '$lib/stores/ui.svelte';
  import {
    initPomodoro,
    getPomodoroStore,
    togglePomodoro
  } from '$lib/stores/pomodoro.svelte';
  import {
    initSettings,
    getSettingsStore,
    toggleTheme
  } from '$lib/stores/settings.svelte';
  import { initReviews } from '$lib/stores/reviews.svelte';
  import { saveAppData, setupFileWatcher } from '$lib/utils/storage';
  import { initI18n, getI18nStore } from '$lib/i18n';
  import type { Priority, ViewMode } from '$lib/types';

  // Get translation function from store to ensure stable reference
  const i18n = getI18nStore();
  const t = i18n.t;

  const tasks = getTasksStore();
  const ui = getUIStore();
  const pomodoro = getPomodoroStore();
  const settings = getSettingsStore();

  let showConfetti = $state(false);
  let searchInput = $state('');
  let isInitialized = $state(false);
  let unlistenFileWatcher: (() => void) | null = null;
  let isSettingsOpen = $state(false);
  let isReviewOpen = $state(false);
  let isHistoryOpen = $state(false);

  onMount(async () => {
    // Initialize i18n first
    initI18n();

    // Initialize data
    await initializeData();

    // Initialize settings
    initSettings(tasks.settings, tasks.customTagGroups, async () => {
      // Persist callback
      const data = tasks.appData;
      data.settings = settings.settings;
      data.customTagGroups = settings.customTagGroups;
      await saveAppData(data);
    });

    // Initialize pomodoro
    initPomodoro({
      work: settings.pomodoroWork,
      shortBreak: settings.pomodoroShortBreak,
      longBreak: settings.pomodoroLongBreak
    });

    // Initialize reviews
    initReviews(tasks.appData.reviews);

    // Initialize keyboard shortcuts
    initKeyboardShortcuts();

    // Register keyboard callbacks
    registerKeyboardCallbacks({
      focusNewTask: () => {
        // Focus will be handled by TaskForm
      },
      togglePomodoro: () => {
        togglePomodoro();
      }
    });

    // Setup file watcher for external changes (with conflict protection)
    unlistenFileWatcher = await setupFileWatcher(async (fileType) => {
      // Conflict protection: Don't reload if user is editing or pomodoro is active
      if (ui.editingTaskId) {
        console.log('Skipping reload - user is editing a task');
        showToast(t('error.externalChangeIgnored') || 'External data change detected but ignored due to active session. Please save and reload manually to avoid conflicts.', 'warning');
        return;
      }
      if (pomodoro.state !== 'idle') {
        console.log('Skipping reload - pomodoro is active');
        showToast(t('error.externalChangeIgnored') || 'External data change detected but ignored due to active session. Please save and reload manually to avoid conflicts.', 'warning');
        return;
      }
      console.log('External file change detected, reloading:', fileType);
      await reloadData(fileType);
    });

    // Listen for pomodoro complete events
    window.addEventListener('pomodoro-complete', ((e: CustomEvent) => {
      incrementPomodoro(e.detail.taskId);
      showConfetti = true;
      setTimeout(() => showConfetti = false, 100);
    }) as EventListener);

    isInitialized = true;
  });

  onDestroy(() => {
    if (unlistenFileWatcher) {
      unlistenFileWatcher();
    }
  });

  function handleSearchInput(e: Event) {
    const input = e.target as HTMLInputElement;
    searchInput = input.value;
    setSearchQuery(input.value);
  }

  function handleSearchKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      closeSearch();
      searchInput = '';
      setSearchQuery('');
    }
  }

  function getThemeIcon(): string {
    if (settings.theme === 'system') return 'system';
    return settings.effectiveTheme;
  }

  // Only show A, B, C, D zones in main area (not E - that's in Inbox)
  const mainPriorities: Priority[] = ['A', 'B', 'C', 'D'];
</script>

<svelte:head>
  <title>FocusFlow - {t('app.tagline')}</title>
</svelte:head>

{#if tasks.isLoading || !isInitialized}
  <div class="loading-screen">
    <div class="loading-content">
      <span class="loading-icon">🍅</span>
      <div class="loading-spinner"></div>
      <span class="loading-text">{t('app.loading')}</span>
    </div>
  </div>
{:else}
  <Sidebar
    onOpenSettings={() => {
      console.log('App: Opening settings');
      isSettingsOpen = true;
    }}
    onOpenReview={() => {
      console.log('App: Opening review');
      isReviewOpen = true;
    }}
    onOpenHistory={() => {
      console.log('App: Opening history');
      isHistoryOpen = true;
    }}
  />

  <main class="main-content">
    <!-- Header -->
    <header class="header">
      <div class="header-left">
        <UnitNav />
      </div>

      <div class="header-center">
        <button class="search-trigger" onclick={() => ui.isSearchOpen = true}>
          <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <span class="search-placeholder"></span>
          <kbd>⌘K</kbd>
        </button>
      </div>

      <div class="header-right">
        <QuotaMeter />

        <!-- View Toggle -->
        <div class="view-toggle">
          <button
            class="view-btn"
            class:active={ui.viewMode === 'kanban'}
            onclick={() => setViewMode('kanban')}
            title={t('view.kanban')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="5" height="18" rx="1"></rect>
              <rect x="10" y="3" width="5" height="18" rx="1"></rect>
              <rect x="17" y="3" width="5" height="18" rx="1"></rect>
            </svg>
          </button>
          <button
            class="view-btn"
            class:active={ui.viewMode === 'list'}
            onclick={() => setViewMode('list')}
            title={t('view.list')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="8" y1="6" x2="21" y2="6"></line>
              <line x1="8" y1="12" x2="21" y2="12"></line>
              <line x1="8" y1="18" x2="21" y2="18"></line>
              <line x1="3" y1="6" x2="3.01" y2="6"></line>
              <line x1="3" y1="12" x2="3.01" y2="12"></line>
              <line x1="3" y1="18" x2="3.01" y2="18"></line>
            </svg>
          </button>
        </div>

        <!-- Theme Toggle -->
        <button class="theme-toggle" onclick={toggleTheme} title={t('settings.theme')}>
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
      </div>
    </header>

    <!-- Task Form at Top (Always visible except in Review maybe?) -->
    <div class="task-form-container">
      <TaskForm />
    </div>

    <!-- Main Layout Switcher - Views fill available space -->
    <div class="content-layout">
      {#if ui.viewMode === 'kanban'}
        <KanbanView />
      {:else if ui.viewMode === 'list'}
        <ListView />
      {:else}
        <!-- Fallback to Kanban if view mode is unknown or legacy -->
        <KanbanView />
      {/if}
    </div>
  </main>

  <!-- Search Overlay -->
  {#if ui.isSearchOpen}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="search-overlay"
      onclick={closeSearch}
      onkeydown={(e) => e.key === 'Escape' && closeSearch()}
      role="dialog"
      aria-modal="true"
      aria-label={t('filter.search')}
      tabindex="-1"
    >
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="search-box" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
        <div class="search-input-wrapper">
          <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            class="search-input"
            placeholder={t('filter.search')}
            value={searchInput}
            oninput={handleSearchInput}
            onkeydown={handleSearchKeydown}
          />
        </div>
        <div class="search-results" role="listbox" aria-label={t('filter.searchResults')}>
          {#each tasks.filteredTasks.slice(0, 10) as task (task.id)}
            <button
              class="search-result-item"
              onclick={() => { closeSearch(); searchInput = ''; setSearchQuery(''); }}
              role="option"
              aria-selected="false"
            >
              <span class="result-priority" style:color="var(--priority-{task.priority.toLowerCase()}-color)">
                {task.priority}
              </span>
              <span class="result-content">{task.content}</span>
              {#each task.projects as project}
                <span class="result-tag project">{project}</span>
              {/each}
            </button>
          {:else}
            <div class="search-empty">
              {searchInput ? t('filter.noResults') : t('filter.search')}
            </div>
          {/each}
        </div>
      </div>
    </div>
  {/if}

  <!-- Settings Modal -->
  <SettingsModal
    isOpen={isSettingsOpen}
    onClose={() => isSettingsOpen = false}
  />

  <!-- History Modal (completed/cancelled tasks) -->
  {#if isHistoryOpen}
    <HistoryModal onClose={() => isHistoryOpen = false} />
  {/if}

  <!-- Task Edit Modal -->
  {#if ui.editingTask}
    <TaskEditModal task={ui.editingTask} />
  {/if}

  <!-- Confirmation Modal -->
  <ConfirmationModal />

  <!-- Review Modal -->
  {#if isReviewOpen}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="modal-overlay"
      onclick={() => isReviewOpen = false}
      onkeydown={(e) => e.key === 'Escape' && (isReviewOpen = false)}
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="review-modal" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
        <button class="modal-close" onclick={() => isReviewOpen = false}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
        <ReviewPanel />
      </div>
    </div>
  {/if}

  <!-- Toast -->
  {#if ui.toastMessage}
    <div class="toast-container" role="alert" aria-live="polite">
      <div class="toast {ui.toastType}">
        <span class="toast-message">{ui.toastMessage}</span>
        <button class="toast-close" onclick={hideToast} aria-label={t('action.close')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </div>
  {/if}

  <!-- Confetti -->
  <Confetti active={showConfetti} />

  <!-- Immersive Pomodoro Mode -->
  {#if ui.isImmersiveMode}
    <ImmersivePomodoro onClose={exitImmersiveMode} />
  {/if}
{/if}

<style>
  .loading-screen {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100vh;
    width: 100vw;
    background: var(--bg-primary);
  }

  .loading-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
  }

  .loading-icon {
    font-size: 40px;
    animation: bounce 1.2s ease-in-out infinite;
  }

  .loading-text {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-muted);
    letter-spacing: 0.02em;
  }

  @keyframes bounce {
    0%, 100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-8px);
    }
  }

  .main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--bg-primary);
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    padding: 12px 20px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-subtle);
    flex-shrink: 0;
  }

  .header-left {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .header-center {
    flex: 1;
    max-width: 380px;
  }

  .header-right {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .search-trigger {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 9px 14px;
    background: var(--input-bg);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    color: var(--text-muted);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .search-trigger:hover {
    border-color: var(--border-color);
    background: var(--hover-bg);
  }

  .search-trigger .search-icon {
    width: 15px;
    height: 15px;
    opacity: 0.7;
  }

  .search-placeholder {
    flex: 1;
    text-align: left;
    font-size: 13px;
    font-weight: 450;
  }

  .task-form-container {
    padding: 16px 20px;
    flex-shrink: 0;
  }

  .content-layout {
    flex: 1;
    overflow: hidden;
    padding: 0 20px 20px;
  }


  /* View toggle */
  .view-toggle {
    display: flex;
    /* Removed background for inconspicuous design */
    padding: 0;
    gap: 4px;
  }

  .view-btn {
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
    opacity: 0.6; /* Lower opacity for subtle look */
  }

  .view-btn:hover {
    color: var(--text-secondary);
    background: var(--hover-bg);
    opacity: 1;
  }

  .view-btn.active {
    background: var(--bg-secondary); /* Subtle background for active */
    color: var(--primary);
    opacity: 1;
    /* Removed shadow for flatter design */
  }

  .view-btn svg {
    width: 16px;
    height: 16px;
  }

  /* Theme toggle in header */
  .theme-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border: none;
    border-radius: var(--radius-md);
    background: var(--action-btn-bg);
    color: var(--text-secondary);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .theme-toggle:hover {
    background: var(--action-btn-hover-bg);
    color: var(--text-primary);
  }

  .theme-toggle svg {
    width: 16px;
    height: 16px;
  }

  /* Search Results */
  .search-empty {
    padding: 32px 20px;
    text-align: center;
    color: var(--text-muted);
    font-size: 13px;
    font-weight: 450;
  }

  .result-priority {
    font-weight: 700;
    font-size: 11px;
    width: 18px;
    color: var(--primary);
  }

  .result-content {
    flex: 1;
    font-size: 13px;
    font-weight: 450;
    color: var(--text-primary);
  }

  .result-tag {
    font-size: 10px;
    font-weight: 500;
    padding: 2px 6px;
    border-radius: var(--radius-sm);
    background: var(--tag-bg);
    color: var(--text-secondary);
  }

  .result-tag.project {
    background: rgba(177, 151, 252, 0.12);
    color: #b197fc;
  }

  /* Modal Overlay */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    animation: fadeIn 0.2s ease;
  }

  .review-modal {
    position: relative;
    width: 100%;
    max-width: 600px;
    max-height: 85vh;
    overflow-y: auto;
    animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .modal-close {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 32px;
    height: 32px;
    border: none;
    border-radius: var(--radius-sm);
    background: var(--hover-bg);
    color: var(--text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1;
    transition: all var(--transition-fast);
  }

  .modal-close:hover {
    background: var(--card-hover-bg);
    color: var(--text-primary);
  }

  .modal-close svg {
    width: 18px;
    height: 18px;
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

  /* Responsive */
  @media (max-width: 768px) {
    .content-layout {
      padding: 0 16px 16px;
    }

    .header {
      flex-wrap: wrap;
      padding: 12px 16px;
    }

    .header-center {
      order: 3;
      width: 100%;
      max-width: none;
      margin-top: 8px;
    }

    .task-form-container {
      padding: 12px 16px;
    }
  }
</style>
