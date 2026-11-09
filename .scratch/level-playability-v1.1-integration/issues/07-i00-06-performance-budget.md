# I00-06 性能取证与预算

Type: task
Status: resolved
Owner: agent（AFK） · 2026-11-09
Blocked by: 01
Map: ../map.md
Class: I-00 / EVIDENCE

## Question

P0 的 `4096 visited / 12288 edges / 7–19ms`（A 案）是**单次原型样本**，P0 结论包已明说它不构成生产性能承诺。I-00 需要一个可辩护的预算与超限策略，否则 I-04 的验收无从判定。

### 必须交付

1. **代表性规模**：用 scratch 脚本扫出状态空间随 `world 宽度 × distance × periodMs × dt` 的增长曲线；给出本仓库现有语料（21 份横向 config / 19 个移动 hazard）中的真实量级。
2. **重复运行与方差**：同一输入重复 N 次，记录 `elapsedMs` 分布（不是单点）。
3. **预算建议**：`maxStates` 与 `timeBudgetMs` 的建议值，以及它们应写在契约的哪一层。
4. **超限策略**：预算耗尽必须落 `INSUFFICIENT_EVIDENCE`（P0 已定），但需要明确：整体降级还是逐层降级；降级是否影响 coverage；是否允许部分结果。
5. **墙钟的边界**：时间预算只用于搜索，不得参与物理 / 时序判断（P0 规则）。给出「墙钟不可影响结论」的验证方式。

### 产出

`evidence/06-performance.md` + `scripts/perf-probe.mjs` + 原始输出（JSON / 文本）。

### 边界

零付费、零新依赖、只读产品代码；脚本不进 `package.json`、不进 CI。

## Answer

1. **真实语料量级**：21 份唯一横向 config / 31 个 hazard / 19 个移动 hazard。按 P0 的 `phaseSteps=200`、`xStep=2`，状态容量 `xPositions × phaseSteps` 的 p50 = **137,800**、max = **177,800**；按 `phaseSteps ≤ maxSpeed·periodMs/xStep` 的分辨率规则取最大合法 N 后 max = **220,480**。真实可搜索输入的 elapsed p50 = **32 ms**、max = 43 ms（14 个非退化运行）。证据：[`06-performance.md`](../evidence/06-performance.md) §2、[`06-perf/corpus.json`](../evidence/06-perf/corpus.json)。

2. **增长曲线与公式**：`stateCapacity = xPositions × phaseSteps`（宽度扫掠 slope=100、`r²=1.000`）；`edges/state = 2·floor(maxStepPx/xStep)+1`，`maxStepPx = maxSpeed·periodMs/phaseSteps`，16 个非退化点误差 ≤ 0.46%；总边数 ≈ `xPositions × phaseSteps × (2·floor(maxSpeed·periodMs/(phaseSteps·xStep))+1)`。period 使边数/耗时线性增长；**distance 不影响状态空间**（elapsed slope ≈ 0）；phaseSteps 使内存线性增长而耗时进入平台。证据：[`06-performance.md`](../evidence/06-performance.md) §3、[`06-perf/growth.json`](../evidence/06-perf/growth.json)。

3. **重复运行方差**：同一输入跑 7 次，`statesVisited` / `edgesChecked` / `verdict` / `reason` **逐项完全相同**，只有 `elapsedMs` 波动（safe A 2–4 ms；137k 状态 48–50 ms；281k 状态 100–104 ms）。P0 的 `4096 / 12288 / 7–19 ms` 是本机可复现的「首条 witness」路径（2–4 ms），但同一 W=1440 的全搜索是 137,090 visited / 411,070 edges / 48–50 ms，约为其 33×，**不能当预算依据**。证据：[`06-performance.md`](../evidence/06-performance.md) §4、§8、[`06-perf/repeats.json`](../evidence/06-perf/repeats.json)。

4. **预算建议**：默认 `maxStates = 500_000`、`timeBudgetMs = 2_000`；契约硬上限 `maxStates = 1_000_000`、`timeBudgetMs = 10_000`。实测每 edge ≈ 0.126 µs（p50），569k 状态 / 1.7M 边 = 215 ms / 约 61 MiB。**写在契约层**：机制层模块级冻结常量并只读导出（对齐 `completion.ts:68,70` 的 `MAX_COLLECTIBLES`/`EDGE_BUDGET` 与 `mechanic.ts:281-284` 的 `MECHANIC_LIMITS`）；不写进 `GameConfig`、不写进 `FixedRuntimeProfile`、不新增公开参数；P0 的 `options.limits` 只保留为测试/证据 seam。证据：[`06-performance.md`](../evidence/06-performance.md) §5、[`06-perf/budget-boundary.json`](../evidence/06-perf/budget-boundary.json)。

5. **超限策略 = 逐层降级**：只把移动 hazard 这一检查层降为 `INSUFFICIENT_EVIDENCE / search-budget-exhausted`，其他层保持各自 verdict，聚合按 `api.ts:87-92` 落整关 IE；受影响层 `coverage` 必须是 `partial`。**不允许部分结果进入 evidence**：部分 BFS 既不能产 witness，也没有资格产 `PROVEN_UNPLAYABLE`（后者只来自搜索前、O(1) 的永久封锁门）。预算耗尽是单向降级（`SAFE → IE`），不可能把 `UNPLAYABLE` 变成 `IE`。证据：[`06-performance.md`](../evidence/06-performance.md) §6。

6. **墙钟不影响结论，已验证**：`Date.now()` 只出现在 `analyze`（预算检查 + `elapsedMs`）与 `reconstruct`（展示字段），不在三角波/碰撞/永久封锁门。行为上 safe A 在 `timeBudgetMs=0/1` 落 IE、≥2 落 SAFE；gate B 在 `timeBudgetMs=0/1`、`maxStates=0/1` 下仍是 `PROVEN_UNPLAYABLE`；非门输入在任何极端预算下都不会变成 `PROVEN_UNPLAYABLE`。预算检查每 1024 states 一次（粒度导致小预算翻转点在 2–5 ms 间漂移），因此 `timeBudgetMs` 是看门狗、`maxStates` 才是确定性边界。证据：[`06-performance.md`](../evidence/06-performance.md) §7、[`06-perf/meta.json`](../evidence/06-perf/meta.json)。

7. **附带发现的覆盖缺陷（交 I-01）**：P0 的固定 `phaseSteps=200` 在默认玩家速度 90 px/s、`xStep=2` 下，19/19 个语料 hazard 都满足 `maxStepPx < xStep`，BFS 退化为「只能等待」，返回 `IE / no-witness-found`——语义应是「时间分辨率无法表达一步」。契约必须校验 `maxSpeed·periodMs/phaseSteps ≥ xStep`，或按此推导 N，并给专门的 IE reason。证据：[`06-performance.md`](../evidence/06-performance.md) §2.2、§5.1。

复现：`node --expose-gc .scratch/level-playability-v1.1-integration/scripts/perf-probe.mjs --out .scratch/level-playability-v1.1-integration/evidence/06-perf`，退出码 `0`、13/13 检查通过、3.68 s（Node v22.23.2 / Apple M4）。探针：[`../scripts/perf-probe.mjs`](../scripts/perf-probe.mjs)；原始 stdout：[`06-perf/stdout.txt`](../evidence/06-perf/stdout.txt)。
