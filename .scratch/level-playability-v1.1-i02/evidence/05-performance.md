# I02-05 性能与预算基线 — 证据

| 项 | 值 |
| --- | --- |
| 票 | [I02-05 性能与预算基线采集](../issues/06-i02-05-performance-baseline.md)（task · AFK） |
| 结论 | **P0 代理**在现有语料上：容量 p50 `137,800` / max `177,800`，有效搜索墙钟 p50 `32.8ms` / max `42.3ms`。`500k / 2s` 对语料**够用**（容量 2.81×、墙钟 9.23× 余量）；但对 `W=5760` 合成最坏用例**状态预算不够**（`572,200 > 500k`，1.14×），`1M` 硬上限够。墙钟预算在现有规模下不是约束。 |
| 断言 | **12 / 12 通过**（`outputs/run.json` → `summary`） |
| 证据等级 | E1（源码/文档）+ E3（scratch 复跑，退出码 0） |
| 产品目录改动 | **无**（只读；`git status --porcelain` 与开工前一致） |
| 原始输出 | [`outputs/run.json`](../experiments/05-performance/outputs/run.json) |

> ⚠️ 所有数字都是 **P0 冻结模型的代理**，不是 I-02 实现；scratch 结果不构成生产验收。

## 1. 目的与边界

为 I-02 的预算终值（`maxStates` / `timeBudgetMs`）和停止条件提供量级证据。不是：I-02 算法实现、连续时间核心的真实单边代价、两档 lag 编排、Witness 搜索、生产验收。

## 2. 被测算法与差异注记

| 维度 | P0 代理（本实验） | I-02（未实现） |
| --- | --- | --- |
| 碰撞判定 | `segmentCollides`，1D x + 常量 y 重叠 | I02-01 的连续时间 AABB 求交（解析，O(切点数)；见 [I02-03 证据](03-continuous-intersection.md)） |
| 搜索空间 | x 网格 `xStep=2` × `phaseSteps` | D3 未定：可能是移动图脚点 × 相位，或 1D 走廊 × 相位 |
| 边 | 每个状态 `2·floor(maxStep/xStep)+1` 个 x 邻居 | 可能含 walk / walk-off / hop；hop 采样与图割（见 [I02-04 证据](04-graph-cut-hop.md)） |
| 相位 | `dt = periodMs / phaseSteps` | 同；但 N 由 I-00 §6.5 的可行上界自适应，不是固定 200 |
| lag | 单值 `16.67ms` | 两档 `16.67 / 200ms` 分别调用 |
| 预算停止 | `statesEnqueued > maxStates` 或每 1024 状态查墙钟；两者同一 reason | D5/D9 需给出可区分的降级口径 |

因此本实验的**状态容量**只对“x 网格 × 相位”这一种形态成立；图形态的二级代理见 §8。

## 3. 输入与环境

| 输入 | SHA-256 |
| --- | --- |
| `.scratch/level-playability-v1.1-p0/prototype/temporal-model.mjs` | `01788b03db2bef13de5f9951368760f9cc79ba07effb8680d98c6ee270206d4d` |
| `.scratch/level-playability-v1/corpus/inventory.json` | `ba1d051a401ac70f45be5a705e2c478961ffc3fc0a6c9feb4cde09365df5f74f` |
| `inputs/cases.json` | `bd4333e10d289980f0438c6bb7bf970304d88868a4a9b8ff4fc767918dd9a6e3` |

环境：`darwin 24.6.0 · node v22.23.2 · Apple M4 · 10 cores · 16 GiB`；分支 `wayfinder/level-playability-v1.1-i02`，HEAD `a3b8a54`。

命令：

```bash
cd .scratch/level-playability-v1.1-i02/experiments/05-performance
node build-inputs.mjs
node --expose-gc run.mjs     # 退出码 0
```

## 4. 语料结果

口径：`parseOk ∧ format=game-config/v1 ∧ unique by contentHash`，与 I-00 perf-probe 相同。

