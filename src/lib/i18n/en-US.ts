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

  // Task Form
  taskForm: {
    placeholder: 'Enter task content...',
    addToInbox: 'Add to Inbox',
    project: 'Project',
    projectPlaceholder: 'e.g., Work, Study',
    context: 'Context',
    contextPlaceholder: 'e.g., Office, Home',
    tags: 'Tags',
    tagsPlaceholder: 'Separate with commas',
    dueDate: 'Due Date',
    thresholdDate: 'Start Date',
    estimatedPomodoros: 'Estimated Pomodoros',
    recurrence: 'Recurrence',
    noRecurrence: 'No Recurrence',
    daily: 'Daily',
    every2Days: 'Every 2 Days',
    every3Days: 'Every 3 Days',
    weekly: 'Weekly',
    biweekly: 'Biweekly',
    monthly: 'Monthly',
    keyboardHint: 'Press Ctrl+Enter to add quickly',
  },

  // Inbox Panel
  inbox: {
    title: 'Inbox',
    hint: 'Drag or click buttons to move tasks to priorities',
    moveTo: 'Move to',
    empty: 'Inbox is empty',
    emptyHint: 'Use the form above to add new tasks',
    completed: 'Completed',
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
  },

  // Sidebar
  sidebar: {
    todayCompleted: 'Today Completed',
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
  },

  // Zone
  zone: {
    full: 'Quota full',
    dropHere: 'Drop tasks here',
    empty: 'No tasks',
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
    taskAdded: 'Task added to inbox',
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
