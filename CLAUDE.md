# CLAUDE.md - FocusFlow Codebase Guide

## Project Overview

**FocusFlow** is a focus-first task management desktop application that combines GTD (Getting Things Done) methodology with the Pomodoro technique. Built with Tauri, Svelte 5, and Rust, it provides cross-platform support with a 5-tier priority system, bi-daily work units, and periodic reviews.

**Version:** 2.0.0
**Data Version:** 3.0
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

### Directory Structure

```
/
├── src/                          # Frontend (Svelte/TypeScript)
│   ├── lib/
│   │   ├── components/           # Svelte components (15 files)
│   │   ├── stores/               # Svelte 5 runes state management (5 stores)
│   │   ├── utils/                # Business logic utilities (5 files)
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
| `ZoneContainer.svelte` | Priority zone container (A-D) |
| `TaskCard.svelte` | Individual task display and actions |
| `TaskForm.svelte` | Quick task input form |
| `TaskInput.svelte` | Syntax-highlighted task input |
| `InboxPanel.svelte` | E-zone (inbox) task panel |
| `KanbanView.svelte` | Alternative kanban board view |
| `PomodoroTimer.svelte` | Pomodoro timer controls |
| `ImmersivePomodoro.svelte` | Full-screen pomodoro mode |
| `QuotaMeter.svelte` | Priority quota visualization |
| `UnitNav.svelte` | Bi-daily unit navigation |
| `ReviewPanel.svelte` | Unit review interface |
| `SettingsModal.svelte` | Application settings |
| `TagPicker.svelte` | Tag selection widget |
| `Confetti.svelte` | Celebration animation |

### Store Architecture

| Store | File | Purpose |
|-------|------|---------|
| Tasks | `tasks.svelte.ts` | Central task state, CRUD operations, filtering |
| Settings | `settings.svelte.ts` | App configuration, theme, pomodoro settings |
| Pomodoro | `pomodoro.svelte.ts` | Timer state, work/break sessions |
| UI | `ui.svelte.ts` | UI state (modals, search, editing) |
| Reviews | `reviews.svelte.ts` | Unit review management |

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

- **Task** - Core task entity with priority, dates, pomodoros, recurrence
- **Priority** - `'A' | 'B' | 'C' | 'D' | 'E'` (with quotas: 1, 2, 3, 5, Infinity)
- **AppData** - Combined in-memory data structure
- **ActiveData** / **ArchiveData** / **PomodoroHistoryData** - Separated file structures
- **Settings** - Application configuration
- **FilterState** - Current filter criteria
- **UnitReview** - Bi-daily unit review data

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

## Data Architecture

### Hot/Cold Data Separation

Data is split across three JSON files for performance:

| File | Content | Update Frequency |
|------|---------|------------------|
| `active.json` | Active tasks, trash, settings, reviews | High (hot data) |
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
| `!A-E` | Priority | `!A`, `!B`, `!C`, `!D`, `!E` |
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
| A | 1 | Core challenge (2+ hours deep work) |
| B | 2 | Important progress |
| C | 3 | Standard tasks |
| D | 5 | Quick tasks (<15 min) |
| E | ∞ | Inbox/ideas |

### Bi-Daily Units

Time is organized into bi-daily units:
- Sun-Mon, Tue-Wed, Thu-Fri (work units)
- Saturday (review day)

See `src/lib/utils/unitCalc.ts` for unit calculations.

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

### Theme Support

Three theme modes: `'dark' | 'light' | 'system'`

Theme is stored in settings and applied via CSS custom properties in `app.css`. The `effectiveTheme` derived value resolves `system` to the actual theme based on user preferences.

## Common Tasks

### Adding a New Component

1. Create `src/lib/components/ComponentName.svelte`
2. Use Svelte 5 runes for state (`$state`, `$derived`, `$effect`)
3. Import types from `$lib/types`
4. Add i18n keys to both language files if adding UI text

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

## File Reference

| File | Purpose | Approx Lines |
|------|---------|--------------|
| `src/App.svelte` | Root component, layout, routing | ~770 |
| `src/lib/stores/tasks.svelte.ts` | Central state management | ~480 |
| `src/lib/utils/storage.ts` | Data persistence layer | ~580 |
| `src/lib/utils/parser.ts` | Task input parsing | ~410 |
| `src/lib/types/index.ts` | Type definitions | ~330 |
| `src/lib/components/Sidebar.svelte` | Navigation and filters | ~550 |
| `src-tauri/src/commands.rs` | Backend IPC handlers | ~310 |
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
