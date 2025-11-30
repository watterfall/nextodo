<script lang="ts">
  import type { UnitReview, Priority } from '$lib/types';
  import { PRIORITY_CONFIG } from '$lib/types';
  import { getReviewsStore, createReview, getCompletionRate, getPriorityRates } from '$lib/stores/reviews.svelte';
  import { getTasksStore } from '$lib/stores/tasks.svelte';

  const reviews = getReviewsStore();
  const tasks = getTasksStore();

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

  const priorities: Priority[] = ['A', 'B', 'C', 'D', 'E'];
</script>

<div class="review-panel">
  <div class="panel-header">
    <h3 class="panel-title">
      <span class="title-icon">📊</span>
      周期复盘
    </h3>
    {#if !showCreateForm}
      <button class="create-btn" onclick={() => showCreateForm = true}>
        + 创建复盘
      </button>
    {/if}
  </div>

  {#if showCreateForm}
    <div class="create-form">
      <div class="form-group">
        <label class="form-label" for="review-reflection">本周期反思</label>
        <textarea
          id="review-reflection"
          class="form-textarea"
          bind:value={reflection}
          placeholder="回顾本周期的工作情况，有什么做得好的？有什么需要改进的？"
          rows="3"
        ></textarea>
      </div>

      <div class="form-group">
        <label class="form-label" for="review-next-focus">下周期重点</label>
        <input
          id="review-next-focus"
          type="text"
          class="form-input"
          bind:value={nextUnitFocus}
          placeholder="下个周期的核心目标是什么？"
        />
      </div>

      <div class="form-actions">
        <button class="cancel-btn" onclick={() => showCreateForm = false}>
          取消
        </button>
        <button
          class="submit-btn"
          onclick={handleCreateReview}
          disabled={!reflection.trim() || !nextUnitFocus.trim()}
        >
          保存复盘
        </button>
      </div>
    </div>
  {/if}

  <div class="reviews-list">
    {#each reviews.recentReviews as review (review.id)}
      <div class="review-card">
        <div class="review-header">
          <span class="review-date">
            {review.unitStart} ~ {review.unitEnd}
          </span>
          <span class="review-rate" class:good={getCompletionRate(review) >= 80}>
            {getCompletionRate(review)}% 完成
          </span>
        </div>

        <div class="review-stats">
          {#each priorities as priority}
            {@const rates = getPriorityRates(review)}
            <div class="stat-item">
              <span class="stat-priority" style:color={PRIORITY_CONFIG[priority].color}>
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
            <span class="content-label">反思:</span>
            <span class="content-text">{review.reflection}</span>
          </div>
          <div class="content-section">
            <span class="content-label">下期重点:</span>
            <span class="content-text">{review.nextUnitFocus}</span>
          </div>
        </div>

        <div class="review-footer">
          <span class="pomodoro-total">
            🍅 {review.stats.pomodorosTotal} 个番茄
          </span>
        </div>
      </div>
    {:else}
      <div class="empty-state">
        <span class="empty-icon">📝</span>
        <p class="empty-text">暂无复盘记录</p>
        <p class="empty-hint">在每个周期结束时创建复盘，追踪你的进步</p>
      </div>
    {/each}
  </div>
</div>

<style>
  .review-panel {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 20px;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
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
    border-radius: 6px;
    background: var(--primary);
    color: white;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    transition: all 0.2s ease;
  }

  .create-btn:hover {
    background: var(--primary-hover);
  }

  .create-form {
    background: var(--input-bg);
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 20px;
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
    border-radius: 6px;
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
    border-radius: 6px;
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 13px;
    transition: all 0.2s ease;
  }

  .cancel-btn:hover {
    background: var(--hover-bg);
    color: var(--text-primary);
  }

  .submit-btn {
    padding: 8px 16px;
    border: none;
    border-radius: 6px;
    background: var(--primary);
    color: white;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    transition: all 0.2s ease;
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
    gap: 16px;
  }

  .review-card {
    background: var(--input-bg);
    border-radius: 8px;
    padding: 16px;
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
    font-size: 13px;
    padding: 4px 8px;
    border-radius: 4px;
    background: var(--tag-bg);
    color: var(--text-secondary);
  }

  .review-rate.good {
    background: rgba(16, 185, 129, 0.2);
    color: var(--success);
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
    gap: 8px;
  }

  .stat-priority {
    width: 16px;
    font-weight: 600;
    font-size: 12px;
    text-align: center;
  }

  .stat-bar-container {
    flex: 1;
    height: 4px;
    background: var(--border-color);
    border-radius: 2px;
    overflow: hidden;
  }

  .stat-bar {
    height: 100%;
    border-radius: 2px;
    transition: width 0.3s ease;
  }

  .stat-count {
    font-size: 11px;
    color: var(--text-muted);
    min-width: 32px;
    text-align: right;
  }

  .review-content {
    border-top: 1px solid var(--border-color);
    padding-top: 12px;
    margin-bottom: 12px;
  }

  .content-section {
    margin-bottom: 8px;
  }

  .content-label {
    font-size: 12px;
    color: var(--text-muted);
    margin-right: 4px;
  }

  .content-text {
    font-size: 13px;
    color: var(--text-secondary);
  }

  .review-footer {
    display: flex;
    justify-content: flex-end;
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
  }

  .empty-text {
    font-size: 16px;
    margin: 0 0 8px;
    color: var(--text-secondary);
  }

  .empty-hint {
    font-size: 13px;
    margin: 0;
  }
</style>
