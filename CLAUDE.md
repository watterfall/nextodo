# CLAUDE.md - FocusFlow Codebase Guide

## Project Overview

**FocusFlow** is a focus-first task management desktop application that combines GTD (Getting Things Done) methodology with the Pomodoro technique. Built with Tauri, Svelte 5, and Rust, it provides cross-platform support with a 5-tier priority system, bi-daily work units, and periodic reviews.

**Version:** 2.0.0
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
│   │   ├── components/           # Svelte components (11 files)
│   │   ├── stores/               # Svelte 5 runes state management (5 stores)
│   │   ├── utils/                # Business logic utilities
│   │   ├── types/                # TypeScript type definitions
│   │   └── i18n/                 # Internationalization (zh-CN, en-US)
│   ├── App.svelte                # Root component
│   ├── app.css                   # Global styles
│   └── main.ts                   # Application entry point
├── src-tauri/                    # Backend (Rust)
│   ├── src/
│   │   ├── main.rs              # Tauri setup and entry
│   │   ├── commands.rs          # IPC command handlers
│   │   └── watcher.rs           # File system watcher
│   ├── Cargo.toml               # Rust dependencies
│   └── tauri.conf.json          # Tauri configuration
├── package.json
├── tsconfig.json
├── vite.config.ts
└── svelte.config.js
```

## Development Workflow

### Commands

```bash
npm run dev              # Start Vite dev server (frontend only)
npm run build            # Build frontend to /dist
npm run tauri:dev        # Full development with Tauri (recommended)
npm run tauri:build      # Production build
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
let filteredTasks = $derived(/* ... */);
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
- **Priority** - 'A' | 'B' | 'C' | 'D' | 'E' (with quotas: 1, 2, 3, 5, Infinity)
- **AppData** - Combined in-memory data structure
- **ActiveData** / **ArchiveData** / **PomodoroHistoryData** - Separated file structures

### Factory Functions

Use factory functions for creating default objects:

```typescript
createEmptyTask(priority?: Priority): Task
createDefaultSettings(): Settings
createDefaultActiveData(): ActiveData
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
- **Anti-deadlock**: `isSaving` flag prevents file watcher loops
- **Debouncing**: 300ms debounce on file change events
- **Migration**: Automatic migration from legacy single-file format

### Atomic Writes

All file writes use a temp-file approach to prevent corruption:
1. Write to `filename.json.tmp`
2. Rename to `filename.json`

## Key Patterns

### Task Parsing

Task input supports special syntax (`src/lib/utils/parser.ts`):

```
(A) Task content +project @context #tag 🔥 due:2025-01-15 t:2025-01-10 rec:1w est:4
```

- `(A-E)` - Priority
- `+project` - Project tag
- `@context` - Context tag
- `#tag` - Custom tag
- Emoji tags - Direct emoji classification
- `due:YYYY-MM-DD` - Due date
- `t:YYYY-MM-DD` - Threshold date (hidden until)
- `rec:1d|2d|3d|1w|2w|1m|3m` - Recurrence pattern
- `est:N` - Estimated pomodoros

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
read_data_file(file_type: &str) -> Option<String>
atomic_write_file(file_type: &str, content: &str) -> Result<()>
migrate_legacy_data() -> bool
backup_data() -> String
```

Frontend invocation:

```typescript
import { invoke } from '@tauri-apps/api/core';
const content = await invoke<string | null>('read_data_file', { fileType: 'active' });
```

## Internationalization

Two languages supported via `src/lib/i18n/`:

- `zh-CN.ts` - Chinese Simplified (default)
- `en-US.ts` - English

Usage:

```typescript
import { t, setLocale } from '$lib/i18n';
t('sidebar.allTasks'); // Returns translated string
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

### File Watcher

- Rust backend watches data files for external changes
- Frontend receives `data-file-changed` events via Tauri events
- Always check `isCurrentlySaving()` before processing file change events

### Permissions

Tauri capabilities (in `src-tauri/capabilities/default.json`):
- `fs:allow-appdata-read-recursive` - Read from app data
- `fs:allow-appdata-write-recursive` - Write to app data
- `notification:default` - System notifications

### Theme Support

Three theme modes: `'dark' | 'light' | 'system'`

Theme is stored in settings and applied via CSS custom properties in `app.css`.

## Common Tasks

### Adding a New Component

1. Create `src/lib/components/ComponentName.svelte`
2. Use Svelte 5 runes for state (`$state`, `$derived`, `$effect`)
3. Import types from `$lib/types`
4. Add i18n keys to both language files if adding UI text

### Adding a New Tauri Command

1. Add function in `src-tauri/src/commands.rs`
2. Register in `main.rs` invoke_handler
3. Call from frontend via `invoke()`

### Modifying Data Schema

1. Update types in `src/lib/types/index.ts`
2. Add migration logic in `src/lib/utils/storage.ts` (both `migrateTasks` and `migrateSettings`)
3. Update Rust serialization if backend handles the data

## File Reference

| File | Purpose | Lines |
|------|---------|-------|
| `src/App.svelte` | Root component, layout, routing | ~530 |
| `src/lib/stores/tasks.svelte.ts` | Central state management | ~470 |
| `src/lib/utils/storage.ts` | Data persistence layer | ~550 |
| `src/lib/types/index.ts` | Type definitions | ~330 |
| `src/lib/components/Sidebar.svelte` | Navigation and filters | ~550 |
| `src-tauri/src/commands.rs` | Backend IPC handlers | ~200 |
