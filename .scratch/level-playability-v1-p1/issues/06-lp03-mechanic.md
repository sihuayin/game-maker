# LP-03 机制可通行性判据

Type: task
Status: resolved
Owner: amber · 2026-11-06
Blocked by: 05
Map: ../map.md

## Question

按 PRD §4.4 实现机制可通行性判据。本票 AFK。

### 判据

| 判据 id | 含义 |
|---|---|
| `PLAYABILITY_MECHANIC_PATH_BLOCKED` | 非移动 hazard 作为不可站立禁区，确定性封死必要路径；反事实：去掉 hazard 可达、加禁区不可达 |
| `PLAYABILITY_MECHANIC_PATH_NO_SAFE_WINDOW` | 单个全高 danger 横切 spawn 与目标之间；`requiredMs = (d.box.w + player.w) / speed * 1000 > strike.periodMs + 1 帧` |

### LP-00 复核后的强制约束（已批准）

- 运行时忽略 `hazard.body`（`packages/demo/src/shell/scene.ts:151-174`）；机制判据必须使用运行时几何，不得把声明的 `body` 当作 hazard 实际占位。
- hazard 使用运行时图集帧几何；pack acceptance 无法确认时 `coverage.partial`；**不得**把配置 `hazard.body` 当作替代碰撞盒。

### 必须交付

- 在 LP-02 可达图上叠加机制约束；危险区域不得因「存在」即判定不可通行。
- 周期性危险不得因「存在周期」即判定无安全窗口；必须给出 `requiredMs` / `idleMs` 证据。
- 正例、反例、边界测试；39 例矩阵中机制类用例转为生产测试。
- 巡逻 hazard、moving-platform、被机制包住的收集物、多 danger 联合 —— 一律 `INSUFFICIENT_EVIDENCE`。
- 本票 `## Answer`：commit SHA、命令与退出码、测试清单、语料结果、回退点。

### 边界

- 只做机制层；不做完成性。
- 不改 Runtime 机制语义；不改历史语料；零付费。

### 通过标准

- AC-04：能识别危险区域确定性封锁唯一必要路径、以及不存在安全窗口的周期性危险。
- 合法危险机制不被错误阻断；所有阻断可解释、可复现。

## Answer

**2026-11-06 完成（LP-03，AFK）。Commit `1a5c369`。未推送：LP-03 是第三个强制复核点，等复核通过后再更新 Draft PR。**

### 交付

- `packages/contracts/src/playability/mechanic.ts` —— `auditMechanic`：A（静止 hazard 禁区 + 反事实）与 B（单全高 danger 安全窗口下界）。
- `packages/contracts/src/playability/reach.ts` / `targets.ts` —— 从 LP-02 抽出的共享可达 / 覆盖评估与目标集；空间层与机制层共用同一套 BFS、mid-air 保护与目标几何。
- `graph.ts` 新增 `forbiddenBoxes` 掩码：**只拒绝穿越、不提供支撑**；hazard 顶不是地板。
- 生产夹具 `packages/contracts/tests/fixtures/playability-mechanic-matrix.json`（6 例，manifest 共用）；生成脚本 `../build-mechanic-fixtures.mjs`。
- 测试 `packages/contracts/tests/playability-mechanic.test.ts`（25 例）+ `playability-graph.test.ts` 新增 1 例。
- 语料脚本 `../rejudge-mechanic.mjs` → 证据 `../evidence/05-lp03-mechanic.json`。

### 判据语义

**A `PLAYABILITY_MECHANIC_PATH_BLOCKED`**

1. 只收 `kind:"hazard" && !motion`；几何用**运行时图集帧**（`runtimeEntityGeometry` 的 frame 源），**忽略 `hazard.body`**。
2. 反事实：`base`（hazard 当空气）可达、`mask`（hazard 当非支撑禁区）不可达，才报。
3. hazard 当禁区，不当地板；薄于 `max(4, speed/30)` 的 hazard 不参与证明。
4. 目标与 hazard 相交（含贴边）⇒ `target-inside-hazard` gap，A 对该目标不报。
5. 出生点在 hazard 里 ⇒ `spawn-in-hazard` gap，A 整体不报。
6. 巡逻 hazard、moving-platform、mid-air touch-only ⇒ 只记 gap，不硬拒。

**B `PLAYABILITY_MECHANIC_PATH_NO_SAFE_WINDOW`**

