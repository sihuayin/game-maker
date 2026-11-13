# I-02 U4 独立复核报告（R4）

| 项 | 值 |
| --- | --- |
| 复核对象 | I-02 U4（I02-04：垂直规避图割半部） |
| 复核类型 | R4（授权包 [`docs/v7.8/移动-I02.md`](../../../docs/v7.8/移动-I02.md) §9.4） |
| 复核输入包 | [`.scratch/level-playability-v1.1-u4/reports/09-r4-input-package.md`](../../level-playability-v1.1-u4/reports/09-r4-input-package.md) |
| 复核人 | **independent reviewer subagent, fresh context**（未参与 U4 编写） |
| 日期 | **2026-11-13** |
| Diff 范围（U4 产品路径） | `b884a35b37548e7e686562eadef258d7d0fb9c2f..0cf2e5b287f24c8b5c5d7df204399266573841ea` |
| 复核时 HEAD | `0cf2e5b287f24c8b5c5d7df204399266573841ea`（本次现场 `git rev-parse HEAD`） |
| 授权包 SHA-256（现场复算） | `797cd6fc7b299e22b6e90b9ef8a9567376ea3a914d70f8b6f1fc0f9a6ecedc56`（**匹配**输入包 §1） |
| 增量授权范围 | [`05-u4-incremental-authorization.md`](./05-u4-incremental-authorization.md)：**仅 U4 实施 + R4 复核门 + `graph.ts` `HopSampling` 独立审批前置**；U5、`PUBLIC_NB` / `PUBLIC_PU`、I-03 接线未授权 |
| `graph.ts` 独立审批 | [`06-u4-graph-approval.md`](./06-u4-graph-approval.md)（amber · 2026-11-12，批准命名导出 `HopSampling` 可选尾参）；审批对象 SHA `def3fa71…e55b` 经本次核对等于 `13b4e3b^` 的 `graph.ts`（审批时基线），提案 diff SHA `3213ecfe…` 现场复算匹配 |
| **结论** | **PASS —— R4-01 ～ R4-08 全部 `PASS`，无 `FAIL`、无 `NOT_RUN`** |

> 本报告只依据本次复核人自己的 diff 检查、冻结规格 / 产品源码通读、自写 `/tmp` 数学与边界
> 脚本、以及命令重跑。隔离声明见 §9。

---

## 0. 结论摘要

- **R4-01 ～ R4-08 全部 `PASS`**；无根因需要登记。
- U4 产品路径 diff 只有两个白名单文件：新增 `temporal-evasion.ts`，以及 `playability-temporal-evasion.test.ts`
  的修改。后者在 `b884a35..HEAD` 显示为 `M` 而非 `A`，因为该文件在 `b884a35` 之前已由
  `graph.ts` 独立审批 PR 的 `13b4e3b` 创建；两者都在授权白名单内，**没有第三个产品文件**。
- `graph.ts` 在 `13b4e3b..HEAD` **零 diff**；`temporal.ts` / `reach.ts` / `docs/` / `fixtures/`
  零 diff；无新依赖、无锁文件、无 JSON fixture、无公共 barrel 导出。
- 图割判据使用精确 spawn + `assessReachability(..., { full: true })`；`midAirHits` 只进入否决
  分支；`graphCut.verdict` 恒为 `"conditional"`。hop 双档是两次互相独立的完整 BFS，
  `F1 ⊆ F2` 用整数交叉乘判定，**不使用** `n_doubled === 2·n_base`。
- 复核人独立复算：`F1 ⊆ F2` 与精确有理数子集在 `n1,n2 ≤ 60` 上零分歧；反例 9 的两档确实
  分别给出「可达 / 不可达」；cap 边界 `raw = 120/240` 恰好不绑定、`121/241` 立即降级。
