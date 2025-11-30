<script lang="ts">
  import type { Task, Priority } from '$lib/types';
  import { PRIORITY_CONFIG } from '$lib/types';
  import TaskCard from './TaskCard.svelte';
  import TaskInput from './TaskInput.svelte';
  import { getUIStore, setDropTarget, clearDragState } from '$lib/stores/ui.svelte';
  import { changePriority, getTasksStore } from '$lib/stores/tasks.svelte';
  import { countActiveByPriority } from '$lib/utils/quota';

  interface Props {
    priority: Priority;
    tasks: Task[];
    showAddSlot?: boolean;
  }

  let { priority, tasks, showAddSlot = true }: Props = $props();

  const config = PRIORITY_CONFIG[priority];
  const ui = getUIStore();
  const tasksStore = getTasksStore();

  let isDropTarget = $derived(ui.dropTargetPriority === priority);
  let showInput = $state(false);

  const counts = $derived(countActiveByPriority(tasksStore.tasks));
  const remaining = $derived(config.quota === Infinity ? Infinity : config.quota - counts[priority]);
  const isFull = $derived(priority !== 'E' && remaining <= 0);

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'move';
    setDropTarget(priority);
  }

  function handleDragLeave() {
    clearDragState();
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    const taskId = e.dataTransfer!.getData('text/plain');

    if (taskId && taskId !== ui.draggedTaskId) {
      changePriority(taskId, priority);
    }

    clearDragState();
  }

  function toggleInput() {
    showInput = !showInput;
  }

  function handleTaskAdded() {
    showInput = false;
  }
</script>

<div
  class="zone-container"
  class:drop-target={isDropTarget}
  class:is-priority-a={priority === 'A'}
  style:--zone-color={config.color}
  style:--zone-bg={config.bgColor}
  style:--zone-border={config.borderColor}
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
  role="region"
  aria-label="{config.name}区域"
>
  <div class="zone-header">
    <div class="zone-title">
      {#if priority === 'A'}
        <span class="zone-icon">🎯</span>
      {:else if priority === 'B'}
        <span class="zone-icon">⚡</span>
      {:else if priority === 'C'}
        <span class="zone-icon">📋</span>
      {:else if priority === 'D'}
        <span class="zone-icon">⏱️</span>
      {:else}
        <span class="zone-icon">📥</span>
      {/if}
      <span class="zone-name">{config.name}</span>
      <span class="zone-priority">({priority})</span>
    </div>

    <div class="zone-quota">
      {#if priority !== 'E'}
        <span class="quota-dots">
          {#each Array(config.quota) as _, i}
            <span class="quota-dot" class:filled={i < counts[priority]}></span>
          {/each}
        </span>
        <span class="quota-text">{counts[priority]}/{config.quota}</span>
      {:else}
        <span class="quota-text">∞</span>
      {/if}
    </div>

    {#if priority === 'A' && tasks.some(t => !t.completed)}
      <span class="breathing-light"></span>
    {/if}
  </div>

  <div class="zone-tasks">
    {#each tasks as task (task.id)}
      <TaskCard {task} compact={priority === 'D'} />
    {/each}

    {#if showInput}
      <TaskInput
        defaultPriority={priority}
        onSubmit={handleTaskAdded}
        onCancel={() => showInput = false}
        autoFocus
      />
    {:else if showAddSlot && !isFull}
      <button class="add-task-slot" onclick={toggleInput}>
        <span class="add-icon">+</span>
        <span class="add-text">空位 - 可添加{remaining === Infinity ? '' : remaining}个</span>
      </button>
    {:else if isFull}
      <div class="quota-full-hint">
        已满 - 完成现有任务后可添加
      </div>
    {/if}
  </div>
</div>

<style>
  .zone-container {
    background: var(--zone-bg);
    border: 1px solid var(--zone-border);
    border-radius: var(--radius-lg);
    padding: 14px 16px;
    transition: all var(--transition-normal);
  }

  .zone-container.drop-target {
    border-color: var(--zone-color);
    box-shadow: 0 0 0 2px var(--zone-color), var(--shadow-md);
    background: rgba(var(--zone-color-rgb), 0.08);
  }

  .zone-container.is-priority-a {
    background: var(--zone-bg);
    position: relative;
    overflow: hidden;
    border-color: var(--priority-a-border);
  }

  .zone-container.is-priority-a::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(218, 119, 242, 0.08), rgba(151, 117, 250, 0.03));
    pointer-events: none;
  }

  .zone-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
    position: relative;
  }

  .zone-title {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
  }

  .zone-icon {
    font-size: 16px;
  }

  .zone-name {
    font-weight: 600;
    font-size: 14px;
    color: var(--text-primary);
    letter-spacing: -0.01em;
  }

  .zone-priority {
    font-size: 12px;
    color: var(--zone-color);
    font-weight: 600;
    opacity: 0.9;
  }

  .zone-quota {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .quota-dots {
    display: flex;
    gap: 3px;
  }

  .quota-dot {
    width: 6px;
    height: 6px;
    border-radius: var(--radius-full);
    background: var(--border-color);
    transition: all var(--transition-fast);
  }

  .quota-dot.filled {
    background: var(--zone-color);
    box-shadow: 0 0 4px var(--zone-color);
  }

  .quota-text {
    font-size: 11px;
    font-weight: 500;
    color: var(--text-muted);
  }

  .breathing-light {
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 8px;
    height: 8px;
    border-radius: var(--radius-full);
    background: var(--zone-color);
    animation: breathe 2.5s ease-in-out infinite;
  }

  .zone-tasks {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .add-task-slot {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 12px;
    border: 1px dashed var(--border-color);
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    transition: all var(--transition-fast);
    font-size: 12px;
  }

  .add-task-slot:hover {
    border-color: var(--zone-color);
    color: var(--zone-color);
    background: rgba(var(--zone-color-rgb), 0.04);
  }

  .add-icon {
    font-size: 16px;
    font-weight: 400;
    opacity: 0.7;
  }

  .add-text {
    font-size: 12px;
    font-weight: 450;
  }

  .quota-full-hint {
    text-align: center;
    padding: 10px;
    font-size: 11px;
    color: var(--text-muted);
    font-style: italic;
    opacity: 0.8;
  }

  @keyframes breathe {
    0%, 100% {
      opacity: 0.5;
      transform: translateY(-50%) scale(1);
      box-shadow: 0 0 4px var(--zone-color);
    }
    50% {
      opacity: 1;
      transform: translateY(-50%) scale(1.1);
      box-shadow: 0 0 12px var(--zone-color), 0 0 20px var(--zone-color);
    }
  }
</style>
