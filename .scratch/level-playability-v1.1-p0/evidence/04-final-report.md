# P0-04 结论包与最终裁定

| 项 | 值 |
|---|---|
| 日期 | 2026-11-08 |
| 分支 | `p1/level-playability-v1.1-p0` |
| 本票开始 HEAD / 回退点 | `3042ba8`（P0-03R 收口） |
| 证据基线 | P0-01 / P0-01R / P0-02 / P0-02R / P0-03a / P0-03 / P0-03R |
| 最终裁定 | **GO — 技术可行性得到支持** |
| 裁定口径 | Q1(a) 技术可行性口径；Q2(a) 能力证明 + 结果层旁证 |
| 性质 | 只产出结论包与裁定记录；零付费；未改 Runtime / 生产判据 / 公开契约 / Pipeline / Publish Gate；不启动集成 |

## 0. 最终裁定原文

> 我的裁定：Q1 选 (a)，Q2 选 (a)。两项均接受推荐方案。
>
> ### Q1 — GO 的口径
>
> 接受 (a)：技术可行性口径
>
> GO 的含义限定为：
>
> > 现有证据足以支持 Temporal Playability 的技术可行性，可以据此规划正式集成方案；不代表集成设计已经完成，也不授权 Runtime、Pipeline 或其他生产代码实施。
>
> 因此，PRD §6 的「证据充分，可以规划正式集成」与 P0-03R 的「技术可行性得到支持」并不冲突。应明确区分：
>
> - **允许：** 研究集成边界、设计方案、评估成本和风险、提出后续实施 PRD。
> - **不允许：** 直接开始集成、修改 Runtime / Pipeline / contracts / CLI / MCP，或将 GO 当作实施授权。
>
> 不选择 (b)，因为当前证据没有证明集成就绪。
>
> ### Q2 — A 案的结论强度
>
> 接受 (a)：能力证明 + 结果层旁证
>
> 结论包采用以下措辞：
>
> > 算法具备识别等待窗口的能力。A 案真实 Runtime 提供结果层旁证，证明该案例存在安全通过方式；但 Runtime 采用等待后跳跃，且跳跃发生在分析器窗口结束之后（3276ms > 2733ms），因此未验证算法所给出的水平等待 witness，也未证明两者机制等价。
>
> 明确禁止使用「安全窗口已通过真实 Runtime 验证」这一表述。
>
> ### 最终写入结论包的统一口径
>
> > GO — 技术可行性得到支持。当前证据表明，Temporal Playability 对本阶段限定范围内的单个移动 Hazard，具备识别时序安全窗口、证明特定永久封锁，以及在关键输入不确定时正确降级为 `INSUFFICIENT_EVIDENCE` 的能力。A 案的 Runtime 结果仅为安全通过方式的结果层旁证，不构成水平等待机制的 Runtime 验证。该结论允许规划正式集成，但不代表集成就绪，也不构成任何生产代码修改或集成实施授权。
>
> 最终裁定：Q1(a)、Q2(a)。P0-04 可以按上述口径形成 GO 结论；后续集成必须另开 effort 并单独授权。

## 1. 一句话结论

> **GO — 技术可行性得到支持。** 当前证据表明，Temporal Playability 对本阶段限定范围内的单个移动 Hazard，具备识别时序安全窗口、证明特定永久封锁，以及在关键输入不确定时正确降级为 `INSUFFICIENT_EVIDENCE` 的能力。A 案的 Runtime 结果仅为安全通过方式的结果层旁证，不构成水平等待机制的 Runtime 验证。该结论允许规划正式集成，但不代表集成就绪，也不构成任何生产代码修改或集成实施授权。

## 2. PRD §6 六问逐条回答

### 2.1 Runtime 时间语义是否足够明确？

**结论：足够明确——但只对本阶段限定范围（单个 x 轴移动 Hazard、game-time、当前 accepted pack）。**

已确认的事实（E1 / E2）：