- 命令全部退出码 0：`pnpm build` / `pnpm typecheck` / 图割定向 36/36 / 门区 48/48 /
  graph 11/11 / input 65/65 / `pnpm test`（175 文件 / 2831 测试）。全量测试有 2 条
  vitest worker RPC `onTaskUpdate` 超时（工具层，非断言失败，退出码 0；仓库配置
  `dangerouslyIgnoreUnhandledErrors: true`）。该告警未被用作任何 PASS 依据。
- R4 PASS 的授权边界见 §7：**不授权** U5、公共 NB/PU、I-03 接线、push / PR / merge。

---

## 1. 输入、授权与 diff scope

### 1.1 授权包与授权记录

```text
$ shasum -a 256 docs/v7.8/移动-I02.md
797cd6fc7b299e22b6e90b9ef8a9567376ea3a914d70f8b6f1fc0f9a6ecedc56  docs/v7.8/移动-I02.md
```

匹配输入包 §1 与增量授权记录中的 `797cd6fc…`。增量授权记录明确：本记录只授权 U4 实施、
R4 复核门与 `graph.ts` 独立审批前置；U5、`PUBLIC_NB` / `PUBLIC_PU`、I-03 接线未授权。

### 1.2 U4 产品 diff（`b884a35..HEAD`）

```text
$ git diff --name-status b884a35..HEAD -- packages/ docs/ fixtures/
A	packages/contracts/src/playability/temporal-evasion.ts
M	packages/contracts/tests/playability-temporal-evasion.test.ts
```

补充核对：

- `git diff b884a35..HEAD -- . ':(exclude).scratch/**'` 同样只有上述两项；无其他产品 / 文档 / fixture 变更。
- `git diff --name-only b884a35..HEAD -- '**/package.json' pnpm-lock.yaml '*.json'` **为空**
  （无新依赖、无锁文件、无 JSON fixture）。
- `temporal.ts` / `reach.ts` `git diff --stat` **为空**；`temporal.ts` 无 `computePermanentEvasion`
  引用（U4 未接线）。
- `playability-temporal-fixtures.ts` 未被修改（hash 见 §4）。
- 公共 barrel：`packages/contracts/src/playability/index.ts`、`packages/contracts/src/index.ts`
  均不含 `temporal-evasion`；`packages/contracts/package.json` exports 未变。

**关于测试文件显示为 `M` 的说明**：`playability-temporal-evasion.test.ts` 由 `graph.ts`
独立审批 PR 的 commit `13b4e3b` 创建（当时只含尾参默认等价回归），`b884a35` 是
`13b4e3b` / `2241e11` 之后、U4 产品实现的起点。因此 U4 范围内对该文件的后续追加显示为
修改，而不是新增。它属于授权白名单中的 `packages/contracts/tests/playability-temporal*.test.ts`，
**不构成范围外文件**。

### 1.3 `graph.ts` 独立审批面

```text
$ git diff --name-status 13b4e3b..HEAD -- packages/contracts/src/playability/graph.ts
（空）
$ git merge-base --is-ancestor 13b4e3b 2241e11 && echo yes
yes
```

`git show 13b4e3b -- graph.ts` 的变更面：

- 新增导出类型 `HopSampling = { readonly hz?: number; readonly maxSamples?: number }`；
- 新增内部 `DEFAULT_HOP_SAMPLING = { hz: 60, maxSamples: 120 }` 与 `resolveHopSampling()`；
- `hopSamples` 增加可选尾参并令 `n = max(6, min(maxSamples, ceil(t·hz)))`；
- `hopEdges` / `hopTargets` 透传可选尾参；
- 跳跃公式（`apex` / `dh` / `disc` / `t` / `dx` / 抛物线、取整规则）逐字未改；
- `reachableCells` 未参数化；`reach.ts` 未改。

