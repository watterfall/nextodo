# CLAUDE.md - FocusFlow Codebase Guide

## Project Overview

**FocusFlow** is a focus-first task management desktop application that combines GTD (Getting Things Done) methodology with the Pomodoro technique. Built with Tauri, Svelte 5, and Rust, it provides cross-platform support with an A–E quota-based priority system, bi-daily work units, and periodic reviews.

**The candidate pool lives outside the app.** Unsorted and long-horizon work sits
in a plain `todo.txt` — the same file [sleek](https://github.com/ransome1/sleek)
edits — and FocusFlow pulls out of it into the current 2-day unit. That is why
there are only five tiers: "not sorted yet" and "important, later" are states of
a line in that file, not priorities here. **`docs/SLEEK-INTEROP.md` is the design
record for this and is the authority for every format question.**

**Version:** 2.0.0
**Data Version:** 6.0
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
│   │   ├── components/           # Svelte components (26 files)
│   │   ├── stores/               # Svelte 5 runes state management (5 stores)
│   │   ├── utils/                # Business logic utilities (15 files)
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
| `InboxPanel.svelte` | Candidate pool — pull lines out of the shared todo.txt into this unit |
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
| `FlowStrip.svelte` | The three flow metrics on the main view |
| `OldestOpenRow.svelte` | Oldest unfinished task, resident in every view |
| `TagPicker.svelte` | Tag selection widget |
| `TaskEditModal.svelte` | Modal for editing existing tasks with form fields |
| `ConfirmationModal.svelte` | Reusable confirmation dialog for destructive actions |
| `CalendarView.svelte` | Monthly calendar view with task scheduling |
| `HistoryModal.svelte` | View completed and cancelled tasks history |
| `LowCompletionBanner.svelte` | Low-completion micro-review banner |

### Store Architecture

| Store | File | Purpose |
|-------|------|---------|
| Tasks | `tasks.svelte.ts` | Central task state, CRUD operations, filtering |
| Settings | `settings.svelte.ts` | App configuration, theme, pomodoro settings |
| Pomodoro | `pomodoro.svelte.ts` | Timer state, work/break sessions |
| UI | `ui.svelte.ts` | UI state (modals, search, task editing, keyboard shortcuts) |
| Reviews | `reviews.svelte.ts` | Unit review management |

### Utility Modules

| Utility | File | Purpose |
|---------|------|---------|
| Storage | `storage.ts` | Data persistence, file operations, migrations |
| Parser | `parser.ts` | Task input syntax parsing |
| UnitCalc | `unitCalc.ts` | Bi-daily unit calculations |
| Recurrence | `recurrence.ts` | Recurring task logic |
| Quota | `quota.ts` | i18n-aware quota validation (thin wrapper over quotaCore) |
| QuotaCore | `quotaCore.ts` | Node-safe quota core shared with the CLI (no i18n/Svelte/Tauri deps) |
| TodoTxt | `todotxt.ts` | todo.txt parse/serialize, byte-compatible with the parser sleek uses |
| TodoFile | `todoFile.ts` | Reading/writing the shared todo.txt (Tauri command, localStorage in the browser) |
| MigrateV5 | `migrateV5.ts` | The 4.0 → 5.0 data migration (Node-safe, so it is testable) |
| MigrateV6 | `migrateV6.ts` | The 5.0 → 6.0 migration: completion moves off the priority axis |
| CycleEngine | `cycleEngine.ts` | Dynamic cycle / low-completion merge logic |
| FlowMetrics | `flowMetrics.ts` | Age / cycle time / estimation factor — Node-safe, shared with the CLI |
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

Subcommands: `add`, `list`, `done`, `cancel`, `metrics`, `import-reminders`, `agent-guide`.

`metrics [--json]` is the agent-facing view of `flowMetrics.ts`: how much is
open, how long the oldest unfinished task has waited, median creation-to-
completion time, and the median actual/estimated pomodoro ratio. The two
medians come back as `null` below 5 samples, with `samplesUntilReady` saying
how many more are needed — never a number that would read as a finding.
The CLI imports the same Node-safe modules the app uses — `quotaCore.ts` (quota
and Highlander rules), `parser.ts` (input syntax) and `recurrence.ts` (next
occurrence on `done`) — so those behaviours match the app exactly. It does not touch
`cycleState`; the app reconciles recurrence on next launch either way.

**The CLI operates on the unit, not on the candidate pool.** It reads and writes
`active.json` only; the shared `todo.txt` is the app's concern. That means a task
added here has no `source`, so completing it writes no `x` anywhere — which is
correct, because it never came from a line. For scripting against the candidate
pool, edit the todo.txt directly: it is a text file, and that is the point.

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

- **Task** - Core task entity with priority, dates, pomodoros, recurrence, threshold dates, and a `trigger` (situational start cue)
- **Priority** - `'A' | 'B' | 'C' | 'D' | 'E'` — the five quota-bearing tiers, and nothing else
- **TaskStatus** - `'open' | 'completed' | 'cancelled'` — what happened to a task, on its own axis. A task keeps its priority through either ending, which is why this is separate; see `docs/EVIDENCE-REVIEW.md` §3
- **PriorityCounts** - `Record<Priority, number>`
- **TaskOrigin** - `'self' | 'assigned'` — proactive vs reactive, stored as an `@主` / `@被` context
- **TaskSource** - where a pulled task's line lives in the todo.txt, for write-back
- **AppData** - Combined in-memory data structure
- **ActiveData** / **ArchiveData** / **PomodoroHistoryData** - Separated file structures
- **Settings** - Application configuration (incl. `pomodoroWorkByPriority`)
- **FilterState** - Current filter criteria (includes priority and pomodoro filters)
- **UnitReview** - Bi-daily unit review data
- **PomodoroSession** - Timer session with interruption tracking
- **ViewMode** - `'today' | 'kanban' | 'list' | 'calendar'` (main view modes)
- **Recurrence** - `{ n, unit: 'd'|'b'|'w'|'m'|'y', strict, customPattern?, nextDue }` — the todo.txt `rec:` grammar, one for one

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
isWithinRetentionPeriod(task: Task): boolean  // Check if completed task is in retention window
getRetentionRemaining(task: Task): { hours, minutes } | null  // Remaining retention time
isOpen(task): boolean                      // still owed
isFinished(task): boolean                  // completed or cancelled
emptyPriorityCounts(): PriorityCounts      // { A: 0, B: 0, C: 0, D: 0, E: 0 }
asPriority(value: unknown): Priority       // narrow to a real tier; unknown → C
taskOrigin(task: Task): TaskOrigin | null  // read the @主 / @被 marker
withOrigin(contexts: string[], origin): string[]  // set/replace/clear it
countOrigins(tasks: Task[]): OriginCounts  // proactive / reactive / unmarked

// From utils/quota.ts
countActiveByPriority(tasks: Task[]): Record<Priority, number>
getRemainingQuota(tasks: Task[]): Record<Priority, number>
canAddTask(tasks: Task[], priority: Priority): boolean
validateQuota(tasks: Task[], priority: Priority): string | null
applyHighlanderRule(tasks: Task[], newTask: Task): HighlanderResult  // { tasks, demoted, evicted }
isSingleSlotPriority(priority: Priority): boolean          // A, and only A
demotionTargetFor(tasks: Task[]): Priority | null    // first tier with room, null when full
suggestPriority(tasks: Task[]): Priority | null      // null when the unit is full
```

## Data Architecture

### Hot/Cold Data Separation

Data is split across three JSON files for performance:

| File | Content | Update Frequency |
|------|---------|------------------|
| `active.json` | Active tasks, trash, settings, reviews, pendingExport | High (hot data) |
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
| `!A-E` | Priority | `!A` … `!E`. Full-width `【A】` also works (CN IME) |
| `+name` | Project tag | `+work`, `+personal` |
| `@name` | Context tag | `@home`, `@office` |
| `#name` | Custom tag | `#urgent`, `#review` |
| `~date` | Due date | `~2025-01-15`, `~tomorrow`, `~+3d` |
| `thr:date` | Threshold date (hidden until) | `thr:2025-01-10`, `thr:+7d` |
| `rec:pattern` | Recurrence, todo.txt grammar | `rec:1d`, `rec:+1m`, `rec:b`, `rec:mon,wed,fri` |
| `🍅N` or `pN` | Estimated pomodoros (must stand alone) | `🍅4`, `p3` — `step2` is **not** matched |
| `when:<cue>` | Situational start cue (if-then). Takes the rest of the line | `when:明早坐下打开电脑后` |
| Emoji tags | Direct emoji classification | `⚡高能量`, `💻编码` |

**`when:` takes the rest of the line, so it goes last.** It is parsed before
every other marker, so `写周报 !A +work when:坐下后` still gets its priority and
project. "Rest of the line" means the rest of what the *user* typed: a trailing
`!X` / `【X】` is handed back to the content, because `QuickAddRow` appends the
column's priority that way and it must not end up inside the cue.

The cue is **FocusFlow-only and never written to the todo.txt** — extension
values there cannot contain spaces, and the cue belongs to the commitment
("how will I start this in the next two days") rather than to the backlog entry.
See `docs/EVIDENCE-REVIEW.md` §2.4.

**Recurrence** follows todo.txt's `rec:` grammar exactly, so a recurrence typed
here and one imported from sleek behave identically:

```
rec:[+]<n?><d|b|w|m|y>
```

- `d` days, `b` **business** days (weekends skipped), `w` weeks, `m` months, `y` years
- the count may be omitted: `rec:d` ≡ `rec:1d`
- a leading `+` means **strict**: count from the previous DUE date rather than
  the completion date. Loose is todo.txt's default and therefore ours.

Two forms have no todo.txt syntax and live only here, in `customPattern`. They
are never written into a shared file:

- `mon,wed,fri` — weekday list
- `1m@15`, `1m@last` — day-of-month selector

### Priority Quotas

| Priority | Quota | Description |
|----------|-------|-------------|
| A | 1 | Core challenge (2.5+ hours deep work, 5-12 pomodoros) |
| B | 2 | Important progress (1.5-3 hours, 3-6 pomodoros) |
| C | 3 | Standard tasks (1-2.5 hours, 2-5 pomodoros) |
| D | 4 | Temporary/unplanned tasks (25-75 min, 1-3 pomodoros) |
| E | 5 | Quick tasks (<15 min, 0-1 pomodoros) |

Completion is **not** a tier. `task.status` carries it, and `task.priority`
survives untouched — an A that got finished is still an A, so a completed task
renders in the zone it was completed from without anything having to look up
where it came from.

**A unit holds 15 tasks and nothing more.** There is no unbounded tier — the
Idea Pool is a todo.txt now — so an add that does not fit cannot be absorbed.
This is the single most important consequence of the sleek alignment, and every
quota call site has to handle it:

- `demotionTargetFor` returns `null` when B–E are all full.
- `applyHighlanderRule` returns `{ tasks, demoted, evicted }`. An **evicted**
  incumbent has been removed from the unit and belongs back in the candidate
  pool. Callers must say so, or the task simply looks like it vanished.
- `suggestPriority` returns `null` for a full unit.

**A is single-slot.** Adding a second A does NOT fail: Highlander unseats the
incumbent and moves it to the highest tier that still has room (B → C → D → E),
or evicts it. Skip the quota check for A and let Highlander place the loser.
`isSingleSlotPriority` exists so this stays one rule; S used to be the other
single-slot tier and is gone.

**Over-quota is tolerated, not impossible.** An explicit restore (undoing a
completion) may put a tier one over. Quota is a planning guardrail, not a data
invariant — every reader clamps with `Math.max(0, …)` and the meter shows the
overflow.

Use quota utilities from `src/lib/utils/quota.ts` for validation.

### The todo.txt candidate pool

Unsorted and long-horizon work lives in a `todo.txt` shared with sleek, not in
a tier here. `docs/SLEEK-INTEROP.md` is the authority; the rules that bite in code:

- **Pulling copies, it does not move.** The source line stays where it is. A
  pulled task keeps the verbatim line in `task.source.raw`, which is the only
  identity todo.txt has — the line IS the record.
- **Only two things are ever written back**, both single-token and idempotent:
  `x <date>` on completion (with `(P)` moved into `pri:P`, exactly as sleek
  does), and the `@主` / `@被` origin marker on pull.
- **Never guess a source line.** `findSourceLine` matches verbatim first, then
  on tag-stripped content, and returns `-1` otherwise. Writing to a
  near-miss rewrites somebody else's task; not writing back is the cheaper
  failure, and the user is told.
- `todotxt.ts` transcribes jstodotxt's grammar, not the todo.txt spec prose.
  The two differ in edge cases and it is sleek's behaviour that has to
  round-trip.

### Completed Task Retention

Completed tasks (G priority) stay visible, struck through, until **the end of the
2-day unit they were completed in** — not for a per-priority number of hours. A
task finished on the Monday of a Mon–Tue unit stays visible through Tuesday
23:59, regardless of whether it was an A or an E.

Use `isWithinRetentionPeriod()` and `getRetentionRemaining()` from types to check
retention status; they delegate to `isCompletedInCurrentUnit()` and
`getUnitRetentionRemaining()` in `unitCalc.ts`.

Separately, `cleanupOldTasks()` in `tasks.svelte.ts` moves G tasks out of
`active.json` into cold storage 14 days after completion, and hard-deletes
cancelled (H) tasks after 2 days.

### Bi-Daily Units

Time is organized into bi-daily units:
- Mon-Tue, Wed-Thu, Fri-Sat (work units)
- Sunday (review day)

The week therefore runs Monday-to-Sunday, and `getWeekUnits` / `isThisWeek`
both anchor on Monday. Anchoring one of them on Sunday would put the review day
in a different week from the three units it reviews.

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

### Flow metrics

`src/lib/utils/flowMetrics.ts` — Node-safe, no Svelte/Tauri/i18n, so the CLI
(`focusflow metrics`) and the tests import it directly. Exposed on the tasks
store as `flowAge` / `flowCycleTime` / `flowEstimation` / `flowSamplesNeeded`.

```typescript
ageDistribution(tasks, now?): { count, p50, p90, oldest }
cycleTimeMedian(tasks, window = 20): { value, sampleSize } | null
estimationFactor(tasks, { priority?, window? }): { value, sampleSize } | null
commitmentCount(tasks): number
samplesUntilReady(tasks): number
ageInDays(iso, now?): number
```

Rules that hold across the module, and that new metrics must keep:

- **Below `MIN_SAMPLE` (5), a median returns `null`, never a number.** The UI
  prints "3 more" rather than a figure that looks like a finding.
- **Local calendar days only** — both ends zeroed to local midnight, then
  rounded. Never `toISOString()`.
- **Cancelled (H) tasks are excluded from cycle time.** Otherwise abandoning
  work improves the number.
- **`estimationFactor` skips tasks with zero completed pomodoros** — that means
  the timer was never started, not that the work took no effort.
- **None of these gets a target value in the UI.** A target is what turns a
  measure into something to perform. See `docs/EVIDENCE-REVIEW.md` §2.2.

### No scoring, by design

There is no XP, no levels, no badges and no completion animation. They were
deleted, not switched off, and should not be reintroduced.

A per-completion score pays you for finishing many small things, which is
exactly what the quota exists to prevent — and when two mechanisms disagree,
the visible one wins. Streaks were worse: a missed day is statistically
invisible to habit automaticity, while a streak counter turns it into a reason
to abandon the whole thing.

`flowMetrics.ts` is what replaced it. Age, cycle time and calibration cannot be
driven up except by actually finishing work. See `docs/EVIDENCE-REVIEW.md` §2.1.

`storage.ts` strips a leftover `gamification` block and the retired
`gamificationEnabled` setting on load, so an upgraded file sheds them on its
next ordinary save.

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

// The shared todo.txt candidate pool.
//
// These deliberately do NOT go through tauri-plugin-fs: it scopes paths at
// build time, and this path is chosen by the user at runtime. Using the plugin
// would mean a blanket `fs:allow-*-recursive` capability opening the whole
// filesystem to the webview.
read_external_file(path: String) -> Result<Option<String>>   // None when absent
write_external_file(path: String, content: String) -> Result<()>  // temp + rename, same dir

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

`storage.ts` IS covered (`storage.test.ts`), against the real localStorage
branch: in a `node` environment `window` is undefined, so `isTauri()` picks that
branch with no mocking of the module under test, and only `localStorage` itself
is stubbed. That keeps key layout, migration chaining and the exact written
shape under test. The Tauri branch is deliberately not covered — it is the same
code with `invoke()` where `localStorage` is, so stubbing it would test the
stub — and neither are `exportData` / `importData`, thin Blob and FileReader
wrappers with no logic of their own.

Not yet covered: the Svelte stores. Most of the logic that used to hide inside
them now lives in Node-safe modules that are tested directly — `migrateV5.ts`,
`migrateV6.ts`, `todotxt.ts`, `quotaCore.ts`, `flowMetrics.ts`. For E2E,
Playwright remains the suggested future addition.

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
- `dialog:allow-open` - File picker for choosing the todo.txt (open only; no save dialog)

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
   - `migrateSettings()` for settings field additions (add a removed key to
     `REMOVED_SETTINGS` so it does not sit in the file forever)
   - `upgradeToV5()` for the current version step — note that `migrateData()`
     only handles the legacy single-file layout, so a migration wired there
     alone never runs for a real user
   - Anything non-trivial belongs in its own Node-safe module (see
     `migrateV5.ts`) so it can be tested without Tauri
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

## File Reference

| File | Purpose | Approx Lines |
|------|---------|--------------|
| `docs/SLEEK-INTEROP.md` | Design record for the todo.txt interop — the authority | ~330 |
| `docs/EVIDENCE-REVIEW.md` | Design record for the flow-metrics / gamification round, incl. what was deliberately not adopted | ~250 |
| `src/App.svelte` | Root component, layout, routing | ~955 |
| `src/lib/stores/tasks.svelte.ts` | Central state, candidate pool, write-back | ~1215 |
| `src/lib/stores/ui.svelte.ts` | UI state, modals, keyboard shortcuts | ~250 |
| `src/lib/utils/storage.ts` | Data persistence layer | ~740 |
| `src/lib/utils/todotxt.ts` | todo.txt parse/serialize (sleek-compatible) | ~410 |
| `src/lib/utils/recurrence.ts` | Recurrence engine (todo.txt `rec:` grammar) | ~395 |
| `src/lib/utils/parser.ts` | Task input parsing | ~325 |
| `src/lib/utils/unitCalc.ts` | Bi-daily unit calculations | ~285 |
| `src/lib/utils/quotaCore.ts` | Node-safe quota core (shared with CLI) | ~220 |
| `src/lib/utils/cycleEngine.ts` | Dynamic cycle / merge logic | ~175 |
| `src/lib/utils/flowMetrics.ts` | Age / cycle time / estimation factor | ~200 |
| `src/lib/utils/migrateV5.ts` | 4.0 → 5.0 data migration | ~185 |
| `src/lib/utils/migrateV6.ts` | 5.0 → 6.0 migration (completion off the priority axis) | ~110 |
| `src/lib/utils/motion.ts` | Animation tokens | ~135 |
| `src/lib/utils/todoFile.ts` | Shared todo.txt file access | ~80 |
| `src/lib/types/index.ts` | Type definitions | ~610 |
| `src/lib/components/Sidebar.svelte` | Navigation and filters | ~850 |
| `src/lib/components/TodayView.svelte` | Today-focused task view | ~760 |
| `src/lib/components/InboxPanel.svelte` | Candidate pool / pull surface | ~480 |
| `src/lib/components/CalendarView.svelte` | Monthly calendar view | ~375 |
| `src/lib/components/HistoryModal.svelte` | Completed/cancelled tasks viewer | ~395 |
| `cli/focusflow.ts` | Headless focusflow CLI | ~280 |
| `src-tauri/src/commands.rs` | Backend IPC handlers | ~505 |
| `src-tauri/src/watcher.rs` | File system watcher | ~80 |

## Rust Dependencies

Key dependencies in `src-tauri/Cargo.toml`:

| Crate | Purpose |
|-------|---------|
| `tauri` | Desktop application framework |
| `tauri-plugin-fs` | File system access |
| `tauri-plugin-notification` | System notifications |
| `tauri-plugin-dialog` | File picker (open only) |
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
| `@tauri-apps/plugin-dialog` | File picker for choosing the shared todo.txt |
