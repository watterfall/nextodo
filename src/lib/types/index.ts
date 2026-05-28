import { isCompletedInCurrentUnit, getUnitRetentionRemaining, currentUnitStartLocal } from '$lib/utils/unitCalc';

// Priority levels
// A-E are work priorities with quotas, F is the Idea Pool (unlimited)
// S is "Sustained Progress" — week-long important projects with subtasks
// N is "Future Progress" — long-term important but non-urgent
// G is for completed tasks, H is for cancelled tasks (both hidden by default)
export type Priority = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'N' | 'S';
export type ActivePriority = Exclude<Priority, 'G' | 'H' | 'N' | 'S'>;
export type FuturePriority = Extract<Priority, 'N'>;
export type SustainedPriority = Extract<Priority, 'S'>;
export type HiddenPriority = Extract<Priority, 'G' | 'H'>;
export type ActivePriorityCounts = Record<ActivePriority, number>;

// Recurrence patterns - extended to support more patterns
export type RecurrencePattern =
  | '1d' | '2d' | '3d' | '1w' | '2w' | '1m' | '3m'
  | null;

// Extended recurrence for flexible patterns
export interface Recurrence {
  pattern: RecurrencePattern;
  // For patterns like mon,wed,fri or 1m@15
  customPattern?: string;
  nextDue: string | null;
}

// Lightweight subtask — embedded inside a parent Task. Used most commonly by
// Sustained (S) tasks for breaking a week-long project into checkable steps.
// Subtasks are intentionally minimal: no priority/dates/pomodoros — they are
// bullets you tick off, not standalone tasks.
export interface Subtask {
  id: string;
  content: string;
  completed: boolean;
  completedAt?: string | null;
}

// Task interface - with Threshold Date support
export interface Task {
  id: string;
  content: string;
  priority: Priority;
  completed: boolean;
  completedAt: string | null;
  createdAt: string;
  unitStart: string;
  projects: string[];
  contexts: string[];
  customTags: string[];
  dueDate: string | null;
  // NEW: Threshold Date - task not visible until this date
  thresholdDate: string | null;
  recurrence: Recurrence | null;
  pomodoros: {
    estimated: number;
    completed: number;
  };
  notes: string;
  // NEW: Embedded subtasks for breakdown — most useful on S (Sustained) tasks
  subtasks?: Subtask[];
  // NEW: Unit override for flexible unit control
  unitOverride?: {
    extendedUntil?: string;
    endedEarly?: boolean;
  };
  // Original priority before completion/cancellation (for retention display)
  originalPriority?: Priority;
  // Last priority change timestamp (for detecting frequent changes)
  lastPriorityChangeAt?: string;
  // Task evolution: ID of the parent task this task evolved from
  evolvedFrom?: string;
}

// Unit review interface
export interface UnitReview {
  id: string;
  unitStart: string;
  unitEnd: string;
  createdAt: string;
  stats: {
    planned: ActivePriorityCounts;
    completed: ActivePriorityCounts;
    pomodorosTotal: number;
  };
  reflection: string;
  nextUnitFocus: string;
}

// Pomodoro session
export interface PomodoroSession {
  id: string;
  taskId: string;
  startedAt: string;
  duration: number;
  completed: boolean;
  interruptions?: number; // Number of interruptions recorded during this session
  // NEW: Reasons for interruptions
  interruptionReasons?: string[];
}

// Custom tag groups
export interface CustomTagGroups {
  energy: string[];
  type: string[];
  [key: string]: string[];
}

// Theme type
export type Theme = 'dark' | 'light' | 'system';

// Gamification types
export interface GamificationStats {
  totalTasksCompleted: number;
  totalPomodoros: number;
  currentStreak: number;
  longestStreak: number;
  totalACompleted: number;
  earlyBirdCount: number;
  nightOwlCount: number;
  perfectDays: number;
}

export interface BadgeData {
  id: string;
  unlocked: boolean;
  unlockedAt?: string;
}

export interface GamificationData {
  stats: GamificationStats;
  xp: number;
  badges: BadgeData[];
}

