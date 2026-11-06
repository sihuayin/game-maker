# Level Playability V1 — 最小实施方案与契约候选

> ⚠️ **2026-11-05 审批后修订**：票 10 批准了新的权威 LP 序列（LP-00 Runtime 语义核验 … LP-07 收口），
> 本文件 §6 的旧 LP 编号已被覆盖；编译提示词（`ops.ts`）未分配、未授权。以 [final-report.md](final-report.md) §8.3 为准。


- **性质**：调研产物（票 09）。只写方案，**不实施、不改生产代码、不改历史语料、不改 tracker / map**。
- **基线**：代码事实 `main @ fa17c14`（当前工作树只多 `.scratch/level-playability-v1/**` 的文档 / 脚本 / 夹具）。
- **冻结输入**：[framework.md](framework.md)、[rulings-2026-11-04.md](rulings-2026-11-04.md)、
  [02-capability-gap-audit.md](research/02-capability-gap-audit.md)、
  [03-spatial-layout-judgments.md](research/03-spatial-layout-judgments.md)、
  [04-mechanic-composition-judgments.md](research/04-mechanic-composition-judgments.md)、
  [05-level-completion-judgments.md](research/05-level-completion-judgments.md)、
  [corpus/inventory.md](corpus/inventory.md)（`sha256:25e6c891…`）、
  [test-matrix.md](test-matrix.md)、[corpus/rejudgment.md](corpus/rejudgment.md)。
- **本文件地位**：交给票 10 的**实施方案 + 契约候选**。所有契约候选均为**未批准**；10 逐个裁定。
- **零付费**：本方案不含模型调用、生图、站点重建或任何付费步骤。

---

## 0. 结论摘要

1. **不需要新的持久化契约形状。** 三态 `PlayabilityVerdict` 只活在 contracts 内部；
   `PROVEN_UNPLAYABLE` 映射为现有 `ConfigIssue[]`，`INSUFFICIENT_EVIDENCE` / `NO_PROVEN_BLOCKER`
   不产 issue。**不建议新增 `ConfigIssue.code`**。
2. **新增单一入口 `auditPlayability(config, manifest, profile?)`**，内部组合空间 / 机制 / 完成性三层；
   `auditReachability` 保留为 QA 使用的**单层空间判据入口**，两者共用同一套移动图核心，避免两套真相。
3. **接线只有三处生产改动**：`config-audit.ts` 的 `deterministic` 替换、`publish-gate.ts` 的现场复验替换、
   `index.ts` 的加法导出；`compile` 循环、汇合点、CLI/MCP 发布闸**自动覆盖**，QA 与 `assembleSite`
   的行为边界不变（残余风险明写）。
4. **最小实施顺序**：基础设施 → 03 移动图修正 → 03 空间判据 / `CHEST_BLOCKED` →
   机制 A → 机制 B → 完成性 → 编译提示词 → 验收。**A 必须在 03 的 walk/clearance 修复之后**，
   且必须在票 10 对 3 条历史真实缺陷做出迁移 / 例外裁定之后才可作为硬拒上线。
5. **语料基线**：96 配对 / 20 份唯一 config；空间新增 0；完成性有效 gate 新增 0；
   机制 A 3 条真实缺陷、0 误伤、1 个 probe 夹具排除；机制 B 0；2 份不可用。
6. **最大未决项**：3 条历史真实缺陷的处置、P1/P4/`body` profile 假设的批准、
   04 的 `no-safe-window` witness 与 framework 四种 witness 的冲突、以及“加法导出”是否被 10 视为 API 形状变更。

---

## 1. 最小修改面

> 约定：`contracts` = `packages/contracts/src`。下表是**实施 effort 的全部生产修改面**；
> 本票不执行任何一项。路径均为仓库相对路径。

### 1.1 生产源码

| # | 文件 | 变更 | 类型 | 属于 Q5 允许面？ |
|---|---|---|---|---|
| 1 | `packages/contracts/src/playability/profile.ts`（新） | `FixedRuntimeProfile` 类型 + `FIXED_RUNTIME_PROFILE` 默认值；集中定义静态 solid、无二段跳、hazard 复位、无 kill plane、P1/P2/P3/P4、danger 时序、帧余量、`k≤12`、walk/fall 边开关 | 内部纯常量 / 类型 | **是**（审计纯函数所需假设；不落盘、不导出为 schema） |
| 2 | `packages/contracts/src/playability/verdict.ts`（新） | `PlayabilityVerdict` / `PlayabilityEvidence` / `PlayabilityCoverage` 类型；三态聚合；`(target, 根因类)` 去重；`playabilityIssues(verdict) → ConfigIssue[]` | 内部纯函数 | **是** |
| 3 | `packages/contracts/src/playability/graph.ts`（新） | 从 `reachability.ts` 抽出的共享移动图：`blocked` / `standable`、脚点、严格 AABB、walk/fall/hop 边、目标盒（pickup / chest / gate）、BFS / 可达集；可注入 `hazardMask` / `dangerMask` | 内部纯函数 | **是** |
| 4 | `packages/contracts/src/playability/spatial.ts`（新） | 03 判据：`CHEST_UNREACHABLE`、`{PICKUP,CHEST,GATE}_BLOCKED`、`SPAWN_IN_TERRAIN`；chest `range`；严格 overlap；运行时几何（pickup/goal 忽略 `body`）；移动图修正的判定入口 | 内部纯函数 | **是** |
| 5 | `packages/contracts/src/playability/mechanic.ts`（新） | 04 判据 A `PATH_BLOCKED`、B `PATH_NO_SAFE_WINDOW`；非支撑 hazard 禁区；单 danger 全列切面；其余返回 `INSUFFICIENT_EVIDENCE` | 内部纯函数 | **是** |
| 6 | `packages/contracts/src/playability/completion.ts`（新） | 05 唯一判据 `GATE_NOT_REACHABLE_AFTER_COLLECT`：mask DP、复位边、`k≤12`、抑制规则 | 内部纯函数 | **是** |
| 7 | `packages/contracts/src/playability/registry.ts`（新） | 判据 id 封闭注册表；每层判据数组；`PLAYABILITY_DISABLED`（默认空）；coverage 贡献；稳定排序 | 内部纯函数 / 诊断 | **是** |
| 8 | `packages/contracts/src/playability/index.ts`（新） | `auditPlayability`（组合三层、聚合三态）+ `playabilityIssues`（映射与去重） | 审计纯函数入口 | **是** |
| 9 | `packages/contracts/src/reachability.ts`（改） | `auditReachability` 保持签名，内部改调 `playability/graph.ts`；补 walk/fall 边、static solid、运行时几何（是否启用严格 overlap/BLOCKED 由 LP-02 统一） | 既有审计纯函数重构 | **是** |
| 10 | `packages/contracts/src/config-audit.ts`（改） | `:24` 导入改为 `auditPlayability` / `playabilityIssues`；`:53` `...auditReachability(...)` 替换为 `...playabilityIssues(auditPlayability(config, ctx.manifest))`；更新头注释 | 集成（审计纯函数接入 `deterministic`） | **是**（不新增 CLI/MCP 能力，仅接线） |
| 11 | `packages/contracts/src/index.ts`（改） | 在 `:149` 后加法导出 `export * from "./playability/index.js"`；`PlayabilityVerdict` / `FixedRuntimeProfile` 为类型/常量导出，不是 zod schema | 加法 API 导出（候选 C1） | **是**（审计纯函数导出）；若 10 视任何导出为形状变更，走 C1 审批 |
| 12 | `packages/pipeline/src/publish-gate.ts`（改） | `:25` 导入；`:140` 改调 `playabilityIssues(auditPlayability(parsed.value, manifest))`；`:142` 文案从“不可达”改为“过不了可玩性判定”；`:219-224` 尾注同步；头注释说明新覆盖 | 集成（发布闸现场复验） | **是**（审计纯函数接入；不扩展 CLI/MCP 参数） |
| 13 | `packages/assets/src/ops.ts`（改） | 仅编译提示词：`:1128-1198` 增加“可玩性硬约束”段（chest 必收 / 静止 hazard 禁区 / danger 安全窗口 / spawn 与目标不得深埋）。数值继续从 `DEFAULT_PLAYER_MOVE` / `jumpSpan` / `maxJumpHeight` 现算（`:1028-1029`），不写新字面量。若 `:1145` 的 `kind` 列表仍漏 `chest` / `danger`，一并补齐（schema 已有，不新增 kind） | 编译提示词 | **是**（Q5 明列；不新增机制） |
| 14 | `packages/pipeline/src/create-game.ts` | **不需要代码改动**：`:631-642` 已消费 `auditConfigPipeline(...).deterministic`，自动获得新判据 | 无 | 不适用 |
| 15 | `packages/qa/src/gameplay.ts` | **不需要代码改动**：`:80` 继续调 `auditReachability`；QA 仍 7 条 | 无 | 不适用 |
| 16 | `packages/demo/src/site.ts` / `assemble.ts` | **不接线**（推荐）：`:195-217` 保持只跑 `auditGameConfig` / 屏幕空间 / 几何；残余风险见 §3.5 / §8.3 | 无 | 不在 Q5 允许面（若接线会扩大修改面） |
| 17 | `packages/contracts/src/game-config.ts` | **不改**：`CONFIG_ISSUE_CODES` 闭集（`:300-317`）、`auditGameConfig` 的 `inWorld` / `spawn-in-solid`（`:533-561`）、台阶 / 行程 warning（`:563-584`）全部原样 | 无 | 不允许在无审批下改 |
| 18 | `packages/contracts/src/qa.ts` | **不改**：`QA_JUDGEMENTS` 仍 7 条（`:111-160`） | 无 | 不允许 |
| 19 | `packages/contracts/src/assetpack.ts` | **不改**：不新增逐帧尺寸 / 锚点字段（超出 V1） | 无 | 不允许 |

### 1.2 测试文件

