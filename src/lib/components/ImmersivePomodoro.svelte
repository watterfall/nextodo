<script lang="ts">
  import { getPomodoroStore, pausePomodoro, resumePomodoro, stopPomodoro, skipSession, recordInterruption } from '$lib/stores/pomodoro.svelte';
  import { getI18nStore } from '$lib/i18n';
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

  // Calculate progress ring
  const RADIUS = 140;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

  // Get stroke dashoffset based on progress
  function getStrokeDashoffset(): number {
    return CIRCUMFERENCE * (1 - pomodoro.progress / 100);
  }

  // Get color based on time remaining
  function getProgressColor(): string {
    if (pomodoro.state === 'shortBreak' || pomodoro.state === 'longBreak') {
      return '#10b981'; // Green for break
    }

    const minutes = pomodoro.timeRemaining / 60;
    if (minutes <= 1) {
      return '#ef4444'; // Red
    } else if (minutes <= 5) {
      return '#f97316'; // Orange
    }
    return '#8b5cf6'; // Purple
  }

  // Get background color for state
  function getBackgroundColor(): string {
    if (pomodoro.state === 'shortBreak' || pomodoro.state === 'longBreak') {
      return 'rgba(16, 185, 129, 0.05)';
    }
    return 'rgba(139, 92, 246, 0.03)';
  }

  function handleKeydown(e: KeyboardEvent) {
    if (showInterruptionInput) return; // Don't handle shortcuts while typing reason

    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === ' ') {
      e.preventDefault();
      if (pomodoro.isRunning) {
        pausePomodoro();
      } else {
        resumePomodoro();
      }
    } else if (e.key === 'i' || e.key === 'I') {
      // Press 'i' to record interruption
      openInterruptionInput();
    }
  }

  function openInterruptionInput() {
    showInterruptionInput = true;
    interruptionReason = '';
    // Pause timer while logging interruption
    if (pomodoro.isRunning) {
      pausePomodoro();
    }
  }

  function submitInterruption() {
    recordInterruption(interruptionReason || 'Unspecified');
    showInterruptionInput = false;
    interruptionReason = '';
    // Resume timer
    resumePomodoro();
  }

  function cancelInterruption() {
    showInterruptionInput = false;
    resumePomodoro();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="immersive-overlay" style:background={getBackgroundColor()}>
  <div class="immersive-content">
    <!-- Exit button -->
    <button class="exit-btn" onclick={onClose} title="退出沉浸模式 (Esc)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>

    <!-- Task name -->
    {#if pomodoro.activeTask}
      <h1 class="task-name">{pomodoro.activeTask.content}</h1>
    {:else}
      <h1 class="task-name state-label">{pomodoro.stateLabel}</h1>
    {/if}

    <!-- Timer ring -->
    <div class="timer-container">
      <svg class="progress-ring" viewBox="0 0 320 320">
        <!-- Background circle -->
        <circle
          class="progress-bg"
          cx="160"
          cy="160"
          r={RADIUS}
          fill="none"
          stroke-width="8"
        />
        <!-- Progress circle -->
        <circle
          class="progress-bar"
          cx="160"
          cy="160"
          r={RADIUS}
          fill="none"
          stroke-width="8"
          stroke={getProgressColor()}
          stroke-dasharray={CIRCUMFERENCE}
          stroke-dashoffset={getStrokeDashoffset()}
          stroke-linecap="round"
          transform="rotate(-90 160 160)"
        />
      </svg>

      <!-- Time display -->
      <div class="time-display">
        <span class="time-text">{pomodoro.formattedTime}</span>
        <span class="state-text">{pomodoro.stateLabel}</span>
      </div>
    </div>

    <!-- Controls -->
    <div class="controls" role="group" aria-label="计时器控制">
      {#if pomodoro.isRunning}
        <button class="control-btn pause" onclick={pausePomodoro} aria-label="暂停" title="暂停">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <rect x="6" y="4" width="4" height="16" rx="1"></rect>
            <rect x="14" y="4" width="4" height="16" rx="1"></rect>
          </svg>
        </button>
      {:else}
        <button class="control-btn play" onclick={resumePomodoro} aria-label="继续" title="继续">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <polygon points="5,3 19,12 5,21"></polygon>
          </svg>
        </button>
      {/if}

      <button class="control-btn stop" onclick={stopPomodoro} aria-label="停止" title="停止">
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <rect x="4" y="4" width="16" height="16" rx="2"></rect>
        </svg>
      </button>

      <button class="control-btn skip" onclick={skipSession} aria-label="跳过" title="跳过">
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <polygon points="5,4 15,12 5,20"></polygon>
          <rect x="15" y="4" width="4" height="16"></rect>
        </svg>
      </button>

      {#if pomodoro.state === 'work'}
        <button class="control-btn interrupt" onclick={openInterruptionInput} title="记录中断 (I)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        </button>
      {/if}
    </div>

    <!-- Session count and interruptions -->
    <div class="session-count">
      <span class="tomato-icon">🍅</span>
      <span class="count">× {pomodoro.todayCount}</span>
      {#if pomodoro.state === 'work' && pomodoro.interruptionCount > 0}
        <span class="interruption-count" title="本次中断次数">
          ⚡ {pomodoro.interruptionCount}
        </span>
      {/if}
    </div>

    <!-- Keyboard hint -->
    <div class="keyboard-hint">
      <kbd>Space</kbd> 暂停/继续
      <kbd>I</kbd> 记录中断
      <kbd>Esc</kbd> 退出
    </div>
  </div>

  <!-- Interruption Input Modal -->
  {#if showInterruptionInput}
    <div class="interruption-modal" transition:fade={{ duration: 150 }}>
      <div class="modal-card" transition:scale={{ start: 0.95, duration: 200 }}>
        <h3>记录中断原因</h3>
        <input 
          type="text" 
          bind:value={interruptionReason} 
          placeholder="例如：老板电话、同事询问..." 
          onkeydown={(e) => e.key === 'Enter' && submitInterruption()}
          autofocus
        />
        <div class="modal-actions">
          <button class="btn-cancel" onclick={cancelInterruption}>取消</button>
          <button class="btn-confirm" onclick={submitInterruption}>记录</button>
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
    transition: background 0.5s ease;
  }

  .immersive-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 32px;
    padding: 48px;
  }

  .exit-btn {
    position: fixed;
    top: 24px;
    right: 24px;
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--action-btn-bg);
    border-radius: 50%;
    color: var(--text-muted);
    opacity: 0.5;
    transition: all 0.2s ease;
  }

  .exit-btn:hover {
    opacity: 1;
    background: var(--action-btn-hover-bg);
    color: var(--text-primary);
  }

  .exit-btn svg {
    width: 24px;
    height: 24px;
  }

  .task-name {
    font-size: 32px;
    font-weight: 600;
    color: var(--text-primary);
    text-align: center;
    max-width: 600px;
    line-height: 1.3;
  }

  .task-name.state-label {
    color: var(--text-secondary);
    font-weight: 500;
  }

  .timer-container {
    position: relative;
    width: 320px;
    height: 320px;
  }

  .progress-ring {
    width: 100%;
    height: 100%;
  }

  .progress-bg {
    stroke: var(--border-color);
  }

  .progress-bar {
    transition: stroke-dashoffset 1s linear, stroke 0.5s ease;
  }

  .time-display {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .time-text {
    font-size: 72px;
    font-weight: 300;
    font-family: 'SF Mono', 'Menlo', 'Monaco', monospace;
    color: var(--text-primary);
    letter-spacing: 2px;
  }

  .state-text {
    font-size: 16px;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 3px;
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 24px;
  }

  .control-btn {
    width: 64px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--action-btn-bg);
    border-radius: 50%;
    color: var(--text-secondary);
    transition: all 0.2s ease;
  }

  .control-btn:hover {
    background: var(--action-btn-hover-bg);
    color: var(--text-primary);
    transform: scale(1.05);
  }

  .control-btn svg {
    width: 28px;
    height: 28px;
  }

  .control-btn.play {
    width: 80px;
    height: 80px;
    background: var(--primary);
    color: white;
  }

  .control-btn.play:hover {
    background: var(--primary-hover);
    color: white;
  }

  .control-btn.pause {
    width: 80px;
    height: 80px;
    background: var(--primary);
    color: white;
  }

  .control-btn.pause:hover {
    background: var(--primary-hover);
    color: white;
  }

  .control-btn.play svg,
  .control-btn.pause svg {
    width: 32px;
    height: 32px;
  }

  .control-btn.interrupt {
    background: rgba(251, 146, 60, 0.2);
    color: #fb923c;
  }

  .control-btn.interrupt:hover {
    background: rgba(251, 146, 60, 0.3);
    color: #fb923c;
  }

  .session-count {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 24px;
    color: var(--text-secondary);
  }

  .tomato-icon {
    font-size: 28px;
  }

  .count {
    font-weight: 500;
  }

  .interruption-count {
    margin-left: 16px;
    padding: 4px 12px;
    background: rgba(251, 146, 60, 0.2);
    border-radius: 16px;
    color: #fb923c;
    font-size: 18px;
    font-weight: 500;
  }

  .keyboard-hint {
    position: fixed;
    bottom: 24px;
    display: flex;
    align-items: center;
    gap: 16px;
    font-size: 12px;
    color: var(--text-muted);
    opacity: 0.5;
  }

  .keyboard-hint kbd {
    background: var(--input-bg);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    padding: 4px 8px;
    font-family: inherit;
    font-size: 11px;
  }

  /* Interruption Modal */
  .interruption-modal {
    position: fixed;
    inset: 0;
    z-index: 1100;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(4px);
  }

  .modal-card {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    padding: 24px;
    width: 320px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    box-shadow: var(--shadow-lg);
  }

  .modal-card h3 {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .modal-card input {
    width: 100%;
    padding: 10px;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-color);
    background: var(--input-bg);
    color: var(--text-primary);
    font-size: 14px;
  }

  .modal-card input:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 2px var(--primary-bg);
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }

  .btn-cancel, .btn-confirm {
    padding: 8px 16px;
    border-radius: var(--radius-md);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
  }

  .btn-cancel {
    background: transparent;
    border: 1px solid var(--border-color);
    color: var(--text-secondary);
  }

  .btn-confirm {
    background: var(--primary);
    color: white;
    border: none;
  }

  .btn-confirm:hover {
    background: var(--primary-hover);
  }
</style>
