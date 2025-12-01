import { getTasksStore } from './tasks.svelte';
import { getPomodoroStore } from './pomodoro.svelte';
import { saveAppData } from '$lib/utils/storage';
import type { Badge, BadgeId, AppData } from '$lib/types';
import { showToast } from './ui.svelte';

const BADGE_DEFINITIONS: Record<BadgeId, Omit<Badge, 'unlockedAt'>> = {
  planner_novice: {
    id: 'planner_novice',
    name: '计划新手',
    description: '完成第一次回顾',
    icon: '🌱'
  },
  flow_master: {
    id: 'flow_master',
    name: '心流大师',
    description: '连续完成 4 个番茄钟无中断',
    icon: '🌊'
  },
  early_bird: {
    id: 'early_bird',
    name: '早起鸟',
    description: '在早上 9 点前完成一个任务',
    icon: '🌅'
  },
  challenger: {
    id: 'challenger',
    name: '挑战者',
    description: '完成一个 A 类核心挑战任务',
    icon: '🏔️'
  },
  deep_diver: {
    id: 'deep_diver',
    name: '深潜者',
    description: '累计完成 10 小时深度工作',
    icon: '🤿'
  },
  consistency_3: {
    id: 'consistency_3',
    name: '持之以恒',
    description: '连续 3 天有产出',
    icon: '🔥'
  },
  consistency_7: {
    id: 'consistency_7',
    name: '习惯养成',
    description: '连续 7 天有产出',
    icon: '💎'
  }
};

export function checkBadges() {
  const tasks = getTasksStore();
  const pomodoro = getPomodoroStore();
  
  if (!tasks.appData.badges) {
    tasks.appData.badges = [];
  }

  const currentBadges = new Set(tasks.appData.badges.map(b => b.id));
  const newBadges: Badge[] = [];

  // Helper to unlock
  const unlock = (id: BadgeId) => {
    if (!currentBadges.has(id)) {
      const badge = { ...BADGE_DEFINITIONS[id], unlockedAt: new Date().toISOString() };
      newBadges.push(badge);
      tasks.appData.badges = [...tasks.appData.badges, badge];
      showToast(`解锁成就: ${badge.icon} ${badge.name}`, 'success');
    }
  };

  // Check Challenger (Complete A task)
  if (tasks.tasks.some(t => t.completed && t.priority === 'A')) {
    unlock('challenger');
  }

  // Check Early Bird
  const today = new Date();
  if (tasks.tasks.some(t => {
    if (!t.completed || !t.completedAt) return false;
    const date = new Date(t.completedAt);
    return date.getDate() === today.getDate() && date.getHours() < 9;
  })) {
    unlock('early_bird');
  }

  // Check Flow Master (4 sessions today, 0 interruptions in current session sequence - simplified logic)
  // Real logic would check consecutive sessions without interruption.
  // For now: if today's interruption count is 0 and session count >= 4
  if (pomodoro.todayCount >= 4 && pomodoro.todaySessions.every(s => !s.interruptions)) {
    unlock('flow_master');
  }

  // Persist if new badges
  if (newBadges.length > 0) {
    saveAppData(tasks.appData);
  }
}

// Call this when review is completed
export function checkReviewBadges() {
  const tasks = getTasksStore();
  if (!tasks.appData.badges) tasks.appData.badges = [];
  
  const currentBadges = new Set(tasks.appData.badges.map(b => b.id));
  
  if (!currentBadges.has('planner_novice')) {
    const badge = { ...BADGE_DEFINITIONS['planner_novice'], unlockedAt: new Date().toISOString() };
    tasks.appData.badges = [...tasks.appData.badges, badge];
    showToast(`解锁成就: ${badge.icon} ${badge.name}`, 'success');
    saveAppData(tasks.appData);
  }
}

