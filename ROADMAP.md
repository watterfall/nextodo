# FocusFlow 迭代路线（本轮）

> 来源：任务管理视角的多视角产品评审（议会综合）。本轮聚焦 P0 工具地基 + 1 项 P1 透明化。
> P2 战略项（简化优先级档位 vs 上同步/移动）需产品定调，本轮不动；但每项改动尽量为未来保留余地。
> 状态：**W1–W4 + CLI 已随 commit `57b963a` 发布**。P2 战略抉择仍待定调。逐项保留「验收标准」与「待定子决策」以备回溯。

---

## ✅ W1 · i18n 全量修复 (P0 · 量 S–M) — 首轮随 57b963a 发布，2026-08-24 补完

> 注：57b963a 修掉了 `quota.ts` 的配额提示和 DnD toast，但**漏了每张任务卡上的日期与循环标签**
> （`getRelativeDayLabel` / `formatRecurrence` 硬编码中文），en-US 用户仍能看到中文。
> 已在「代码评审修复轮」补齐，并加了 locale 键集一致性测试防回归。

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

## ✅ W2 · 数据安全：G 归档 + 导出/导入接 UI (P0 · 量 M) — 已完成（随 57b963a 发布）

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

## ✅ W3 · 截止日提醒 (P0 · 量 M) — 已完成（随 57b963a 发布）

**问题**：`tauri-plugin-notification` 仅用于番茄钟（`pomodoro.svelte.ts`/`ui.svelte.ts`），**截止日/逾期无任何提醒**。

**改动**
- 复用现有通知调用方式；在启动 + 跨天时，对「今天到期且未完成 / 已逾期」的任务发汇总通知（如「今天有 N 个任务到期」）。
- 设置加开关 `dueReminders`（默认开）；按天去重，避免每次启动刷屏。

**验收**：设一个今天到期任务 → 重启收到通知；关闭开关 → 无通知；同一天多次启动不重复提醒。

**待定子决策**
- 即时汇总通知（启动/跨天触发）vs 定时调度（需 OS schedule 能力，成本更高）。倾向先做即时汇总。
- 权限被拒时的降级处理。

---

## ✅ W4 · 动态合并透明化 (P1 · 量 M–L) — 已完成（随 57b963a 发布）

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

---

## 本轮交付小结（随 57b963a 发布）

- **W1–W4 全部落地**：i18n 全量修复、G 归档 + 导出/导入接入设置、截止日/逾期提醒、动态合并透明化（延续窗口徽章 + 低完成度微复盘横幅 + 完成率 sparkline）。
- **CLI 首发**：`cli/focusflow.ts`（`add / list / done / cancel / import-reminders / agent-guide`）。`npm run cli:build` 用 esbuild 打包到 `dist-cli/focusflow.mjs`，`npm run cli` 运行；与应用共用 Node 安全的配额内核 `quotaCore.ts`。
- **优先级扩档**：新增 N（未来推进，长期但非紧急、默认隐藏）与 S（持续推进，本周唯一、用子任务分解）两档。

---

## 代码评审修复轮（2026-08-24）

一次深度评审（含对抗验证）在 `57b963a..148d38c` 这批改动上查出 15 项问题，全部逐条复现后修复。要点：

