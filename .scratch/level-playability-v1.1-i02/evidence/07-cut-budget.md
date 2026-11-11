# I02-D5B 累计 cut 预算基准 — 证据

| 项 | 值 |
| --- | --- |
| 票 | [I02-D5B 累计 cut 预算基准](../issues/21-i02-d5b-cut-budget-benchmark.md)（task · AFK） |
| 结论 | 在 D3/D10 形状的代理上，**cut 点数几乎恒为 0**（99.94% 的 check 为 0，最大 1）；真正的工作量是解析段数 `segments = cuts + 1`，累计约等于 edge 数。推荐把 `maxCutsPerBranch` 的计量单位明确为**解析段数**：默认 `5,000,000`、硬上限 `10,000,000`。Witness 体积：路径型 1,380 转移 / 276 KB；策略表型上界可达状态容量（500k → 100 MB 全记录，1M → 200 MB），因此 `1M 转移 + 64 MiB` 对全记录形状**不自洽**，需 D9 先冻结记录形状。 |
| 断言 | **10 / 10 通过**（`outputs/run.json` → `checks`） |
| 证据等级 | E3（scratch 复跑，退出码 0）+ E1（源码 / 裁定引用） |
| 产品目录改动 | **无**（只读；`git status --porcelain` 与开工前一致） |
| 原始输出 | [`outputs/run.json`](../experiments/06-cut-budget/outputs/run.json)、[`outputs/stdout.txt`](../experiments/06-cut-budget/outputs/stdout.txt) |

> ⚠️ 本实验是 **D3/D10 形状的 scratch 代理**，不是 I-02 实现，也不构成生产验收。代理跳过了静态 solids、走廊派生、Goal Rect 内缩、U9/W 的完整证明义务与策略表构造；BFS 只取第一条路径。

## 1. 目的与边界

回答 D5 §3.1 留给 D5B 的三个问题：

1. 每条 edge / check 的 cut 点数分布；
2. U2 每档 lag 的累计 cut / segment 分布（语料 + 合成最坏用例）；
3. `maxCutsPerBranch` 的默认值与硬上限，以及 `maxWitnessTransitions` / `maxWitnessBytes` 的实测依据。

不是：I-02 算法实现、连续时间核心的真实单边代价、U9/W 的证明、生产验收。

## 2. 代理模型与差异

| 维度 | 代理（本实验） | I-02（未实现） |
| --- | --- | --- |
| 状态 | `(footX, k)`，脚点整数格 | 同（D3），但含 `standable` 走廊与真实 spawn 校验 |
| 网格 | `xStep = 1`；`N = min(N_max, floor(maxStates/xPositions))`；`N_max = floor(maxSpeed·P/xStep)` | 同（D5 §4） |
| 边 | `wait` + `move(-maxCells..+maxCells)` | D3 的 wait / move；U9 的接近 / 停留 / 出口段 |
| 碰撞 | 连续解析求交；`lagMode = "pad"`（P0 保守对称带） | D3：`overlapsStrict` + `lagPad`；D4 另有门区 |
| 障碍 | 只有 Hazard | 含静态 solids、`forbiddenBoxes`、Goal Rect 内缩 |
| 搜索 | BFS 到第一条路径；不构造策略表 | U9 + W（最小不动点）、逐转移验证记录 |
| 预算 | 状态 / 墙钟停止；不强制 cut 预算 | 状态 / edge / cut / witness 体积 / 墙钟 |

**计量定义**（本实验与建议）：

```text
cutPoints = 严格落在 (t0, t1) 内部的折返点数量
segments  = cutPoints + 1        // 实际求解的线性子区间数
```

## 3. 输入与环境

| 输入 | SHA-256 |
| --- | --- |
| `.scratch/level-playability-v1/corpus/inventory.json` | `ba1d051a401ac70f45be5a705e2c478961ffc3fc0a6c9feb4cde09365df5f74f` |
| `experiments/06-cut-budget/inputs/cases.json` | `e59581c20d047f768b8e53b281c33fa878260a507ee2ea2090c3ddfb2ce5a7f9` |
| `experiments/06-cut-budget/core.mjs` | `0b0fa21b5908ae4a22ffce1f9d8070ec2aa5af602f4d2ff4382b3772151b966f` |
| `experiments/06-cut-budget/run.mjs` | `3fb06630a8e22e9c9e824d55d12a0d4fa88b324457ef4337e939f7753720f09e` |
| `experiments/06-cut-budget/outputs/run.json` | `4ef3ead5f90f17675da7e2a41015b3f91e9b2d8a88884ebec077a6c23dbf481b` |

环境：`darwin 24.6.0 · node v22.23.2 · Apple M4 · 10 cores · 16 GiB`；分支 `wayfinder/level-playability-v1.1-i02`，HEAD `6b2819d`。

命令：

