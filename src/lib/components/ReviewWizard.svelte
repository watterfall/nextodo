<script lang="ts">
  import { getI18nStore } from '$lib/i18n';
  import { getTasksStore } from '$lib/stores/tasks.svelte';
  import { getPomodoroStore } from '$lib/stores/pomodoro.svelte';
  import { getUIStore, setViewMode, toggleSidebar, setSidebarCollapsed } from '$lib/stores/ui.svelte';
  import { isActivePriority } from '$lib/types';
  import { fade, slide, scale } from 'svelte/transition';
  import confetti from '$lib/components/Confetti.svelte';

  const tasks = getTasksStore();
  const pomodoroStore = getPomodoroStore();
  const ui = getUIStore();
  const i18n = getI18nStore();
  const t = i18n.t;

  let step = $state(0);
  let showConfetti = $state(false);

  // Basic Stats - G is completed, active is A-F
  const completedCount = $derived(tasks.tasks.filter(task => task.priority === 'G').length);
  const activeCount = $derived(tasks.tasks.filter(task => isActivePriority(task.priority)).length);
  const completedA = $derived(tasks.completedTasks.filter(task => task.content.includes('[A]')).length); // Tasks completed from A
  const activeA = $derived(tasks.tasks.filter(task => task.priority === 'A').length);

  // Challenge Level Calculation
  // Sweet spot: 70-90% completion rate of planned tasks (weighted by priority)
  const challengeScore = $derived.by(() => {
    // Weight: A=3, B=2, C=1
    const getWeight = (p: string) => (p === 'A' ? 3 : p === 'B' ? 2 : p === 'G' ? 2 : 1);

    // Consider completed tasks (G) + uncompleted active tasks
    const relevantTasks = tasks.tasks.filter(task =>
      task.priority === 'G' || (isActivePriority(task.priority) && task.priority !== 'F')
    );

    if (relevantTasks.length === 0) return 0;

    let totalPoints = 0;
    let completedPoints = 0;

    for (const task of relevantTasks) {
      const w = getWeight(task.priority);
      totalPoints += w;
      if (task.priority === 'G') completedPoints += w;
    }

    if (totalPoints === 0) return 0;
    return Math.round((completedPoints / totalPoints) * 100);
  });

  const challengeFeedback = $derived.by(() => {
    if (challengeScore >= 95) return { 
      label: '舒适区', 
      desc: '完美完成！但也许任务挑战性不足？',
      color: '#4ade80' // Green
    };
    if (challengeScore >= 70) return { 
      label: '心流区', 
      desc: '完美！这正是最佳的成长区间。',
      color: '#a855f7' // Purple
    };
    if (challengeScore >= 40) return { 
      label: '挑战区', 
      desc: '有些吃力，但你在突破自己。',
      color: '#facc15' // Yellow
    };
    return { 
      label: '恐慌区', 
      desc: '目标可能定得太高了，尝试拆解任务？',
      color: '#ef4444' // Red
    };
  });

  // Analytics: Estimation Calibration
  const estimatedTasks = $derived(tasks.tasks.filter(task => task.priority === 'G' && task.pomodoros.estimated > 0));
  const estimationAccuracy = $derived.by(() => {
    if (estimatedTasks.length === 0) return 0;
    let totalDiff = 0;
    for (const task of estimatedTasks) {
      // Calculate deviation percentage
      const diff = Math.abs(task.pomodoros.completed - task.pomodoros.estimated);
      totalDiff += diff;
    }
    const avgDev = totalDiff / estimatedTasks.length;
    return Math.max(0, Math.round(100 - (avgDev * 20)));
  });

  const underEstimatedCount = $derived(estimatedTasks.filter(task => task.pomodoros.completed > task.pomodoros.estimated).length);
  const overEstimatedCount = $derived(estimatedTasks.filter(task => task.pomodoros.completed < task.pomodoros.estimated).length);

  // Analytics: Interruptions
  const todaySessions = $derived(pomodoroStore.todaySessions);
  const totalInterruptions = $derived(todaySessions.reduce((acc, s) => acc + (s.interruptions || 0), 0));
  const commonInterruptions = $derived.by(() => {
    const reasons: Record<string, number> = {};
    for (const s of todaySessions) {
      if (s.interruptionReasons) {
        for (const r of s.interruptionReasons) {
          reasons[r] = (reasons[r] || 0) + 1;
        }
      }
    }
    return Object.entries(reasons).sort((a, b) => b[1] - a[1]).slice(0, 3);
  });

  function nextStep() {
    step++;
    if (step === 1) {
      showConfetti = true;
      setTimeout(() => showConfetti = false, 3000);
    }
  }

  function closeWizard() {
    step = 0;
    window.dispatchEvent(new CustomEvent('close-review'));

    // Redirect to Week View and ensure Sidebar is open to access Inbox if we add it there
    setViewMode('week');
    // Ideally open Inbox too, but we haven't implemented the toggle yet
  }

  const steps = [
    { title: '准备回顾', icon: '🧘' },
    { title: '成就与挑战', icon: '⛰️' },
    { title: '深度分析', icon: '📊' },
    { title: '新的开始', icon: '🚀' }
  ];