export function createDefaultGamificationData(): GamificationData {
  return {
    stats: {
      totalTasksCompleted: 0,
      totalPomodoros: 0,
      currentStreak: 0,
      longestStreak: 0,
      totalACompleted: 0,
      earlyBirdCount: 0,
      nightOwlCount: 0,
      perfectDays: 0
    },
    xp: 0,
    badges: []
  };
}

// Language type
export type Language = 'zh-CN' | 'en-US';

// App settings - extended
export interface Settings {
  theme: Theme;
  language: Language;
  pomodoroWork: number;
  pomodoroShortBreak: number;
  pomodoroLongBreak: number;
  autoBackup: boolean;
  sidebarCollapsed: boolean;
  // NEW: Auto archive settings
  autoArchiveDays: number;
  // NEW: E zone aging warning days
  eZoneAgingDays: number;
  // NEW: Show threshold tasks in separate view
  showFutureTasks: boolean;
  // NEW: Flexible unit boundary hours (extend/shorten unit by this many hours)
  // Default: 12 hours - tasks can spill over half a day
  unitBoundaryFlexHours: number;
  // NEW: UI density mode — 'comfortable' (default) | 'compact' (denser layout)
  density: 'comfortable' | 'compact';
  // NEW: send a daily summary notification for tasks due today / overdue
  dueReminders: boolean;
  // NEW: when a 2-day period ends under-completed, prompt a micro-review instead
  // of silently merging into the next period
  lowCompletionPrompt: boolean;
}

// Dynamic 2-day cycle state. The active work window normally equals the calendar
// unit; when a period ends with low (priority-weighted) completion the next
// period is flagged as a continued ("merged") window and the unfinished A-E
// tasks roll into it. Saturday (review day) never participates.
export interface CycleState {
  anchorStart: string;        // local YYYY-MM-DD — start of the current 2-day window
  windowEnd: string;          // local YYYY-MM-DD — inclusive end of the current window
  merged: boolean;            // current window continues an under-completed prior period
  lastEvaluatedStart: string; // anchorStart of the period already scored (dedupe)
  // Set when a period ended under-completed AND lowCompletionPrompt is on: the
  // merge is deferred until the user resolves the micro-review banner.
  pendingReview?: { periodStart: string; completion: number } | null;
}

// One scored 2-day period, recorded when the cycle advances (for the completion
// history sparkline and observability of the merge engine).
export interface CycleHistoryEntry {
  periodStart: string;        // local YYYY-MM-DD start of the scored period
  completion: number | null;  // priority-weighted completion ratio (null = nothing planned)
  merged: boolean;            // whether this low score triggered a merge into the next period
}

// Active data file structure (hot data)
export interface ActiveData {
  version: string;
  lastModified: string;
  tasks: Task[];
  reviews: UnitReview[];
  customTagGroups: CustomTagGroups;
  settings: Settings;
  gamification?: GamificationData;
  cycleState?: CycleState;
  cycleHistory?: CycleHistoryEntry[];
}

// Archive data file structure (cold data) - DEPRECATED, kept for migration
export interface ArchiveData {
  version: string;
  lastModified: string;
  tasks: Task[];
}

// Pomodoro history file structure
export interface PomodoroHistoryData {
  version: string;
  lastModified: string;
  sessions: PomodoroSession[];
}

// Combined app data structure (for backwards compatibility and in-memory use)
export interface AppData {
  version: string;
  lastModified: string;
  tasks: Task[];
  reviews: UnitReview[];
  customTagGroups: CustomTagGroups;
  pomodoroHistory: PomodoroSession[];
  settings: Settings;
  gamification?: GamificationData;
  cycleState?: CycleState;
  cycleHistory?: CycleHistoryEntry[];
}

// Priority configuration
export interface PriorityConfig {
  name: string;
  quota: number;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
  // Pomodoro constraints: recommended range for task estimation
  pomodoroRange: {
    min: number;
    max: number;
    recommended: number;
  };
}