| # | 事实 | 证据 |
|---|---|---|
| 1 | 轨迹是纯解析三角波：`t=0` 在 `at`，`t=periodMs/2` 在 `at+distance`，`t=periodMs` 回到 `at`；两端不停留 | E1 `packages/demo/src/hazard.ts:14-19`；E2 `packages/demo/tests/hazard.test.ts:11-31` |
| 2 | `periodMs` 是**往返整周期**，不是 danger 的 idle 窗口语义 | E1 `hazard.ts:14-19`、`hazard.ts:21-33`、`packages/contracts/src/game-config.ts:79-85` |
| 3 | 所有 hazard 共享同一个全局 game-time 时钟 `T`（`t0 += delta`，无 phase 字段） | E1 `packages/demo/src/shell/scene.ts:161,271-276` |
| 4 | 单帧 `delta` 在默认配置下 `≤ 200ms`（`minFps=5`、`smoothStep`） | E1 `packages/demo/node_modules/phaser/src/core/TimeStep.js:174,576-585` |
| 5 | hazard 的碰撞位姿比渲染位姿**晚一帧**（物理步在前、`advanceHazards` 在后） | E1 `scene.ts:79-82`；`phaser/src/scene/Systems.js:356-366`；`phaser/src/physics/arcade/ArcadePhysics.js:142,145` |
| 6 | 命中体 = 图集帧 `StaticBody`（`displayWidth/Height` + origin），每帧 `updateFromGameObject()`；不读 `entity.body` | E1 `scene.ts:158,279`；`StaticBody.js:56-65,171,579-596` |
| 7 | 命中只复位玩家（`hitHazard()`），不重置 hazard 的 `t0`；无 i-frames | E1 `scene.ts:355-362` |

E3 语料复核：21 份唯一横向 config / 31 个 hazard / 19 个移动（全 `x`）/ 121 帧，`badSize=0`、`badAnchor=0`（[`03a-e3-rescan.json`](03a-e3-rescan.json)）。

**边界（未确认，不得写成已确认）：**

- **U1**：页面隐藏期间 `t0` 是严格冻结还是按被 clamp 的 delta 慢走，取决于浏览器调度，不在仓库内。⇒ 只允许 game-time `T`，禁止墙钟相位判据。
- **U2**：单帧碰撞采样的**精确**时刻与具体毫秒数未被测量；源码只给出顺序与 `≤200ms` 上界。⇒ 只允许显式 `lagMs` + 扫掠带，禁止精确帧判据。
- **U3 / U6**：任意资源包的「帧几何 == manifest」不由 schema 强制；非 accepted pack 无上界。⇒ 严格判据必须验证来源，否则 `INSUFFICIENT_EVIDENCE` / `coverage.partial`。
- **U8**：首次渲染相位 `P(delta1)` 未测量。⇒ 到达相位必须当自由变量，不得假设「玩家第一次看到 hazard 时它恰好在 `t=0`」。

### 2.2 单移动 Hazard 是否能建立可信的时序模型？

**结论：能——但模型只覆盖单一 x 轴移动 Hazard。**

- 状态 = `(x 网格点, k mod N)`；系统按 `periodMs` 周期化，每个 `(x, phase)` 只访问一次。
- 每条边是具体线段；`segmentCollides` 在折返点切段后**解析求交**，不是固定网格采样。
- `NO_PROVEN_BLOCKER` 只来自逐段连续验证的 witness；BFS 无解、预算耗尽、缺 `lagMs`、未知输入一律 `INSUFFICIENT_EVIDENCE`。
- `PROVEN_UNPLAYABLE` 只来自**正宽度永久封锁门**（所有可能位姿的交集，不带 lag pad）+ 显式 `verticalEvasionImpossible` 声明。

E2（本会话重跑，2026-11-08）：

```text
node --test .scratch/level-playability-v1.1-p0/prototype/temporal-model.test.mjs
EXIT=0；# tests 12 / # pass 12 / # fail 0
```

12 项覆盖：周期语义、等待 witness、永久封锁门、缺垂直规避声明 ⇒ IE、单点门 ⇒ IE、y 轴 ⇒ IE、相位/命中体不确定 ⇒ IE、采样陷阱、一帧滞后扫掠带、预算耗尽 ⇒ IE、缺 `lagMs` ⇒ IE、门取交集且要求正宽度。

**边界（明确不建模）：** 跳跃 / 下落 / 重力、地形 / solid、y 轴 mover、多 hazard 联合、moving platform、danger 组合、墙钟相位。模拟器**不宣称**与真实 Runtime 等价。

### 2.3 是否能正确识别等待后的安全窗口？

**结论：算法具备识别等待窗口的能力；A 案提供结果层旁证，但未验证机制等价。**

A 案（[`03-case-comparison.md`](03-case-comparison.md) §3）：

- 分析器（`lagMs=200ms`）：安全窗口 **`[1266.7, 2733.3] ms`**，宽 1466.7ms；构造「原地等待 → 通过」witness，`verifyWitness` 返回 `null`（无碰撞）。
- 真实 Runtime（`--repeat 2`）：等待 `t≈467–3182ms` @ `x=566.7`；**`t=3276ms` 起跳**；`t=3807ms` 通关；`reset=0`，拾取 1 件。
- 跳跃时刻 **3276ms 晚于**分析器窗口结束 **2733.3ms**；Runtime 通过的是跳跃，不是分析器给出的水平等待 witness。

