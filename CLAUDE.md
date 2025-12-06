# CLAUDE.md - FocusFlow Codebase Guide

## Project Overview

**FocusFlow** is a focus-first task management desktop application that combines GTD (Getting Things Done) methodology with the Pomodoro technique. Built with Tauri, Svelte 5, and Rust, it provides cross-platform support with a 5-tier priority system, bi-daily work units, and periodic reviews.

**Version:** 2.0.0
**Data Version:** 4.0
**License:** MIT

## Architecture

### Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | Svelte 5 (with runes) | ^5.16.0 |
| Language | TypeScript | ^5.7.2 |
| Build Tool | Vite | ^6.0.5 |
| Desktop Framework | Tauri 2 | ^2.1.0 |
| Backend | Rust (2021 edition) | - |
| Animation | Motion | ^12.23.24 |
| Drag & Drop | svelte-dnd-action | ^0.9.67 |

### Directory Structure

```
/
├── src/                          # Frontend (Svelte/TypeScript)
│   ├── lib/
│   │   ├── components/           # Svelte components (24 files)
│   │   ├── stores/               # Svelte 5 runes state management (6 stores)
│   │   ├── utils/                # Business logic utilities (6 files)
│   │   ├── types/                # TypeScript type definitions
│   │   └── i18n/                 # Internationalization (4 files)
│   ├── App.svelte                # Root component
│   ├── app.css                   # Global styles
│   └── main.ts                   # Application entry point
├── src-tauri/                    # Backend (Rust)
│   ├── src/
│   │   ├── main.rs              # Tauri setup and entry
│   │   ├── commands.rs          # IPC command handlers
│   │   └── watcher.rs           # File system watcher
│   ├── capabilities/
│   │   └── default.json         # Tauri permission capabilities
│   ├── Cargo.toml               # Rust dependencies
│   └── tauri.conf.json          # Tauri configuration
├── package.json
├── tsconfig.json
├── vite.config.ts
└── svelte.config.js
```

### Component Inventory

| Component | Purpose |
|-----------|---------|
| `App.svelte` | Root component, layout, routing |
| `Sidebar.svelte` | Navigation, filters, project/context lists |
| `ZoneContainer.svelte` | Priority zone container (A-D) with DnD support |
| `TaskCard.svelte` | Individual task display and actions |
| `TaskForm.svelte` | Quick task input form |
| `TaskInput.svelte` | Syntax-highlighted task input |
| `InboxPanel.svelte` | F-zone (Idea Pool) task panel |
| `KanbanView.svelte` | Kanban board view with priority columns |
| `ListView.svelte` | List view with tasks grouped by priority |
| `TodayView.svelte` | Today-focused task view with due/overdue tasks |
| `WeekView.svelte` | 7-day calendar view with DnD scheduling |
| `PomodoroTimer.svelte` | Pomodoro timer controls |
| `ImmersivePomodoro.svelte` | Full-screen pomodoro mode |
| `QuotaMeter.svelte` | Priority quota visualization |
| `UnitNav.svelte` | Bi-daily unit navigation |
| `ReviewPanel.svelte` | Unit review interface |
| `ReviewWizard.svelte` | Step-by-step review wizard with challenge scoring |
| `SettingsModal.svelte` | Application settings |
| `BadgesModal.svelte` | Achievement/badge display modal |
| `FreshStart.svelte` | Stale task cleanup suggestion modal |
| `TagPicker.svelte` | Tag selection widget |
| `Confetti.svelte` | Celebration animation |
| `TaskEditModal.svelte` | Modal for editing existing tasks with form fields |
| `ConfirmationModal.svelte` | Reusable confirmation dialog for destructive actions |
| `CalendarView.svelte` | Monthly calendar view with task scheduling |
| `HistoryModal.svelte` | View completed and cancelled tasks history |

### Store Architecture

| Store | File | Purpose |
|-------|------|---------|
| Tasks | `tasks.svelte.ts` | Central task state, CRUD operations, filtering |
| Settings | `settings.svelte.ts` | App configuration, theme, pomodoro settings |
| Pomodoro | `pomodoro.svelte.ts` | Timer state, work/break sessions |
| UI | `ui.svelte.ts` | UI state (modals, search, task editing, keyboard shortcuts) |
| Reviews | `reviews.svelte.ts` | Unit review management |
| Gamification | `gamification.svelte.ts` | Badge/achievement tracking |

### Utility Modules

