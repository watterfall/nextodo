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
    settings: 'Settings',
  },

  // Priorities
  priority: {
    A: 'Core Challenge',
    B: 'Key Progress',
    C: 'Standard Task',
    D: 'Quick Action',
    E: 'Inbox',
    description: {
      A: 'Deep work, 2+ hours focus',
      B: 'Project milestones',
      C: 'Daily work tasks',
      D: 'Under 15 minutes',
      E: 'Ideas, notes, no deadline',
    },
  },

  // Task
  task: {
    add: 'Add Task',
    addPlaceholder: 'Add task (+project @context #tag !A-E ~date 🍅count)',
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
    futureTask: 'Future Task',
    thresholdNotReached: 'Not yet started',
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
    stats: {
      planned: 'Planned',
      completed: 'Completed',
      pomodoros: 'Pomodoros',
    },
  },

  // Filter
  filter: {
    all: 'All',
    active: 'Active',
    completed: 'Completed',
    today: 'Today',
    thisWeek: 'This Week',
    overdue: 'Overdue',
    future: 'Future',
    search: 'Search tasks...',
    searchResults: 'Search Results',
    noResults: 'No matching tasks found',
    clearFilter: 'Clear Filter',
  },

  // Settings
  settings: {
    title: 'Settings',
    theme: 'Theme',
    themeLight: 'Light',
    themeDark: 'Dark',
    themeSystem: 'System',
    language: 'Language',
    pomodoro: {
      title: 'Pomodoro Settings',
      workDuration: 'Focus Duration (min)',
      shortBreak: 'Short Break (min)',
      longBreak: 'Long Break (min)',
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
    eZoneAging: 'E-Zone Aging Alert Days',
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
  },

  // Syntax hints
  syntax: {
    title: 'Input Syntax',
    project: '+project',
    context: '@context',
    tag: '#tag',
    priority: '!A-E priority',
    dueDate: '~date due',
    threshold: 'thr:date start',
    recurrence: 'rec:pattern repeat',
    pomodoro: '🍅count pomodoros',
  },
};
