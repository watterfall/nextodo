// Priority levels
export type Priority = 'A' | 'B' | 'C' | 'D' | 'E';

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

// Gamification: Badge types
export type BadgeId = 
  | 'planner_novice' 
  | 'flow_master' 
  | 'early_bird' 
  | 'challenger' 
  | 'consistency_3'
  | 'consistency_7'
  | 'deep_diver';

export interface Badge {
  id: BadgeId;
  name: string;
  description: string;
  icon: string;
  unlockedAt?: string; // ISO date string if unlocked
}

// Custom tag groups
export interface CustomTagGroups {
  energy: string[];
  type: string[];
  [key: string]: string[];
}

// Theme type
export type Theme = 'dark' | 'light' | 'system';

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
  trash: Task[];
  reviews: UnitReview[];
  customTagGroups: CustomTagGroups;
  // NEW: Earned badges
  badges: Badge[];
  settings: Settings;
}

// Archive data file structure (cold data)
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
  archive: Task[];
  trash: Task[];
  reviews: UnitReview[];
  customTagGroups: CustomTagGroups;
  pomodoroHistory: PomodoroSession[];
  // NEW: Earned badges
  badges: Badge[];
  settings: Settings;
}

// Priority configuration
export interface PriorityConfig {
  name: string;
  quota: number;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

export const PRIORITY_CONFIG: Record<Priority, PriorityConfig> = {
  A: {
    name: '核心挑战',
    quota: 1,
    description: '深度工作，需 2+ 小时专注',
    color: 'var(--priority-a-color, #da77f2)',
    bgColor: 'var(--priority-a-bg, rgba(218, 119, 242, 0.12))',
    borderColor: 'var(--priority-a-border, rgba(218, 119, 242, 0.25))'
  },
  B: {
    name: '重要推进',
    quota: 2,
    description: '项目关键节点',
    color: 'var(--priority-b-color, #ff922b)',
    bgColor: 'var(--priority-b-bg, rgba(255, 146, 43, 0.12))',
    borderColor: 'var(--priority-b-border, rgba(255, 146, 43, 0.25))'
  },
  C: {
    name: '标准任务',
    quota: 3,
    description: '日常工作任务',
    color: 'var(--priority-c-color, #74c0fc)',
    bgColor: 'var(--priority-c-bg, rgba(116, 192, 252, 0.08))',
    borderColor: 'var(--priority-c-border, rgba(116, 192, 252, 0.2))'
  },
  D: {
    name: '快速处理',
    quota: 5,
    description: '15分钟内可完成',
    color: 'var(--priority-d-color, #868e96)',
    bgColor: 'var(--priority-d-bg, rgba(134, 142, 150, 0.08))',
    borderColor: 'var(--priority-d-border, rgba(134, 142, 150, 0.2))'
  },
  E: {
    name: '收集箱',
    quota: Infinity,
    description: '备忘、想法、无期限',
    color: 'var(--priority-e-color, #5c636a)',
    bgColor: 'var(--priority-e-bg, rgba(92, 99, 106, 0.08))',
    borderColor: 'var(--priority-e-border, rgba(92, 99, 106, 0.2))'
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
}

// View mode
export type ViewMode = 'kanban' | 'list';

// Pomodoro state
export type PomodoroState = 'idle' | 'work' | 'shortBreak' | 'longBreak';

// Create empty task
export function createEmptyTask(priority: Priority = 'E'): Task {
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
    version: '3.0',
    lastModified: new Date().toISOString(),
    tasks: [],
    trash: [],
    reviews: [],
    customTagGroups: {
      energy: ['⚡高能量', '😴低能量', '☕中等'],
      type: ['📞电话', '💻编码', '✍️写作', '🤝会议']
    },
    badges: [],
    settings: createDefaultSettings()
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
    version: '3.0',
    lastModified: new Date().toISOString(),
    tasks: [],
    archive: [],
    trash: [],
    reviews: [],
    customTagGroups: {
      energy: ['⚡高能量', '😴低能量', '☕中等'],
      type: ['📞电话', '💻编码', '✍️写作', '🤝会议']
    },
    pomodoroHistory: [],
    badges: [],
    settings: createDefaultSettings()
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

// Calculate E zone aging (how many units the task has been in E zone)
export function calculateEZoneAge(task: Task, unitDays: number = 7): number {
  if (task.priority !== 'E') return 0;

  const created = new Date(task.createdAt);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));

  return Math.floor(diffDays / unitDays);
}
