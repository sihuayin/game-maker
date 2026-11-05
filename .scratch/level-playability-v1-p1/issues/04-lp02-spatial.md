# LP-02 空间可达性判据

Type: task
Status: resolved
Owner: amber · 2026-11-05
Blocked by: 03
Map: ../map.md

## Question

按 PRD §4.3 实现空间可达性判据。本票 AFK。

### 判据

| 判据 id | 检测内容 |
|---|---|
| `PLAYABILITY_SPATIAL_SPAWN_IN_TERRAIN` | 窄口径：脚点 + 锚点 offset + 附近无 standable；纯盒重叠不采用 |
| `PLAYABILITY_SPATIAL_CHEST_UNREACHABLE` | chest 交互盒（`range` 外扩）无路径可达 |
| `PLAYABILITY_SPATIAL_{PICKUP,CHEST,GATE}_BLOCKED` | 目标完全埋进实心体、无任何自由玩家重叠位置；`BLOCKED` 与 `UNREACHABLE` 同目标互斥，`BLOCKED` 优先 |

### LP-00 复核后的强制约束（已批准）

- `SPAWN_IN_TERRAIN`：复核已裁定**不得作为确定性阻断**；只保留诊断，verdict 固定 `INSUFFICIENT_EVIDENCE` / 仅观察，不接入 deterministic 或 Publish Gate。
- `CHEST_UNREACHABLE`：交互盒按四边外扩 `range` 建模（`scene.ts:315-325`），并与玩家 AABB 严格相交。
- 依赖逐帧几何的严格重叠 / `*_BLOCKED`：无法确认 pack acceptance 时使用 `coverage.partial`，不得因此硬拒。

### 必须交付

- 以出生点为起点的玩家空间可达图，复用 LP-01 模型与真实碰撞尺寸 / 锚点。
- 正例、反例、边界测试；39 例矩阵中空间类用例转为生产测试。
- 无法可靠建模的情况输出 `INSUFFICIENT_EVIDENCE`，不得硬拒。
- 冻结语料空间类重判（至少 20 份唯一 config）。
- 本票 `## Answer`：commit SHA、命令与退出码、测试清单、语料结果、回退点。

### 边界

- 只做空间层；不做机制层与完成性。
- 不新增 CLI / MCP 参数；不新增持久化 schema；QA 仍 7 条。
- 不改历史语料；零付费。

### 通过标准

- AC-03：能识别确定性不可达的 Chest / Pickup / Gate 与出生点冲突。
- 合法复杂布局不被简单几何启发式误杀；空间判据不因算法简化误判合法关卡。

## Answer

**2026-11-05 完成（LP-02，AFK）。Commit `523881d`。空间层是纯加法 + `graph.ts` 的一次内部抽取，`auditReachability` 未改。**

### 交付

- `packages/contracts/src/playability/verdict.ts` —— 三态 + coverage + witness 的类型与层内聚合；层内 verdict 与整关 aggregate 分层（plan R21(a)）。
- `packages/contracts/src/playability/spatial.ts` —— `auditSpatial`：出生点起点的可达图 + 目标覆盖 + BLOCKED / UNREACHABLE。
- `packages/contracts/src/playability/graph.ts` —— 抽出 `hopSamples` / `hopEdges`，跳跃弧全仓只此一份（`hopTargets` 与 LP-02 覆盖判定同源）。
- 生产夹具 `packages/contracts/tests/fixtures/playability-matrix.json`：研究矩阵 `group=spatial` 的 **23 例**（manifest 共用一份）。生成脚本 `../build-spatial-fixtures.mjs`。
- 测试 `packages/contracts/tests/playability-spatial.test.ts`（42 例）+ `playability-graph.test.ts` 新增 1 例。
- 语料脚本 `../rejudge-spatial.mjs` → 证据 `../evidence/04-lp02-spatial.json`。

### 判据语义

| 判据 | 判定 |
|---|---|
| `PLAYABILITY_SPATIAL_{PICKUP,CHEST,GATE}_BLOCKED` | 目标盒（chest 含四边 `range`）的可重叠脚点矩形里**没有任何自由玩家位置**；开区间，不额外外扩。 |
| `PLAYABILITY_SPATIAL_{PICKUP,CHEST,GATE}_UNREACHABLE` | 非 BLOCKED，但从出生点 BFS（walk / walk-off / fall / 真实抛物线）没有可达状态或弧线采样与目标盒**严格**重叠。 |
| `PLAYABILITY_SPATIAL_SPAWN_IN_TERRAIN` | 窄口径：脚点在地形内、扣掉锚点偏移后 `burial > 1px`、且玩家身体范围内无可站立表面。**只诊断，verdict 固定 INSUFFICIENT_EVIDENCE**（LP-00 复核 P4）。 |
| `PLAYABILITY_SPATIAL_SPAWN_NO_FOOTHOLD` | 出生点附近无可站立表面 ⇒ coverage-gap，不产 error。 |