export const PRIORITY_CONFIG: Record<Priority, PriorityConfig> = {
  A: {
    name: '核心挑战',
    quota: 1,
    description: '深度工作，需 2.5+ 小时专注',
    color: 'var(--priority-a-color, #da77f2)',
    bgColor: 'var(--priority-a-bg, rgba(218, 119, 242, 0.12))',
    borderColor: 'var(--priority-a-border, rgba(218, 119, 242, 0.25))',
    pomodoroRange: { min: 5, max: 12, recommended: 8 }  // 2.5-6 hours = 5-12 pomodoros
  },
  B: {
    name: '重要推进',
    quota: 2,
    description: '项目关键节点',
    color: 'var(--priority-b-color, #ff922b)',
    bgColor: 'var(--priority-b-bg, rgba(255, 146, 43, 0.12))',
    borderColor: 'var(--priority-b-border, rgba(255, 146, 43, 0.25))',
    pomodoroRange: { min: 3, max: 6, recommended: 4 }  // 1.5-3 hours = 3-6 pomodoros
  },
  C: {
    name: '标准任务',
    quota: 3,
    description: '日常工作任务',
    color: 'var(--priority-c-color, #74c0fc)',
    bgColor: 'var(--priority-c-bg, rgba(116, 192, 252, 0.08))',
    borderColor: 'var(--priority-c-border, rgba(116, 192, 252, 0.2))',
    pomodoroRange: { min: 2, max: 5, recommended: 3 }  // 1-2.5 hours = 2-5 pomodoros
  },
  D: {
    name: '临时任务',
    quota: 4,
    description: '计划外的临时任务',
    color: 'var(--priority-d-color, #868e96)',
    bgColor: 'var(--priority-d-bg, rgba(134, 142, 150, 0.08))',
    borderColor: 'var(--priority-d-border, rgba(134, 142, 150, 0.2))',
    pomodoroRange: { min: 1, max: 3, recommended: 2 }  // 25-75 min = 1-3 pomodoros
  },
  E: {
    name: '快速处理',
    quota: 5,
    description: '15分钟内可完成',
    color: 'var(--priority-e-color, #51cf66)',
    bgColor: 'var(--priority-e-bg, rgba(81, 207, 102, 0.08))',
    borderColor: 'var(--priority-e-border, rgba(81, 207, 102, 0.2))',
    pomodoroRange: { min: 0, max: 1, recommended: 0 }  // <15 min = 0-1 pomodoros
  },
  F: {
    name: '灵感收集',
    quota: Infinity,
    description: '收集想法、待分类任务',
    color: 'var(--priority-f-color, #5c636a)',
    bgColor: 'var(--priority-f-bg, rgba(92, 99, 106, 0.08))',
    borderColor: 'var(--priority-f-border, rgba(92, 99, 106, 0.2))',
    pomodoroRange: { min: 0, max: Infinity, recommended: 0 }  // No constraints
  },
  G: {
    name: '已完成',
    quota: Infinity,
    description: '已完成的任务',
    color: 'var(--priority-g-color, #51cf66)',
    bgColor: 'var(--priority-g-bg, rgba(81, 207, 102, 0.08))',
    borderColor: 'var(--priority-g-border, rgba(81, 207, 102, 0.2))',
    pomodoroRange: { min: 0, max: Infinity, recommended: 0 }
  },
  H: {
    name: '已取消',
    quota: Infinity,
    description: '已取消的任务',
    color: 'var(--priority-h-color, #868e96)',
    bgColor: 'var(--priority-h-bg, rgba(134, 142, 150, 0.08))',
    borderColor: 'var(--priority-h-border, rgba(134, 142, 150, 0.2))',
    pomodoroRange: { min: 0, max: Infinity, recommended: 0 }
  },
  N: {
    name: '未来推进',
    quota: Infinity,
    description: '重要但长期的推进任务，默认隐藏不打扰',
    color: 'var(--priority-n-color, #748ffc)',
    bgColor: 'var(--priority-n-bg, rgba(116, 143, 252, 0.08))',
    borderColor: 'var(--priority-n-border, rgba(116, 143, 252, 0.22))',
    pomodoroRange: { min: 0, max: Infinity, recommended: 0 }
  },
  S: {
    name: '持续推进',
    quota: 1,
    description: '本周唯一的持续推进项目，用子任务分解执行',
    color: 'var(--priority-s-color, #20c997)',
    bgColor: 'var(--priority-s-bg, rgba(32, 201, 151, 0.1))',
    borderColor: 'var(--priority-s-border, rgba(32, 201, 151, 0.28))',
    pomodoroRange: { min: 0, max: Infinity, recommended: 0 }
  }
};

