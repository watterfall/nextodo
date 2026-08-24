# CLAUDE.md - FocusFlow Codebase Guide

## Project Overview

**FocusFlow** is a focus-first task management desktop application that combines GTD (Getting Things Done) methodology with the Pomodoro technique. Built with Tauri, Svelte 5, and Rust, it provides cross-platform support with an A–F quota-based priority system (plus N/S long-horizon lanes), bi-daily work units, and periodic reviews.

**Version:** 2.0.0
**Data Version:** 4.0
**License:** MIT

## Architecture

### Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | Svelte 5 (with runes) | ^5.56.4 |
| Language | TypeScript | ^5.9.3 |
| Build Tool | Vite (Rolldown) | ^8.1.3 |
| Desktop Framework | Tauri 2 | ^2.11.4 |
| Backend | Rust (2021 edition) | - |
| Animation | CSS transitions + Svelte transitions (no animation library) | - |
| Drag & Drop | Native HTML5 DnD (no library) | - |
| Testing | Vitest | ^4.1.9 |

### Directory Structure

```
/
├── src/                          # Frontend (Svelte/TypeScript)
│   ├── lib/
│   │   ├── components/           # Svelte components (27 files)
│   │   ├── stores/               # Svelte 5 runes state management (6 stores)
│   │   ├── utils/                # Business logic utilities (10 files)
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
├── cli/                          # focusflow CLI (esbuild → dist-cli/)
│   └── focusflow.ts
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
└── svelte.config.js
```

### Component Inventory

| Component | Purpose |
|-----------|---------|
| `App.svelte` | Root component, layout, routing |
| `Sidebar.svelte` | Navigation, filters, project/context lists |
| `ZoneRail.svelte` | S/F/N priority rail (Sustained / Idea Pool / Future lanes) |
| `TaskCard.svelte` | Individual task display and actions |
| `TaskForm.svelte` | Quick task input form |
| `TaskInput.svelte` | Syntax-highlighted task input |
| `QuickAddRow.svelte` | Inline quick-add row for fast task entry |
| `DropZone.svelte` | Native HTML5 drag-and-drop drop target |
| `KanbanView.svelte` | Kanban board view with priority columns |
| `ListView.svelte` | List view with tasks grouped by priority |
| `TodayView.svelte` | Today-focused task view with due/overdue tasks |
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
| `CompletionSparkline.svelte` | Completion-rate sparkline from cycle history |
| `LowCompletionBanner.svelte` | Low-completion micro-review banner |

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
| Quota | `quota.ts` | i18n-aware quota validation (thin wrapper over quotaCore) |
| QuotaCore | `quotaCore.ts` | Node-safe quota core shared with the CLI (no i18n/Svelte/Tauri deps) |
| CycleEngine | `cycleEngine.ts` | Dynamic cycle / low-completion merge logic |
| Reminders | `reminders.ts` | Daily due/overdue notification scheduling |
| Dnd | `dnd.ts` | Native HTML5 drag-and-drop payloads |
| Motion | `motion.ts` | Animation tokens (springs/durations/easings) — hand-rolled CSS, unrelated to the `motion` npm package |

## Development Workflow

### Commands

```bash
npm run dev              # Start Vite dev server (frontend only)
npm run build            # Build frontend to /dist
npm run tauri:dev        # Full development with Tauri (recommended)
npm run tauri:build      # Production build
npm run typecheck        # tsc --noEmit for src/ and cli/
npm run check            # svelte-check (Svelte + TS diagnostics)
npm test                 # Unit tests, run in two timezones (see Testing)
npm run test:watch       # Run unit tests in watch mode
npm run cli:build        # Bundle the focusflow CLI (esbuild → dist-cli/focusflow.mjs)
npm run cli              # Run the built focusflow CLI
npm run clean            # Remove node_modules and lock file
npm run reinstall        # Clean reinstall
```

### Dev Server

- Frontend runs on `http://localhost:1420`
- Vite HMR enabled for Svelte components
- Tauri watches backend and rebuilds automatically

### CLI (focusflow)

A headless CLI lives at `cli/focusflow.ts` for scripting and agent-driven use. Build it with `npm run cli:build` (esbuild bundles it to `dist-cli/focusflow.mjs`) and run it with `npm run cli`.

Subcommands: `add`, `list`, `done`, `cancel`, `import-reminders`, `agent-guide`.
The CLI imports the same Node-safe modules the app uses — `quotaCore.ts` (quota
and Highlander rules), `parser.ts` (input syntax) and `recurrence.ts` (next
occurrence on `done`) — so those behaviours match the app exactly. It does **not**
run gamification (no XP or badges for a CLI completion) and does not touch
`cycleState`; the app reconciles recurrence on next launch either way.

