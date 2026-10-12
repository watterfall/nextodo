<script lang="ts">
  import { continuationDraft, setContinuationDraft, acknowledgeContinuationDraft } from '$lib/stores/continuationDrafts.svelte';
  import { getTasksStore, updateTask } from '$lib/stores/tasks.svelte';
  import { getPomodoroStore, resumePomodoro } from '$lib/stores/pomodoro.svelte';
  import { getI18nStore } from '$lib/i18n';
  const tasks = getTasksStore();
  const pomodoro = getPomodoroStore();
  const t = getI18nStore().t;
  const task = $derived(tasks.tasks.find(task => task.id === pomodoro.activeTaskId));
  const paused = $derived(pomodoro.state === 'work' && !pomodoro.isRunning);
  const draft = $derived(task ? continuationDraft(task) : '');
  const dirty = $derived(!!task && draft !== (task.resumeNote ?? ''));
  let saving = $state(false);
  let error = $state('');
  async function save(thenResume = false) {
    if (!task || saving) return;
    const id = task.id;
    const text = draft;
    saving = true; error = '';
    try {
      await updateTask(id, { resumeNote: text.trim() || null });
      acknowledgeContinuationDraft(id, text);
      if (thenResume && pomodoro.activeTaskId === id && pomodoro.state === 'work') resumePomodoro();
    } catch { error = t('error.saveFailed'); }
    finally { saving = false; }
  }
</script>

{#if task && pomodoro.state === 'work'}
  <div class="focus-continuation">
    {#if task.nextAction}<p><strong>{t('planning.nextAction')}</strong><span>{task.nextAction}</span></p>{/if}
    {#if paused}
      <form onsubmit={(e) => { e.preventDefault(); save(); }}>
        <label>{t('planning.resumeNote')}
          <textarea rows="2" value={draft} oninput={(e) => { if (task) setContinuationDraft(task.id, e.currentTarget.value); error = ''; }} placeholder={t('planning.resumePlaceholder')} disabled={saving}></textarea>
        </label>
        <div class="note-actions"><button disabled={saving || !dirty}>{t('planning.saveNote')}</button><button class="resume-with-note" type="button" disabled={saving} onclick={() => save(true)}>{t('continuity.saveResume')}</button><small aria-live="polite">{dirty ? t('continuity.unsaved') : (task.resumeNote ? t('planning.saved') : t('planning.optional'))}</small></div>
        {#if error}<p role="alert">{error}</p>{/if}
      </form>
    {:else if draft}
      <p><strong>{dirty ? t('continuity.unsavedNote') : t('planning.resumeNote')}</strong><span>{draft}</span></p>
    {/if}
  </div>
{/if}

<style>
  .resume-with-note { color: var(--primary); border-color: var(--primary); }

  .focus-continuation { width: 100%; max-width: 440px; text-align: left; font-size: 12px; line-height: 1.5; color: var(--text-primary); }
  p { margin: 0 0 8px; overflow-wrap: anywhere; } strong, span { display: block; } strong, small { color: var(--text-muted); font-weight: 400; }
  textarea { box-sizing: border-box; width: 100%; margin-top: 5px; padding: 8px; border-radius: 8px; resize: vertical; font: inherit; color: var(--text-primary); background: var(--card-bg); border: 1px solid var(--border-subtle); }
  button { font: inherit; padding: 5px 9px; border: 1px solid var(--border-subtle); border-radius: 6px; color: var(--text-primary); background: var(--card-bg); cursor: pointer; }
  .note-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
</style>