- **21** 个唯一 config、**31** 个 hazard、**16** 个 config 含运动、**19** 个 x 轴运动 hazard、0 个非 x 轴。
- 状态容量（`xPositions × 200`，`xStep=2`）：**p50 `137,800`，max `177,800`**（min `54,600`）。
- 运行：18 个可用行 × 2 档速度 = 36 次。
  - 4 次在输入门就返回 `unplayable-proof-requires-vertical-evasion-assumption`（永久门 + 未声明垂直规避），不是搜索测量。
  - 18 次在配置速度（≈`0.09 px/ms`）下 `maxStepPx < xStep`，网格不可移动，visited 恒为 200（**退化**）。
  - **14 次有效**（P0 解析上界 `0.16 px/ms`）：

| 指标 | min | p50 | p90 | max |
| --- | --- | --- | --- | --- |
| wallMs | 12.2 | 32.8 | 38.1 | 42.3 |
| statesVisited | 35,350 | 86,400 | 108,874 | 119,130 |
| edgesChecked | 105,850 | 259,000 | 326,422 | 357,190 |
| stateCapacity | 134,600 | 137,800 | 138,920 | 139,400 |

与 I-00 的 `corpus.json` 交叉核对：容量 p50/max（137,800 / 177,800）完全一致；量级一致。

## 5. 合成最坏用例

`goal` 被 hazard 永久覆盖但落在门内 ⇒ `provePermanentGate` 返回 null，BFS 耗尽可达状态，落 `INSUFFICIENT_EVIDENCE / no-witness-found`。

| 用例 | 世界宽 | 容量 `xPositions×200` | visited | edges | wallMs |
| --- | --- | --- | --- | --- | --- |
| E1440 | 1440 | 140,200 | 137,090 | 411,070 | 50.7 |
| E5760 | 5760 | **572,200** | 569,090 | 1,707,070 | 216.7 |

线性外推（与 I-00 的增长扫掠一致）：容量 ≈ `100·W − 3,800`，墙钟 ≈ `0.0376 ms/px`。

## 6. 与预算比较

| 预算 | 语料 max `177,800` | E1440 `140,200` | E5760 `572,200` | 最大墙钟 `216.7ms` |
| --- | --- | --- | --- | --- |
| 建议 `500k / 2s` | 够（2.81× 余量） | 够（0.28×） | **不够（1.14×）** | 够（9.23× 余量） |
| 硬上限 `1M / 10s` | 够 | 够 | 够（0.57×） | 够（46× 余量） |

**判断依据**：

- `500k` 覆盖现有 21 个 config 的 x 网格形态（max 177.8k），但覆盖不了 `W=5760` 的合成最坏用例（572.2k）。
- `2s` 墙钟在现有规模下有 ~9× 余量；**状态预算才是绑定约束**，不是墙钟。
- 若 D5 决定支持 `W≈5760`，默认 `maxStates` 至少要 `600k`；`1M` 硬上限够。
- 若选择“超宽世界直接 IE”，`500k` 可保留，但必须在授权包里写清世界宽度/状态容量的适用范围。

## 7. 重复运行、墙钟方差、两类停止

- **状态计数确定性**：E1440 五次 `visited=137,090 / edges=411,070` 完全一致；E5760 五次 `visited=569,090 / edges=1,707,070` 完全一致。`stateSignatureSha256 = 1e2e2dd8…` 在两个独立进程间一致（签名只含状态预算驱动的运行）。
- **墙钟方差**：E1440 五次 `[48.4, 49.1, 52.0, 53.1, 49.9] ms`（sd ≈ 1.9ms）；E5760 `[214.1, 214.9, 215.7, 216.2, 214.9] ms`（sd ≈ 0.8ms）。同机同进程内稳定。
- **状态预算停止**：E5760 设 `maxStates=500k` ⇒ 停在 `visited=499,801`，`budgetExceeded=true`，`reason=search-budget-exhausted`。
- **墙钟停止**：E5760 设 `timeBudgetMs=5` ⇒ 停在 `visited=9,216–15,360`（5 次 3 个不同值，sd ≈ 2,670），`budgetExceeded=true`，**同一个 reason**。

⇒ P0 把“状态预算耗尽”和“墙钟超时”合并成同一个 `reason`；I-02 的降级口径必须能区分（例如 `degradation` 字段或独立 reason）。这是 D5/D9 的输入。

## 8. 二级代理：移动图脚点 × 相位（D3 未定）

