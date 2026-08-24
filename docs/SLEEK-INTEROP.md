# FocusFlow × sleek 互通规格

本文是 FocusFlow 改为「以 sleek 的 todo.txt 作为候选池」这次改造的设计正本。
所有字段级、语法级的细节以本文为准；实现和本文不一致时，改实现或改本文，不留第三种状态。

写作日期：2026-08-24
参照的 sleek 版本：`ransome1/sleek` @ `8c946ab`（依赖 `jstodotxt@1.0.0-alpha.3`）

---

## 1. 这次改造要达成什么

FocusFlow 原本自己既管"候选任务"（F 灵感收集、N 未来推进），又管"当前两天做什么"。
候选池那一半和 sleek 高度重叠，而 sleek 用纯文本存储、数据天然可共享。
所以：**候选池整个交给 sleek，FocusFlow 只保留"当前两天的专注面"**。

五个已定的决策：

| # | 决策 | 内容 |
|---|------|------|
| D1 | 数据归属 | sleek 的 todo.txt 是候选池的唯一来源。FocusFlow 保留自己的 `active.json`，通过一次显式的「拉取」把候选变成本地任务。**不做双向同步。** |
| D2 | F / N | 两个档位全部删除。F 的语义变成"todo.txt 里还没被拉取的行"，N 的语义用 sleek 原生的 `t:`（阈值日期）或 `h:1`（隐藏）表达。 |
| D3 | S | 不再是优先级。"本周唯一的持续推进项目"变成一个 todo.txt `+project` 标签，子任务就是带同一个标签的普通任务行。`Subtask[]` 类型删除。 |
| D4 | 主动 / 被动 | 用 todo.txt 原生 context：`@主` / `@被`。在拉取时用两个按钮捕获，默认主动。 |
| D5 | 单元周期 | 从「周日+周一 / 周二+周三 / 周四+周五 / 周六复盘」改为「**周一+周二 / 周三+周四 / 周五+周六 / 周日复盘**」。 |

---

## 2. sleek 的数据契约（源码实测，非文档转述）

### 2.1 行语法

`jstodotxt` 的 `Item.ts` 里只有三条正则：

```js
rTodo = /^((x) )?(\(([A-Z])\) )?(((\d{4}-\d{2}-\d{2}) (\d{4}-\d{2}-\d{2})|(\d{4}-\d{2}-\d{2})) )?(.*)$/
rTags = /(^|\s)([^\s:]+:[^\s:]+|[+@]\S+)/g
rDate = /^\d{4}-\d{2}-\d{2}$/
```

由此得到的硬性边界，实现时必须照抄：

- `x` 只在**行首**且后跟一个空格时才算完成标记。
- 优先级必须是**单个大写字母** A–Z，形如 `(A) `。`setPriority` 会对不合法的值抛错。
- 日期段：出现**两个**日期时，第一个是完成日、第二个是创建日；只出现**一个**时它是创建日。
- context 是 `@\S+` —— `@` 后面任何非空白都算，所以 `@主`、`@+`、`@!` 全部合法。
- project 是 `+\S+`，同上。
- 扩展字段是 `[^\s:]+:[^\s:]+` —— **key 和 value 都不能含冒号或空白**。
  这条限制掉了一整类编码方案：任何想把 ISO 时间戳（`2026-08-24T10:30:00`）
  或带冒号的结构塞进 value 的做法都会被截断。

### 2.2 往返保真

`toString()` 是 `[x, (P), 完成日, 创建日, body].join(' ')`，**body 逐字保留**。
sleek 读文件用 `new Item(line)`、写文件用 `.toString()`（`CreateTodoObjects.ts` / `Write.ts`），
所以：

> **sleek 不会吃掉它不认识的任何东西。**

代价是它也不会*渲染*这些东西——sleek 只把 `due` / `t` / `rec` / `pm` / `h` / `pri`
渲染成可点击的 chip，其余一律作为正文纯文本原样显示。
所以 FocusFlow 往行里加的东西必须**又短又少**，否则用户在 sleek 里看到的是一行噪音。

这条同时说明了一件好事：**`#tag` 不是损失项**。todo.txt 没有 `#` 概念，
但 `#紧急` 会作为正文文本原样保留，FocusFlow 导入时自己再解析一遍即可。

### 2.3 sleek 认识的属性

