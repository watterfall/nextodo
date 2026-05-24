<script lang="ts">
  import type { Priority } from '$lib/types';
  import { PRIORITY_CONFIG } from '$lib/types';
  import { addTask, getTasksStore } from '$lib/stores/tasks.svelte';
  import { showToast } from '$lib/stores/ui.svelte';
  import { highlightSyntax } from '$lib/utils/parser';
  import { getI18nStore } from '$lib/i18n';
  import { tick } from 'svelte';

  const i18n = getI18nStore();
  const t = i18n.t;
  const tasks = getTasksStore();

  // ============================================================================
  // Command popup — slash-command style autocomplete for !A 【A】 +project @ctx #tag
  // ============================================================================
  type CommandMode = 'priority' | 'project' | 'context' | 'tag' | null;
  type CommandOption = {
    value: string;       // text to insert (e.g., 'A', 'work')
    label: string;       // display label (e.g., 'A 核心挑战')
    hint?: string;       // optional secondary text
    color?: string;      // optional color accent
  };

  let commandMode = $state<CommandMode>(null);
  let commandStart = $state(0);          // input cursor index where the trigger char sits
  let commandFilter = $state('');        // text typed after trigger (for filtering)
  let commandIndex = $state(0);          // currently highlighted option
  let triggerChar = $state<string>('');  // '!' | '【' | '+' | '@' | '#'

  const ALL_PRIORITIES: Priority[] = ['A', 'S', 'B', 'C', 'D', 'E', 'F', 'N'];

  const priorityOptions = $derived<CommandOption[]>(
    ALL_PRIORITIES.map(p => ({
      value: p,
      label: `${p} · ${PRIORITY_CONFIG[p].name}`,
      hint: PRIORITY_CONFIG[p].description,
      color: PRIORITY_CONFIG[p].color
    }))
  );

  const projectOptions = $derived<CommandOption[]>(
    [...new Set(tasks.tasks.flatMap(t => t.projects))].sort().map(p => ({
      value: p,
      label: p
    }))
  );

  const contextOptions = $derived<CommandOption[]>(
    [...new Set(tasks.tasks.flatMap(t => t.contexts))].sort().map(c => ({
      value: c,
      label: c
    }))
  );

  const tagOptions = $derived<CommandOption[]>(
    [...new Set(tasks.tasks.flatMap(t => t.customTags))].sort().map(tag => ({
      value: tag,
      label: tag
    }))
  );

  const currentOptions = $derived.by<CommandOption[]>(() => {
    let pool: CommandOption[] = [];
    if (commandMode === 'priority') pool = priorityOptions;
    else if (commandMode === 'project') pool = projectOptions;
    else if (commandMode === 'context') pool = contextOptions;
    else if (commandMode === 'tag') pool = tagOptions;
    if (!commandFilter) return pool;
    const f = commandFilter.toLowerCase();
    return pool.filter(o => o.value.toLowerCase().includes(f) || o.label.toLowerCase().includes(f));
  });

  // Reset highlight when option list shrinks below current index
  $effect(() => {
    if (commandIndex >= currentOptions.length) commandIndex = 0;
  });

  function closeCommand() {
    commandMode = null;
    commandFilter = '';
    commandIndex = 0;
    triggerChar = '';
  }

  // Detect a trigger in the input near the cursor. Called after every keystroke.
  function detectCommand() {
    if (!inputElement) return;
    const cursor = inputElement.selectionStart ?? inputValue.length;
    const before = inputValue.slice(0, cursor);
    // Walk back from cursor to find a trigger char that isn't preceded by a non-whitespace
    // (we only want triggers at word starts to avoid false matches in URLs etc.)
    const triggers: Record<string, CommandMode> = {
      '!': 'priority',
      '【': 'priority',
      '+': 'project',
      '@': 'context',
      '#': 'tag'
    };
    for (let i = before.length - 1; i >= 0; i--) {
      const ch = before[i];
      // Stop scanning back if we hit whitespace or the trigger itself
      if (ch === ' ' || ch === '\n' || ch === '\t') break;
      if (triggers[ch] !== undefined) {
        const prev = before[i - 1] ?? ' ';
        if (prev === ' ' || prev === '' || i === 0) {
          const mode = triggers[ch];
          // Special-case 【A】: close as soon as 】 typed
          if (ch === '【' && before.slice(i).includes('】')) {
            closeCommand();
            return;
          }
          commandMode = mode;
          triggerChar = ch;
          commandStart = i;
          commandFilter = before.slice(i + 1);
          return;
        }
        break;
      }
    }
    closeCommand();
  }

  function applyOption(option: CommandOption) {
    if (!inputElement) return;
    const cursor = inputElement.selectionStart ?? inputValue.length;
    const before = inputValue.slice(0, commandStart);
    const after = inputValue.slice(cursor);
    let inserted: string;
    if (commandMode === 'priority' && triggerChar === '【') {
      inserted = `【${option.value}】`;
    } else if (commandMode === 'priority') {
      inserted = `!${option.value}`;
    } else {
      inserted = `${triggerChar}${option.value}`;
    }
    const next = before + inserted + ' ' + after;
    inputValue = next;
    closeCommand();
    tick().then(() => {
      if (inputElement) {
        const pos = before.length + inserted.length + 1;
        inputElement.selectionStart = inputElement.selectionEnd = pos;
        inputElement.focus();
      }
    });
  }

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
    placeholder
  }: Props = $props();

  const actualPlaceholder = $derived(placeholder || t('task.addPlaceholder'));

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

  async function handleSubmit() {
    if (!inputValue.trim()) return;

    // Add default priority if not specified (accept both !X and 【X】 syntax)
    let finalInput = inputValue;
    const hasPriority =
      /!([ABCDEFNS])(?![A-Za-z])/i.test(finalInput) ||
      /【\s*([ABCDEFNS])\s*】/i.test(finalInput);
    if (!hasPriority) {
      finalInput = `${finalInput} !${defaultPriority}`;
    }

    const result = await addTask(finalInput);

    if (result.success) {
      inputValue = '';
      showToast(t('message.taskAdded'), 'success');
      onSubmit?.();
    } else if (result.error) {
      showToast(result.error, 'error');
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    // While IME composition is active, every key belongs to the IME — let it
    // through unmodified (especially Enter, which commits the candidate).
    if (isComposing || e.isComposing || e.keyCode === 229) return;
    // Command popup capture — arrow/Enter/Esc/Tab navigate options when open
    if (commandMode && currentOptions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        commandIndex = (commandIndex + 1) % currentOptions.length;
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        commandIndex = (commandIndex - 1 + currentOptions.length) % currentOptions.length;
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        applyOption(currentOptions[commandIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        closeCommand();
        return;
      }
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      inputValue = '';
      onCancel?.();
    }
  }

  // IME composition guard — while composing (e.g. Pinyin IME), don't open the
  // slash-command popup and don't intercept Enter, so the user can commit the
  // candidate without the command popup hijacking the keystroke.
  let isComposing = $state(false);

  function handleInput() {
    if (isComposing) return;
    // Run command detection after the bind:value update settles
    tick().then(detectCommand);
  }

  function handleFocus() {
    showSyntaxHint = true;
  }

  function handleBlur() {
    showSyntaxHint = false;
  }

  const previewHtml = $derived(highlightSyntax(inputValue));
</script>

<div class="task-input-container" style="position: relative;">
  <div class="input-wrapper">
    <input
      type="text"
      class="task-input"
      bind:this={inputElement}
      bind:value={inputValue}
      onkeydown={handleKeydown}
      oninput={handleInput}
      oncompositionstart={() => { isComposing = true; }}
      oncompositionend={() => { isComposing = false; tick().then(detectCommand); }}
      onfocus={handleFocus}
      onblur={(e) => {
        // Slight delay so click-on-option fires before blur tears popup down
        setTimeout(() => { closeCommand(); handleBlur(); }, 120);
      }}
      placeholder={actualPlaceholder}
    />

    {#if commandMode && currentOptions.length > 0}
      <!-- Command popup — slash-command style picker for ! / 【 / + / @ / # -->
      <div class="command-popup" role="listbox" aria-label="选择候选">
        <div class="command-header">
          <span class="command-mode-label">
            {#if commandMode === 'priority'}优先级{:else if commandMode === 'project'}项目{:else if commandMode === 'context'}情境{:else}标签{/if}
          </span>
          <span class="command-hint">↑↓ 选择 · Enter 确认 · Esc 关闭</span>
        </div>
        <ul class="command-list">
          {#each currentOptions.slice(0, 8) as option, idx}
            <li>
              <button
                type="button"
                class="command-option"
                class:focused={idx === commandIndex}
                onmousedown={(e) => { e.preventDefault(); applyOption(option); }}
                onmouseenter={() => commandIndex = idx}
                role="option"
                aria-selected={idx === commandIndex}
              >
                {#if option.color}
                  <span class="option-dot" style:background={option.color}></span>
                {/if}
                <span class="option-label">{option.label}</span>
                {#if option.hint}
                  <span class="option-hint">{option.hint}</span>
                {/if}
              </button>
            </li>
          {/each}
          {#if currentOptions.length > 8}
            <li class="command-more">还有 {currentOptions.length - 8} 个 · 继续输入以筛选</li>
          {/if}
        </ul>
      </div>
    {/if}

    <button
      class="submit-btn"
      onclick={handleSubmit}
      disabled={!inputValue.trim()}
      aria-label={t('task.add')}
      title={t('task.add')}
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
        <span class="hint-item priority">!A-F !S !N 或 【A】-【N】</span>
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

  /* Command popup — floats just below the input, slash-command style */
  .command-popup {
    position: absolute;
    left: 0;
    right: 50px;
    top: calc(100% + 6px);
    z-index: 100;
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    box-shadow: var(--elevation-3, 0 10px 30px rgba(0, 0, 0, 0.18));
    overflow: hidden;
    animation: slideUp 0.14s var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1));
  }

  .command-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 10px;
    border-bottom: 1px solid var(--border-subtle);
    background: var(--bg-secondary);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .command-mode-label {
    font-weight: 700;
    color: var(--text-secondary);
  }

  .command-hint {
    color: var(--text-muted);
    font-weight: 500;
    text-transform: none;
    letter-spacing: 0;
  }

  .command-list {
    list-style: none;
    margin: 0;
    padding: 4px;
    max-height: 280px;
    overflow-y: auto;
  }

  .command-option {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 7px 10px;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-primary);
    cursor: pointer;
    font-family: inherit;
    text-align: left;
    transition: background var(--transition-fast);
  }

  .command-option.focused {
    background: var(--primary-bg);
  }

  .option-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
    box-shadow: 0 0 0 1.5px currentColor;
  }

  .option-label {
    font-size: 13px;
    font-weight: 500;
    flex-shrink: 0;
  }

  .option-hint {
    font-size: 11px;
    color: var(--text-muted);
    margin-left: auto;
    text-align: right;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .command-more {
    padding: 6px 10px;
    font-size: 11px;
    color: var(--text-muted);
    text-align: center;
    font-style: italic;
  }
</style>