</script>

<div class="review-overlay" transition:fade={{ duration: 200 }}>
  {#if showConfetti}
    <div class="confetti-container">
      <!-- Confetti component logic would go here -->
    </div>
  {/if}

  <div class="review-card" transition:scale={{ duration: 300, start: 0.95 }}>
    <!-- Header -->
    <div class="review-header">
      <div class="step-indicators">
        {#each steps as s, i}
          <div 
            class="step-dot" 
            class:active={i === step} 
            class:completed={i < step}
            title={s.title}
          ></div>
        {/each}
      </div>
      <button class="close-btn" onclick={closeWizard}>×</button>
    </div>

    <!-- Content Steps -->
    <div class="review-content">
      {#if step === 0}
        <div class="step-view" in:slide={{ axis: 'x', duration: 300 }}>
          <div class="icon-large">🧘</div>
          <h2>{t('review.ready')}</h2>
          <p class="description">
            是时候停下来深呼吸了。<br>
            回顾过去，清理思绪，为未来腾出空间。
          </p>
          <div class="stats-preview">
            <div class="stat-item">
              <span class="stat-val">{completedCount}</span>
              <span class="stat-label">已完成</span>
            </div>
            <div class="stat-item">
              <span class="stat-val">{activeCount}</span>
              <span class="stat-label">待办中</span>
            </div>
          </div>
          <button class="btn-primary" onclick={nextStep}>开始回顾</button>
        </div>

      {:else if step === 1}
        <div class="step-view" in:slide={{ axis: 'x', duration: 300 }}>
          <div class="icon-large">⛰️</div>
          <h2>挑战等级</h2>
          
          <div class="challenge-gauge-container">
            <div class="gauge-label" style:color={challengeFeedback.color}>
              {challengeFeedback.label} ({challengeScore}%)
            </div>
            <div class="gauge-bar">
              <div class="gauge-fill" style:width="{challengeScore}%" style:background={challengeFeedback.color}></div>
              <!-- Marker for sweet spot -->
              <div class="gauge-marker" style:left="80%" title="最佳成长区 (80%)"></div>
            </div>
            <p class="gauge-desc">{challengeFeedback.desc}</p>
          </div>

          <div class="score-display mini">
            <div class="score-stat">
              <span class="val">{completedA}</span>
              <span class="lbl">核心攻克</span>
            </div>
          </div>
          
          <button class="btn-primary" onclick={nextStep}>继续</button>
        </div>

      {:else if step === 2}
        <!-- New Analytics Step -->
        <div class="step-view" in:slide={{ axis: 'x', duration: 300 }}>
          <div class="icon-large">📊</div>
          <h2>深度洞察</h2>
          
          <div class="analytics-grid">
            <!-- Estimation -->
            <div class="analytics-card">
              <span class="card-title">预估准确度</span>
              <div class="accuracy-bar">
                <div class="accuracy-fill" style:width="{estimationAccuracy}%"></div>
              </div>
              <p class="card-detail">
                {#if underEstimatedCount > overEstimatedCount}
                  ⚠️ 你倾向于低估任务难度
                {:else if overEstimatedCount > underEstimatedCount}
                  🤔 你预留了太多缓冲时间
                {:else}
                  🎯 你的预估相当精准
                {/if}
              </p>
            </div>

            <!-- Interruption -->
            <div class="analytics-card">
              <span class="card-title">干扰分析</span>
              <div class="interruption-stat">
                <span class="big-num">{totalInterruptions}</span>
                <span class="label">次中断</span>
              </div>
              {#if commonInterruptions.length > 0}
                <ul class="reason-list">
                  {#each commonInterruptions as [reason, count]}
                    <li>{reason} <span class="count-badge">{count}</span></li>
                  {/each}
                </ul>
              {/if}
            </div>
          </div>

          <button class="btn-primary" onclick={nextStep}>继续</button>
        </div>

      {:else if step === 3}
        <div class="step-view" in:slide={{ axis: 'x', duration: 300 }}>
          <div class="icon-large">🚀</div>
          <h2>规划未来</h2>
          <p class="description">
            回顾完成！<br>
            接下来，前往<strong>周视图</strong>规划下周的核心任务吧。
          </p>
          {#if activeA > 3}
            <div class="warning-box">
              ⚠️ 核心挑战区有 {activeA} 个任务。建议精简到 3 个以内以保持专注。
            </div>
          {/if}
          
          <button class="btn-primary" onclick={closeWizard}>前往周计划</button>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .review-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(10px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
  }

  .review-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-xl);
    width: 90%;
    max-width: 480px;
    height: 580px;
    display: flex;
    flex-direction: column;
    box-shadow: var(--shadow-lg), 0 0 40px rgba(0,0,0,0.2);
    overflow: hidden;
  }

  .review-header {
    padding: 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .step-indicators {
    display: flex;
    gap: 8px;
  }

  .step-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    transition: all 0.3s ease;
  }

  .step-dot.active {
    background: var(--primary);
    transform: scale(1.2);
  }

  .step-dot.completed {
    background: var(--success);
    border-color: var(--success);
  }

  .close-btn {
    font-size: 24px;
    color: var(--text-muted);
    line-height: 1;
  }

  .review-content {
    flex: 1;
    position: relative;
    overflow: hidden;
  }

  .step-view {
    position: absolute;
    inset: 0;
    padding: 20px 40px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .icon-large {
    font-size: 64px;
    margin-bottom: 24px;
    animation: float 3s ease-in-out infinite;
  }

  h2 {
    font-size: 24px;
    margin-bottom: 16px;
    color: var(--text-primary);
  }

  .description {
    color: var(--text-secondary);
    line-height: 1.6;
    margin-bottom: 32px;
  }

  .stats-preview {
    display: flex;
    gap: 32px;
    margin-bottom: 40px;
  }

  .stat-item {
    display: flex;
    flex-direction: column;
  }

  .stat-val {
    font-size: 32px;
    font-weight: 700;
    color: var(--text-primary);
  }

  .stat-label {
    font-size: 13px;
    color: var(--text-muted);
  }

  /* Gauge */
  .challenge-gauge-container {
    width: 100%;
    background: var(--bg-primary);
    padding: 20px;
    border-radius: var(--radius-lg);
    margin-bottom: 24px;
  }

  .gauge-label {
    font-size: 24px;
    font-weight: 800;
    margin-bottom: 12px;
  }

  .gauge-bar {
    height: 12px;
    background: var(--border-color);
    border-radius: 6px;
    position: relative;
    margin-bottom: 12px;
  }

  .gauge-fill {
    height: 100%;
    border-radius: 6px;
    transition: width 1s var(--ease-out-expo);
  }

  .gauge-marker {
    position: absolute;
    top: -4px;
    bottom: -4px;
    width: 2px;
    background: var(--text-primary);
    opacity: 0.5;
  }

  .gauge-desc {
    font-size: 13px;
    color: var(--text-secondary);
  }

  .score-display.mini {
    margin-bottom: 32px;
  }

  .score-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .score-stat .val {
    font-size: 24px;
    font-weight: 700;
    color: var(--priority-a-color);
  }

  .score-stat .lbl {
    font-size: 12px;
    color: var(--text-muted);
  }

  .analytics-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 16px;
    width: 100%;
    margin-bottom: 24px;
  }

  .analytics-card {
    background: var(--bg-primary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    padding: 16px;
    text-align: left;
  }

  .card-title {
    font-size: 12px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    display: block;
    margin-bottom: 8px;
  }

  .accuracy-bar {
    height: 6px;
    background: var(--border-color);
    border-radius: 3px;
    overflow: hidden;
    margin-bottom: 8px;
  }

  .accuracy-fill {
    height: 100%;
    background: var(--success);
  }

  .card-detail {
    font-size: 13px;
    color: var(--text-primary);
  }

  .interruption-stat {
    display: flex;
    align-items: baseline;
    gap: 6px;
    margin-bottom: 8px;
  }

  .big-num {
    font-size: 24px;
    font-weight: 700;
    color: var(--error);
  }

  .reason-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .reason-list li {
    font-size: 12px;
    color: var(--text-secondary);
    display: flex;
    justify-content: space-between;
    margin-bottom: 4px;
  }

  .count-badge {
    background: var(--hover-bg);
    padding: 1px 6px;
    border-radius: 10px;
    font-size: 11px;
  }

  .warning-box {
    background: rgba(255, 146, 43, 0.1);
    color: #ff922b;
    padding: 12px;
    border-radius: 8px;
    font-size: 13px;
    margin-bottom: 16px;
  }

  .btn-primary {
    background: var(--primary);
    color: white;
    padding: 12px 32px;
    border-radius: 99px;
    font-weight: 600;
    font-size: 15px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    transition: all 0.2s;
  }

  .btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(0,0,0,0.15);
    background: var(--primary-hover);
  }

  .btn-text {
    margin-top: 16px;
    color: var(--text-muted);
    font-size: 13px;
  }

  .btn-text:hover {
    color: var(--text-primary);
    text-decoration: underline;
  }

  @keyframes float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
  }
</style>
