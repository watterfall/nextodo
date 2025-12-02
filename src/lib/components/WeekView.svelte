<script lang="ts">
  import { getTasksStore, updateTask } from '$lib/stores/tasks.svelte';
  import TaskCard from './TaskCard.svelte';
  import InboxPanel from './InboxPanel.svelte';
  import { getI18nStore } from '$lib/i18n';
  import { fade } from 'svelte/transition';
  import type { Task } from '$lib/types';
  import { dndzone, TRIGGERS, SHADOW_ITEM_MARKER_PROPERTY_NAME } from 'svelte-dnd-action';
  import { flip } from 'svelte/animate';
  import { isToday } from '$lib/utils/unitCalc';
  import { dndConfig, areTaskArraysEqual, type DndConsiderEvent, type DndFinalizeEvent } from '$lib/utils/motion';
  import { isTauri } from '$lib/utils/storage';

  const tasks = getTasksStore();
  const i18n = getI18nStore();
  const t = i18n.t;

  // Inbox Drawer State
  let isInboxOpen = $state(false);

  // Generate next 7 days
  const weekDays = $derived(Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() + i);
    date.setHours(0, 0, 0, 0);
    return {
      date,
      dateStr: date.toISOString().split('T')[0],
      dayName: date.toLocaleDateString('zh-CN', { weekday: 'short' }),
      dayNum: date.getDate(),
      isToday: i === 0
    };
  }));

  // DnD type for cross-component dragging compatibility
  const DND_TYPE = 'task-priority-zone';

  // Group tasks by date
  // We need local state for DnD to work smoothly
  let columns = $state<Record<string, Task[]>>({});
  let activeDndColumn = $state<string | null>(null);

  function getTasksForDate(dateStr: string): Task[] {
    return tasks.tasks.filter(task => !task.completed && task.dueDate === dateStr);
  }

  // Sync with store (only when not actively dragging)
  $effect(() => {
    if (!activeDndColumn) {
      const newColumns: Record<string, Task[]> = {};

      // Initialize columns
      weekDays.forEach(day => {
        newColumns[day.dateStr] = [];
      });

      // Distribute tasks
      tasks.tasks.forEach(task => {
        if (!task.completed && task.dueDate) {
          // Only if due date matches one of our columns
          if (newColumns[task.dueDate]) {
            newColumns[task.dueDate].push(task);
          }
        }
      });

      // Check if update is needed to avoid unnecessary re-renders
      let needsUpdate = false;
      for (const day of weekDays) {
        if (!columns[day.dateStr] || !areTaskArraysEqual(columns[day.dateStr], newColumns[day.dateStr])) {
          needsUpdate = true;
          break;
        }
      }

      if (needsUpdate) {
        columns = newColumns;
      }
    }
  });

  function handleDndConsider(dateStr: string, e: DndConsiderEvent) {
    const { items, info } = e.detail;
    columns[dateStr] = [...items];

    if (info.trigger === TRIGGERS.DRAG_STARTED) {
      activeDndColumn = dateStr;
      // Suspend file watcher when drag starts
      if (isTauri()) {
        import('@tauri-apps/api/core').then(({ invoke }) => {
          invoke('suspend_watcher');
        });
      }
    }
  }

  async function handleDndFinalize(dateStr: string, e: DndFinalizeEvent) {
    const { items, info } = e.detail;

    // Filter out shadow placeholders
    const cleanItems = items.filter(item => !(item as any)[SHADOW_ITEM_MARKER_PROPERTY_NAME]);
    columns[dateStr] = [...cleanItems];

    try {
      if (info.trigger === TRIGGERS.DROPPED_INTO_ZONE) {
        const droppedTask = cleanItems.find(task => task.id === info.id);
        if (droppedTask) {
          const oldDateStr = droppedTask.dueDate;
          // Only update if the due date actually changed
          if (oldDateStr !== dateStr) {
            await updateTask(info.id, { dueDate: dateStr });
            // Refresh both source and target columns
            if (oldDateStr && columns[oldDateStr]) {
              columns[oldDateStr] = getTasksForDate(oldDateStr);
            }
            columns[dateStr] = getTasksForDate(dateStr);
          }
        }
      } else if (info.trigger === TRIGGERS.DROPPED_OUTSIDE_OF_ANY) {
        // Revert all columns
        weekDays.forEach(day => {
          columns[day.dateStr] = getTasksForDate(day.dateStr);
        });
      }
    } finally {
      activeDndColumn = null;
      // Resume file watcher
      if (isTauri()) {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('resume_watcher');
      }
    }
  }