| # | 文件 | 变更 |
|---|---|---|
| T1 | `packages/contracts/tests/playability-profile.test.ts`（新） | profile 的每条假设；`unspecified` 时 coverage 降级；`k=12`；帧余量；danger 时序 |
| T2 | `packages/contracts/tests/playability-verdict.test.ts`（新） | 三态聚合、coverage、`(target, 根因类)` 去重、issue 映射、无 `code`、`NO_PROVEN_BLOCKER ≠ PROVEN_PLAYABLE` |
| T3 | `packages/contracts/tests/playability-spatial.test.ts`（新） | 03 每条判据正 / 负 / 合法边界；chest `range`；BLOCKED vs UNREACHABLE；spawn 窄口径 |
| T4 | `packages/contracts/tests/playability-mechanic.test.ts`（新） | A / B 正 / 负 / 合法边界 / `INSUFFICIENT_EVIDENCE`；moving hazard、moving solid、thin hazard、多 danger |
| T5 | `packages/contracts/tests/playability-completion.test.ts`（新） | mask DP、复位边、抑制、`k=12` / `k=13`、合法顺序 |
| T6 | `packages/contracts/tests/reachability.test.ts`（改） | `§一个身位之内就算够到`（`:106-112`，goal 埋行李堆）改为按 03 报 `GATE_BLOCKED`；新增低天花板 / moving solid 边界；保留既有 gap/wall/pickup 阈值 |
| T7 | `packages/contracts/tests/config-audit.test.ts`（改） | 保留 B-02 分档断言；新增：playability error 在 `deterministic`、不在 `resampleable`；wall 切世界仍报 |
| T8 | `packages/pipeline/tests/publish-gate.test.ts`（改） | `:169-188` 文案断言 `这份 config 本身不可达` → `可玩性判定`；新增：静止 hazard 阻断的 config 被 gate 拒；reject 时站点不产 |
| T9 | `packages/cli/tests/cli-site-gate.test.ts`（改） | `:181/:192` 同一文案断言；新增：静止 hazard config 退 4、`site/` 不产 |
| T10 | `packages/assets/tests/compile-runtime.test.ts`（改） | `:316-340` 保留 apex/span 现算断言；新增：新“可玩性硬约束”段存在，且没有把 `jumpSpan(move, 270)`（宽松上界）写给模型 |
| T11 | `packages/qa/tests/gameplay.test.ts`（改，条件） | 若 `auditReachability` 的 message / chest 行为变化：更新快照式断言；新增 QA 仍 7/7、mechanic/completion 不进 `reachability` |
| T12 | `packages/mcp/tests/assemble-site-qa-gate.test.ts`（改，条件） | 若 gate 文案变化：更新 error 匹配；可加静止 hazard 的 `assemble_site` 拒绝用例 |

### 1.3 Fixtures 与验收脚本

| # | 路径 | 变更 |
|---|---|---|
| F1 | `packages/contracts/tests/fixtures/playability-matrix.json`（新） | 由 07 的 39 个用例转成生产 fixture（每例含 `caseId`、`group`、`config`、`manifest`、`expectedVerdict`、`expectedJudgmentId`、`failureLocation`、`legalPair`）；来源标注 `level-playability-test-matrix/v1`；不放 07 的 scratch 路径依赖 |
| F2 | `packages/contracts/tests/fixtures/playability-corpus-defects.json`（新） | 3 条历史真实缺陷的最小复现：2 条 v4 manifest 原样；`run-out-2026-10-13h` 因 `assetpack/v3` 不可被当前 parser 读取，附**测试专用只读归一化 manifest**，并在用例上标明 `requiresNormalization: true` |
| F3 | `.scratch/level-playability-v1-implementation/corpus-regression.mjs`（新，scratch 验收脚本） | 读取冻结 `inventory.json`（复算 `freeze.value`），对 96 唯一配对跑生产 `auditPlayability`；输出 `corpus-regression.json`；不进入 `packages/**` |
| F4 | `packages/contracts/tests/fixtures/playability/README.md`（新） | 说明 F1/F2 是**生产 fixture**、非 scratch；记录生成来源与版本 |

### 1.4 明确不修改

- 不改 Runtime（`packages/demo/src/shell/**`、`world.ts`、`hazard.ts`）。
- 不改 `GameConfig` / `AssetPackManifest` / `QAReport` / `DeliveryReport` schema。
- 不改 `CONFIG_ISSUE_CODES`、不加 `ConfigIssue.code`、不加 `judgmentId` 字段。
- 不改 `QA_JUDGEMENTS`、不新增 QA 判据、不把 verdict 写进 `qa-report.json`。
- 不改 CLI / MCP 参数或工具清单。
- 不改历史 `run/**`、`pack/**`、`site/**`、`fixtures/**`、既有验收证据。
- 不接线 `assembleSite`（见 §3.5 / §8.3 残余风险）。

---

## 2. 结果模型落地

### 2.1 内部类型（不落盘、不是 zod schema）

```ts
export type PlayabilityVerdictState =
  | "PROVEN_UNPLAYABLE" | "INSUFFICIENT_EVIDENCE" | "NO_PROVEN_BLOCKER";
export type CoverageState = "checked" | "partial" | "not-checked";
export type PlayabilityCoverage = {
  spatial: CoverageState; mechanic: CoverageState; completion: CoverageState;
};
export type PlayabilityWitness =
  | { kind: "no-path"; reachableSet: string; blockedAt?: string }
  | { kind: "blocked"; rect: Rect; overlapFoot: Rect; solids: string[] }
  | { kind: "coverage-gap"; missing: string }          // 例如 "spawn-separation" / "per-frame-geometry"
  | { kind: "count"; required: number; collected: number };
export type PlayabilityEvidence = {
  judgmentId: string; target: string; detail: string;
  witness: PlayabilityWitness; coverage: PlayabilityCoverage;
  assetId?: string; expected?: unknown; actual?: unknown;
};
export type PlayabilityVerdict = {
  verdict: PlayabilityVerdictState;
  evidence: PlayabilityEvidence[];   // 只放 blocker 与 coverage-gap；NO_PROVEN_BLOCKER 没有 evidence
  coverage: PlayabilityCoverage;
};
```

- **`PlayabilityVerdict` 是内部纯函数结果**：可以供 contracts 测试、scratch、pipeline 内部消费者读；
  **不得**进入 `qa-report.json`、`delivery`、GameConfig 持久化结构或任何新导出的 zod schema
  （framework §3.5）。
- `evidence` 不记录“某条判据通过”的好消息；它只记录阻断证据或 coverage 缺口。
- 需要新增内部 `rootCauseClass` 时，由 `judgmentId` 派生，**不进入** `PlayabilityEvidence` 的对外形状。

### 2.2 三态聚合

按 framework §3.3 实现：

1. 任一执行的判据返回 `PROVEN_UNPLAYABLE` ⇒ 总 verdict `PROVEN_UNPLAYABLE`；
2. 否则，任一在范围内维度 `coverage !== "checked"`，或任一判据返回 `INSUFFICIENT_EVIDENCE`
   ⇒ `INSUFFICIENT_EVIDENCE`；
3. 否则 ⇒ `NO_PROVEN_BLOCKER`。

coverage 贡献：

| 维度 | `checked` | `partial` / `not-checked` |
|---|---|---|
| `spatial` | 移动图建成、玩家资源可解、所有空间目标有结论 | 玩家 size 缺失、目标资源缺失、目标在 `x<0` / `y<0`、P1/P2/P4 未写入 profile、严格 overlap 不可判 |
| `mechanic` | 无 moving hazard / moving solid / hazard `body` 覆盖 / 多 danger / 非全列 danger；A/B 空跑或每条有结论 | 巡逻 hazard、moving platform / solid+motion、target-inside-hazard、多 danger、非全列 danger、hazard 几何不可定 |
| `completion` | `k ≤ 12`、移动图非 partial、无负坐标、复位边已建模 | `k > 12`、移动图 partial、mid-air touch-only 未验证、目标负坐标 |

> ⚠️ **08 的严格聚合提醒**：历史语料上很多 config 的 `mechanic` / `completion` 会是 `partial`，
> 于是整关 verdict 多为 `INSUFFICIENT_EVIDENCE`。这是**预期的**：`deterministic` 只阻断
> `PROVEN_UNPLAYABLE`，不会因为“没证明可玩”而产生 error。**不要**为了得到 `NO_PROVEN_BLOCKER`
> 而把 partial 写成 checked。

### 2.3 错误侧映射到 `ConfigIssue`

`playabilityIssues(verdict: PlayabilityVerdict): ConfigIssue[]`：

| `ConfigIssue` 字段 | 来源 | 规则 |
|---|---|---|
| `severity` | verdict | **只有** `PROVEN_UNPLAYABLE` 的 evidence 产 `"error"`；`INSUFFICIENT_EVIDENCE` / `NO_PROVEN_BLOCKER` **一条都不产** |
| `where` | `evidence.target` | 沿用现有格式：`entity "<id>"` / `player.at` / `objective.gate` |
| `message` | `evidence.detail` | 人话定位；可附 witness 摘要；**不写 judgmentId**（framework §5.1） |
| `code` | — | **不带**；`CONFIG_ISSUE_CODES` 闭集不变（`game-config.ts:300-317`） |

新 error 的 message 模板（人话；不写 judgmentId）：

- 空间 BLOCKED：`这个目标的交互区完全落在实心体内：玩家盒在任何一个不撞墙的位置都无法与它相交（目标盒 …，实心体 …）`
- 空间 UNREACHABLE（保留既有口径）：`够不到 —— 从出生点出发，用**最宽的能力上界**都到不了它（…）`
- 出生点埋 terrain：`出生点的脚点在 terrain[i] 内，比锚点预期深 Xpx，且玩家身体范围内没有可站立表面`
- 机制 A：`静止 hazard "<id>" 封死唯一通路：去掉 hazard 可达、加上 hazard 禁区后不可达（玩家宽 …）`
- 机制 B：`danger "<id>" 全高封死唯一通路：idle <P>ms < 最少穿越 <T>ms（宽 … + 玩家 …，速度 …）`
- 完成性：`必需收集物都能单独取得，但不存在一条走法能收齐后再到达终点（gate "<id>"）`

- `playabilityIssues` 不做任何 warning 转换，不读取也不升级 `auditGameConfig` 的台阶 / 行程 warning
  （framework §7.1.3）。
- `PlayabilityVerdict` 的 `coverage` **不进入** message / issue / 报告；未覆盖维度只影响内部聚合。

### 2.4 去重与优先级

去重键：`(target, 根因类)`。实现为按 `target` 分组、按根因优先级保留最高者；同一 target 的
其他根因合并进 `witness`（内部）并在 message 末尾列一句“另有：…”（只写人话根因，**不写 judgmentId**）。

根因优先级（高 → 低）：

1. `auditGameConfig` 既有 error（`inWorld` / `player.at` 卡 solid）——**playability 不重复报**；
2. `PLAYABILITY_SPATIAL_*_BLOCKED`；
3. `PLAYABILITY_SPATIAL_*_UNREACHABLE`；
4. `PLAYABILITY_MECHANIC_PATH_BLOCKED`；
5. `PLAYABILITY_MECHANIC_PATH_NO_SAFE_WINDOW`；
6. `PLAYABILITY_COMPLETION_GATE_NOT_REACHABLE_AFTER_COLLECT`。

补充规则（由 03/04/05 报告固化）：

