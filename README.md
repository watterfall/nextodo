# FocusFlow

[English](#english) | [中文](#中文)

---

## English

### Overview

**FocusFlow** is a focus-first task management desktop application that combines GTD (Getting Things Done) methodology with the Pomodoro technique. Built with modern technologies for cross-platform support.

### Features

- **5-Tier Priority System (A-E)** - With quotas: A=1, B=2, C=3, D=5, E=∞
- **Highlander Rule** - Only one A-priority task at a time
- **Bi-Daily Work Units** - Sun-Mon, Tue-Wed, Thu-Fri cycles with Saturday reviews
- **Pomodoro Timer** - Integrated focus sessions with break management
- **Immersive Mode** - Full-screen distraction-free pomodoro sessions
- **Recurring Tasks** - Daily, weekly, monthly patterns with threshold dates
- **Smart Parsing** - Quick task input with intuitive syntax
- **Multiple Views** - Zone view and Kanban board
- **Theme Support** - Dark, light, and system themes
- **Data Separation** - Hot/cold data architecture for performance
- **Bilingual** - Chinese and English interface
- **Cross-Platform** - Windows, macOS, and Linux support

### Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | Svelte 5 (with runes) | ^5.16.0 |
| Language | TypeScript | ^5.7.2 |
| Build Tool | Vite | ^6.0.5 |
| Desktop Framework | Tauri 2 | ^2.1.0 |
| Backend | Rust (2021 edition) | - |

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
| `rec:pattern` | Recurrence pattern | `rec:1d`, `rec:1w`, `rec:mon,wed,fri` |
| `🍅N` or `pN` | Estimated pomodoros | `🍅4`, `p3` |

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
- `active.json` - Active tasks, settings, reviews, trash
- `archive.json` - Completed/archived tasks
- `pomodoro_history.json` - Pomodoro session records

### License

MIT

---

## 中文

### 概述

**FocusFlow** 是一款专注优先的任务管理桌面应用，将 GTD（Getting Things Done）方法论与番茄工作法相结合。采用现代技术栈，支持跨平台运行。

### 特性

- **五级优先级系统 (A-E)** - 配额限制：A=1, B=2, C=3, D=5, E=无限
- **高地人规则** - 同时只能有一个 A 级任务
- **双日工作单元** - 周日-周一、周二-周三、周四-周五循环，周六回顾
- **番茄钟计时器** - 集成专注时段与休息管理
- **沉浸模式** - 全屏无干扰番茄专注
- **循环任务** - 支持每日、每周、每月模式与阈值日期
- **智能解析** - 直观的快速输入语法
- **多视图** - 区域视图和看板视图
- **主题支持** - 深色、浅色和跟随系统
- **数据分离** - 冷热数据架构提升性能
- **双语界面** - 中文和英文界面
- **跨平台** - 支持 Windows、macOS 和 Linux

### 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 前端 | Svelte 5（使用 runes） | ^5.16.0 |
| 语言 | TypeScript | ^5.7.2 |
| 构建工具 | Vite | ^6.0.5 |
| 桌面框架 | Tauri 2 | ^2.1.0 |
| 后端 | Rust（2021 版） | - |

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
| `rec:模式` | 循环模式 | `rec:1d`, `rec:1w`, `rec:mon,wed,fri` |
| `🍅N` 或 `pN` | 预估番茄数 | `🍅4`, `p3` |

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
- `active.json` - 活跃任务、设置、回顾、回收站
- `archive.json` - 已完成/已归档任务
- `pomodoro_history.json` - 番茄时段记录

### 开源协议

MIT
