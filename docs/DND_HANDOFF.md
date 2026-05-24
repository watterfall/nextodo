# Drag-and-Drop Handoff Document

> Status: **Not working reliably**. Multiple iterations attempted; root cause partially identified but not fully resolved. Handing off for fresh eyes.
> Last update: 2026-05-24

---

## 1. Problem Statement

In the FocusFlow Tauri 2 + Svelte 5 app, the user needs to drag tasks between zones:

- Kanban columns **A, B, C, D, E** (`KanbanView.svelte`)
- ZoneRail lanes **S** (持续推进), **F** (灵感池), **N** (未来推进) (`ZoneRail.svelte`)
- S tasks contain **subtasks** that should also be draggable to any zone (promote → standalone task)

**Symptom**: Drag operations are intermittent. Some events fire, some don't. Cards visually start dragging, but drops often don't complete. Visual feedback inconsistent.

---

## 2. Tech Stack

- **Tauri 2.11** (macOS WKWebView)
- **Svelte 5** with runes (`$state`, `$derived`, `$effect`, `$props`)
- **Vite 6** build
- Custom DnD layer using native HTML5 DnD API (svelte-dnd-action was tried and abandoned)

---

## 3. Architecture Overview

```
App.svelte
  ├─ KanbanView.svelte
  │    └─ DropZone × 5 (A-E columns)
  │         └─ TaskCard (draggable=true)
  ├─ ListView.svelte
  │    └─ TaskCard (draggable=true) in group bodies
  │    └─ ZoneRail (vertical)
  ├─ ZoneRail.svelte
  │    └─ DropZone × 3 (S, F, N)
  │         ├─ TaskCard × N (draggable=true)
  │         └─ Subtask <li> (draggable=true) [S only]
  ├─ DropZone.svelte  ← drop receiver primitive
  ├─ DragDebugOverlay.svelte  ← floating event log (bottom-right)
  └─ DragSanityTest.svelte    ← minimal isolated drag test (top-right)

lib/utils/dnd.ts                ← payload encoding helpers
lib/stores/ui.svelte.ts         ← isDraggingTask global state
```

### Key files

| File | Purpose |
|---|---|
| `src/lib/utils/dnd.ts` | MIME-type encoding, setDragImage helpers |
| `src/lib/components/DropZone.svelte` | Reusable drop receiver, visual feedback, validation |
| `src/lib/components/TaskCard.svelte` | Draggable task card |
| `src/lib/components/ZoneRail.svelte` | S/F/N rail (lanes wrapped in DropZone) |
| `src/lib/components/KanbanView.svelte` | A-E columns (each wrapped in DropZone) |
| `src/lib/components/DragSanityTest.svelte` | Standalone test panel (TOP-RIGHT) |
| `src/lib/components/DragDebugOverlay.svelte` | Live event log (BOTTOM-RIGHT) |
| `src/lib/stores/ui.svelte.ts` | `isDraggingTask`, `dragSourcePriority`, `setDraggingTask()` |
| `src-tauri/tauri.conf.json` | Has `dragDropEnabled: false` set on window (file-drop disabled to free up DnD events) |
| `src-tauri/Cargo.toml` | `tauri = { features = ["devtools"] }` (devtools enabled in release) |

---

## 4. Iterations & Findings

### 4.1 First attempt: svelte-dnd-action library

Used `use:dndzone={{items, type: 'task', ...}}` on multiple containers.

**Problems found and "fixed"** (but full reliability never achieved):
- dndzone was on `<section>` with header + body siblings → svelte-dnd-action expects direct children = items. **Fix**: moved dndzone to inner `.card-list` div.
- KanbanView's dndzone missing `type: 'task'` while ZoneRail had it → type mismatch silently blocks cross-zone drag. **Fix**: added `type: 'task'`.
- Source-zone `reorderTask` racing with destination's `changePriority` on cross-zone drops. **Fix**: skip reorderTask if `info.trigger === TRIGGERS.DROPPED_INTO_ANOTHER`.

Despite all of these, behavior remained flaky.

### 4.2 Second attempt: Native HTML5 DnD (CURRENT)

Abandoned svelte-dnd-action. Rebuilt using native HTML5 DnD:

