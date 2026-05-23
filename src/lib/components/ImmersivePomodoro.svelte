<script lang="ts">
  import { getPomodoroStore, pausePomodoro, resumePomodoro, stopPomodoro, skipSession, recordInterruption } from '$lib/stores/pomodoro.svelte';
  import { getI18nStore } from '$lib/i18n';
  import { tick } from 'svelte';
  import { scale, fade } from 'svelte/transition';

  interface Props {
    onClose: () => void;
  }

  let { onClose }: Props = $props();

  const pomodoro = getPomodoroStore();
  const i18n = getI18nStore();
  const t = i18n.t;
  let showInterruptionInput = $state(false);
  let interruptionReason = $state('');
  let interruptionInput = $state<HTMLInputElement | null>(null);
  let mouseActive = $state(false);
  let mouseTimer: ReturnType<typeof setTimeout> | null = null;
  let celebrate = $state(false);
  let previousState = $state(pomodoro.state);

  // Progress ring math
  const RADIUS = 150;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  const ringOffset = $derived(CIRCUMFERENCE * (1 - pomodoro.progress / 100));

  // State-driven derivations
  const isBreak = $derived(pomodoro.state === 'shortBreak' || pomodoro.state === 'longBreak');
  const isWork = $derived(pomodoro.state === 'work');

  // Progress color shifts as time runs out (work) or stays green (break)
  const progressColor = $derived.by(() => {
    if (isBreak) return '#34d399';
    const minutes = pomodoro.timeRemaining / 60;
    if (minutes <= 1) return '#ff6b6b';
    if (minutes <= 5) return '#fb923c';
    return '#9775fa';
  });

  // Detect work → break transition for celebration
  $effect(() => {
    const cur = pomodoro.state;
    if (previousState === 'work' && (cur === 'shortBreak' || cur === 'longBreak')) {
      celebrate = true;
      setTimeout(() => { celebrate = false; }, 2200);
    }
    previousState = cur;
  });

  function handleMouseMove() {
    mouseActive = true;
    if (mouseTimer) clearTimeout(mouseTimer);
    mouseTimer = setTimeout(() => { mouseActive = false; }, 2500);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (showInterruptionInput) return;
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === ' ') {
      e.preventDefault();
      if (pomodoro.isRunning) pausePomodoro();
      else resumePomodoro();
    } else if (e.key === 'i' || e.key === 'I') {
      openInterruptionInput();
    }
  }

  function openInterruptionInput() {
    showInterruptionInput = true;
    interruptionReason = '';
    if (pomodoro.isRunning) pausePomodoro();
  }

  function submitInterruption() {
    recordInterruption(interruptionReason || 'Unspecified');
    showInterruptionInput = false;
    interruptionReason = '';
    resumePomodoro();
  }

  function cancelInterruption() {
    showInterruptionInput = false;
    resumePomodoro();
  }

  $effect(() => {
    if (showInterruptionInput) {
      tick().then(() => interruptionInput?.focus());
    }
  });
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  class="immersive-overlay"
  data-state={pomodoro.state}
  class:break={isBreak}
  class:mouse-active={mouseActive}
  onmousemove={handleMouseMove}
  role="dialog"
  aria-label="Immersive focus"
