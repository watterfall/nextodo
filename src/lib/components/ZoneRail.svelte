<script lang="ts">
  import type { Priority } from '$lib/types';
  import { PRIORITY_CONFIG, subtaskProgress } from '$lib/types';
  import TaskCard from './TaskCard.svelte';
  import DropZone from './DropZone.svelte';
  import {
    changePriority,
    getTasksStore,
    toggleSubtask,
    addSubtask,
    removeSubtask,
    promoteSubtask
  } from '$lib/stores/tasks.svelte';
  import { showToast, openEditModal, getUIStore, setDraggingTask } from '$lib/stores/ui.svelte';
  import { getI18nStore } from '$lib/i18n';
  import { clearDragPayload, startSubtaskDrag, type TaskDragPayload, type SubtaskDragPayload } from '$lib/utils/dnd';

  interface Props {
    orientation?: 'vertical' | 'horizontal';
  }

  let { orientation = 'vertical' }: Props = $props();

  type ZoneKey = 'S' | 'F' | 'N';

  const tasks = getTasksStore();
  const ui = getUIStore();
  const i18n = getI18nStore();
  const t = i18n.t;

  // Source data
  const sTask = $derived(tasks.sustainedTasks[0] ?? null);
  const sProgress = $derived(sTask ? subtaskProgress(sTask) : { done: 0, total: 0, ratio: 0 });
  const fTasks = $derived(tasks.tasksByPriority['F'].filter(t => !t.completed));
  const nTasks = $derived(tasks.futureTasks);

  // ============================================================
  // Drop handlers — uniform across S/F/N
  // ============================================================
  async function handleTaskDrop(target: ZoneKey, payload: TaskDragPayload) {
    if (payload.fromPriority === target) return null;
    // S Highlander: replace existing S — bail early if demotion fails (e.g. B quota full)
    if (target === 'S' && sTask && sTask.id !== payload.taskId) {
      const demote = await changePriority(sTask.id, 'B' as Priority, true);
      if (!demote.success) {
        return { success: false, error: demote.error || t('zone.demoteFailed') };
      }
      showToast(t('zone.demotedToB', { name: sTask.content }), 'info');
    }
    const result = await changePriority(payload.taskId, target as Priority, true);
    if (!result.success) return { success: false, error: result.error || t('zone.moveFailed') };
    return { success: true, toast: t('zone.movedTo', { priority: target, name: PRIORITY_CONFIG[target as Priority].name }) };
  }

  async function handleSubtaskDrop(target: ZoneKey, payload: SubtaskDragPayload) {
    if (target === 'S') return null; // can't promote a subtask to its own parent zone
    const result = await promoteSubtask(payload.parentTaskId, payload.subtaskId, target as Priority);
    if (!result.success) return { success: false, error: result.error || t('zone.promoteFailed') };
    return { success: true, toast: t('zone.subtaskPromotedTo', { priority: target }) };
  }

  // ============================================================
  // Subtask add (S featured-card)
  // ============================================================
  let newSubtaskContent = $state('');
  async function handleAddSubtask() {
    if (!sTask) return;
    const content = newSubtaskContent.trim();
    if (!content) return;
    await addSubtask(sTask.id, content);
    newSubtaskContent = '';
  }
  function handleSubtaskInputKey(e: KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); handleAddSubtask(); }
  }

  // Subtask promote popup (alternative to drag)
  let promoteOpenFor = $state<string | null>(null);
  const promoteTargets: Priority[] = ['A', 'B', 'C', 'D', 'E', 'F', 'N'];

  async function handlePromoteFromPopup(subtaskId: string, target: Priority) {
    if (!sTask) return;
    promoteOpenFor = null;
    const result = await promoteSubtask(sTask.id, subtaskId, target);
    if (result.success) {
      showToast(t('zone.promotedTo', { name: PRIORITY_CONFIG[target].name, priority: target }), 'success');
    } else if (result.error) {
      showToast(result.error, 'error');
    }
  }

  function handleWindowPointerDown(e: PointerEvent) {
    if (!promoteOpenFor) return;
    const target = e.target as Element | null;
    if (target?.closest('.promote-popup') || target?.closest('.subtask-promote-btn')) return;
    promoteOpenFor = null;
  }

  // ============================================================
  // Collapse state — S expanded, F/N collapsed by default
  // Auto-expand on global drag so they become visible drop targets
  // ============================================================
  const STORAGE_KEY = 'zone-rail-expanded-v3';
  let expanded = $state<Record<ZoneKey, boolean>>({ S: true, F: false, N: false });

  $effect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          expanded = {
            S: parsed.S !== false,
            F: parsed.F === true,
            N: parsed.N === true
          };
        }
      }
    } catch {}
  });

  function toggleZone(key: ZoneKey) {
    expanded = { ...expanded, [key]: !expanded[key] };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(expanded)); } catch {}
  }

  const showS = $derived(expanded.S || ui.isDraggingTask);
  const showF = $derived(expanded.F || ui.isDraggingTask);
  const showN = $derived(expanded.N || ui.isDraggingTask);