与审批记录逐项比对：只动 `hopSamples` / `hopEdges` / `hopTargets` 三个导出与一个内部 helper；
默认值与现行 60Hz / cap 120 逐字一致；无其他导出或调用语义变化。审批对象 SHA
`def3fa71…` 经本次 `git show 13b4e3b^:…/graph.ts | shasum -a 256` 复算一致（审批时基线），
提案 diff SHA `3213ecfe…` 现场复算匹配；实际产品 diff 的每个 hunk 都落在该提案范围内。

### 1.4 `temporal-evasion.ts` 的依赖边界（源码检查）

```text
import { maxJumpHeight } from "../game-config.js";
import { boxFromFoot, overlapsStrict } from "./geometry.js";
import type { Aabb, Vec } from "./geometry.js";
import { hopEdges, movementNeighbors } from "./graph.js";
import type { MovementGraph, MoveParams } from "./graph.js";
import { assessReachability } from "./reach.js";
import type { DegradationReason, HopSampleSummary, PermanentGateProof, ProofStatus } from "./temporal-result.js";
```

- 无 `temporal.ts` / `temporal-gate.ts` / `temporal-witness.ts` import；无环。
- `PermanentGateProof` 只作 `import type` 的子字段别名（`["graphCut"]` 等），**不构造**完整对象。
- 无 `Math.random` / `Date.now` / `performance.now`；无 `analyze:` / `Symbol(` / `TEMPORAL_LAG_`。
- 运行时输出固定六个键：`graphCut` / `hopDoubling` / `hopSamplingCoverage` /
  `movementModelClosure` / `status` / `reason`；无 `puConditions` / `geometryCoverage` / `lagMode` /
  `lagInvariantByConstruction` / `certificate` / `internalResult` / `publicCapability` / 公共 Verdict。

---

## 2. 命令重跑（退出码 / 计数）

| # | 命令 | 退出码 | 结果摘要 |
| --- | --- | ---: | --- |
| 1 | `pnpm build` | 0 | `tsc -b` + 各 workspace bundle 全部 Done |
| 2 | `pnpm typecheck` | 0 | 全部 workspace `typecheck: Done` |
| 3 | `pnpm exec vitest run packages/contracts/tests/playability-temporal-evasion.test.ts` | 0 | `1 passed (1)` / `36 passed (36)` |
| 4 | `pnpm exec vitest run packages/contracts/tests/playability-temporal-gate.test.ts` | 0 | `1 passed (1)` / `48 passed (48)` |
| 5 | `pnpm exec vitest run packages/contracts/tests/playability-graph.test.ts` | 0 | `1 passed (1)` / `11 passed (11)` |
| 6 | `pnpm exec vitest run packages/contracts/tests/playability-temporal-input.test.ts` | 0 | `1 passed (1)` / `65 passed (65)` |
| 7 | `pnpm test` | 0 | `175 passed (175)` / `2831 passed (2831)`；`Errors 2` |

### 2.1 全量测试的 2 条 unhandled error

两条均为 vitest 工具层 RPC 超时，不是断言失败：

```text
Error: [vitest-worker]: Timeout calling "onTaskUpdate"
 ❯ Object.onTimeoutError node_modules/.pnpm/vitest@3.2.7_…/vitest/dist/chunks/rpc.-pEldfrD.js:53:10
```

`vitest.config.ts` 已显式设置 `dangerouslyIgnoreUnhandledErrors: true`，注释说明这是该版本的
已知长集成文件 RPC 超时。本次 `175 files / 2831 tests` 全部通过、退出码 0。复核人**未**把该
告警当作 PASS 依据。

全量测试相对 R3 时点（174 文件 / 2795 测试）恰好多 1 个文件、36 条测试，与
`playability-temporal-evasion.test.ts` 的 `36 passed` 一致；未观察到其他测试被增删改
（本单元未修改既有测试文件）。

---

## 3. R4 逐项判定