| 属性 | 含义 | 备注 |
|------|------|------|
| `(A)`–`(Z)` | 优先级 | sleek 只给 A–C 上色条，D 及以后是灰的 |
| `x ` + 日期 | 完成 | |
| `+project` / `@context` | 项目 / 处境 | |
| `due:` | 到期日 | 支持 `due:tomorrow` 这类自然语言，解析时才转成绝对日期 |
| `t:` | 阈值日期（此日期前隐藏） | 同样支持自然语言 |
| `rec:` | 递归 | 见 §4 |
| `pm:` | 番茄数 | **sleek 解析并显示，但没有任何功能挂在上面**（wiki 原话：只为兼容其他工具） |
| `h:1` | 隐藏 | |
| `pri:` | 完成时暂存的优先级 | sleek 完成任务时把 `(A)` 挪进 `pri:A`，取消完成时还原 |

`pm:` 是这次互通里最顺的一个契合点：sleek 留了字段没留功能，FocusFlow 正好是给它意义的那一侧。

### 2.4 归档

sleek 的归档是把所有 `x ` 开头的行从 `todo.txt` 剪切、追加到用户指定的 `done.txt`
（`Archive.ts`）。两个路径都在 sleek 自己的配置里，**FocusFlow 读不到**，
所以 FocusFlow 必须让用户分别指定这两个文件（见 §6.4 的失配处理）。

---

## 3. 字段映射

⇄ = 双向；← = 只导入；✗ = 不跨界

| FocusFlow `Task` | todo.txt | 方向 | 说明 |
|---|---|---|---|
| `content` | body（剥掉已识别的 tag 之后） | ⇄ | |
| `priority` A–E | `(A)`–`(E)` | ⇄ | |
| `completed` | 行首 `x ` | ⇄ | |
| `completedAt` | 完成日期 | ⇄ | todo.txt 只有日期精度，导入时补 `T00:00:00` 本地时间 |
| `createdAt` | 创建日期 | ⇄ | 同上 |
| `projects` | `+p` | ⇄ | |
| `contexts` | `@c` | ⇄ | 含 `@主` / `@被` |
| `customTags` | body 里的 `#t` | ⇄ | sleek 不识别但逐字保留，FocusFlow 自己解析 |
| `dueDate` | `due:` | ⇄ | 自然语言日期在导入时归一为绝对日期 |
| `thresholdDate` | `t:` | ⇄ | 同上 |
| `recurrence` | `rec:` | ⇄ | 见 §4 |
| `pomodoros.estimated` | `pm:` | ⇄ | |
| `originalPriority` | `pri:` | ⇄ | 语义完全一致 |
| — | `h:1` | ← | 隐藏行默认不进候选列表；可在拉取面板里勾选"包含隐藏" |
| `pomodoros.completed` | — | ✗ | FocusFlow 独有 |
| `notes` | — | ✗ | FocusFlow 独有。sleek 用 `0x10` 占位符支持行内换行，本次不实现 |
| `unitStart` | — | ✗ | FocusFlow 独有 |
| `id` | — | ✗ | todo.txt 的身份就是那一行文本，见 §5 |
| 取消态 `H` | — | ✗ | todo.txt 只有完成/未完成二态。取消是 FocusFlow 本地状态，**不写回**，源行原样留在 todo.txt 里 |

---

## 4. `rec:` 语法映射

### 4.1 todo.txt 的语法

```
rec:[+]<n?><d|b|w|m|y>
```

- `n` 省略时等于 1（`rec:d` ≡ `rec:1d`）
- `b` = 工作日（跳过周六周日）
- `+` = **严格递归**：新到期日 = 上次**到期日** + 间隔
- 无 `+` = **宽松递归**：新到期日 = **完成日** + 间隔（todo.txt 的默认）

### 4.2 FocusFlow 侧的改造

现有的 `RecurrencePattern` 是七个字面量的枚举（`'1d'|'2d'|'3d'|'1w'|'2w'|'1m'|'3m'`）
外加一个 `customPattern` 字符串兜底。这个结构和 todo.txt 对不齐，也表达不了 `b` / `y` / 任意 `n`。
改成和 todo.txt 一一对应的结构：

```ts
interface Recurrence {
  n: number;                 // >= 1
  unit: 'd' | 'b' | 'w' | 'm' | 'y';
  strict: boolean;           // true 对应 rec:+
  customPattern?: string;    // todo.txt 表达不了的，见下
  nextDue: string | null;
}
```

七个旧枚举值全部是合法 todo.txt 语法，映射是恒等的：
`1d→{1,d}`、`2d→{2,d}`、`3d→{3,d}`、`1w→{1,w}`、`2w→{2,w}`、`1m→{1,m}`、`3m→{3,m}`。

`customPattern` 保留给 todo.txt 表达不了的两类：`mon,wed,fri` 和 `1m@15` / `1m@last`。
这两类在 D1 的单向模型下不构成问题——**写回只有一个 `x`**，不需要把 recurrence 序列化回文件。

### 4.3 `strict` 的默认值：一个会改变现有行为的点

