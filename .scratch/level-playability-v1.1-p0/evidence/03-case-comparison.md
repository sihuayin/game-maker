# P0-03 A/B/C 三案例验证与真实 Runtime 对照

| 项 | 值 |
|---|---|
| 日期 | 2026-11-07 |
| 分支 | `p1/level-playability-v1.1-p0` |
| 本票开始 HEAD / 回退点 | `be234df`（P0-03a 收口） |
| 分析器 | P0-02 冻结原型 `prototype/temporal-model.mjs`（12/12 测试，冻结于 `703c62a` / 修正于 `eb30032`） |
| 案例与站点 | P0-03a：[`cases/a/`](../cases/a/)、[`cases/b/`](../cases/b/)、[`cases/c/`](../cases/c/) |
| Runtime | 现有 playtest harness（无头 Chrome / CDP），`--repeat 2` |
| 最终 `lagMs` | **200 ms**（依据见 §1） |
| 性质 | 零付费；未改 Runtime / 生产判据 / 历史产物 / 既有 fixture；未新增观察字段 |

## 0. 方法

- A/B 用**真实 Phaser Runtime** 运行 P0-03a 装配的 scratch 站点；C 只用分析器输入（票面允许）。
- 分析器对每个案例跑 `16.67ms` 与 `200ms` 两档；最终档同为 `200ms`（§1）。
- A 额外构造「原地等待 → 通过」的水平 witness，并用冻结原型的 `verifyWitness` 逐段验证；
  冻结 BFS 自己返回的 witness 是低速前进，不能单独当作「等待」证据。
- B 的不可玩结论只来自**永久封锁门**证明；Runtime 的复位/无进展只作旁证。
- C 的 `INSUFFICIENT_EVIDENCE` 是模型边界，不是不可玩结论。

## 1. Lag 敏感性审计（P0-02R 条件 2）

### 1.1 真实 trace 的观测最大帧间隔

从正式运行（A/B 各 `--repeat 2`）的 `trace.jsonl` 计算相邻观测的 `t` 差：

| 案例 | attempt | trace 行数 | 最大间隔 | p95 | 中位数 | >100ms 的间隔 |
|---|---|---:|---:|---:|---:|---:|
| A | v1 | 102 | **94 ms** | 40 ms | 38 ms | 0 |
| A | v2 | 102 | **92 ms** | 39 ms | 37 ms | 0 |
| B | v1 | 264 | **93 ms** | 39 ms | 38 ms | 0 |
| B | v2 | 260 | **93 ms** | 40 ms | 38 ms | 0 |

- 四轮合计观测最大间隔：**94 ms**。
- ⚠️ 这是 harness 的**trace 观测间隔**，不是 Runtime 单帧 `delta` 的绝对上界；不得直接当成 `lagMs`。

### 1.2 余量与最终 `lagMs`

- P0-01 E1 已确认：Phaser 默认 `smoothStep` / `minFps=5` 下，单次 `scene.update` 的 `delta ≤ 200ms`
  （`packages/demo/node_modules/phaser/src/core/TimeStep.js:174,576-585`）。
- 采用最终 `lagMs = 200ms`：
  - 观测最大间隔 94 ms 是**经验下界参考**；
  - 余量 **106 ms** 用于覆盖 trace 未观测到的帧抖动，并把上界锚定到源码级的 200ms `delta` 上限；
  - 这样既不把 94ms 宣称为 Runtime 绝对上界，也不凭空取一个低于源码上限的数。
- 敏感性档：`16.67ms`（60fps 名义帧）与 `200ms`（源码上限）；最终档与保守档同为 200ms。

### 1.3 两档结果

| 案例 | 16.67ms | 200ms | 最终 200ms |
|---|---|---|---|
| A | `NO_PROVEN_BLOCKER`（witness） | `NO_PROVEN_BLOCKER`（witness） | `NO_PROVEN_BLOCKER`（witness） |
| B | `PROVEN_UNPLAYABLE`（门 `[548,592]`） | `PROVEN_UNPLAYABLE`（门 `[548,592]`） | `PROVEN_UNPLAYABLE`（门 `[548,592]`） |
| C1 相位不确定 | `INSUFFICIENT_EVIDENCE` / `phase-uncertain` | 同左 | 同左 |
| C2 命中体不可追溯 | `INSUFFICIENT_EVIDENCE` / `hitbox-uncertain` | 同左 | 同左 |

