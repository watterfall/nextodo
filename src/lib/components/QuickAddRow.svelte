<script lang="ts">
  import { tick } from 'svelte';
  import type { Priority } from '$lib/types';
  import { PRIORITY_CONFIG } from '$lib/types';
  import { addTask } from '$lib/stores/tasks.svelte';
  import { showToast } from '$lib/stores/ui.svelte';
  import { getI18nStore } from '$lib/i18n';

  interface Props {
    priority: Priority;
  }

  let { priority }: Props = $props();

  const i18n = getI18nStore();
  const t = i18n.t;

  let isOpen = $state(false);
  let content = $state('');
  let saving = $state(false);
  let quotaWarning = $state('');
  let warnedText = '';
  let error = $state('');
  let isComposing = $state(false);
  let inputEl = $state<HTMLInputElement | null>(null);

  const accent = $derived(PRIORITY_CONFIG[priority].color);

  async function submit(force = false) {
    const text = content.trim();
    if (!text || saving || isComposing) return;
    const taskString = `${text} !${priority}`;
    const confirmed = force && warnedText === taskString;
    saving = true; error = '';
    try {
      const result = await addTask(taskString, confirmed);
      if (result.success) {
        content = ''; quotaWarning = ''; warnedText = '';
        showToast(t('message.taskAdded'), 'success');
      } else if (result.quotaExceeded) {
        quotaWarning = result.error ?? ''; warnedText = taskString;
      } else {
        error = result.error ?? t('error.saveFailed');
      }
    } catch { error = t('error.saveFailed'); }
    finally { saving = false; }
    await tick();
    inputEl?.focus();
  }

  function onKeydown(e: KeyboardEvent) {
    if (isComposing || e.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      quotaWarning = ''; error = '';
      isOpen = false;
      inputEl?.blur();
    }
  }

  function open() {
    isOpen = true;
  }

  function focusOnMount(node: HTMLInputElement) {
    node.focus();
  }
</script>

<div class="quick-add" style:--qa-accent={accent}>
  {#if isOpen}
    <form onsubmit={(e) => { e.preventDefault(); submit(); }}>
    <input
      class="quick-add-input"
      bind:this={inputEl}
      bind:value={content}
      disabled={saving}
      aria-label={`${priority} · ${t('quickAdd.add')}`}
      oninput={() => { quotaWarning = ''; error = ''; }}
      placeholder={t('quickAdd.placeholder')}
      oncompositionstart={() => (isComposing = true)}
      oncompositionend={() => (isComposing = false)}
      onkeydown={onKeydown}
      use:focusOnMount
    />
    <button class="submit" disabled={saving || !content.trim()} aria-label={t('quickAdd.add')} title={t('quickAdd.add')}>＋</button>
    <button class="dismiss" type="button" disabled={saving} aria-label={t('action.close')} title={t('action.close')} onclick={() => isOpen = false}>×</button>
    </form>
    {#if quotaWarning}<div class="feedback" role="status">{quotaWarning}<button disabled={saving} onclick={() => submit(true)}>{t('action.continueAnyway')}</button></div>{/if}
    {#if error}<div class="feedback" role="alert">{error}</div>{/if}
  {:else}
    <button class="quick-add-trigger" onclick={open} title={t('quickAdd.add')}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <path d="M12 5v14M5 12h14" />
      </svg>
      <span>{content.trim() || t('quickAdd.add')}</span>
    </button>
  {/if}
</div>

<style>
  form { display: flex; gap: 4px; }
  .quick-add-input { min-width: 0; flex: 1; }
  .submit, .dismiss { flex-shrink: 0; width: 30px; border: 1px solid var(--border-subtle); border-radius: 6px; background: var(--card-bg); color: var(--text-secondary); cursor: pointer; font-size: 18px; }
  .submit { color: var(--primary); }
  .feedback { font-size: 12px; color: var(--text-secondary); margin-top: 6px; overflow-wrap: anywhere; }
  .feedback button { font: inherit; color: var(--primary); background: var(--card-bg); border: 1px solid var(--border-subtle); border-radius: 5px; padding: 4px 6px; margin-top: 4px; cursor: pointer; }
  .quick-add-trigger span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .quick-add {
    flex-shrink: 0;
  }

  .quick-add-trigger {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 7px 10px;
    border: 1px dashed var(--border-subtle);
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--text-muted);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .quick-add-trigger:hover {
    border-color: var(--qa-accent);
    color: var(--qa-accent);
    background: color-mix(in srgb, var(--qa-accent) 8%, transparent);
  }

  .quick-add-trigger svg {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
  }

  .quick-add-input {
    width: 100%;
    box-sizing: border-box;
    padding: 8px 10px;
    font-size: 13px;
    background: var(--card-bg);
    border: 1px solid var(--qa-accent);
    border-radius: var(--radius-md);
    color: var(--text-primary);
    outline: none;
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--qa-accent) 18%, transparent);
  }

  .quick-add-input::placeholder {
    color: var(--text-muted);
  }
</style>