- 同一目标先判 `BLOCKED`；是则不再判 `UNREACHABLE`。
- **抑制信息由 `auditPlayability` 自己复算**，不把 `ConfigIssue[]` 当输入（保持
  `(GameConfig, AssetPackManifest) + FixedRuntimeProfile` 的输入边界）：用同一 `entityBox` /
  `world.size` 复算“目标是否越界”，用同一 `boxOf` 复算“出生点是否卡 solid”，
  用同一引用可解性检查 gate / 目标资源是否存在。
- 目标被 `auditGameConfig.inWorld` 报越界 ⇒ playability 跳过同目标，避免两条不同根因噪声
  （03 §4.2 建议 2）。
- 出生点卡在 `solid` ⇒ `auditGameConfig` 拥有；`auditPlayability` 的 spawn-in-terrain 跳过。
- 目标已被 `auditReferences` 报为引用缺失（gate 指向不存在 id 等）⇒ playability 跳过该目标并记
  coverage `partial`，不重复报。
- 04 的 A/B 只在 `base`（hazard/danger 当空气）可达且 `mask` 不可达时产 error；`base` 不可达时归 03，
  不重复报。
- 05 的 completion 只在所有必需收集物**单独**可取得、gate 单独可达时，才报“收齐后不可达”；
  否则由 03/04 的 error 更基础，completion 抑制并把 `completion` coverage 落 `partial`。

### 2.5 契约候选表（**均未批准，票 10 逐个裁定**）

| 候选 | 变更内容 | 必要性 | 至少一个“不改契约”替代 | 影响面 | 不做的后果 | 审批点 / 建议 |
|---|---|---|---|---|---|---|
| **C1** 加法导出 `auditPlayability` + `playabilityIssues` + 内部类型/常量 | `contracts/index.ts` 新增一个导出面；`PlayabilityVerdict` 等是 TS 类型，**不是 zod schema**，不落盘 | pipeline / publish-gate 必须调用同一份审计实现；否则只能在 pipeline 复制规则，形成第二套真相 | 只导出 `auditPlayabilityIssues(config, manifest): ConfigIssue[]`（返回类型与 `auditReachability` 相同），verdict/coverage 类型藏在模块内部；contracts 测试用相对路径导入内部模块 | 仅新增命名导出；无持久化格式、无 CLI/MCP 参数；现有消费者不受影响 | 无法把三态判据接进 `deterministic` / 发布闸；若在 pipeline 重写，规则必然漂移 | 10。**建议批准**（属于 Q5 明列的审计纯函数；若 10 把任何加法导出视为 API 形状变更，则按本候选单列批准） |
| **C2** 新增 `ConfigIssue.code`（如 `"playability-unplayable"`） | 扩展 `CONFIG_ISSUE_CODES` 闭集 + `ConfigIssueCode` 联合 | 让下游机器区分“可玩性硬拒”与其他 error | 不新增 code：`where` + `message` 已能定位；内部 `judgmentId` / `witness` 留在 verdict，不落盘 | 改 contracts 闭集；所有按 code 分支的消费者（`classifyConfigIssues` 等）需要确认；测试与外部消费者可能做穷尽 switch | 下游无法用 code 机器区分；但当前链没有任何消费者需要这个区分，验收也不依赖它 | 10。**建议不采用 / 推迟**。若未来修复循环需要机器码，另立审批，不在 V1 |
| **C3** 把 `PlayabilityVerdict` / coverage 持久化到 `qa-report.json` 或 `delivery` | 新字段 / 新格式 | 让 QA 报告携带三态 | 不持久化：QA 保持 7 条，verdict 只在 `deterministic` 内部使用 | 改 `qa-report/v1` / delivery schema；违反 framework §3.5 | 无。当前没有消费者需要持久化 verdict | 10。**建议不采用**（与 framework §3.5 冲突） |
| **C4** 新增 QA 判据（第 8 条） | 扩展 `QA_JUDGEMENTS` | 让 QA 报告也覆盖机制 / 完成性 | QA 保持 7 条，`reachability` 继续调 `auditReachability`；新判据只进 `deterministic` / gate | 改 QA 契约、gate 的 `checked` 要求、QA 报告消费者 | QA standalone 看不到 A/B/completion；这是**已知残余风险**（§3.4 / §7） | 10。**建议不采用**（framework §4.3 已裁定 QA 不变） |
| **C5** 把 `FixedRuntimeProfile` 变成生产入参 / CLI 参数 / manifest 字段 | 新 API 或新持久化字段 | 允许调用方覆盖运行时假设 | 不暴露：profile 是 contracts 内部常量；生产调用方不传；测试通过可选第三参数注入 | 改 CLI/MCP API 或 config/manifest schema；Q5 明确排除 | 生产调用方无法自定义 profile；这正是 framework §2.2 的要求（集中定义、不许各自隐含） | 10。**建议不采用** |
| **C6** 扩展 `AssetPackManifest` 暴露逐帧 atlas 尺寸 / 锚点 | 新字段 / 新 schema | 让空间判据用逐帧几何而非标称尺寸 | 不扩展：P1 假设“标称 size + 资源 anchor = 碰撞几何”，并在 coverage 记录不确定性；若 10 不批准 P1，相关判据落 `partial` / `INSUFFICIENT` | 改 assetpack 契约与 pack 生成；跨包影响大 | 逐帧几何仍不可见；相关判据 coverage partial | 10 / 未来 effort。**V1 建议不采用**（超出 Q5；明确排除） |

### 2.6 可选 `ConfigIssue.code` 提案：**建议否**

- 现状：`CONFIG_ISSUE_CODES` 是闭集 `["entity-asset-kind", "entity-state-frames", "hud-panel-size"]`
  （`game-config.ts:300-317`）；`ConfigIssue.code` 可选，但只给本图新增 / 加强的错误写码。
- 可玩性 error 的消费者只有：编译循环的 `hard` 列表、汇合点、发布闸、测试。它们都只按
  `severity` + `where` + `message` 工作，**没有**按 code 分支的需求。
- 新增 code 会把“内部 `judgmentId` 稳定性”问题带进对外契约；而 framework §5.1 明确要求 id
  **不写进 where/message**、只活在内部。
- **结论**：V1 不加 `ConfigIssue.code`。若 10 认为未来修复循环需要机器码，单列 C2，推迟到后续 effort。

### 2.7 `FixedRuntimeProfile` 默认值（建议；票 10 批准）

> 这是 contracts 内部的常量，不是 `GameConfig` / `AssetPackManifest` 的字段，也不落盘。
> 生产调用方不传；测试通过 `auditPlayability` 的可选第三参数注入变体。
> ⚠️ **不要与 `packages/contracts/src/runtime-profile.ts` 的 `RuntimeProfile` 混淆**：后者是
> 外壳能力断言（`id` / `version` / `mechanics` / `capabilities`），本 profile 是**审计内部假设集合**；
> 两者职责不同，不得合并，也不得把 `FixedRuntimeProfile` 塞进 `RuntimeProfile`。

| 字段 | 建议值 | 依据 | 未写入 / 设为 `unspecified` 时 |
|---|---|---|---|
| `doubleJump` | `false` | framework §2.2；Runtime 无二段跳 | — |
| `solidMotion` | `"static"` | `scene.ts:149-150`；`vocabulary.ts:85-99` | 空间 coverage `partial` |
| `hazardContact` | `"reset-to-spawn-keep-collected"` | `scene.ts:355-362`；framework §2.2 | — |
| `killPlane` | `false` | framework §2.2；掉出世界不判死 | — |
| `viewportIsInput` / `designIsInput` | `false` | framework §2.1 / §2.3 | — |
| `collisionGeometry`（P1） | `"manifest-nominal-size+asset-anchor"`；⚠️ 对 solid / chest / danger，若声明 `body` 则用 `body`（P2 优先），否则用标称 `size` + 资源级 `anchor` | `assetpack.ts` 只给标称 `size` + 资源级 `anchor`；03 §1.3 | `"unverified"` ⇒ 严格 overlap / BLOCKED / chest coverage `partial` |
| `bodySemantics`（P2） | `solid/chest/danger: "honored"`；`pickup/hazard/goal: "ignored"`；⚠️ `world.ts` 的 `EntityDesc.box` 仍按 `body ?? size` 建盒，但 pickup / hazard / goal 的**运行时物理体**来自 sprite 帧（`physics.add.existing`），判据按**物理体**；⚠️ 04 对**声明了 `body` 的 hazard** 仍保守落 `INSUFFICIENT_EVIDENCE`（几何来源不确定） | `scene.ts:149-197`；03 §3.11；02 S7 | `"unspecified"` ⇒ 带 `body` 的目标 / hazard 判据 coverage `partial` |
| `chestInteraction`（P3） | `"box-expanded-by-range"` | `scene.ts:315-325`；03 §1.3 | chest 判据 coverage `partial` |
| `spawnSeparation`（P4） | `"unstick-from-static-geometry"` | 03 §3.4 语料证据（纯盒重叠 11/20 误伤） | `SPAWN_IN_TERRAIN` ⇒ `INSUFFICIENT_EVIDENCE` |
| `movement` | `{ maxSpeed: "speed", acceleration: 0, jumpOnlyWhenGrounded: true }` | `scene.ts:79-96`；`playerMoveOf` 只有 speed / jumpVelocity / gravity；Runtime 无冲刺 / 加速 | walk/fall 边不可证 ⇒ spatial `partial` |
| `dangerTiming` | `{ initial: "idle", idleMs: "periodMs", activeMs: "activeMs", frameMarginMs: 1000/60 }` | `game-config.ts:87-100`；`hazard.ts:22-33` | B ⇒ `INSUFFICIENT_EVIDENCE` |
| `minHazardThickness` | `max(4, speed/30)` px | 04 §3.2 步骤 9（30Hz 一帧位移） | A 对薄 hazard ⇒ `INSUFFICIENT_EVIDENCE` |
| `walkEdges` / `fallEdges` | `true` | 03 §3.8；02 probe F 低天花板误报 | 关掉 ⇒ 依赖边的判据 `INSUFFICIENT` |
| `completionMaxCollectibles` | `12` | 05 §2.4；语料最大 k=9 | `k>12` ⇒ completion `partial` |
| `targetBounds` | `[0, world.w] × [0, world.h]` | 05 §9.10；负坐标移动图不建模 | 负坐标目标 ⇒ `INSUFFICIENT_EVIDENCE` |

---

## 3. 集成点与失败分档

### 3.1 `auditConfigPipeline`（`packages/contracts/src/config-audit.ts`）

现状：

- `:24` `import { auditReachability } from "./reachability.js";`
- `:49-55` `deterministic = [...resampleable, ...auditLayerCoverage(...), ...auditReachability(config, ctx.manifest)]`

