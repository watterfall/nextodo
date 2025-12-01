<script lang="ts">
  import type { UnitReview, Priority } from '$lib/types';
  import { PRIORITY_CONFIG } from '$lib/types';
  import { getReviewsStore, createReview, getCompletionRate, getPriorityRates } from '$lib/stores/reviews.svelte';
  import { getTasksStore } from '$lib/stores/tasks.svelte';
  import { getI18nStore } from '$lib/i18n';

  const reviews = getReviewsStore();
  const tasks = getTasksStore();
  const i18n = getI18nStore();
  const t = i18n.t;

  let reflection = $state('');
  let nextUnitFocus = $state('');
  let showCreateForm = $state(false);

  function handleCreateReview() {
    if (!reflection.trim() || !nextUnitFocus.trim()) return;

    createReview(
      tasks.tasks,
      tasks.currentUnit.startDate.toISOString().split('T')[0],
      tasks.currentUnit.endDate.toISOString().split('T')[0],
      reflection,
      nextUnitFocus
    );

    reflection = '';
    nextUnitFocus = '';
    showCreateForm = false;
  }

  // Get completion rate status
  function getRateStatus(rate: number): 'low' | 'healthy' | 'high' {
    if (rate < 70) return 'low';
    if (rate > 85) return 'high';
    return 'healthy';
  }

  const priorities: Priority[] = ['A', 'B', 'C', 'D', 'E'];
</script>