现在 `createNextOccurrence` 调用的是
`calculateNextDue(recurrence, parseISODate(task.dueDate))` ——
**从上次到期日推算，也就是 todo.txt 的严格语义**。而 todo.txt 的默认是宽松。

处理方式：

- 语义统一按 todo.txt 走：新建任务和导入任务的默认都是 `strict: false`。
  否则"在 FocusFlow 里敲 `rec:1d`"和"从 sleek 导入 `rec:1d`"会得到不同结果，
  这正是这次改造要消灭的那类不一致。
- **迁移时给所有已存在的 recurrence 打上 `strict: true`**，保证没有任何用户
  现有的循环任务因为这次改造而悄悄改变到期日。

---

## 5. 身份与写回

todo.txt 没有稳定 ID，行号会因为 sleek 归档、排序、编辑而失效。
FocusFlow 不能往文件里塞 `id:`（会污染 sleek 的显示），所以用**原文匹配**。

拉取时在 Task 上记：

```ts
source?: {
  file: string;     // 来源 todo.txt 的绝对路径
  raw: string;      // 拉取当时那一行的逐字原文
  pulledAt: string;
}
```

### 5.1 写回时的定位算法

1. 读取 `source.file`。
2. 找**逐字等于** `source.raw` 的行。
3. 找不到就退一步：剥掉所有 tag、比对纯正文（sleek 可能改过日期或优先级）。
4. 还找不到 → 不写文件，在界面上说明「源行已不存在，仅在 FocusFlow 内标记完成」。
5. 找到多行 → 取第一条尚未完成的，并提示重复。

**任何一步失败都不允许猜。** 写错一行意味着改掉用户 todo.txt 里另一条任务，
这个代价远大于"没写回"。

### 5.2 允许写回的内容

只有两处，都是单 token 的外科手术式修改，都幂等：

| 时机 | 写入 | 理由 |
|------|------|------|
| 拉取时 | 在源行**追加** `@主` 或 `@被` | 让主动/被动在 sleek 侧边栏也可见、可筛选，即 D4 的「两边都方便」 |
| 完成时 | 在源行**前置** `x <今天>`，并按 sleek 的规则把 `(P)` 挪成 `pri:P` | 和 sleek 自己的 `ChangeCompleteState` + `RestorePreviousPriority` 行为一致，避免文件出现两种风格 |

前者由设置 `writeBackOrigin`（默认开）控制，关掉后拉取就是纯只读。

**其它一切都不写回**：优先级调整、番茄计数、取消、编辑正文、单元归属，全部只存在于 FocusFlow。

---

## 6. 精简后的模型

### 6.1 优先级

```ts
type Priority = 'A' | 'B' | 'C' | 'D' | 'E' | 'G' | 'H';
```

从 10 个降到 7 个，其中 A–E 是真正的档位，G/H 是完成/取消状态。

| 档位 | 配额 | 含义 |
|------|------|------|
| A | 1 | 核心挑战 |
| B | 2 | 重要推进 |
| C | 3 | 标准任务 |
| D | 4 | 临时任务 |
| E | 5 | 快速处理 |

一个两天单元最多 15 条。**没有无限档了**，这是和现在最大的行为差异。

### 6.2 配额溢出：退回候选池

`demotionTargetFor` 原来在 B–E 全满时兜底到 F（无限档）。F 删掉之后签名变成：

```ts
demotionTargetFor(tasks: Task[]): ActivePriority | null   // null = 无处可放
```

拿到 `null` 时的处理是**把任务退回候选池**：从 FocusFlow 移除，todo.txt 里的源行原封不动。
这正好是 D1 模型的自然结论——满了就还回去，而不是找个角落堆着。

A 档的 Highlander 规则保留（新的 A 挤掉旧的 A，旧的沿 B→C→D→E 找空位）；
S 那一套单槽逻辑随 S 一起删除。

### 6.3 S → `+project`

- 新增设置 `focusProject: string | null`，存本周焦点项目的 project 名。
- 子任务就是带这个 `+project` 的普通任务行，可以各自排优先级、各自设 `due:`、各自算番茄。
- sleek 侧边栏免费显示 `exporter (3)` 这样的分组计数。
- 删除：`Subtask` / `Subtask[]` 类型、子任务 UI、`isSingleSlotPriority` 里的 S 分支、
  `SUSTAINED_PRIORITIES`、`isSustainedPriority`。

### 6.4 文件配置

FocusFlow 需要用户分别指定两个路径（sleek 的配置读不到）：

- `todoFilePath` —— 候选池，必填
- `doneFilePath` —— 可选。填了之后，如果一条任务的源行不在 `todoFilePath` 里，
  就去 `doneFilePath` 找一次再报"找不到"（覆盖"用户在 sleek 里先归档了"这个场景）。

---

## 7. 主动 / 被动