改为：

```ts
// :24
import { auditPlayability, playabilityIssues } from "./playability/index.js";

// :53
...playabilityIssues(auditPlayability(config, ctx.manifest)),
```

- **不传 profile**：生产调用方不传；`auditPlayability` 默认 `FIXED_RUNTIME_PROFILE`（framework §2.2）。
- **不传 design / viewport / levelId**：playability 的输入只有 `(GameConfig, AssetPackManifest) + FixedRuntimeProfile`；
  `ctx.design` / `ctx.viewport` 仍只服务于 `auditEntityIdentity` / `auditScreenSpace`。
- **纯函数且总函数（total）**：缺玩家资源 / 缺目标资源 / gate 指向不存在 id / 负坐标 / 空世界 /
  未知 kind 都返回 coverage gap 或 `INSUFFICIENT_EVIDENCE`，**不抛异常**；否则发布闸会把一个
  数据缺口变成崩溃。只有 contracts 已保证的 schema 不变量可以假设成立。
- **顺序**：保持“resampleable 在前、层覆盖、playability 最后”；playability 内部按注册表稳定排序，
  同一输入两次调用结果逐字节相同。
- **超集性质**：`deterministic` 仍包含 `resampleable`；B-02 的既有断言（`config-audit.test.ts:59-64`）
  继续成立。

### 3.2 编译循环与汇合点

**编译循环（`packages/assets/src/ops.ts`）**

- `:1247-1250` 的 `modelHard` 只取 `auditConfigPipeline(...).resampleable`，**不包含 playability**。
  ⇒ `PROVEN_UNPLAYABLE` **不会**触发重采样；模型不会因为“这一关走不通”被再抽三发。
- `:1284-1295` 的确定性校验取 `auditConfigPipeline(...).deterministic`；playability error 在这里进入
  `hard`，抛 `CommandError("invalid")`，**不落盘**。文案保持原文：
  “编译出来的配置**过不了校验**（N 条硬失败）… 这是**确定性失败** —— 重抽 config 改不了，也不落盘。”
- 失败阶段：**编译循环完成后、config 落盘前**；退出码 `EXIT.invalid = 4`（`contracts/src/command.ts:46`）。

**汇合点（`packages/pipeline/src/create-game.ts:631-642`）**

- 两条路径（`reuseConfig` 与 `compileRuntime`）都走 `auditConfigPipeline(...).deterministic`；
  playability 自动覆盖，**无需改 create-game.ts**。
- `reuseConfig` 传入一份走不通的 config ⇒ 现在会在汇合点硬拒（与编译路径一致）。
- 文案保持：“运行目录里的 config **过不了确定性复验**（N 条硬失败；reuseConfig 与编译两条路径共用这一关）…”。
- 退出码仍为 `invalid`（4）。

### 3.3 发布闸（`packages/pipeline/src/publish-gate.ts`）

现状：`:134-144` `configProblem` 只重跑 `auditReachability`；`:25` 导入。

改为：

```ts
// :25
import {
  auditPlayability, playabilityIssues, CommandError, formatIssues, parseAssetPack, parseGameConfig,
  QA_JUDGEMENTS, QAReportSchema, qaVerdict, TD_CONFIG_FORMAT,
  type AssetPackManifest, type QAReport,
} from "@game-maker/contracts";

// :140
const hard = playabilityIssues(auditPlayability(parsed.value, manifest))
  .filter((i) => i.severity === "error");
```

文案：

- 现：`**这份 config 本身不可达**（${hard.length} 条硬失败）`
- 改：`**这份 config 本身过不了可玩性判定**（${hard.length} 条硬失败）`
- 尾注（`:224`）：`⚠️ 发布闸会**现场重跑**可玩性判定：报告只钉包身份，不能证明这份 config 走不走得通。`

理由：chest / BLOCKED / spawn / 机制 / 完成性错误不全是“不可达”；保留“不可达”会误导。
退出码仍 `invalid`（4），四条发布入口（CLI build/site、MCP create_game/assemble_site）不变。

### 3.4 QA（`packages/qa/src/gameplay.ts`）

- **调用不改**：`:80` 继续 `reachability: merged("game-config", auditReachability(config.value, manifest.value))`；
  `auditReachability` 的函数签名与返回类型也不变。
- `QA_JUDGEMENTS` 仍 7 条（`qa.ts:111-160`）；QA 报告形状不变；不写 verdict / coverage。
- **函数内部升级**（由 LP-01 / LP-02 落地）：QA 的 `reachability` 自动获得 walk/fall、static solid、
  chest target、严格 overlap / BLOCKED 的质量改进。**这是行为变化**：QA 仍是一个判据、
  一个 `target: "game-config"`，但 detail 可能新增 chest / blocked 行。票 10 需确认这是可接受的
  （见 §7 R3）。若 10 拒绝，则必须让 `auditReachability` 保留旧行为、只让 `auditPlayability` 用新核心；
  代价是两套移动模型漂移。
- QA standalone **看不到** `PLAYABILITY_MECHANIC_*` / `PLAYABILITY_COMPLETION_*` 的 error；
  它们只在 `deterministic` / 发布闸出现。这是**有意**的，也是残余风险。

### 3.5 `assembleSite` / standalone `site`

- `packages/demo/src/site.ts:169` 的 `assembleSite` 是公开导出的库入口；`:195-217` 只跑
  `auditGameConfig` + `auditScreenSpace` + `auditGeometry`。**本方案不接线**。
- `packages/demo/src/assemble.ts:55-68` 的 `assembleFromConfig` 同样不接线。
- standalone `site` 命令（`packages/cli/src/cli.ts:704-728`）在 `assembleFromConfig` 之前调用
  `assertPublishableQa`（`:717-720`）；MCP `assemble_site`（`packages/mcp/src/server.ts:430-443`）
  同样在 `assembleSite` 之前调用闸（`:433-437`）；MCP `create`（`:365-378`）与 CLI `build`
  （`cli.ts:281-284`）也过同一把闸。⇒ **CLI / MCP 的 standalone site 覆盖**。
- **残余风险（必须在规格中明写）**：任何第三方或测试代码**直接调用库入口**
  `assembleSite` / `assembleFromConfig`，不经过 `assertPublishableQa`，则**仍然只跑旧的三族 + 几何**，
  不会执行 playability 判定。这与今天“库直调不过发布闸”的既有边界一致（`publish-gate.ts:6-8`），
  但 V1 必须把它写成显式残余风险，而不是默认覆盖。
- 不接线的理由：① `assembleSite` 在 CLI/MCP 上已经被闸覆盖，接线会重复跑一遍；
  ② 会把 playability 的失败阶段前移到“装配”、改变库调用者的行为与错误文案；
  ③ 扩大修改面到 `demo`（Q5 的允许面不含站点装配行为变更）。若 10 要求覆盖库直调，另立 ticket，
  并把 `site.ts` 加入修改面、把重复执行/文案差异列入验收。

### 3.6 与 B-02 的关系

- B-02 的裁定是：`auditReachability` 进 `deterministic`、不进 `resampleable`，编译 / 汇合点硬拒。
- V1 **不改变阶段**，只把 `deterministic` 里的实现从 `auditReachability` **替换**为
  `auditPlayability` 的错误映射；`resampleable` 完全不动。
- B-02 的测试 `packages/contracts/tests/config-audit.test.ts:37-64` 保留；新增断言：
  - `PROVEN_UNPLAYABLE` 只出现在 `deterministic`；
  - 静止 hazard / chest / completion 的 error 不出现在 `resampleable`；
  - 走不通的 config 不触发模型重采样（`compile-runtime` 侧可用 spy 断言只发 1 次调用，或只用
    `auditConfigPipeline` 的两档断言）。
- B-02 的发布闸配套（P1 publish-gate）保留，只是现场复验函数改为 `auditPlayability`。

### 3.7 退出码与文案变化表

| 阶段 | 现状 | V1 | 退出码 | 文案 |
|---|---|---|---|---|
| 编译循环（`ops.ts:1247-1269`） | 只看 resampleable | 不变（playability 不在 resampleable） | 4（若最终失败） | 不变 |
| 编译后确定性校验（`ops.ts:1284-1295`） | 层覆盖 + reachability | 层覆盖 + playability | **4** | **不变**（“确定性失败”） |
| 汇合点（`create-game.ts:631-642`） | 同上 | 同上 | **4** | **不变**（“过不了确定性复验”） |
| 发布闸 config 复验（`publish-gate.ts:134-144`） | reachability | playability | **4** | **改**：不可达 → 可玩性判定 |
| QA（`qa/src/gameplay.ts`） | 7 条，reachability | 7 条，reachability（内部升级） | 4（QA 失败时） | detail 可能新增 chest/blocked 行 |
| `assembleSite` 库直调 | 三族 + 几何 | **不变** | 4（原有错误） | 不变；残余风险 |

---

## 4. 测试计划

### 4.1 每条判据的单测（正 / 负 / 合法边界）

> 所有测试都用 `(config, manifest, profile?)` 纯函数；不调用模型、不读网络、不读时间。
> 预期 verdict 与 `test-matrix.md` 的 39 例保持一致。

