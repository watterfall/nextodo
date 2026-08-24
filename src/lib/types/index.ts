import { isCompletedInCurrentUnit, getUnitRetentionRemaining, currentUnitStartLocal } from '$lib/utils/unitCalc';

// Priority levels.
//
// A-E are the quota-bearing tiers of the current 2-day unit. G marks a
// completed task and H a cancelled one; neither is a tier you can put work in.
//
// There used to be three more: F (Idea Pool), N (Future Progress) and
// S (Sustained Progress). They are gone, because the candidate pool now lives
// in a sleek todo.txt instead of in this app — an unsorted idea is simply a
// line that has not been pulled into a unit, "later" is todo.txt's `t:`
// threshold date or `h:1`, and the week's one sustained project is a
// `+project` tag. See docs/SLEEK-INTEROP.md §6.
export type Priority = 'A' | 'B' | 'C' | 'D' | 'E' | 'G' | 'H';
export type ActivePriority = Exclude<Priority, 'G' | 'H'>;
export type HiddenPriority = Extract<Priority, 'G' | 'H'>;
export type ActivePriorityCounts = Record<ActivePriority, number>;

// Recurrence, aligned 1:1 with the todo.txt `rec:` attribute so that a
// recurrence typed here and one imported from a sleek todo.txt behave
// identically. Grammar:  rec:[+]<n?><d|b|w|m|y>   e.g. rec:1d rec:3m rec:+1m rec:b
export type RecurrenceUnit = 'd' | 'b' | 'w' | 'm' | 'y';

export interface Recurrence {
  // Interval count, always >= 1. todo.txt lets the number be omitted
  // (`rec:d` means daily), which parses to n = 1.
  n: number;
  // d = days, b = business days (weekends skipped), w = weeks, m = months, y = years
  unit: RecurrenceUnit;
  // todo.txt's `rec:+` prefix: count the next occurrence from the previous DUE
  // date instead of the completion date. Loose (false) is the todo.txt default
  // and what sleek does, so it is the default for new tasks here too.
  strict: boolean;
  // Refinements todo.txt has no syntax for, so they stay FocusFlow-side and are
  // never written back to a shared file: `mon,wed,fri` (weekday list) and
  // `1m@15` / `1m@last` (day-of-month selector).
  customPattern?: string;
  nextDue: string | null;
}

// Whether the user chose this work ("proactive") or was handed it ("reactive").
//
// It is stored as an ordinary todo.txt context — `@主` / `@被` — rather than as
// a field on Task, so there is one source of truth: it round-trips through the
// shared file for free, and sleek's sidebar counts and filters it with no
// configuration. Single characters because the marker is written on every line
// it applies to; the UI renders a localized label, never the raw character.
export type TaskOrigin = 'self' | 'assigned';

export const ORIGIN_CONTEXT: Record<TaskOrigin, string> = {
  self: '主',
  assigned: '被'
};

export interface OriginCounts {
  self: number;
  assigned: number;
  /** Counted separately so a forgotten marker cannot inflate either side. */
  unmarked: number;
}

/** The origin marker on a task, or null when it carries neither. */
export function taskOrigin(task: Task): TaskOrigin | null {
  if (task.contexts.includes(ORIGIN_CONTEXT.self)) return 'self';
  if (task.contexts.includes(ORIGIN_CONTEXT.assigned)) return 'assigned';
  return null;
}

/** Tally proactive / reactive / unmarked across a task list. */
export function countOrigins(tasks: Task[]): OriginCounts {
  const counts: OriginCounts = { self: 0, assigned: 0, unmarked: 0 };
  for (const task of tasks) {
    const origin = taskOrigin(task);
    if (origin) counts[origin]++;
    else counts.unmarked++;
  }
  return counts;
}

/** Replace whichever origin marker a context list carries, if any. */
export function withOrigin(contexts: string[], origin: TaskOrigin | null): string[] {
  const markers = Object.values(ORIGIN_CONTEXT);
  const rest = contexts.filter(c => !markers.includes(c));
  return origin ? [...rest, ORIGIN_CONTEXT[origin]] : rest;
}