// Unit info
export interface UnitInfo {
  unitNumber: number;
  startDate: Date;
  endDate: Date;
  isReviewDay: boolean;
  label: string;
}

// Filter state - extended with threshold filter
export interface FilterState {
  project: string | null;
  context: string | null;
  tag: string | null;
  showCompleted: boolean;
  dueFilter: 'today' | 'thisWeek' | 'overdue' | null;
  // NEW: Show only future tasks (threshold not reached)
  showFutureTasks: boolean;
  // NEW: Filter by priority
  priority: Priority | null;
  // NEW: Filter by estimated pomodoro count
  pomodoroFilter: number | null;
}

// View mode
export type ViewMode = 'today' | 'kanban' | 'list' | 'calendar';

// Pomodoro state
export type PomodoroState = 'idle' | 'work' | 'shortBreak' | 'longBreak';

// Create empty task
export function createEmptyTask(priority: Priority = 'F'): Task {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    content: '',
    priority,
    completed: false,
    completedAt: null,
    createdAt: now,
    unitStart: currentUnitStartLocal(),
    projects: [],
    contexts: [],
    customTags: [],
    dueDate: null,
    thresholdDate: null,
    recurrence: null,
    pomodoros: {
      estimated: 0,
      completed: 0
    },
    notes: ''
  };
}

// Create default settings
export function createDefaultSettings(): Settings {
  return {
    theme: 'dark',
    language: 'zh-CN',
    pomodoroWork: 25,
    pomodoroShortBreak: 5,
    pomodoroLongBreak: 20,
    autoBackup: true,
    sidebarCollapsed: false,
    autoArchiveDays: 7,
    eZoneAgingDays: 3,
    showFutureTasks: false,
    unitBoundaryFlexHours: 12, // Default: half day flexibility
    density: 'comfortable',
    dueReminders: true,
    lowCompletionPrompt: true
  };
}

// Create default active data
export function createDefaultActiveData(): ActiveData {
  return {
    version: '4.0',
    lastModified: new Date().toISOString(),
    tasks: [],
    reviews: [],
    customTagGroups: {
      energy: ['⚡高能量', '😴低能量', '☕中等'],
      type: ['📞电话', '💻编码', '✍️写作', '🤝会议']
    },
    settings: createDefaultSettings(),
    gamification: createDefaultGamificationData()
  };
}

// Create default archive data
export function createDefaultArchiveData(): ArchiveData {
  return {
    version: '3.0',
    lastModified: new Date().toISOString(),
    tasks: []
  };
}

// Create default pomodoro history data
export function createDefaultPomodoroHistoryData(): PomodoroHistoryData {
  return {
    version: '3.0',
    lastModified: new Date().toISOString(),
    sessions: []
  };
}

// Create default app data (combined)
export function createDefaultAppData(): AppData {
  return {
    version: '4.0',
    lastModified: new Date().toISOString(),
    tasks: [],
    reviews: [],
    customTagGroups: {
      energy: ['⚡高能量', '😴低能量', '☕中等'],
      type: ['📞电话', '💻编码', '✍️写作', '🤝会议']
    },
    pomodoroHistory: [],
    settings: createDefaultSettings(),
    gamification: createDefaultGamificationData()
  };
}

// Check if a task's threshold date has passed
export function isThresholdPassed(task: Task): boolean {
  if (!task.thresholdDate) return true;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const threshold = new Date(task.thresholdDate);
  threshold.setHours(0, 0, 0, 0);

  return threshold <= today;
}

