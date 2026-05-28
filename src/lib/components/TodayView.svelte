<script lang="ts">
  import { getTasksStore } from '$lib/stores/tasks.svelte';
  import { getPomodoroStore, startPomodoro } from '$lib/stores/pomodoro.svelte';
  import TaskCard from './TaskCard.svelte';
  import CompletionSparkline from './CompletionSparkline.svelte';
  import { getI18nStore } from '$lib/i18n';
  import { fade, slide } from 'svelte/transition';
  import { isToday, isOverdue, getCurrentUnit } from '$lib/utils/unitCalc';
  import { isActivePriority } from '$lib/types';

  const tasks = getTasksStore();
  const pomodoro = getPomodoroStore();
  const i18n = getI18nStore();
  const t = i18n.t;

  // Tasks due today or overdue
  const todayTasks = $derived(tasks.tasks.filter(task =>
    !task.completed &&
    task.dueDate &&
    (isToday(task.dueDate) || isOverdue(task.dueDate))
  ).sort((a, b) => a.priority.localeCompare(b.priority)));

  const completedTodayTasks = $derived(tasks.tasks.filter(task =>
    task.completed && task.completedAt && isToday(task.completedAt)
  ));

  // Hero: highest-priority active task (A first, else top B, else top C)
  const heroTask = $derived(
    todayTasks.find(t => t.priority === 'A') ||
    todayTasks.find(t => t.priority === 'B') ||
    todayTasks.find(t => t.priority === 'C') ||
    null
  );

  // Remaining tasks (excluding hero)
  const remainingTasks = $derived(todayTasks.filter(t => t.id !== heroTask?.id));

  // Stats
  const totalToday = $derived(todayTasks.length + completedTodayTasks.length);
  const progress = $derived(totalToday > 0 ? (completedTodayTasks.length / totalToday) * 100 : 0);
  const allDone = $derived(totalToday > 0 && todayTasks.length === 0);

  // Focus time today (seconds → human readable)
  const focusSecondsToday = $derived(
    pomodoro.todaySessions
      .filter(s => s.completed)
      .reduce((sum, s) => sum + (s.duration || 0), 0)
  );
  const focusHours = $derived(Math.floor(focusSecondsToday / 3600));
  const focusMinutes = $derived(Math.floor((focusSecondsToday % 3600) / 60));

  // Date string
  const locale = $derived(i18n.locale === 'zh-CN' ? 'zh-CN' : 'en-US');
  const todayDate = $derived(
    new Date().toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric' })
  );

  function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return t('todayView.greeting.morning');
    if (hour < 18) return t('todayView.greeting.afternoon');
    return t('todayView.greeting.evening');
  }

  function handleStartHero() {
    if (heroTask) startPomodoro(heroTask);
  }

  // Progress ring math (SVG)
  const RING_RADIUS = 38;
  const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
  const ringOffset = $derived(RING_CIRCUMFERENCE - (progress / 100) * RING_CIRCUMFERENCE);

  // Bi-daily unit rhythm — FocusFlow's distinctive time structure
  const currentUnit = $derived.by(() => {
    // re-derive when the date string changes (cheap dependency)
    void todayDate;
    return getCurrentUnit();
  });
  const isReviewDay = $derived(currentUnit.isReviewDay);
  /** Position within the unit: 1 for first day, 2 for second day. 0 if review. */
  const dayInUnit = $derived.by(() => {
    if (isReviewDay) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(currentUnit.startDate);
    start.setHours(0, 0, 0, 0);
    const diff = Math.floor((today.getTime() - start.getTime()) / 86400000);
    return diff + 1; // 1 or 2
  });
</script>