若 D3 选择“移动图脚点 × 相位”而不是 x 网格，状态容量约为 `standableCells × 200`。对 16 个含运动 hazard 的 config，11 个能建图（5 个因旧 schema / manifest 解析失败）：

- 容量 `standable × 200`：**p50 `288,200`，max `384,200`**（约 x 网格的 2 倍）。
- 现有语料仍 < `500k`（0.77×），但 `W=5760` 的平地图外推为 `5761 × 200 = 1,152,200`，**超过 `1M` 硬上限**。
- 若图形态还含多层平台，`standable` 会高于世界宽，容量进一步上升。

⇒ 图形态下 `1M` 硬上限也不够覆盖 5760 宽世界；需要“世界宽度/状态容量上限 + IE”或更小的相位上限。这是 D5 需要与 D3 的搜索空间选择一起裁定的耦合点。

## 9. 对 D5 的事实输入（不构成裁定）

- **F1** 现有语料（x 网格 × 200 相位）容量 p50 `137,800`、max `177,800`。
- **F2** `500k` 覆盖语料（2.81×），不覆盖 `W=5760`（572.2k，1.14×）；`1M` 覆盖。
- **F3** `2s` 墙钟在最大合成用例上仍有 9.23× 余量；绑定约束是状态数。
- **F4** 状态计数确定（同输入 `visited/edges` 完全一致）；墙钟超时的 `visited` 不稳定（9,216–15,360）。
- **F5** P0 对“状态预算”和“墙钟”用同一个 `search-budget-exhausted`，I-02 需要可区分的降级口径。
- **F6** 图形态（若 D3 采用）容量约 2×；`W=5760` 外推 ≈1.15M，`1M` 不够。
- **F7** 备选：保留 `500k` 并把超宽世界直接判 IE；或按世界宽度缩放 `maxStates`；或把相位上限与 `maxStates` 一起定。

## 10. 限制

- **P0 代理，不是 I-02**：没有 I02-01 的连续时间单边代价、两档 lag、Witness 验证、hop 图搜索或覆盖扫描。真实 I-02 的每状态成本可能更高（但 I02-03 显示单次求交是 O(切点数)，数量级仍由状态数主导）。
- 固定 `xStep=2`、`phaseSteps=200`；没有应用 I-00 §6.5 的自适应 N。配置速度档的 18 次运行因此退化（`maxStepPx < xStep`），只作为“固定 N 不可用”的证据保留。
- 4 次语料运行在输入门就返回（永久门 + 无垂直规避假设），不是搜索成本样本。
- 图形态代理只覆盖 11/16 个含运动 config；5 个因旧 schema/manifest 不可建图。
- 墙钟是 Apple M4 单机数据；授权包应使用**状态数**作为主预算，墙钟作为兜底。
- 未改任何产品文件；未新增 fixture pack；未运行全量 `pnpm test`。

## 11. 复现

```bash
cd .scratch/level-playability-v1.1-i02/experiments/05-performance
node build-inputs.mjs
node --expose-gc run.mjs || echo "failures above"
node --expose-gc run.mjs | tail -1   # 两次 stateSignatureSha256 应相同
```

| 产物 | SHA-256 |
| --- | --- |
| `core.mjs` | `dc8d5d05c09d3195048634c8c5d18c5f21e1577aae7ce6fe619a82830cbeb7ab` |
| `build-inputs.mjs` | `f5d07c802cf0f549eb87d897326407c5a75fbff9f26867358df38f28316d1013` |
| `run.mjs` | `e3599f991763b7cdec55c5881c775a1436bb5e21c6139106ca1b1ef34ce71c88` |
| `inputs/cases.json` | `bd4333e10d289980f0438c6bb7bf970304d88868a4a9b8ff4fc767918dd9a6e3` |
| `outputs/run.json`（本次规范运行） | `db1939786d7dad252bd0069de3e2c7bdf14e422a97d89b608660ca2812d54d90` |
| `outputs/stdout.txt` | `682e34c94b7787dc494673594eac21132123d94e322bc1f88951b500b4b838f0` |

`outputs/run.json` 含墙钟样本，逐次运行会变；**状态计数签名** `1e2e2dd8a27d734335a34419eddad25c4572a6bf04d9b8d28238f6d966c5704d` 是两个独立进程间一致的部分。