| # | 验收项 | 判定 | 证据（本次独立核查） |
| --- | --- | --- | --- |
| R4-01 | 图割判据 | **PASS** | `graphCutOf` 用 `withExactSpawnSeed` 把 `startCells()` 覆写为 `[spawnCell]`，再调 `assessReachability(graph, move, [{id:"goal-region", rect: goalRegion}], { full: true })`；`goalIntersections = covered.size`（`reach.ts` 的覆盖集包含可达落脚点、walk-off / fall 下落段与 hop 弧采样点，均为 `overlapsStrict(playerBox, goalRegion)`）；`midAirHits = midAir.size` 只在 `degradationReasonOf` 中作为**否决**（`> 0 ⇒ graph-cut-incomplete`），从不作为正面证据；`verdict` 硬编码 `"conditional"`。测试断言 `seeds=1`、覆盖 0/1、`midAirHits=1` 仍 `conditional`。 |
| R4-02 | hop 双档 | **PASS** | `computePermanentEvasion` 分别调用 `reachWithSampling(..., HOP_BASE={hz:60,maxSamples:120})` 与 `HOP_DOUBLED={hz:120,maxSamples:240}`；每次都是独立 `seen` / `queue` 的完整 BFS（`reached` 只短路覆盖检查，不终止遍历）。`hopSamplingCoverage` 对两档接受弧的并集逐弧用 `normalPositionsCovered(n1,n2)` 判定：`for i in 0..n1: (i*n2) % n1 === 0`，即整数交叉乘的 `F1 ⊆ F2`；**未**比较 `n_doubled === 2·n_base`。`n` / `endpoints` / `cap` 按 D9 `HopSampleSummary` 记录。独立复核见 §5.2–§5.4。 |
| R4-03 | 反例 | **PASS**（附 §6 限制 1 / 2） | D4 §11 的 5、7–12 在 `playability-temporal-evasion.test.ts` 中各有具名测试并通过（36/36）。反例 1–4、6、13 的承载套件 `playability-temporal-gate.test.ts` 48/48 通过，且 U4 未修改 `temporal-gate.ts`；gate 测试文件含具名 1、2、3、4、6、13。复核人另行独立复算反例 9（§5.2）与反例 10 的 `F1 ⊆ F2` 数学（§5.3），并核对了反例 5 的严格重叠边界方向。 |
| R4-04 | 模型闭合 | **PASS** | `MOVEMENT_MODEL_CLOSURE = "not-proven-air-control"` 是常量，`computePermanentEvasion` 无条件返回它；测试覆盖 clean / reachable / cap / coverage 四种 `status/reason`，均保持该字面量。公共面未改：`temporal.ts` 零 diff、`stubTemporalAnalyzer` 仍只返回 `INSUFFICIENT_EVIDENCE`；`temporal-result.ts` 的 `publicCapability` 类型仍为 `"BLOCKED"`；U4 未接线。`scene.ts:89` 现场只读确认每帧无条件 `setVelocityX(...)`，与 D4 §7 的未闭合事实一致。 |
| R4-05 | `graph.ts` | **PASS** | `13b4e3b..HEAD` 对 `graph.ts` 零 diff；`13b4e3b^..13b4e3b` 的变更只有已审批的 `HopSampling` 尾参 + 内部 helper，跳跃公式与既有采样语义未改。默认行为回归：U4-02 组断言无参 ≡ 显式默认 ≡ 单项缺省、稳定序列化逐字节一致、倍档端点不变；`playability-graph.test.ts` 11/11、`playability-temporal-input.test.ts` 65/65 通过。审批记录见 §1.3。 |
| R4-06 | 输出边界 | **PASS** | 运行时 `Object.keys` 恰为六个内部字段；测试显式排除 `puConditions` / `geometryCoverage` / `lagMode` / `lagInvariantByConstruction` / `certificate` / `internalResult` / `publicCapability` / `publicVerdict` / `puEligible`。源码代码本体（去注释）无这些符号；无完整 `PermanentGateProof` 构造、无 `TemporalInternalResult`、无公共 Verdict。`PermanentGateProof` 仅作类型别名来源。无 barrel / package exports。 |
| R4-07 | 范围 | **PASS** | 产品 diff 仅两个白名单文件；`temporal.ts` / `reach.ts` / `docs/` / `fixtures/` 零 diff；无 U5 组装、无预算硬化、无 A–J 矩阵、无生产接线；无新依赖 / 锁文件 / JSON fixture / 公共导出。 |
| R4-08 | 独立验证 | **PASS** | 复核人自写 `/tmp/r4-independent.mjs`（仓库外，未入库），自选反例 9、反例 10 / `F1 ⊆ F2` 与 cap 边界；另加真实弧的取整位置子集核对。全部独立检查通过，退出码 0。见 §5。 |