<div class="today-view-container" class:review-day={isReviewDay}>
  <div class="today-scroll">
    <div class="today-content" in:fade={{ duration: 220 }}>
      <!-- Header strip -->
      <header class="day-header">
        <div class="header-left">
          <div class="date-line">
            <span class="date-text font-num">{todayDate}</span>
          </div>
          <h1 class="greeting">
            {getGreeting()}<span class="comma">,</span>
            <span class="greeting-tail">{t('todayView.readyToFocus')}</span>
          </h1>
        </div>
        <!-- Inbox toggle removed — F (灵感池) is now accessed via the
             persistent ReservoirPanel at the top of every view. -->
      </header>

      <!-- Unit Rhythm — bi-daily cycle made felt -->
      <div class="unit-rhythm" class:review={isReviewDay}>
        {#if isReviewDay}
          <span class="rhythm-label">{t('todayView.rhythm.reviewDay') || '周复盘日'}</span>
          <span class="rhythm-sep">·</span>
          <span class="rhythm-hint">{t('todayView.rhythm.reviewHint') || '回望本周，预备下一轮'}</span>
        {:else}
          <span class="rhythm-label font-num">
            {t('todayView.rhythm.unitN', { n: currentUnit.unitNumber }) || `单元 ${currentUnit.unitNumber}`}
          </span>
          <span class="rhythm-track" aria-hidden="true">
            <span class="rhythm-day" class:active={dayInUnit === 1}></span>
            <span class="rhythm-day" class:active={dayInUnit === 2}></span>
          </span>
          <span class="rhythm-hint font-num">
            {dayInUnit === 1
              ? (t('todayView.rhythm.day1') || '第 1 天 / 共 2 天')
              : (t('todayView.rhythm.day2') || '第 2 天 / 收尾')}
          </span>
        {/if}
        {#if tasks.cycleHistory.length > 0}
          <CompletionSparkline history={tasks.cycleHistory} />
        {/if}
      </div>

      <!-- Hero altar: A-task gets sanctified treatment (Highlander Rule made visible) -->
      <div class="hero-row">
        <section class="hero-altar anim-enter-decel" class:empty={!heroTask} class:has-a={heroTask?.priority === 'A'}>
          <div class="altar-frame altar-frame-top" aria-hidden="true"></div>

          <div class="altar-eyebrow">
            <span class="altar-eyebrow-text">
              {#if heroTask?.priority === 'A'}
                {t('todayView.hero.altarLabel') || '今日唯一多誓 · A'}
              {:else if heroTask}
                {t('todayView.hero.altarSecondary') || '今日要事'}
              {:else if allDone}
                {t('todayView.hero.altarRest') || '今日已结'}
              {:else}
                {t('todayView.hero.altarEmpty') || '为今日选一件核心'}
              {/if}
            </span>
          </div>

          {#if heroTask}
            <h2 class="altar-title">{heroTask.content}</h2>

            <div class="altar-meta">
              {#if heroTask.pomodoros.estimated > 0}
                <span class="meta-pomo font-num">
                  <span class="pomo-track">
                    {#each Array(heroTask.pomodoros.estimated) as _, i}
                      <span class="pomo-dot" class:filled={i < heroTask.pomodoros.completed}></span>
                    {/each}
                  </span>
                  <span class="pomo-counts">{heroTask.pomodoros.completed}/{heroTask.pomodoros.estimated} 🍅</span>
                </span>
              {/if}
              {#each heroTask.projects as project}
                <span class="meta-chip project">+{project}</span>
              {/each}
              {#each heroTask.contexts as ctx}
                <span class="meta-chip context">@{ctx}</span>
              {/each}
            </div>

            {#if isActivePriority(heroTask.priority)}
              <button class="hero-cta" onclick={handleStartHero} disabled={pomodoro.activeTaskId === heroTask.id}>
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="6 4 20 12 6 20 6 4"></polygon></svg>
                {pomodoro.activeTaskId === heroTask.id ? t('task.focusInProgress') : t('task.startFocus')}
              </button>
            {/if}
          {:else if allDone}
            <h2 class="altar-title rest">🌙 {t('todayView.celebrate.title')}</h2>
            <p class="altar-hint">{t('todayView.celebrate.subtitle')}</p>
          {:else}
            <h2 class="altar-title muted">{t('todayView.hero.pickCore')}</h2>
            <p class="altar-hint">{t('todayView.hero.pickCoreHint')}</p>
          {/if}

          <div class="altar-frame altar-frame-bottom" aria-hidden="true"></div>
        </section>

        <!-- Stats rail -->
        <aside class="stats-rail">
          <div class="ring-wrap">
            <svg class="progress-ring" viewBox="0 0 100 100" aria-hidden="true">
              <circle cx="50" cy="50" r={RING_RADIUS} class="ring-track" />
              <circle
                cx="50" cy="50" r={RING_RADIUS}
                class="ring-fill"
                stroke-dasharray={RING_CIRCUMFERENCE}
                stroke-dashoffset={ringOffset}
                transform="rotate(-90 50 50)"
              />
            </svg>
            <div class="ring-center">
              <div class="ring-value font-num">{Math.round(progress)}<span class="pct">%</span></div>
            </div>
          </div>

          <div class="stat-rows">
            <div class="stat-row">
              <span class="stat-label">{t('todayView.stats.completed')}</span>
              <span class="stat-value font-num">{completedTodayTasks.length}<span class="stat-sub">/{totalToday}</span></span>
            </div>
            <div class="stat-row">
              <span class="stat-label">{t('todayView.stats.focusTime')}</span>
              <span class="stat-value font-num">
                {#if focusHours > 0}{focusHours}{t('todayView.stats.hours')} {/if}{focusMinutes}{t('todayView.stats.minutes')}
              </span>
            </div>
            <div class="stat-row">
              <span class="stat-label">🍅</span>
              <span class="stat-value font-num">{pomodoro.todayCount}</span>
            </div>
          </div>
        </aside>
      </div>

      <!-- Remaining tasks -->
      {#if remainingTasks.length > 0}
        <section class="task-section">
          <h3 class="section-title">
            {t('todayView.sections.standard')}
            <span class="section-count font-num">{remainingTasks.length}</span>
          </h3>
          <div class="task-list">
            {#each remainingTasks as task (task.id)}
              <div transition:slide={{ duration: 180 }}>
                <TaskCard {task} showPriority compact />
              </div>
            {/each}
          </div>
        </section>
      {/if}

      <!-- Completed today -->
      {#if completedTodayTasks.length > 0}
        <section class="task-section completed-section">
          <h3 class="section-title">
            {t('todayView.sections.completed')}
            <span class="section-count font-num">{completedTodayTasks.length}</span>
          </h3>
          <div class="task-list">
            {#each completedTodayTasks as task (task.id)}
              <div transition:slide={{ duration: 180 }}>
                <TaskCard {task} compact showPriority />
              </div>
            {/each}
          </div>
        </section>
      {/if}

      <!-- Inspiration / Inbox sections removed — F is shown in ReservoirPanel
           above every view to keep one canonical location for it. -->
    </div>
  </div>
</div>

<style>
  .today-view-container {
    display: flex;
    height: 100%;
    position: relative;
    overflow: hidden;
  }

  .today-scroll {
    flex: 1;
    overflow-y: auto;
    transition: margin-right 0.3s var(--ease-out-expo);
  }

  .today-content {
    max-width: 920px;
    margin: 0 auto;
    padding: var(--space-2xl) var(--space-2xl) 48px;
    display: flex;
    flex-direction: column;
    gap: var(--space-2xl);
  }

  /* ===== Header ===== */
  .day-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--space-xl);
  }

  .date-line {
    display: flex;
    align-items: center;
    margin-bottom: var(--space-sm);
  }

  .date-text {
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
    font-weight: 600;
  }

  .greeting {
    font-size: var(--text-2xl);
    font-weight: 600;
    letter-spacing: -0.02em;
    color: var(--text-primary);
    line-height: 1.15;
  }

  .greeting .comma {
    color: var(--text-muted);
  }

  .greeting-tail {
    color: var(--text-secondary);
    font-weight: 500;
  }

  .inbox-toggle {
    width: 40px;
    height: 40px;
    border-radius: var(--radius-md);
    background: var(--card-bg);
    border: 1px solid var(--border-hairline);
    color: var(--text-muted);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    position: relative;
    box-shadow: var(--elevation-1);
    transition: all var(--transition-fast);
    flex-shrink: 0;
  }

  .inbox-toggle:hover {
    color: var(--text-primary);
    background: var(--card-hover-bg);
    box-shadow: var(--elevation-2);
    transform: translateY(-1px);
  }

  .inbox-toggle.active {
    background: var(--primary-bg);
    color: var(--primary);
    border-color: var(--border-subtle);
  }

  .inbox-toggle svg {
    width: 18px;
    height: 18px;
  }

  .count-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    background: var(--primary);
    color: white;
    font-size: 10px;
    font-weight: 700;
    min-width: 18px;
    height: 18px;
    padding: 0 4px;
    border-radius: 9px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid var(--bg-primary);
    line-height: 1;
  }

  /* ===== Hero row ===== */
  .hero-row {
    display: grid;
    grid-template-columns: 1fr 240px;
    gap: var(--space-lg);
    align-items: stretch;
  }

  /* ===== Unit Rhythm strip — bi-daily cycle made felt ===== */
  .unit-rhythm {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 10px;
    margin-top: calc(-1 * var(--space-md));
    border-radius: var(--radius-md);
    font-size: var(--text-xs);
    color: var(--text-muted);
    width: fit-content;
    background: transparent;
  }

  .rhythm-label {
    color: var(--text-secondary);
    font-weight: 600;
    letter-spacing: 0.04em;
  }

  .rhythm-sep {
    color: var(--text-muted);
    opacity: 0.5;
  }

  .rhythm-hint {
    color: var(--text-muted);
    letter-spacing: 0.02em;
  }

  /* Day-progress: 2 tiny pills, active = primary tint */
  .rhythm-track {
    display: inline-flex;
    gap: 3px;
  }

  .rhythm-day {
    width: 14px;
    height: 4px;
    border-radius: var(--radius-full);
    background: var(--border-strong);
    transition: background 0.4s var(--ease-out-expo);
  }

  .rhythm-day.active {
    background: var(--primary);
  }

  /* Saturday review-day variant: warmer tint across the whole today view */
  .today-view-container.review-day {
    background: linear-gradient(
      180deg,
      rgba(252, 196, 25, 0.04) 0%,
      transparent 240px
    );
  }

  .unit-rhythm.review {
    color: var(--warning, #fcc419);
  }

  .unit-rhythm.review .rhythm-label {
    color: var(--warning, #fcc419);
  }

  /* ===== Hero altar — A-task gets stage treatment, not a card =====
     Reads as a vertically-framed sacred space. No box-shadow, no rounded card.
     Background is the page; framing comes from generous whitespace + thin rules. */
  .hero-altar {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-md);
    padding: var(--space-2xl) var(--space-lg) var(--space-xl);
    min-height: 220px;
    /* Subtle breath at horizontal extents to suggest "presence" of A task */
    background: radial-gradient(
      ellipse 50% 90% at 0% 50%,
      var(--primary-bg) 0%,
      transparent 60%
    );
    transition: background 0.6s var(--ease-out-expo);
  }

  /* When the hero IS the A task, intensify the breath */
  .hero-altar.has-a {
    background: radial-gradient(
      ellipse 70% 100% at 0% 50%,
      var(--primary-bg) 0%,
      transparent 65%
    );
  }

  .hero-altar.empty {
    background: none;
    min-height: 160px;
  }

  /* Hairline rules framing the altar (top + bottom). Like a temple lintel. */
  .altar-frame {
    position: absolute;
    left: 0;
    right: 30%;
    height: 1px;
    background: linear-gradient(90deg, var(--border-strong), transparent);
    opacity: 0.6;
  }

  .altar-frame-top { top: 0; }
  .altar-frame-bottom { bottom: 0; }

  .hero-altar.empty .altar-frame {
    background: linear-gradient(90deg, var(--border-hairline), transparent);
  }

  .altar-eyebrow {
    margin-bottom: 4px;
  }

  .altar-eyebrow-text {
    font-size: var(--text-xs);
    font-weight: 500;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  .hero-altar.has-a .altar-eyebrow-text {
    color: var(--primary);
    letter-spacing: 0.22em;
  }

  .altar-title {
    font-size: clamp(22px, 2.4vw, 30px);
    font-weight: 500;
    line-height: 1.25;
    letter-spacing: -0.022em;
    color: var(--text-primary);
    max-width: 32ch;
  }

  .altar-title.muted {
    color: var(--text-secondary);
    font-weight: 400;
  }

  .altar-title.rest {
    color: var(--text-primary);
    font-weight: 500;
  }

  .altar-hint {
    color: var(--text-muted);
    font-size: var(--text-base);
    max-width: 42ch;
    line-height: 1.5;
  }

  .altar-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    margin-top: 4px;
  }

  .meta-pomo {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: var(--text-sm);
    color: var(--text-secondary);
  }

  .meta-pomo {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: var(--text-sm);
    color: var(--text-secondary);
  }

  .pomo-track {
    display: inline-flex;
    gap: 3px;
  }

  .pomo-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--border-strong);
  }

  .pomo-dot.filled {
    background: #ff6b6b;
  }

  .pomo-counts {
    color: var(--text-muted);
    font-size: var(--text-xs);
  }

  .meta-chip {
    font-size: var(--text-xs);
    font-weight: 500;
    padding: 2px 8px;
    border-radius: var(--radius-sm);
    background: var(--tag-bg);
    color: var(--text-secondary);
  }

  .meta-chip.project {
    background: rgba(177, 151, 252, 0.12);
    color: #b197fc;
  }

  .meta-chip.context {
    background: rgba(116, 192, 252, 0.12);
    color: #74c0fc;
  }

  .hero-cta {
    align-self: flex-start;
    margin-top: 4px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: var(--primary);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    font-size: var(--text-base);
    font-weight: 600;
    cursor: pointer;
    box-shadow: var(--elevation-1);
    transition: all var(--transition-fast);
    position: relative;
    z-index: 1;
  }

  .hero-cta:hover:not(:disabled) {
    background: var(--primary-hover);
    box-shadow: var(--elevation-2);
    transform: translateY(-1px);
  }

  .hero-cta:disabled {
    background: var(--primary-bg);
    color: var(--primary);
    cursor: default;
    box-shadow: none;
  }

  .hero-cta svg {
    width: 12px;
    height: 12px;
  }

  /* ===== Stats rail ===== */
  .stats-rail {
    background: var(--card-bg);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xl);
    padding: var(--space-xl) var(--space-lg);
    box-shadow: var(--elevation-1);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-md);
  }

  .ring-wrap {
    position: relative;
    width: 110px;
    height: 110px;
  }

  .progress-ring {
    width: 100%;
    height: 100%;
    transform: rotate(0deg);
  }

  .ring-track {
    fill: none;
    stroke: var(--border-subtle);
    stroke-width: 7;
  }

  .ring-fill {
    fill: none;
    stroke: var(--primary);
    stroke-width: 7;
    stroke-linecap: round;
    transition: stroke-dashoffset 0.6s var(--ease-out-expo);
  }

  .ring-center {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .ring-value {
    font-size: 26px;
    font-weight: 600;
    color: var(--text-primary);
    letter-spacing: -0.04em;
    line-height: 1;
  }

  .pct {
    font-size: var(--text-sm);
    color: var(--text-muted);
    margin-left: 1px;
    font-weight: 500;
  }

  .stat-rows {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-top: var(--space-sm);
    border-top: 1px solid var(--border-hairline);
  }

  .stat-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-size: var(--text-sm);
  }

  .stat-label {
    color: var(--text-muted);
  }

  .stat-value {
    color: var(--text-primary);
    font-weight: 600;
  }

  .stat-sub {
    color: var(--text-muted);
    font-weight: 500;
    font-size: var(--text-xs);
    margin-left: 1px;
  }

  /* ===== Task sections ===== */
  .task-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .section-title {
    display: flex;
    align-items: baseline;
    gap: 8px;
    font-size: var(--text-base);
    font-weight: 600;
    color: var(--text-secondary);
    letter-spacing: -0.01em;
  }

  .section-count {
    color: var(--text-muted);
    font-size: var(--text-xs);
    font-weight: 500;
  }

  .task-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .completed-section {
    opacity: 0.68;
  }

  /* ===== Idea Pool ("relief valve" — friendly, no pressure) =====
     Per philosophy: F priority is NOT "lowest" — it's the place where ideas
     are welcome without commitment. Warm typography, sentence case, no shouting. */
  .inspiration {
    margin-top: var(--space-md);
    padding: var(--space-lg) var(--space-md);
    border-top: 1px solid var(--border-hairline);
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
    background: linear-gradient(
      to bottom,
      rgba(252, 196, 25, 0.03),
      transparent 80%
    );
    border-radius: var(--radius-md);
  }

  .inspiration-head {
    display: flex;
    align-items: baseline;
    gap: 10px;
  }

  .inspiration-icon {
    font-size: 16px;
    line-height: 1;
  }

  .inspiration-title {
    font-size: var(--text-base);
    font-weight: 500;
    color: var(--text-secondary);
    /* Sentence case + no uppercase — feels conversational, not corporate */
    text-transform: none;
    letter-spacing: 0.01em;
  }

  .inspiration-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .inspiration-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: var(--card-bg);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-full);
    font-size: var(--text-sm);
    color: var(--text-secondary);
    cursor: default;
    transition: all var(--transition-fast);
    max-width: 240px;
  }

  .inspiration-chip:hover {
    color: var(--text-primary);
    background: var(--card-hover-bg);
    border-color: var(--border-subtle);
    transform: translateY(-1px);
    box-shadow: var(--elevation-1);
  }

  .chip-arrow {
    color: var(--text-muted);
    font-size: var(--text-xs);
  }

  .chip-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* ===== Inbox drawer ===== */
  .inbox-drawer {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 340px;
    background: var(--bg-secondary);
    border-left: 1px solid var(--border-hairline);
    transform: translateX(100%);
    transition: transform 0.3s var(--ease-out-expo);
    z-index: 10;
  }

  .inbox-drawer.open {
    transform: translateX(0);
    box-shadow: var(--elevation-3);
  }

  /* ===== Responsive ===== */
  @media (max-width: 820px) {
    .today-content {
      padding: var(--space-lg) var(--space-lg) var(--space-2xl);
    }

    .hero-row {
      grid-template-columns: 1fr;
    }

    .stats-rail {
      flex-direction: row;
      justify-content: space-between;
      padding: var(--space-md) var(--space-lg);
    }

    .ring-wrap {
      width: 80px;
      height: 80px;
    }

    .ring-value {
      font-size: var(--text-lg);
    }

    .stat-rows {
      border-top: none;
      padding-top: 0;
      flex: 1;
      margin-left: var(--space-lg);
    }

    .inbox-drawer {
      width: 100%;
    }
  }
</style>