</script>

<div class="week-view-container" class:with-drawer={isInboxOpen}>
  <div class="week-view" in:fade={{ duration: 300 }}>
    <div class="week-header">
      <h1>本周概览</h1>
      
      <div class="header-actions">
        <div class="week-legend">
          <span class="legend-item"><span class="dot planned"></span> 已计划</span>
          <span class="legend-item"><span class="dot done"></span> 已完成</span>
        </div>

        <button 
          class="inbox-toggle" 
          class:active={isInboxOpen}
          onclick={() => isInboxOpen = !isInboxOpen}
          title={isInboxOpen ? "隐藏收集箱" : "显示收集箱 (用于排期)"}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
            <polyline points="22,6 12,13 2,6"></polyline>
          </svg>
          <span class="count-badge">{tasks.tasksByPriority['E'].filter(task => !task.completed).length}</span>
        </button>
      </div>
    </div>

    <div class="week-grid">
      {#each weekDays as day}
        <div class="day-column" class:today={day.isToday}>
          <div class="day-header">
            <span class="day-name">{day.dayName}</span>
            <span class="day-num">{day.dayNum}</span>
          </div>
          
          <div
            class="day-tasks"
            use:dndzone={{
              items: columns[day.dateStr] || [],
              flipDurationMs: dndConfig.flipDurationMs,
              dropTargetStyle: {},
              dropTargetClasses: ['day-drop-target'],
              type: DND_TYPE
            }}
            onconsider={(e) => handleDndConsider(day.dateStr, e)}
            onfinalize={(e) => handleDndFinalize(day.dateStr, e)}
          >
            {#each columns[day.dateStr] || [] as task (task.id)}
              <div animate:flip={{ duration: dndConfig.flipDurationMs }} class="task-wrapper">
                <TaskCard {task} compact showPriority />
              </div>
            {/each}
            
            {#if (columns[day.dateStr] || []).length === 0}
              <div class="empty-slot">
                <span>空闲</span>
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  </div>

  <!-- Inbox Drawer -->
  <div class="inbox-drawer" class:open={isInboxOpen}>
    <InboxPanel isDrawer={true} />
  </div>
</div>

<style>
  .week-view-container {
    display: flex;
    height: 100%;
    position: relative;
    overflow: hidden;
  }

  .week-view {
    flex: 1;
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: 20px;
    overflow: hidden;
  }

  .week-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    flex-shrink: 0;
  }

  .week-header h1 {
    font-size: 24px;
    font-weight: 700;
    color: var(--text-primary);
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 20px;
  }

  .week-legend {
    display: flex;
    gap: 16px;
    font-size: 13px;
    color: var(--text-secondary);
  }

  .dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-right: 6px;
  }

  .dot.planned { background: var(--primary); }
  .dot.done { background: var(--success); }

  .week-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 12px;
    flex: 1;
    overflow-x: auto;
    overflow-y: hidden;
    min-width: 1000px; /* Ensure columns don't get too squashed */
  }

  .day-column {
    display: flex;
    flex-direction: column;
    background: var(--card-bg);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    height: 100%;
    overflow: hidden;
    transition: all 0.2s;
  }

  .day-column.today {
    border-color: var(--primary);
    background: var(--bg-secondary);
    box-shadow: 0 0 0 1px var(--primary-glow);
  }

  .day-header {
    padding: 12px;
    border-bottom: 1px solid var(--border-subtle);
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--hover-bg);
  }

  .day-name {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .day-num {
    font-size: 16px;
    font-weight: 700;
    color: var(--text-primary);
  }

  .day-column.today .day-num {
    color: var(--primary);
  }

  .day-tasks {
    flex: 1;
    padding: 8px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .task-wrapper {
    /* Limit task card height in week view */
  }

  .empty-slot {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
    font-size: 12px;
    opacity: 0.5;
    min-height: 40px;
    border: 1px dashed transparent;
    border-radius: var(--radius-md);
  }

  /* Drop target style */
  :global(.day-drop-target) {
    background: var(--primary-bg) !important;
    border: 1px dashed var(--primary) !important;
  }

  .inbox-toggle {
    width: 40px;
    height: 40px;
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
    width: 18px;
    height: 18px;
  }

  .count-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    background: var(--primary);
    color: white;
    font-size: 10px;
    font-weight: 700;
    min-width: 16px;
    height: 16px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid var(--bg-primary);
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
</style>