| 层 | 判据 id | 正例（`PROVEN_UNPLAYABLE`） | 负例 / 合法边界（`NO_PROVEN_BLOCKER`） | 证据不足（`INSUFFICIENT_EVIDENCE`） |
|---|---|---|---|---|
| spatial | `PLAYABILITY_SPATIAL_CHEST_UNREACHABLE` | `chest-in-pit`（坑对面 chest） | `chest-range-rescues`（`range:30` 伸到安全侧）；`chest-behind-wall-with-range` | chest 资源解不到 / 逐帧几何不可见 ⇒ coverage `partial` |
| spatial | `PLAYABILITY_SPATIAL_CHEST_BLOCKED` | `chest-inside-luggage-range0`、`chest-sealed-in-solid` | `chest-inside-luggage-range30`、`chest-behind-wall-with-range` | `body` 运行时语义未写入 profile 且 chest 有 `body` 覆盖 |
| spatial | `PLAYABILITY_SPATIAL_PICKUP_BLOCKED` | `pickup-inside-luggage`、`pickup-body-override-inside` | `pickup-on-luggage` | 目标资源解不到 |
| spatial | `PLAYABILITY_SPATIAL_GATE_BLOCKED` | `goal-inside-luggage` | `gate-midair-jumpthrough`（只要求 overlap） | gate 引用缺失 ⇒ `auditReferences` 拥有 |
| spatial | `PLAYABILITY_SPATIAL_PICKUP_UNREACHABLE`（既有语义，新登记内部 id） | `gap-200`、`wall-100`、`pickup-120` | `gap-40`、`wall-40`、`pickup-50`、`baseline-last-train` | 出生点附近无落脚点 ⇒ 不报，coverage `partial` |
| spatial | `PLAYABILITY_SPATIAL_GATE_UNREACHABLE`（既有语义，新登记内部 id） | 满高墙切世界（`walledOff`） | `gate-midair-jumpthrough` | 同上 |
| spatial | `PLAYABILITY_SPATIAL_SPAWN_IN_TERRAIN` | `spawn-deep-terrain`（burial 99.6、无 nearby standable） | last-train 型 2.4px / visual-design 型 7.68px 锚点嵌入；`spawn-in-solid` 归既有 `auditGameConfig`；横向墙重叠 | P4 未写入 profile ⇒ `INSUFFICIENT_EVIDENCE` |
| spatial | 模型修正（无独立 id） | — | `low-ceiling-walkable`（walk 边修复 2 条误报）；`moving-solid-sweep`（static solid 对齐运行时） | walk/fall/static 能力关闭 ⇒ coverage `partial` |
| mechanic | `PLAYABILITY_MECHANIC_PATH_BLOCKED` | `static-hazard-seals-path`（唯一地面路径被静止 hazard 封死） | 同 hazard 可跳过 / 可绕开；`wide-patrol`（带 `motion`）⇒ `INSUFFICIENT_EVIDENCE`；`pickup-in-static-hazard`、`moving-platform` ⇒ `INSUFFICIENT_EVIDENCE`；薄 hazard（厚度 < `max(4, speed/30)`）⇒ `INSUFFICIENT_EVIDENCE` | moving hazard、hazard `body` 覆盖、多帧 hazard 的逐帧尺寸不可验证（P1 未写入）、target-inside-hazard、出生点在 hazard 内；moving solid 在 03 修复前（03 修复后按静态原位判，不因 `motion` 本身降级） |
| mechanic | `PLAYABILITY_MECHANIC_PATH_NO_SAFE_WINDOW` | `danger-full-wall`（全高、单 danger、异侧、`requiredMs > idle + 1 帧`） | `danger-wide-idle`（`requiredMs ≤ idle`）；spawn 在 danger 内；目标在近侧 / 在 danger 内且近边距离 ≤ idle | 非全高、多 danger、非全列切面、等号 ± 1 帧、P1 未写入导致几何不可定 |
| completion | `PLAYABILITY_COMPLETION_GATE_NOT_REACHABLE_AFTER_COLLECT` | `one-way-pit-pickup`、`two-one-way-branches` | `one-way-pit-gate-on-pit-floor`、`order-required-high-then-low`、`two-pickups-one-arc`、`pit-chest-with-reset-hazard`、`chest-overlapping-hazard`、`chest-midair-jumpthrough` | `k > 12`、负坐标、移动图 `partial`、mid-air touch-only 未验证 |

**每条判据还必须有的边界断言**：

- 同 `target` 只产一条 error；`BLOCKED` 优先于 `UNREACHABLE`；completion 不重复 03/04 的目标。
- `INSUFFICIENT_EVIDENCE` 不产 `ConfigIssue`，且会把 `coverage` 置 `partial`。
- `NO_PROVEN_BLOCKER` 不是“可玩”；测试只断言“没有 error”，**不**断言 `PROVEN_PLAYABLE`。
- 不含 `code` 字段。

### 4.2 合成矩阵转生产测试

- 来源：`fixtures/07-matrix/matrix.json`（39 例，17 `PROVEN_UNPLAYABLE` / 18 `NO_PROVEN_BLOCKER` /
  4 `INSUFFICIENT_EVIDENCE`；spatial 23 / completion 10 / mechanic 6）。
- 转法：生成 `packages/contracts/tests/fixtures/playability-matrix.json`，每例保存
  `caseId` / `group` / `config` / `manifest` / `expectedVerdict` / `expectedJudgmentId` /
  `failureLocation` / `legalPair`。
- 测试：`playability-spatial.test.ts` / `playability-mechanic.test.ts` / `playability-completion.test.ts`
  各遍历自己 `group` 的用例；用 `parseGameConfig` / `parseAssetPack` 先验 schema；断言：
  - `PROVEN_UNPLAYABLE` 的 `playabilityIssues` 含预期 `where`，message 含预期定位；
  - `NO_PROVEN_BLOCKER` 的 `playabilityIssues` 为空；
  - `INSUFFICIENT_EVIDENCE` 的 issues 为空，且对应维度 coverage `partial`；
  - `expectedJudgmentId` 仅在内部 verdict evidence 中断言，不出现在 `ConfigIssue.where/message`。
- **两类 existing-owned 用例要分开断言**：矩阵里的 `spawn-in-solid`（#21）与
  `target-out-of-world`（#22）的 owner 是 `auditGameConfig`，不是 playability。测试 harness 对这两例
  断言 `auditGameConfig` 报 error，并**额外断言 `playabilityIssues` 对同一 target 为空**（证明抑制生效）。
  其余 37 例用 `auditPlayability` 断言。这样矩阵同时覆盖“新判据会响”与“既有根因不重复报”。
- **`expectedVerdict` 的层级要写清**：07 的 `expectedVerdict` 是**用例所属层 / 判据**的预期，
  不等于整关 aggregate。`chest-overlapping-hazard`（#39）在 05 的 completion 层是
  `NO_PROVEN_BLOCKER`（合法设计、不报），但 04 §3.2 step 8 / §12.1 把 target-inside-hazard 记
  `coverage.mechanic = partial`；按 framework §3.3，整关 aggregate 是 `INSUFFICIENT_EVIDENCE`。
  测试 harness 必须**同时**断言这两件事，不能把 07 的层级别 `NO_PROVEN_BLOCKER` 当成整关 verdict。
  这是 §7 R21 的未决项；10 若选择“层级别预期”口径，必须在测试里显式标注，不得静默放宽 aggregate。
- 39 例全部转；不抽样。矩阵只证明判据会响 / 合法边界不误伤，**不替代**语料零误伤基线。

### 4.3 语料回归（冻结清单）

- 输入：`.scratch/level-playability-v1/corpus/inventory.json`，
  `freeze.value = sha256:25e6c891cbb01e456433e104862bc9f03c8404f92fec10acdc93700aca00983d`。
  脚本先复算 freeze（与 `08-rejudge.mjs:13-15` 同法），不一致即失败。
- 范围：`usableForRejudgment: true` 的 config，按 `contentHash` 去重后 **96 个唯一配对 / 20 份唯一 config**。
- 旧 schema：15 份可用 config 用**测试专用只读归一化**（`assets` 的 `id/kind/size/anchor`），
  不把 parser 失败当不可玩；归一化代码不进生产包。
- 预期（引用 08，不得放宽）：
  - 空间（03）：20 份唯一 config 新增 **0**、修复 **0**；chest 0；embedded 0；spawn 窄口径 0；
  - 机制 A（04）：4 个命中 = **3 条真实缺陷**（路径 + sha256 见下）+ 1 个 probe 夹具排除；
    合法设计误伤 **0**、判据不稳 **0**；
  - 机制 B（04）：0 命中；唯一 danger 是 probe 且非全高 ⇒ `INSUFFICIENT_EVIDENCE`；
  - 完成性（05）：96 配对 / 20 唯一；有效 gate 的 no-walk **0**；8 个 pairing 的 no-walk
    全部是 gate 缺失（2 份唯一），归 `auditReferences`；chest 不可达 0；
  - 覆盖缺口：2 份不可用（`out/__probe/empty/site/v1/game-config.json`、
    `packages/demo/fixtures/empty-world.json`），6 份结构未配对，5 份结构配对缺引用；
  - strict 聚合下多数 config verdict 为 `INSUFFICIENT_EVIDENCE`；**不得**断言整关 `NO_PROVEN_BLOCKER`。

3 条真实缺陷（08 已裁定，路径 + `sha256`）：

| 路径 | config sha256 | manifest schema | 预期判据 |
|---|---|---|---|
| `.scratch/game-maker-v2/experiments/e2e-wasteland/raw/run-out-2026-10-13h/ruined-city-scavenger/run/v1/game-config.json` | `sha256:bae4a7ed5b24fda4a18f50d44feb2e20d1136d2ed78caacfe5fbdd03e5cebdd1` | `assetpack/v3`（当前 parser 不可读） | `PLAYABILITY_MECHANIC_PATH_BLOCKED`（目标 `pickup-water-4` / `goal-1`） |
| `.scratch/game-maker-v2/experiments/e2e-wasteland/raw/run-out-2026-10-18a/wasteland-scavenger-assets/run/v1/game-config.json` | `sha256:3c7629b1b8041123fce5dbaa1f84fd7082ec4f41edf8967dac579c6b5dc735b2` | `assetpack/v4` | `PLAYABILITY_MECHANIC_PATH_BLOCKED`（`scrap-4/5/6`、`gate-1`） |
| `.scratch/visual-design-impl-v1/runs/2026-10-25-e2e-v4pro-promptfix/wasteland-scavenger/run/v1/game-config.json` | `sha256:7f53bfc8a2e52391ef48365570e8c87acfb4ddf0dbae7e621b00e53ba13d4f7f` | `assetpack/v4` | `PLAYABILITY_MECHANIC_PATH_BLOCKED`（`pickup-3`、`chest-1`、`gate`） |

> ⚠️ 第一条的 manifest 是 v3，当前 `parseAssetPack` 读不了；08 的“新增阻断”结论依赖只读归一化。
> 生产链不会审计它，除非将来做 manifest 迁移。票 10 必须把这个差异纳入“迁移 / 例外”裁定（§7 R2）。
> ⚠️ `run-out-2026-10-18a` 在 `site/v1/game-config.json` 还有一份**同内容副本**；06 去重保留的是
> `run/v1/game-config.json`（同一 `contentHash`），上表按 inventory 保留副本写。验收按
> `contentHash` + `sha256` 定位，不按路径猜。

### 4.4 Profile 缺口测试

通过给 `auditPlayability` 注入修改过的 `FixedRuntimeProfile`：

