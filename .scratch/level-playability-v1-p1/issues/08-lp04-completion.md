# LP-04 关卡完成性判据

Type: task
Status: resolved
Owner: amber · 2026-11-06
Blocked by: 07
Map: ../map.md

## Question

按 PRD §4.5 实现关卡完成性判据：验证收集全部必要物品后是否仍能到达终点。本票 AFK。

### 判据

| 判据 id | 算法摘要 |
|---|---|
| `PLAYABILITY_COMPLETION_GATE_NOT_REACHABLE_AFTER_COLLECT` | 带标签图 + mask DP（`k ≤ 12`）；收齐全部必需 pickup / chest 后到 gate；hazard / danger 复位边保留计数；复用 LP-02 的 gate 谓词；LP-02 / LP-03 已报根因抑制 |

### 必须交付

- 在空间可达图上增加收集状态；搜索从出生点到终点、满足必要物品收集要求的合法路径。
- 使用 Mask DP 或等价状态搜索；必要收集物数量硬限制 `k ≤ 12`，超出返回 `INSUFFICIENT_EVIDENCE`。
- 正例、反例、边界测试（含「全部物品可达但无法通关」）；39 例矩阵中完成性类用例转为生产测试。
- 不允许通过忽略收集状态宣称关卡可完成。
- 本票 `## Answer`：commit SHA、命令与退出码、测试清单、语料结果、回退点。

### 边界

- 不重复 LP-02 / LP-03 的根因报告。
- 不改 Runtime；不改历史语料；零付费。

### 通过标准

- AC-05：能识别所有必要物品可达但最终无法通关；完整收集后存在通关路径时能给出证据。
- 搜索状态与边界条件正确；超出可靠计算范围返回 `INSUFFICIENT_EVIDENCE`。

## Answer

**2026-11-06 完成（LP-04，AFK）。Commit `d152630`。未推送；等用户确认矩阵归因后再决定是否更新 Draft PR。**

### 交付

- `packages/contracts/src/playability/completion.ts` —— `auditCompletion`：带标签的移动图 + `R[mask]` 闭包 / 转移的 mask DP。
- `reach.ts` 新增 `full` 选项（不因目标覆盖提前停）；`verdict.ts` 的 `no-path` witness 增加 `required` / `collectableAlone` / `gatePre` / `usedResetEdges`。
- 生产夹具 `packages/contracts/tests/fixtures/playability-completion-matrix.json`（10 例，manifest 共用）；生成脚本 `../build-completion-fixtures.mjs`。
- 测试 `packages/contracts/tests/playability-completion.test.ts`（23 例）。
- 语料脚本 `../rejudge-completion.mjs` → 证据 `../evidence/06-lp04-completion.json`。

### 判据语义

**`PLAYABILITY_COMPLETION_GATE_NOT_REACHABLE_AFTER_COLLECT`**

- 必需集合 = 全部 pickup + chest（与 `pickupCount` 同源）；gate 只认 `objective.gate`。
- 状态 `R[mask]` = 收齐 `mask` 后可能站到的落脚点集合。
  - 闭包：只走 `S(e) ⊆ mask` 的边；包含复位边。
  - 转移：走 `S(e) ⊄ mask` 的边，落到 `R[mask | S(e)]`。
  - 只有 `R[full]` 中的 gate 前缀（或收齐后落点上的 gate）才算完成。
- 收集是强制的、经过即收集；一次跳跃可同时收多个；gate 提前碰到不结算（gate 命中记录「命中时已收集的 mask」）。
- hazard / danger 当空气 + **复位回出生点、计数保留**的边；moving hazard 用扫过包络（玩家可以等它过来）。
- `k > 12` ⇒ `k-over-limit` gap；目标缺失 / 越界 / gate 缺失 ⇒ 引用族 / 空间层负责；LP-02 / LP-03 已证明的根因 ⇒ `suppressed-by-spatial-or-mechanic` gap，不重复报。
- mid-air touch-only 必需目标 / 搜索预算超限 ⇒ `INSUFFICIENT_EVIDENCE`，不硬拒。

