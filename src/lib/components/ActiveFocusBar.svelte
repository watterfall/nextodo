<script lang="ts">
  import { getPomodoroStore, togglePomodoro, stopPomodoro } from '$lib/stores/pomodoro.svelte';
  import { getTasksStore } from '$lib/stores/tasks.svelte';
  import { enterImmersiveMode } from '$lib/stores/ui.svelte';
  import { getI18nStore } from '$lib/i18n';
  const timer = getPomodoroStore();
  const tasks = getTasksStore();
  const t = getI18nStore().t;
  const task = $derived(tasks.tasks.find(task => task.id === timer.activeTaskId) ?? timer.activeTask);
</script>

{#if timer.state !== 'idle'}
  <section class="active-focus" class:paused={!timer.isRunning} aria-label={t('continuity.currentSession')}>
    <div class="session-context">
      <span class="session-label">{!timer.isRunning ? t('continuity.paused') : t(`pomodoro.${timer.state}`)}</span>
      <strong title={task?.content}>{task?.content ?? t('continuity.currentSession')}</strong>
    </div>
    <span class="session-time" aria-label={t('continuity.timeRemaining')}>{timer.formattedTime}</span>
    <div class="session-actions">
      <button class="primary" onclick={togglePomodoro}>{timer.isRunning ? t('pomodoro.pause') : t('pomodoro.resume')}</button>
      <button onclick={enterImmersiveMode}>{t('pomodoro.immersiveMode')}</button>
      <button class="stop" onclick={stopPomodoro}>{t('pomodoro.stop')}</button>
    </div>
  </section>
{/if}

<style>
  .active-focus { flex-shrink: 0; display: flex; align-items: center; gap: 16px; padding: 12px 20px; margin: 14px 24px 8px; border: 1px solid var(--primary); border-radius: 12px; background: var(--card-bg); }
  .session-context { flex: 1; min-width: 0; } .session-label { display: block; color: var(--primary); font-size: 11px; margin-bottom: 2px; }
  strong { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-primary); font-size: 13px; font-weight: 550; }
  .session-time { color: var(--text-primary); font-size: 24px; letter-spacing: -.04em; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .session-actions { display: flex; flex-wrap: wrap; gap: 6px; }
  button { padding: 7px 10px; font: inherit; font-size: 12px; background: var(--bg-secondary); color: var(--text-secondary); border: 1px solid var(--border-color); border-radius: 7px; cursor: pointer; }
  .primary { background: var(--primary); color: white; border-color: transparent; } .stop { background: transparent; }
  .paused { border-style: dashed; }
  @media (max-width: 700px) { .active-focus { margin: 10px 12px 6px; padding: 10px 12px; gap: 10px; flex-wrap: wrap; } .session-actions { width: 100%; } }
</style>