```bash
cd .scratch/level-playability-v1.1-i02/experiments/06-cut-budget
node build-inputs.mjs
node run.mjs          # 退出码 0
```

## 4. 语料范围

- 21 个唯一 config、19 个 x 轴移动 Hazard（与 I02-05 同口径）。
- 过滤：`axis="x"`、`goalX > startX`、`hazardAtX` 可解。
- 运行：**148** 个语料 run（19 行 × 2 lag × 2 限值；速度档部分与 `0.16` 重合，去重后为 148）；另加 1 个安全路径 witness 用例。
- 速度档：配置速度（多为 `0.09 px/ms`）与解析上界 `0.16 px/ms`；lag：`16.67` / `200 ms`；限值：推荐 `500k` / 硬 `1M` 状态（墙钟均为 60 s，不构成约束）。

## 5. 每条 edge / check 的 cut 分布

合计 **116,553,390** 次 check：

| 指标 | 值 |
| --- | ---: |
| cutPoints = 0 | 116,480,547（**99.94%**） |
| cutPoints = 1 | 72,843（0.06%） |
| cutPoints max | **1** |
| segments = 1 | 116,480,547（99.94%） |
| segments = 2 | 72,843（0.06%） |
| segments max | **2** |

结论：在 D10 的相位网格下 `dt = P/N ≤ P/2`（`N ≥ 2`），一次 check 最多跨一个内部折返点，因此 **cutPoints ≤ 1、segments ≤ 2**。`maxCutsPerCheck = 1,000,000` 在这个形状下是纯粹的 DoS 守卫，永远不会接近。

> 数值注记：`t0 = d·dt` 与折返点 `k·P/2` 的浮点对齐会产生少量“边界上的假内部切点”（0.06%），生产实现不得用容差掩盖碰撞，但 cut 计数器应允许这类边界抖动；预算余量足够。

## 6. U2 每档 lag 的累计分布

### 6.1 推荐限值（`maxStates = 500,000`）

| lag (ms) | runs | cutPoints p50 / p90 / max | segments p50 / p90 / max | 最大 segments 样例 |
| ---: | ---: | ---: | ---: | --- |
| 16.67 | 36 | 0 / 3,610.5 / **3,955** | 764,977 / 1,074,933 / **1,263,594** | `.scratch/entity-identity-v1/.../game-config.json#enemy-1`，`0.16 px/ms`，states 421,316 |
| 200 | 36 | 0 / 3,561 / **3,955** | 748,239 / 1,059,334 / **1,244,310** | 同左，states 414,888 |

### 6.2 硬限值（`maxStates = 1,000,000`）

| lag (ms) | runs | cutPoints p50 / p90 / max | segments p50 / p90 / max | 最大 segments 样例 |
| ---: | ---: | ---: | ---: | --- |
| 16.67 | 36 | 0 / 0 / **3,302** | 780,195 / 1,549,500 / **2,057,148** | 同左，states 685,908 |
| 200 | 36 | 0 / 0 / **3,257** | 769,057.5 / 1,521,528 / **2,025,612** | 同左，states 675,396 |

- 两档 lag 必须各自独立预算（D5 §5.1）；本表按 lag 分列。
- cutPoints 与 lag 基本无关（pad 不增加折返点）；segments 的差异来自 pad 改变碰撞命中与搜索规模。

### 6.3 合成最坏用例（`maxStates = 1,500,000`，超出硬状态上限）

| 用例 | N | states | edges | cutPoints | segments |
| --- | ---: | ---: | ---: | ---: | ---: |
| E1440（lag 16.67） | 640 | 877,020 | 2,630,420 | 0 | **2,630,420** |
| E1440（lag 200） | 640 | 875,860 | 2,626,940 | 0 | 2,626,940 |
| E5760（lag 16.67） | 261 | 1,485,176 | 7,425,097 | 28,497 | **7,453,594** |
| E5760（lag 200） | 261 | 1,484,698 | 7,422,707 | 28,487 | 7,451,194 |
| W1440 安全路径（lag 16.67） | 640 | 704,320 | 2,112,320 | 0 | 2,112,320 |

- E5760 的 1.5M 状态**超过**硬状态上限 1M；按比例在 1M 状态停止时约 **5.0M segments**。硬 cut 预算 `10,000,000` 对 1M 状态约 2× 余量，对完整 1.5M 状态代理仍有 1.34× 余量。
- W1440 找到路径型 witness：1,380 转移，验证 witness 体积远低于上限。

## 7. U9 等待成本

取语料最大 N（480，dt 6.25 ms）：

| 项 | 值 |
| --- | ---: |
| 残差等待（每个相位格） | 0 cut / 1 segment |
| 整周期等待（每个相位格） | 1 cut / 2 segments |
| 每相位格合计 | 1 cut / 3 segments |
| 全部 N 个相位格 | 480 cut / **1,440 segments** |