- TaskCard: `draggable="true"` + `ondragstart` writes custom MIME via `dataTransfer.setData()`.
- DropZone: listens for `ondragenter` / `ondragover` (preventDefault) / `ondrop` (read MIME, call handler).
- Subtask `<li>` elements also `draggable="true"` with subtask MIME.

### 4.3 Critical environment fixes applied

1. **Tauri window config** — `dragDropEnabled: false`
   - Default is `true`, which makes Tauri intercept drag events at the window level for OS file-drop. Setting to `false` lets the webview see them.
2. **WKWebView CSS** — `[draggable="true"] { -webkit-user-drag: element; user-select: none; }`
   - WKWebView needs explicit `-webkit-user-drag: element` on non-link/img elements.
3. **`setDragImage(currentTarget, offsetX, offsetY)`** in `dragstart`
   - WKWebView fails to materialize the visual drag without an explicit drag image.

### 4.4 Last attempted fix (current state)

**Issue discovered via the live event overlay**: `dragstart` and `dragend` fire on `div.task-card`, but `drop` never fires.

**Root cause** (suspected): WKWebView (and Firefox) **hide custom MIME types from `e.dataTransfer.types` during dragenter/dragover** for security. Only the standard types are visible. So our `isTaskDragType(e)` check (which looks for `application/x-focusflow-task`) returns `false`, the DropZone never calls `preventDefault()` on dragover, and per HTML5 spec the drop never fires.

**Attempted fix**: In `DropZone.svelte`, replaced MIME check during dragenter/over/leave with a global `ui.isDraggingTask` state check (set by TaskCard at dragstart, cleared at dragend). On drop, still read the real payload via `getTaskDragPayload(e)` / `getSubtaskDragPayload(e)`.

**Status**: User reports it's still not working reliably. **The drop may now fire, but the data flow / state update may still be broken, OR another layer is intercepting events.**

---

## 5. Verified working: the sanity test panel

`DragSanityTest.svelte` (top-right red-bordered panel) successfully:
```
55:20.037 ▶ dragstart fired
55:20.148 ↪ dragenter on drop-box
55:20.497 ✅ drop received: "sanity"
55:20.501 ✓ dragend fired
```

This proves WKWebView native DnD works correctly when:
- `draggable="true"` literal attribute
- `e.dataTransfer.setData('text/plain', ...)` (NOT a custom MIME)
- Drop zone calls `e.preventDefault()` in dragover unconditionally

**Difference vs production TaskCard**: production uses a custom MIME (`application/x-focusflow-task`). Sanity test uses `text/plain`. This is the strongest hypothesis for the remaining failure.

---

## 6. Recommended next steps (in priority order)

### Option A: Switch from custom MIME to `text/plain` with JSON payload

Instead of:
```ts
e.dataTransfer.setData('application/x-focusflow-task', JSON.stringify(payload));
```

Do:
```ts
e.dataTransfer.setData('text/plain', `task:${JSON.stringify(payload)}`);
// for subtasks:
e.dataTransfer.setData('text/plain', `subtask:${JSON.stringify(payload)}`);
```

Then in DropZone's `handleDrop`, read `text/plain`, check prefix, parse JSON. This avoids the WKWebView custom-MIME quirk entirely.

The sanity test proves `text/plain` works perfectly in this environment.

### Option B: Use a battle-tested library that solves these issues

- `@thisux/sveltednd` — modern Svelte 5-friendly DnD
- `pragmatic-drag-and-drop` (Atlassian) — actively maintained, designed for cross-environment compatibility, supports WKWebView

### Option C: Reconsider DnD entirely

DnD inside Tauri WKWebView has many quirks. Alternative interactions already implemented:
- Right-click context menu on TaskCard with "Move to A/B/C/D/E/S/F/N" options (in `TaskCard.svelte`)
- Subtask `↗` promote button with priority picker popup (in `ZoneRail.svelte`)

These work reliably and may be sufficient.

---

## 7. How to test

### Build and run

```bash
cd /Users/jili/Documents/GitHub/nextodo
npm run tauri:build   # Rust release compile ~15s, full build ~1 min
# .app: src-tauri/target/release/bundle/macos/FocusFlow.app
```