完整输出：[`03-analyzer-results.json`](03-analyzer-results.json)。

## 2. Hitbox 来源审计（P0-02R 条件 1）

审计脚本复用 [`tools/e3-rescan.mjs`](../tools/e3-rescan.mjs)，本次输出
[`03-runs/hitbox-rescan.json`](03-runs/hitbox-rescan.json)；它同时复算 P0-01 语料数字（21 configs / 31 hazards /
19 moving / 121 frames / `badSize=badAnchor=0`），与 P0-01 **逐项一致**。

| 案例 | 实际 hitbox 来源 | 复制包 manifest | 帧 | 帧 `sourceSize` / `anchor` == manifest |
|---|---|---|---:|---|
| A | `prop-luggage-pile`（40×40，anchor `{0.5,1}`） | `cases/a/site-out/p0-03a-case-a/pack/v2/manifest.json` · `sha256:145cb28d…` | 1 | ✅ |
| B | `hazard-sweeping-carriage`（64×48，anchor `{0.5,1}`） | `cases/b/site-out/p0-03a-case-b/pack/v2/manifest.json` · `sha256:145cb28d…` | 2 | ✅ |

- 两份复制包 manifest 的 SHA-256 都等于 accepted pack `fixtures/packs/last-train/v2/manifest.json`
  `sha256:145cb28d73e5723a458c2cffc7f3b362fa3009f8647ac879dad1ec819ffbd689`。
- A 图集 `delivery/atlas.sprites.json` `sha256:51b7fbca…`；B 图集 `delivery/atlas.animations.json` `sha256:6874ae92…`。
- 站点 `game-config.json` 与 `cases/*/game-config.json` 的 player / entities / objective / world **逐字段相等**
  （站点文件只是 schema 归一化后的序列化）。
- 每次正式运行前后 `site-integrity.json` 均为 `unchanged=true`；外壳未写站点字节。

## 3. 案例 A：等待后通过

### 3.1 配置

世界 1440×270；玩家出生 `(500,250)`、`speed=160px/s`、`jumpVelocity=330`、`gravity=900`；
Hazard `prop-luggage-pile` 40×40，`at=(600,250)`，`distance=120`、`periodMs=4000`；
终点 `prop-awning-steps` 56×32，`at=(670,250)`；拾取物 `(530,250)`。

### 3.2 分析器

| lagMs | 判断 | 证据 |
|---:|---|---|
| 16.67 | `NO_PROVEN_BLOCKER` | BFS witness（64 段，逐段连续验证） |
| 200 | `NO_PROVEN_BLOCKER` | BFS witness（64 段）；`verifyWitness = null` |

BFS 的 witness 是低速前进（`departAt=0`），因此另构造并验证「原地等待 → 通过」witness：

- 构造 witness 时按每档 lag 取「带外 2px」的等待点：lag 200 → 玩家左边缘 534（右边缘 566；Hazard 最小左边缘 568）；
  lag 16.67 → 左边缘 545（右边缘 577；Hazard 最小左边缘 579）。两档等待点都在带外。
- 安全窗口（终点区域 clearance；玩家右边缘 644，Hazard 左边缘须 > 644）：
  - `16.67ms`：pad `1.00px` ⇒ **`[1083.3, 2916.7] ms`**，宽 1833.3ms。
  - `200ms`：pad `12.00px` ⇒ **`[1266.7, 2733.3] ms`**，宽 1466.7ms。
- 构造 witness：`t=0..1266.7` 原地等待（x=534），`t=1266.7..1754.2` 走到 612；
  `verifyWitness` 在 16.67 与 200 两档均返回 `null`（无碰撞）。

### 3.3 真实 Runtime（`--repeat 2`，退出码 0，投影一致）

| attempt | 结果 | 关键轨迹 |
|---|---|---|
| v1 | `won=true`, `reset=0`, `collected=1`, `jump=1` | 等待平台 t≈467–3182 @ x=566.7；t=3276 起跳；t=3807 到达终点 |
| v2 | `won=true`, `reset=0`, `collected=1`, `jump=1` | 等待平台后 t=3256 起跳；t=3790 到达终点 |

