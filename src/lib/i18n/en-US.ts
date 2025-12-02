export default {
  // App
  app: {
    name: 'FocusFlow',
    tagline: 'Focus-first Task Manager',
    loading: 'Loading...',
  },

  // Navigation
  nav: {
    today: 'Today',
    inbox: 'Inbox',
    projects: 'Projects',
    contexts: 'Contexts',
    tags: 'Tags',
    calendar: 'Calendar',
    archive: 'Archive',
    trash: 'Trash',
    trashArchive: 'Trash & Archive',
    settings: 'Settings',
    badges: 'Badges',
  },

  // Trash
  trash: {
    title: 'Trash',
    empty: 'Trash is empty',
    retentionInfo: 'Items in trash are deleted after 7 days',
    expiring: 'Expiring soon',
  },

  // Archive section
  archiveSection: {
    title: 'Archive',
    empty: 'No archived tasks',
    showingRecent: 'Showing recent 50 records',
  },

  // Completed section
  completedSection: {
    title: 'Completed',
    empty: 'No completed tasks',
  },

  // Priorities - With detailed tooltips
  priority: {
    A: 'Core Challenge',
    B: 'Key Progress',
    C: 'Steady Progress',
    D: 'Ad-hoc Tasks',
    E: 'Quick Action',
    F: 'Idea Pool',
    description: {
      A: 'Deep work, 2+ hours focus',
      B: 'Project milestones, 45-90 min',
      C: 'Steady progress, 20-45 min',
      D: 'Unplanned, ad-hoc tasks',
      E: 'Under 15 minutes',
      F: 'Ideas & tasks to sort',
    },
    tooltip: {
      A: 'Core Challenge · Quota 1/cycle · 2+ hours · High difficulty & value',
      B: 'Key Progress · Quota 2/cycle · 45-90 min · Medium difficulty',
      C: 'Steady Progress · Quota 3/cycle · 20-45 min · Standard difficulty',
      D: 'Ad-hoc Tasks · Quota 4/cycle · Unplanned · Stay flexible',
      E: 'Quick Action · Quota 5/cycle · <15 min · Fast completion',
      F: 'Idea Pool · Unlimited · Capture ideas · Sort later',
    },
    quota: {
      A: '1/cycle',
      B: '2/cycle',
      C: '3/cycle',
      D: '4/cycle',
      E: '5/cycle',
      F: 'Unlimited',
    },
    difficulty: {
      A: 'High',
      B: 'Medium',
      C: 'Standard',
      D: 'Ad-hoc',
      E: 'Low',
      F: 'To sort',
    },
    time: {
      A: '2+ hours',
      B: '45-90 min',
      C: '20-45 min',
      D: 'Varies',
      E: '<15 min',
      F: 'Varies',
    },
  },

  // Task Form
  taskForm: {
    placeholder: 'Enter task content...',
    addToInbox: 'Add to Inbox',
    project: 'Project',
    projectPlaceholder: 'e.g., FocusFlow, Website Redesign',
    mood: 'Mood',
    moodPlaceholder: 'Select mood/energy',
    contextPlaceholder: 'e.g., home, office',
    moodOptions: {
      challenging: '🔥 Challenging',
      focused: '⚡ Focused',
      calm: '😌 Calm',
      motivated: '💪 Motivated',
      creative: '🎨 Creative',
      routine: '📋 Routine',
    },
    tags: 'Tags',
    tagsPlaceholder: 'Separate with commas',
    dueDate: 'Due Date',
    thresholdDate: 'Defer Until',
    thresholdHint: 'Task hidden until this date',
    recurrence: 'Recurrence',
    noRecurrence: 'No Recurrence',
    daily: 'Daily',
    every2Days: 'Every 2 Days',
    every3Days: 'Every 3 Days',
    weekly: 'Weekly',
    biweekly: 'Biweekly',
    monthly: 'Monthly',
    keyboardHint: 'Press Ctrl+Enter to add quickly',
    syntaxHint: 'Syntax: !A-F +project @context #tag ~date thr:defer',
  },

  // Inbox Panel (Idea Pool)
  inbox: {
    title: 'Idea Pool',
    subtitle: 'Capture ideas, sort later',
    hint: 'Click tasks to edit and classify',
    dragHint: 'Click to edit and move to A/B/C/D zones',
    moveTo: 'Move to',
    empty: 'Idea pool is empty',
    emptyHint: 'Add tasks using the input above',
    completed: 'Completed',
    aging: 'In pool for {days} days',
    agingWarning: 'Consider sorting soon',
  },

  // Task
  task: {
    add: 'Add Task',
    addPlaceholder: 'Add task (+project @context #tag !A-F ~date)',
    edit: 'Edit Task',
    delete: 'Delete Task',
    complete: 'Complete',
    uncomplete: 'Uncomplete',
    archive: 'Archive',
    restore: 'Restore',
    moveToTrash: 'Move to Trash',
    emptyTrash: 'Empty Trash',
    noTasks: 'No tasks',
    dueToday: 'Due Today',
    dueThisWeek: 'Due This Week',
    overdue: 'Overdue',
    futureTask: 'Deferred Task',
    thresholdNotReached: 'Deferred',
    startFocus: 'Start Focus',
    pomodoroProgress: '{completed}/{estimated} pomodoros',
  },

  // Pomodoro
  pomodoro: {
    title: 'Pomodoro',
    start: 'Start',
    pause: 'Pause',
    resume: 'Resume',
    stop: 'Stop',
    skip: 'Skip',
    work: 'Focus',
    shortBreak: 'Short Break',
    longBreak: 'Long Break',
    ready: 'Ready',
    completed: 'Focus Complete!',
    breakEnd: 'Break Ended!',
    todayCount: "Today's Pomodoros",
    selectTask: 'Select a task to start',
    immersiveMode: 'Immersive Mode',
    exitImmersive: 'Exit Immersive',
  },

  // Unit/Review
  unit: {
    current: 'Current Period',
    week: 'Week {n}',
    reviewDay: 'Review Day',
    reflection: 'Weekly Review',
    nextFocus: 'Next Week Focus',
    biDaily: 'Bi-daily',
    prev: 'Previous Period',
    next: 'Next Period',
    stats: {
      planned: 'Planned',
      completed: 'Completed',
      pomodoros: 'Pomodoros',
    },
  },

  // Review Panel
  review: {
    title: 'Period Review',
    createReview: 'Create Review',
    reflection: 'Period Reflection',
    reflectionPlaceholder: 'Review the work of this period. What went well? What needs improvement?',
    nextFocus: 'Next Period Focus',
    nextFocusPlaceholder: 'What is the core goal for the next period?',
    saveReview: 'Save Review',
    completionRate: 'Completion Rate',
    pomodorosTotal: 'Total Pomodoros',
    noReviews: 'No reviews yet',
    noReviewsHint: 'Create a review at the end of each period to track your progress',
    redundancyNote: 'Higher is not always better',
    redundancyHint: "100% completion rate indicates insufficient challenge - consider increasing difficulty",
    healthyRange: 'Healthy range: 70-85%',
  },

  // Filter
  filter: {
    all: 'All',
    active: 'Active',
    completed: 'Completed',
    today: 'Today',
    thisWeek: 'This Week',
    overdue: 'Overdue',
    future: 'Deferred',
    search: 'Search tasks...',
    searchResults: 'Search Results',
    noResults: 'No matching tasks found',
    clearFilter: 'Clear Filter',
  },

  // Settings
  settings: {
    title: 'Settings',
    appearance: 'Appearance',
    theme: 'Theme',
    themeDesc: 'Choose the app appearance theme',
    themeLight: 'Light',
    themeDark: 'Dark',
    themeSystem: 'System',
    language: 'Language',
    languageDesc: 'Choose the interface language',
    pomodoro: {
      title: 'Pomodoro Settings',
      workDuration: 'Focus Duration',
      shortBreak: 'Short Break',
      longBreak: 'Long Break',
    },
    data: {
      title: 'Data Management',
      backup: 'Backup Data',
      restore: 'Restore Data',
      export: 'Export Data',
      import: 'Import Data',
      clear: 'Clear All Data',
      autoBackup: 'Auto Backup',
    },
    autoArchive: 'Auto Archive Days',
    autoArchiveDesc: 'Days until completed tasks are auto-archived',
    eZoneAging: 'Inbox Aging Alert',
    eZoneAgingDesc: 'Days until inbox tasks show aging warning',
    minutes: 'min',
    days: 'days',
    methodology: {
      title: 'Methodology Guide',
      subtitle: '1-2-3-5 Bi-daily Cycle Model',
      description: 'Task management system based on Ivy Lee Method and GTD theory',
      model: {
        title: 'Quota Model',
        total: 'Per cycle total: 11 tasks (~5.5/day)',
        ivyLee: 'Aligns with Ivy Lee Method of 6 tasks per day',
        better: 'Better than traditional 1-3-5 rule (9 tasks/day)',
      },
      priorities: {
        title: 'Priority Levels',
        A: 'A (Core Challenge): 1 per cycle, 2+ hours deep focus, high-value tasks',
        B: 'B (Key Progress): 2 per cycle, project milestones, 45-90 min',
        C: 'C (Steady Progress): 3 per cycle, daily work tasks, 20-45 min',
        D: 'D (Ad-hoc Tasks): 4 per cycle, unplanned ad-hoc tasks',
        E: 'E (Quick Action): 5 per cycle, under 15 minutes',
        F: 'F (Idea Pool): Unlimited, ideas and tasks to be sorted',
      },
      highlander: {
        title: 'Highlander Rule',
        rule: 'Only one A-level task at a time',
        reason: 'Ensures the most important task gets adequate focus and resources',
      },
      biDaily: {
        title: 'Bi-daily Cycle',
        pattern: 'Sun-Mon, Tue-Wed, Thu-Fri as work units',
        review: 'Saturday as review day',
        benefit: 'More flexible than daily, more compact than weekly planning',
      },
      redundancy: {
        title: 'Redundancy & Robustness',
        note: '100% completion is not the optimal goal',
        reason: 'If you always complete everything, challenges are set too low',
        target: 'Aim for 70-85% completion rate, leaving room for flexibility',
      },
    },
  },

  // Sidebar
  sidebar: {
    todayCompleted: 'Today Completed',
    allTasks: 'All Tasks',
    projects: 'Projects',
    contexts: 'Contexts',
    tags: 'Tags',
    dueDates: 'Due Dates',
    recurring: 'Recurring',
    dueToday: 'Today',
    dueThisWeek: 'This Week',
    overdue: 'Overdue',
    dailyRecurring: 'Daily',
    weeklyRecurring: 'Weekly',
    noProjects: 'No projects',
    noContexts: 'No contexts',
    collapse: 'Collapse sidebar',
    showAll: 'Show all',
  },

  // Zone
  zone: {
    full: 'Quota full',
    dropHere: 'Drop tasks here',
    empty: 'No tasks',
    quotaInfo: '{current}/{max}',
  },

  // View modes
  view: {
    zones: 'Zones',
    kanban: 'Kanban',
    list: 'List',
    hybrid: 'Hybrid',
  },

  // Actions
  action: {
    save: 'Save',
    cancel: 'Cancel',
    confirm: 'Confirm',
    delete: 'Delete',
    edit: 'Edit',
    close: 'Close',
    add: 'Add',
    done: 'Done',
    expand: 'Expand',
    collapse: 'Collapse',
  },

  // Messages
  message: {
    saved: 'Saved',
    deleted: 'Deleted',
    archived: 'Archived',
    restored: 'Restored',
    error: 'Operation failed',
    quotaExceeded: '{priority} zone quota exceeded',
    highlanderRule: 'Only one A-priority task allowed. Previous A demoted to B.',
    pomodoroComplete: 'Pomodoro complete! Take a break.',
    breakComplete: 'Break complete. Ready for next session.',
    dataLoaded: 'Data loaded',
    dataExported: 'Data exported',
    dataImported: 'Data imported',
    backupCreated: 'Backup created',
    taskAdded: 'Task added to inbox',
    taskMoved: 'Task moved to {priority} zone',
  },

  // Date/Time
  date: {
    today: 'Today',
    tomorrow: 'Tomorrow',
    yesterday: 'Yesterday',
    thisWeek: 'This Week',
    lastWeek: 'Last Week',
    nextWeek: 'Next Week',
    format: 'MM/DD/YYYY',
    daysAgo: '{n} days ago',
    daysLater: 'In {n} days',
  },

  // Syntax hints
  syntax: {
    title: 'Input Syntax',
    project: 'project',
    context: 'context',
    tag: 'tag',
    priority: 'priority',
    dueDate: 'due date',
    threshold: 'defer',
    recurrence: 'repeat',
    pomodoro: 'pomodoros',
  },

  // Errors
  error: {
    quotaExceeded: 'Priority quota limit reached',
    taskNotFound: 'Task not found',
    saveFailed: 'Save failed',
    externalChangeIgnored: 'External data change detected but ignored due to active session. Please save and reload manually to avoid conflicts.',
  },
};
