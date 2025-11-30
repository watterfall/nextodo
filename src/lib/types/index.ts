// Priority levels
export type Priority = 'A' | 'B' | 'C' | 'D' | 'E';

// Recurrence patterns
export type RecurrencePattern = '1d' | '2d' | '3d' | '1w' | '2w' | '1m' | '3m' | null;

// Task interface
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
  recurrence: {
    pattern: RecurrencePattern;
    nextDue: string | null;
  } | null;
  pomodoros: {
    estimated: number;
    completed: number;
  };
  notes: string;
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
}

// Custom tag groups
export interface CustomTagGroups {
  energy: string[];
  type: string[];
  [key: string]: string[];
}

// App settings
export interface Settings {
  theme: 'dark' | 'light';
  pomodoroWork: number;
  pomodoroShortBreak: number;
  pomodoroLongBreak: number;
  autoBackup: boolean;
  sidebarCollapsed: boolean;
}

// Main app data structure
export interface AppData {
  version: string;
  lastModified: string;
  tasks: Task[];
  archive: Task[];
  trash: Task[];
  reviews: UnitReview[];
  customTagGroups: CustomTagGroups;
  pomodoroHistory: PomodoroSession[];
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
    color: '#a855f7',
    bgColor: 'linear-gradient(135deg, #581c87, #7c3aed)',
    borderColor: '#a855f7'
  },
  B: {
    name: '重要推进',
    quota: 2,
    description: '项目关键节点',
    color: '#f97316',
    bgColor: 'rgba(249, 115, 22, 0.1)',
    borderColor: '#f97316'
  },
  C: {
    name: '标准任务',
    quota: 3,
    description: '日常工作任务',
    color: '#64748b',
    bgColor: 'rgba(100, 116, 139, 0.1)',
    borderColor: '#475569'
  },
  D: {
    name: '快速处理',
    quota: 5,
    description: '15分钟内可完成',
    color: '#94a3b8',
    bgColor: 'rgba(148, 163, 184, 0.05)',
    borderColor: '#334155'
  },
  E: {
    name: '收集箱',
    quota: Infinity,
    description: '备忘、想法、无期限',
    color: '#64748b',
    bgColor: 'rgba(51, 65, 85, 0.3)',
    borderColor: '#1e293b'
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

// Filter state
export interface FilterState {
  project: string | null;
  context: string | null;
  tag: string | null;
  showCompleted: boolean;
  dueFilter: 'today' | 'thisWeek' | 'overdue' | null;
}

// View mode
export type ViewMode = 'zones' | 'list' | 'calendar';

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
    recurrence: null,
    pomodoros: {
      estimated: 0,
      completed: 0
    },
    notes: ''
  };
}

// Create default app data
export function createDefaultAppData(): AppData {
  return {
    version: '2.0',
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
    settings: {
      theme: 'dark',
      pomodoroWork: 25,
      pomodoroShortBreak: 5,
      pomodoroLongBreak: 20,
      autoBackup: true,
      sidebarCollapsed: false
    }
  };
}
