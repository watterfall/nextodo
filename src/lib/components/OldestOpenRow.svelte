<script lang="ts">
  /**
   * The oldest thing still owed, always on screen.
   *
   * This is the highest-diagnostic-value number the app has, and it is not a
   * queue measurement. A task that has sat for seven weeks in a system with a
   * hard 15-task cap is not waiting for capacity — it is being avoided, and
   * avoidance tracks task aversiveness, which comes from vagueness and from
   * feeling unable rather than from laziness.
   *
   * That is why "do it" here does not just raise the priority. It asks for a
   * situational cue to start from, which is the intervention with the largest
   * effect size in this area and the one that works without depending on the
   * user feeling motivated at the time.
   *
   * Two rules for the copy and layout, both load-bearing:
   *
   * 1. **Neutral wording.** Self-blame is not a correction mechanism; it is
   *    fuel for more avoidance. The row states a number, it does not judge.
   * 2. **"Drop it" is equal in weight to "do it."** If dropping looks like
   *    failing, nobody drops anything, and the queue never clears.
   */
  import { getTasksStore, updateTask, cancelTask } from '$lib/stores/tasks.svelte';
  import { getI18nStore } from '$lib/i18n';
  import { currentUnitStartLocal } from '$lib/utils/unitCalc';
  import { showToast } from '$lib/stores/ui.svelte';

  /**
   * Days after which the row grows its two buttons.
   *
   * A unit is two days, so fourteen means the task has been carried past seven
   * consecutive units. Under that, the age is worth showing but not worth
   * interrupting for — a task that is three days old is just a task.
   */
  const STALE_DAYS = 14;

  const tasks = getTasksStore();
  const i18n = getI18nStore();
  const t = i18n.t;

  const oldest = $derived(tasks.flowAge.oldest);
  const isStale = $derived((oldest?.days ?? 0) >= STALE_DAYS);

  let asking = $state(false);
  let triggerDraft = $state('');
  let inputEl = $state<HTMLInputElement | null>(null);

  function startAsking() {
    if (!oldest) return;
    triggerDraft = oldest.task.trigger ?? '';
    asking = true;
    queueMicrotask(() => inputEl?.focus());
  }

  function cancelAsking() {
    asking = false;
    triggerDraft = '';
  }

  async function commit() {
    if (!oldest) return;
    const cue = triggerDraft.trim();
    if (!cue) return;
    await updateTask(oldest.task.id, {
      trigger: cue,
      // Bring it into the unit that is running now, so it stops being carried.
      unitStart: currentUnitStartLocal()
    });
    asking = false;
    triggerDraft = '';
    showToast(t('flow.revived') || '已设定启动线索', 'success');
  }

  async function drop() {
    if (!oldest) return;
    await cancelTask(oldest.task.id);
    // Deliberately plain. No "are you sure", no consolation, no streak lost:
    // dropping a task is a decision, not a lapse.
    showToast(t('flow.dropped') || '已取消', 'info');
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') cancelAsking();
  }
</script>

{#if oldest}
  <div class="oldest-row" class:stale={isStale}>
    <div class="oldest-main">
      <span class="oldest-age font-num" class:stale={isStale}>
        {t('flow.oldestAge', { n: oldest.days })}
      </span>
      <span class="oldest-content" title={oldest.task.content}>{oldest.task.content}</span>
      {#if oldest.task.trigger}
        <span class="oldest-trigger" title={oldest.task.trigger}>⟶ {oldest.task.trigger}</span>
      {/if}
    </div>

    {#if isStale && !asking}
      <div class="oldest-actions">
        <button class="oldest-btn" onclick={startAsking}>{t('flow.doIt') || '做掉'}</button>
        <button class="oldest-btn" onclick={drop}>{t('flow.dropIt') || '杀掉'}</button>
      </div>
    {/if}
  </div>

  {#if asking}
    <div class="oldest-ask">
      <label class="ask-label" for="oldest-trigger-input">{t('flow.askTrigger')}</label>
      <div class="ask-row">
        <input
          id="oldest-trigger-input"
          bind:this={inputEl}
          bind:value={triggerDraft}
          class="ask-input"
          type="text"
          placeholder={t('flow.askTriggerPlaceholder')}
          onkeydown={onKeydown}
        />
        <button class="ask-btn primary" onclick={commit} disabled={!triggerDraft.trim()}>
          {t('action.confirm') || '确定'}
        </button>
        <button class="ask-btn" onclick={cancelAsking}>{t('action.cancel') || '取消'}</button>
      </div>
    </div>
  {/if}
{/if}

<style>
  .oldest-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 14px;
    margin-bottom: 10px;
    border: 1px solid var(--border-subtle);
    border-radius: 10px;
    background: var(--bg-elevated);
    font-size: 12px;
  }

  /* Emphasis, not alarm: a slightly warmer border and nothing else. A red
     banner would read as an accusation, and the point is to make the number
     easy to act on, not hard to look at. */
  .oldest-row.stale {
    border-color: var(--warning, #ff922b);
  }

  .oldest-main {
    display: flex;
    align-items: baseline;
    gap: 8px;
    min-width: 0;
  }

  .oldest-age {
    font-weight: 600;
    color: var(--text-muted);
    white-space: nowrap;
  }

  .oldest-age.stale {
    color: var(--warning, #ff922b);
  }

  .oldest-content {
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .oldest-trigger {
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .oldest-actions {
    display: flex;
    gap: 6px;
    flex-shrink: 0;
  }

  /* Both buttons are identical on purpose — see the header comment. */
  .oldest-btn {
    padding: 3px 10px;
    border: 1px solid var(--border-subtle);
    border-radius: 6px;
    background: transparent;
    color: var(--text-secondary);
    font-size: 12px;
    cursor: pointer;
    transition: background var(--transition-fast, 0.15s), color var(--transition-fast, 0.15s);
  }

  .oldest-btn:hover {
    background: var(--bg-hover, rgba(127, 127, 127, 0.12));
    color: var(--text-primary);
  }

  .oldest-ask {
    padding: 10px 14px;
    margin-bottom: 10px;
    border: 1px solid var(--border-subtle);
    border-radius: 10px;
    background: var(--bg-elevated);
  }

  .ask-label {
    display: block;
    margin-bottom: 6px;
    font-size: 12px;
    color: var(--text-secondary);
  }

  .ask-row {
    display: flex;
    gap: 6px;
  }

  .ask-input {
    flex: 1;
    padding: 6px 10px;
    border: 1px solid var(--border-subtle);
    border-radius: 6px;
    background: var(--bg-input, var(--bg-base));
    color: var(--text-primary);
    font-size: 13px;
    font-family: inherit;
  }

  .ask-input:focus {
    outline: none;
    border-color: var(--primary);
  }

  .ask-btn {
    padding: 6px 12px;
    border: 1px solid var(--border-subtle);
    border-radius: 6px;
    background: transparent;
    color: var(--text-secondary);
    font-size: 12px;
    cursor: pointer;
  }

  .ask-btn.primary {
    background: var(--primary);
    border-color: var(--primary);
    color: #fff;
  }

  .ask-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
