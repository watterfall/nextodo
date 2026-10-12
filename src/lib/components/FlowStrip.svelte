<script lang="ts">
  // Descriptive measures only; neither age nor sample size diagnoses performance.
  import { getTasksStore } from '$lib/stores/tasks.svelte';
  import { getI18nStore } from '$lib/i18n';
  import { MIN_SAMPLE } from '$lib/utils/flowMetrics';

  const tasks = getTasksStore();
  const i18n = getI18nStore();
  const t = i18n.t;

  const age = $derived(tasks.flowAge);
  const cycle = $derived(tasks.flowCycleTime);
  const estimation = $derived(tasks.flowEstimation);
  const needed = $derived(tasks.flowSamplesNeeded);

  // 15 is the whole unit: A=1 + B=2 + C=3 + D=4 + E=5.
  const UNIT_CAPACITY = 15;
</script>

<div class="flow-strip" role="group" aria-label={t('flow.title') || '流动指标'}>
  <div class="flow-item" title={t('flow.commitmentHint')}>
    <span class="flow-value font-num">{age.count}<span class="flow-of">/{UNIT_CAPACITY}</span></span>
    <span class="flow-label">{t('flow.commitment') || '在办'}</span>
  </div>

  <span class="flow-sep" aria-hidden="true"></span>

  <div class="flow-item" title={t('flow.oldestHint')}>
    {#if age.oldest}
      <span class="flow-value font-num">{age.oldest.days}<span class="flow-unit">{t('flow.days') || 'd'}</span></span>
    {:else}
      <span class="flow-value flow-empty">—</span>
    {/if}
    <span class="flow-label">{t('flow.oldest') || '最老'}</span>
  </div>

  <span class="flow-sep" aria-hidden="true"></span>

  <div class="flow-item" title={t('flow.cycleTimeHint')}>
    {#if cycle}
      <span class="flow-value font-num">{cycle.value}<span class="flow-unit">{t('flow.days') || 'd'}</span></span>
    {:else}
      <!-- An honest empty state. A median over three completions is noise, and
           printing it would manufacture confidence rather than report any. -->
      <span class="flow-value flow-empty font-num">{t('flow.needMore', { n: needed || MIN_SAMPLE })}</span>
    {/if}
    <span class="flow-label">{t('flow.cycleTime') || '周期'}{cycle ? ` · n=${cycle.sampleSize}` : ''}</span>
  </div>

  {#if estimation}
    <span class="flow-sep" aria-hidden="true"></span>
    <div class="flow-item" title={t('flow.estimationHint')}>
      <span class="flow-value font-num">×{estimation.value.toFixed(1)}</span>
      <span class="flow-label">{t('flow.estimation') || '估计'} · n={estimation.sampleSize}</span>
    </div>
  {/if}
</div>

<style>
  .flow-strip {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .flow-item {
    display: flex;
    align-items: baseline;
    gap: 4px;
    cursor: default;
  }

  .flow-value {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
    line-height: 1;
  }

  .flow-empty {
    font-size: 11px;
    font-weight: 500;
    color: var(--text-muted);
  }

  .flow-of,
  .flow-unit {
    font-size: 10px;
    font-weight: 500;
    color: var(--text-muted);
    margin-left: 1px;
  }

  .flow-label {
    font-size: 11px;
    color: var(--text-muted);
    white-space: nowrap;
  }

  .flow-sep {
    width: 1px;
    height: 12px;
    background: var(--border-subtle);
  }
</style>