因此结论包采用（Q2(a) 裁定）：

> 算法具备识别等待窗口的能力。A 案真实 Runtime 提供结果层旁证，证明该案例存在安全通过方式；但 Runtime 采用等待后跳跃，且跳跃发生在分析器窗口结束之后（3276ms > 2733ms），因此未验证算法所给出的水平等待 witness，也未证明两者机制等价。

**禁止表述：**「安全窗口已通过真实 Runtime 验证」。

E2 对应：`A: waiting for a safe window then crossing yields a verified witness`、`sampling trap: collision between samples is caught by the continuous check`、`one-frame lag: the sweep band covers the delayed collision pose`。

### 2.4 是否能证明确定封路，而不是依赖采样猜测？

**结论：能——但仅限「正宽度永久封锁门 + 显式垂直规避不可能声明」。**

B 案（[`03-case-comparison.md`](03-case-comparison.md) §4）：

- 永久封锁门（所有可能位姿的交集，不带 lag pad）：`L = 580 − 32 = 548`，`R = 560 + 32 = 592` ⇒ **`[548, 592]`**，正宽度 44px。
- 起点盒 `[284,316]` 在门左，`goalX=670` 在门右；受控配置下 `verticalEvasionImpossible=true`（单跳 8px < hazard 高 48px，无平台/绕行）。
- 分析器两档 `lagMs`（16.67ms / 200ms）均为 `PROVEN_UNPLAYABLE`。
- 真实 Runtime（`--repeat 2`）：`won=false`、5 次复位、`reset-exhaustion`；玩家观测最大 `right=534.7`，从未越门。**Runtime 只作一致旁证，不单独构成不可玩证明。**

E2 对应：`B: a hazard permanently covering a gate proves PROVEN_UNPLAYABLE`、`B without the vertical-evasion assumption must not claim unplayable`、`single-point permanent coverage must not yield PROVEN_UNPLAYABLE`、`budget exhaustion returns INSUFFICIENT_EVIDENCE, never PROVEN_UNPLAYABLE`、`permanent gate uses the intersection (no lag pad) and requires positive width`。

**边界：** 单 hazard、x 轴、受控配置；垂直规避不可能必须由调用方声明且可被空间分析支持；多 hazard / 非 x 轴 / 地形交互不在证明范围内。

### 2.5 算法的性能和状态空间是否可控？

**结论：本案例规模可控；扩展性未验证。**

A 案（[`03-analyzer-results.json`](03-analyzer-results.json)）：

| 指标 | 值 |
|---|---|
| `xPositions` × `phaseSteps` | 689 × 200（`dt=20ms`，`maxStepPx=3.2`） |
| `statesEnqueued` / `statesVisited` | 4224 / 4096 |
| `edgesChecked` | 12288 |
| `elapsedMs` | 7–19ms |
| 预算 | `maxStates=200000` / `timeBudgetMs=5000`，未耗尽 |

B 案由永久封锁门直接判定，`statesVisited=0`。状态空间通过 `(x, k mod N)` 周期化限定，每个状态只访问一次；墙钟只用于搜索预算，不参与物理/时序判断。

**边界：** 没有多 hazard、大世界、密集网格或 y 轴的性能数据；这些场景的规模上界未测。

### 2.6 是否值得进入正式 Pipeline 集成？

**结论：值得规划——即 GO（技术可行性口径），但必须限定范围并满足前置条件；本图不做集成规划或实施。**

理由：三项能力均已在受控案例中得到证据支持——识别安全窗口（A）、证明永久封锁（B）、不确定输入降级为 IE（C）。同时，证据只覆盖单一 x 轴移动 Hazard 的受控场景，且 A 案未验证机制等价、hitbox / lag 来源存在硬前置条件。因此 GO 的准确含义是「可行性足以支持规划」，不是「集成就绪」。

推荐范围、前置条件与残余风险见 §4–§6。

## 3. GO 的含义与授权边界

按 Q1(a) 裁定：

| | 内容 |
|---|---|
| **允许** | 研究集成边界、设计方案、评估成本和风险、提出后续实施 PRD |
| **不允许** | 直接开始集成、修改 Runtime / Pipeline / contracts / CLI / MCP，或将 GO 当作实施授权 |

