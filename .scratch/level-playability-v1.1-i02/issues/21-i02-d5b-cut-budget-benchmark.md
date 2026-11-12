# I02-D5B 累计 cut 预算基准

Type: task
Status: resolved
Owner: amber
Blocked by: 11
Map: ../map.md
Class: I-02 / EVIDENCE

## Question

用 scratch 基准确定 `maxCutsPerBranch` 的默认值与硬上限，并复核 `maxWitnessBytes` / `maxWitnessTransitions` 的实测依据。**不写生产代码，不做生产验收声明。**

### 必须产出

1. 每条 edge / check 的 cut 数分布（p50 / p90 / max）。
2. U2 每档 lag 的累计 cut 分布（语料 + 合成最坏用例）。
3. `maxCutsPerBranch` 的建议默认值与硬上限。
4. `maxWitnessTransitions` / `maxWitnessBytes` 的实测复核（当前暂定 `1M` / `64 MiB`）。
5. 命令、输入 SHA、原始输出摘要、复现方法。
6. 是否修改产品目录（必须为否）。

## 相关证据

- [I02-D5 预算、确定性与降级裁定](11-i02-d5-budget-determinism.md)：§3.1 累计 cut 预算、§9.2 基准证据清单。
- [I02-03 连续时间求交可行性实验](../evidence/03-continuous-intersection.md)：单次求交代价 O(切点数)。
- [I02-05 性能与预算基线采集](../evidence/05-performance.md)：语料状态容量与墙钟。

## 下游

D7、D9、AUTH。

## Answer

**AFK task 已完成。** 用 D3/D10 形状的 scratch 代理跑完语料与合成最坏用例，冻结 `maxCutsPerBranch` 的建议值与 witness 体积的实测依据。

**修改产品目录：否**（只读；仅本票、`experiments/06-cut-budget/`、`evidence/07-cut-budget.md`、地图与下游票尾）。

> ⚠️ 代理不是 I-02 实现；本票不构成生产验收。

### 1. 做了什么

- 新增 scratch 实验 `.scratch/level-playability-v1.1-i02/experiments/06-cut-budget/`（`build-inputs.mjs` / `core.mjs` / `run.mjs`）。
- 状态形状按 D3/D10：脚点整数格 `xStep=1`、`N = min(N_max, floor(maxStates/xPositions))`、wait / move 两种边、连续解析求交、`lagMode="pad"`。
- 语料：21 个唯一 config、19 个 x 轴移动 Hazard；148 个语料 run（19 行 × 2 lag × 2 限值；速度档部分与 `0.16` 重合，去重后为 148）；另加 1 个安全路径 witness 用例。
- 断言 **10 / 10 通过**，退出码 0。证据：[`evidence/07-cut-budget.md`](../evidence/07-cut-budget.md)、[`outputs/run.json`](../experiments/06-cut-budget/outputs/run.json)。

### 2. 每条 edge / check 的 cut 分布

合计 116,553,390 次 check：

| 指标 | 值 |
| --- | ---: |
| cutPoints = 0 | 99.94% |
| cutPoints = 1 | 0.06% |
| cutPoints max | **1** |
| segments max | **2** |

在 D10 的相位网格下 `dt = P/N ≤ P/2`（`N ≥ 2`），一次 check 最多跨一个内部折返点，所以 **cutPoints ≤ 1、segments ≤ 2**。`maxCutsPerCheck = 1,000,000` 是纯 DoS 守卫，永远不会接近。

### 3. U2 每档 lag 的累计分布

推荐限值 `maxStates = 500,000`：

| lag (ms) | cutPoints p50 / p90 / max | segments p50 / p90 / max |
| ---: | ---: | ---: |
| 16.67 | 0 / 3,610.5 / 3,955 | 764,977 / 1,074,933 / **1,263,594** |
| 200 | 0 / 3,561 / 3,955 | 748,239 / 1,059,334 / **1,244,310** |

硬限值 `maxStates = 1,000,000`：

| lag (ms) | cutPoints p50 / p90 / max | segments p50 / p90 / max |
| ---: | ---: | ---: |
| 16.67 | 0 / 0 / 3,302 | 780,195 / 1,549,500 / **2,057,148** |
| 200 | 0 / 0 / 3,257 | 769,057.5 / 1,521,528 / **2,025,612** |

U9 等待成本（N=480）：每相位格 1 cut / 3 segments，全部 N 格 480 cut / **1,440 segments**，相对 W 可忽略；按 D5 与 W 共用 NB 预算。

合成最坏用例（`maxStates = 1,500,000`，超出硬状态上限）：

| 用例 | N | states | edges | cutPoints | segments |
| --- | ---: | ---: | ---: | ---: | ---: |
| E1440 | 640 | 877,020 | 2,630,420 | 0 | 2,630,420 |
| E5760 | 261 | 1,485,176 | 7,425,097 | 28,497 | **7,453,594** |
| W1440 安全路径 | 640 | 704,320 | 2,112,320 | 0 | 2,112,320 |