---

## 4. 文件 SHA-256 与证据

### 4.1 现场复算（HEAD `0cf2e5b`，构建后）

```text
$ shasum -a 256 \
    packages/contracts/src/playability/temporal-evasion.ts \
    packages/contracts/tests/playability-temporal-evasion.test.ts \
    packages/contracts/tests/playability-temporal-fixtures.ts \
    packages/contracts/src/playability/graph.ts \
    docs/v7.8/移动-I02.md \
    .scratch/level-playability-v1.1-u4/evidence/01-graph-approval-proposal.diff
09ca8c5907ed5e530f4c2395ed5854bfc90336f8e797518aed6fb28e499fe54f  temporal-evasion.ts
3839288b33fe623b9c3f420767c6b92b741729fee1bc494f70078013ecc30817  playability-temporal-evasion.test.ts
20b56290fbb76a978a849422fa91fcf1573426172c2d186f75889fc1c2a2b481  playability-temporal-fixtures.ts
85346d6fdada472c4e35bc2574d85fd42ad3bb3145fa09950940cef98e0228b0  graph.ts
797cd6fc7b299e22b6e90b9ef8a9567376ea3a914d70f8b6f1fc0f9a6ecedc56  docs/v7.8/移动-I02.md
3213ecfe85d344a9a3617ed9d648f7000c437f4992edbacf31fd0f463444c62f  01-graph-approval-proposal.diff
```

- 前两项与输入包 §2 在 U4-09 时点的记录**完全一致**。
- `playability-temporal-fixtures.ts` 与输入包 `20b56290…2a2b481` 一致且本单元零 diff。
- `graph.ts` 与输入包 `85346d6f…e0228b0` 一致。
- 授权包 `797cd6fc…` 现场复算匹配。
- 提案 diff `3213ecfe…` 与审批记录一致；审批对象基线 SHA `def3fa71…` 现场等于 `13b4e3b^:graph.ts`。

### 4.2 证据目录的使用

本次复核**未**把 `.scratch/level-playability-v1.1-u4/evidence/` 中的任何作者总结作为结论依据；
仅把 `01-graph-approval-proposal.diff` 当作与审批记录对应的原始 diff 做机械 hash / hunk 对照。
其余结论全部来自产品源码、冻结规格、自己的脚本与命令重跑。

---

## 5. 独立验证（自选反例 + 边界值）

### 5.1 选择理由

- **反例 9（只跑倍档 / 只比较单条 hop 边）**：这是「两次独立完整运行」的核心健全性声明。
  若实现实际上只跑一档或两档共享同一状态，反例会暴露不出来。故用一个在 120Hz 下被否、
  60Hz 下被接受的弧，直接观察两档可达集差异。
- **反例 10 / `F1 ⊆ F2`**：这是本单元最容易被替换成 `n_doubled === 2·n_base` 的地方。
  我用**精确有理数子集**独立重算，而不是重读作者断言。
- **边界值（cap 严格不等式）**：`n = max(6, min(maxSamples, ceil(t·hz)))` 的 `capped` 判定是
  `raw > maxSamples`。`raw` 恰好等于 cap 时必须**不**降级，越过 1 个采样才降级；这是最容易
  出现差一错误的位置。另加真实弧的取整采样位置子集核对，连接「归一化参数」与「世界坐标」。

