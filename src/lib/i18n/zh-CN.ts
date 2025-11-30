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
    theme: '主题',
    themeLight: '浅色',
    themeDark: '深色',
    themeSystem: '跟随系统',
    language: '语言',
    pomodoro: {
      title: '番茄钟设置',
      workDuration: '专注时长 (分钟)',
      shortBreak: '短休息 (分钟)',
      longBreak: '长休息 (分钟)',
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
    eZoneAging: 'E区老化提醒天数',
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
