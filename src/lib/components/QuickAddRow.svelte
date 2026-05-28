<script lang="ts">
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
  let isComposing = $state(false);
  let inputEl = $state<HTMLInputElement | null>(null);

  const accent = $derived(PRIORITY_CONFIG[priority].color);

  async function submit() {
    const text = content.trim();
    if (!text) return;

    // Append the column priority as a default. The parser uses the FIRST `!X`
    // token, so an explicit priority typed by the user still wins.
    const taskString = `${text} !${priority}`;
    let result = await addTask(taskString);

    // addTask only fails on a quota violation — offer to add anyway.
    if (!result.success && result.error) {
      if (confirm(result.error + '\n' + t('action.continueAnyway') + '?')) {
        result = await addTask(taskString, true);
      }
    }

    if (result.success) {
      content = '';
      showToast(t('message.taskAdded'), 'success');
      inputEl?.focus(); // keep the row open for rapid successive entry
    } else if (result.error) {
      showToast(result.error, 'error');
    }
  }

  function onKeydown(e: KeyboardEvent) {
    if (isComposing || e.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      content = '';
      isOpen = false;
      inputEl?.blur();
    }
  }

  function open() {
    isOpen = true;
  }

  function onBlur() {
    // Collapse only when nothing is being typed, so a half-typed task isn't lost.
    if (!content.trim()) isOpen = false;
  }

  function focusOnMount(node: HTMLInputElement) {
    node.focus();
  }
</script>

<div class="quick-add" style:--qa-accent={accent}>
  {#if isOpen}
    <input
      class="quick-add-input"
      bind:this={inputEl}
      bind:value={content}
      placeholder={t('quickAdd.placeholder')}
      oncompositionstart={() => (isComposing = true)}
      oncompositionend={() => (isComposing = false)}
      onkeydown={onKeydown}
      onblur={onBlur}
      use:focusOnMount
    />
  {:else}
    <button class="quick-add-trigger" onclick={open} title={t('quickAdd.add')}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <path d="M12 5v14M5 12h14" />
      </svg>
      <span>{t('quickAdd.add')}</span>
    </button>
  {/if}
</div>

<style>
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
