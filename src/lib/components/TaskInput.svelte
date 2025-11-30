<script lang="ts">
  import type { Priority } from '$lib/types';
  import { addTask } from '$lib/stores/tasks.svelte';
  import { showToast } from '$lib/stores/ui.svelte';
  import { highlightSyntax } from '$lib/utils/parser';

  interface Props {
    defaultPriority?: Priority;
    onSubmit?: () => void;
    onCancel?: () => void;
    autoFocus?: boolean;
    placeholder?: string;
  }

  let {
    defaultPriority = 'E',
    onSubmit,
    onCancel,
    autoFocus = false,
    placeholder = '输入任务... (+项目 @上下文 #标签 !优先级 ~日期 🍅数量)'
  }: Props = $props();

  let inputValue = $state('');
  let inputElement: HTMLInputElement | undefined = $state();
  let showSyntaxHint = $state(false);

  // Export focus method for external use (keyboard shortcuts)
  export function focus(): void {
    inputElement?.focus();
  }

  // Auto-add default priority if not specified
  $effect(() => {
    if (autoFocus && inputElement) {
      inputElement.focus();
    }
  });

  function handleSubmit() {
    if (!inputValue.trim()) return;

    // Add default priority if not specified
    let finalInput = inputValue;
    if (!finalInput.match(/![ABCDE]/i)) {
      finalInput = `${finalInput} !${defaultPriority}`;
    }

    const result = addTask(finalInput);

    if (result.success) {
      inputValue = '';
      showToast('任务已添加', 'success');
      onSubmit?.();
    } else if (result.error) {
      showToast(result.error, 'error');
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      inputValue = '';
      onCancel?.();
    }
  }

  function handleFocus() {
    showSyntaxHint = true;
  }

  function handleBlur() {
    showSyntaxHint = false;
  }

  const previewHtml = $derived(highlightSyntax(inputValue));
</script>

<div class="task-input-container">
  <div class="input-wrapper">
    <input
      type="text"
      class="task-input"
      bind:this={inputElement}
      bind:value={inputValue}
      onkeydown={handleKeydown}
      onfocus={handleFocus}
      onblur={handleBlur}
      {placeholder}
    />

    <button
      class="submit-btn"
      onclick={handleSubmit}
      disabled={!inputValue.trim()}
      aria-label="添加任务"
      title="添加任务"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
    </button>
  </div>

  {#if inputValue && showSyntaxHint}
    <div class="syntax-preview">
      {@html previewHtml}
    </div>
  {/if}

  {#if showSyntaxHint && !inputValue}
    <div class="syntax-hints">
      <div class="hint-group">
        <span class="hint-label">语法提示:</span>
        <span class="hint-item project">+项目</span>
        <span class="hint-item context">@上下文</span>
        <span class="hint-item tag">#标签</span>
        <span class="hint-item priority">!A-E</span>
        <span class="hint-item due">~日期</span>
        <span class="hint-item pomodoro">🍅数量</span>
      </div>
    </div>
  {/if}
</div>

<style>
  .task-input-container {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .input-wrapper {
    display: flex;
    gap: 8px;
  }

  .task-input {
    flex: 1;
    padding: 12px 16px;
    font-size: 14px;
    background: var(--input-bg);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    color: var(--text-primary);
    outline: none;
    transition: all 0.2s ease;
  }

  .task-input:focus {
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
  }

  .task-input::placeholder {
    color: var(--text-muted);
    font-size: 13px;
  }

  .submit-btn {
    width: 44px;
    height: 44px;
    flex-shrink: 0;
    border: none;
    border-radius: 8px;
    background: var(--primary);
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .submit-btn:hover:not(:disabled) {
    background: var(--primary-hover);
    transform: scale(1.05);
  }

  .submit-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .submit-btn svg {
    width: 20px;
    height: 20px;
  }

  .syntax-preview {
    padding: 8px 12px;
    font-size: 13px;
    background: var(--card-bg);
    border-radius: 6px;
    color: var(--text-secondary);
  }

  .syntax-preview :global(.syntax-priority) {
    color: #f97316;
    font-weight: 600;
  }

  .syntax-preview :global(.syntax-project) {
    color: #a78bfa;
  }

  .syntax-preview :global(.syntax-context) {
    color: #60a5fa;
  }

  .syntax-preview :global(.syntax-tag) {
    color: #34d399;
  }

  .syntax-preview :global(.syntax-due) {
    color: #f472b6;
  }

  .syntax-preview :global(.syntax-pomodoro) {
    color: #fb923c;
  }

  .syntax-hints {
    padding: 8px 12px;
    background: var(--card-bg);
    border-radius: 6px;
  }

  .hint-group {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }

  .hint-label {
    font-size: 12px;
    color: var(--text-muted);
  }

  .hint-item {
    font-size: 11px;
    padding: 2px 6px;
    border-radius: 4px;
    background: var(--tag-bg);
  }

  .hint-item.project { color: #a78bfa; }
  .hint-item.context { color: #60a5fa; }
  .hint-item.tag { color: #34d399; }
  .hint-item.priority { color: #f97316; }
  .hint-item.due { color: #f472b6; }
  .hint-item.pomodoro { color: #fb923c; }
</style>