v1 的关键观测（来自 `trace.jsonl` / `events.jsonl`）：

| t (ms) | 事件 | 玩家 x / right | Hazard anchor x / 盒 | 说明 |
|---:|---|---|---|---|
| 0 | spawn | 500 / 516 | 619.26 / `[599.26,639.26]` | 出生 |
| 90 | pickup | 508 / 524 | 604.53 / `[584.53,624.53]` | 拾取 1 件 |
| 467–3182 | 等待 | 566.7 / 582.7 | 600.9 → 719.9 往复 | 停在带外，未进入 Hazard 盒 |
| 3276 | jump | 580 / 596（bottom 226.25） | 644.13 / `[624.13,664.13]` | Hazard 向左接近，玩家起跳 |
| 3807 | win | 662.67 / 678.67（bottom 218.5） | 613.13 / `[593.13,633.13]` | 与终点盒 `[642,698]` 重叠 36.7px，Hazard 在身后 |

- 全程 `reset=0`；无 `runtime-error`；没有 hazard 命中复位事件。
- `input.jsonl`：`ArrowRight` 按下于 t=1、t=428 松开（进入等待），起跳前再按下；Space 按下/松开各 1 次（跳跃）；cleanup 于 t=3808。
- **一致性**：分析器给出的安全窗口在 Runtime 中被支持（等待约 2.7s 后通过、未被命中）；
  Runtime 用跳跃越过 Hazard，分析器用水平等待 witness——两者都落在同一安全窗口内，均不命中。

## 4. 案例 B：永久封锁

### 4.1 配置与证明

玩家出生 `(300,250)`、`speed=160px/s`、`jumpVelocity=120`（单跳最大高度 8px）、`gravity=900`；
Hazard `hazard-sweeping-carriage` 64×48，`at=(560,250)`、`distance=20`、`periodMs=2000`；终点 `(700,250)`。

- 永久封锁门（所有可能位姿的交集，不带 lag pad）：
  `L = maxP − 0.5×64 = 580−32 = 548`，`R = minP + 0.5×64 = 560+32 = 592` ⇒ **`[548,592]`**，宽 44 > 0。
- 起点盒 `[284,316]` 在门左，`goalX=670` 在门右。
- 垂直规避在本受控配置下不可能：单跳高度 8px < Hazard 高 48px；无平台 / 绕行路线；
  分析器输入显式声明 `assumptions.verticalEvasionImpossible=true`。

### 4.2 分析器

| lagMs | 判断 | 证据 |
|---:|---|---|
| 16.67 | `PROVEN_UNPLAYABLE` | `permanent-gate` `[548,592]`，`minP=560` / `maxP=580` |
| 200 | `PROVEN_UNPLAYABLE` | 同上；门按交集计算，lag 只会使可证明的门变窄 |

### 4.3 真实 Runtime（`--repeat 2`，退出码 0，投影一致）

| attempt | 结果 | 停止 |
|---|---|---|
| v1 | `won=false`, `reset=5`, 终点从未到达 | `reset-exhaustion` @ step 263 |
| v2 | `won=false`, `reset=5` | `reset-exhaustion` @ step 259 |

v1 的复位（`events.jsonl`）与前一帧 trace：

| reset t | 玩家 fromX | 前一帧玩家 right | 前一帧 Hazard box | 水平重叠 |
|---:|---:|---:|---|---|
| 1736 | 518.7 | 534.7 | `[534.3,598.3]` | 是 |
| 3853 | 516.0 | 532.0 | `[532.0,596.0]` | 边界（下一物理帧命中） |
| 5871 | 516.0 | 532.0 | `[531.7,595.7]` | 是 |
| 8008 | 513.3 | 529.3 | `[529.0,593.0]` | 是 |
| 9996 | 513.3 | 529.3 | `[529.0,593.0]` | 是 |

- Hazard 观测范围 `x ∈ [560.03, 579.99]` ⇒ 盒足迹 `[528.03, 611.99]`；门 `[548,592]` 始终被覆盖。
- 玩家观测最大 right = 534.7，从未越过门左边界 548 后继续前进；每次尝试在门附近被复位到出生点。
- `input.jsonl`：`ArrowRight` 在每次复位后重新按下（t=1359/3089/5193/7215/9349 松开）；Space 按下/松开各 2 次；
  `jump` 事件 3 次（状态差推断），但单跳高度 8px，无法越过 48px 的 Hazard。
