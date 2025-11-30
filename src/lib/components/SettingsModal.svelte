<script lang="ts">
  import { getSettingsStore, updateSettings, toggleTheme } from '$lib/stores/settings.svelte';
  import { t, availableLanguages, setLanguage, currentLanguage } from '$lib/i18n';
  import type { Language } from '$lib/types';

  interface Props {
    isOpen: boolean;
    onClose: () => void;
  }

  let { isOpen, onClose }: Props = $props();

  const settings = getSettingsStore();

  let pomodoroWork = $state(settings.pomodoroWork);
  let pomodoroShortBreak = $state(settings.pomodoroShortBreak);
  let pomodoroLongBreak = $state(settings.pomodoroLongBreak);
  let autoArchiveDays = $state(settings.autoArchiveDays);
  let eZoneAgingDays = $state(settings.eZoneAgingDays);

  // Sync state with settings when modal opens
  $effect(() => {
    if (isOpen) {
      pomodoroWork = settings.pomodoroWork;
      pomodoroShortBreak = settings.pomodoroShortBreak;
      pomodoroLongBreak = settings.pomodoroLongBreak;
      autoArchiveDays = settings.autoArchiveDays;
      eZoneAgingDays = settings.eZoneAgingDays;
    }
  });

  function handleLanguageChange(lang: Language) {
    setLanguage(lang);
    updateSettings({ language: lang });
  }

  function handleSave() {
    updateSettings({
      pomodoroWork,
      pomodoroShortBreak,
      pomodoroLongBreak,
      autoArchiveDays,
      eZoneAgingDays,
    });
    onClose();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onClose();
    }
  }
</script>