**正确性（用户可见）**
- **循环任务在 UTC 以东永不推进**：`formatDateISO` 用 `toISOString()` 输出，但日期是按本地午夜构造的。在 `Asia/Shanghai`（应用默认 locale 所在时区）下 `rec:1d` 返回**同一天**，每日循环任务永远卡住；`1w` 差一天。已改为按本地日期分量格式化。
- **月度循环跳月**：`setMonth(+1)` 在 1 月 31 日溢出成 3 月 3 日，整个二月被跳过。已改为钳到目标月最后一天。
- **CLI `done` 杀死循环**：CLI 不生成下一次occurrence，而应用的启动补偿又把 G 过滤掉了，两头都不管 → 任务静默消失。CLI 现在复用 `createNextOccurrence`，补偿路径也修好了（原先因为过滤 A–F 而**永远不可达**）。
- **配额可被撑爆**：Highlander 把旧 A 无条件降成 B，B 满了就变成 3/2 的非法状态。改为沿 B→C→D→E→F 找第一个有空位的档。
- **未处理的微复盘被静默丢弃**：下一周期正常时 `pendingReview` 被覆盖成 null，那一期的未完成任务从此不在任何窗口里显示。
- **灵感池拖低完成率**：F 是无上限的，却计入 30% 合并阈值——攒够 20 条灵感就能触发一次假的窗口合并，还会把整池拖进下一窗口。已限定 A–E。
- **单元导航不可逆**：`prev` 固定 -2 天会跳过周六复盘日，导致过去的复盘无法回看。改为按单元边界推导，prev/next 严格互逆。
- **文档里的语法本来是坏的**：`~+3d`、`thr:+7d`、`rec:1m@15`、`rec:1m@last` 全部失效——`+project`/`@context` 抽取跑在前面，把操作数吃掉了。已调整解析顺序（选择修解析器而不是删文档）。
- **`p3` 会匹配单词内部**：`step2 done` 被解析成 2 个番茄钟 + 内容 `ste done`，静默改坏输入。已加独立 token 约束。

**i18n**
- `getRelativeDayLabel` / `formatRecurrence` 硬编码中文，en-US 用户**每张任务卡**都能看到；`quota.ts` 还有一句未翻译的英文。已全部走 i18n；`getRelativeDayLabel` 删除（`i18n.getRelativeDate` 是它的本地化重复实现）。
- 新增 `src/lib/i18n/parity.test.ts` 断言两个 locale 键集完全一致——组件里 `t('x') || '中文'` 兜底遍地都是，缺键不会报错，只会静默漏中文。
- 按中文子串判错误类型（`error.includes('配额')`）和对译文做 `.replace()` 字符串手术两处已改掉。

**测试与门禁**
- **摘掉 `vitest.config.ts` 的 `TZ=UTC` 钉子**——它恰好是循环引擎唯一正确的时区，等于把 bug 写成了规格。`npm test` 现在跑两遍（本地时区 + `Asia/Shanghai`）。
- 有 6 条测试是以「documents current behavior」为名把 bug 锁进去的，已全部改成正确期望。
- CLI 此前在**所有**门禁之外：新增 `cli/focusflow.test.ts`（构建真二进制、以子进程打临时数据文件，7 个用例），并把 `tsc -p cli/tsconfig.json` 接进 `npm run typecheck`。
- 测试数 101 → 122。

**清理**
- 删除两个死运行时依赖：`motion` 和 `svelte-dnd-action`（全仓零 import，项目早已迁到原生 HTML5 DnD）。
- 删除死代码：`getUnitStartString`、`motion.ts` 里的 dnd 类型再导出、KanbanView 的 `ideaPoolTasks`/`ideaPoolDimmed`（永远为空且从未渲染）、`parser.ts` 里与 `recurrence.ts` 重复的第二套循环引擎。
- CLAUDE.md 三处失实已修：保留期机制（早已改为按 2 天单元，文档还写着按优先级算小时）、DnD 库、依赖表。

**未做**：`storage.ts`（661 行，持久化 + 迁移 + 原子写）和各 store 仍然零测试——这是当前最大的测试缺口。

---

## 工具链升级轮（2026-07-05）

- **构建 / 框架升级**：Vite 8（Rolldown 内核，去掉 rollup 依赖与 `@rollup/rollup-darwin-arm64` pin）、`@sveltejs/vite-plugin-svelte` 7、Svelte 5.56、Tauri CLI/API 2.11、TypeScript 5.9、esbuild 0.28。
- **引入测试与类型检查**：新增 Vitest 4（`npm test` / `npm run test:watch`；`vitest.config.ts` 用 node 环境 + `$lib` 别名，测试就近放在 `src/**/*.test.ts`）与 svelte-check（`npm run check`）。
- **清理死代码**：删除 `ZoneContainer.svelte`、`WeekView.svelte`（`InboxPanel.svelte` 更早已移除）。
- **修复 i18n 日期本地化 bug**（en-US 下日期不再回落中文格式）。
