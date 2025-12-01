<script lang="ts">
  import { getTasksStore, addTaskDirect, updateTask } from '$lib/stores/tasks.svelte';
  import TaskCard from './TaskCard.svelte';
  import InboxPanel from './InboxPanel.svelte';
  import { getI18nStore } from '$lib/i18n';
  import { fade, slide } from 'svelte/transition';
  import { createEmptyTask } from '$lib/types';
  import { isToday, isOverdue } from '$lib/utils/unitCalc';
  import { dndzone, TRIGGERS } from 'svelte-dnd-action';
  import { flip } from 'svelte/animate';

  const tasks = getTasksStore();
  const i18n = getI18nStore();
  const t = i18n.t;

  // Inbox Drawer State
  let isInboxOpen = $state(false);

  // Get tasks due today or overdue
  const todayTasks = $derived(tasks.tasks.filter(task =>
    !task.completed &&
    task.dueDate &&
    (isToday(task.dueDate) || isOverdue(task.dueDate))
  ).sort((a, b) => {
    // Sort by priority first, then due date
    if (a.priority !== b.priority) {
      return a.priority.localeCompare(b.priority);
    }
    return 0;
  }));

  const completedTodayTasks = $derived(tasks.tasks.filter(task =>
    task.completed &&
    task.completedAt &&
    isToday(task.completedAt)
  ));

  // Progress
  const totalToday = $derived(todayTasks.length + completedTodayTasks.length);
  const progress = $derived(totalToday > 0 ? (completedTodayTasks.length / totalToday) * 100 : 0);

  // Group today tasks by priority for better visual scanning
  const groupedTasks = $derived({
    high: todayTasks.filter(task => task.priority === 'A' || task.priority === 'B'),
    standard: todayTasks.filter(task => task.priority === 'C' || task.priority === 'D'),
    other: todayTasks.filter(task => task.priority === 'E')
  });

  // Today's Date
  const todayDate = new Date().toLocaleDateString('zh-CN', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric' 
  });

  function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return '早上好';
    if (hour < 18) return '下午好';
    return '晚上好';
  }

  // DnD Handlers for Today's view to accept tasks
  // NOTE: Implementing full DND across components is complex in Svelte 5 + svelte-dnd-action
  // For now, dragging from InboxPanel will work via standard HTML5 DnD if we use that, 
  // OR we rely on InboxPanel's dndzone.
  
  // Since InboxPanel uses dndzone, we should probably make this view a dndzone too if we want smooth sorting.
  // However, grouping complicates things. 
  // Let's implement a "Plan Day" button instead of drag-and-drop for now if DND is too hard, 
  // OR use a simple drop zone at the bottom.
</script>

