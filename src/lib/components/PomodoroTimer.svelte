<script lang="ts">
  import {
    getPomodoroStore,
    pausePomodoro,
    resumePomodoro,
    stopPomodoro,
    skipSession
  } from '$lib/stores/pomodoro.svelte';

  interface Props {
    onEnterImmersive?: () => void;
  }

  let { onEnterImmersive }: Props = $props();

  const pomodoro = getPomodoroStore();

  // Calculate circle progress
  const circumference = 2 * Math.PI * 90;
  const strokeDashoffset = $derived(circumference - (pomodoro.progress / 100) * circumference);

  function getStateColor(): string {
    switch (pomodoro.state) {
      case 'work': return 'var(--primary)';
      case 'shortBreak': return 'var(--success)';
      case 'longBreak': return 'var(--info)';
      default: return 'var(--text-muted)';
    }
  }

  const stateColor = $derived(getStateColor());
</script>

<div class="pomodoro-timer" class:active={pomodoro.state !== 'idle'}>
  <div class="timer-display">
    <svg class="progress-ring" viewBox="0 0 200 200">
      <circle
        class="progress-bg"
        cx="100"
        cy="100"
        r="90"
        fill="none"
        stroke="var(--border-color)"
        stroke-width="4"
      />
      <circle
        class="progress-bar"
        cx="100"
        cy="100"
        r="90"
        fill="none"
        stroke={stateColor}
        stroke-width="4"
        stroke-linecap="round"
        stroke-dasharray={circumference}
        stroke-dashoffset={strokeDashoffset}
        transform="rotate(-90 100 100)"
      />
    </svg>

    <div class="timer-content">
      <div class="time" style:color={stateColor}>
        {pomodoro.formattedTime}
      </div>
      <div class="state-label">
        {pomodoro.stateLabel}
      </div>
      {#if pomodoro.activeTask}
        <div class="active-task" title={pomodoro.activeTask.content}>
          {pomodoro.activeTask.content.length > 20
            ? pomodoro.activeTask.content.slice(0, 20) + '...'
            : pomodoro.activeTask.content}
        </div>
      {/if}
    </div>
  </div>

  <div class="timer-controls">
    {#if pomodoro.state !== 'idle'}
      {#if pomodoro.isRunning}
        <button class="control-btn pause" onclick={pausePomodoro} title="暂停">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16"></rect>
            <rect x="14" y="4" width="4" height="16"></rect>
          </svg>
        </button>
      {:else}
        <button class="control-btn play" onclick={resumePomodoro} title="继续">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
        </button>
      {/if}

      <button class="control-btn skip" onclick={skipSession} title="跳过">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <polygon points="5 4 15 12 5 20 5 4"></polygon>
          <line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" stroke-width="2"></line>
        </svg>
      </button>

      <button class="control-btn stop" onclick={stopPomodoro} title="放弃">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <rect x="4" y="4" width="16" height="16" rx="2"></rect>
        </svg>
      </button>
    {/if}
  </div>

  <div class="session-count">
    <span class="count-label">今日番茄</span>
    <span class="count-value">🍅 ×{pomodoro.todayCount}</span>
  </div>

  {#if pomodoro.state !== 'idle' && onEnterImmersive}
    <button class="immersive-btn" onclick={onEnterImmersive} title="进入沉浸模式">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
      </svg>
      <span>沉浸模式</span>
    </button>
  {/if}
</div>

<style>
  .pomodoro-timer {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    padding: 20px;
    background: var(--card-bg);
    border-radius: var(--radius-lg);
    border: 1px solid var(--border-subtle);
    transition: all var(--transition-normal);
  }

  .pomodoro-timer.active {
    border-color: var(--primary);
    box-shadow: var(--shadow-glow);
  }

  .timer-display {
    position: relative;
    width: 180px;
    height: 180px;
  }

  .progress-ring {
    width: 100%;
    height: 100%;
  }

  .progress-bar {
    transition: stroke-dashoffset 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .timer-content {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
  }

  .time {
    font-size: 42px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    letter-spacing: -2px;
  }

  .state-label {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .active-task {
    font-size: 11px;
    color: var(--text-muted);
    max-width: 140px;
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .timer-controls {
    display: flex;
    gap: 10px;
    min-height: 44px;
  }

  .control-btn {
    width: 44px;
    height: 44px;
    border: none;
    border-radius: var(--radius-full);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--transition-fast);
  }

  .control-btn svg {
    width: 18px;
    height: 18px;
  }

  .control-btn.play,
  .control-btn.pause {
    background: var(--primary);
    color: white;
  }

  .control-btn.play:hover,
  .control-btn.pause:hover {
    background: var(--primary-hover);
    transform: scale(1.08);
    box-shadow: var(--shadow-glow);
  }

  .control-btn.skip {
    background: var(--hover-bg);
    color: var(--text-muted);
    border: 1px solid var(--border-subtle);
  }

  .control-btn.skip:hover {
    background: var(--action-btn-hover-bg);
    color: var(--text-primary);
    border-color: var(--border-color);
  }

  .control-btn.stop {
    background: transparent;
    color: var(--error);
    border: 1px solid var(--error);
  }

  .control-btn.stop:hover {
    background: var(--error);
    color: white;
    transform: scale(1.05);
  }

  .session-count {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    background: var(--hover-bg);
    border-radius: var(--radius-full);
  }

  .count-label {
    font-size: 11px;
    font-weight: 500;
    color: var(--text-muted);
  }

  .count-value {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .immersive-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 100%;
    padding: 10px 14px;
    border: 1px dashed var(--border-color);
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
    transition: all var(--transition-fast);
  }

  .immersive-btn:hover {
    border-color: var(--primary);
    color: var(--primary);
    background: var(--primary-bg);
  }

  .immersive-btn svg {
    width: 14px;
    height: 14px;
  }
</style>