所有脚本位于 `/tmp/r4-independent.mjs`（仓库外）；对 `pnpm build` 产出的 `dist/` 运行，
未在仓库内新增任何文件。

### 5.2 反例 9：两档确实各自独立运行

合成图与作者测试同构：左台 `x=0..4,y=20`、右台 `x=6..10,y=20`、下层 `x=6..10,y=90`；
在 `(4,17)` 注入 forbidden。目标 `{x:6,y:14,w:1,h:1}`。

```text
base.endpoints 包含 [6,20]                  = true
doubled.endpoints 包含 [6,20]               = false
connectivityPreserved                       = false
reason                                      = graph-cut-incomplete（冻结优先级：任一档可达）
直接 hopSamples(4,20 -> 6,20, 60Hz/120)      base = 13 个采样，不含 (4,17)
                                            doubled = null（120Hz 采样 (4,17) 撞禁区）
```

复核人另打印了 base 的采样序列：`(4,20),(4,19),(4,18),(5,17),(5,16)…,(6,20)`，确实避开
`(4,17)`；120Hz 的 `f=5/24` 采样落在 `(4,17)`，因此整条弧被 `hopSamples` 拒绝。这证明
两档不是「同一次 BFS 换个标签」，而是各自用不同采样重建边集后独立遍历。

### 5.3 反例 10 / `F1 ⊆ F2`：整数子集，不是 2× 代理

把 `normalPositionsCovered(n1,n2)` 与**独立实现**比较：把 `i/n1`、`j/n2` 用 gcd 约分后放入
集合，再判断 `F1` 的每个约分分数是否属于 `F2`。对 `1 ≤ n1,n2 ≤ 60` 的全部 3600 组合：

```text
不一致组合数 = 0
```

关键例：

```text
normalPositionsCovered(6, 18) = true      // 3× 也覆盖，说明不是 2× 代理
normalPositionsCovered(7, 14) = true      // 2×
normalPositionsCovered(7, 13) = false     // 13 不是 7 的倍数
```

这与 D4 §6.2 的 `F1 = {i/n1}`、`F2 = {j/n2}`、整数交叉乘判定逐字一致。作者测试的
`6→18 true / 7→13 false` 确实钉住了「子集」而非「2×」。

### 5.4 真实弧的归一化位置子集

对 `gap` 合成图的 `(4,20) → (6,20)` 弧（`t=0.2s`）：

```text
60Hz  n1 = 12
120Hz n2 = 24
对每个 i ∈ [0,12]，j = i·n2/n1 为整数，
且 hopSamples 的取整后世界坐标 base[i] === doubled[j]
=> 归一化位置与世界坐标两层都满足 F1 ⊆ F2
```

该核对连接了「参数位置子集」与「实际采样点」，排除了「只在纸面上覆盖、取整后漂移」的疑虑。

### 5.5 边界值：cap 的严格 `>` 与降级优先级

用无下层平台的平层图，弧 `(4,20) → (6,20)`，`gravity=900`、`speed=10`：

| 输入 | `t` | base raw / n | doubled raw / n | capped? | 输出 |
| --- | --- | --- | --- | --- | --- |
| `jumpVelocity=900` | `2.000000` | `120 / 120` | `240 / 240` | 否（`raw > 120` / `> 240` 均为 false） | `COMPLETE`, `reason=null` |
| `jumpVelocity=901` | `2.002222` | `121 → 120` | `241 → 240` | 是 | `INCOMPLETE`, `reason=hop-sample-budget` |

两档的 `normalizedCoverage` 在边界两侧都为 `true`（120 整除 240），差别只在 cap 是否绑定。
说明：`raw == cap` **不**降级、越过一个采样即降级，且 cap 原因优先于「覆盖不足」；
与 D4 §6.3 的判败条件一致。该边界也间接验证了两档 `n` 不是被硬编码为 2×。