DMG bundling fails consistently due to `bundle_dmg.sh` osascript issue — use `hdiutil` manually:
```bash
hdiutil create -volname "FocusFlow" \
  -srcfolder /Applications/FocusFlow.app \
  -ov -format UDZO /tmp/FocusFlow.dmg
```

### Install + launch

```bash
osascript -e 'tell application "FocusFlow" to quit'
rm -rf /Applications/FocusFlow.app
cp -R src-tauri/target/release/bundle/macos/FocusFlow.app /Applications/
xattr -dr com.apple.quarantine /Applications/FocusFlow.app
open /Applications/FocusFlow.app
```

### Test workflow

1. App opens with sample data (or create some tasks)
2. **Sanity test panel** (top-right red-bordered): drag 🔴 to 🟢, expect log entries `dragstart fired` → `dragenter on drop-box` → `drop received: "sanity"` → `dragend fired`. **This works.**
3. **DnD events overlay** (bottom-right): live event log
4. Try dragging a real `TaskCard` from F lane to a Kanban column or vice versa.
   - Expected: `dragstart` (green) → `dragenter` (purple) → `dragover` (blue, throttled) → `drop` (orange) → `dragend` (gray) events on `div.task-card` and target zones
   - Currently observed: dragstart + dragend appear, drop does NOT (this is the failure)
5. **Right-click → "检查元素"** opens WebKit devtools. Console will show `[TaskCard] dragstart abc... 'A'` when drag starts. Check Elements tab to verify `draggable="true"` attribute is present on `.task-card`.

---

## 8. Specific code locations to inspect

### DropZone drop handler (lib/components/DropZone.svelte ~line 50)
```ts
async function handleDrop(e: DragEvent) {
  e.preventDefault();
  e.stopPropagation();
  depth = 0;
  const subPayload = getSubtaskDragPayload(e);
  if (subPayload && onSubtaskDrop) { ... }
  const taskPayload = getTaskDragPayload(e);
  if (taskPayload && onTaskDrop) { ... }
}
```

If `getTaskDragPayload` returns null when it shouldn't, the drop is silently ignored. Add `console.log(e.dataTransfer.types, e.dataTransfer.getData('application/x-focusflow-task'))` for diagnosis.

### TaskCard dragstart (lib/components/TaskCard.svelte ~line 167)
```ts
draggable="true"
ondragstart={(e) => {
  console.log('[TaskCard] dragstart', task.id, task.priority);
  if (!isOperablePriority(task.priority)) { e.preventDefault(); return; }
  startTaskDrag(e, { taskId: task.id, fromPriority: task.priority });
  setDraggingTask(true, task.priority);
}}
ondragend={() => setDraggingTask(false)}
```

### startTaskDrag (lib/utils/dnd.ts)
```ts
export function startTaskDrag(e: DragEvent, payload: TaskDragPayload): void {
  if (!e.dataTransfer) return;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData(TASK_DRAG_MIME, JSON.stringify(payload));   // ← suspect
  e.dataTransfer.setData('text/plain', payload.taskId);
  applyDragImage(e);
}
```

`TASK_DRAG_MIME = 'application/x-focusflow-task'` — this is likely the failure point per Option A above.

### Global drag state (lib/stores/ui.svelte.ts)
```ts
let isDraggingTask = $state(false);
let dragSourcePriority = $state<Priority | null>(null);

export function setDraggingTask(active: boolean, sourcePriority: Priority | null = null): void {
  isDraggingTask = active;
  dragSourcePriority = active ? sourcePriority : null;
}
```

---

## 9. Recommended fix (concrete)

Apply **Option A** above — switch to `text/plain` + JSON prefix encoding:

