import type { Task } from '$lib/types';
import type { GamificationData, GamificationStats, BadgeData } from '$lib/types';
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
  }
];

// Two badges used to sit here and were removed, not retired:
//
//   consistency_is_key ("maintain a 3-day streak")  — read `currentStreak`
//   sustainable_worker ("achieve 3 perfect days")   — read `perfectDays`
//
// Neither field was ever incremented by any code path, so both badges were
// unreachable from the day they shipped. The streak one would have been cut
// anyway: streak counters contradict what habit-formation data actually shows
// (a missed day is invisible to the automaticity curve; a broken streak is
// not). Their unlock records, if a file somehow has any, are dropped on load.
const REMOVED_BADGE_IDS = new Set(['consistency_is_key', 'sustainable_worker']);

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
    totalACompleted: 0
  });
  xp = $state(0);

  /**
   * Mirrors `settings.gamificationEnabled`. Off by default.
   *
   * When off, nothing is counted at all — not counted-but-hidden. Hiding a
   * running score still leaves it running, and it would come back with a jump
   * the moment anyone flipped the switch, which is its own kind of nudge.
   * Whatever was earned before stays on disk untouched.
   */
  enabled = $state(false);

  private persistCallback: (() => Promise<void>) | null = null;

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

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  // Actions
  checkBadges() {
    if (!this.enabled) return;
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
    if (!this.enabled) return;

    // Completion rewrites `priority` to 'G', so by the time some callers get
    // here the tier is only readable from `originalPriority`.
    const tier = task.originalPriority ?? task.priority;

    this.stats = {
      ...this.stats,
      totalTasksCompleted: this.stats.totalTasksCompleted + 1,
      totalACompleted: tier === 'A' ? this.stats.totalACompleted + 1 : this.stats.totalACompleted
    };

    this.xp += 10; // Base XP for task
    this.checkBadges();
    this.save();
  }

  recordPomodoro() {
    if (!this.enabled) return;
    this.stats = {
      ...this.stats,
      totalPomodoros: this.stats.totalPomodoros + 1
    };
    this.xp += 5; // Base XP for pomodoro
    this.checkBadges();
    this.save();
  }

  // Load from persisted data
  load(data: GamificationData | undefined) {
    if (!data) return;

    // Copy field by field rather than assigning the object wholesale: a file
    // written before the stat trimming still carries currentStreak and
    // friends, and taking it as-is would write those keys straight back out
    // again on the next save, forever.
    const saved = data.stats as Partial<GamificationStats> | undefined;
    this.stats = {
      totalTasksCompleted: saved?.totalTasksCompleted ?? 0,
      totalPomodoros: saved?.totalPomodoros ?? 0,
      totalACompleted: saved?.totalACompleted ?? 0
    };

    this.xp = data.xp || 0;

    if (data.badges && data.badges.length > 0) {
      // Merge saved unlock status with badge definitions. Records for badges
      // that no longer exist fall out here simply by not matching anything.
      this.badges = BADGE_DEFINITIONS.map(def => {
        const savedBadge = data.badges.find(sb => sb.id === def.id);
        return {
          ...def,
          unlocked: savedBadge?.unlocked || false,
          unlockedAt: savedBadge?.unlockedAt
        };
      });
    }
  }

  // Export data for persistence
  getData(): GamificationData {
    return {
      stats: this.stats,
      xp: this.xp,
      badges: this.badges
        .filter(b => !REMOVED_BADGE_IDS.has(b.id))
        .map(b => ({
          id: b.id,
          unlocked: b.unlocked,
          unlockedAt: b.unlockedAt
        }))
    };
  }

  // Set the persist callback
  setPersistCallback(callback: () => Promise<void>) {
    this.persistCallback = callback;
  }

  // Save to storage via callback
  async save() {
    if (this.persistCallback) {
      await this.persistCallback();
    }
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

// Initialize gamification store with persisted data
export function initGamification(
  data: GamificationData | undefined,
  persistCallback: () => Promise<void>,
  enabled: boolean = false
) {
  const s = getGamificationStore();
  s.load(data);
  s.setPersistCallback(persistCallback);
  s.setEnabled(enabled);
}
