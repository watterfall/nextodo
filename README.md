# FocusFlow

[English](#english) | [中文](#中文)

---

## English

### Overview

**FocusFlow** is a focus-first task management desktop application that combines GTD (Getting Things Done) methodology with the Pomodoro technique. Built with modern technologies for cross-platform support.

It works **alongside [sleek](https://github.com/ransome1/sleek)**, or any other
todo.txt editor. Your backlog stays in a plain `todo.txt`; FocusFlow is the
surface where you pick the handful of things you will actually do in the next
two days. Completing one marks it `x` in that same file.

### Features

- **5-Tier Priority System (A-E)** - With quotas: A=1, B=2, C=3, D=4, E=5. Fifteen tasks per unit, and nothing more fits
- **Shared todo.txt candidate pool** - Pull work out of the file sleek edits; completing writes `x` back to the same line
- **Proactive vs reactive** - Mark whether you chose the work or were handed it (`@主` / `@被`), and see the ratio at review time
- **Highlander Rule** - Only one A-priority task at a time; a second one unseats the first rather than being refused
- **Bi-Daily Work Units** - Mon-Tue, Wed-Thu, Fri-Sat cycles with Sunday reviews
- **Flow metrics, not scoreboards** - How much is open, how long the oldest unfinished task has waited, how long things actually take. No targets, because a target is what turns a measure into something to perform
- **If-then start cues** - `when:after I sit down and open the laptop`. A due date is a time trigger and vanishes when the schedule slips; a situational cue still shows up
- **Pomodoro Timer** - Integrated focus sessions, with the block length set per tier (25 minutes was the inventor's kitchen timer, not a finding)
- **Immersive Mode** - Full-screen distraction-free pomodoro sessions
- **Recurring Tasks** - Daily, weekly, monthly patterns with threshold dates
- **Smart Parsing** - Quick task input with intuitive syntax
- **Multiple Views** - Kanban, List, and Calendar views
- **Drag & Drop** - Intuitive task reordering and scheduling
- **No scoring** - No XP, no levels, no badges, no streaks. A per-completion score pays you for finishing many small things, which is what the quota exists to prevent; a streak counter turns a missed day into a reason to quit
- **Theme Support** - Dark, light, and system themes
- **Data Separation** - Hot/cold data architecture for performance
- **Bilingual** - Chinese and English interface
- **Cross-Platform** - Windows, macOS, and Linux support

### Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | Svelte 5 (with runes) | ^5.56.4 |
| Language | TypeScript | ^5.9.3 |
| Build Tool | Vite (Rolldown) | ^8.1.3 |
| Desktop Framework | Tauri 2 | ^2.11.4 |
| Backend | Rust (2021 edition) | - |
| Animation | CSS + Svelte transitions (no library) | - |
| Drag & Drop | Native HTML5 DnD (no library) | - |
| Testing | Vitest | ^4.1.9 |

### Quick Start

#### Prerequisites

- Node.js 18+
- Rust (latest stable)
- Platform-specific dependencies for [Tauri](https://tauri.app/start/prerequisites/)

#### Installation

```bash
# Clone the repository
git clone https://github.com/watterfall/nextodo.git
cd nextodo

# Install dependencies
npm install

# Start development server (frontend only)
npm run dev

# Start full Tauri development (recommended)
npm run tauri:dev
```

#### Build for Production

```bash
# Build the desktop application
npm run tauri:build
```

### Testing

```bash
# Run unit tests (Vitest)
npm test

# Type-check Svelte + TypeScript
npm run check
```

### Task Input Syntax

```
Complete project report !A +work @office ~2025-01-15 🍅4
```

| Syntax | Description | Example |
|--------|-------------|---------|
| `!A-E` | Priority level | `!A`, `!B`, `!C`, `!D`, `!E` |
| `+name` | Project tag | `+work`, `+personal` |
| `@name` | Context tag | `@office`, `@home` |
| `#name` | Custom tag | `#urgent`, `#review` |
| `~date` | Due date | `~2025-01-15`, `~tomorrow`, `~+3d` |
| `thr:date` | Threshold date (hidden until) | `thr:2025-01-10`, `thr:+7d` |
| `rec:pattern` | Recurrence, todo.txt grammar | `rec:1d`, `rec:+1m`, `rec:b`, `rec:mon,wed,fri` |
| `🍅N` or `pN` | Estimated pomodoros | `🍅4`, `p3` |
| `when:<cue>` | Situational start cue — takes the rest of the line, so put it last | `when:after I sit down and open the laptop` |

**Recurrence patterns:**
- `1d`, `2d`, `3d` - Every 1/2/3 days
- `1w`, `2w` - Every 1/2 weeks
- `1m`, `3m` - Monthly/quarterly
- `mon,wed,fri` - Specific weekdays
- `1m@15` - Monthly on 15th
- `1m@last` - Monthly on last day

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘/Ctrl + K` | Open search |
| `⌘/Ctrl + N` | New task |
| `Space` | Start/pause pomodoro |
| `Escape` | Close modal/search |

### Data Storage

Data is stored in the app data directory:
- **Windows**: `%APPDATA%\com.focusflow.app`
- **macOS**: `~/Library/Application Support/com.focusflow.app`
- **Linux**: `~/.local/share/com.focusflow.app`

Files:
- `active.json` - Active tasks, settings, reviews
- `archive.json` - Completed/archived tasks
- `pomodoro_history.json` - Pomodoro session records

### License

MIT

---

## 中文

### 概述

**FocusFlow** 是一款专注优先的任务管理桌面应用，将 GTD（Getting Things Done）方法论与番茄工作法相结合。采用现代技术栈，支持跨平台运行。

它和 **[sleek](https://github.com/ransome1/sleek)**（或任何 todo.txt 编辑器）配合使用：
待办清单留在纯文本 `todo.txt` 里，FocusFlow 只负责「未来两天真正要做的那几件事」。
在这里完成一条，会在同一个文件的同一行前面写上 `x`。

### 特性

- **五级优先级系统 (A-E)** - 配额限制：A=1, B=2, C=3, D=4, E=5。一个单元最多 15 条，满了就是满了
- **共享 todo.txt 候选池** - 从 sleek 编辑的那个文件里拉取；完成时把 `x` 写回同一行
- **主动 / 被动** - 标记这件事是自己规划的还是别人交办的（`@主` / `@被`），复盘时看比例
- **高地人规则** - 同时只能有一个 A 级任务；再加一个会挤掉旧的，而不是拒绝
- **双日工作单元** - 周一-周二、周三-周四、周五-周六循环，周日复盘
- **流动指标，不是计分板** - 在办多少、最老的未完成项等了多久、事情实际要多久。三个数都不设目标值，因为一设目标它就变成了可以表演的东西
- **启动线索（if-then）** - `when:明早坐下打开电脑后`。截止日是时间触发，日程一滑线索就没了；情境线索照样会出现
- **番茄钟计时器** - 集成专注时段与休息管理，每个优先级档位可设不同时长（25 分钟来自发明者的厨房计时器，不是研究结论）
- **沉浸模式** - 全屏无干扰番茄专注
- **循环任务** - 支持每日、每周、每月模式与阈值日期
- **智能解析** - 直观的快速输入语法
- **多视图** - 看板、列表、日历视图
- **拖拽操作** - 直观的任务排序和日程安排
- **不计分** - 没有经验值、等级、徽章、连续打卡。计分奖励「完成得多」，而配额限制「承诺得少」，两者方向相反；连续打卡则把漏一天变成放弃的理由
- **主题支持** - 深色、浅色和跟随系统
- **数据分离** - 冷热数据架构提升性能
- **双语界面** - 中文和英文界面
- **跨平台** - 支持 Windows、macOS 和 Linux

### 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 前端 | Svelte 5（使用 runes） | ^5.56.4 |
| 语言 | TypeScript | ^5.9.3 |
| 构建工具 | Vite（Rolldown） | ^8.1.3 |
| 桌面框架 | Tauri 2 | ^2.11.4 |
| 后端 | Rust（2021 版） | - |
| 动画 | CSS + Svelte 过渡（无第三方库） | - |
| 拖拽 | 原生 HTML5 拖放（无第三方库） | - |
| 测试 | Vitest | ^4.1.9 |

### 快速开始

#### 前置要求

- Node.js 18+
- Rust（最新稳定版）
- [Tauri](https://tauri.app/start/prerequisites/) 的平台特定依赖

#### 安装

```bash
# 克隆仓库
git clone https://github.com/watterfall/nextodo.git
cd nextodo

# 安装依赖
npm install

# 启动开发服务器（仅前端）
npm run dev

# 启动完整 Tauri 开发环境（推荐）
npm run tauri:dev
```

#### 生产构建

```bash
# 构建桌面应用
npm run tauri:build
```

### 测试

```bash
# 运行单元测试（Vitest）
npm test

# 类型检查 Svelte + TypeScript
npm run check
```

### 任务输入语法

```
完成项目报告 !A +工作 @办公室 ~2025-01-15 🍅4
```

| 语法 | 说明 | 示例 |
|------|------|------|
| `!A-E` | 优先级 | `!A`, `!B`, `!C`, `!D`, `!E` |
| `+名称` | 项目标签 | `+工作`, `+个人` |
| `@名称` | 场景标签 | `@办公室`, `@家` |
| `#名称` | 自定义标签 | `#紧急`, `#待审` |
| `~日期` | 截止日期 | `~2025-01-15`, `~tomorrow`, `~+3d` |
| `thr:日期` | 阈值日期（在此之前隐藏） | `thr:2025-01-10`, `thr:+7d` |
| `rec:模式` | 循环，沿用 todo.txt 语法 | `rec:1d`, `rec:+1m`, `rec:b`, `rec:mon,wed,fri` |
| `🍅N` 或 `pN` | 预估番茄数 | `🍅4`, `p3` |
| `when:<线索>` | 启动线索，吃到行尾，所以放最后 | `when:明早坐下打开电脑后` |

**循环模式：**
- `1d`, `2d`, `3d` - 每 1/2/3 天
- `1w`, `2w` - 每 1/2 周
- `1m`, `3m` - 每月/每季度
- `mon,wed,fri` - 指定星期几
- `1m@15` - 每月 15 日
- `1m@last` - 每月最后一天

### 快捷键

| 快捷键 | 功能 |
|--------|------|
| `⌘/Ctrl + K` | 打开搜索 |
| `⌘/Ctrl + N` | 新建任务 |
| `空格` | 开始/暂停番茄钟 |
| `Escape` | 关闭弹窗/搜索 |

### 数据存储

数据存储在应用数据目录：
- **Windows**: `%APPDATA%\com.focusflow.app`
- **macOS**: `~/Library/Application Support/com.focusflow.app`
- **Linux**: `~/.local/share/com.focusflow.app`

文件：
- `active.json` - 活跃任务、设置、回顾、成就数据
- `archive.json` - 已完成/已归档任务
- `pomodoro_history.json` - 番茄时段记录

### 开源协议

MIT