E5760 按 1M 硬状态上限停止时约 5.0M segments；硬 cut 预算 10M 对该点约 2× 余量，对完整 1.5M 状态代理仍有 1.34× 余量。

### 4. `maxCutsPerBranch` 建议

**方案 A（推荐）：计量单位 = 解析段数 `segments`**

| 预算 | 默认 | 硬上限 | 依据 |
| --- | ---: | ---: | --- |
| `maxCutsPerBranch`（segments） | **5,000,000** | **10,000,000** | 推荐限值 max `1,263,594`（3.96×）；硬限值 max `2,057,148`（4.86×）；E5760 按 1M 状态上限约 5.0M（2×），完整 1.5M 状态代理 7.45M（1.34×） |
| `maxCutsPerCheck`（cutPoints） | 1,000,000 | 1,000,000 | 实测每 check max 1；保持 DoS 守卫 |

理由：cutPoints 实测最大 3,955，若累计预算按 cutPoints 计将永远不触发，连续求交的真实代价只能间接由 `maxEdges` 约束；按 segments 计才直接约束实际工作。**AUTH 必须把 D5 §3.1 的 `cuts` 明确为 `segments`，D9 同时暴露 `cutPointsTotal` 与 `segmentsTotal`。**

**方案 B（fallback，若 AUTH 坚持 cutPoints 语义）**：`maxCutsPerBranch` = 1,000,000 / 硬 4,000,000；该预算不具约束力，真实工作由 `maxEdges` 约束。

无论 A/B：累计预算不得先于状态 / edge 预算触发，否则降级原因会从 `state-budget` / `edge-budget` 变成 `cut-budget`。

### 5. Witness 体积实测与建议

记录形状样本：

- 全记录 `{from,to,t0,t1,playerBox,hazardBox,verification}` = **200 B / 转移**；
- 紧凑记录 `[fromFoot,fromK,toFoot,toK,t0,t1,verified]` = **35 B / 转移**。

| 场景 | 转移数 | 全记录 | 紧凑记录 |
| --- | ---: | ---: | ---: |
| 实测路径型 witness | **1,380** | 276 KB | 48 KB |
| 策略表上界 @ 500k 状态 | 500,000 | **100 MB** | 17.5 MB |
| 策略表上界 @ 1M 状态 | 1,000,000 | **200 MB** | 35 MB |

`64 MiB` 可容纳：全记录 **335,544** 转移；紧凑记录 **1,917,396** 转移。

**结论：`1,000,000` 转移与 `64 MiB` 只对紧凑记录自洽；全记录下 1M 转移需要约 200 MB。** 路径型 witness 远低于上限，真正可能触顶的是 D3/D10 的策略表型 witness。

建议（由 D9 冻结形状后二选一）：

| 方案 | `maxWitnessTransitions` | `maxWitnessBytes` | 条件 |
| --- | ---: | ---: | --- |
| **W1（推荐）** | 1,000,000 | 64 MiB | D9 冻结紧凑记录（≤ 64 B/转移；实测 35 B） |
| W2 | 250,000 | 64 MiB | D9 保留全记录（200 B/转移） |
| W3 | 1,000,000 | 256 MiB | 保留全记录且坚持 1M；不推荐 |

体积检查必须在构造过程中进行；触顶 ⇒ IE `witness-volume`（D5 已冻结），不得截断后继续。

### 6. 命令、输入与复现

```bash
cd .scratch/level-playability-v1.1-i02/experiments/06-cut-budget
node build-inputs.mjs
node run.mjs          # 退出码 0；checks=10/10
```

| 输入 | SHA-256 |
| --- | --- |
| `.scratch/level-playability-v1/corpus/inventory.json` | `ba1d051a401ac70f45be5a705e2c478961ffc3fc0a6c9feb4cde09365df5f74f` |
| `inputs/cases.json` | `e59581c20d047f768b8e53b281c33fa878260a507ee2ea2090c3ddfb2ce5a7f9` |
| `core.mjs` / `run.mjs` | `0b0fa21b…` / `3fb06630…` |

环境：`darwin 24.6.0 · node v22.23.2 · Apple M4 · 10 cores · 16 GiB`；HEAD `6b2819d`。

### 7. 限制

- 代理不含静态 solids、走廊派生、Goal Rect 内缩、U9/W 证明与策略表构造；BFS 只取第一条路径。
- 策略表型 witness 规模用状态容量上界估计，不是实测。
- `lagMode="pad"` 是 P0 保守对称带，不是 D2 的精确 ∃δ；只影响命中与搜索规模，不改变 cutPoints。
- 浮点边界会产生少量假内部切点（0.06%）；不得用容差掩盖碰撞，但 cut 计数器应允许边界抖动。
- 所有数字都是 scratch 证据，不是生产预算或生产验收。