### 5.6 测试断言是否真正钉住性质

- **R4-01**：测试用 `goalIntersections=0/1`、`midAirHits=1` 仍 `verdict=conditional`、
  `evidence` 含 `seeds=1`、`reach@full` 等具体值，钉住了「精确 spawn / 完整 BFS / midAir 只否决」。
  不足：`covered` 聚合了落脚点、下落段与 hop 采样，输出不能单独拆分三项；源码路径清楚，
  但仅凭运行时字段无法逐项复核。
- **R4-02**：测试钉住 `n=12/24`、`cap=120/240`、`endpoints`、`F1 ⊆ F2`、`7/13` 失败、
  `6/18` 成功、cap 绑定与两档分歧的降级。复核人的独立有理数子集与真实弧核对给出相同结论。
- **R4-03 反例 9 / 10**：测试使用可区分两档的禁区与具体 `n` 值，确实钉住性质（复核人独立复算
  一致）。**反例 5** 的测试只钉住「0.5px 严格重叠边界会影响覆盖」，**没有**强制实现拒绝
  未外扩的 `goalRegion`（见 §6 限制 1）。反例 7 / 11 / 12 部分依赖源码文本扫描，但输出类型
  与运行时六键约束提供了结构性保证。
- **R4-05**：默认等价测试用深相等 + 逐字节序列化，确实钉住默认行为不变。

---

## 6. 未覆盖项 / 限制 / 非阻塞观察

1. **`goalRegion` 的 0.5px 外扩是调用方前置条件，U4 不强制校验**。`PermanentEvasionInput`
   文档要求调用方传入已外扩的 `goalRegion`；模块本身不构造也不检查。反例 5 的测试证明了
   0.5px 边界会改变覆盖结果，但没有证明「未外扩输入会被拒绝」。由于 U4 不产出 PU、且
   `verdict` 恒 `conditional`，这一风险被结构性限制在内部半部；**U5 组装时必须负责外扩并
   证明其成立**。R4 PASS 不覆盖该组装层。
2. **判侧规则 / 反例 6 不在 U4 模块内**。同侧、目标跨门、起点不在严格一侧的拒绝由 U3 门区
   半部 / U5 组装负责；U4 只消费 `goalRegion`。本次以 `temporal-gate.ts` 零 diff +
   gate 套件 48/48 证明未回归，未重新裁定判侧语义。
3. **`n` 是 D9 摘要中的单值投影**。`HopSampleSummary.n` 取该档所有接受弧的最大每弧采样数，
   不是逐弧 `n` 列表；逐弧 `F1 ⊆ F2` 在内部确实逐弧计算，但输出无法逐弧复核。这是 D9
   冻结形状的结果（D4 §6.2 的「每条弧记录 n」在内部契约里被投影），不是 U4 私自缩水。
4. **`connectivityPreserved` 只比较「目标是否可达」布尔值**，不比较完整可达集。若两档都
   未触及目标、但可达落脚点集合因采样密度不同而不同，该字段仍为 `true`。D4 Q7 要求的是
   「完整目标可达性检查」的结论，布尔比较满足该结论；但字段名比实际语义宽，U5 不应把
   它当作图同构证明。
5. **`reachWithSampling` 复制了 `reach.ts` 的 BFS 遍历骨架**（因为 `reach.ts` 在授权范围外、
   不可参数化）。它复用 `movementNeighbors` / `hopEdges` 原语，覆盖语义与 `reach.ts` 对齐，
   但仍是第二份遍历实现，存在漂移风险；`arcSampleCount` 也复刻了 `graph.ts` 的 `n` 公式。
   复核人对当前版本的公式与行为做了逐项比对，未发现漂移；U5 硬化时应考虑消除或固定这两处。
