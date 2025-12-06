<script lang="ts">
  import { getUIStore, handleConfirmationConfirm, handleConfirmationCancel } from '$lib/stores/ui.svelte';
  import { getI18nStore } from '$lib/i18n';

  const ui = getUIStore();
  const i18n = getI18nStore();
  const t = i18n.t;

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      handleConfirmationCancel();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      handleConfirmationCancel();
    } else if (e.key === 'Enter') {
      handleConfirmationConfirm();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if ui.confirmationData}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-overlay" onclick={handleBackdropClick}>
    <div class="modal-content">
      <div class="modal-header">
        <div class="warning-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
        </div>
        <h3>{ui.confirmationData.title}</h3>
      </div>

      <div class="modal-body">
        <p>{ui.confirmationData.message}</p>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" onclick={handleConfirmationCancel}>
          {ui.confirmationData.cancelText || t('action.cancel')}
        </button>
        <button class="btn btn-warning" onclick={handleConfirmationConfirm}>
          {ui.confirmationData.confirmText || t('action.continueAnyway')}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1100;
    padding: 20px;
    animation: fadeIn 0.15s ease-out;
  }

  .modal-content {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    width: 100%;
    max-width: 400px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
    animation: slideUp 0.2s ease-out;
  }

  .modal-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 20px 20px 0;
  }

  .warning-icon {
    width: 40px;
    height: 40px;
    border-radius: var(--radius-md);
    background: var(--warning-bg, rgba(255, 199, 0, 0.12));
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .warning-icon svg {
    width: 22px;
    height: 22px;
    color: var(--warning, #ffc700);
  }

  .modal-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .modal-body {
    padding: 16px 20px 20px;
  }

  .modal-body p {
    margin: 0;
    font-size: 14px;
    color: var(--text-secondary);
    line-height: 1.5;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding: 0 20px 20px;
  }

  .btn {
    padding: 10px 18px;
    font-size: 13px;
    font-weight: 500;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .btn-secondary {
    background: transparent;
    border: 1px solid var(--border-color);
    color: var(--text-secondary);
  }

  .btn-secondary:hover {
    background: var(--hover-bg);
    color: var(--text-primary);
  }

  .btn-warning {
    background: var(--warning, #ffc700);
    border: 1px solid var(--warning, #ffc700);
    color: #1a1a1a;
  }

  .btn-warning:hover {
    filter: brightness(1.1);
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
</style>
