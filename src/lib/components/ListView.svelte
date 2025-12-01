<script lang="ts">
  import { getTasksStore } from '$lib/stores/tasks.svelte';
  import TaskCard from './TaskCard.svelte';
  import { getI18nStore } from '$lib/i18n';
  import { slide } from 'svelte/transition';
  import { PRIORITY_CONFIG, type Priority } from '$lib/types';
  import PomodoroTimer from './PomodoroTimer.svelte';
  import { getPomodoroStore } from '$lib/stores/pomodoro.svelte';
  import { enterImmersiveMode, getUIStore } from '$lib/stores/ui.svelte';

  const tasks = getTasksStore();
  const ui = getUIStore();
  const pomodoro = getPomodoroStore();
  const i18n = getI18nStore();
  const t = i18n.t;

  const priorities: Priority[] = ['A', 'B', 'C', 'D', 'E'];

  // Group tasks by priority
  const groupedTasks = $derived({
    A: tasks.tasksByPriority['A'].filter(task => !task.completed),
    B: tasks.tasksByPriority['B'].filter(task => !task.completed),
    C: tasks.tasksByPriority['C'].filter(task => !task.completed),
    D: tasks.tasksByPriority['D'].filter(task => !task.completed),
    E: tasks.tasksByPriority['E'].filter(task => !task.completed)
  });

  const completedTasks = $derived(tasks.tasks.filter(task => task.completed));
  let showCompleted = $state(false);

  function handleImmersiveMode() {
    if (pomodoro.state !== 'idle') {
      enterImmersiveMode();
    }
  }
</script>

<div class="list-view-container">
  <div class="list-content">
    <div class="tasks-container">
      {#each priorities as priority}
        {@const priorityTasks = groupedTasks[priority]}
        {#if priorityTasks.length > 0} <!-- Only show if has tasks -->
          <section class="task-section" class:priority-section={true} style:--section-color={PRIORITY_CONFIG[priority].color}>
            <div class="section-header">
              <div class="header-left">
                <span class="priority-badge">{priority}</span>
                <h3 class="section-title">{t(`priority.${priority}`)}</h3>
              </div>
              <span class="count-badge">{priorityTasks.length}</span>
            </div>
            
            <div class="task-list">
              {#each priorityTasks as task (task.id)}
                <div animate:slide={{ duration: 200 }}>
                  <TaskCard {task} />
                </div>
              {/each}
              {#if priorityTasks.length === 0}
                 <div class="empty-section-hint">{t('zone.empty')}</div>
              {/if}
            </div>
          </section>
        {/if}
      {/each}

      <!-- Completed Section -->
      {#if completedTasks.length > 0}
        <section class="task-section completed-section">
          <button class="completed-toggle" onclick={() => showCompleted = !showCompleted}>
            <div class="header-left">
              <span class="toggle-icon" class:rotated={showCompleted}>▶</span>
              <h3 class="section-title">{t('filter.completed')}</h3>
            </div>
            <span class="count-badge">{completedTasks.length}</span>
          </button>
          
          {#if showCompleted}
            <div class="task-list" transition:slide>
              {#each completedTasks as task (task.id)}
                <TaskCard {task} compact showPriority />
              {/each}
            </div>
          {/if}
        </section>
      {/if}
    </div>
  </div>

  <div class="timer-sidebar">
    <PomodoroTimer onEnterImmersive={handleImmersiveMode} />
  </div>
</div>

<style>
  .list-view-container {
    display: flex;
    height: 100%;
    gap: 20px;
    overflow: hidden;
  }

  .list-content {
    flex: 1;
    overflow-y: auto;
    padding-right: 4px;
  }

  .timer-sidebar {
    width: 300px;
    flex-shrink: 0;
  }

  .tasks-container {
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding-bottom: 40px;
  }

  .task-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border-subtle);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .priority-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 6px;
    background: var(--section-color);
    color: white;
    font-size: 13px;
    font-weight: 700;
  }

  .section-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }

  .count-badge {
    font-size: 12px;
    color: var(--text-muted);
    font-weight: 500;
    background: var(--bg-secondary);
    padding: 2px 8px;
    border-radius: 10px;
  }

  .task-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .empty-section-hint {
    font-size: 13px;
    color: var(--text-muted);
    font-style: italic;
    padding: 8px 0;
    opacity: 0.6;
  }

  .completed-section {
    margin-top: 20px;
    opacity: 0.8;
  }

  .completed-toggle {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 8px;
    border: none;
    border-bottom: 1px solid var(--border-subtle);
    background: transparent;
    width: 100%;
    cursor: pointer;
    color: var(--text-secondary);
  }

  .toggle-icon {
    font-size: 10px;
    transition: transform 0.2s;
    display: inline-block;
  }

  .toggle-icon.rotated {
    transform: rotate(90deg);
  }

  @media (max-width: 900px) {
    .list-view-container {
      flex-direction: column;
    }
    
    .timer-sidebar {
      width: 100%;
      height: auto;
      border-top: 1px solid var(--border-subtle);
      padding-top: 16px;
    }
  }
</style>

