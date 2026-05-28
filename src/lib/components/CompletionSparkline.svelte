<script lang="ts">
  import type { CycleHistoryEntry } from '$lib/types';
  import { getI18nStore } from '$lib/i18n';

  interface Props {
    history: CycleHistoryEntry[];
    max?: number;
  }

  let { history, max = 12 }: Props = $props();

  const i18n = getI18nStore();
  const t = i18n.t;

  const recent = $derived(history.slice(-max));

  function barColor(pct: number | null): string {
    if (pct === null) return 'var(--text-muted)';
    if (pct < 30) return 'var(--danger, #fa5252)';
    if (pct < 60) return 'var(--warning, #ff922b)';
    return 'var(--success, #51cf66)';
  }
</script>

{#if recent.length > 0}
  <div class="sparkline">
    <span class="spark-label">{t('todayView.completionHistory')}</span>
    <div class="bars" role="img" aria-label={t('todayView.completionHistory')}>
      {#each recent as h (h.periodStart)}
        {@const pct = h.completion === null ? null : Math.round(h.completion * 100)}
        <span
          class="bar"
          class:merged={h.merged}
          style:height={pct === null ? '18%' : `${Math.max(8, pct)}%`}
          style:--bar-color={barColor(pct)}
          title={`${h.periodStart}: ${pct === null ? '—' : pct + '%'}${h.merged ? ' ⟳' : ''}`}
        ></span>
      {/each}
    </div>
  </div>
{/if}

<style>
  .sparkline {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .spark-label {
    font-size: 11px;
    color: var(--text-muted);
    white-space: nowrap;
  }

  .bars {
    display: flex;
    align-items: flex-end;
    gap: 2px;
    height: 22px;
  }

  .bar {
    width: 5px;
    min-height: 2px;
    border-radius: 1px;
    background: var(--bar-color);
    opacity: 0.85;
    transition: opacity var(--transition-fast, 0.15s);
  }

  .bar.merged {
    outline: 1px solid var(--primary);
    outline-offset: 1px;
  }

  .bar:hover {
    opacity: 1;
  }
</style>
