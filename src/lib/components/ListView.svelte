<script lang="ts">
  import { changePriority, getTasksStore, promoteSubtask } from '$lib/stores/tasks.svelte';
  import { getI18nStore } from '$lib/i18n';
  import { slide } from 'svelte/transition';
  import { PRIORITY_CONFIG, type Priority, type Task, isActivePriority } from '$lib/types';
  import TaskCard from './TaskCard.svelte';
  import ZoneRail from './ZoneRail.svelte';
  import DropZone from './DropZone.svelte';
  import QuickAddRow from './QuickAddRow.svelte';
  import type { TaskDragPayload, SubtaskDragPayload } from '$lib/utils/dnd';
  import { isToday, isOverdue, parseISODate, getRelativeDayLabel } from '$lib/utils/unitCalc';

  type GroupBy = 'priority' | 'project' | 'context' | 'due' | 'tag' | 'none';
  type SortDir = 'asc' | 'desc';

  const tasks = getTasksStore();
  const i18n = getI18nStore();
  const t = i18n.t;

  // ===== Local view state =====
  let groupBy = $state<GroupBy>('priority');
  let sortDir = $state<SortDir>('asc');
  let collapsed = $state<Record<string, boolean>>({});

  // ===== Source list (active tasks only by default) =====
  const sourceTasks = $derived(tasks.tasks);

  // ===== Group key derivation =====
  function getDueBucket(task: Task): string {
    if (!task.dueDate) return '__no_due__';
    if (isOverdue(task.dueDate)) return '__overdue__';
    if (isToday(task.dueDate)) return '__today__';
    const due = parseISODate(task.dueDate);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 7) return '__week__';
    return '__later__';
  }

  function getDueBucketLabel(key: string): string {
    const map: Record<string, string> = {
      '__overdue__': t('list.due.overdue') || '逾期',
      '__today__': t('list.due.today') || '今天',
      '__week__': t('list.due.thisWeek') || '本周内',
      '__later__': t('list.due.later') || '稍后',
      '__no_due__': t('list.due.none') || '无截止日'
    };
    return map[key] || key;
  }

  function getStatusBucket(task: Task): string {
    if (task.priority === 'G') return '__completed__';
    if (task.priority === 'H') return '__cancelled__';
    return '__active__';
  }

  /**
   * Build groups based on current groupBy mode.
   * Returns ordered array of { key, label, tasks } so iteration order is stable.
   */
  const groups = $derived.by(() => {
    const result: Array<{ key: string; label: string; tasks: Task[]; meta?: string }> = [];
    const buckets: Record<string, Task[]> = {};

    // Active filter applied: hide completed unless status mode shows them
    const visibleTasks = groupBy === 'priority'
      ? sourceTasks.filter(t => isActivePriority(t.priority))
      : sourceTasks.filter(t => isActivePriority(t.priority));

    for (const task of visibleTasks) {
      let keys: string[] = [];
      switch (groupBy) {
        case 'priority':
          keys = [task.priority];
          break;
        case 'project':
          keys = task.projects.length > 0 ? task.projects : ['__no_project__'];
          break;
        case 'context':
          keys = task.contexts.length > 0 ? task.contexts : ['__no_context__'];
          break;
        case 'tag': {
          const realTags = task.customTags.filter(
            t => !['⚡高能量', '😴低能量', '☕中等'].includes(t)
          );
          keys = realTags.length > 0 ? realTags : ['__no_tag__'];
          break;
        }
        case 'due':
          keys = [getDueBucket(task)];
          break;
        case 'none':
          keys = ['__all__'];
          break;
      }
      for (const k of keys) {
        if (!buckets[k]) buckets[k] = [];
        buckets[k].push(task);
      }
    }

    // Convert to ordered list with labels
    // F (Idea Pool) is intentionally excluded — it lives in the ReservoirPanel above the view
    if (groupBy === 'priority') {
      const order: Priority[] = ['A', 'B', 'C', 'D', 'E'];
      for (const p of order) {
        const t = buckets[p] || [];
        result.push({
          key: p,
          label: `${p} · ${i18n.t(`priority.${p}`)}`,
          tasks: t,
          meta: PRIORITY_CONFIG[p].color
        });
      }
    } else if (groupBy === 'due') {
      const order = ['__overdue__', '__today__', '__week__', '__later__', '__no_due__'];
      for (const k of order) {
        if (buckets[k]) result.push({ key: k, label: getDueBucketLabel(k), tasks: buckets[k] });
      }
    } else if (groupBy === 'none') {
      if (buckets['__all__']) {
        result.push({ key: '__all__', label: t('list.allTasks') || '全部任务', tasks: buckets['__all__'] });
      }
    } else {
      // project / context / tag — alphabetical
      const keys = Object.keys(buckets).sort((a, b) => {
        // "no_*" buckets last
        if (a.startsWith('__no_')) return 1;
        if (b.startsWith('__no_')) return -1;
        return a.localeCompare(b);
      });
      for (const k of keys) {
        let label = k;
        if (k === '__no_project__') label = t('list.noProject') || '无项目';
        else if (k === '__no_context__') label = t('list.noContext') || '无情境';
        else if (k === '__no_tag__') label = t('list.noTag') || '无标签';
        else if (groupBy === 'project') label = `+${k}`;
        else if (groupBy === 'context') label = `@${k}`;
        else if (groupBy === 'tag') label = `#${k}`;
        result.push({ key: k, label, tasks: buckets[k] });
      }
    }

    // Sort tasks within each group
    for (const g of result) {
      g.tasks.sort((a, b) => {
        // Always priority asc within a group (unless groupBy is priority, then by created date)
        if (groupBy === 'priority') {
          // already grouped by priority; sort by createdAt
          const aT = new Date(a.createdAt || 0).getTime();
          const bT = new Date(b.createdAt || 0).getTime();
          return sortDir === 'asc' ? bT - aT : aT - bT; // asc = newest first by default
        }
        // For other groups, sort by priority first
        const cmp = a.priority.localeCompare(b.priority);
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    return result;
  });

  const totalTasks = $derived(groups.reduce((sum, g) => sum + g.tasks.length, 0));
  const listDropPriorities: Priority[] = ['A', 'B', 'C', 'D', 'E'];

  function isListDropPriority(key: string): key is Priority {
    return listDropPriorities.includes(key as Priority);
  }

  async function handleDropTaskInGroup(priority: Priority, payload: TaskDragPayload) {
    if (payload.fromPriority === priority) return null;
    const result = await changePriority(payload.taskId, priority, true);
    if (!result.success) return { success: false, error: result.error || t('message.moveFailed') };
    return { success: true, toast: t('message.movedTo', { priority, name: t(`priority.${priority}`) }) };
  }

  async function handleDropSubtaskInGroup(priority: Priority, payload: SubtaskDragPayload) {
    const result = await promoteSubtask(payload.parentTaskId, payload.subtaskId, priority);
    if (!result.success) return { success: false, error: result.error || t('message.promoteFailed') };
    return { success: true, toast: t('message.promotedTo', { priority, name: t(`priority.${priority}`) }) };
  }

  function toggleCollapsed(key: string) {
    collapsed[key] = !collapsed[key];
  }

  const groupByOptions: Array<{ value: GroupBy; label: string; icon: string }> = [
    { value: 'priority', label: t('list.groupBy.priority') || '优先级', icon: '⚡' },
    { value: 'project', label: t('list.groupBy.project') || '项目', icon: '+' },
    { value: 'context', label: t('list.groupBy.context') || '情境', icon: '@' },
    { value: 'tag', label: t('list.groupBy.tag') || '标签', icon: '#' },
    { value: 'due', label: t('list.groupBy.due') || '截止日', icon: '📅' },
    { value: 'none', label: t('list.groupBy.none') || '无分组', icon: '≡' }
  ];
</script>

<div class="list-view">
  <!-- 2-column layout: A-E groups on left, S/F/N zone rail on right -->
  <div class="list-toolbar">
    <div class="toolbar-left">
      <span class="toolbar-label">{t('list.groupByLabel') || '分组方式'}</span>
      <div class="group-by-pills">
        {#each groupByOptions as opt}
          <button
            class="group-by-pill"
            class:active={groupBy === opt.value}
            onclick={() => (groupBy = opt.value)}
            title={opt.label}
          >
            <span class="pill-icon">{opt.icon}</span>
            <span class="pill-label">{opt.label}</span>
          </button>
        {/each}
      </div>
    </div>

    <div class="toolbar-right">
      <button
        class="sort-toggle"
        onclick={() => (sortDir = sortDir === 'asc' ? 'desc' : 'asc')}
        title={sortDir === 'asc' ? t('list.sortAsc') || '正序' : t('list.sortDesc') || '倒序'}
      >
        {#if sortDir === 'asc'}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M3 6h13M3 12h9M3 18h5M17 4v16M14 17l3 3 3-3" />
          </svg>
        {:else}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M3 6h5M3 12h9M3 18h13M17 4v16M14 7l3-3 3 3" />
          </svg>
        {/if}
      </button>
      <span class="total-count font-num">{totalTasks}</span>
    </div>
  </div>

  <!-- Two-column body: A-E groups (left) + S/F/N zone rail (right) -->
  <div class="list-body">
    <div class="groups-scroll">
      {#if groupBy !== 'priority' && (groups.length === 0 || totalTasks === 0)}
        <div class="empty">
          <div class="empty-icon">🍃</div>
          <p>{t('list.empty') || '当前分组下没有任务'}</p>
        </div>
      {:else}
        {#each groups as group (group.key)}
          {#if groupBy === 'priority' && isListDropPriority(group.key)}
            {@const priority = group.key}
            <DropZone
              color={PRIORITY_CONFIG[priority].color}
              class="list-priority-drop-zone"
              onTaskDrop={(p) => handleDropTaskInGroup(priority, p)}
              onSubtaskDrop={(p) => handleDropSubtaskInGroup(priority, p)}
            >
              <header
                class="group-header"
                role="button"
                tabindex="0"
                onclick={() => toggleCollapsed(group.key)}
                onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleCollapsed(group.key)}
              >
                <svg
                  class="chevron"
                  class:collapsed={collapsed[group.key]}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
                <span class="group-color-dot" style:background={PRIORITY_CONFIG[priority].color}></span>
                <span class="group-label">{group.label}</span>
                <span class="group-count font-num">{group.tasks.length}</span>
              </header>

              {#if !collapsed[group.key]}
                <div class="group-body" transition:slide={{ duration: 180 }}>
                  {#each group.tasks as task (task.id)}
                    <TaskCard {task} showPriority={false} />
                  {:else}
                    <div class="group-empty-drop">{t('message.dropHere')}</div>
                  {/each}
                  <QuickAddRow {priority} />
                </div>
              {/if}
            </DropZone>
          {:else if group.tasks.length > 0}
            <section class="group">
              <header
                class="group-header"
                role="button"
                tabindex="0"
                onclick={() => toggleCollapsed(group.key)}
                onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleCollapsed(group.key)}
              >
                <svg
                  class="chevron"
                  class:collapsed={collapsed[group.key]}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
                {#if group.meta}
                  <span class="group-color-dot" style:background={group.meta}></span>
                {/if}
                <span class="group-label">{group.label}</span>
                <span class="group-count font-num">{group.tasks.length}</span>
              </header>

              {#if !collapsed[group.key]}
                <div class="group-body" transition:slide={{ duration: 180 }}>
                  {#each group.tasks as task (task.id)}
                    <TaskCard {task} showPriority={groupBy !== 'priority'} />
                  {/each}
                </div>
              {/if}
            </section>
          {/if}
        {/each}
      {/if}
    </div>

    <!-- S/F/N rail on the right — vertical stack, spatially adjacent for easy DnD -->
    <aside class="rail-column">
      <ZoneRail orientation="vertical" />
    </aside>
  </div>
</div>

<style>
  .list-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    min-width: 0;
  }

  /* Two-column body: groups (left) + S/F/N rail (right) */
  .list-body {
    flex: 1;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 320px;
    gap: var(--space-md);
    overflow: hidden;
    min-height: 0;
  }

  .rail-column {
    height: 100%;
    overflow: hidden;
    border-radius: var(--radius-lg);
    background: var(--bg-secondary);
    border: 1px solid var(--border-hairline);
    padding: 8px;
  }

  @media (max-width: 900px) {
    .list-body {
      grid-template-columns: 1fr;
      grid-template-rows: 1fr auto;
    }
    .rail-column {
      max-height: 50vh;
    }
  }

  /* ===== Toolbar ===== */
  .list-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-md) var(--space-lg);
    background: var(--card-bg);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-lg);
    box-shadow: var(--elevation-1);
    margin-bottom: var(--space-md);
    gap: var(--space-md);
    flex-wrap: wrap;
  }

  .toolbar-left {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    flex-wrap: wrap;
  }

  .toolbar-label {
    font-size: var(--text-xs);
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 600;
  }

  .group-by-pills {
    display: flex;
    gap: 4px;
    background: var(--bg-secondary);
    padding: 3px;
    border-radius: var(--radius-md);
  }

  .group-by-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 5px 10px;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-secondary);
    font-size: var(--text-sm);
    font-weight: 500;
    cursor: pointer;
    border: none;
    transition: all var(--transition-fast);
  }

  .group-by-pill:hover {
    color: var(--text-primary);
    background: var(--hover-bg);
  }

  .group-by-pill.active {
    background: var(--card-bg);
    color: var(--text-primary);
    box-shadow: var(--elevation-1);
  }

  .pill-icon {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    width: 14px;
    text-align: center;
    color: var(--text-muted);
  }

  .group-by-pill.active .pill-icon {
    color: var(--primary);
  }

  .toolbar-right {
    display: flex;
    align-items: center;
    gap: var(--space-md);
  }

  .sort-toggle {
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    color: var(--text-muted);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .sort-toggle:hover {
    color: var(--text-primary);
    background: var(--hover-bg);
  }

  .sort-toggle svg {
    width: 14px;
    height: 14px;
  }

  .total-count {
    font-size: var(--text-sm);
    color: var(--text-muted);
    font-weight: 600;
    min-width: 28px;
    text-align: right;
  }

  /* ===== Groups ===== */
  .groups-scroll {
    height: 100%;
    overflow-y: auto;
    padding-bottom: var(--space-2xl);
    padding-right: 2px;
    min-height: 0;
  }

  .group {
    margin-bottom: var(--space-lg);
  }

  :global(.list-priority-drop-zone) {
    margin-bottom: var(--space-lg);
    border-radius: var(--radius-md);
  }

  .group-header {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: 6px 10px;
    cursor: pointer;
    border-radius: var(--radius-md);
    user-select: none;
    transition: background var(--transition-fast);
  }

  .group-header:hover {
    background: var(--hover-bg);
  }

  .chevron {
    width: 12px;
    height: 12px;
    color: var(--text-muted);
    flex-shrink: 0;
    transition: transform 0.15s var(--ease-out-expo);
  }

  .chevron.collapsed {
    transform: rotate(-90deg);
  }

  .group-color-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .group-label {
    font-size: var(--text-base);
    font-weight: 600;
    color: var(--text-primary);
    letter-spacing: -0.01em;
  }

  .group-count {
    margin-left: 4px;
    padding: 1px 7px;
    background: var(--tag-bg);
    border-radius: var(--radius-full);
    font-size: var(--text-xs);
    color: var(--text-muted);
    font-weight: 600;
  }

  .group-body {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 6px 0 0 18px;
  }

  .group-empty-drop {
    min-height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px dashed var(--border-subtle);
    border-radius: var(--radius-md);
    color: var(--text-muted);
    font-size: var(--text-sm);
    background: color-mix(in srgb, var(--card-bg) 80%, transparent);
  }

  /* ===== Empty ===== */
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--space-3xl) var(--space-xl);
    color: var(--text-muted);
    text-align: center;
  }

  .empty-icon {
    font-size: 40px;
    margin-bottom: var(--space-md);
    opacity: 0.6;
  }

  .empty p {
    font-size: var(--text-md);
  }

  /* Compact mode tweaks */
  :global(.density-compact) .list-toolbar {
    padding: 6px 10px;
    margin-bottom: 6px;
  }

  :global(.density-compact) .group {
    margin-bottom: var(--space-md);
  }

  :global(.density-compact .list-priority-drop-zone) {
    margin-bottom: var(--space-md);
  }

  :global(.density-compact) .group-body {
    gap: 3px;
    padding-top: 3px;
    padding-left: 14px;
  }
</style>
