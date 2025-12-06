<script lang="ts">
  import { getTasksStore } from '$lib/stores/tasks.svelte';
  import { getI18nStore } from '$lib/i18n';
  import { fade } from 'svelte/transition';
  import type { Task } from '$lib/types';
  import TaskCard from './TaskCard.svelte';

  const tasks = getTasksStore();
  const i18n = getI18nStore();
  const t = i18n.t;

  // Calendar State
  let currentDate = $state(new Date());
  let selectedDate = $state<string | null>(new Date().toISOString().split('T')[0]);

  // Generate calendar days
  const calendarDays = $derived.by(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const days = [];
    
    // Add padding days from previous month
    const startPadding = firstDay.getDay(); // 0 is Sunday
    for (let i = startPadding; i > 0; i--) {
      const d = new Date(year, month, 1 - i);
      days.push({
        date: d,
        dateStr: d.toISOString().split('T')[0],
        dayNum: d.getDate(),
        isCurrentMonth: false,
        isToday: isSameDay(d, new Date())
      });
    }
    
    // Add days of current month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const d = new Date(year, month, i);
      days.push({
        date: d,
        dateStr: d.toISOString().split('T')[0],
        dayNum: i,
        isCurrentMonth: true,
        isToday: isSameDay(d, new Date())
      });
    }
    
    // Add padding days for next month to complete the grid (42 cells max for 6 rows)
    const remainingSlots = 42 - days.length;
    for (let i = 1; i <= remainingSlots; i++) {
      const d = new Date(year, month + 1, i);
      days.push({
        date: d,
        dateStr: d.toISOString().split('T')[0],
        dayNum: i,
        isCurrentMonth: false,
        isToday: isSameDay(d, new Date())
      });
    }
    
    return days;
  });

  function isSameDay(d1: Date, d2: Date) {
    return d1.getDate() === d2.getDate() && 
           d1.getMonth() === d2.getMonth() && 
           d1.getFullYear() === d2.getFullYear();
  }

  function getTasksForDate(dateStr: string): Task[] {
    // Return all tasks for that date, not just incomplete ones
    // This allows seeing history in calendar
    return tasks.tasks.filter(task => {
      // Check due date
      if (task.dueDate === dateStr) return true;
      
      // Check completed date for history
      if (task.completed && task.completedAt && task.completedAt.startsWith(dateStr)) return true;
      
      return false;
    });
  }

  function changeMonth(delta: number) {
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + delta, 1);
  }

  function selectDate(dateStr: string) {
    selectedDate = dateStr;
  }

  const selectedDateTasks = $derived(selectedDate ? getTasksForDate(selectedDate) : []);
  const monthLabel = $derived(currentDate.toLocaleDateString(i18n.language, { month: 'long', year: 'numeric' }));
  const weekdays = $derived(i18n.locale.date.weekdaysShort);

</script>

<div class="calendar-container" in:fade={{ duration: 300 }}>
  <!-- Calendar Grid -->
  <div class="calendar-main">
    <div class="calendar-header">
      <button class="nav-btn" onclick={() => changeMonth(-1)}>&lt;</button>
      <h2>{monthLabel}</h2>
      <button class="nav-btn" onclick={() => changeMonth(1)}>&gt;</button>
    </div>

    <div class="weekdays-row">
      {#each weekdays as day}
        <div class="weekday">{day}</div>
      {/each}
    </div>

    <div class="days-grid">
      {#each calendarDays as day}
        {@const dayTasks = getTasksForDate(day.dateStr)}
        {@const hasTasks = dayTasks.length > 0}
        <button 
          class="day-cell" 
          class:current-month={day.isCurrentMonth}
          class:today={day.isToday}
          class:selected={selectedDate === day.dateStr}
          class:has-tasks={hasTasks}
          onclick={() => selectDate(day.dateStr)}
        >
          <span class="day-num">{day.dayNum}</span>
          {#if hasTasks}
            <div class="task-dots">
              {#each dayTasks.slice(0, 3) as task}
                <div class="dot" style:background="var(--priority-{task.priority.toLowerCase()}-color, var(--primary))"></div>
              {/each}
              {#if dayTasks.length > 3}
                <span class="more-dots">+</span>
              {/if}
            </div>
          {/if}
        </button>
      {/each}
    </div>
  </div>

  <!-- Selected Date Details -->
  <div class="day-details">
    <div class="details-header">
      <h3>
        {selectedDate ? new Date(selectedDate).toLocaleDateString(i18n.language, { month: 'short', day: 'numeric', weekday: 'long' }) : 'Select a date'}
      </h3>
      <span class="task-count">{selectedDateTasks.length} {t('sidebar.allTasks')}</span>
    </div>

    <div class="tasks-list">
      {#if selectedDateTasks.length > 0}
        {#each selectedDateTasks as task (task.id)}
          <div class="task-item">
            <TaskCard {task} compact showPriority />
          </div>
        {/each}
      {:else}
        <div class="empty-state">
          <span>{t('zone.empty')}</span>
          <p class="empty-hint">{t('todayView.empty.subtitle')}</p>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .calendar-container {
    display: flex;
    height: 100%;
    gap: 20px;
    padding: 20px;
    overflow: hidden;
  }

  .calendar-main {
    flex: 2;
    display: flex;
    flex-direction: column;
    background: var(--card-bg);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    padding: 20px;
    min-width: 0;
  }

  .calendar-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }

  .calendar-header h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .nav-btn {
    background: transparent;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    width: 32px;
    height: 32px;
    cursor: pointer;
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .nav-btn:hover {
    background: var(--hover-bg);
    color: var(--text-primary);
  }

  .weekdays-row {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    margin-bottom: 10px;
    text-align: center;
  }

  .weekday {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
  }

  .days-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    grid-auto-rows: 1fr;
    gap: 4px;
    flex: 1;
  }

  .day-cell {
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    padding: 8px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    cursor: pointer;
    transition: all 0.2s;
    min-height: 80px;
    position: relative;
  }

  .day-cell:hover {
    background: var(--hover-bg);
  }

  .day-cell.selected {
    background: var(--primary-bg);
    border-color: var(--primary);
  }

  .day-cell.today {
    background: var(--bg-secondary);
    font-weight: 700;
  }

  .day-cell.today .day-num {
    color: var(--primary);
    background: var(--primary-bg);
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
  }

  .day-cell:not(.current-month) {
    opacity: 0.3;
  }

  .day-num {
    font-size: 14px;
    color: var(--text-primary);
    margin-bottom: 4px;
  }

  .task-dots {
    display: flex;
    gap: 3px;
    flex-wrap: wrap;
  }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  .more-dots {
    font-size: 10px;
    color: var(--text-muted);
    line-height: 1;
  }

  /* Day Details Side Panel */
  .day-details {
    flex: 1;
    background: var(--bg-secondary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 300px;
  }

  .details-header {
    padding: 20px;
    border-bottom: 1px solid var(--border-subtle);
    background: var(--card-bg);
  }

  .details-header h3 {
    margin: 0 0 4px 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .task-count {
    font-size: 12px;
    color: var(--text-muted);
  }

  .tasks-list {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
    text-align: center;
    padding: 20px;
  }

  .empty-hint {
    font-size: 12px;
    margin-top: 8px;
    max-width: 200px;
  }

  @media (max-width: 900px) {
    .calendar-container {
      flex-direction: column;
    }
    
    .day-details {
      max-height: 300px;
    }
  }
</style>

