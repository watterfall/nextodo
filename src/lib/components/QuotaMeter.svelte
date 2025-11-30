<script lang="ts">
  import type { Priority } from '$lib/types';
  import { PRIORITY_CONFIG } from '$lib/types';
  import { getQuotaSummary } from '$lib/utils/quota';
  import { getTasksStore } from '$lib/stores/tasks.svelte';

  const tasks = getTasksStore();
  const summary = $derived(getQuotaSummary(tasks.tasks));
</script>

<div class="quota-meter">
  {#each summary as item}
    <div class="quota-item" class:full={item.isFull}>
      <span class="priority-label" style:color={PRIORITY_CONFIG[item.priority].color}>
        {item.priority}
      </span>
      <div class="quota-bar-container">
        <div
          class="quota-bar"
          style:width="{item.quota === Infinity ? (item.used > 0 ? 20 : 0) : (item.used / item.quota) * 100}%"
          style:background={PRIORITY_CONFIG[item.priority].color}
        ></div>
      </div>
      <span class="quota-count">
        {item.used}/{item.quota === Infinity ? '∞' : item.quota}
      </span>
    </div>
  {/each}
</div>

<style>
  .quota-meter {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px 16px;
    background: var(--card-bg);
    border-radius: 8px;
    border: 1px solid var(--border-color);
  }

  .quota-item {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
  }

  .quota-item.full {
    opacity: 0.6;
  }

  .priority-label {
    font-weight: 700;
    font-size: 14px;
    width: 16px;
    text-align: center;
  }

  .quota-bar-container {
    flex: 1;
    height: 6px;
    background: var(--border-color);
    border-radius: 3px;
    overflow: hidden;
  }

  .quota-bar {
    height: 100%;
    border-radius: 3px;
    transition: width 0.3s ease;
  }

  .quota-count {
    font-size: 12px;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
    min-width: 32px;
    text-align: right;
  }
</style>
