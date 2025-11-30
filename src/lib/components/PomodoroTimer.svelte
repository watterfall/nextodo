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
    gap: 16px;
    padding: 24px;
    background: var(--card-bg);
    border-radius: 16px;
    border: 1px solid var(--border-color);
  }

  .pomodoro-timer.active {
    border-color: var(--primary);
    box-shadow: 0 0 20px rgba(139, 92, 246, 0.1);
  }

  .timer-display {
    position: relative;
    width: 200px;
    height: 200px;
  }

  .progress-ring {
    width: 100%;
    height: 100%;
  }

  .progress-bar {
    transition: stroke-dashoffset 0.3s ease;
  }

  .timer-content {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
  }

  .time {
    font-size: 48px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    letter-spacing: -2px;
  }

  .state-label {
    font-size: 14px;
    color: var(--text-secondary);
  }

  .active-task {
    font-size: 12px;
    color: var(--text-muted);
    max-width: 150px;
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .timer-controls {
    display: flex;
    gap: 12px;
    min-height: 48px;
  }

  .control-btn {
    width: 48px;
    height: 48px;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .control-btn svg {
    width: 20px;
    height: 20px;
  }

  .control-btn.play,
  .control-btn.pause {
    background: var(--primary);
    color: white;
  }

  .control-btn.play:hover,
  .control-btn.pause:hover {
    background: var(--primary-hover);
    transform: scale(1.1);
  }

  .control-btn.skip {
    background: var(--card-bg);
    color: var(--text-muted);
    border: 1px solid var(--border-color);
  }

  .control-btn.skip:hover {
    background: var(--hover-bg);
    color: var(--text-primary);
  }

  .control-btn.stop {
    background: transparent;
    color: var(--error);
    border: 1px solid var(--error);
  }

  .control-btn.stop:hover {
    background: var(--error);
    color: white;
  }

  .session-count {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: var(--tag-bg);
    border-radius: 20px;
  }

  .count-label {
    font-size: 12px;
    color: var(--text-muted);
  }

  .count-value {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .immersive-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 12px 16px;
    border: 1px dashed var(--border-color);
    border-radius: 8px;
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 13px;
    transition: all 0.2s ease;
  }

  .immersive-btn:hover {
    border-color: var(--primary);
    color: var(--primary);
    background: var(--primary-bg);
  }

  .immersive-btn svg {
    width: 16px;
    height: 16px;
  }
</style>