| Utility | File | Purpose |
|---------|------|---------|
| Storage | `storage.ts` | Data persistence, file operations, migrations |
| Parser | `parser.ts` | Task input syntax parsing |
| UnitCalc | `unitCalc.ts` | Bi-daily unit calculations |
| Recurrence | `recurrence.ts` | Recurring task logic |
| Quota | `quota.ts` | Priority quota validation and management |
| Motion | `motion.ts` | Animation configs, DnD type definitions |

## Development Workflow

### Commands

```bash
npm run dev              # Start Vite dev server (frontend only)
npm run build            # Build frontend to /dist
npm run tauri:dev        # Full development with Tauri (recommended)
npm run tauri:build      # Production build
npm run clean            # Remove node_modules and lock file
npm run reinstall        # Clean reinstall
```

### Dev Server

- Frontend runs on `http://localhost:1420`
- Vite HMR enabled for Svelte components
- Tauri watches backend and rebuilds automatically

## Code Conventions

### Svelte 5 Runes

This project uses Svelte 5 with **runes** enabled. State management uses the new runes syntax:

```typescript
// State declaration
let appData = $state<AppData>(createDefaultAppData());
let isLoading = $state(true);

// Derived state
let filteredTasks = $derived.by(() => { /* ... */ });

// Effects
$effect(() => { /* runs when dependencies change */ });

// Props (in components)
let { onClose }: Props = $props();
```

### Path Aliases

Use `$lib` for imports from `src/lib/`:

```typescript
import type { Task, Priority } from '$lib/types';
import { loadAppData } from '$lib/utils/storage';
import TaskCard from '$lib/components/TaskCard.svelte';
```

### Type System

All types are centralized in `src/lib/types/index.ts`. Key types:

- **Task** - Core task entity with priority, dates, pomodoros, recurrence, threshold dates
- **Priority** - `'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H'` (A-E with quotas 1-5, F=Infinity, G=completed, H=cancelled)
- **AppData** - Combined in-memory data structure
- **ActiveData** / **ArchiveData** / **PomodoroHistoryData** - Separated file structures
- **Settings** - Application configuration
- **FilterState** - Current filter criteria (includes priority and pomodoro filters)
- **UnitReview** - Bi-daily unit review data
- **Badge** / **BadgeId** - Gamification achievement types
- **PomodoroSession** - Timer session with interruption tracking
- **ViewMode** - `'kanban' | 'list' | 'calendar'` (main view modes)

### Factory Functions

Use factory functions for creating default objects:

```typescript
createEmptyTask(priority?: Priority): Task
createDefaultSettings(): Settings
createDefaultActiveData(): ActiveData
createDefaultArchiveData(): ArchiveData
createDefaultPomodoroHistoryData(): PomodoroHistoryData
createDefaultAppData(): AppData
```

### Helper Functions

```typescript
// From types/index.ts
isThresholdPassed(task: Task): boolean     // Check if threshold date allows visibility
calculateFZoneAge(task: Task): number      // Units task has been in F-zone (Idea Pool)
calculateEZoneAge(task: Task): number      // Backward compat alias for calculateFZoneAge
isWithinRetentionPeriod(task: Task): boolean  // Check if completed task is in retention window
getRetentionRemaining(task: Task): { hours, minutes } | null  // Remaining retention time
isActivePriority(priority: Priority): boolean  // Check if priority is A-F (visible)
isHiddenPriority(priority: Priority): boolean  // Check if priority is G or H (hidden)

// From utils/quota.ts
countActiveByPriority(tasks: Task[]): Record<Priority, number>
getRemainingQuota(tasks: Task[]): Record<Priority, number>
canAddTask(tasks: Task[], priority: Priority): boolean
validateQuota(tasks: Task[], priority: Priority): string | null
applyHighlanderRule(tasks: Task[], newTask: Task): Task[]
```

## Data Architecture

### Hot/Cold Data Separation

Data is split across three JSON files for performance:

| File | Content | Update Frequency |
|------|---------|------------------|
| `active.json` | Active tasks, trash, settings, reviews, badges | High (hot data) |
| `archive.json` | Completed/archived tasks | Low (cold data) |
| `pomodoro_history.json` | Pomodoro session records | Medium |

### Storage Layer

The storage system (`src/lib/utils/storage.ts`) handles:

- **Tauri mode**: Writes to `$APPDATA` with atomic file operations
- **Web mode**: Falls back to localStorage
- **Anti-deadlock**: Counter-based `isSaving` with cooldown prevents file watcher loops
- **Debouncing**: 300ms debounce on file change events
- **Migration**: Automatic migration from legacy single-file format

### Atomic Writes

All file writes use a temp-file approach to prevent corruption:
1. Write to `filename.json.tmp`
2. Sync to disk
3. Atomic rename to `filename.json`

## Key Patterns