```ts
// lib/utils/dnd.ts — proposed rewrite
const TASK_PREFIX = '__ff_task__';
const SUB_PREFIX = '__ff_sub__';

export function startTaskDrag(e: DragEvent, payload: TaskDragPayload): void {
  if (!e.dataTransfer) return;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', TASK_PREFIX + JSON.stringify(payload));
  applyDragImage(e);
}

export function startSubtaskDrag(e: DragEvent, payload: SubtaskDragPayload): void {
  if (!e.dataTransfer) return;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', SUB_PREFIX + JSON.stringify(payload));
  applyDragImage(e);
}

export function getTaskDragPayload(e: DragEvent): TaskDragPayload | null {
  const raw = e.dataTransfer?.getData('text/plain') ?? '';
  if (!raw.startsWith(TASK_PREFIX)) return null;
  try { return JSON.parse(raw.slice(TASK_PREFIX.length)); } catch { return null; }
}

export function getSubtaskDragPayload(e: DragEvent): SubtaskDragPayload | null {
  const raw = e.dataTransfer?.getData('text/plain') ?? '';
  if (!raw.startsWith(SUB_PREFIX)) return null;
  try { return JSON.parse(raw.slice(SUB_PREFIX.length)); } catch { return null; }
}

// isTaskDragType can be removed — DropZone now uses ui.isDraggingTask instead
```

Then in DropZone, drop handler can keep using `getTaskDragPayload(e)` / `getSubtaskDragPayload(e)` unchanged.

This should resolve the WKWebView MIME visibility issue because `text/plain` is always visible across all browsers in all drag events.

---

## 10. State data model (for context)

```ts
// lib/types/index.ts
export type Priority = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'N' | 'S';

// A-E: quotaed work priorities
// F: idea pool, unlimited
// S: sustained progress, quota 1, has subtasks
// N: future progress, unlimited
// G: completed (hidden)
// H: cancelled (hidden)

export interface Subtask {
  id: string;
  content: string;
  completed: boolean;
  completedAt?: string | null;
}

export interface Task {
  id: string;
  content: string;
  priority: Priority;
  // ... many other fields
  subtasks?: Subtask[];
  evolvedFrom?: string;  // parent task ID when promoted from subtask
}
```

Store actions used by drop handlers:
- `changePriority(taskId, newPriority)` — moves a task to a new priority zone
- `promoteSubtask(parentTaskId, subtaskId, targetPriority)` — converts a subtask into a standalone task
- `applyHighlanderRule(...)` — automatically demotes existing A → B when a new A is created

---

## 11. Debug tools to leave in / remove

Currently in the build for debugging:

| Component | Location | Purpose | Should remove? |
|---|---|---|---|
| `DragDebugOverlay.svelte` | bottom-right | Live event log | Yes once fixed |
| `DragSanityTest.svelte` | top-right red box | Minimal DnD sanity check | Yes once fixed |
| `console.log('[TaskCard] dragstart', ...)` | TaskCard ondragstart | Devtools trace | Yes once fixed |

These were added for triage. Remove them once DnD is verified working.

Also revert `src-tauri/Cargo.toml`:
```toml
tauri = { version = "2.11", features = ["devtools"] }  # remove "devtools" for production
```

---

## 12. Summary of files modified in this DnD effort

```
modified:   src/App.svelte                              (added DragDebugOverlay + DragSanityTest mounts)
modified:   src/app.css                                 (added [draggable="true"] WKWebView CSS)
modified:   src/lib/components/KanbanView.svelte        (uses DropZone, removed svelte-dnd-action)
modified:   src/lib/components/ListView.svelte          (two-column layout with ZoneRail)
modified:   src/lib/components/TaskCard.svelte          (draggable=true, dragstart/end handlers)
modified:   src/lib/components/ZoneRail.svelte          (S/F/N lanes, all use DropZone)
modified:   src/lib/stores/ui.svelte.ts                 (isDraggingTask, setDraggingTask)
new file:   src/lib/components/DropZone.svelte         (reusable drop receiver)
new file:   src/lib/components/DragDebugOverlay.svelte (live event log)
new file:   src/lib/components/DragSanityTest.svelte   (minimal isolated test)
new file:   src/lib/utils/dnd.ts                       (MIME + payload helpers, setDragImage)
modified:   src-tauri/tauri.conf.json                   (dragDropEnabled: false)
modified:   src-tauri/Cargo.toml                        (tauri features += devtools)
```

Git history will show ~15 commits of iteration. The most recent state is the native HTML5 attempt with the MIME-visibility workaround using `ui.isDraggingTask`.

---

## Final note

The fundamental issue throughout has been **WKWebView quirks** that don't show up in standard browsers. Every layer of indirection (dnd library, custom MIME, complex component nesting) compounded debugging. Recommend **Option A (text/plain encoding)** as the most direct path to a working state — it matches exactly what the sanity test panel does, which is verified working.
