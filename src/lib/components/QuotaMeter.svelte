<script lang="ts">
  import { PRIORITY_CONFIG } from '$lib/types';
  import { getQuotaSummary } from '$lib/utils/quota';
  import { getTasksStore } from '$lib/stores/tasks.svelte';

  const tasks = getTasksStore();
  const summary = $derived(getQuotaSummary(tasks.tasks));

  /**
   * Capacity-as-container: render the quota as discrete cells.
   * A=1 slot, B=2, C=3, D=4, E=5. Filled cells communicate "this much used" —
   * empty cells communicate "this much remaining capacity". When at capacity,
   * the row gets a soft pulse signalling "stop here, you have no more room".
   *
   * F is infinity — render an ∞ symbol instead of cells.
   */
</script>

<div class="quota-meter">
  {#each summary as item}
    {@const config = PRIORITY_CONFIG[item.priority]}
    {@const isInfinite = item.quota === Infinity}
    {@const cellCount = isInfinite ? 0 : (item.quota as number)}
    <div
      class="quota-item"
      class:full={item.isFull}
      class:at-capacity={!isInfinite && item.used >= item.quota}
      title={`${item.priority} · ${item.used}/${isInfinite ? '∞' : item.quota}`}
    >
      <span class="priority-label" style:color={config.color}>
        {item.priority}
      </span>
      {#if isInfinite}
        <div class="cells infinity">
          <span class="cell-infinity font-num" style:color={config.color}>
            ∞ {item.used > 0 ? item.used : ''}
          </span>
        </div>
      {:else}
        <div class="cells" style:--cell-color={config.color}>
          {#each Array(cellCount) as _, i}
            <span class="cell" class:filled={i < item.used} aria-hidden="true"></span>
          {/each}
        </div>
      {/if}
    </div>
  {/each}
</div>

<style>
  .quota-meter {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-md) var(--space-lg);
    background: var(--card-bg);
    border-radius: var(--radius-lg);
    border: 1px solid var(--border-hairline);
    box-shadow: var(--elevation-1);
  }

  .quota-item {
    display: flex;
    align-items: center;
    gap: 8px;
    /* Items naturally size to their cell count — no `flex: 1` stretching */
    transition: opacity 0.3s var(--ease-out-expo);
  }

  /* At capacity = soft hint that there's no more room (philosophically:
     this is good, not bad — your quota protects your focus) */
  .quota-item.at-capacity {
    animation: capacity-breathe 3s ease-in-out infinite;
  }

  @keyframes capacity-breathe {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }

  .priority-label {
    font-weight: 600;
    font-size: var(--text-sm);
    font-family: var(--font-mono);
    width: 11px;
    text-align: center;
    letter-spacing: -0.02em;
  }

  .cells {
    display: inline-flex;
    gap: 3px;
  }

  /* A cell: tiny rounded rectangle. Empty = hairline outline.
     Filled = solid priority color. */
  .cell {
    width: 7px;
    height: 12px;
    border-radius: 2px;
    background: transparent;
    box-shadow: inset 0 0 0 1px var(--border-strong);
    transition: background 0.25s var(--ease-out-expo),
                box-shadow 0.25s var(--ease-out-expo);
  }

  .cell.filled {
    background: var(--cell-color);
    box-shadow: inset 0 0 0 1px var(--cell-color);
  }

  /* Infinite quota (F = Idea Pool) — show ∞ + active count */
  .cells.infinity {
    display: inline-flex;
    align-items: center;
  }

  .cell-infinity {
    font-size: var(--text-sm);
    font-weight: 500;
    letter-spacing: 0.04em;
    opacity: 0.75;
  }

  /* Compact mode: tighter cells */
  :global(.density-compact) .cell {
    width: 6px;
    height: 10px;
  }

  :global(.density-compact) .quota-meter {
    gap: var(--space-sm);
    padding: 6px 10px;
  }
</style>