1. 只处理**单个** danger；多 danger ⇒ `multiple-dangers-unproven`。
2. 把 danger 当禁区跑一次 mask；目标在**远侧**且 mask 不可达 ⇒ 全列切面成立。
3. `requiredMs = (danger.w + player.w) / speed * 1000`；`idleMs = strike.periodMs`。
4. `requiredMs > idleMs + 1 帧` ⇒ 报；`idleMs < requiredMs <= idleMs + 1 帧` ⇒ `danger-window-frame-boundary` gap；`requiredMs <= idleMs` ⇒ 不报。
5. 目标在近侧 ⇒ 不报；目标在 danger 内 ⇒ `target-inside-danger` gap（收集跨复位保留 / 同帧顺序不可证）。
6. 非全列 danger ⇒ `non-full-column-danger` gap。

同一目标 A/B 同时命中只留一条（A 优先），另一条并入 `detail`。机制 coverage：hazard 帧几何 / 巡逻 / moving-platform / 各类 gap ⇒ `partial`；只有 danger 且 B 有结论 ⇒ `checked`。

### 证据

- `pnpm exec vitest run packages/contracts/tests/playability-mechanic.test.ts` → 25 例通过，exit 0。
- `pnpm exec vitest run packages/contracts/tests` → 44 文件 / 930 例通过，exit 0。
- `pnpm test` → 166 文件 / 2517 例通过，exit 0；`pnpm typecheck` / `pnpm build` exit 0。
- `node .scratch/level-playability-v1-p1/rejudge-mechanic.mjs` → exit 0；冻结语料 20 唯一 config：
  **4 产生确定性阻断**（3 个历史产物 + 1 个 probe）、**14 INSUFFICIENT_EVIDENCE**、**2 NO_PROVEN_BLOCKER**；coverage：2 checked / 18 partial。
  - 历史 #1：`pickup-water-4`、`goal-1`。
  - 历史 #2：`scrap-4/5/6`、`gate-1`（20 唯一口径选中的副本是 `run-out-2026-10-17d/.../run/v1`，与研究记录的 10-18a `site/v1` 同 contentHash）。
  - 历史 #3：`pickup-3`、`chest-1`、`gate`。
  - probe：`goal`（`p0-02-*/09-probe-*`，非关卡）。
  - gap 分布：`moving-hazard-phase` 16、`gate-missing` 2、`spawn-in-danger` 1、`target-inside-hazard` 1。
  - 与研究 04 §14.3.3 的 4 命中一致；这些是**新增机制阻断**，不是既有 `auditReachability` 的重复（后者把 hazard 当空气，语料 0 error）。

### 研究矩阵的一处修正（LP-03 复核必须裁定）

**`pickup-in-static-hazard`（#28）**：研究矩阵记 `INSUFFICIENT_EVIDENCE`，因为它只检查了被 hazard 包住的 `suitcase-2`。生产层对 `suitcase-2` 仍然只记 `target-inside-hazard` gap、不硬拒；但同一个 64×48 hazard 也封死了其后的 `suitcase-3` 与 `gate`（与 `static-hazard-seals-path` 同几何），所以层内 verdict 是 `PROVEN_UNPLAYABLE`。

⇒ 39 例矩阵的机制类分布从 **17/17/5** 变为 **18/17/4**（仅 #28 一例：INSUFFICIENT → PROVEN）。这条与 LP-02 的 #12 同类，LP-03 复核必须明确接受或拒绝；不得为了旧统计回退正确判据。本票不改研究矩阵文件，只改生产夹具预期并在此记录。

### 边界

- 未接入 `deterministic` / Publish Gate / `auditReachability`（LP-05 接线）；未新增 CLI / MCP 参数；未新增持久化 schema；QA 仍 7 条。
- 未改 Runtime / 历史语料 / 既有验收证据；零模型调用、零生图、零付费。
- 未推送；Draft PR 仍停在 LP-02（等 LP-03 复核通过后更新）。

### 回退点

撤销 `1a5c369` 即可：新增 `mechanic.ts` / `reach.ts` / `targets.ts` 与测试 / 夹具 / scratch 证据；`spatial.ts` 的改动是抽共享底座 `reach.ts` 的等价重构（LP-02 46 例仍全绿）；`graph.ts` 只新增可选 `forbiddenBoxes`，不传时行为不变。