- U9 的等待成本相对 W 的累计 segments 可忽略（<0.2%）。
- 按 D5，U9 与 W 共用 NB 预算；不需要单独的 U9 cut 计数器。

## 8. Witness 体积

记录形状样本（字段来自 D4/D9 上游裁定，非最终契约）：

- 全记录：`{from,to,t0,t1,playerBox,hazardBox,verification}` → **200 B / 转移**；
- 紧凑记录：`[fromFoot,fromK,toFoot,toK,t0,t1,verified]` → **35 B / 转移**。

| 场景 | 转移数 | 全记录 | 紧凑记录 |
| --- | ---: | ---: | ---: |
| 实测路径型 witness（W=1440，hazard y 分离） | **1,380** | 276 KB | 48 KB |
| 策略表上界 @ 推荐状态容量 500k | 500,000 | **100 MB** | 17.5 MB |
| 策略表上界 @ 硬状态容量 1M | 1,000,000 | **200 MB** | 35 MB |

`64 MiB` 在两种形状下可容纳的转移数：

| 形状 | 每转移 | 64 MiB 可容纳 |
| --- | ---: | ---: |
| 全记录 | 200 B | **335,544** |
| 紧凑记录 | 35 B | **1,917,396** |

**结论**：`maxWitnessTransitions = 1M` 与 `maxWitnessBytes = 64 MiB` 只对**紧凑记录**自洽；若 D9 冻结全记录形状，1M 转移需要约 200 MB。路径型 witness 远低于两个上限，真正可能触顶的是 D3/D10 的**策略表型** witness。

## 9. `maxCutsPerBranch` 建议

### 9.1 方案 A（推荐）：计量单位 = 解析段数

| 预算 | 建议默认 | 建议硬上限 | 依据 |
| --- | ---: | ---: | --- |
| `maxCutsPerBranch`（segments） | **5,000,000** | **10,000,000** | 推荐限值实测 max `1,263,594`（3.96× 余量）；硬限值实测 max `2,057,148`（4.86× 余量） |
| `maxCutsPerCheck`（cutPoints） | 1,000,000 | 1,000,000 | 实测每 check max 1；保持 DoS 守卫 |

理由：cutPoints 实测最大仅 3,955，若累计预算按 cutPoints 计，永远不会触发，连续求交的真实代价只能间接由 `maxEdges` 约束；按 segments 计才直接约束实际工作。建议 AUTH 把 D5 §3.1 的 `cuts` 明确为 `segments`，D9 暴露 `cutPointsTotal` 与 `segmentsTotal` 两个字段。

### 9.2 方案 B（若 AUTH 坚持 cutPoints 语义）

| 预算 | 建议默认 | 建议硬上限 | 说明 |
| --- | ---: | ---: | --- |
| `maxCutsPerBranch`（cutPoints） | 1,000,000 | 4,000,000 | 实测 max 3,955；该预算**不具约束力**，真实工作由 `maxEdges` 约束 |

无论 A/B，都必须满足：累计预算不得先于状态 / edge 预算触发，否则降级原因会从 `state-budget` / `edge-budget` 变成 `cut-budget`，与 D5 的确定性签名口径冲突。

## 10. Witness 预算建议

| 方案 | `maxWitnessTransitions` | `maxWitnessBytes` | 条件 |
| --- | ---: | ---: | --- |
| W1（推荐） | 1,000,000 | 64 MiB | D9 冻结**紧凑记录**（≤ 64 B/转移；实测 35 B） |
| W2 | 250,000 | 64 MiB | D9 保留全记录（200 B/转移；64 MiB / 200 B = 335,544，留 25% 余量） |
| W3 | 1,000,000 | 256 MiB | 保留全记录且坚持 1M 转移；不推荐（内存与审计成本） |

补充：witness 体积检查必须在构造过程中进行；触顶 ⇒ IE `witness-volume`（D5 已冻结），不得截断后继续。

## 11. 限制

- 代理不是 I-02 实现；不含静态 solids、走廊派生、Goal Rect 内缩、U9/W 证明、策略表构造。
- BFS 只取第一条路径；策略表型 witness 的规模用状态容量上界估计，不是实测。
- `lagMode = "pad"` 是 P0 的保守对称带，不是 D2 的精确 ∃δ；只影响命中与搜索规模，不改变 cutPoints。
- 语料含 `out/__p03-smoke`、`.scratch/**` 等历史 run config；与 I02-05 口径一致，不额外清洗。
- 浮点边界会产生少量假内部切点（0.06%），见 §5 注记。
- 所有数字都是 scratch 证据，不是生产预算或生产验收。

## 12. 复现

```bash
cd .scratch/level-playability-v1.1-i02/experiments/06-cut-budget
node build-inputs.mjs
node run.mjs
```

预期：`checks=10/10`，退出码 0；`outputs/run.json` 的 `bounds`、`perLagLimit`、`witness.policyBound` 与本文一致。
