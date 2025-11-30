<script lang="ts">
  import { onMount } from 'svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import ZoneContainer from '$lib/components/ZoneContainer.svelte';
  import TaskInput from '$lib/components/TaskInput.svelte';
  import PomodoroTimer from '$lib/components/PomodoroTimer.svelte';
  import QuotaMeter from '$lib/components/QuotaMeter.svelte';
  import UnitNav from '$lib/components/UnitNav.svelte';
  import ReviewPanel from '$lib/components/ReviewPanel.svelte';
  import Confetti from '$lib/components/Confetti.svelte';

  import {
    initializeData,
    getTasksStore,
    setSearchQuery,
    incrementPomodoro
  } from '$lib/stores/tasks.svelte';
  import {
    getUIStore,
    initKeyboardShortcuts,
    hideToast,
    closeSearch
  } from '$lib/stores/ui.svelte';
  import {
    initPomodoro,
    getPomodoroStore
  } from '$lib/stores/pomodoro.svelte';
  import {
    initSettings,
    getSettingsStore
  } from '$lib/stores/settings.svelte';
  import { initReviews } from '$lib/stores/reviews.svelte';
  import { saveAppData } from '$lib/utils/storage';

  import type { Priority } from '$lib/types';

  const tasks = getTasksStore();
  const ui = getUIStore();
  const pomodoro = getPomodoroStore();
  const settings = getSettingsStore();

  let showConfetti = $state(false);
  let searchInput = $state('');
  let isInitialized = $state(false);

  onMount(async () => {
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

    // Listen for pomodoro complete events
    window.addEventListener('pomodoro-complete', ((e: CustomEvent) => {
      incrementPomodoro(e.detail.taskId);
      showConfetti = true;
      setTimeout(() => showConfetti = false, 100);
    }) as EventListener);

    isInitialized = true;
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

  const priorities: Priority[] = ['A', 'B', 'C', 'D', 'E'];
</script>

<svelte:head>
  <title>FocusFlow - 专注力优先的任务管理器</title>
</svelte:head>

{#if tasks.isLoading || !isInitialized}
  <div class="loading-screen">
    <div class="loading-content">
      <span class="loading-icon">🍅</span>
      <div class="loading-spinner"></div>
      <span class="loading-text">加载中...</span>
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
          <span class="search-placeholder">搜索任务...</span>
          <kbd>⌘K</kbd>
        </button>
      </div>

      <div class="header-right">
        <QuotaMeter />
      </div>
    </header>

    <!-- Main Layout -->
    <div class="content-layout">
      <!-- Left: Task Zones -->
      <div class="zones-panel">
        <div class="main-input">
          <TaskInput placeholder="快速添加任务 (+项目 @上下文 #标签 !A-E ~日期 🍅数量)" />
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
        <PomodoroTimer />

        {#if tasks.currentUnit.isReviewDay}
          <ReviewPanel />
        {/if}
      </div>
    </div>
  </main>

  <!-- Search Overlay -->
  {#if ui.isSearchOpen}
    <div class="search-overlay" onclick={closeSearch} role="dialog" aria-modal="true">
      <div class="search-box" onclick={(e) => e.stopPropagation()}>
        <div class="search-input-wrapper">
          <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            class="search-input"
            placeholder="搜索任务、项目、标签..."
            value={searchInput}
            oninput={handleSearchInput}
            onkeydown={handleSearchKeydown}
          />
        </div>
        <div class="search-results">
          {#each tasks.filteredTasks.slice(0, 10) as task (task.id)}
            <div class="search-result-item" onclick={() => { closeSearch(); searchInput = ''; setSearchQuery(''); }}>
              <span class="result-priority" style:color="var(--priority-{task.priority.toLowerCase()}-color)">
                {task.priority}
              </span>
              <span class="result-content">{task.content}</span>
              {#each task.projects as project}
                <span class="result-tag project">{project}</span>
              {/each}
            </div>
          {:else}
            <div class="search-empty">
              {searchInput ? '未找到匹配的任务' : '输入关键词开始搜索'}
            </div>
          {/each}
        </div>
      </div>
    </div>
  {/if}

  <!-- Toast -->
  {#if ui.toastMessage}
    <div class="toast-container">
      <div class="toast {ui.toastType}">
        <span class="toast-message">{ui.toastMessage}</span>
        <button class="toast-close" onclick={hideToast}>
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