</script>

<svelte:window onpointerdown={handleWindowPointerDown} />

<aside class="zone-rail orient-{orientation}">
  <!-- ============================================================
       S — Featured card with full subtask list
       ============================================================ -->
  <DropZone
    color={PRIORITY_CONFIG.S.color}
    class="zone s-zone {showS ? 'open' : ''}"
    onTaskDrop={(p) => handleTaskDrop('S', p)}
    onSubtaskDrop={(p) => handleSubtaskDrop('S', p)}
  >
    <button class="zone-header" onclick={() => toggleZone('S')}>
      <svg class="zone-chevron" class:rotated={showS} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="9 18 15 12 9 6"></polyline>
      </svg>
      <svg class="zone-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
      <span class="zone-letter">S</span>
      <span class="zone-label">持续推进</span>
      {#if sTask && !showS}
        <span class="zone-peek">{sTask.content}</span>
      {/if}
      {#if sProgress.total > 0}
        <span class="zone-progress">
          <span class="progress-track">
            <span class="progress-fill" style:width="{Math.round(sProgress.ratio * 100)}%"></span>
          </span>
          <span class="progress-text">{sProgress.done}/{sProgress.total}</span>
        </span>
      {/if}
    </button>

    {#if showS}
      <div class="zone-body">
        {#if !sTask}
          <div class="zone-empty">
            拖任务到此 · 或输入 <code>!S</code> 创建本周持续推进项目
          </div>
        {:else}
          <div class="featured">
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <h3 class="featured-title" ondblclick={() => openEditModal(sTask)} title="双击编辑">
              {sTask.content}
            </h3>
            {#if (sTask.subtasks ?? []).length > 0}
              <ul class="subtasks">
                {#each sTask.subtasks! as sub (sub.id)}
                  <li
                    class="sub-row"
                    class:done={sub.completed}
                    draggable="true"
                    ondragstart={(e) => {
                      startSubtaskDrag(e, { parentTaskId: sTask.id, subtaskId: sub.id, content: sub.content });
                      setDraggingTask(true, 'S');
                    }}
                    ondragend={() => {
                      clearDragPayload();
                      setDraggingTask(false);
                    }}
                    title="拖动到 A-E/F/N 任意区即提升为独立任务"
                  >
                    <button
                      class="sub-check"
                      class:checked={sub.completed}
                      onclick={(e) => { e.stopPropagation(); toggleSubtask(sTask.id, sub.id); }}
                      aria-label={sub.completed ? '取消勾选' : '标记完成'}
                    >
                      {#if sub.completed}
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      {/if}
                    </button>
                    <span class="sub-grip" aria-hidden="true">⋮⋮</span>
                    <span class="sub-text">{sub.content}</span>
                    <div class="sub-actions">
                      <div class="promote-wrap">
                        <button
                          class="subtask-promote-btn"
                          onclick={(e) => { e.stopPropagation(); promoteOpenFor = promoteOpenFor === sub.id ? null : sub.id; }}
                          title="提升为独立任务（或直接拖到目标区）"
                        >↗</button>
                        {#if promoteOpenFor === sub.id}
                          <div class="promote-popup" role="menu">
                            <div class="promote-label">提升到</div>
                            <div class="promote-options">
                              {#each promoteTargets as target}
                                <button
                                  class="promote-option"
                                  style:--target-color={PRIORITY_CONFIG[target].color}
                                  onclick={() => handlePromoteFromPopup(sub.id, target)}
                                  title={PRIORITY_CONFIG[target].description}
                                >
                                  <span class="promote-letter">{target}</span>
                                  <span class="promote-name">{PRIORITY_CONFIG[target].name}</span>
                                </button>
                              {/each}
                            </div>
                          </div>
                        {/if}
                      </div>
                      <button
                        class="sub-remove"
                        onclick={(e) => { e.stopPropagation(); removeSubtask(sTask.id, sub.id); }}
                        title="删除"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </button>
                    </div>
                  </li>
                {/each}
              </ul>
            {/if}
            <div class="sub-add-row">
              <input
                type="text"
                class="sub-input"
                placeholder="拆解一个子任务 · 回车确认"
                bind:value={newSubtaskContent}
                onkeydown={handleSubtaskInputKey}
              />
              {#if newSubtaskContent.trim()}
                <button class="sub-add-btn" onclick={handleAddSubtask}>+</button>
              {/if}
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </DropZone>

  <!-- ============================================================
       F — Idea Pool
       ============================================================ -->
  <DropZone
    color={PRIORITY_CONFIG.F.color}
    class="zone f-zone {showF ? 'open' : ''}"
    onTaskDrop={(p) => handleTaskDrop('F', p)}
    onSubtaskDrop={(p) => handleSubtaskDrop('F', p)}
  >
    <button class="zone-header" onclick={() => toggleZone('F')}>
      <svg class="zone-chevron" class:rotated={showF} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="9 18 15 12 9 6"></polyline>
      </svg>
      <span class="zone-emoji">💡</span>
      <span class="zone-letter">F</span>
      <span class="zone-label">灵感池</span>
      <span class="zone-count">{fTasks.length}</span>
    </button>

    {#if showF}
      <div class="zone-body">
        {#if fTasks.length === 0}
          <div class="zone-empty">
            收集想法 · 拖到这里或输入 <code>!F</code>
          </div>
        {:else}
          <div class="card-list">
            {#each fTasks as task (task.id)}
              <TaskCard {task} compact={true} />
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </DropZone>

  <!-- ============================================================
       N — Future Progress
       ============================================================ -->
  <DropZone
    color={PRIORITY_CONFIG.N.color}
    class="zone n-zone {showN ? 'open' : ''}"
    onTaskDrop={(p) => handleTaskDrop('N', p)}
    onSubtaskDrop={(p) => handleSubtaskDrop('N', p)}
  >
    <button class="zone-header" onclick={() => toggleZone('N')}>
      <svg class="zone-chevron" class:rotated={showN} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="9 18 15 12 9 6"></polyline>
      </svg>
      <span class="zone-emoji">🌙</span>
      <span class="zone-letter">N</span>
      <span class="zone-label">未来推进</span>
      <span class="zone-count">{nTasks.length}</span>
    </button>

    {#if showN}
      <div class="zone-body">
        {#if nTasks.length === 0}
          <div class="zone-empty">
            暂不打扰 · 拖到这里或输入 <code>!N</code>
          </div>
        {:else}
          <div class="card-list">
            {#each nTasks as task (task.id)}
              <TaskCard {task} compact={true} />
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </DropZone>
</aside>

<style>
  .zone-rail {
    display: flex;
    gap: 8px;
    overflow: hidden;
  }

  .zone-rail.orient-vertical {
    flex-direction: column;
    width: 100%;
    height: 100%;
    overflow-y: auto;
    padding-right: 4px;
    scrollbar-width: thin;
  }

  .zone-rail.orient-horizontal {
    flex-direction: row;
    width: 100%;
    height: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    padding-bottom: 4px;
    scrollbar-width: thin;
  }

  .zone-rail::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }

  .zone-rail::-webkit-scrollbar-thumb {
    background: var(--border-color);
    border-radius: 3px;
  }

  /* Shared zone shell — DropZone wraps; we style via :global to reach the .zone class */
  :global(.zone-rail .zone) {
    --z-color: var(--text-muted);
    --z-bg: var(--card-bg);
    --z-border: var(--border-subtle);
    display: flex;
    flex-direction: column;
    border: 1px solid var(--z-border);
    border-left: 3px solid var(--z-color);
    border-radius: var(--radius-md);
    background: var(--z-bg);
    overflow: hidden;
    min-width: 0;
    flex-shrink: 0;
  }

  /* Vertical proportions */
  :global(.zone-rail.orient-vertical .zone.open.s-zone) {
    flex: 1.6;
    min-height: 180px;
  }
  :global(.zone-rail.orient-vertical .zone.open.f-zone),
  :global(.zone-rail.orient-vertical .zone.open.n-zone) {
    flex: 1;
    min-height: 140px;
  }

  /* Horizontal proportions */
  :global(.zone-rail.orient-horizontal .zone) {
    flex: 1;
    min-width: 220px;
    height: 100%;
  }
  :global(.zone-rail.orient-horizontal .zone.open.s-zone) {
    flex: 1.6;
    min-width: 320px;
  }
  :global(.zone-rail.orient-horizontal .zone:not(.open)) {
    flex: 0 0 auto;
    min-width: 0;
  }

  :global(.zone-rail .zone.s-zone) {
    --z-color: var(--priority-s-color, #20c997);
    --z-bg: linear-gradient(180deg, var(--priority-s-bg, rgba(32,201,151,0.06)) 0%, var(--card-bg) 60%);
    --z-border: var(--priority-s-border, rgba(32,201,151,0.22));
  }
  :global(.zone-rail .zone.f-zone) {
    --z-color: var(--priority-f-color, #5c636a);
  }
  :global(.zone-rail .zone.n-zone) {
    --z-color: var(--priority-n-color, #748ffc);
  }

  .zone-header {
    display: flex;
    align-items: center;
    gap: 7px;
    width: 100%;
    padding: 7px 10px;
    border: none;
    background: color-mix(in srgb, var(--z-color) 6%, transparent);
    color: var(--z-color);
    cursor: pointer;
    font-family: inherit;
    font-size: 12px;
    border-bottom: 1px solid transparent;
    transition: background var(--transition-fast), border-color var(--transition-fast);
    flex-shrink: 0;
  }

  :global(.zone.open) .zone-header {
    border-bottom-color: var(--z-border);
  }

  .zone-header:hover {
    background: color-mix(in srgb, var(--z-color) 10%, transparent);
  }

  .zone-chevron {
    width: 11px;
    height: 11px;
    flex-shrink: 0;
    opacity: 0.55;
    transition: transform var(--transition-fast), opacity var(--transition-fast);
  }
  .zone-chevron.rotated {
    transform: rotate(90deg);
    opacity: 0.9;
  }

  .zone-icon {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
  }
  .zone-emoji { font-size: 14px; line-height: 1; }
  .zone-letter { font-weight: 700; font-family: var(--font-mono); }
  .zone-label  { font-weight: 600; }

  .zone-peek {
    font-size: 11px;
    color: var(--text-primary);
    font-weight: 500;
    margin-left: 2px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 160px;
  }

  .zone-count {
    margin-left: auto;
    font-size: 11px;
    font-weight: 600;
    padding: 1px 7px;
    background: color-mix(in srgb, var(--z-color) 14%, transparent);
    border-radius: 10px;
    min-width: 22px;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  .zone-progress {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-left: auto;
  }

  .progress-track {
    display: inline-block;
    width: 50px;
    height: 4px;
    background: var(--bg-tertiary, rgba(128, 128, 128, 0.15));
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-fill {
    display: block;
    height: 100%;
    background: var(--z-color);
    border-radius: 2px;
    transition: width 0.5s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .progress-text {
    font-size: 11px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .zone-body {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
    scrollbar-width: thin;
    min-height: 0;
  }

  .zone-body::-webkit-scrollbar {
    width: 4px;
  }
  .zone-body::-webkit-scrollbar-thumb {
    background: var(--border-color);
    border-radius: 2px;
  }

  .zone-empty {
    padding: 14px 12px;
    text-align: center;
    color: var(--text-muted);
    font-size: 11px;
    line-height: 1.5;
  }

  .zone-empty code {
    background: var(--bg-secondary);
    padding: 1px 5px;
    border-radius: 3px;
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--z-color);
  }

  .card-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  /* ============================================================
     S featured card
     ============================================================ */
  .featured {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px;
    background: var(--card-bg);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
  }

  .featured-title {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
    cursor: pointer;
    line-height: 1.35;
    padding: 2px;
  }

  .featured-title:hover {
    color: var(--priority-s-color, #20c997);
  }

  .subtasks {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .sub-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 4px;
    border-radius: var(--radius-sm);
    position: relative;
    transition: background var(--transition-fast);
    cursor: grab;
  }

  .sub-row:active {
    cursor: grabbing;
  }

  .sub-row:hover {
    background: var(--hover-bg);
  }

  .sub-row.done .sub-text {
    text-decoration: line-through;
    color: var(--text-muted);
  }

  .sub-check {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    border: 1.4px solid var(--priority-s-color, #20c997);
    border-radius: 50%;
    background: transparent;
    cursor: pointer;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--transition-fast);
  }

  .sub-check:hover { background: color-mix(in srgb, var(--priority-s-color, #20c997) 12%, transparent); }
  .sub-check.checked { background: var(--priority-s-color, #20c997); }
  .sub-check svg { width: 8px; height: 8px; color: white; }

  .sub-grip {
    color: var(--text-muted);
    opacity: 0.35;
    font-size: 10px;
    user-select: none;
    cursor: grab;
    line-height: 1;
  }

  .sub-row:hover .sub-grip { opacity: 0.7; }

  .sub-text {
    flex: 1;
    font-size: 12px;
    color: var(--text-primary);
    line-height: 1.4;
    word-break: break-word;
  }

  .sub-actions {
    display: flex;
    gap: 1px;
    opacity: 0;
    transition: opacity var(--transition-fast);
  }

  .sub-row:hover .sub-actions { opacity: 1; }

  .promote-wrap { position: relative; }

  .subtask-promote-btn,
  .sub-remove {
    width: 20px;
    height: 20px;
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

  .subtask-promote-btn {
    font-size: 12px;
    line-height: 1;
  }

  .subtask-promote-btn:hover {
    background: color-mix(in srgb, var(--priority-s-color, #20c997) 12%, transparent);
    color: var(--priority-s-color, #20c997);
  }

  .sub-remove:hover {
    color: var(--error, #ff6b6b);
    background: var(--hover-bg);
  }

  .sub-remove svg { width: 11px; height: 11px; }

  .promote-popup {
    position: absolute;
    right: 0;
    top: calc(100% + 4px);
    z-index: 50;
    width: 200px;
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
    padding: 8px;
    animation: promote-pop 0.14s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes promote-pop {
    from { opacity: 0; transform: translateY(-4px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }

  .promote-label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: 6px;
    padding: 0 4px;
  }

  .promote-options {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 3px;
  }

  .promote-option {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 8px;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all var(--transition-fast);
    font-family: inherit;
  }

  .promote-option:hover {
    border-color: var(--target-color);
    background: color-mix(in srgb, var(--target-color) 12%, transparent);
    color: var(--target-color);
  }

  .promote-letter {
    font-size: 12px;
    font-weight: 700;
    color: var(--target-color);
    font-family: var(--font-mono);
  }

  .promote-name { font-size: 11px; }

  .sub-add-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 2px;
  }

  .sub-input {
    flex: 1;
    height: 26px;
    padding: 0 8px;
    font-size: 12px;
    background: transparent;
    border: 1px dashed var(--border-subtle);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    outline: none;
    transition: all var(--transition-fast);
  }

  .sub-input:focus {
    border-style: solid;
    border-color: var(--priority-s-color, #20c997);
    background: var(--card-bg);
  }

  .sub-add-btn {
    width: 22px;
    height: 22px;
    border: none;
    border-radius: var(--radius-sm);
    background: var(--priority-s-color, #20c997);
    color: white;
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
    transition: all var(--transition-fast);
  }

  .sub-add-btn:hover { transform: scale(1.08); }
</style>