The CLI is covered by `cli/focusflow.test.ts`, which builds the bundle and drives
it as a subprocess against a temp data file, and is type-checked via
`tsc -p cli/tsconfig.json` (wired into `npm run typecheck`).

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
- **Priority** - `'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'N' | 'S'` (A-E with quotas 1-5, F=Idea Pool ∞; N=Future Progress — long-term important, non-urgent, hidden by default (∞); S=Sustained Progress — one week-long project broken into subtasks (quota 1); G=completed, H=cancelled)
- **ActivePriority** - `Exclude<Priority, 'G' | 'H' | 'N' | 'S'>` → the visible, quota-bearing A–F tiers
- **AppData** - Combined in-memory data structure
- **ActiveData** / **ArchiveData** / **PomodoroHistoryData** - Separated file structures
- **Settings** - Application configuration
- **FilterState** - Current filter criteria (includes priority and pomodoro filters)
- **UnitReview** - Bi-daily unit review data
- **Badge** / **BadgeId** - Gamification achievement types
- **PomodoroSession** - Timer session with interruption tracking
- **ViewMode** - `'today' | 'kanban' | 'list' | 'calendar'` (main view modes)

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
applyHighlanderRule(tasks: Task[], newTask: Task): Task[]  // handles A and S
isSingleSlotPriority(priority: Priority): boolean          // A or S
demotionTargetFor(tasks: Task[]): ActivePriority           // first tier with room
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
| `!A-F`, `!N`, `!S` | Priority | `!A` … `!F`, `!N`, `!S`. Full-width `【A】` also works (CN IME) |
| `+name` | Project tag | `+work`, `+personal` |
| `@name` | Context tag | `@home`, `@office` |
| `#name` | Custom tag | `#urgent`, `#review` |
| `~date` | Due date | `~2025-01-15`, `~tomorrow`, `~+3d` |
| `thr:date` | Threshold date (hidden until) | `thr:2025-01-10`, `thr:+7d` |
| `rec:pattern` | Recurrence | `rec:1d`, `rec:1w`, `rec:mon,wed,fri` |
| `🍅N` or `pN` | Estimated pomodoros (must stand alone) | `🍅4`, `p3` — `step2` is **not** matched |
| Emoji tags | Direct emoji classification | `⚡高能量`, `💻编码` |

**Recurrence patterns:**
- `1d`, `2d`, `3d` - Daily intervals
- `1w`, `2w` - Weekly intervals
- `1m`, `3m` - Monthly/quarterly
- `mon,wed,fri` - Specific weekdays
- `1m@15` - Monthly on 15th
- `1m@last` - Monthly on last day

### Priority Quotas

**Single-slot tiers.** A (the unit's core challenge) and S (the week's
sustained project) each hold exactly one task. Adding a second one does NOT fail:
`applyHighlanderRule` unseats the incumbent and moves it to the highest tier
that still has room (B → C → D → E → F). Both tiers go through the same code
path, so treat them identically at every call site — skip the quota check for
either, and let Highlander place the loser.

| Priority | Quota | Description |
|----------|-------|-------------|
| A | 1 | Core challenge (2.5+ hours deep work, 5-12 pomodoros) |
| B | 2 | Important progress (1.5-3 hours, 3-6 pomodoros) |
| C | 3 | Standard tasks (1-2.5 hours, 2-5 pomodoros) |
| D | 4 | Temporary/unplanned tasks (25-75 min, 1-3 pomodoros) |
| E | 5 | Quick tasks (<15 min, 0-1 pomodoros) |
| F | ∞ | Idea Pool - collect ideas, unsorted tasks |
| N | ∞ | Future Progress - long-term important, non-urgent (hidden by default) |
| S | 1 | Sustained Progress - one week-long project, broken into subtasks |
| G | ∞ | Completed tasks (hidden, moved here on completion) |
| H | ∞ | Cancelled tasks (hidden, moved here on cancellation) |

Use quota utilities from `src/lib/utils/quota.ts` for validation.

### Completed Task Retention

Completed tasks (G priority) stay visible, struck through, until **the end of the
2-day unit they were completed in** — not for a per-priority number of hours. A
task finished on the Sunday of a Sun–Mon unit stays visible through Monday
23:59, regardless of whether it was an A or an E.

