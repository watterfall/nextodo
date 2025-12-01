<script lang="ts">
  import type { UnitInfo } from '$lib/types';
  import { getCurrentUnit, navigateUnit, formatDateShort } from '$lib/utils/unitCalc';
  import { getTasksStore, setCurrentUnit } from '$lib/stores/tasks.svelte';
  import { getI18nStore } from '$lib/i18n';

  const tasks = getTasksStore();
  const i18n = getI18nStore();
  const t = i18n.t;

  // Day names for unit display (clearer format with weekday prefix)
  const unitDayNames: Record<number, { zh: string; en: string }> = {
    1: { zh: '周日&周一', en: 'Sun&Mon' },
    2: { zh: '周二&周三', en: 'Tue&Wed' },
    3: { zh: '周四&周五', en: 'Thu&Fri' },
  };

  function handlePrev() {
    const newUnit = navigateUnit(tasks.currentUnit, 'prev');
    setCurrentUnit(newUnit);
  }

  function handleNext() {
    const newUnit = navigateUnit(tasks.currentUnit, 'next');
    setCurrentUnit(newUnit);
  }

  function handleToday() {
    setCurrentUnit(getCurrentUnit());
  }

  const isCurrentCycle = $derived(() => {
    const current = getCurrentUnit();
    return tasks.currentUnit.startDate.getTime() === current.startDate.getTime();
  });

  // Get display label based on language
  const unitDisplayLabel = $derived(() => {
    if (tasks.currentUnit.isReviewDay) {
      return i18n.language === 'zh-CN' ? '周六复盘' : 'Sat Review';
    }
    const dayName = unitDayNames[tasks.currentUnit.unitNumber];
    if (!dayName) return '';
    return i18n.language === 'zh-CN' ? dayName.zh : dayName.en;
  });
</script>

<div class="unit-nav">
  <button class="nav-btn" onclick={handlePrev} title={t('unit.prev') || '上一个周期'}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="15 18 9 12 15 6"></polyline>
    </svg>
  </button>

  <div class="unit-display" title={`${formatDateShort(tasks.currentUnit.startDate)}-${formatDateShort(tasks.currentUnit.endDate)}`}>
    {#if tasks.currentUnit.isReviewDay}
      <span class="unit-label review">{unitDisplayLabel()}</span>
    {:else}
      <span class="unit-label">{unitDisplayLabel()}</span>
    {/if}
  </div>

  <button class="nav-btn" onclick={handleNext} title={t('unit.next') || '下一个周期'}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="9 18 15 12 9 6"></polyline>
    </svg>
  </button>

  {#if !isCurrentCycle()}
    <button class="today-btn" onclick={handleToday}>
      {t('date.today')}
    </button>
  {/if}
</div>

<style>
  .unit-nav {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .nav-btn {
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .nav-btn:hover {
    background: var(--hover-bg);
    color: var(--text-primary);
  }

  .nav-btn svg {
    width: 16px;
    height: 16px;
  }

  .unit-display {
    display: flex;
    align-items: center;
    padding: 6px 14px;
    background: var(--bg-secondary);
    border-radius: 6px;
    cursor: help;
  }

  .unit-label {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
    letter-spacing: 0.02em;
  }

  .unit-label.review {
    color: var(--primary);
  }

  .today-btn {
    padding: 5px 10px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
    transition: all 0.15s ease;
  }

  .today-btn:hover {
    background: var(--primary);
    border-color: var(--primary);
    color: white;
  }
</style>