<div class="review-panel">
  <div class="panel-header">
    <h3 class="panel-title">
      <span class="title-icon">📊</span>
      {t('review.title')}
    </h3>
    {#if !showCreateForm}
      <button class="create-btn" onclick={() => showCreateForm = true}>
        + {t('review.createReview')}
      </button>
    {/if}
  </div>

  <!-- Redundancy Note Banner -->
  <div class="redundancy-banner">
    <div class="banner-icon">💡</div>
    <div class="banner-content">
      <span class="banner-title">{t('review.redundancyNote')}</span>
      <span class="banner-text">{t('review.redundancyHint')}</span>
    </div>
    <div class="healthy-range">{t('review.healthyRange')}</div>
  </div>

  {#if showCreateForm}
    <div class="create-form">
      <div class="form-group">
        <label class="form-label" for="review-reflection">{t('review.reflection')}</label>
        <textarea
          id="review-reflection"
          class="form-textarea"
          bind:value={reflection}
          placeholder={t('review.reflectionPlaceholder')}
          rows="3"
        ></textarea>
      </div>

      <div class="form-group">
        <label class="form-label" for="review-next-focus">{t('review.nextFocus')}</label>
        <input
          id="review-next-focus"
          type="text"
          class="form-input"
          bind:value={nextUnitFocus}
          placeholder={t('review.nextFocusPlaceholder')}
        />
      </div>

      <div class="form-actions">
        <button class="cancel-btn" onclick={() => showCreateForm = false}>
          {t('action.cancel')}
        </button>
        <button
          class="submit-btn"
          onclick={handleCreateReview}
          disabled={!reflection.trim() || !nextUnitFocus.trim()}
        >
          {t('review.saveReview')}
        </button>
      </div>
    </div>
  {/if}

  <div class="reviews-list">
    {#each reviews.recentReviews as review (review.id)}
      {@const rate = getCompletionRate(review)}
      {@const status = getRateStatus(rate)}
      <div class="review-card">
        <div class="review-header">
          <span class="review-date">
            {review.unitStart} ~ {review.unitEnd}
          </span>
          <span class="review-rate {status}">
            {rate}% {t('review.completionRate')}
            {#if status === 'high'}
              <span class="rate-hint" title={t('review.redundancyHint')}>⚠️</span>
            {/if}
          </span>
        </div>

        <div class="review-stats">
          {#each priorities as priority}
            {@const rates = getPriorityRates(review)}
            <div class="stat-item">
              <span class="stat-priority" style:background={PRIORITY_CONFIG[priority].color}>
                {priority}
              </span>
              <div class="stat-bar-container">
                <div
                  class="stat-bar"
                  style:width="{rates[priority]}%"
                  style:background={PRIORITY_CONFIG[priority].color}
                ></div>
              </div>
              <span class="stat-count">
                {review.stats.completed[priority]}/{review.stats.planned[priority]}
              </span>
            </div>
          {/each}
        </div>

        <div class="review-content">
          <div class="content-section">
            <span class="content-label">{t('review.reflection')}:</span>
            <span class="content-text">{review.reflection}</span>
          </div>
          <div class="content-section">
            <span class="content-label">{t('review.nextFocus')}:</span>
            <span class="content-text">{review.nextUnitFocus}</span>
          </div>
        </div>

        <div class="review-footer">
          <span class="pomodoro-total">
            🍅 {review.stats.pomodorosTotal} {t('review.pomodorosTotal')}
          </span>
        </div>
      </div>
    {:else}
      <div class="empty-state">
        <span class="empty-icon">📝</span>
        <p class="empty-text">{t('review.noReviews')}</p>
        <p class="empty-hint">{t('review.noReviewsHint')}</p>
      </div>
    {/each}
  </div>
</div>

<style>
  .review-panel {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    padding: 20px;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }

  .panel-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }

  .title-icon {
    font-size: 20px;
  }

  .create-btn {
    padding: 8px 16px;
    border: none;
    border-radius: var(--radius-md);
    background: var(--primary);
    color: white;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    transition: all var(--transition-fast);
  }

  .create-btn:hover {
    background: var(--primary-hover);
  }

  /* Redundancy Banner */
  .redundancy-banner {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    background: rgba(250, 176, 5, 0.08);
    border: 1px solid rgba(250, 176, 5, 0.2);
    border-radius: var(--radius-md);
    margin-bottom: 16px;
  }

  .banner-icon {
    font-size: 18px;
    flex-shrink: 0;
  }

  .banner-content {
    flex: 1;
    min-width: 0;
  }

  .banner-title {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: var(--warning, #fab005);
    margin-bottom: 2px;
  }

  .banner-text {
    display: block;
    font-size: 11px;
    color: var(--text-secondary);
  }

  .healthy-range {
    padding: 4px 8px;
    font-size: 10px;
    font-weight: 600;
    background: var(--card-bg);
    border-radius: var(--radius-sm);
    color: var(--success);
    white-space: nowrap;
  }

  .create-form {
    background: var(--bg-secondary);
    border-radius: var(--radius-md);
    padding: 16px;
    margin-bottom: 16px;
  }

  .form-group {
    margin-bottom: 16px;
  }

  .form-label {
    display: block;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-secondary);
    margin-bottom: 8px;
  }

  .form-input,
  .form-textarea {
    width: 100%;
    padding: 10px 12px;
    font-size: 14px;
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    outline: none;
    resize: vertical;
  }

  .form-input:focus,
  .form-textarea:focus {
    border-color: var(--primary);
  }

  .form-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
  }

  .cancel-btn {
    padding: 8px 16px;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 13px;
    transition: all var(--transition-fast);
  }

  .cancel-btn:hover {
    background: var(--hover-bg);
    color: var(--text-primary);
  }

  .submit-btn {
    padding: 8px 16px;
    border: none;
    border-radius: var(--radius-sm);
    background: var(--primary);
    color: white;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    transition: all var(--transition-fast);
  }

  .submit-btn:hover:not(:disabled) {
    background: var(--primary-hover);
  }

  .submit-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .reviews-list {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .review-card {
    background: var(--bg-secondary);
    border-radius: var(--radius-md);
    padding: 14px;
  }

  .review-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .review-date {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
  }

  .review-rate {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    padding: 4px 10px;
    border-radius: var(--radius-sm);
    background: var(--hover-bg);
    color: var(--text-secondary);
  }

  .review-rate.healthy {
    background: rgba(16, 185, 129, 0.15);
    color: var(--success);
  }

  .review-rate.high {
    background: rgba(250, 176, 5, 0.15);
    color: var(--warning, #fab005);
  }

  .review-rate.low {
    background: rgba(255, 107, 107, 0.15);
    color: var(--error);
  }

  .rate-hint {
    font-size: 12px;
    cursor: help;
  }

  .review-stats {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 12px;
  }

  .stat-item {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .stat-priority {
    width: 20px;
    height: 20px;
    border-radius: 5px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: 700;
    font-size: 11px;
  }

  .stat-bar-container {
    flex: 1;
    height: 6px;
    background: var(--border-color);
    border-radius: 3px;
    overflow: hidden;
  }

  .stat-bar {
    height: 100%;
    border-radius: 3px;
    transition: width 0.3s ease;
  }

  .stat-count {
    font-size: 11px;
    color: var(--text-muted);
    min-width: 40px;
    text-align: right;
    font-weight: 500;
  }

  .review-content {
    border-top: 1px solid var(--border-subtle);
    padding-top: 12px;
    margin-bottom: 12px;
  }

  .content-section {
    margin-bottom: 8px;
  }

  .content-section:last-child {
    margin-bottom: 0;
  }

  .content-label {
    font-size: 11px;
    color: var(--text-muted);
    margin-right: 4px;
  }

  .content-text {
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.5;
  }

  .review-footer {
    display: flex;
    justify-content: flex-end;
    border-top: 1px solid var(--border-subtle);
    padding-top: 10px;
  }

  .pomodoro-total {
    font-size: 12px;
    color: var(--text-muted);
  }

  .empty-state {
    text-align: center;
    padding: 40px 20px;
    color: var(--text-muted);
  }

  .empty-icon {
    font-size: 48px;
    display: block;
    margin-bottom: 12px;
    opacity: 0.7;
  }

  .empty-text {
    font-size: 14px;
    margin: 0 0 8px;
    color: var(--text-secondary);
    font-weight: 500;
  }

  .empty-hint {
    font-size: 12px;
    margin: 0;
  }
</style>