### 证据

- `pnpm exec vitest run packages/contracts/tests/playability-completion.test.ts` → 23 例通过，exit 0。
- `pnpm exec vitest run packages/contracts/tests` → 44 文件 / **953 例**通过，exit 0。
- `pnpm test` → 167 文件 / **2540 例**通过，exit 0；`pnpm typecheck` / `pnpm build` exit 0。
- `node .scratch/level-playability-v1-p1/rejudge-completion.mjs` → exit 0；冻结语料 20 唯一 config、`kMax=9`：
  **0 完成性阻断**（有效 gate 的 no-walk = 0）、14 `NO_PROVEN_BLOCKER`、6 `INSUFFICIENT_EVIDENCE`（2 个 `gate-missing` + 4 个被空间/机制层抑制）；coverage 14 checked / 6 partial。与研究 05 的「有效 gate no-walk 0」一致。

### 研究矩阵的两处归因修正（需要 LP-06 / 收口确认）

1. **`two-one-way-branches`（#32）**：研究矩阵记完成性 `PROVEN`；生产层空间判据先证明 gate 不可达（x=180..200 的全高墙），完成性正确抑制。**整关 verdict 仍是 PROVEN，但归空间层**；完成性层是 `INSUFFICIENT_EVIDENCE` + 抑制 gap。
2. **`chest-overlapping-hazard`（#39）**：研究矩阵记 `NO_PROVEN_BLOCKER`（只考虑 chest 与 hazard 重叠后可复位开箱）；但同一 64×48 hazard 也封死了 gate，机制层 A 报 `PLAYABILITY_MECHANIC_PATH_BLOCKED`。完成性抑制；**整关 verdict 变为 PROVEN，归机制层**。

⇒ 39 例整关分布从 LP-03 复核的 **18/17/4** 变为 **19/16/4**（#39 由 NO_PROVEN → PROVEN）。这不是完成性判据的误报，而是跨层归因：完成性只报「收齐后到不了 gate」，不覆盖机制层的静态 hazard 封路。**已由用户裁定接受 19/16/4，保留 #39 原始夹具、不改研究矩阵文件（见下）。**

### 边界

- 未接入 `deterministic` / Publish Gate（LP-05）；未新增 CLI / MCP 参数、持久化 schema；QA 仍 7 条。
- 未改 Runtime / 历史语料 / 既有验收证据；零模型调用、零生图、零付费。
- 未推送；Draft PR #28 仍停在 LP-03。

### 回退点

撤销 `d152630` 即可：新增 `completion.ts` 与测试 / 夹具 / scratch 证据；`reach.ts` 只新增可选 `full`；`verdict.ts` 只给 `no-path` 加可选字段；空间 / 机制行为不变（LP-02 / LP-03 全量测试仍绿）。

### 用户裁定（2026-11-06）

**批准 (a)：接受 19 / 16 / 4，不修改 #39 合成夹具。**

- `two-one-way-branches`：整关 `PROVEN_UNPLAYABLE`，**归空间层**（gate 被 x=180..200 的全高墙阻断）；完成性层正确抑制，不重复计为完成性缺陷。
- `chest-overlapping-hazard`：整关 `PROVEN_UNPLAYABLE`，**归机制层**（同一 64×48 hazard 封死 gate，A 报 `PATH_BLOCKED`）；完成性层正确抑制。这不是完成性误报。
- 39 例整关最终分布：**19 PROVEN / 16 NO_PROVEN / 4 INSUFFICIENT**；相较 LP-03 复核的 18/17/4，仅 #39 从 NO_PROVEN 转为 PROVEN。
- 原则：各层负责证明自己发现的阻断，整关 aggregate 汇总所有有效阻断；不为了维持某一层的原始统计而修改有效夹具或回退判据。
