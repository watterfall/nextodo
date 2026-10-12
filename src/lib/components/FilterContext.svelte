<script lang="ts">
  import { getTasksStore, setFilter, clearFilters } from '$lib/stores/tasks.svelte';
  import { getI18nStore } from '$lib/i18n';
  import type { FilterState } from '$lib/types';
  const tasks = getTasksStore();
  const t = getI18nStore().t;
  const chips = $derived.by(() => {
    const f = tasks.filter;
    const items: { key: keyof FilterState; label: string; reset: null | false }[] = [];
    for (const key of ['project', 'context', 'tag', 'priority'] as const) {
      if (f[key]) items.push({ key, label: `${t(`continuity.filter.${key}`)}: ${f[key]}`, reset: null });
    }
    if (f.dueFilter) items.push({ key: 'dueFilter', label: t(`filter.${f.dueFilter}`), reset: null });
    if (f.pomodoroFilter !== null) items.push({ key: 'pomodoroFilter', label: t('continuity.blocks', { n: f.pomodoroFilter }), reset: null });
    if (f.showFutureTasks) items.push({ key: 'showFutureTasks', label: t('filter.future'), reset: false });
    return items;
  });
</script>

{#if chips.length}
  <div class="filter-context" aria-label={t('continuity.activeFilters')}>
    <span>{t('continuity.matchCount', { n: tasks.filteredTasks.length })}</span>
    {#each chips as chip (chip.key)}
      <button class="chip" onclick={() => setFilter({ [chip.key]: chip.reset })} aria-label={t('continuity.removeFilter', { name: chip.label })}>{chip.label}<span aria-hidden="true">×</span></button>
    {/each}
    <button class="clear" onclick={clearFilters}>{t('filter.clearFilter')}</button>
  </div>
{/if}

<style>
  .filter-context { flex-shrink: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin: 4px 24px 10px; font-size: 12px; color: var(--text-secondary); }
  button { font: inherit; cursor: pointer; padding: 5px 8px; border-radius: 6px; }
  .chip { display: flex; align-items: center; gap: 8px; color: var(--primary); background: var(--primary-bg); border: 1px solid transparent; max-width: 100%; overflow-wrap: anywhere; text-align: left; }
  .clear { border: none; background: transparent; color: var(--text-secondary); text-decoration: underline; text-underline-offset: 3px; }
  @media (max-width: 700px) { .filter-context { margin: 4px 12px 10px; } }
</style>