- **一致性**：算法证明「不存在合法通过路径」；Runtime 的 5 次复位 / 无进展只是旁证，
  **不单独**构成不可玩证明。两者方向一致。

## 5. 案例 C：不确定输入

| 输入 | 对应未确认事项 | 16.67ms | 200ms |
|---|---|---|---|
| `c/analyzer-phase-unknown.json` | P0-01R U1（页面隐藏时 `t0` 冻结/慢走）、U8（首次渲染相位） | `INSUFFICIENT_EVIDENCE` / `phase-uncertain` | 同左 |
| `c/analyzer-hitbox-unverifiable.json` | P0-01R U3（帧几何 == manifest 不由 schema 强制）、U6（动画换帧几何无上界） | `INSUFFICIENT_EVIDENCE` / `hitbox-uncertain` | 同左 |

- 两者都在确定性输入门返回 IE，`lagMs` 未被消费；因此两档结果相同。
- **C 的 IE 不是「不可玩」**；它只表示当前证据不足以判定。未跑 Runtime（票面不强制）。

## 6. 判断对照总表

| 案例 | 算法判断 | Runtime 观察 | 结论 |
|---|---|---|---|
| A | `NO_PROVEN_BLOCKER`（安全窗口 + 等待 witness） | `won=true`、`reset=0`、拾取 1 件 | **一致**：安全窗口被双侧支持 |
| B | `PROVEN_UNPLAYABLE`（永久封锁门 `[548,592]`） | `won=false`、5 次复位、`reset-exhaustion` | **一致**：证明为主，试玩为旁证 |
| C1 | `INSUFFICIENT_EVIDENCE` / `phase-uncertain` | 未跑（不强制） | **符合预期**：模型边界 |
| C2 | `INSUFFICIENT_EVIDENCE` / `hitbox-uncertain` | 未跑（不强制） | **符合预期**：模型边界 |

## 7. 命令、退出码与原始运行目录

| # | 命令 | 退出码 | 产物 |
|---|---|---|---|
| 1 | A playtest `--repeat 2 --json` | 0 | [`03-runs/a/`](03-runs/a/)（`playtest.json`、`attempt-v1/`、`attempt-v2/`） |
| 2 | B playtest `--repeat 2 --json` | 0 | [`03-runs/b/`](03-runs/b/)（同上） |
| 3 | `node .../tools/p0-03-analysis.mjs --out .../evidence/03-analyzer-results.json --json` | 0 | [`03-analyzer-results.json`](03-analyzer-results.json) |
| 4 | `node .../tools/e3-rescan.mjs --out .../evidence/03-runs/hitbox-rescan.json --json` | 0 | [`03-runs/hitbox-rescan.json`](03-runs/hitbox-rescan.json) |

- 运行摘要：[`03-runs/run-summary.json`](03-runs/run-summary.json)（trace 间隔、事件计数、复位明细、站点完整性）。
- 原始证据：每轮 `trace.jsonl` / `events.jsonl` / `input.jsonl` / `strategy.json` / `site-integrity.json` 均在
  `03-runs/{a,b}/attempt-v{1,2}/p0-03a-case-*/`。
- 站点与配置身份：A `game-config.json` `sha256:7a878f7a…`、B `sha256:b3c8d8ad…`；两次运行前后站点字节均未变。

## 8. 限制与交接 P0-03R

- A 的 Runtime 通过包含一次跳跃；分析器的水平等待 witness 不建模跳跃。两者都避开命中，
  但 P0-03R 应确认这是否足以作为「等待后通过」的双侧证据。
- trace 最大间隔 94ms 只是 harness 观测间隔；最终 `lagMs=200ms` 锚定在 P0-01 的 Phaser `delta ≤ 200ms`
  源码上限上，并未声称 94ms 是 Runtime 绝对上界。
- B 的 Runtime 复位是旁证，不是证明；不可玩结论只来自 `[548,592]` 永久封锁门。
- C 未跑 Runtime；IE 是模型边界。
- 未新增 harness 观察字段，未改 Runtime / 生产判据 / 历史产物；零付费。
