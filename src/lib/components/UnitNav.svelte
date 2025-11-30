<script lang="ts">
  import type { UnitInfo } from '$lib/types';
  import { getCurrentUnit, navigateUnit, formatDateShort } from '$lib/utils/unitCalc';
  import { getTasksStore, setCurrentUnit } from '$lib/stores/tasks.svelte';

  const tasks = getTasksStore();

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

  const isToday = $derived(() => {
    const current = getCurrentUnit();
    return tasks.currentUnit.startDate.getTime() === current.startDate.getTime();
  });
</script>

<div class="unit-nav">
  <button class="nav-btn" onclick={handlePrev} title="上一个周期">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="15 18 9 12 15 6"></polyline>
    </svg>
  </button>

  <div class="unit-display">
    {#if tasks.currentUnit.isReviewDay}
      <span class="unit-icon">📊</span>
      <span class="unit-label">周复盘</span>
    {:else}
      <span class="unit-icon">📅</span>
      <span class="unit-label">
        Unit {tasks.currentUnit.unitNumber}: {formatDateShort(tasks.currentUnit.startDate)}-{formatDateShort(tasks.currentUnit.endDate)}
      </span>
    {/if}
  </div>

  <button class="nav-btn" onclick={handleNext} title="下一个周期">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="9 18 15 12 9 6"></polyline>
    </svg>
  </button>

  {#if !isToday()}
    <button class="today-btn" onclick={handleToday}>
      今天
    </button>
  {/if}
</div>

<style>
  .unit-nav {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 16px;
    background: var(--card-bg);
    border-radius: 8px;
    border: 1px solid var(--border-color);
  }

  .nav-btn {
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .nav-btn:hover {
    background: var(--hover-bg);
    color: var(--text-primary);
  }

  .nav-btn svg {
    width: 18px;
    height: 18px;
  }

  .unit-display {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 12px;
    background: var(--primary-bg);
    border-radius: 6px;
  }

  .unit-icon {
    font-size: 16px;
  }

  .unit-label {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
  }

  .today-btn {
    padding: 6px 12px;
    border: 1px solid var(--primary);
    border-radius: 6px;
    background: transparent;
    color: var(--primary);
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
    transition: all 0.2s ease;
  }

  .today-btn:hover {
    background: var(--primary);
    color: white;
  }
</style>
