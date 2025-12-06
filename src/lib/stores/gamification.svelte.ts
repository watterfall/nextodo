import type { Task, Priority } from '$lib/types';
import { getTasksStore } from './tasks.svelte';
import { getPomodoroStore } from './pomodoro.svelte';
import { showToast } from './ui.svelte';

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  condition: (stats: GamificationStats) => boolean;
  unlocked: boolean;
  unlockedAt?: string;
  xpReward: number;
}

export interface GamificationStats {
  totalTasksCompleted: number;
  totalPomodoros: number;
  currentStreak: number;
  longestStreak: number;
  totalACompleted: number;
  earlyBirdCount: number; // Tasks completed before 9am
  nightOwlCount: number; // Tasks completed after 10pm
  perfectDays: number; // Days with > 80% completion but < 100% (Sustainable)
}

export interface Level {
  level: number;
  title: string;
  xpRequired: number;
}

// Badge Definitions
const BADGE_DEFINITIONS: Omit<Badge, 'unlocked' | 'unlockedAt'>[] = [
  {
    id: 'first_step',
    name: 'First Step',
    description: 'Complete your first task',
    icon: '🌱',
    condition: (s) => s.totalTasksCompleted >= 1,
    xpReward: 50
  },
  {
    id: 'pomodoro_novice',
    name: 'Focus Novice',
    description: 'Complete 5 pomodoros',
    icon: '🍅',
    condition: (s) => s.totalPomodoros >= 5,
    xpReward: 100
  },
  {
    id: 'pomodoro_master',
    name: 'Focus Master',
    description: 'Complete 100 pomodoros',
    icon: '🧘',
    condition: (s) => s.totalPomodoros >= 100,
    xpReward: 1000
  },
  {
    id: 'challenge_crusher',
    name: 'Challenge Crusher',
    description: 'Complete 5 A-priority tasks',
    icon: '🏆',
    condition: (s) => s.totalACompleted >= 5,
    xpReward: 500
  },
  {
    id: 'consistency_is_key',
    name: 'Consistency',
    description: 'Maintain a 3-day streak',
    icon: '🔥',
    condition: (s) => s.currentStreak >= 3,
    xpReward: 300
  },
  {
    id: 'sustainable_worker',
    name: 'Sustainable Worker',
    description: 'Achieve 3 "Perfect Days" (Healthy completion rate)',
    icon: '🌿',
    condition: (s) => s.perfectDays >= 3,
    xpReward: 400
  }
];

// Level Definitions
const LEVELS: Level[] = [
  { level: 1, title: 'Novice Planner', xpRequired: 0 },
  { level: 2, title: 'Task Apprentice', xpRequired: 500 },
  { level: 3, title: 'Focus Adept', xpRequired: 1500 },
  { level: 4, title: 'Productivity Pro', xpRequired: 3000 },
  { level: 5, title: 'Zen Master', xpRequired: 6000 },
];

class GamificationStore {
  badges = $state<Badge[]>([]);
  stats = $state<GamificationStats>({
    totalTasksCompleted: 0,
    totalPomodoros: 0,
    currentStreak: 0,
    longestStreak: 0,
    totalACompleted: 0,
    earlyBirdCount: 0,
    nightOwlCount: 0,
    perfectDays: 0
  });
  xp = $state(0);
  
  constructor() {
    this.initBadges();
  }

  initBadges() {
    // Initialize badges with locked state
    this.badges = BADGE_DEFINITIONS.map(def => ({
      ...def,
      unlocked: false,
      xpReward: def.xpReward
    }));
  }

  // Derived state for current level
  currentLevel = $derived.by(() => {
    let level = LEVELS[0];
    for (const l of LEVELS) {
      if (this.xp >= l.xpRequired) {
        level = l;
      } else {
        break;
      }
    }
    return level;
  });

  nextLevel = $derived.by(() => {
    const current = this.currentLevel;
    const next = LEVELS.find(l => l.level === current.level + 1);
    return next || null;
  });

  progressToNextLevel = $derived.by(() => {
    if (!this.nextLevel) return 100;
    const currentLevelBaseXP = this.currentLevel.xpRequired;
    const nextLevelXP = this.nextLevel.xpRequired;
    const xpInLevel = this.xp - currentLevelBaseXP;
    const levelSpan = nextLevelXP - currentLevelBaseXP;
    return Math.min(100, Math.max(0, (xpInLevel / levelSpan) * 100));
  });

  // Actions
  checkBadges() {
    let newUnlocks = false;
    
    this.badges = this.badges.map(badge => {
      if (!badge.unlocked && badge.condition(this.stats)) {
        newUnlocks = true;
        this.xp += badge.xpReward;
        showToast(`🏆 Badge Unlocked: ${badge.name}`, 'success');
        return {
          ...badge,
          unlocked: true,
          unlockedAt: new Date().toISOString()
        };
      }
      return badge;
    });

    if (newUnlocks) {
      this.save();
    }
  }

  // Update stats based on action
  recordTaskCompletion(task: Task) {
    this.stats.totalTasksCompleted++;
    if (task.priority === 'A') {
      this.stats.totalACompleted++;
    }
    
    // Check time for early/late
    const hour = new Date().getHours();
    if (hour < 9) this.stats.earlyBirdCount++;
    if (hour >= 22) this.stats.nightOwlCount++;

    this.xp += 10; // Base XP for task
    this.checkBadges();
    this.save();
  }

  recordPomodoro() {
    this.stats.totalPomodoros++;
    this.xp += 5; // Base XP for pomodoro
    this.checkBadges();
    this.save();
  }

  // Persistence (mocked for now, should integrate with storage.ts)
  load(data: any) {
    if (data) {
      this.stats = data.stats || this.stats;
      this.xp = data.xp || 0;
      if (data.badges) {
        // Merge saved unlock status
        const savedBadges = data.badges as Badge[];
        this.badges = this.badges.map(b => {
          const saved = savedBadges.find(sb => sb.id === b.id);
          return saved ? { ...b, unlocked: saved.unlocked, unlockedAt: saved.unlockedAt } : b;
        });
      }
    }
  }

  save() {
    // In a real app, this would write to storage
    // For now we rely on the main store saving mechanism if we hook it up
    // or just keep it in memory for the session if not fully integrated
  }
}

// Singleton
let store: GamificationStore;

export function getGamificationStore() {
  if (!store) {
    store = new GamificationStore();
  }
  return store;
}