- 目标几何全部走 `profile.ts`：pickup / goal 用帧几何（忽略 `body`），chest 用 `body ?? size` + 四边 `range`；玩家 / 帧几何 ⇒ `coverage.spatial = partial`（审计看不到逐帧 atlas）。`partial` 不让确定性阻断失效，但随层结果显式带出。
- 越界目标（`x<0 || y<0 || 右/下越界`）只记 coverage-gap，归 `auditGameConfig.inWorld`；gate 缺失 / 资源缺失同理，不重复报、不硬拒。
- 同一目标 BLOCKED 与 UNREACHABLE 互斥，BLOCKED 优先；证据 target 去重由测试断言。

### 证据

- `pnpm exec vitest run packages/contracts/tests/playability-spatial.test.ts packages/contracts/tests/playability-graph.test.ts` → 2 文件 / 52 例通过，exit 0。
- `pnpm exec vitest run packages/contracts/tests` → 43 文件 / 900 例通过，exit 0。
- `pnpm test` → 165 文件 / 2487 例通过，exit 0。
- `pnpm typecheck` → exit 0；`pnpm build` → exit 0。
- `node .scratch/level-playability-v1-p1/rejudge-spatial.mjs` → exit 0；冻结语料 `sha256:25e6c891…` 校验通过：
  **20 唯一 config**：`PROVEN_UNPLAYABLE 0` / `INSUFFICIENT_EVIDENCE 2`（均 `gate-missing`）/ `NO_PROVEN_BLOCKER 18`；coverage 全部 `partial`（玩家 / 目标帧几何不可见）；对比现有 `auditReachability`：**新增 0 / 修复 0**。

### 研究矩阵的三处修正（LP-02 复核必须知道）

1. **`spawn-deep-terrain`（#19）**：研究矩阵记 `PROVEN_UNPLAYABLE`；LP-00 复核推翻 P4，生产预期改为 `INSUFFICIENT_EVIDENCE` + `SPAWN_IN_TERRAIN` 诊断（不硬拒）。
2. **`wall-100`（#4）**：研究矩阵把 `signal`（goal）记成 `PICKUP_UNREACHABLE`；按 framework §5.1 的 SUBJECT 规则应为 `GATE_UNREACHABLE`。同一堵墙也封死 `suitcase-2/3`，生产证据会同时报它们。
3. **`chest-range-rescues`（#12）**：研究矩阵记 `NO_PROVEN_BLOCKER`，但它只看了 chest；这一关的 gate 在 100px 沟对面（同高跳跃上界 66px），本来就走不到。生产层内 verdict 是 `PROVEN_UNPLAYABLE` / `GATE_UNREACHABLE`；chest 确实被 `range` 救回（测试单独断言）。

⇒ 39 例矩阵的整关分布需由 LP-06 按上述修正重算（#19 `PROVEN→INSUFFICIENT`、#12 `NO_PROVEN→PROVEN`，即 17/17/5，而非文档里的 17/18/4）。本票不改研究矩阵文件，只改生产夹具的预期并在此记录。

### 边界

- 未接入 `deterministic` / Publish Gate / `auditReachability`（LP-05 接线）；未新增 CLI / MCP 参数；未新增持久化 schema；QA 仍 7 条。
- 未改 Runtime / 历史语料 / 既有验收证据；零模型调用、零生图、零付费。
- 已知 V1 限制：只建模「有落点的跳跃弧」；mid-air touch-only 若弧线不落到任何落脚点，仍可能被报 UNREACHABLE（待 LP-02 复核裁定是否需降级）。

### 回退点

撤销 `523881d` 即可：新增文件全在 `playability/{verdict,spatial}.ts` 与测试 / 夹具 / scratch 证据；`graph.ts` 的改动是 `hopTargets` 拆成 `hopSamples` + `hopEdges` 的等价重构，`auditReachability` 与任何既有调用方未改。
