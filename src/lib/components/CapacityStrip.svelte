<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { getTasksStore, setUnitCapacity } from '$lib/stores/tasks.svelte';
  import { getI18nStore } from '$lib/i18n';
  import { getUnitForDate, formatDateISO } from '$lib/utils/unitCalc';
  import { capacitySummary } from '$lib/utils/capacity';
  const tasks = getTasksStore();
  const t = getI18nStore().t;
  let now = $state(new Date());
  onMount(() => { const timer = setInterval(() => now = new Date(), 60000); return () => clearInterval(timer); });
  const unit = $derived(getUnitForDate(now));
  const start = $derived(formatDateISO(unit.startDate));
  const end = $derived(formatDateISO(unit.endDate));
  const plan = $derived(tasks.unitPlans[start]);
  const load = $derived(capacitySummary(tasks.tasks, start, end));
  let editing = $state(false);
  let draft = $state<number | undefined>();
  let saving = $state(false);
  let error = $state('');
  let editStart = '';
  let budgetInput = $state<HTMLInputElement>();
  let editButton = $state<HTMLButtonElement>();
  const over = $derived(plan ? Math.max(0, load.plannedMinutes - plan.availableMinutes) : 0);
  const fraction = $derived(plan?.availableMinutes ? Math.min(100, load.plannedMinutes / plan.availableMinutes * 100) : (load.plannedMinutes ? 100 : 0));
  async function edit() { editStart = start; draft = plan?.availableMinutes; editing = true; error = ''; await tick(); budgetInput?.focus(); budgetInput?.select(); }
  async function closeEditor() { editing = false; await tick(); editButton?.focus(); }
  async function save() {
    if (draft === undefined || !Number.isFinite(draft) || draft < 0 || draft > 2880) { error = t('planning.invalidCapacity'); return; }
    saving = true;
    try { await setUnitCapacity(editStart, draft); await closeEditor(); }
    catch { error = t('error.saveFailed'); }
    finally { saving = false; }
  }
</script>

{#if !unit.isReviewDay}
  <section class="capacity-strip" class:over-budget={over > 0} aria-label={t('planning.title')}>
    <div class="capacity-heading">
      <div><h2>{t('planning.title')} <small>{start.slice(5)} — {end.slice(5)}</small></h2></div>
      <button class="budget-button" bind:this={editButton} aria-expanded={editing} onclick={edit}>{plan ? t('design.adjustBudget') : t('planning.editCapacity')}</button>
    </div>
    <div class="capacity-summary">
      <div class="time-value"><strong>{load.plannedMinutes}</strong><span>{t('design.plannedMinutes')}</span></div>
      <span class="time-divider" aria-hidden="true">/</span>
      <div class="time-value"><strong>{plan ? plan.availableMinutes : '—'}</strong><span>{t('design.availableMinutes')}</span></div>
      <div class="capacity-status" aria-live="polite">
        {#if over > 0}<span class="over">{t('planning.over', { n: over })}</span>
        {:else if plan && !load.unknownCount}<span>{t('planning.margin', { n: plan.availableMinutes - load.plannedMinutes })}</span>
        {:else if !plan}<span>{t('planning.unset')}</span>{/if}
        {#if load.unknownCount}<span class="unknown">{t('planning.unknown', { n: load.unknownCount })}</span>{/if}
      </div>
    </div>
    {#if plan}<div class="capacity-track" aria-hidden="true"><div style:width="{fraction}%"></div></div>{/if}
    {#if editing}
      <form onsubmit={(e) => { e.preventDefault(); save(); }}>
        <label>{t('planning.capacityLabel')} <input onkeydown={(e) => { if (e.key === 'Escape' && !saving) { e.stopPropagation(); closeEditor(); } }} bind:this={budgetInput} type="number" min="0" max="2880" step="1" bind:value={draft} required disabled={saving} /></label>
        <button class="save" disabled={saving}>{saving ? t('design.saving') : t('action.save')}</button>
        <button type="button" disabled={saving} onclick={closeEditor}>{t('action.cancel')}</button>
        {#if error}<span role="alert">{error}</span>{/if}
      </form>
    {/if}
    <details class="capacity-explanation"><summary>{t('design.capacityScope')}</summary><p>{t('planning.scope')}</p></details>
  </section>
{/if}

<style>
  .capacity-strip { margin: 0 0 12px; padding: 12px 16px 10px; border: 1px solid var(--border-subtle); border-radius: 14px; color: var(--text-secondary); background: var(--card-bg); font-size: 12px; }
  .capacity-heading, .capacity-summary, form { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; }
  .capacity-heading { justify-content: space-between; margin-bottom: 6px; }
  h2 { font-size: 14px; font-weight: 600; color: var(--text-primary); } h2 small { font-weight: 400; font-size: 11px; margin-left: 8px; color: var(--text-secondary); }
  .time-value { display: flex; gap: 7px; align-items: baseline; } .time-value strong { font-size: 27px; line-height: 1.2; font-weight: 550; font-variant-numeric: tabular-nums; letter-spacing: -.05em; color: var(--text-primary); }
  .time-divider { font-size: 24px; font-weight: 300; color: var(--text-muted); }
  .capacity-status { margin-left: auto; display: flex; flex-wrap: wrap; gap: 6px 12px; align-items: center; }
  .over { color: var(--warning); font-weight: 600; } .unknown { padding: 3px 8px; border-radius: 5px; background: var(--bg-secondary); }
  .capacity-track { margin-top: 12px; height: 4px; border-radius: 3px; background: var(--bg-secondary); overflow: hidden; }
  .capacity-track div { height: 100%; background: var(--primary); } .over-budget .capacity-track div { background: var(--warning); }
  .capacity-explanation { margin-top: 9px; } summary { cursor: pointer; color: var(--text-secondary); font-size: 11px; }
  p { margin: 7px 0 0; line-height: 1.6; }
  button, input { font: inherit; color: var(--text-primary); background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 7px; padding: 7px 10px; }
  button { cursor: pointer; } button:disabled { opacity: .5; cursor: wait; } .budget-button { background: var(--bg-secondary); } .save { background: var(--primary); color: white; border-color: transparent; }
  input { width: 90px; margin-left: 6px; } form { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border-subtle); }
  @media (max-width: 700px) { .capacity-strip { padding: 12px; } .time-value { flex-direction: column; gap: 2px; } .capacity-status { margin-left: 0; } }
  @media (max-width: 700px) {
    .capacity-heading { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; }
    h2 { font-size: 12px; } h2 small { display: block; margin-left: 0; }
    .budget-button { max-width: 130px; font-size: 11px; padding: 6px 8px; }
    .capacity-summary { gap: 6px 10px; }
    .time-value strong { font-size: 23px; }
    .capacity-status { width: 100%; font-size: 11px; }
  }
</style>
