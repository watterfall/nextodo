# FocusFlow 迭代路线（本轮）

> 来源：任务管理视角的多视角产品评审（议会综合）。本轮聚焦 P0 工具地基 + 1 项 P1 透明化。
> P2 战略项（简化优先级档位 vs 上同步/移动）需产品定调，本轮不动；但每项改动尽量为未来保留余地。
> 状态：**待评审，未动手**。逐项标注「验收标准」与「待定子决策」。

---

## W1 · i18n 全量修复 (P0 · 量 S–M)

**问题**：硬编码中文散落在工具与组件里，en-US 用户看到中英混杂。

**依据（已核实）**
- `src/lib/utils/quota.ts`：`validateQuota` 的 S 提示(L64)、配额上限(L76)；番茄区间提示(L232/236)。该文件目前未引入 i18n。
- `src/lib/components/KanbanView.svelte`：空列提示 `拖任务到此 ↓`；toast `已移到…/移动失败/提升失败/子任务已提升到…`。
- `src/lib/components/ListView.svelte`：`拖任务到此`、同款 toast。
- 其余 `t('x') || '中文'` 兜底可保留，但优先补齐键。

**改动**
- `quota.ts` 改为返回 i18n key（或 `import { t }`，与 `tasks.svelte.ts` 同法）；DnD toast/空列提示全部走 `t()`。
- 新增键（zh-CN + en-US 对齐）：`dnd.dropHere`、`message.movedTo`、`message.moveFailed`、`message.promoteFailed`、`message.promotedTo`、`quota.full`、`quota.sExists`、`pomodoro.noLimit`、`pomodoro.rangeHint`。

**验收**：设置切到 en-US → 超配额添加、跨列拖拽、空列提示、番茄提示全部英文，无中文泄漏；切回 zh-CN 正常。

**待定子决策**：`quota.ts` 用「返回 key 由调用方翻译」还是「直接 import t」。倾向后者（改动最小）。

---

## W2 · 数据安全：G 归档 + 导出/导入接 UI (P0 · 量 M)

**问题**
1. 已完成任务(G)永不清理——`cleanupOldTasks` 只过滤 H，G 在 `active.json` 无限堆积。
2. `storage.ts` 的 `exportData`(L559)/`importData`(L575) **已实现但全项目无调用方**，等于功能写了没接。

**改动**
- **G 归档**：在 `cleanupOldTasks` 增加：单元已结束且超过宽限期（默认 `autoArchiveDays`）的 G 任务，移出 `active.json`。复用后端 `append_archive_tasks`（`commands.rs` 已有）做冷存；`HistoryModal` 读冷存以保留历史可见。
- **导出/导入**：`SettingsModal.svelte` 加「导出 JSON / 导入 JSON」按钮，分别调 `exportData(appData)` / `importData(file)`。

**验收**
- 造一批 `completedAt` 很旧的 G → 重启后这些从 `active.json` 移除、文件变小，History 仍能看到。
- 点导出 → 下载 JSON；选文件导入 → 任务载入（**导入前弹确认 + 自动备份**，因为是覆盖式）。

**待定子决策**
- G 归档：**冷存（append_archive_tasks）** vs 直接裁剪删除。倾向冷存（不丢历史）。
- HistoryModal 是否需要改成「活跃 G + 冷存 G」合并读取（冷存方案下需要）。
- 导入语义：整体覆盖 vs 合并去重。倾向覆盖 + 先自动备份。

---

## W3 · 截止日提醒 (P0 · 量 M)

**问题**：`tauri-plugin-notification` 仅用于番茄钟（`pomodoro.svelte.ts`/`ui.svelte.ts`），**截止日/逾期无任何提醒**。

**改动**
- 复用现有通知调用方式；在启动 + 跨天时，对「今天到期且未完成 / 已逾期」的任务发汇总通知（如「今天有 N 个任务到期」）。
- 设置加开关 `dueReminders`（默认开）；按天去重，避免每次启动刷屏。

**验收**：设一个今天到期任务 → 重启收到通知；关闭开关 → 无通知；同一天多次启动不重复提醒。

**待定子决策**
- 即时汇总通知（启动/跨天触发）vs 定时调度（需 OS schedule 能力，成本更高）。倾向先做即时汇总。
- 权限被拒时的降级处理。

---

## W4 · 动态合并透明化 (P1 · 量 M–L)

**问题**：`<30%` 静默合并，用户无感知（议会 Contrarian：可能纵容拖延；Empath/Architect：不可见的自动化=混乱）；且**无完成率历史、无埋点**，等于在没仪表盘下调引擎。

**改动**
- **(a) merged 可见标记**：`UnitNav.svelte` 在 `cycleState.merged` 时显示「延续窗口」徽章 + 一句 tooltip 解释。
- **(b) 显式微复盘**：期末完成度 <30% 时，由静默合并改为轻量提示（启动横幅/小弹层）：「上期仅完成 X%，顺延哪些 / 砍哪些」，用户确认后再执行顺延。可跳过（跳过=沿用现自动合并）。
- **(c) 完成率历史 + 埋点**：新增 `cycleHistory: {periodStart, completion, merged}[]`（随 `cycleState` 持久化），在复盘/今日视图加一个完成率 sparkline。

**验收**：造 <30% 数据 → 启动看到微复盘提示 + 单元导航「延续」标记；历史小图体现这次低谷；造 ≥30% → 无提示、正常推进。

**待定子决策**
- (b) 微复盘以「启动弹层」还是「非阻塞横幅」呈现。倾向非阻塞横幅（不打断打开）。
- (b) 是否保留「全自动」作为可选项（设置开关）。
- (c) sparkline 放复盘面板还是今日视图。

---

## P2 · 战略抉择（本轮不做，待定调）

- **简化优先级档位**（Minimalist：A-F/S/N/G/H 共 10 档→录入税）**vs 上同步/移动**（Futurist：当前单机+本地存储锁死扩展）。
- 无论选哪条，**先给 `Task` 补 `updatedAt`、把 `cycleState` 设计成可由任务流重算**，为同步保留余地。
- 议会留的问题：*若只能保留 3 个机制（配额 / 2天单元 / 动态合并 / 游戏化 / 番茄 / 复盘），你留哪 3 个？* —— 答案即产品定位。

---

## 建议落地顺序
W1（独立、低风险）→ W2（数据安全）→ W3（提醒）→ W4（最大、含 UX 改动）。每项完成后构建 + 浏览器实测（en-US 切换 / 导入导出 / 通知 / <30% 数据）。