编码：`@主` / `@被`（todo.txt 原生 context）。

选这个而不是 `src:self` 之类扩展字段的理由：
context 能进 sleek 的侧边栏，免费得到两个值的计数和点击筛选；
扩展字段在 sleek 里只是正文里的一串纯文本，拿不到任何交互。
选单个汉字而不是 `@主动` / `@被动`，是因为在有意义的前提下这已经是最短的形态。

- 采集点在**拉取面板**，两个按钮，默认「主动」，所以正常路径下用户不需要手打这个符号。
- FocusFlow 界面上渲染成本地化的 chip（中文「主动 / 被动」，英文 Proactive / Reactive），
  但**文件里始终是 `主` / `被`**，两个语言环境读写同一份文件不会打架。
- 复盘面板新增一项：本单元的主动/被动条数与比例。未标注的单独计数、不并进任何一侧，
  避免"忘了标"被算成主动而虚高。

---

## 8. 单元周期

| 单元 | 天 |
|------|-----|
| 1 | 周一 + 周二 |
| 2 | 周三 + 周四 |
| 3 | 周五 + 周六 |
| 复盘 | 周日 |

受影响的函数：`getUnitForDate`、`getWeekUnits`（周锚点从周日改到周一）、
`isThisWeek`（周一至周日）、`cycleEngine` 里"周六不参与循环"的判断改成周日。

---

## 9. 实施分期

每一期结束时仓库都必须是绿的（`npm test` 双时区、`npm run typecheck`、
`npm run check`、`npm run build`、`cargo check`），并单独提交。

| 期 | 内容 | 依赖 |
|----|------|------|
| P1 | `src/lib/utils/todotxt.ts` —— 按 §2.1 的语法做解析/序列化，含往返测试 | 无 |
| P2 | 单元周期改为周一起（§8） | 无 |
| P3 | `Recurrence` 结构改造（§4），含 `b` / `y` / 任意 `n` / `strict` | P1 |
| P4 | 删除 F / N / S 与子任务，配额溢出改为退回候选池，数据迁移（§10） | P2 P3 |
| P5 | 拉取面板 + 文件路径设置 + 写回（§5） | P1 P4 |
| P6 | 主动 / 被动（§7） | P5 |
| P7 | 文档 / CLI / i18n 同步 | 全部 |

### 9.1 需要新增的 Tauri 能力

现在的 `capabilities/default.json` 只放开了 `$APPDATA`，读不了用户自己选的 todo.txt。
两处改动：

- `commands.rs` 新增 `read_external_file(path)` / `write_external_file(path, content)`，
  写入沿用现有的 temp + rename 原子写法。走 Rust 命令而不是 fs 插件，
  可以绕开 fs 插件的路径作用域，不需要放开 `fs:allow-*-recursive`。
- 文件选择器需要 `tauri-plugin-dialog`（新依赖）。这是本次唯一的依赖新增。

---

## 10. 数据迁移（4.0 → 5.0）

**原则：不丢任何一条任务。** 删档位不等于删数据。

| 现有数据 | 迁移去向 |
|---|---|
| A–E 任务 | 原样保留 |
| F（灵感收集）任务 | 导出为 todo.txt 行 |
| N（未来推进）任务 | 导出为 todo.txt 行，带上 `t:<thresholdDate>`；没有阈值日期的加 `h:1` |
| S（持续推进）任务 | 降为普通任务；它的第一个 `+project` 写进 `settings.focusProject`（没有 project 就用内容生成一个 slug） |
| S 的 `subtasks[]` | 每条子任务变成一行 todo.txt，带上焦点项目的 `+project` |
| 已有的 `recurrence` | 补 `strict: true`（见 §4.3） |

导出的落点取决于此时是否已配置 `todoFilePath`：

- 已配置 → 直接追加到该文件。
- 未配置 → 存进 `ActiveData.pendingExport: Task[]`，界面上挂一条提示：
  「有 N 条候选任务待导出，配置 todo.txt 路径后一键导出」。**在导出成功之前不删除数据。**

---

## 11. 已知会损失的东西

写在这里是为了避免以后当成 bug 重新发现一遍：

- **取消态不跨界。** 在 FocusFlow 里取消一条从 sleek 拉来的任务，todo.txt 里那行不变。
- **番茄完成数不跨界。** `pm:` 只表示估计值，sleek 没有已完成计数的字段。
- **`notes` 不跨界。**
- **时间精度降到天。** todo.txt 的创建/完成日期没有时分秒。
- **单元归属不跨界。** todo.txt 不知道两天单元的存在。
- **`rec:mon,wed,fri` 和 `rec:1m@15` 不是合法 todo.txt。** 这类任务只能在 FocusFlow 里创建和存在。