// Where a task came from, when it was pulled out of a todo.txt candidate pool.
//
// todo.txt has no stable identity — the line IS the record — so the verbatim
// source line is kept and matched again at write-back time. See
// docs/SLEEK-INTEROP.md §5.
export interface TaskSource {
  /** Absolute path of the todo.txt this task was pulled from. */
  file: string;
  /** The source line, exactly as it read when the task was pulled. */
  raw: string;
  pulledAt: string;
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
  /**
   * A situational cue that starts this task — the "if" half of an
   * implementation intention ("坐下打开电脑后" → write the report).
   *
   * `dueDate` and `thresholdDate` are both *time* triggers, and time triggers
   * fail the same way every time: the schedule slips, the moment passes, and
   * the cue is simply gone. A situational cue still shows up. That difference
   * is why if-then planning has the largest effect size in this whole field
   * (642 tests, d=.27–.66) while "set a deadline" does not.
   *
   * Free text on purpose: parsing it into categories would add a classification
   * decision at exactly the moment the point is to lower the cost of starting.
   * Never required, and never nagged about — a task without one is normal.
   *
   * FocusFlow-only. todo.txt extension values cannot contain spaces, so there
   * is no honest way to round-trip a phrase like this through a shared file.
   * That is the right home for it anyway: the cue belongs to the commitment
   * ("how will I start this in the next two days"), not to the backlog entry.
   */
  trigger?: string | null;
  // Set when this task was pulled from a todo.txt candidate pool.
  source?: TaskSource;
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
    // How much of the period was work the user chose versus work handed to
    // them. Optional because reviews recorded before the origin marker existed
    // have no honest value to put here — absent is not the same as zero.
    origin?: OriginCounts;
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
//
// `currentStreak` / `longestStreak` used to live here. They are gone, and not
// because of taste: habit-formation data shows a single missed day is
// statistically invisible to the automaticity curve, while a streak counter
// turns that same missed day into a reason to abandon the whole thing. The
// counter models the opposite of what actually happens. (They were also dead
// code — nothing ever incremented them, so the "3-day streak" badge could
// never unlock.) `perfectDays`, `earlyBirdCount` and `nightOwlCount` went the
// same way: never written, or written and never read.
export interface GamificationStats {
  totalTasksCompleted: number;
  totalPomodoros: number;
  totalACompleted: number;
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
      totalACompleted: 0
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
  // Fallback focus-block length in minutes, used when no task is selected.
  //
  // 25 is not a finding. It came from the inventor's kitchen timer, and the one
  // controlled study to vary it found 12–3 and 24–6 barely distinguishable:
  // what does the work is having an external structure at all, not the number.
  // So the number is the user's to set, per tier, below.
  pomodoroWork: number;
  pomodoroShortBreak: number;
  pomodoroLongBreak: number;
  // Focus-block length per priority tier. An A task is 2.5+ hours of deep work
  // and a 25-minute block just interrupts it; an E task is under 15 minutes and
  // a 50-minute block is theatre. Falls back to `pomodoroWork` when a tier is
  // missing.
  pomodoroWorkByPriority: Partial<Record<ActivePriority, number>>;
  autoBackup: boolean;
  sidebarCollapsed: boolean;
  // NEW: Auto archive settings
  autoArchiveDays: number;
  // Absolute path of the todo.txt that holds the candidate pool — the same file
  // sleek edits. Null until the user picks one.
  todoFilePath: string | null;
  // Optional companion done.txt. sleek archives completed lines there, so a
  // source line that has vanished from todoFilePath is looked for here before
  // the write-back gives up.
  doneFilePath: string | null;
  // Whether pulling a task may append its @主 / @被 marker to the source line.
  // Off makes the pull strictly read-only.
  writeBackOrigin: boolean;
  // The `+project` tag of the week's one sustained project, or null. This is
  // what the S tier used to be: a constraint on attention, not a priority.
  focusProject: string | null;
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
  // XP, levels, badges and the completion animation. Off by default.
  //
  // The quota system and the XP system optimise for opposite things: one caps
  // what you may promise, the other pays you per completion, and the fastest
  // way to earn is to do many small tasks — precisely what the quota exists to
  // prevent. When two mechanisms disagree, the visible one wins, so the
  // scoreboard has to be the one that is off unless asked for. Existing XP and
  // badges are kept, just not shown.
  gamificationEnabled: boolean;
}

// Dynamic 2-day cycle state. The active work window normally equals the calendar
// unit; when a period ends with low (priority-weighted) completion the next
// period is flagged as a continued ("merged") window and the unfinished A-E
// tasks roll into it. Sunday (review day) never participates.
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
  // Tasks bound for the todo.txt candidate pool that have not been written out
  // yet — see docs/SLEEK-INTEROP.md §10. They live here so that removing the
  // F / N tiers can never destroy data just because no todo.txt was configured
  // at migration time.
  pendingExport?: Task[];
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
  // Tasks bound for the todo.txt candidate pool that have not been written out
  // yet — see docs/SLEEK-INTEROP.md §10. They live here so that removing the
  // F / N tiers can never destroy data just because no todo.txt was configured
  // at migration time.
  pendingExport?: Task[];
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

// Unit info.
//
// There is deliberately no `label` here: it used to carry a hardcoded Chinese
// string that nothing ever rendered (UnitNav builds its own localized label),
// so it was a permanent trap for anyone who did start rendering it.
export interface UnitInfo {
  unitNumber: number;
  startDate: Date;
  endDate: Date;
  isReviewDay: boolean;
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

// The tier a task lands in when nothing more specific is known. It used to be
// F (Idea Pool); with the candidate pool moved to todo.txt there is no
// unsorted tier left, so an unqualified new task is an ordinary standard task.
export const DEFAULT_PRIORITY: ActivePriority = 'C';

// Create empty task
export function createEmptyTask(priority: Priority = DEFAULT_PRIORITY): Task {
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
    notes: '',
    trigger: null
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
    // Deep tiers get a block long enough to actually load the problem; the
    // short tiers keep the classic length.
    pomodoroWorkByPriority: { A: 50, B: 50, C: 25, D: 25, E: 25 },
    autoBackup: true,
    sidebarCollapsed: false,
    autoArchiveDays: 7,
    todoFilePath: null,
    doneFilePath: null,
    writeBackOrigin: true,
    focusProject: null,
    unitBoundaryFlexHours: 12, // Default: half day flexibility
    density: 'comfortable',
    dueReminders: true,
    lowCompletionPrompt: true,
    gamificationEnabled: false
  };
}

// Create default active data
export function createDefaultActiveData(): ActiveData {
  return {
    version: '5.0',
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
    version: '5.0',
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

// The quota-bearing tiers of the current unit, in order.
export const ACTIVE_PRIORITIES: ActivePriority[] = ['A', 'B', 'C', 'D', 'E'];

// Hidden priorities (completed/cancelled)
export const HIDDEN_PRIORITIES: HiddenPriority[] = ['G', 'H'];

// Check if a task sits in a tier the user can put work in (A-E).
export function isActivePriority(priority: Priority): priority is ActivePriority {
  return (ACTIVE_PRIORITIES as readonly Priority[]).includes(priority);
}

// Check if a task can be operated on (complete / cancel / edit / re-prioritise).
//
// This used to be broader than isActivePriority because N and S sat outside the
// A-F range while still being real, workable tasks — and several call sites
// gated on the wrong one, leaving those two tiers with no way to finish a task.
// With N and S gone the two predicates coincide; the name is kept because the
// intent it expresses (may the user act on this?) is not the same question as
// "does this tier have a quota".
export function isOperablePriority(priority: Priority): boolean {
  return isActivePriority(priority);
}

// Check if a task should be COUNTED in cross-cutting aggregations such as
// sidebar project/context/tag badges — i.e. any task that lives in the user's
// working set (not yet completed or cancelled).
export function isCountedPriority(priority: Priority): boolean {
  return !isHiddenPriority(priority);
}

// Check if a task is completed (G) or cancelled (H)
export function isHiddenPriority(priority: Priority): priority is HiddenPriority {
  return (HIDDEN_PRIORITIES as readonly Priority[]).includes(priority);
}
