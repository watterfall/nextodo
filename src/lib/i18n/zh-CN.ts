export default {
  // App
  app: {
    name: 'FocusFlow',
    tagline: '专注力优先的任务管理器',
    loading: '加载中...',
  },

  // Navigation
  nav: {
    today: '今日',
    inbox: '收集箱',
    projects: '项目',
    contexts: '上下文',
    tags: '标签',
    calendar: '日历',
    archive: '归档',
    settings: '设置',
  },

  // Priorities
  priority: {
    A: '核心挑战',
    B: '重要推进',
    C: '标准任务',
    D: '快速处理',
    E: '收集箱',
    description: {
      A: '深度工作，需 2+ 小时专注',
      B: '项目关键节点',
      C: '日常工作任务',
      D: '15分钟内可完成',
      E: '备忘、想法、无期限',
    },
  },

  // Task Form
  taskForm: {
    placeholder: '输入任务内容...',
    addToInbox: '添加到收集箱',
    project: '项目',
    projectPlaceholder: '例如: 工作、学习',
    context: '上下文',
    contextPlaceholder: '例如: 办公室、家里',
    tags: '标签',
    tagsPlaceholder: '多个标签用逗号分隔',
    dueDate: '截止日期',
    thresholdDate: '开始日期',
    estimatedPomodoros: '预估番茄数',
    recurrence: '重复',
    noRecurrence: '不重复',
    daily: '每天',
    every2Days: '每2天',
    every3Days: '每3天',
    weekly: '每周',
    biweekly: '每两周',
    monthly: '每月',
    keyboardHint: '按 Ctrl+Enter 快速添加',
  },

  // Inbox Panel
  inbox: {
    title: '收集箱',
    hint: '拖拽或点击按钮将任务移到对应优先级',
    moveTo: '移动到',
    empty: '收集箱已清空',
    emptyHint: '使用上方表单添加新任务',
    completed: '已完成',
  },

  // Task
  task: {
    add: '添加任务',
    addPlaceholder: '快速添加任务 (+项目 @上下文 #标签 !A-E ~日期 🍅数量)',
    edit: '编辑任务',
    delete: '删除任务',
    complete: '完成任务',
    uncomplete: '取消完成',
    archive: '归档',
    restore: '恢复',
    moveToTrash: '移至垃圾箱',
    emptyTrash: '清空垃圾箱',
    noTasks: '暂无任务',
    dueToday: '今日截止',
    dueThisWeek: '本周截止',
    overdue: '已逾期',
    futureTask: '未来任务',
    thresholdNotReached: '未到开始日期',
  },

  // Pomodoro
  pomodoro: {
    title: '番茄钟',
    start: '开始',
    pause: '暂停',
    resume: '继续',
    stop: '停止',
    skip: '跳过',
    work: '专注中',
    shortBreak: '短休息',
    longBreak: '长休息',
    ready: '就绪',
    completed: '专注完成!',
    breakEnd: '休息结束!',
    todayCount: '今日番茄',
    selectTask: '选择任务开始专注',
    immersiveMode: '沉浸模式',
    exitImmersive: '退出沉浸',
  },

  // Unit/Review
  unit: {
    current: '当前周期',
    week: '第 {n} 周',
    reviewDay: '复盘日',
    reflection: '本周回顾',
    nextFocus: '下周重点',
    stats: {
      planned: '计划',
      completed: '完成',
      pomodoros: '番茄数',
    },
  },

  // Review Panel
  review: {
    title: '周期复盘',
    createReview: '创建复盘',
    reflection: '本周期反思',
    reflectionPlaceholder: '回顾本周期的工作情况，有什么做得好的？有什么需要改进的？',
    nextFocus: '下周期重点',
    nextFocusPlaceholder: '下个周期的核心目标是什么？',
    saveReview: '保存复盘',
    completionRate: '完成率',
    pomodorosTotal: '番茄总数',
    noReviews: '暂无复盘记录',
    noReviewsHint: '在每个周期结束时创建复盘，追踪你的进步',
  },

  // Filter
  filter: {
    all: '全部',
    active: '进行中',
    completed: '已完成',
    today: '今天',
    thisWeek: '本周',
    overdue: '逾期',
    future: '未来',
    search: '搜索任务...',
    searchResults: '搜索结果',
    noResults: '未找到匹配的任务',
    clearFilter: '清除筛选',
  },

  // Settings
  settings: {
    title: '设置',
    appearance: '外观',
    theme: '主题',
    themeDesc: '选择应用的外观主题',
    themeLight: '浅色',
    themeDark: '深色',
    themeSystem: '系统',
    language: '语言',
    languageDesc: '选择界面显示语言',
    pomodoro: {
      title: '番茄钟设置',
      workDuration: '专注时长',
      shortBreak: '短休息时长',
      longBreak: '长休息时长',
    },
    data: {
      title: '数据管理',
      backup: '备份数据',
      restore: '恢复数据',
      export: '导出数据',
      import: '导入数据',
      clear: '清除所有数据',
      autoBackup: '自动备份',
    },
    autoArchive: '自动归档天数',
    autoArchiveDesc: '已完成任务在多少天后自动归档',
    eZoneAging: '收集箱老化提醒',
    eZoneAgingDesc: '收集箱任务超过多少天提示处理',
    minutes: '分钟',
    days: '天',
  },

  // Sidebar
  sidebar: {
    todayCompleted: '今日完成',
    projects: '项目',
    contexts: '上下文',
    tags: '标签',
    dueDates: '截止日期',
    recurring: '重复任务',
    dueToday: '今天',
    dueThisWeek: '本周',
    overdue: '已过期',
    dailyRecurring: '每日',
    weeklyRecurring: '每周',
    noProjects: '暂无项目',
    noContexts: '暂无上下文',
    collapse: '收起侧边栏',
  },

  // Zone
  zone: {
    full: '配额已满',
    dropHere: '拖拽任务到这里',
    empty: '暂无任务',
  },

  // Actions
  action: {
    save: '保存',
    cancel: '取消',
    confirm: '确认',
    delete: '删除',
    edit: '编辑',
    close: '关闭',
    add: '添加',
    done: '完成',
  },

  // Messages
  message: {
    saved: '已保存',
    deleted: '已删除',
    archived: '已归档',
    restored: '已恢复',
    error: '操作失败',
    quotaExceeded: '已达到 {priority} 区配额上限',
    highlanderRule: '只能有一个 A 级任务，已将原任务降级为 B',
    pomodoroComplete: '完成了一个番茄钟，休息一下吧',
    breakComplete: '休息结束，准备开始下一个番茄钟',
    dataLoaded: '数据已加载',
    dataExported: '数据已导出',
    dataImported: '数据已导入',
    backupCreated: '备份已创建',
    taskAdded: '任务已添加到收集箱',
  },

  // Date/Time
  date: {
    today: '今天',
    tomorrow: '明天',
    yesterday: '昨天',
    thisWeek: '本周',
    lastWeek: '上周',
    nextWeek: '下周',
    format: 'YYYY-MM-DD',
  },

  // Syntax hints
  syntax: {
    title: '输入语法',
    project: '+项目',
    context: '@上下文',
    tag: '#标签',
    priority: '!A-E 优先级',
    dueDate: '~日期 截止日',
    threshold: 'thr:日期 开始日',
    recurrence: 'rec:模式 重复',
    pomodoro: '🍅数量 番茄数',
  },
};