{#if isOpen}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="modal-overlay"
    onclick={onClose}
    onkeydown={handleKeydown}
    role="dialog"
    aria-modal="true"
    aria-labelledby="settings-title"
  >
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal-content" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2 id="settings-title" class="modal-title">
          <svg class="title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
          {t('settings.title')}
        </h2>
        <button class="close-btn" onclick={onClose} aria-label={t('action.close')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div class="modal-body">
        <!-- Theme & Language -->
        <section class="settings-section">
          <h3 class="section-title">{t('settings.appearance')}</h3>

          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">{t('settings.theme')}</span>
              <span class="setting-desc">{t('settings.themeDesc')}</span>
            </div>
            <div class="theme-buttons">
              <button
                class="theme-btn"
                class:active={settings.theme === 'light'}
                onclick={() => updateSettings({ theme: 'light' })}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="5"></circle>
                  <line x1="12" y1="1" x2="12" y2="3"></line>
                  <line x1="12" y1="21" x2="12" y2="23"></line>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                  <line x1="1" y1="12" x2="3" y2="12"></line>
                  <line x1="21" y1="12" x2="23" y2="12"></line>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                </svg>
                {t('settings.themeLight')}
              </button>
              <button
                class="theme-btn"
                class:active={settings.theme === 'dark'}
                onclick={() => updateSettings({ theme: 'dark' })}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                </svg>
                {t('settings.themeDark')}
              </button>
              <button
                class="theme-btn"
                class:active={settings.theme === 'system'}
                onclick={() => updateSettings({ theme: 'system' })}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                  <line x1="8" y1="21" x2="16" y2="21"></line>
                  <line x1="12" y1="17" x2="12" y2="21"></line>
                </svg>
                {t('settings.themeSystem')}
              </button>
            </div>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">{t('settings.language')}</span>
              <span class="setting-desc">{t('settings.languageDesc')}</span>
            </div>
            <div class="language-buttons">
              {#each availableLanguages as lang}
                <button
                  class="lang-btn"
                  class:active={currentLanguage() === lang.code}
                  onclick={() => handleLanguageChange(lang.code)}
                >
                  {lang.name}
                </button>
              {/each}
            </div>
          </div>
        </section>

        <!-- Pomodoro Settings -->
        <section class="settings-section">
          <h3 class="section-title">{t('settings.pomodoro.title')}</h3>

          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">{t('settings.pomodoro.workDuration')}</span>
            </div>
            <div class="input-group">
              <input
                type="number"
                class="setting-input"
                bind:value={pomodoroWork}
                min="1"
                max="120"
              />
              <span class="input-suffix">{t('settings.minutes')}</span>
            </div>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">{t('settings.pomodoro.shortBreak')}</span>
            </div>
            <div class="input-group">
              <input
                type="number"
                class="setting-input"
                bind:value={pomodoroShortBreak}
                min="1"
                max="60"
              />
              <span class="input-suffix">{t('settings.minutes')}</span>
            </div>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">{t('settings.pomodoro.longBreak')}</span>
            </div>
            <div class="input-group">
              <input
                type="number"
                class="setting-input"
                bind:value={pomodoroLongBreak}
                min="1"
                max="120"
              />
              <span class="input-suffix">{t('settings.minutes')}</span>
            </div>
          </div>
        </section>

        <!-- Data Settings -->
        <section class="settings-section">
          <h3 class="section-title">{t('settings.data.title')}</h3>

          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">{t('settings.autoArchive')}</span>
              <span class="setting-desc">{t('settings.autoArchiveDesc')}</span>
            </div>
            <div class="input-group">
              <input
                type="number"
                class="setting-input"
                bind:value={autoArchiveDays}
                min="1"
                max="365"
              />
              <span class="input-suffix">{t('settings.days')}</span>
            </div>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">{t('settings.eZoneAging')}</span>
              <span class="setting-desc">{t('settings.eZoneAgingDesc')}</span>
            </div>
            <div class="input-group">
              <input
                type="number"
                class="setting-input"
                bind:value={eZoneAgingDays}
                min="1"
                max="30"
              />
              <span class="input-suffix">{t('settings.days')}</span>
            </div>
          </div>
        </section>
      </div>

      <div class="modal-footer">
        <button class="btn secondary" onclick={onClose}>
          {t('action.cancel')}
        </button>
        <button class="btn primary" onclick={handleSave}>
          {t('action.save')}
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
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    animation: fadeIn 0.2s ease;
  }

  .modal-content {
    width: 100%;
    max-width: 520px;
    max-height: 85vh;
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-xl);
    display: flex;
    flex-direction: column;
    animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    box-shadow: var(--shadow-lg);
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px;
    border-bottom: 1px solid var(--border-subtle);
  }

  .modal-title {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .title-icon {
    width: 22px;
    height: 22px;
    color: var(--primary);
  }

  .close-btn {
    width: 32px;
    height: 32px;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--transition-fast);
  }

  .close-btn:hover {
    background: var(--hover-bg);
    color: var(--text-primary);
  }

  .close-btn svg {
    width: 18px;
    height: 18px;
  }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px 24px;
  }

  .settings-section {
    margin-bottom: 24px;
  }

  .settings-section:last-child {
    margin-bottom: 0;
  }

  .section-title {
    margin: 0 0 16px;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 12px 0;
    border-bottom: 1px solid var(--border-subtle);
  }

  .setting-row:last-child {
    border-bottom: none;
  }

  .setting-info {
    flex: 1;
  }

  .setting-label {
    display: block;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
  }

  .setting-desc {
    display: block;
    margin-top: 2px;
    font-size: 12px;
    color: var(--text-muted);
  }

  .theme-buttons,
  .language-buttons {
    display: flex;
    gap: 6px;
  }

  .theme-btn,
  .lang-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-secondary);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .theme-btn svg {
    width: 14px;
    height: 14px;
  }

  .theme-btn:hover,
  .lang-btn:hover {
    background: var(--hover-bg);
    border-color: var(--text-muted);
  }

  .theme-btn.active,
  .lang-btn.active {
    background: var(--primary-bg);
    border-color: var(--primary);
    color: var(--primary);
  }

  .input-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .setting-input {
    width: 80px;
    padding: 8px 12px;
    font-size: 14px;
    background: var(--input-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    outline: none;
    text-align: center;
  }

  .setting-input:focus {
    border-color: var(--primary);
  }

  .input-suffix {
    font-size: 12px;
    color: var(--text-muted);
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding: 16px 24px;
    border-top: 1px solid var(--border-subtle);
  }

  .btn {
    padding: 10px 20px;
    border-radius: var(--radius-md);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .btn.secondary {
    background: transparent;
    border: 1px solid var(--border-color);
    color: var(--text-secondary);
  }

  .btn.secondary:hover {
    background: var(--hover-bg);
    color: var(--text-primary);
  }

  .btn.primary {
    background: var(--primary);
    border: none;
    color: white;
  }

  .btn.primary:hover {
    background: var(--primary-hover);
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px) scale(0.96);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @media (max-width: 600px) {
    .modal-content {
      max-width: 100%;
      margin: 16px;
      max-height: 90vh;
    }

    .setting-row {
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
    }

    .theme-buttons,
    .language-buttons {
      width: 100%;
    }

    .theme-btn,
    .lang-btn {
      flex: 1;
      justify-content: center;
    }
  }
</style>
