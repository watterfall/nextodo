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
    defaultPriority = 'F',
    onSubmit,
    onCancel,
    autoFocus = false,
    placeholder = '输入任务... (+项目 @上下文 #标签 !A-F ~日期 🍅数量)'
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
    if (!finalInput.match(/![ABCDEF]/i)) {
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
        <span class="hint-item priority">!A-F</span>
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
    gap: 6px;
  }

  .input-wrapper {
    display: flex;
    gap: 8px;
  }

  .task-input {
    flex: 1;
    padding: 12px 14px;
    font-size: 14px;
    font-weight: 450;
    background: var(--input-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    color: var(--text-primary);
    outline: none;
    transition: all var(--transition-fast);
  }

  .task-input:focus {
    border-color: var(--primary);
    box-shadow: 0 0 0 3px var(--primary-bg);
    background: var(--bg-secondary);
  }

  .task-input::placeholder {
    color: var(--text-muted);
    font-size: 13px;
    font-weight: 400;
  }

  .submit-btn {
    width: 42px;
    height: 42px;
    flex-shrink: 0;
    border: none;
    border-radius: var(--radius-md);
    background: var(--primary);
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--transition-fast);
  }

  .submit-btn:hover:not(:disabled) {
    background: var(--primary-hover);
    transform: scale(1.03);
    box-shadow: var(--shadow-glow);
  }

  .submit-btn:active:not(:disabled) {
    transform: scale(0.97);
  }

  .submit-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .submit-btn svg {
    width: 18px;
    height: 18px;
    stroke-width: 2.5;
  }

  .syntax-preview {
    padding: 10px 12px;
    font-size: 13px;
    background: var(--card-bg);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    color: var(--text-secondary);
    animation: slideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .syntax-preview :global(.syntax-priority) {
    color: var(--primary);
    font-weight: 600;
  }

  .syntax-preview :global(.syntax-project) {
    color: #b197fc;
    background: rgba(177, 151, 252, 0.1);
    padding: 1px 4px;
    border-radius: 3px;
  }

  .syntax-preview :global(.syntax-context) {
    color: #74c0fc;
    background: rgba(116, 192, 252, 0.1);
    padding: 1px 4px;
    border-radius: 3px;
  }

  .syntax-preview :global(.syntax-tag) {
    color: #63e6be;
    background: rgba(99, 230, 190, 0.1);
    padding: 1px 4px;
    border-radius: 3px;
  }

  .syntax-preview :global(.syntax-due) {
    color: #ffa94d;
    font-weight: 500;
  }

  .syntax-preview :global(.syntax-threshold) {
    color: #9775fa;
    font-weight: 500;
  }

  .syntax-preview :global(.syntax-recurrence) {
    color: #f783ac;
    font-weight: 500;
  }

  .syntax-preview :global(.syntax-pomodoro) {
    color: #ff8787;
    font-weight: 500;
  }

  .syntax-hints {
    padding: 10px 12px;
    background: var(--card-bg);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    animation: slideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .hint-group {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }

  .hint-label {
    font-size: 11px;
    font-weight: 500;
    color: var(--text-muted);
    margin-right: 4px;
  }

  .hint-item {
    font-size: 11px;
    font-weight: 500;
    padding: 3px 7px;
    border-radius: var(--radius-sm);
    background: var(--tag-bg);
    transition: all var(--transition-fast);
    cursor: default;
  }

  .hint-item:hover {
    transform: translateY(-1px);
  }

  .hint-item.project {
    color: #b197fc;
    background: rgba(177, 151, 252, 0.12);
  }
  .hint-item.context {
    color: #74c0fc;
    background: rgba(116, 192, 252, 0.12);
  }
  .hint-item.tag {
    color: #63e6be;
    background: rgba(99, 230, 190, 0.12);
  }
  .hint-item.priority {
    color: #da77f2;
    background: rgba(218, 119, 242, 0.12);
  }
  .hint-item.due {
    color: #ffa94d;
    background: rgba(255, 169, 77, 0.12);
  }
  .hint-item.pomodoro {
    color: #ff8787;
    background: rgba(255, 135, 135, 0.12);
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
