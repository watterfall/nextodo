<script lang="ts">
  import { getTasksStore } from '$lib/stores/tasks.svelte';
  import { fade, scale } from 'svelte/transition';
  import { getI18nStore } from '$lib/i18n';

  interface Props {
    onClose: () => void;
  }

  let { onClose }: Props = $props();

  const i18n = getI18nStore();
  const t = i18n.t;

  // Access badges with defensive fallback
  const badges = $derived.by(() => {
    try {
      const tasksStore = getTasksStore();
      return tasksStore?.appData?.badges ?? [];
    } catch {
      return [];
    }
  });

  // Defined Badges (to show locked ones too)
  const BADGES = [
    { id: 'planner_novice', name: '计划新手', desc: '完成第一次回顾', icon: '🌱' },
    { id: 'challenger', name: '挑战者', desc: '完成一个 A 类核心挑战任务', icon: '🏔️' },
    { id: 'flow_master', name: '心流大师', desc: '连续完成 4 个番茄钟无中断', icon: '🌊' },
    { id: 'early_bird', name: '早起鸟', desc: '在早上 9 点前完成一个任务', icon: '🌅' },
    { id: 'deep_diver', name: '深潜者', desc: '累计完成 10 小时深度工作', icon: '🤿' },
    { id: 'consistency_3', name: '持之以恒', desc: '连续 3 天有产出', icon: '🔥' },
    { id: 'consistency_7', name: '习惯养成', desc: '连续 7 天有产出', icon: '💎' }
  ];

  function isUnlocked(id: string) {
    return badges.some(b => b.id === id);
  }

  function getUnlockedDate(id: string) {
    const badge = badges.find(b => b.id === id);
    if (!badge || !badge.unlockedAt) return null;
    return new Date(badge.unlockedAt).toLocaleDateString();
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div 
  class="modal-overlay" 
  onclick={onClose}
  transition:fade={{ duration: 200 }}
  role="dialog"
  aria-modal="true"
  tabindex="-1"
>
  <div 
    class="modal-content" 
    onclick={(e) => e.stopPropagation()} 
    transition:scale={{ start: 0.95, duration: 250 }}
  >
    <div class="modal-header">
      <h2>成就勋章</h2>
      <button class="close-btn" onclick={onClose}>×</button>
    </div>

    <div class="modal-body">
      <div class="badges-grid">
        {#each BADGES as badge}
          {@const unlocked = isUnlocked(badge.id)}
          <div class="badge-card" class:locked={!unlocked}>
            <div class="badge-icon">{badge.icon}</div>
            <div class="badge-info">
              <h3>{badge.name}</h3>
              <p>{badge.desc}</p>
              {#if unlocked}
                <span class="unlock-date">解锁于 {getUnlockedDate(badge.id)}</span>
              {/if}
            </div>
            {#if !unlocked}
              <div class="lock-overlay">
                <span class="lock-icon">🔒</span>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal-content {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-xl);
    width: 90%;
    max-width: 600px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: var(--shadow-lg);
    overflow: hidden;
  }

  .modal-header {
    padding: 20px 24px;
    border-bottom: 1px solid var(--border-subtle);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .modal-header h2 {
    font-size: 20px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }

  .close-btn {
    font-size: 24px;
    color: var(--text-muted);
    background: transparent;
    border: none;
    cursor: pointer;
    line-height: 1;
    padding: 0;
  }

  .close-btn:hover {
    color: var(--text-primary);
  }

  .modal-body {
    padding: 24px;
    overflow-y: auto;
  }

  .badges-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 16px;
  }

  .badge-card {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    padding: 16px;
    background: var(--card-bg);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    position: relative;
    overflow: hidden;
    transition: all 0.2s;
  }

  .badge-card:not(.locked):hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
    border-color: var(--primary);
  }

  .badge-icon {
    font-size: 32px;
    flex-shrink: 0;
  }

  .badge-info h3 {
    font-size: 15px;
    font-weight: 600;
    margin: 0 0 4px;
    color: var(--text-primary);
  }

  .badge-info p {
    font-size: 12px;
    color: var(--text-secondary);
    margin: 0 0 8px;
    line-height: 1.4;
  }

  .unlock-date {
    font-size: 11px;
    color: var(--success);
    font-weight: 500;
  }

  .badge-card.locked {
    opacity: 0.7;
    background: var(--bg-primary);
  }

  .badge-card.locked .badge-icon {
    filter: grayscale(1);
    opacity: 0.5;
  }

  .lock-overlay {
    position: absolute;
    top: 8px;
    right: 8px;
  }

  .lock-icon {
    font-size: 14px;
    opacity: 0.5;
  }
</style>