- 本图（`level-playability-v1.1-p0`）在裁定后**关图**；不在本图内继续集成规划。
- 任何集成规划 / 实施必须**另开 effort、另行授权**。
- GO 不改变现有三态语义，也不构成对 `packages/contracts/src/playability/mechanic.ts:119` 生产判据的修改授权。

## 4. 推荐集成范围（建议，不是设计）

后续规划 effort 的起点范围：

**建议纳入：**

- 单个 **x 轴**移动 Hazard。
- **已知相位**，且以 game-time `T` 表达；不使用墙钟时间。
- 命中体可追溯到**当前 accepted pack**，或在分析时完成来源验证。
- 调用方提供**显式 `lagMs`** 上界，并保留敏感性档。
- 仅当空间分析能支持「垂直规避不可能」时，才允许 `PROVEN_UNPLAYABLE`。
- 保留现有三态语义：`NO_PROVEN_BLOCKER` ≠ 可玩；预算/超时 ⇒ IE。

**建议排除（需另行取证）：**

- y 轴 mover（源码支持，但无语料/测试回归）。
- 多移动 Hazard 联合、多 Danger 联合、Moving Platform。
- 地形 / solid 交互、跳跃 / 下落 / 重力的精确建模。
- Hazard 与目标的复杂组合判定。

## 5. 前置条件（集成前必须满足）

1. **Hitbox 来源门（U3 / U6）。** 分析时必须验证每个 pack 的帧 `sourceSize` / `anchor` == manifest；无法验证时强制 `INSUFFICIENT_EVIDENCE` / `coverage.partial`。不得仅凭调用方声明 `certainty.hitbox="known"`。
2. **Lag 来源门（U2）。** 必须显式提供帧间隔上界；保留 `lagMs` 必填与两档敏感性；禁止任何精确帧时刻判据。
3. **确定性门（U1 / U8）。** 未知相位、依赖隐藏页/墙钟、首次渲染相位不明 ⇒ `INSUFFICIENT_EVIDENCE`；到达相位当自由变量。
4. **垂直规避证明。** 生产环境中 `verticalEvasionImpossible` 不能只是无依据的调用方 flag；必须由空间分析或显式关卡约束支撑。
5. **运动模型范围。** 当前模型不建模跳跃 / 下落 / 重力；集成若需覆盖这些行为，必须先扩展模型并补测试，不得用现有结论外推。
6. **语义保持。** `PROVEN_UNPLAYABLE` 只能来自正宽度永久封锁门；单点门、BFS 无解、预算耗尽、采样未发现窗口一律 IE；不得放宽 LP-02～LP-07 既有测试。
7. **生产隔离。** 当前原型是 scratch 内的 `.mjs`，不进生产包、不进 `pnpm test`；集成必须自带测试、打包与门禁，且不新增第三方依赖。

## 6. 残余风险与未确认事项

| ID | 风险 | 状态 | 对 GO 的影响 |
|---|---|---|---|
| U1 | 页面隐藏期间 `t0` 冻结 / 慢走不确定 | UNCONFIRMED（浏览器调度不在仓库内） | 禁止墙钟判据；只允许 game-time |
| U2 | 精确帧时刻 / 一帧滞后毫秒数不可测 | 有源码上界（≤200ms），无精确值 | 必须显式 `lagMs` + 扫掠带 |
| U3 | 任意 pack 的帧几何 == manifest 不由 schema 强制 | UNCONFIRMED | 硬门：验证来源，否则 IE |
| U4 | y 轴 mover 无语料 / 测试 | 仅源码级 CONFIRMED | 排除出推荐范围 |
| U5 | 同一帧多物理步的命中计数未测试 | UNCONFIRMED | 不依赖 `hits` 计数；接触存在性不受影响 |
| U6 | 非 accepted pack 的动画帧几何无上界 | UNCONFIRMED | 硬门（同 U3） |
| U7 | P0 scratch 站点输入几何 | **已解除**（P0-03a 建站 + 完整性审计） | 无 |
| U8 | 首次渲染相位未测量 | UNCONFIRMED | 相位当自由变量，不得假设 `t=0` |

其他证据边界：

- **A 案机制不等价**：算法水平等待 vs Runtime 跳跃；跳跃 3276ms 晚于窗口结束 2733ms。
- **94ms 只是观测值**：A/B 四轮 trace 最大观测间隔 94ms，不是 Runtime 绝对上界；最终 `lagMs=200ms` 锚定 Phaser `delta ≤ 200ms` 源码上限。
- **覆盖范围**：只证明单个、x 轴、受控配置下的移动 Hazard 时序分析能力；不是对所有 Runtime 运动机制的等价验证。
- **GO ≠ 集成就绪**：本结论不授权任何生产代码修改。