### Task Parsing

Task input supports special syntax (`src/lib/utils/parser.ts`):

```
Task content !A +project @context #tag 🍅3 ~2025-01-15 thr:2025-01-10 rec:1w
```

| Syntax | Purpose | Example |
|--------|---------|---------|
| `!A-F` | Priority | `!A`, `!B`, `!C`, `!D`, `!E`, `!F` |
| `+name` | Project tag | `+work`, `+personal` |
| `@name` | Context tag | `@home`, `@office` |
| `#name` | Custom tag | `#urgent`, `#review` |
| `~date` | Due date | `~2025-01-15`, `~tomorrow`, `~+3d` |
| `thr:date` | Threshold date (hidden until) | `thr:2025-01-10`, `thr:+7d` |
| `rec:pattern` | Recurrence | `rec:1d`, `rec:1w`, `rec:mon,wed,fri` |
| `🍅N` or `pN` | Estimated pomodoros | `🍅4`, `p3` |
| Emoji tags | Direct emoji classification | `⚡高能量`, `💻编码` |

**Recurrence patterns:**
- `1d`, `2d`, `3d` - Daily intervals
- `1w`, `2w` - Weekly intervals
- `1m`, `3m` - Monthly/quarterly
- `mon,wed,fri` - Specific weekdays
- `1m@15` - Monthly on 15th
- `1m@last` - Monthly on last day

### Priority Quotas

The Highlander Rule applies - only one A-priority task per unit:

| Priority | Quota | Description |
|----------|-------|-------------|
| A | 1 | Core challenge (2.5+ hours deep work, 5-12 pomodoros) |
| B | 2 | Important progress (1.5-3 hours, 3-6 pomodoros) |
| C | 3 | Standard tasks (1-2.5 hours, 2-5 pomodoros) |
| D | 4 | Temporary/unplanned tasks (25-75 min, 1-3 pomodoros) |
| E | 5 | Quick tasks (<15 min, 0-1 pomodoros) |
| F | ∞ | Idea Pool - collect ideas, unsorted tasks |
| G | ∞ | Completed tasks (hidden, moved here on completion) |
| H | ∞ | Cancelled tasks (hidden, moved here on cancellation) |

Use quota utilities from `src/lib/utils/quota.ts` for validation.

### Completed Task Retention

Completed tasks (G priority) remain visible for a retention period based on their original priority:

| Original Priority | Retention Period |
|-------------------|------------------|
| A | 12 hours |
| B | 10 hours |
| C | 8 hours |
| D | 6 hours |
| E/F | 4 hours |

Use `isWithinRetentionPeriod()` and `getRetentionRemaining()` from types to check retention status.

### Bi-Daily Units

Time is organized into bi-daily units:
- Sun-Mon, Tue-Wed, Thu-Fri (work units)
- Saturday (review day)

See `src/lib/utils/unitCalc.ts` for unit calculations.

### Drag and Drop

The app uses `svelte-dnd-action` for drag-and-drop functionality. Type definitions and animation configs are in `src/lib/utils/motion.ts`:

```typescript
import { dndzone, TRIGGERS } from 'svelte-dnd-action';
import type { DndConsiderEvent, DndFinalizeEvent } from '$lib/utils/motion';
import { dndConfig, flipDefaults } from '$lib/utils/motion';

// In component
<div use:dndzone={{ items, flipDurationMs: dndConfig.flipDurationMs }}>
```

### Gamification / Badges

Badge and leveling system defined in `src/lib/stores/gamification.svelte.ts`:

| Badge ID | Name | Condition | XP Reward |
|----------|------|-----------|-----------|
| `first_step` | First Step | Complete first task | 50 |
| `pomodoro_novice` | Focus Novice | Complete 5 pomodoros | 100 |
| `pomodoro_master` | Focus Master | Complete 100 pomodoros | 1000 |
| `challenge_crusher` | Challenge Crusher | Complete 5 A-priority tasks | 500 |
| `consistency_is_key` | Consistency | Maintain a 3-day streak | 300 |
| `sustainable_worker` | Sustainable Worker | 3 "perfect days" (healthy completion rate) | 400 |

**Level Progression:**

| Level | Title | XP Required |
|-------|-------|-------------|
| 1 | Novice Planner | 0 |
| 2 | Task Apprentice | 500 |
| 3 | Focus Adept | 1500 |
| 4 | Productivity Pro | 3000 |
| 5 | Zen Master | 6000 |

```typescript
import { getGamificationStore } from '$lib/stores/gamification.svelte';
const store = getGamificationStore();
store.recordTaskCompletion(task);  // Record task completion (+10 XP)
store.recordPomodoro();            // Record pomodoro completion (+5 XP)
store.checkBadges();               // Check and unlock badges
```