Use `isWithinRetentionPeriod()` and `getRetentionRemaining()` from types to check
retention status; they delegate to `isCompletedInCurrentUnit()` and
`getUnitRetentionRemaining()` in `unitCalc.ts`.

Separately, `cleanupOldTasks()` in `tasks.svelte.ts` moves G tasks out of
`active.json` into cold storage 14 days after completion, and hard-deletes
cancelled (H) tasks after 2 days.

### Bi-Daily Units

Time is organized into bi-daily units:
- Sun-Mon, Tue-Wed, Thu-Fri (work units)
- Saturday (review day)

See `src/lib/utils/unitCalc.ts` for unit calculations.

### Drag and Drop

The app uses **native HTML5 drag-and-drop**, not a library. Payload types and the
drag/drop helpers live in `src/lib/utils/dnd.ts`; `DropZone.svelte` wraps a drop
target. `svelte-dnd-action` was removed — do not reintroduce `use:dndzone`.

```typescript
import { startTaskDrag, clearDragPayload } from '$lib/utils/dnd';
import type { TaskDragPayload } from '$lib/utils/dnd';
import DropZone from './DropZone.svelte';

// In component: DropZone handles dragover/drop and calls back with the payload
<DropZone onDropTask={(payload: TaskDragPayload) => handleDrop(payload)}>
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

Unit testing runs on **Vitest** (`vitest.config.ts` at the repo root, `node` environment, `$lib` alias). Tests are colocated as `*.test.ts` next to the code they cover — the include glob is `src/**/*.test.ts` and `cli/**/*.test.ts`, so the pure logic in `src/lib/utils/*.ts` (parser, quotaCore, recurrence, unitCalc, cycleEngine, …) is the primary target.

```bash
npm test            # runs the suite twice: local zone, then TZ=Asia/Shanghai
npm run test:watch  # vitest watch mode
npm run typecheck   # tsc for src/ AND cli/
npm run check       # svelte-check — Svelte + TypeScript diagnostics
```

**The timezone is deliberately not pinned.** `vitest.config.ts` used to force
`TZ=UTC`, which was the one zone where the recurrence engine happened to be
correct — east of UTC a `1d` recurrence returned the same date forever, and the
tests passed anyway. All date handling now works on local calendar parts, and
`npm test` runs the suite a second time under `TZ=Asia/Shanghai` to keep it that
way. If you add date logic, never format via `toISOString()`; use
`formatDateISO()` / `currentUnitStartLocal()`.

Prefer testing the Node-safe modules (`quotaCore.ts`, `parser.ts`, `recurrence.ts`, `unitCalc.ts`) directly — they have no Svelte/Tauri dependencies. `src/lib/i18n/parity.test.ts` asserts the two locale files expose identical key sets; without it, a key missing from `en-US` silently renders Chinese, because components fall back with `t('x') || '中文'`.

Not yet covered by tests: `storage.ts` (persistence, migrations, atomic writes) and the Svelte stores. For E2E, Playwright remains the suggested future addition.

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

1. Add to `ViewMode` type in `src/lib/types/index.ts` (currently: `'today' | 'kanban' | 'list' | 'calendar'`)
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
| `src/App.svelte` | Root component, layout, routing | ~865 |
| `src/lib/stores/tasks.svelte.ts` | Central state management | ~1140 |
| `src/lib/stores/ui.svelte.ts` | UI state, modals, keyboard shortcuts | ~250 |
| `src/lib/utils/storage.ts` | Data persistence layer | ~660 |
| `src/lib/utils/parser.ts` | Task input parsing | ~410 |
| `src/lib/utils/quotaCore.ts` | Node-safe quota core (shared with CLI) | ~165 |
| `src/lib/utils/cycleEngine.ts` | Dynamic cycle / merge logic | ~155 |
| `src/lib/utils/motion.ts` | Animation tokens | ~135 |
| `src/lib/types/index.ts` | Type definitions | ~590 |
| `src/lib/components/Sidebar.svelte` | Navigation and filters | ~1180 |
| `src/lib/components/ZoneRail.svelte` | S/F/N priority rail | ~815 |
| `src/lib/components/TodayView.svelte` | Today-focused task view | ~915 |
| `src/lib/components/CalendarView.svelte` | Monthly calendar view | ~375 |
| `src/lib/components/HistoryModal.svelte` | Completed/cancelled tasks viewer | ~395 |
| `src/lib/stores/gamification.svelte.ts` | Badge system | ~230 |
| `cli/focusflow.ts` | Headless focusflow CLI | ~255 |
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
