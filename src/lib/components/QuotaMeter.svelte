<script lang="ts">
  import { PRIORITY_CONFIG, type Priority } from '$lib/types';
  import { getQuotaSummary } from '$lib/utils/quota';
  import { getTasksStore } from '$lib/stores/tasks.svelte';
  import { getI18nStore } from '$lib/i18n';

  const tasks = getTasksStore();
  const t = getI18nStore().t;
  const summary = $derived(getQuotaSummary(tasks.tasks));
  let expanded = $state<Priority | null>(null);
  let container = $state<HTMLDivElement>();
  const selected = $derived(summary.find(item => item.priority === expanded));

  function closeOutside(event: PointerEvent) {
    if (event.target instanceof Node && !container?.contains(event.target)) expanded = null;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key !== 'Escape' || !expanded || event.isComposing) return;
    event.preventDefault();
    event.stopPropagation();
    const priority = expanded;
    expanded = null;
    container?.querySelector<HTMLButtonElement>(`[data-priority="${priority}"]`)?.focus();
  }
</script>

<svelte:window onpointerdown={closeOutside} />

<div class="quota-meter" bind:this={container} role="group" aria-label={t('design.quotaSummary')}
  onfocusout={(event) => { if (!(event.relatedTarget instanceof Node) || !container?.contains(event.relatedTarget)) expanded = null; }}>
  <div class="quota-rings">
    {#each summary as item (item.priority)}
      <button class="quota-ring" data-priority={item.priority}
        style:--tier-color={PRIORITY_CONFIG[item.priority].color}
        aria-expanded={expanded === item.priority}
        aria-controls="quota-details"
        onkeydown={handleKeydown}
        aria-label={t('design.quotaDetail', { priority: item.priority, name: t(`priority.${item.priority}`), used: item.used, quota: item.quota })}
        onclick={() => expanded = expanded === item.priority ? null : item.priority}>
        <svg viewBox="0 0 36 36" aria-hidden="true">
          <circle class="track" cx="18" cy="18" r="15.9155" />
          {#if item.used > 0}
            <circle class="progress" cx="18" cy="18" r="15.9155" pathLength="100"
              stroke-dasharray={`${Math.min(100, item.used / item.quota * 100)} 100`} />
          {/if}
        </svg>
        <span>{item.priority}</span>
      </button>
    {/each}
  </div>
  <div class="quota-details" id="quota-details" hidden={!selected} role="region" aria-labelledby="quota-detail-title">
    {#if selected}
      <div class="detail-heading">
        <strong id="quota-detail-title" style:--tier-color={PRIORITY_CONFIG[selected.priority].color}>{selected.priority} · {t(`priority.${selected.priority}`)}</strong>
        <span>{t('design.quotaOpen', { n: selected.used })}</span>
      </div>
      <p>{t('design.quotaLimit', { n: selected.quota })}{#if selected.isFull}<span> · {t('design.quotaFull')}</span>{/if}</p>
    {/if}
  </div>
</div>

<style>
  .quota-meter { position: relative; flex-shrink: 0; }
  .quota-rings { display: flex; justify-content: flex-end; align-items: center; gap: 8px; }
  .quota-ring { position: relative; display: grid; place-items: center; flex: 0 0 40px; width: 40px; height: 40px; padding: 0; border: 0; border-radius: 50%; background: transparent; color: var(--text-primary); font: inherit; font-size: 11px; font-weight: 650; cursor: pointer; }
  .quota-ring:hover, .quota-ring[aria-expanded="true"] { background: var(--hover-bg); }
  .quota-ring:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
  svg { position: absolute; inset: 4px; width: 32px; height: 32px; transform: rotate(-90deg); pointer-events: none; }
  circle { fill: none; stroke-width: 2; }
  .track { stroke: var(--border-color); }
  .progress { stroke: var(--tier-color); stroke-linecap: round; }
  .quota-details { position: absolute; top: calc(100% + 8px); right: 0; z-index: 50; width: 250px; max-width: calc(100vw - 24px); padding: 13px 15px; color: var(--text-primary); background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 10px; box-shadow: 0 8px 28px #0002; font-size: 12px; }
  .detail-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  strong { border-left: 2px solid var(--tier-color); padding-left: 7px; font-weight: 550; }
  p { margin: 6px 0 0; color: var(--text-secondary); }
</style>