| 注入 | 预期 |
|---|---|
| `collisionGeometry: "unverified"` | 严格 overlap / BLOCKED / chest 几何不可证；`coverage.spatial = partial`，相关判据 `INSUFFICIENT_EVIDENCE`；不产 error |
| `spawnSeparation: "unspecified"` | `SPAWN_IN_TERRAIN` ⇒ `INSUFFICIENT_EVIDENCE`；`coverage.spatial = partial` |
| `bodySemantics: "unspecified"` | 目标带 `body` 覆盖时该目标判据 ⇒ `INSUFFICIENT_EVIDENCE`；其余目标仍可判；`coverage.spatial = partial` |
| `walkEdges: false` | `auditReachability` 回退 hop-only；依赖 walk 边的 A / completion ⇒ `INSUFFICIENT_EVIDENCE`；空间 coverage `partial` |
| `staticSolid: false` | 含 moving solid 的 config：空间 coverage `partial`；A / completion 不硬拒 |
| `dangerTiming: "unspecified"` | B ⇒ `INSUFFICIENT_EVIDENCE`；`coverage.mechanic = partial` |
| `completionMaxCollectibles: 12` + `k=13` | completion ⇒ `INSUFFICIENT_EVIDENCE`；`coverage.completion = partial` |

### 4.5 集成与确定性测试

- `config-audit.test.ts`：playability error 在 `deterministic`、不在 `resampleable`；`deterministic`
  仍是 `resampleable` 超集；顺序稳定。
- `compile-runtime.test.ts`：用 spy 断言 playability 失败时**只发一次**模型调用（不重采样），
  且 config 不落盘。
- `create-game.test.ts`：junction 对 `reuseConfig` 与编译两条路径都硬拒（可复用既有 walledOff 夹具）。
- `publish-gate.test.ts` / `cli-site-gate.test.ts`：config 被 playability 拒时退 4、站点目录不产；
  TD 仍显式跳过。
- `qa/tests/gameplay.test.ts`：`QA_JUDGEMENTS.length === 7`；QA 报告的 `checked` 仍 7；
  mechanic/completion error 不出现在 `reachability` 判据下。
- 确定性：同一 config + manifest + profile 连续调用 2 次，`JSON.stringify` 结果相等；
  evidence / issue 顺序按注册表 + config 实体顺序稳定排序。

---

## 5. 回退策略

### 5.1 设计：注册表 + profile 能力开关

- `playability/registry.ts` 维护封闭注册表：

```ts
type JudgmentEntry = {
  id: string;
  layer: "spatial" | "mechanic" | "completion";
  run(ctx): JudgmentResult;   // { verdict, evidence, coverage }
};
export const PLAYABILITY_JUDGMENTS: readonly JudgmentEntry[] = [...];
export const PLAYABILITY_DISABLED: ReadonlySet<string> = new Set(); // 默认空
```

- 生产**没有** env / CLI kill switch（那会引入非确定性入口）；回退 = 改常量或 revert commit。
- 禁用一条判据时：
  1. 该判据不产 evidence、不跑；
  2. 其所在维度 coverage 至少 `partial`（若该维度没有其他判据跑到 `checked`）；
  3. **其他判据照常执行**，不受影响。
- profile 能力开关（`walkEdges` / `staticSolid` / `collisionGeometry` / `spawnSeparation` /
  `bodySemantics` / `dangerTiming`）是“全局假设”开关；关闭只影响**依赖它的判据**，
  依赖表见 §5.2。

### 5.2 依赖表（回退影响范围）

| 判据 / 修正 | 依赖 profile 能力 | 关闭后仍可用的判据 |
|---|---|---|
| 03 `CHEST_BLOCKED` / `GATE_BLOCKED` / `PICKUP_BLOCKED` | `collisionGeometry` | `SPAWN_IN_TERRAIN`（若 P4 可用）、`CHEST_UNREACHABLE`（需图） |
| 03 `*_UNREACHABLE` / chest target / 严格 overlap | `walkEdges`、`staticSolid`、`collisionGeometry`、`bodySemantics` | `SPAWN_IN_TERRAIN`、`*_BLOCKED`（若几何可用） |
| 03 `SPAWN_IN_TERRAIN` | `spawnSeparation` | 其他空间判据 |
| 04 A `PATH_BLOCKED` | 03 移动图（walk/static/body）、`hazard` 几何 | 空间判据、B（若 danger 可用） |
| 04 B `PATH_NO_SAFE_WINDOW` | 03 移动图、`dangerTiming` | 空间判据、A |
| 05 Completion | 03 移动图、`CHEST_BLOCKED` / gate 谓词、`k≤12` | 空间判据、A、B |

### 5.3 逐条移除点

| 要回退的对象 | 文件 / 位置 | 操作 |
|---|---|---|
| 单条判据（如 A） | `playability/mechanic.ts` 的 `mechanicJudgments` 数组；`registry.ts` 的聚合列表 | 删除 / 注释该 entry；或把 id 加入 `PLAYABILITY_DISABLED`；对应测试文件 `playability-mechanic.test.ts` 中该 describe 改为 `skip` 或删除 |
| 03 新空间判据 | `playability/spatial.ts` 的 `spatialJudgments` | 同上；保留 `reachability` 旧入口 |
| 05 completion | `playability/completion.ts` 的 `completionJudgments` | 同上；`coverage.completion` 落 `partial` |
| 严格 overlap / BLOCKED | `playability/graph.ts` / `spatial.ts` 的 `collisionGeometry` 分支 | 把 profile 的 `collisionGeometry` 设为 `"unverified"`；相关判据 `INSUFFICIENT`，不删代码 |
| walk / fall 边 | `playability/graph.ts` 的边集 | 把 `walkEdges` / `fallEdges` 设为 false；A/completion 自动 `INSUFFICIENT` |
| static solid | `playability/graph.ts` 的 solids 构造 | 把 `staticSolid` 设为 false；含 moving solid 的 config coverage `partial` |
| 整个 `auditPlayability` | `config-audit.ts:53`、`publish-gate.ts:140`、`index.ts` | 回到 `auditReachability` / 移除导出；这是最后手段，只应在基础设施失败时使用 |

### 5.4 回退顺序

1. 先关 **completion**（误伤最贵、依赖最多）；
2. 再关 **B**；
3. 再关 **A**；
4. 再关 **03 新空间判据**；
5. 最后才回退**移动图修正**（walk/fall/static/body）；因为 A/completion 依赖它，回退它会让依赖判据
   自动 `INSUFFICIENT`，但独立的空间 BLOCKED / spawn 仍可保留；
6. 基础设施（profile / verdict / 接线）只有在无法回退单条判据时才 revert。

### 5.5 Git 纪律

- 每条判据一个独立 commit；回退 = `git revert <sha>`，不 squash、不跨票 revert。
- 若后续 commit 依赖被 revert 的 commit，按**逆序** revert；每一票的 `## Answer` 记录 commit SHA 与回退点。
- 不推送 `main`；不自动合并 PR；推送走 ClashX 代理（仓库记忆）；合并由用户在图外完成。

---

## 6. 实施 effort 票据

> 实施 effort **不在本图**。以下票据交给票 10 审批；默认**严格串行**，不越过 `Blocked by`。
> 分支：`p1/level-playability-v1`，从包含 `final-report.md` + 批准后的 plan / 票据的提交创建。
> 提交前缀：`LP-00:` … `LP-07:`。每票一个 commit；票内 `## Answer` 记录命令、结果、SHA、回退点。
> 禁止：改 Runtime / 新增机制 / 加 `ConfigIssue.code` / 加 QA 判据 / 改历史语料 / 付费调用。

| 票 | 名称 | Blocked by | 并行性 | 核心范围 | 验收 | 回退点 |
|---|---|---|---|---|---|---|
| LP-00 | 基础设施与接线骨架 | 票 10 批准 | 串行 | 新增 profile / verdict / graph 抽取骨架 / registry / `auditPlayability`；`auditReachability` 改调共享核心；`config-audit.ts:53` 与 `publish-gate.ts:140` 切换到 `auditPlayability`；index 加法导出。初始 registry **只含既有 spatial reachability 语义**，不新增阻断 | 既有 `reachability` / `config-audit` / `publish-gate` / `cli-site-gate` 测试全绿；`pnpm typecheck`；语料 0 新增；`auditPlayability` 与旧 `auditReachability` 在 last-train / walledOff 上 issues 等价 | revert LP-00；`config-audit.ts` / `publish-gate.ts` 回到 `auditReachability` |
| LP-01 | 03 移动图修正（walk / fall / static solid / 运行时几何） | LP-00 | 串行 | `playability/graph.ts` 补 walk 1px 边、fall 弧；solid `motion` 静态；pickup/goal 用运行时几何（忽略 `body`）；`auditReachability` 继承；`reachability.test.ts` 增加低天花板 / moving solid 用例 | `low-ceiling-walkable` ⇒ 无 error（修 2 条误报）；`moving-solid-sweep` ⇒ `entity "high-pickup"` 不可达（按 03 矩阵）；既有 gap-40/60、wall-40/100、pickup-50/120 全保持；语料 0 new / 0 fixed；QA 测试仍 7/7 | profile `walkEdges` / `staticSolid` / `bodySemantics` 设 false；或 revert LP-01 |
| LP-02 | 03 空间判据 + `CHEST_BLOCKED` | LP-01 | 串行 | chest 作为必需目标（含 `range`）；`{PICKUP,CHEST,GATE}_BLOCKED`；严格 overlap 替换 `covers`；`auditReachability` 同步消费 core 的 target status（BLOCKED/UNREACHABLE）以便 QA 继承；`SPAWN_IN_TERRAIN`（窄口径，P4）；去重；profile P1/P3/P4 写入；更新 `reachability.test.ts:106-112` 的 goal 埋行李堆边界 | 03 的 23 个 spatial 用例（含 #35 `chest-sealed-in-solid`）全绿；语料空间 0 新增；spawn 窄口径 0；`config-audit.test.ts` 新增 playability 分档；QA 仍 7/7（detail 可能新增 blocked/chest 行） | 禁用 `spatial` 新判据 / `collisionGeometry: "unverified"` / revert LP-02 |
| LP-03 | 04 A：`PLAYABILITY_MECHANIC_PATH_BLOCKED` | LP-02 + **票 10 迁移 / 例外裁定** | 串行 | 非支撑 `hazardMask`；base/mask 反事实；目标集 pickup+chest+gate；moving hazard / hazard `body` / thin hazard / target-inside-hazard ⇒ `INSUFFICIENT`；moving solid 按 03 静态原位（03 能力关闭才降级）；不把 hazard 当 solid | 07 A 正例（`static-hazard-seals-path`）报；`wide-patrol` / `pickup-in-static-hazard` / `moving-platform` ⇒ 无 issue + coverage `partial`；合法可跳过 / 可绕开不报；语料 3 条真实缺陷命中（08 归一化口径，其中 1 条 manifest 为 v3）、0 误伤、1 probe 排除；无重复 error；A 在 03 walk 修复后启用 | `PLAYABILITY_DISABLED` 加 A；或 revert LP-03；空间 / B 不受影响 |
| LP-04 | 04 B：`PLAYABILITY_MECHANIC_PATH_NO_SAFE_WINDOW` | LP-03 | 串行（可论证与 LP-03 并行，但默认串行） | 单 danger、全高、异侧；`requiredMs > idle + 1 帧`；`dangerTiming` profile；其余 `INSUFFICIENT` | 07 B 正例 `danger-full-wall` 报；`danger-wide-idle` 不报；非全高 / 多 danger / 等号 ± 1 帧 ⇒ `INSUFFICIENT`；语料 0；无重复 | 禁用 B；A 不受影响 |
| LP-05 | 05 Completion | LP-02（`CHEST_BLOCKED`）、LP-04（默认串行） | 串行 | mask DP（k≤12）；复位边；gate 谓词复用 03；抑制 03/04 已报目标；`k>12` / 负坐标 / mid-air touch-only ⇒ `INSUFFICIENT` | 05 的矩阵用例 30-34 / 36-39 全绿；`one-way-pit-pickup` / `two-one-way-branches` 报；`order-required-high-then-low` / `pit-chest-with-reset-hazard` 不报；语料有效 gate 0 新增；无重复 | 禁用 completion；coverage `partial`；空间 / A / B 不受影响 |
| LP-06 | 编译提示词 | LP-02 | 可与 LP-03/04/05 并行（默认串行） | `ops.ts:1128-1198` 增加 chest 必收、静止 hazard 禁区、danger 安全窗口、spawn / 目标不得深埋；`:1145` 的 kind 列表若仍漏 chest/danger 则补齐（schema 已有）；数值从 `DEFAULT_PLAYER_MOVE` / `jumpSpan` / `maxJumpHeight` 现算 | `compile-runtime.test.ts`：apex/span 现算断言保留；新增字符串存在；不出现 `jumpSpan(move,270)` 的宽松数 | revert LP-06；无判据行为变化 |
| LP-07 | 验收与报告 | LP-00…LP-06 | 串行 | `pnpm build` / `pnpm typecheck` / `pnpm test`；`corpus-regression.mjs`；39 例矩阵；3 条缺陷；QA 7/7；发布闸 / CLI / MCP 站点路径；零付费 | 全部命令退出 0；语料计数与 08 一致；矩阵 39/39；无 `ConfigIssue.code`；无 Runtime 改动；报告记录命令、SHA、残余风险 | 不适用（验收票；失败按 repo F3 停在裁定点） |

