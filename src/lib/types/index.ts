// Priority levels
// A-E are work priorities with quotas, F is the Idea Pool (unlimited)
// G is for completed tasks, H is for cancelled tasks (both hidden by default)
export type Priority = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';

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
  // NEW: Unit override for flexible unit control
  unitOverride?: {
    extendedUntil?: string;
    endedEarly?: boolean;
  };
  // Original priority before completion/cancellation (for retention display)
  originalPriority?: Priority;
  // Last priority change timestamp (for detecting frequent changes)
  lastPriorityChangeAt?: string;
}

// Unit review interface
export interface UnitReview {
  id: string;
  unitStart: string;
  unitEnd: string;
  createdAt: string;
  stats: {
    planned: Record<Priority, number>;
    completed: Record<Priority, number>;
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
export type ViewMode = 'kanban' | 'list' | 'calendar';

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
    unitStart: now.split('T')[0],
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
    showFutureTasks: false
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

// Retention duration in hours based on original priority level
// Higher priority tasks stay visible longer after completion
export const COMPLETED_RETENTION_HOURS: Record<Priority, number> = {
  A: 12,  // Core challenge - 12 hours retention
  B: 10,  // Key progress - 10 hours retention
  C: 8,   // Steady progress - 8 hours retention
  D: 6,   // Ad-hoc tasks - 6 hours retention
  E: 4,   // Quick action - 4 hours retention
  F: 4,   // Idea pool - 4 hours retention
  G: 0,   // Already completed
  H: 0,   // Already cancelled
};

// Check if a completed task is still within its retention period
export function isWithinRetentionPeriod(task: Task): boolean {
  if (!task.completedAt) return false;

  // Use originalPriority if available, otherwise estimate based on pomodoros
  const originalPriority = task.originalPriority || estimateOriginalPriority(task);
  const retentionHours = COMPLETED_RETENTION_HOURS[originalPriority] || 4;

  const completedAt = new Date(task.completedAt).getTime();
  const now = Date.now();
  const retentionMs = retentionHours * 60 * 60 * 1000;

  return (now - completedAt) < retentionMs;
}

// Estimate original priority based on task characteristics (fallback for legacy tasks)
function estimateOriginalPriority(task: Task): Priority {
  const estimated = task.pomodoros.estimated;
  if (estimated >= 5) return 'A';
  if (estimated >= 3) return 'B';
  if (estimated >= 2) return 'C';
  if (estimated >= 1) return 'D';
  return 'E';
}

// Get remaining retention time as a human-readable string
export function getRetentionRemaining(task: Task): { hours: number; minutes: number } | null {
  if (!task.completedAt) return null;

  const originalPriority = task.originalPriority || estimateOriginalPriority(task);
  const retentionHours = COMPLETED_RETENTION_HOURS[originalPriority] || 4;

  const completedAt = new Date(task.completedAt).getTime();
  const now = Date.now();
  const retentionMs = retentionHours * 60 * 60 * 1000;
  const remainingMs = retentionMs - (now - completedAt);

  if (remainingMs <= 0) return null;

  const hours = Math.floor(remainingMs / (60 * 60 * 1000));
  const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));

  return { hours, minutes };
}

// Active priorities (shown in main views)
export const ACTIVE_PRIORITIES: Priority[] = ['A', 'B', 'C', 'D', 'E', 'F'];

// Hidden priorities (completed/cancelled)
export const HIDDEN_PRIORITIES: Priority[] = ['G', 'H'];

// Check if a task is in an active (visible) priority
export function isActivePriority(priority: Priority): boolean {
  return ACTIVE_PRIORITIES.includes(priority);
}

// Check if a task is completed (G) or cancelled (H)
export function isHiddenPriority(priority: Priority): boolean {
  return HIDDEN_PRIORITIES.includes(priority);
}