// Calculate F zone (Idea Pool) aging (how many units the task has been in F zone)
export function calculateFZoneAge(task: Task, unitDays: number = 7): number {
  if (task.priority !== 'F') return 0;

  const created = new Date(task.createdAt);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));

  return Math.floor(diffDays / unitDays);
}

// Backward compatibility alias
export function calculateEZoneAge(task: Task, unitDays: number = 7): number {
  return calculateFZoneAge(task, unitDays);
}

// A completed task stays visible (struck-through in its original zone) until the
// 2-day unit it was completed in ends. Once the current unit advances past that
// unit, the task is hidden. Tied to the unit cycle rather than a fixed duration.
export function isWithinRetentionPeriod(task: Task): boolean {
  if (!task.completedAt) return false;
  return isCompletedInCurrentUnit(task.completedAt);
}

// Time remaining until the completed task's unit ends (when it will be hidden).
// Returns null once that unit has already ended.
export function getRetentionRemaining(task: Task): { hours: number; minutes: number } | null {
  if (!task.completedAt) return null;
  return getUnitRetentionRemaining(task.completedAt);
}

// Active priorities (shown in main views)
export const ACTIVE_PRIORITIES: ActivePriority[] = ['A', 'B', 'C', 'D', 'E', 'F'];

// Future priorities (collapsed, separate entry; not shown in daily views)
export const FUTURE_PRIORITIES: FuturePriority[] = ['N'];

// Sustained priorities (week-long ongoing projects with subtasks)
export const SUSTAINED_PRIORITIES: SustainedPriority[] = ['S'];

// Hidden priorities (completed/cancelled)
export const HIDDEN_PRIORITIES: HiddenPriority[] = ['G', 'H'];

// Check if a task is in an active (daily-visible) priority
export function isActivePriority(priority: Priority): priority is ActivePriority {
  return (ACTIVE_PRIORITIES as readonly Priority[]).includes(priority);
}

// Check if a task is in a future (long-horizon, default-hidden) priority
export function isFuturePriority(priority: Priority): priority is FuturePriority {
  return (FUTURE_PRIORITIES as readonly Priority[]).includes(priority);
}

// Check if a task is in a sustained (weekly ongoing) priority
export function isSustainedPriority(priority: Priority): priority is SustainedPriority {
  return (SUSTAINED_PRIORITIES as readonly Priority[]).includes(priority);
}

// Check if a task can be operated on (complete/cancel/edit) — active OR future OR sustained
export function isOperablePriority(priority: Priority): boolean {
  return isActivePriority(priority) || isFuturePriority(priority) || isSustainedPriority(priority);
}

// Check if a task should be COUNTED in cross-cutting aggregations such as
// sidebar project/context/tag badges — i.e. any task that lives in the user's
// working set (not yet completed or cancelled). Currently equivalent to
// isOperablePriority, kept as a separate predicate so the two intents
// (UI permission vs. counting) can evolve independently without one site
// silently changing the other's semantics.
export function isCountedPriority(priority: Priority): boolean {
  return !isHiddenPriority(priority);
}

// Check if a task is completed (G) or cancelled (H)
export function isHiddenPriority(priority: Priority): priority is HiddenPriority {
  return (HIDDEN_PRIORITIES as readonly Priority[]).includes(priority);
}

// ============================================================================
// Subtask helpers
// ============================================================================

// Get subtask completion ratio for a task (0..1). Returns 0 if no subtasks.
export function subtaskProgress(task: Task): { done: number; total: number; ratio: number } {
  const subs = task.subtasks ?? [];
  const total = subs.length;
  if (total === 0) return { done: 0, total: 0, ratio: 0 };
  const done = subs.filter(s => s.completed).length;
  return { done, total, ratio: done / total };
}

// Create a new subtask record
export function createSubtask(content: string): Subtask {
  return {
    id: crypto.randomUUID(),
    content: content.trim(),
    completed: false,
    completedAt: null
  };
}