## 7. 语义边界：`NO_PROVEN_BLOCKER` ≠「可玩」

必须保留以下区别：

- `NO_PROVEN_BLOCKER` 只表示「在模型假设内找到并连续验证了一条安全轨迹」，**不表示**该关卡可玩，也不表示不存在其他未建模的阻塞（跳跃失败、操作精度、地形、多 hazard 交互等）。
- `PROVEN_UNPLAYABLE` 只表示「在声明假设内存在正宽度永久封锁门」，**不表示**所有不可玩情形都能被该证明覆盖。
- `INSUFFICIENT_EVIDENCE` 是模型边界，**不是**不可玩结论；超时 / 状态耗尽 / 找不到 witness 均不得解释为不可玩。

## 8. 证据索引

**E1（源码 / 契约 `file:line`）**

- `packages/demo/src/hazard.ts:14-19`、`21-33`
- `packages/demo/src/shell/scene.ts:79-82,158-165,161,271-281,355-362`
- `packages/demo/src/draw.ts:143-163`
- `packages/demo/src/world.ts:176-182`
- `packages/contracts/src/game-config.ts:79-85,90-99,151-158`
- `packages/demo/node_modules/phaser/src/core/TimeStep.js:174,576-585`
- `packages/demo/node_modules/phaser/src/scene/Systems.js:356-366`
- `packages/demo/node_modules/phaser/src/physics/arcade/StaticBody.js:56-65,171,579-596`
- `packages/demo/node_modules/phaser/src/physics/arcade/World.js:936-1008,1698-1713`

**E2（测试）**

- `packages/demo/tests/hazard.test.ts:11-31`（周期 / 三角波）
- `.scratch/level-playability-v1.1-p0/prototype/temporal-model.test.mjs`（12/12，`EXIT=0`，2026-11-08 重跑）

**E3（真实 Runtime / 复跑）**

- [`03-analyzer-results.json`](03-analyzer-results.json) — A/B/C 分析器输出与 `stats`
- [`03-case-comparison.md`](03-case-comparison.md) — 三案例配置、witness、Runtime 轨迹、lag / hitbox 审计
- [`03-runs/a/`](03-runs/a/)、[`03-runs/b/`](03-runs/b/) — `trace.jsonl` / `events.jsonl` / `input.jsonl` / `site-integrity.json`
- [`03-runs/run-summary.json`](03-runs/run-summary.json) — 帧间隔、事件计数、复位明细
- [`03-runs/hitbox-rescan.json`](03-runs/hitbox-rescan.json) — hitbox 来源审计
- [`03a-e3-rescan.json`](03a-e3-rescan.json) — 语料复扫（21 configs / 31 hazards / 19 moving / 121 frames / `badSize=badAnchor=0`）

**裁定记录**

- [`01r-ruling.md`](01r-ruling.md)、[`02r-ruling.md`](02r-ruling.md)、[`03r-ruling.md`](03r-ruling.md)

## 9. 命令、退出码与产物

| # | 命令 | 退出码 | 说明 |
|---|---|---|---|
| 1 | `node --test .scratch/level-playability-v1.1-p0/prototype/temporal-model.test.mjs` | 0 | 12/12，本会话重跑 |
| 2 | A playtest `--repeat 2 --json`（P0-03） | 0 | 产物见 `03-runs/a/` |
| 3 | B playtest `--repeat 2 --json`（P0-03） | 0 | 产物见 `03-runs/b/` |
| 4 | `node .../tools/p0-03-analysis.mjs --json`（P0-03） | 0 | 产物见 `03-analyzer-results.json` |
| 5 | `node .../tools/e3-rescan.mjs --json`（P0-03） | 0 | 产物见 `03-runs/hitbox-rescan.json` |

- 本票开始 HEAD / 回退点：`3042ba8`。
- 本票产物：`evidence/04-final-report.md`、`issues/09-p0-04-verdict.md`（裁定记录）、`map.md`（收口）。
- 本票未新增 Runtime 运行、未修改产品代码。

## 10. 未修改声明

- 未修改 `packages/**`、`fixtures/**`、既有 run / pack / site、LP-02～LP-07 测试。
- 未修改 `packages/contracts/src/playability/mechanic.ts:119` 的 `moving-hazard-phase` 生产判据。
- 未接 Pipeline / Publish Gate，未改 CLI / MCP / 公开契约。
- 零付费、零新依赖、无推送 / 合并。