## Tauri IPC Commands

Backend commands defined in `src-tauri/src/commands.rs`:

```rust
// File path operations
get_app_data_path(app_handle) -> Result<String>
get_data_file_paths(app_handle) -> Result<DataFilePaths>

// Data operations
read_data_file(app_handle, file_type: &str) -> Result<Option<String>>
atomic_write_file(app_handle, file_type: &str, content: &str) -> Result<()>

// Maintenance
backup_data(app_handle) -> Result<String>
migrate_legacy_data(app_handle) -> Result<bool>

// Archive operations
append_archive_tasks(app_handle, new_tasks_json: &str) -> Result<()>

// System
get_system_info() -> SystemInfo
trigger_reload(app_handle, file_type: &str) -> Result<()>
```

Frontend invocation:

```typescript
import { invoke } from '@tauri-apps/api/core';
const content = await invoke<string | null>('read_data_file', { fileType: 'active' });
await invoke('atomic_write_file', { fileType: 'active', content: JSON.stringify(data) });
```

## Internationalization

Two languages supported via `src/lib/i18n/`:

| File | Purpose |
|------|---------|
| `zh-CN.ts` | Chinese Simplified translations |
| `en-US.ts` | English translations |
| `index.ts` | i18n API exports |
| `store.svelte.ts` | Reactive locale state |

Usage:

```typescript
import { t, setLocale } from '$lib/i18n';
t('sidebar.allTasks'); // Returns translated string
setLocale('en-US');    // Switch language
```

## Animation System

Animation configurations centralized in `src/lib/utils/motion.ts`:

```typescript
import { springs, durations, easings, transitions } from '$lib/utils/motion';

// Spring presets: snappy, smooth, bouncy, gentle, drag
// Duration presets: instant (100ms), fast (150ms), normal (200ms), slow (350ms)
// Easing curves: standard, decelerate, accelerate, bounce, smoothOut

// Helper functions
createTransition(['opacity', 'transform'], 'fast', 'decelerate');
staggerDelay(index, 30);  // Staggered list animations
areTaskArraysEqual(a, b); // DnD optimization helper
```

## Testing

**Note:** No test framework is currently configured. When adding tests, consider:

- Vitest for unit tests (integrates well with Vite)
- Playwright for E2E testing

## Important Considerations

### State Management

- All app state flows through `src/lib/stores/tasks.svelte.ts`
- Use the exported functions (not direct state mutation) to ensure persistence
- The `persist()` function saves changes to storage after state updates
- Access store data via `getTasksStore()` which returns reactive getters

### UI Store Functions

The UI store (`src/lib/stores/ui.svelte.ts`) provides:

```typescript
// Modals
openModal(name: string, data?: unknown): void
closeModal(): void
openEditModal(task: Task): void    // Open task edit modal
closeEditModal(): void             // Close task edit modal

// Toast notifications
showToast(message: string, type: 'success' | 'error' | 'info', duration?: number): void
hideToast(): void

// Sidebar & Search
toggleSidebar(): void
toggleSearch(): void

// Immersive mode
enterImmersiveMode(): void
exitImmersiveMode(): void
toggleImmersiveMode(): void
```

### File Watcher

- Rust backend watches data files for external changes
- Frontend receives `data-file-changed` events via Tauri events
- Always check `isCurrentlySaving()` before processing file change events
- File watcher skips reload if user is editing or pomodoro is active

### Permissions

Tauri capabilities (in `src-tauri/capabilities/default.json`):
- `core:default` - Core Tauri functionality
- `fs:default` - Basic filesystem access
- `fs:allow-appdata-read-recursive` - Read from app data
- `fs:allow-appdata-write-recursive` - Write to app data
- `notification:default` - System notifications

### Keyboard Shortcuts

Global keyboard shortcuts are handled in `src/lib/stores/ui.svelte.ts`:

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + K` | Toggle search |
| `Cmd/Ctrl + N` | Focus new task input |
| `Cmd/Ctrl + B` | Toggle sidebar |
| `Cmd/Ctrl + Shift + F` | Toggle immersive mode |
| `Space` | Toggle pomodoro (when not in input) |
| `Escape` | Close modal/search/editing |

### Theme Support

Three theme modes: `'dark' | 'light' | 'system'`

Theme is stored in settings and applied via CSS custom properties in `app.css`. The `effectiveTheme` derived value resolves `system` to the actual theme based on user preferences.

## Common Tasks

### Adding a New Component

1. Create `src/lib/components/ComponentName.svelte`
2. Use Svelte 5 runes for state (`$state`, `$derived`, `$effect`)
3. Use `$props()` for component properties
4. Import types from `$lib/types`
5. Add i18n keys to both language files if adding UI text

### Adding a New Tauri Command

1. Add function in `src-tauri/src/commands.rs` with `#[tauri::command]` attribute
2. Register in `main.rs` invoke_handler array
3. Call from frontend via `invoke()`