### 6.1 顺序硬约束（来自 03/04/05/08）

1. **LP-01 的 walk/clearance 修复必须先于 LP-03（A）和 LP-05（completion）**；
   否则 A / completion 继承低天花板误报，不能作为硬拒（04 §3.6、05 §12）。
2. **LP-02 的 `CHEST_BLOCKED` 必须先于 LP-05**；completion 不注册 chest id，只消费 03 的结果。
3. **LP-03 必须等票 10 对 3 条历史真实缺陷做出迁移 / 例外裁定**；在裁定前 A 只能以
   `PLAYABILITY_DISABLED` 或 `INSUFFICIENT_EVIDENCE` 存在，不能硬拒。
4. **LP-04（B）可以在 A 之后**；B 没有历史语料，只有合成负例。
5. 任何票失败 ⇒ 链条停止，回到该票的裁定点；不得跳票继续后续判据。

### 6.2 分支 / 提交纪律

- 分支：`p1/level-playability-v1`，从 10 的批准提交创建（不是从本调研分支直接切）。
- 每票一个 commit：`LP-00: foundation ...` … `LP-07: acceptance ...`。
- 每票必须：该票测试批次绿 + `pnpm typecheck` 绿 + 相关零付费检查；票内记录命令、退出码、SHA、回退点。
- 实施期间只在本地分支提交；是否提前推送由用户决定（推送走 ClashX 代理 `127.0.0.1:7890`）。
- 不推送 `main`；不自动合并 PR；合并由用户在图外完成。
- 不产生新付费 Demo、不调用模型、不生图、不重建站点。

---

## 7. 风险与未决

> 下列每一项都**不在本票代答**；需要 10 裁定或后续 effort 处理。

**仍然只能到 `INSUFFICIENT_EVIDENCE` 的面向**（不产 error）：
巡逻 hazard（时间展开不可证）、moving platform（Runtime 未实现）、被 hazard/danger 包住的
pickup/chest（复位与同帧顺序不可证）、多 danger 联合、target-in-danger 的精确到达时刻、
`k > 12`、负坐标目标、mid-air touch-only、spawn-no-foothold（无 kill plane / 掉出世界语义）、
逐帧 atlas 几何、以及 P1/P4/`body` 未写入 profile 时的相关判据。它们覆盖的是“不能证明”，
不是“可玩”。

1. **R1 — witness 种类冲突（必须裁定）**：framework §5.2 只列四种 witness
   `no-path` / `blocked` / `coverage-gap` / `count`；04 §4.3 的 B 判据输出
   `kind: "no-safe-window"`。本方案建议：**B 的 witness 仍用 `blocked`**，
   在 `blocked` 对象内部加 `blocker: "danger"` / `requiredMs` / `idleMs` 字段；
   或者由 10 明确把 `no-safe-window` 加为第五种 witness。**不要**在未裁定前自造第五种。
2. **R2 — 3 条历史真实缺陷的迁移 / 例外（票 10 必答）**：
   - 2 条 manifest 是 `assetpack/v4`（当前 parser 可读），A 启用后会新阻断；
   - 1 条 `run-out-2026-10-13h` 是 `assetpack/v3`，当前 `parseAssetPack` 读不了；08 的“新增阻断”
     依赖只读归一化，生产链不会审计它。
   - 建议：**不设路径例外**（路径例外会让判据可被外部文件绕过，且跨环境不稳定）；
     把 3 条记录为已知真实缺陷，不改写历史产物；若用户要“迁移”，另立票据重新生成这些 run / pack
     （超出本图“不改历史”的边界，需要单独授权）。
   - 10 必须明确：历史产物是否需要在 V1 内重新发布；若不需要，A 直接上线即可。
3. **R3 — `auditReachability` 行为变化与 QA**：QA 继续调 `auditReachability`，但该函数内部会获得
   walk/fall、static solid、chest target、严格 overlap / BLOCKED。QA 仍是 7 条判据，但
   `reachability` 的 detail 可能新增 chest / blocked 行，既有 QA 测试快照需更新。
   若 10 要求 QA 行为冻结，则必须让 `auditReachability` 保持旧行为、只让 `auditPlayability` 用新核心；
   代价是两套移动模型漂移。**建议接受行为变化并更新 QA 测试**。
4. **R4 — 严格聚合与语料**：按 framework §3.3，历史语料多数整关 verdict 会是
   `INSUFFICIENT_EVIDENCE`（巡逻 hazard / moving platform / completion partial）。
   `deterministic` 只阻断 `PROVEN_UNPLAYABLE`，所以不影响链路；但如果 10 期望“整关
   `NO_PROVEN_BLOCKER`”出现在报告里，那是**另一个持久化需求**，不在 V1。
5. **R5 — P1 假设未经完全验证**：`manifest` 只给标称 `size` + 资源级 `anchor`；逐帧 atlas 尺寸
   不在 allowed input。03 建议写入 profile P1；如果 10 不批准，严格 overlap / BLOCKED / chest
   判据的 coverage 只能是 `partial`，相关 error 不能硬拒。
6. **R6 — P4 spawn 分离**：不写入 profile ⇒ `SPAWN_IN_TERRAIN` 只能 `INSUFFICIENT_EVIDENCE`；
   纯盒重叠口径在 20 份唯一 config 上误伤 11 份，**不能**采用。⚠️ 02 probe E 的 4.6px / 7px 浅埋
   按 03 推荐口径**不报**（锚点语义 + `nearbyStand`）；这是 02 与 03 在措辞上的差异，07 矩阵已按
   03 采用。若 10 认为浅埋也是缺陷，必须同时改 03 口径并接受语料误伤风险。
7. **R7 — `body` 运行时语义**：写入 profile P2（solid/chest/danger 生效；pickup/hazard/goal 忽略）。
   若未来 Runtime 改为 honor `body`，必须重评空间 / 机制判据；这是 profile 的“行为变化必须重评”条款。
8. **R8 — `assembleSite` 直调残余风险**：库直调不过发布闸、不跑 playability；本方案不接线。
   若 10 要求覆盖，另立 ticket（会扩大修改面到 `demo`，并改变库调用者行为）。
9. **R9 — QA standalone 残余风险**：QA 报告只有 7 条，`PLAYABILITY_MECHANIC_*` /
   `PLAYABILITY_COMPLETION_*` 不会出现在 QA 报告；但它们会在编译 / 汇合点 / 发布闸阻断。
   不要把“QA 通过”理解为“机制 / 完成性已判定”。
10. **R10 — `k > 12`**：completion 只做到 12 个必需收集物；语料最大 k=9。k>12 ⇒ `partial` /
    `INSUFFICIENT_EVIDENCE`，不硬拒。未来若要扩大，需要 DP 状态压缩或多项式算法。
11. **R11 — 负坐标 / 世界外目标**：移动图不建模 `x<0` / `y<0`；运行时没有世界边界碰撞；
    目标负坐标 ⇒ `INSUFFICIENT_EVIDENCE`，不硬拒。目标越界仍由 `auditGameConfig.inWorld` 报。
12. **R12 — mid-air touch-only**：目标只在落不到落脚点的弧上被碰到；模型可能漏；V1 记
    `INSUFFICIENT_EVIDENCE`，不硬报。需要 07 的边界夹具确认后，才可补 touch-and-fall 边。
13. **R13 — 明确排除在 V1 外的 Runtime / 契约扩展**：移动平台支持、hazard `body` honor、
    pickup/goal `body` honor、二段跳、kill plane、世界边界碰撞、斜坡 / 非 AABB、逐帧 atlas 几何、
    设计层布局坐标、新的 EntityKind / Motion / 机制。它们都不在本方案；若需要，另立 effort。
14. **R14 — id 冻结**：`PLAYABILITY_SPATIAL_{PICKUP,CHEST,GATE}_{UNREACHABLE,BLOCKED}`、
    `PLAYABILITY_SPATIAL_SPAWN_IN_TERRAIN`、`PLAYABILITY_MECHANIC_PATH_BLOCKED`、
    `PLAYABILITY_MECHANIC_PATH_NO_SAFE_WINDOW`、
    `PLAYABILITY_COMPLETION_GATE_NOT_REACHABLE_AFTER_COLLECT` 一经发布即稳定；
    改名 = 废弃 + 新 id，不得重命名。
15. **R15 — `ConfigIssue.code`**：本方案建议不加；若 10 批准 C2，必须同时更新
    `CONFIG_ISSUE_CODES`、`classifyConfigIssues` 的测试、所有按 code 分支的消费者，并确认
    QA / delivery 不受影响。
