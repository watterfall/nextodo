<script lang="ts">
  import { getTasksStore, resolvePendingReview } from '$lib/stores/tasks.svelte';
  import { getI18nStore } from '$lib/i18n';
  import { slide } from 'svelte/transition';

  const tasks = getTasksStore();
  const i18n = getI18nStore();
  const t = i18n.t;

  const review = $derived(tasks.cycleState?.pendingReview ?? null);
  const pct = $derived(review ? Math.round(review.completion * 100) : 0);
</script>

{#if review}
  <div class="low-completion-banner" role="status" transition:slide={{ duration: 200 }}>
    <span class="lcb-icon" aria-hidden="true">🌀</span>
    <span class="lcb-text">{t('lowCompletion.banner', { pct })}</span>
    <div class="lcb-actions">
      <button class="lcb-btn primary" onclick={() => resolvePendingReview('rollover')}>
        {t('lowCompletion.rollover')}
      </button>
      <button class="lcb-btn" onclick={() => resolvePendingReview('dismiss')}>
        {t('lowCompletion.dismiss')}
      </button>
    </div>
  </div>
{/if}

<style>
  .low-completion-banner {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 14px;
    margin-bottom: 8px;
    border-radius: var(--radius-md);
    border: 1px solid var(--warning, #ff922b);
    background: color-mix(in srgb, var(--warning, #ff922b) 12%, transparent);
    color: var(--text-primary);
    font-size: 13px;
  }

  .lcb-icon {
    font-size: 16px;
    flex-shrink: 0;
  }

  .lcb-text {
    flex: 1;
    line-height: 1.4;
  }

  .lcb-actions {
    display: flex;
    gap: 6px;
    flex-shrink: 0;
  }

  .lcb-btn {
    padding: 5px 12px;
    font-size: 12px;
    font-weight: 600;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-color);
    background: var(--card-bg);
    color: var(--text-secondary);
    cursor: pointer;
    transition: all var(--transition-fast, 0.15s);
    white-space: nowrap;
  }

  .lcb-btn:hover {
    background: var(--hover-bg);
    color: var(--text-primary);
  }

  .lcb-btn.primary {
    background: var(--warning, #ff922b);
    border-color: var(--warning, #ff922b);
    color: #fff;
  }

  .lcb-btn.primary:hover {
    opacity: 0.9;
  }
</style>