### Modifying Data Schema

1. Update types in `src/lib/types/index.ts`
2. Update factory functions (e.g., `createDefaultActiveData`)
3. Add migration logic in `src/lib/utils/storage.ts`:
   - `migrateTasks()` for task field additions
   - `migrateSettings()` for settings field additions
   - `migrateData()` for version-based migrations
4. Update Rust serialization if backend handles the data

### Adding a New Store

1. Create `src/lib/stores/storename.svelte.ts`
2. Define state with `$state()` and derived values with `$derived()`
3. Export init function and getter function (e.g., `getStoreNameStore()`)
4. Initialize in `App.svelte` onMount

### Adding a New View Mode

1. Add to `ViewMode` type in `src/lib/types/index.ts` (currently: `'kanban' | 'list' | 'calendar'`)
2. Create component in `src/lib/components/` (e.g., `CalendarView.svelte`)
3. Add routing logic in `App.svelte` (switch statement on viewMode)
4. Add navigation in `Sidebar.svelte` (icon and click handler)
5. Add i18n keys for view name in both `zh-CN.ts` and `en-US.ts`

### Adding a New Badge

1. Add badge definition to `BADGE_DEFINITIONS` array in `src/lib/stores/gamification.svelte.ts`:
   - `id`: Unique badge identifier
   - `name`: Display name
   - `description`: Badge description
   - `icon`: Emoji icon
   - `condition`: Function that takes `GamificationStats` and returns boolean
   - `xpReward`: XP reward when badge is unlocked
2. Add any new stats to `GamificationStats` interface if needed
3. Update `recordTaskCompletion()` or `recordPomodoro()` to track new stats
4. Badge modal automatically displays from store state

## File Reference

| File | Purpose | Approx Lines |
|------|---------|--------------|
| `src/App.svelte` | Root component, layout, routing | ~785 |
| `src/lib/stores/tasks.svelte.ts` | Central state management | ~690 |
| `src/lib/stores/ui.svelte.ts` | UI state, modals, keyboard shortcuts | ~250 |
| `src/lib/utils/storage.ts` | Data persistence layer | ~610 |
| `src/lib/utils/parser.ts` | Task input parsing | ~410 |
| `src/lib/utils/motion.ts` | Animation configs, DnD types | ~190 |
| `src/lib/utils/quota.ts` | Priority quota utilities | ~160 |
| `src/lib/types/index.ts` | Type definitions | ~455 |
| `src/lib/components/Sidebar.svelte` | Navigation and filters | ~1180 |
| `src/lib/components/ListView.svelte` | List view by priority | ~190 |
| `src/lib/components/KanbanView.svelte` | Kanban board view | ~200 |
| `src/lib/components/CalendarView.svelte` | Monthly calendar view | ~375 |
| `src/lib/components/TaskEditModal.svelte` | Task edit modal with form | ~200 |
| `src/lib/components/HistoryModal.svelte` | Completed/cancelled tasks viewer | ~395 |
| `src/lib/components/ConfirmationModal.svelte` | Reusable confirmation dialog | ~175 |
| `src/lib/stores/gamification.svelte.ts` | Badge system | ~230 |
| `src-tauri/src/commands.rs` | Backend IPC handlers | ~415 |
| `src-tauri/src/watcher.rs` | File system watcher | ~80 |

## Rust Dependencies

Key dependencies in `src-tauri/Cargo.toml`:

| Crate | Purpose |
|-------|---------|
| `tauri` | Desktop application framework |
| `tauri-plugin-fs` | File system access |
| `tauri-plugin-notification` | System notifications |
| `serde` / `serde_json` | JSON serialization |
| `chrono` | Date/time handling |
| `notify` | File system watching |
| `tokio` | Async runtime |
| `sys-locale` | System locale detection |
| `uuid` | UUID generation |

## Frontend Dependencies

Key npm packages:

| Package | Purpose |
|---------|---------|
| `@tauri-apps/api` | Tauri frontend bindings |
| `@tauri-apps/plugin-fs` | File system plugin |
| `@tauri-apps/plugin-notification` | Notification plugin |
| `motion` | Animation library |
| `svelte-dnd-action` | Drag-and-drop functionality |