16. **R16 — 加法导出的解释**：C1 是 TS 类型/函数导出，不是 zod schema；但 contracts 是跨包唯一通信面。
    若 10 把任何新导出都视为 API 形状变更，则按 C1 单列批准，或退到“只导出返回 `ConfigIssue[]`
    的函数”的替代方案。
17. **R17 — 性能 / DP**：completion 的 `2^k` 必须建立在压缩节点集上，不能对每个格子复制 mask；
    建议设节点 / 边预算，超预算 ⇒ `INSUFFICIENT_EVIDENCE`（而不是超时或随机失败）。
    语料最大 k=9，性能余量足够；验收记录 last-train 与最大语料的耗时。
18. **R18 — 既有测试改写**：`reachability.test.ts:106-112` 的“goal 埋行李堆不报”、
    `publish-gate.test.ts:169-188` / `cli-site-gate.test.ts:174-194` 的“不可达”文案、
    `compile-runtime.test.ts:316-340` 的提示词断言都会受影响；必须随对应票一起更新，
    不得为了保绿而回退判据。
19. **R19 — `auditGameConfig` 重复报告**：`inWorld` / spawn-in-solid 与 playability 的同一 target
    必须按 §2.4 优先级抑制；验收要断言“同一 config 不会对同一 target 报两条不同根因”。
20. **R20 — 旧 schema 归一化只在测试脚本**：15 份可用 config 的 v1–v3 manifest 只读归一化
    不进生产包；生产对旧 manifest 的失败发生在 parser（既有行为），不要把它算成 playability error。
21. **R21 — 07 矩阵的 `expectedVerdict` 与 04 coverage 的层级冲突**：
    `chest-overlapping-hazard`（#39）在 07 表里是 `NO_PROVEN_BLOCKER`，但 04 §3.2 step 8 / §12.1
    把 target-inside-hazard 记为 `coverage.mechanic = partial`；按 framework §3.3，整关 aggregate
    应为 `INSUFFICIENT_EVIDENCE`。这是**两个层级的口径不同**，不是判据矛盾。10 必须裁定：
    - (a) 07 的 `expectedVerdict` 明确解释为“所属层 / 判据”的预期，整关 aggregate 另测（推荐）；
    - (b) 把 #39 的整关预期改为 `INSUFFICIENT_EVIDENCE`；
    - (c) 修改 04 的 coverage 规则，让 target-inside-hazard 不降级（不推荐：会与 §3.3 冲突）。
    无论选哪个，**05 的“合法设计不报 error”结论不变**；变的只是整关 aggregate 的标签。
    测试 harness 不得静默把层级别 `NO_PROVEN_BLOCKER` 当成整关 verdict。

---

## 8. 判据放置与发布闸覆盖

### 8.1 为什么是 `auditPlayability`，不是并进 `auditReachability`

| 维度 | 并进 `auditReachability` | 另起 `auditPlayability`（推荐） |
|---|---|---|
| 三态 / coverage | `auditReachability` 返回 `ConfigIssue[]`，无法表达 `INSUFFICIENT_EVIDENCE` / coverage；要么改返回类型（破坏 API），要么加旁路 | 内部 `PlayabilityVerdict` 天然表达三态 + 逐维 coverage |
| QA 语义 | QA 的 `reachability` 会同时继承机制 / 完成性 error，改变“可达性（boot → spawn → goal）”这一条判据的含义；与 framework §4.3 冲突 | QA 继续调 `auditReachability`，仍是单层空间判据；7 条不变 |
| 发布闸 | gate 已调 `auditReachability`，自动覆盖所有判据；但 QA 也被污染 | gate 改调 `auditPlayability`；只覆盖发布路径，QA 不污染 |
| 逐条回退 | 所有判据混在一个函数；回退 A 可能影响空间判据；无 coverage 表达 | 注册表逐条禁用；coverage 自动 partial；互不污染 |
| 修改面 | `reachability.ts` + 可能的 `config-audit.ts`；表面更小 | 新模块 + `config-audit.ts` + `publish-gate.ts` + `index.ts`；多 3 个接线点 |
| 两套真相风险 | 无（但 QA 语义被扩大） | 必须让 `auditReachability` 与 `auditPlayability` 共用 `playability/graph.ts`；测试钉住同一几何 |
| 发布闸覆盖 | 自动（只要 gate 调 reachability） | 需要显式切换 gate；但切换后覆盖全部层 |

**结论**：新入口 `auditPlayability` 是唯一满足“三态 + coverage + QA 7 条不变 + 逐条回退”的方案。
framework §4/§6 已裁定该方向；09 确认没有更小的正确方案。

### 8.2 修改面差异（相对“并进 reachability”）

- **新入口**额外修改：
  - `packages/contracts/src/playability/*`（新模块，约 7 个文件）；
  - `packages/contracts/src/index.ts`（加法导出）；
  - `packages/pipeline/src/publish-gate.ts:25,140,142`（gate 切换）；
  - `packages/contracts/src/config-audit.ts:24,53`（deterministic 切换）。
- **并进 reachability**少改 2 个文件，但会：
  - 改变 `auditReachability` 的语义与 QA 报告内容（QA 的 `reachability` 变成“全部可玩性”），
    与 framework §4.3 / QA 判据定义冲突；
  - 失去逐维 coverage 与三态；
  - 使逐条回退只能靠隐藏开关，难以证明“没污染其他判据”。
- 因此，**多出的 3 个接线点是必要成本**；不是“顺手重构”。

### 8.3 standalone `site` / `assemble_site` 覆盖表

| 入口 | 是否过 `assertPublishableQa` | 切换后是否跑 `auditPlayability` | 备注 |
|---|---|---|---|
| CLI `build` / `create --yes` | 是（`cli.ts:281-284`） | **是** | 另有汇合点 `create-game.ts:631-642` 的双保险 |
| CLI `site`（standalone） | 是（`cli.ts:717-720`） | **是** | gate 在 `assembleFromConfig` 之前；失败时 `site/v<N>` 不产 |
| MCP `create_game` | 是（`server.ts:374-378`） | **是** | 与 CLI 同一把闸 |
| MCP `assemble_site` | 是（`server.ts:433-437`） | **是** | gate 在 `assembleSite` 之前 |
| 库直调 `assembleFromConfig` | **否** | **否** | `demo` 不依赖 `pipeline`；既有边界 |
| 库直调 `assembleSite` | **否** | **否** | 本方案不接线；**残余风险**，规格必须明写 |
| TD `td-config/v1` | 闸显式跳过 | 不适用 | P2 例外，不变 |

**规格必须写明的残余风险原句**（建议放入 `publish-gate.ts` 头注释与 `final-report`）：

> 发布闸只覆盖经过 CLI / MCP 发布入口的路径。任何直接调用 `@game-maker/demo` 的
> `assembleSite` / `assembleFromConfig` 的库消费者，都不会执行 `auditPlayability`；
> 它们仍只跑 `auditGameConfig` + 屏幕空间 + 几何。这是与今天“库直调不过闸”同一条既有边界，
> 不是 V1 新引入的承诺。

---

## 9. 事实来源（E1 / E2 / E3）

### 9.1 E1：源码定位

- `packages/contracts/src/reachability.ts:44-226`（现有可达性；`:67-73` moving solid 扫掠；
  `:83-86` 脚点；`:88-114` 格子；`:124-137` 目标与宽松 `covers`；`:139-175` hop；`:177-213` BFS）
- `packages/contracts/src/config-audit.ts:24,39-56`（`deterministic` 拼装）
- `packages/contracts/src/game-config.ts:300-317`（`ConfigIssue` / 闭集 code）、`:267-268`（pickupCount）、
  `:498-587`（`auditGameConfig`；`:533-561` inWorld / spawn-in-solid；`:563-584` warning）
- `packages/contracts/src/qa.ts:111-160`（`QA_JUDGEMENTS` 7 条）
- `packages/contracts/src/index.ts:142-149`（契约导出）
- `packages/pipeline/src/publish-gate.ts:25,134-144,219-224`
- `packages/pipeline/src/create-game.ts:621-643`
- `packages/assets/src/ops.ts:1028-1029`（apex / span 常量）、`:1128-1198`（编译提示词）、
  `:1247-1250`（resampleable）、`:1284-1295`（deterministic）
- `packages/demo/src/site.ts:169,195-217`（`assembleSite` 的三族 + 几何）
- `packages/demo/src/assemble.ts:55-68`（`assembleFromConfig` 分派）
- `packages/demo/src/shell/scene.ts:149-197`（solid/pickup/hazard/goal/chest/danger 运行时）、
  `:270-369`（hazard/danger/chest 状态与复位）
- `packages/qa/src/gameplay.ts:71-86`（QA `reachability` 调用）
- `packages/cli/src/cli.ts:281-284,704-728`；`packages/mcp/src/server.ts:365-378,430-443`

### 9.2 E2：既有测试

- `packages/contracts/tests/reachability.test.ts`（`:106-112` goal 埋行李堆边界；`:132-140` 沟宽阈值）
- `packages/contracts/tests/config-audit.test.ts:37-64`（B-02 分档）
- `packages/pipeline/tests/publish-gate.test.ts:150-208`
- `packages/cli/tests/cli-site-gate.test.ts:170-194`
- `packages/assets/tests/compile-runtime.test.ts:316-340`
- `packages/qa/tests/gameplay.test.ts`

### 9.3 E3：零付费语料 / 矩阵

- `corpus/inventory.json`（冻结 `sha256:25e6c891…`；96 唯一配对 / 20 唯一 config / 2 不可用）
- `corpus/rejudgment.json` / `rejudgment.md`（空间 0、机制 A 3 真缺陷、B 0、completion 0）
- `fixtures/07-matrix/matrix.json`（39 例；17 / 18 / 4）
- `research/03-spatial-probes.mjs`、`03-corpus-spatial.mjs`、`04-*.mjs`、`05-completion-probe.mjs`
  （均已退出 0；见各报告 §证据）

---

## 10. 一句话总结

**V1 的最小正确形状是：一个内部三态 `auditPlayability`，复用同一套移动图核心，把
`PROVEN_UNPLAYABLE` 映射成现有 `ConfigIssue[]`，替换 `deterministic` 与发布闸里的
`auditReachability`，QA 保持 7 条不变。** 不需要新的持久化契约；需要 10 批准的只有
加法导出、profile 假设（P1/P2/P3/P4）与 3 条历史真实缺陷的处置。实施必须按
03 移动图 → 03 空间判据 / `CHEST_BLOCKED` → A → B → completion 的顺序，
每条判据独立 commit、独立回退。
