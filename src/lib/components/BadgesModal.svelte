<script lang="ts">
  import { getGamificationStore } from '$lib/stores/gamification.svelte';
  import { getI18nStore } from '$lib/i18n';
  import { fade, scale } from 'svelte/transition';

  interface Props {
    onClose: () => void;
  }

  let { onClose }: Props = $props();

  const game = getGamificationStore();
  const i18n = getI18nStore();
  const t = i18n.t;

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="modal-overlay" onclick={handleBackdropClick} transition:fade={{ duration: 200 }}>
  <div class="modal-content" transition:scale={{ duration: 200, start: 0.95 }}>
    <div class="modal-header">
      <div class="header-title">
        <span class="icon">🏅</span>
        <h2>{t('nav.badges') || 'Achievements'}</h2>
      </div>
      <button class="close-btn" onclick={onClose}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>

    <div class="profile-section">
      <div class="level-badge">
        <span class="level-num">{game.currentLevel.level}</span>
      </div>
      <div class="level-info">
        <h3>{game.currentLevel.title}</h3>
        <div class="xp-bar-container">
          <div class="xp-bar" style:width="{game.progressToNextLevel}%"></div>
        </div>
        <div class="xp-text">
          {game.xp} XP / {game.nextLevel ? game.nextLevel.xpRequired : 'MAX'} XP
        </div>
      </div>
    </div>

    <div class="badges-grid">
      {#each game.badges as badge}
        <div class="badge-card" class:locked={!badge.unlocked}>
          <div class="badge-icon">{badge.icon}</div>
          <div class="badge-info">
            <div class="badge-name">{badge.name}</div>
            <div class="badge-desc">{badge.description}</div>
            {#if badge.unlocked}
              <div class="unlock-date">Unlocked {new Date(badge.unlockedAt!).toLocaleDateString()}</div>
            {:else}
              <div class="xp-reward">+{badge.xpReward} XP</div>
            {/if}
          </div>
          {#if !badge.unlocked}
            <div class="lock-overlay">🔒</div>
          {/if}
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999; /* Max z-index to be above everything */
    backdrop-filter: blur(2px);
  }

  .modal-content {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    width: 100%;
    max-width: 600px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px;
    border-bottom: 1px solid var(--border-subtle);
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .header-title h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 700;
  }

  .header-title .icon {
    font-size: 24px;
  }

  .close-btn {
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 8px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s;
  }

  .close-btn:hover {
    background: var(--hover-bg);
    color: var(--text-primary);
  }

  .close-btn svg {
    width: 20px;
    height: 20px;
  }

  .profile-section {
    padding: 24px;
    display: flex;
    align-items: center;
    gap: 20px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-subtle);
  }

  .level-badge {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background: var(--primary);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: 800;
    font-size: 24px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    border: 3px solid var(--bg-primary);
  }

  .level-info {
    flex: 1;
  }

  .level-info h3 {
    margin: 0 0 8px 0;
    font-size: 18px;
    font-weight: 700;
  }

  .xp-bar-container {
    height: 10px;
    background: var(--border-color);
    border-radius: 5px;
    overflow: hidden;
    margin-bottom: 6px;
  }

  .xp-bar {
    height: 100%;
    background: linear-gradient(90deg, var(--primary), var(--secondary, #be4bdb));
    transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .xp-text {
    font-size: 12px;
    color: var(--text-muted);
    font-weight: 500;
    text-align: right;
  }

  .badges-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 16px;
    padding: 24px;
    overflow-y: auto;
  }

  .badge-card {
    background: var(--bg-primary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    padding: 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    position: relative;
    transition: transform 0.2s, box-shadow 0.2s;
  }

  .badge-card:not(.locked):hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
    border-color: var(--primary);
  }

  .badge-card.locked {
    opacity: 0.6;
    filter: grayscale(0.8);
  }

  .badge-icon {
    font-size: 32px;
    margin-bottom: 12px;
  }

  .badge-name {
    font-weight: 600;
    font-size: 13px;
    margin-bottom: 4px;
    color: var(--text-primary);
  }

  .badge-desc {
    font-size: 11px;
    color: var(--text-muted);
    line-height: 1.4;
    margin-bottom: 8px;
  }

  .unlock-date {
    font-size: 10px;
    color: var(--success);
    font-weight: 500;
    margin-top: auto;
  }

  .xp-reward {
    font-size: 10px;
    color: var(--primary);
    font-weight: 600;
    margin-top: auto;
    background: var(--primary-bg);
    padding: 2px 6px;
    border-radius: 4px;
  }

  .lock-overlay {
    position: absolute;
    top: 10px;
    right: 10px;
    font-size: 14px;
    opacity: 0.5;
  }
</style>

