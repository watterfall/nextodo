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
- **Recurring Tasks** - Daily, weekly, monthly patterns with threshold dates
- **Smart Parsing** - Quick task input with `+project @context #tag due:YYYY-MM-DD` syntax
- **Data Separation** - Hot/cold data architecture for performance
- **Cross-Platform** - Windows, macOS, and Linux support

### Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Svelte 5 (with runes) |
| Language | TypeScript 5.7 |
| Build Tool | Vite 6 |
| Desktop Framework | Tauri 2 |
| Backend | Rust |

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
(A) Complete project report +work @office due:2025-01-15 est:4
```

| Syntax | Description |
|--------|-------------|
| `(A-E)` | Priority level |
| `+project` | Project tag |
| `@context` | Context tag |
| `#tag` | Custom tag |
| `due:YYYY-MM-DD` | Due date |
| `t:YYYY-MM-DD` | Threshold date (hidden until) |
| `rec:1d\|1w\|1m` | Recurrence pattern |
| `est:N` | Estimated pomodoros |

### Data Storage

Data is stored in the app data directory:
- **Windows**: `%APPDATA%\com.focusflow.app`
- **macOS**: `~/Library/Application Support/com.focusflow.app`
- **Linux**: `~/.local/share/com.focusflow.app`

Files:
- `active.json` - Active tasks, settings, trash
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
- **循环任务** - 支持每日、每周、每月模式与阈值日期
- **智能解析** - 快速输入 `+项目 @场景 #标签 due:YYYY-MM-DD` 语法
- **数据分离** - 冷热数据架构提升性能
- **跨平台** - 支持 Windows、macOS 和 Linux

### 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Svelte 5（使用 runes） |
| 语言 | TypeScript 5.7 |
| 构建工具 | Vite 6 |
| 桌面框架 | Tauri 2 |
| 后端 | Rust |

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
(A) 完成项目报告 +工作 @办公室 due:2025-01-15 est:4
```

| 语法 | 说明 |
|------|------|
| `(A-E)` | 优先级 |
| `+项目` | 项目标签 |
| `@场景` | 场景标签 |
| `#标签` | 自定义标签 |
| `due:YYYY-MM-DD` | 截止日期 |
| `t:YYYY-MM-DD` | 阈值日期（在此之前隐藏） |
| `rec:1d\|1w\|1m` | 循环模式 |
| `est:N` | 预估番茄数 |

### 数据存储

数据存储在应用数据目录：
- **Windows**: `%APPDATA%\com.focusflow.app`
- **macOS**: `~/Library/Application Support/com.focusflow.app`
- **Linux**: `~/.local/share/com.focusflow.app`

文件：
- `active.json` - 活跃任务、设置、回收站
- `archive.json` - 已完成/已归档任务
- `pomodoro_history.json` - 番茄时段记录

### 开源协议

MIT