6. **mid-air 仍是 `reach.ts` 的 60Hz 保守扫描**，只作否决证据，不参与 hop 双档参数化。
   这是 D4 §4 / §5 的明确边界，不是缺陷；它也意味着 `midAirHits=0` 永远不能升级为
   Runtime 不可达证明。
7. **未在真实 19 关语料 / 生产数据上运行**；本次覆盖内存合成图、`last-train` 夹具与全量测试。
   性能 / 预算基准属于 U5，不在 R4 范围。
8. **`pnpm test` 的 2 条 unhandled error** 是 vitest worker RPC 超时；175 文件 / 2831 测试
   全部通过、退出码 0。仓库配置显式忽略该工具层错误；未把它当作断言通过的依据。
9. **测试文件顶部注释已过时**：`playability-temporal-evasion.test.ts` 开头仍写「本文件此阶段
   只承载尾参回归；U4 图割语义由后续票追加」，与当前已包含 U4-04～U4-08 的内容不符。
   纯文档性瑕疵，不影响判定。
10. **U4-02 的默认等价测试在 `b884a35` 之前已存在**（`13b4e3b`），本次复核把它计入 R4-05
    的证据，但它的历史归属是 `graph.ts` 审批 PR；R4 范围只对 U4 追加部分负责。

---

## 7. 授权边界声明

**R4 PASS 不等于 U5 授权，也不等于任何公共能力授权。** 具体地：

- 本 PASS **不授权 U5**（预算 / 确定性硬化、A–J 矩阵、性能基准、最终集成与完成报告）；
  只允许据此**申请** U5 的独立增量授权。
- **不授权** `PUBLIC_NB` / `PUBLIC_PU`；不授权发布 `PROVEN_UNPLAYABLE` 或任何公共 Verdict。
- **不授权** I-03 接线（`coverage.temporal`、`mechanic.ts` / `api.ts` 接线、公共 Verdict 聚合）。
- **不授权** push、创建 PR、合并或 i02 → main。
- 生产 PU 仍受两项独立阻塞：几何 coverage `partial`（I-00 §7 第 2 条）与空中水平控制未闭合
  （`movementModelClosure="not-proven-air-control"`，I-00 §7 第 5 条）。R4 PASS 不消除这两项。
- 本 PASS 不替代 U4 的用户签署（U4-SIGN）；R4 之后仍需用户审阅并签署。

---

## 8. 用户签署栏（由 U4-SIGN 填写，复核人留空）

```text
用户结论：        [ ] 接受 R4 复核结论（PASS）
                  [ ] 不接受 / 要求补充复核
签署人：
日期：
备注：
```

---

## 9. 复核声明（隔离）

- 复核人**未参与 U4 实现**；本报告全部结论来自本次独立的 diff 检查、冻结规格 / 产品源码阅读、
  自写 `/tmp` 数学 / 边界脚本与命令重跑。
- 复核人**未读取** `.scratch/level-playability-v1.1-u4/reports/09-implementation.md`、
  `09-draft-pr.md`、`.scratch/level-playability-v1.1-u4/map.md`，也未读取
  `.scratch/level-playability-v1.1-u4/issues/` 下除 `11-u4-r4-review.md` 外的任何票。
- 复核人**未**把 `.scratch/level-playability-v1.1-u4/evidence/` 作为结论依据；仅将
  `01-graph-approval-proposal.diff` 作为与审批记录对应的原始 diff 做机械 hash / hunk 对照。
- 复核人未修改 `packages/**`、`fixtures/**`、`docs/**`、产品代码、测试或配置；未提交、未推送、
  未创建 PR、未合并；本次唯一写入的文件是本报告。
- 独立脚本位于 `/tmp/r4-independent.mjs`（仓库外），未向仓库新增任何夹具 / 测试 / 依赖。
- 本报告路径：`.scratch/level-playability-v1.1-i02/reports/R4-review.md`。