>
  <!-- Animated mesh gradient background -->
  <div class="bg-mesh" aria-hidden="true"></div>
  <div class="bg-vignette" aria-hidden="true"></div>

  <!-- Exit (always visible but very faint until hover) -->
  <button class="exit-btn" onclick={onClose} title={t('pomodoro.immersive.exitTitle')}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  </button>

  <div class="immersive-content">
    <!-- Task name (small, above ring) -->
    <div class="task-name-row">
      {#if pomodoro.activeTask}
        <h1 class="task-name">{pomodoro.activeTask.content}</h1>
      {:else}
        <h1 class="task-name state-label">{pomodoro.stateLabel}</h1>
      {/if}
    </div>

    <!-- Timer ring -->
    <div class="timer-container" class:celebrate>
      <svg class="progress-ring" viewBox="0 0 320 320" aria-hidden="true">
        <defs>
          <filter id="ring-halo" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" />
          </filter>
        </defs>

        <!-- Halo (blurred copy, behind) -->
        <circle
          class="progress-halo"
          cx="160" cy="160" r={RADIUS}
          fill="none"
          stroke={progressColor}
          stroke-width="10"
          stroke-dasharray={CIRCUMFERENCE}
          stroke-dashoffset={ringOffset}
          stroke-linecap="round"
          transform="rotate(-90 160 160)"
          filter="url(#ring-halo)"
          opacity="0.45"
        />

        <!-- Track -->
        <circle
          class="progress-bg"
          cx="160" cy="160" r={RADIUS}
          fill="none"
          stroke-width="2.5"
        />

        <!-- Foreground progress -->
        <circle
          class="progress-bar"
          cx="160" cy="160" r={RADIUS}
          fill="none"
          stroke={progressColor}
          stroke-width="4"
          stroke-dasharray={CIRCUMFERENCE}
          stroke-dashoffset={ringOffset}
          stroke-linecap="round"
          transform="rotate(-90 160 160)"
        />
      </svg>

      <!-- Center display -->
      <div class="time-display">
        {#if celebrate}
          <div class="celebrate-text" in:scale={{ start: 0.92, duration: 260 }} out:fade={{ duration: 240 }}>
            <div class="celebrate-check">✓</div>
            <div class="celebrate-msg">{t('pomodoro.immersive.wellDone')}</div>
          </div>
        {:else}
          <span class="time-text font-num">{pomodoro.formattedTime}</span>
          <span class="state-text">{pomodoro.stateLabel}</span>
          {#if isBreak}
            <span class="break-hint" in:fade={{ duration: 400, delay: 300 }}>
              {t('pomodoro.immersive.breakHint')}
            </span>
          {/if}
        {/if}
      </div>
    </div>

    <!-- Session count (always visible, faint) -->
    <div class="session-count">
      <span class="tomato-icon">🍅</span>
      <span class="count font-num">× {pomodoro.todayCount}</span>
      {#if isWork && pomodoro.interruptionCount > 0}
        <span class="interruption-count font-num" title={t('pomodoro.immersive.interruptionCount')}>
          ⚡ {pomodoro.interruptionCount}
        </span>
      {/if}
    </div>

    <!-- Controls (hover-reveal) -->
    <div class="controls reveal-group" role="group" aria-label={t('pomodoro.immersive.timerControls')}>
      {#if pomodoro.isRunning}
        <button class="control-btn pause" onclick={pausePomodoro} aria-label={t('pomodoro.pause')} title={t('pomodoro.pause')}>
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <rect x="6" y="4" width="4" height="16" rx="1"></rect>
            <rect x="14" y="4" width="4" height="16" rx="1"></rect>
          </svg>
        </button>
      {:else}
        <button class="control-btn play" onclick={resumePomodoro} aria-label={t('pomodoro.resume')} title={t('pomodoro.resume')}>
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <polygon points="5,3 19,12 5,21"></polygon>
          </svg>
        </button>
      {/if}

      <button class="control-btn stop" onclick={stopPomodoro} aria-label={t('pomodoro.stop')} title={t('pomodoro.stop')}>
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <rect x="4" y="4" width="16" height="16" rx="2"></rect>
        </svg>
      </button>

      <button class="control-btn skip" onclick={skipSession} aria-label={t('pomodoro.skip')} title={t('pomodoro.skip')}>
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <polygon points="5,4 15,12 5,20"></polygon>
          <rect x="15" y="4" width="4" height="16"></rect>
        </svg>
      </button>

      {#if isWork}
        <button class="control-btn interrupt" onclick={openInterruptionInput} title={t('pomodoro.immersive.recordInterruption')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        </button>
      {/if}
    </div>

    <!-- Keyboard hint (faint, reveal on hover) -->
    <div class="keyboard-hint reveal-group">
      <span><kbd>Space</kbd> {t('pomodoro.immersive.keyboardPauseResume')}</span>
      <span><kbd>I</kbd> {t('pomodoro.immersive.keyboardInterrupt')}</span>
      <span><kbd>Esc</kbd> {t('pomodoro.immersive.keyboardExit')}</span>
    </div>
  </div>

  <!-- Interruption Input Modal -->
  {#if showInterruptionInput}
    <div class="interruption-modal" transition:fade={{ duration: 150 }}>
      <div class="modal-card" transition:scale={{ start: 0.95, duration: 200 }}>
        <h3>{t('pomodoro.immersive.interruptionTitle')}</h3>
        <input
          bind:this={interruptionInput}
          type="text"
          bind:value={interruptionReason}
          placeholder={t('pomodoro.immersive.interruptionPlaceholder')}
          onkeydown={(e) => e.key === 'Enter' && submitInterruption()}
        />
        <div class="modal-actions">
          <button class="btn-cancel" onclick={cancelInterruption}>{t('action.cancel')}</button>
          <button class="btn-confirm" onclick={submitInterruption}>{t('pomodoro.immersive.record')}</button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .immersive-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-primary);
    overflow: hidden;
    cursor: none;
  }

  .immersive-overlay.mouse-active {
    cursor: default;
  }

  /* Mesh gradient — state-aware, breathing */
  .bg-mesh {
    position: absolute;
    inset: -10%;
    background:
      radial-gradient(circle at 28% 24%, rgba(151, 117, 250, 0.18), transparent 45%),
      radial-gradient(circle at 78% 18%, rgba(218, 119, 242, 0.12), transparent 50%),
      radial-gradient(circle at 70% 82%, rgba(116, 192, 252, 0.10), transparent 55%),
      radial-gradient(circle at 20% 90%, rgba(151, 117, 250, 0.08), transparent 50%);
    animation: meshBreathe 6s ease-in-out infinite;
    filter: blur(40px);
    pointer-events: none;
    will-change: opacity, transform;
  }

  .immersive-overlay.break .bg-mesh {
    background:
      radial-gradient(circle at 30% 28%, rgba(52, 211, 153, 0.16), transparent 50%),
      radial-gradient(circle at 76% 22%, rgba(252, 196, 25, 0.10), transparent 50%),
      radial-gradient(circle at 70% 80%, rgba(81, 207, 102, 0.10), transparent 55%),
      radial-gradient(circle at 22% 86%, rgba(252, 196, 25, 0.08), transparent 50%);
    animation: meshBreathe 7s ease-in-out infinite;
  }

  /* Subtle radial vignette around edges for depth */
  .bg-vignette {
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse at center, transparent 50%, rgba(0, 0, 0, 0.25) 100%);
    pointer-events: none;
  }

  @keyframes meshBreathe {
    0%, 100% { opacity: 0.95; transform: scale(1); }
    50% { opacity: 1; transform: scale(1.04); }
  }

  /* Exit button — very faint, brightens on overlay hover */
  .exit-btn {
    position: fixed;
    top: 20px;
    right: 20px;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: var(--radius-md);
    color: var(--text-muted);
    opacity: 0.15;
    transition: opacity 0.3s var(--ease-out-expo), background 0.2s, color 0.2s;
    z-index: 2;
  }

  .immersive-overlay.mouse-active .exit-btn {
    opacity: 0.55;
  }

  .exit-btn:hover {
    opacity: 1 !important;
    background: var(--hover-bg);
    color: var(--text-primary);
  }

  .exit-btn svg {
    width: 18px;
    height: 18px;
  }

  /* Content stack */
  .immersive-content {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-xl);
    padding: var(--space-2xl);
    text-align: center;
  }

  /* Task name — smaller than before, sits as a label above the ring */
  .task-name-row {
    min-height: 32px;
    display: flex;
    align-items: center;
  }

  .task-name {
    font-size: var(--text-md);
    font-weight: 500;
    letter-spacing: 0.02em;
    color: var(--text-secondary);
    max-width: 520px;
    line-height: 1.4;
    opacity: 0.85;
  }

  .task-name.state-label {
    text-transform: uppercase;
    letter-spacing: 0.18em;
    font-size: var(--text-sm);
    color: var(--text-muted);
  }

  /* Timer ring container */
  .timer-container {
    position: relative;
    width: 360px;
    height: 360px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.6s var(--ease-out-expo);
  }

  .timer-container.celebrate {
    animation: ring-burst 1.6s var(--ease-out-expo);
  }

  @keyframes ring-burst {
    0% { transform: scale(1); }
    20% { transform: scale(1.05); }
    60% { transform: scale(0.99); }
    100% { transform: scale(1); }
  }

  .progress-ring {
    width: 100%;
    height: 100%;
    position: absolute;
    inset: 0;
  }

  .progress-bg {
    stroke: rgba(255, 255, 255, 0.06);
  }

  [data-theme="light"] .progress-bg {
    stroke: rgba(0, 0, 0, 0.08);
  }

  .progress-bar {
    transition: stroke-dashoffset 1s linear, stroke 0.6s var(--ease-out-expo);
  }

  .progress-halo {
    transition: stroke-dashoffset 1s linear, stroke 0.6s var(--ease-out-expo);
  }

  /* Center time display */
  .time-display {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
  }

  .time-text {
    font-size: 96px;
    font-weight: 300;
    color: var(--text-primary);
    letter-spacing: -0.04em;
    line-height: 1;
    font-variant-numeric: tabular-nums;
    text-shadow: 0 2px 24px rgba(0, 0, 0, 0.18);
  }

  .state-text {
    font-size: var(--text-sm);
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.3em;
    font-weight: 500;
  }

  .break-hint {
    margin-top: 6px;
    font-size: var(--text-sm);
    color: var(--text-secondary);
    font-style: italic;
    letter-spacing: 0.02em;
  }

  /* Celebration overlay inside ring */
  .celebrate-text {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .celebrate-check {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    background: linear-gradient(135deg, #34d399, #51cf66);
    color: white;
    font-size: 42px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow:
      0 0 0 12px rgba(52, 211, 153, 0.15),
      0 0 60px rgba(52, 211, 153, 0.4),
      var(--elevation-3);
    animation: check-pop 0.6s var(--ease-out-expo);
  }

  @keyframes check-pop {
    0% { transform: scale(0.3); opacity: 0; }
    60% { transform: scale(1.12); opacity: 1; }
    100% { transform: scale(1); opacity: 1; }
  }

  .celebrate-msg {
    font-size: var(--text-xl);
    font-weight: 500;
    color: var(--text-primary);
    letter-spacing: 0.02em;
  }

  /* Session count — faint, always visible */
  .session-count {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    font-size: var(--text-md);
    color: var(--text-muted);
    opacity: 0.7;
    transition: opacity 0.3s ease;
  }

  .immersive-overlay.mouse-active .session-count {
    opacity: 0.9;
  }

  .tomato-icon {
    font-size: 18px;
    line-height: 1;
  }

  .count {
    font-weight: 500;
    letter-spacing: -0.01em;
  }

  .interruption-count {
    margin-left: 12px;
    padding: 3px 10px;
    background: rgba(251, 146, 60, 0.16);
    border-radius: var(--radius-full);
    color: #fb923c;
    font-size: var(--text-sm);
    font-weight: 600;
  }

  /* Reveal group — invisible until mouse moves */
  .reveal-group {
    opacity: 0;
    transform: translateY(8px);
    transition: opacity 0.4s var(--ease-out-expo), transform 0.4s var(--ease-out-expo);
    pointer-events: none;
  }

  .immersive-overlay.mouse-active .reveal-group {
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
  }

  /* Controls */
  .controls {
    display: flex;
    align-items: center;
    gap: var(--space-md);
  }

  .control-btn {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--card-bg);
    border: 1px solid var(--border-hairline);
    border-radius: 50%;
    color: var(--text-secondary);
    box-shadow: var(--elevation-1);
    transition: all var(--transition-fast);
  }

  .control-btn:hover {
    background: var(--card-hover-bg);
    color: var(--text-primary);
    box-shadow: var(--elevation-2);
    transform: translateY(-1px);
  }

  .control-btn svg {
    width: 20px;
    height: 20px;
  }

  .control-btn.play,
  .control-btn.pause {
    width: 60px;
    height: 60px;
    background: var(--primary);
    color: white;
    border-color: transparent;
    box-shadow: var(--elevation-2), 0 0 24px rgba(151, 117, 250, 0.35);
  }

  .control-btn.play:hover,
  .control-btn.pause:hover {
    background: var(--primary-hover);
    color: white;
    box-shadow: var(--elevation-3), 0 0 32px rgba(151, 117, 250, 0.5);
  }

  .control-btn.play svg,
  .control-btn.pause svg {
    width: 24px;
    height: 24px;
  }

  .control-btn.interrupt {
    background: rgba(251, 146, 60, 0.15);
    color: #fb923c;
    border-color: rgba(251, 146, 60, 0.25);
  }

  .control-btn.interrupt:hover {
    background: rgba(251, 146, 60, 0.25);
    color: #fb923c;
  }

  /* Keyboard hint — bottom, faint */
  .keyboard-hint {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translate(-50%, 8px);
    display: flex;
    align-items: center;
    gap: var(--space-lg);
    font-size: var(--text-xs);
    color: var(--text-muted);
  }

  .immersive-overlay.mouse-active .keyboard-hint {
    transform: translate(-50%, 0);
  }

  .keyboard-hint span {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .keyboard-hint kbd {
    background: var(--hover-bg);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-sm);
    padding: 2px 7px;
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--text-secondary);
  }

  /* Interruption Modal */
  .interruption-modal {
    position: fixed;
    inset: 0;
    z-index: 1100;
    background: rgba(0, 0, 0, 0.55);
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(8px);
  }

  .modal-card {
    background: var(--card-bg);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xl);
    padding: var(--space-xl);
    width: 360px;
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
    box-shadow: var(--elevation-3);
  }

  .modal-card h3 {
    font-size: var(--text-lg);
    font-weight: 600;
    color: var(--text-primary);
  }

  .modal-card input {
    width: 100%;
    padding: 10px 12px;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
    background: var(--input-bg);
    color: var(--text-primary);
    font-size: var(--text-md);
    transition: all var(--transition-fast);
  }

  .modal-card input:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: var(--ring-focus);
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-sm);
  }

  .btn-cancel, .btn-confirm {
    padding: 8px 16px;
    border-radius: var(--radius-md);
    font-size: var(--text-base);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .btn-cancel {
    background: transparent;
    border: 1px solid var(--border-hairline);
    color: var(--text-secondary);
  }

  .btn-cancel:hover {
    background: var(--hover-bg);
    color: var(--text-primary);
  }

  .btn-confirm {
    background: var(--primary);
    color: white;
    border: none;
  }

  .btn-confirm:hover {
    background: var(--primary-hover);
  }

  /* Respect reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .bg-mesh,
    .timer-container.celebrate,
    .celebrate-check {
      animation: none !important;
    }
  }
</style>
