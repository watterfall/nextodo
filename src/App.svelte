<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import ZoneContainer from '$lib/components/ZoneContainer.svelte';
  import TaskInput from '$lib/components/TaskInput.svelte';
  import PomodoroTimer from '$lib/components/PomodoroTimer.svelte';
  import QuotaMeter from '$lib/components/QuotaMeter.svelte';
  import UnitNav from '$lib/components/UnitNav.svelte';
  import ReviewPanel from '$lib/components/ReviewPanel.svelte';
  import Confetti from '$lib/components/Confetti.svelte';
  import ImmersivePomodoro from '$lib/components/ImmersivePomodoro.svelte';

  import {
    initializeData,
    getTasksStore,
    setSearchQuery,
    incrementPomodoro,
    reloadData
  } from '$lib/stores/tasks.svelte';
  import {
    getUIStore,
    initKeyboardShortcuts,
    registerKeyboardCallbacks,
    hideToast,
    closeSearch,
    exitImmersiveMode,
    enterImmersiveMode
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
  import { initI18n, t, availableLanguages, setLanguage } from '$lib/i18n';

  import type { Priority, Language } from '$lib/types';

  const tasks = getTasksStore();
  const ui = getUIStore();
  const pomodoro = getPomodoroStore();
  const settings = getSettingsStore();

  let showConfetti = $state(false);
  let searchInput = $state('');
  let isInitialized = $state(false);
  let unlistenFileWatcher: (() => void) | null = null;
  let taskInputRef: { focus: () => void } | undefined = $state();

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

    // Register keyboard callbacks for Ctrl+N (new task) and Space (toggle pomodoro)
    registerKeyboardCallbacks({
      focusNewTask: () => {
        taskInputRef?.focus();
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
        return;
      }
      if (pomodoro.state !== 'idle') {
        console.log('Skipping reload - pomodoro is active');
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

  function handleImmersiveMode() {
    if (pomodoro.state !== 'idle') {
      enterImmersiveMode();
    }
  }

  function getThemeIcon(): string {
    if (settings.theme === 'system') return 'system';
    return settings.effectiveTheme;
  }

  const priorities: Priority[] = ['A', 'B', 'C', 'D', 'E'];
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
  <Sidebar />

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
          <span class="search-placeholder">{t('filter.search')}</span>
          <kbd>⌘K</kbd>
        </button>
      </div>

      <div class="header-right">
        <QuotaMeter />

        <!-- Theme Toggle -->
        <button class="theme-toggle" onclick={toggleTheme} title="切换主题">
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

    <!-- Main Layout -->
    <div class="content-layout">
      <!-- Left: Task Zones -->
      <div class="zones-panel">
        <div class="main-input">
          <TaskInput bind:this={taskInputRef} placeholder={t('task.addPlaceholder')} />
        </div>

        <div class="zones-grid">
          {#each priorities as priority}
            <ZoneContainer
              {priority}
              tasks={tasks.tasksByPriority[priority]}
            />
          {/each}
        </div>
      </div>

      <!-- Right: Timer & Reviews -->
      <div class="side-panel">
        <PomodoroTimer onEnterImmersive={handleImmersiveMode} />

        {#if tasks.currentUnit.isReviewDay}
          <ReviewPanel />
        {/if}
      </div>
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
      aria-label="搜索任务"
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
        <div class="search-results" role="listbox" aria-label="搜索结果">
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

  <!-- Toast -->
  {#if ui.toastMessage}
    <div class="toast-container" role="alert" aria-live="polite">
      <div class="toast {ui.toastType}">
        <span class="toast-message">{ui.toastMessage}</span>
        <button class="toast-close" onclick={hideToast} aria-label="关闭通知">
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
    gap: 16px;
  }

  .loading-icon {
    font-size: 48px;
    animation: bounce 1s ease-in-out infinite;
  }

  .loading-text {
    font-size: 14px;
    color: var(--text-muted);
  }

  @keyframes bounce {
    0%, 100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-10px);
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
    gap: 24px;
    padding: 16px 24px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
  }

  .header-left {
    flex-shrink: 0;
  }

  .header-center {
    flex: 1;
    max-width: 400px;
  }

  .header-right {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .search-trigger {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 10px 16px;
    background: var(--input-bg);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .search-trigger:hover {
    border-color: var(--text-muted);
  }

  .search-trigger .search-icon {
    width: 16px;
    height: 16px;
  }

  .search-placeholder {
    flex: 1;
    text-align: left;
    font-size: 14px;
  }

  .content-layout {
    display: flex;
    flex: 1;
    overflow: hidden;
    gap: 24px;
    padding: 24px;
  }

  .zones-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 20px;
    overflow-y: auto;
  }

  .main-input {
    flex-shrink: 0;
  }

  .zones-grid {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .side-panel {
    width: 280px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 20px;
    overflow-y: auto;
  }

  /* Search Results */
  .search-empty {
    padding: 40px 20px;
    text-align: center;
    color: var(--text-muted);
    font-size: 14px;
  }

  .result-priority {
    font-weight: 700;
    font-size: 12px;
    width: 20px;
  }

  .result-content {
    flex: 1;
    font-size: 14px;
    color: var(--text-primary);
  }

  .result-tag {
    font-size: 11px;
    padding: 2px 6px;
    border-radius: 4px;
    background: var(--tag-bg);
    color: var(--text-secondary);
  }

  .result-tag.project {
    background: rgba(139, 92, 246, 0.2);
    color: #a78bfa;
  }

  /* Theme toggle in header */
  .theme-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: var(--action-btn-bg);
    color: var(--text-secondary);
    transition: all 0.15s ease;
  }

  .theme-toggle:hover {
    background: var(--action-btn-hover-bg);
    color: var(--text-primary);
  }

  .theme-toggle svg {
    width: 18px;
    height: 18px;
  }

  /* Responsive */
  @media (max-width: 1024px) {
    .side-panel {
      width: 240px;
    }
  }

  @media (max-width: 768px) {
    .content-layout {
      flex-direction: column;
    }

    .side-panel {
      width: 100%;
      flex-direction: row;
      overflow-x: auto;
    }

    .header {
      flex-wrap: wrap;
    }

    .header-center {
      order: 3;
      width: 100%;
      max-width: none;
    }
  }
</style>