<div class="today-view-container" class:with-drawer={isInboxOpen}>
  <div class="today-content" in:fade={{ duration: 300 }}>
    <!-- Header -->
    <div class="view-header">
      <div class="header-content">
        <div class="date-label">{todayDate}</div>
        <h1>{getGreeting()}，准备好专注了吗？</h1>
        <p class="subtitle">
          你有 <strong>{todayTasks.length}</strong> 个任务计划在今天完成。
        </p>
      </div>
      
      <div class="header-actions">
        <div class="progress-card">
          <div class="progress-info">
            <span>今日进度</span>
            <span class="percentage">{Math.round(progress)}%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style:width="{progress}%"></div>
          </div>
        </div>
        
        <button 
          class="inbox-toggle" 
          class:active={isInboxOpen}
          onclick={() => isInboxOpen = !isInboxOpen}
          title={isInboxOpen ? "隐藏收集箱" : "显示收集箱 (用于规划)"}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
            <polyline points="22,6 12,13 2,6"></polyline>
          </svg>
          <span class="count-badge">{tasks.tasksByPriority['E'].filter(task => !task.completed).length}</span>
        </button>
      </div>
    </div>

    <div class="tasks-container">
      {#if todayTasks.length === 0 && completedTodayTasks.length === 0}
        <div class="empty-state">
          <div class="empty-icon">☕</div>
          <h3>今天没有计划任务</h3>
          <p>享受你的闲暇时光，或者打开收集箱规划任务。</p>
          {#if !isInboxOpen}
            <button class="btn-primary" onclick={() => isInboxOpen = true}>
              从收集箱规划
            </button>
          {/if}
        </div>
      {:else}
        <!-- High Priority Section -->
        {#if groupedTasks.high.length > 0}
          <section class="task-section high-priority">
            <h3 class="section-title">🔥 核心与重要</h3>
            <div class="task-list">
              {#each groupedTasks.high as task (task.id)}
                <div animate:slide={{ duration: 200 }}>
                  <TaskCard {task} showPriority />
                </div>
              {/each}
            </div>
          </section>
        {/if}

        <!-- Standard Priority Section -->
        {#if groupedTasks.standard.length > 0}
          <section class="task-section">
            <h3 class="section-title">📋 日常推进</h3>
            <div class="task-list">
              {#each groupedTasks.standard as task (task.id)}
                <div animate:slide={{ duration: 200 }}>
                  <TaskCard {task} showPriority />
                </div>
              {/each}
            </div>
          </section>
        {/if}

        <!-- Other Section -->
        {#if groupedTasks.other.length > 0}
          <section class="task-section">
            <h3 class="section-title">📥 其他</h3>
            <div class="task-list">
              {#each groupedTasks.other as task (task.id)}
                <div animate:slide={{ duration: 200 }}>
                  <TaskCard {task} showPriority />
                </div>
              {/each}
            </div>
          </section>
        {/if}

        <!-- Completed Section -->
        {#if completedTodayTasks.length > 0}
          <section class="task-section completed">
            <h3 class="section-title">✅ 已完成</h3>
            <div class="task-list">
              {#each completedTodayTasks as task (task.id)}
                <div animate:slide={{ duration: 200 }}>
                  <TaskCard {task} compact showPriority />
                </div>
              {/each}
            </div>
          </section>
        {/if}
      {/if}
    </div>
  </div>

  <!-- Inbox Drawer -->
  <div class="inbox-drawer" class:open={isInboxOpen}>
    <InboxPanel isDrawer={true} />
  </div>
</div>

<style>
  .today-view-container {
    display: flex;
    height: 100%;
    position: relative;
    overflow: hidden;
  }

  .today-content {
    flex: 1;
    overflow-y: auto;
    padding: 24px 40px;
    max-width: 900px;
    margin: 0 auto;
    transition: margin-right 0.3s ease;
  }

  .inbox-drawer {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 320px;
    background: var(--bg-secondary);
    border-left: 1px solid var(--border-subtle);
    transform: translateX(100%);
    transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    z-index: 10;
  }

  .inbox-drawer.open {
    transform: translateX(0);
    box-shadow: var(--shadow-lg);
  }

  /* When drawer is open, we can shift content if screen is large enough, 
     or just overlap on smaller screens. 
     Here we just overlap for simplicity or let it slide in. */

  .view-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 40px;
    gap: 32px;
  }

  .header-content h1 {
    font-size: 28px;
    font-weight: 700;
    margin-bottom: 8px;
    color: var(--text-primary);
  }

  .date-label {
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-secondary);
    font-weight: 600;
    margin-bottom: 8px;
  }

  .subtitle {
    color: var(--text-muted);
    font-size: 15px;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .progress-card {
    background: var(--card-bg);
    border: 1px solid var(--border-subtle);
    padding: 16px 20px;
    border-radius: var(--radius-lg);
    width: 240px;
    box-shadow: var(--shadow-sm);
  }

  .progress-info {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8px;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .percentage {
    color: var(--primary);
    font-weight: 700;
  }

  .progress-bar {
    height: 8px;
    background: var(--bg-primary);
    border-radius: 4px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--primary), #d0bfff);
    border-radius: 4px;
    transition: width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .inbox-toggle {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: var(--card-bg);
    border: 1px solid var(--border-subtle);
    color: var(--text-muted);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    position: relative;
    transition: all 0.2s;
  }

  .inbox-toggle:hover {
    color: var(--text-primary);
    border-color: var(--border-color);
    background: var(--hover-bg);
  }

  .inbox-toggle.active {
    background: var(--primary-bg);
    color: var(--primary);
    border-color: var(--primary);
  }

  .inbox-toggle svg {
    width: 20px;
    height: 20px;
  }

  .count-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    background: var(--primary);
    color: white;
    font-size: 10px;
    font-weight: 700;
    min-width: 18px;
    height: 18px;
    border-radius: 9px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid var(--bg-primary);
  }

  .tasks-container {
    display: flex;
    flex-direction: column;
    gap: 32px;
    padding-bottom: 40px;
  }

  .task-section {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .section-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-secondary);
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border-subtle);
  }

  .task-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .high-priority .section-title {
    color: var(--primary);
    border-bottom-color: var(--primary-glow);
  }

  .completed {
    opacity: 0.7;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 0;
    text-align: center;
    color: var(--text-muted);
  }

  .empty-icon {
    font-size: 48px;
    margin-bottom: 16px;
  }

  .empty-state h3 {
    font-size: 18px;
    margin-bottom: 8px;
    color: var(--text-primary);
  }

  .btn-primary {
    margin-top: 16px;
    background: var(--primary);
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 99px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-primary:hover {
    background: var(--primary-hover);
    transform: translateY(-2px);
  }
  
  /* Responsive */
  @media (max-width: 768px) {
    .today-content {
      padding: 16px 20px;
    }
    
    .view-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 20px;
    }
    
    .header-actions {
      width: 100%;
      justify-content: space-between;
    }

    .progress-card {
      flex: 1;
    }
    
    .inbox-drawer {
      width: 100%;
    }
  }
</style>
