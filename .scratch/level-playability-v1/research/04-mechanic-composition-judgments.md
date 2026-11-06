# 机制组合候选判据（04）

- **Date**：2026-11-05
- **Baseline**：`main` @ `fa17c14`。本报告只新增 `.scratch/level-playability-v1/research/**` 下的只读探针与本文件；
  未修改 `packages/**`、tickets、`map.md` 或 git 历史。
- **Nature**：只读研究。零模型调用、零生图、零站点重建；所有 E3 探针都是零付费、只读语料。
- **Input**：[ticket 04](../issues/04-mechanic-composition-judgments.md)、[framework](../framework.md)、
  [rulings-2026-11-04](../rulings-2026-11-04.md)、[02 能力与缺口审计](02-capability-gap-audit.md)、
  当前源码与既有测试。
- **证据级别**：E1 = `file:line`；E2 = 既有测试名 + 断言；E3 = 零付费只读探针（命令、退出码、路径、计数）。

---

## 0. 结论速览

| # | 候选方向 | 建议 id | 分类 | 一句话 |
|---|---|---|---|---|
| A | **静止 hazard 封死唯一通路** | `PLAYABILITY_MECHANIC_PATH_BLOCKED` | **deterministic error** | 把静止 hazard 当「不可站立的禁区」做静态可达性；反事实（去掉 hazard 可达、加上不可达）成立时才是证明。 |
| B | **全高 danger 墙的安全窗口不足** | `PLAYABILITY_MECHANIC_PATH_NO_SAFE_WINDOW` | **deterministic error（退化情形）** | 全列切面 + `idle = periodMs` 小于最小穿越时长；其余 danger 一律 `INSUFFICIENT_EVIDENCE`。 |
| C | **巡逻 hazard 封死唯一通路** | `PLAYABILITY_MECHANIC_PATROL_PATH_BLOCKED`（**不注册**） | **INSUFFICIENT_EVIDENCE** | 需要时间展开/相位可达性；把整段行程当实心会误伤宽巡逻（已有 E3 反例）。 |
| D | **moving-platform** | `PLAYABILITY_MECHANIC_MOVING_PLATFORM_UNSUPPORTED`（**不注册**） | **INSUFFICIENT_EVIDENCE / coverage gap** | 运行时未实现；归 `mechanic-coverage`，不得变成 playability error；`solid+motion` 按静态原位处理。 |
| E | **pickup/chest 被 hazard 完全包住** | `..._PICKUP_HAZARD_SEALED` / `..._CHEST_HAZARD_SEALED`（**不注册**） | **INSUFFICIENT_EVIDENCE** | `hitHazard` 只复位位置，收集计数/开箱状态保留；同帧回调顺序不可证；语料里已有 pickup 与 hazard 相交的合法样本。 |
| F | **pickup/chest 被 danger 包住/挡在墙后** | 复用 B 的 `PLAYABILITY_MECHANIC_PATH_NO_SAFE_WINDOW` | **退化情形 deterministic / 其余 INSUFFICIENT** | 收集只需单向进入；全列切面 + 单向最小时间 > idle 才可证。 |
| G | **collect-then-reach 顺序 vs gate 激活** | 无（归 05 `PLAYABILITY_COMPLETION_*`） | **不是机制判据** | `tryWin` 只数 `collected >= pickupCount`；gate 早到是空操作；收集跨复位保留；复位不是免费传送。 |
| H | **必须在同一时机完成两件事** | 无 | **INSUFFICIENT_EVIDENCE** | 现有机制没有同时操作要求；多 danger 联合窗口需要时间展开；单墙退化由 B 覆盖。 |

**一句话**：V1 的机制层只有两条可以进确定性 error 的退化判据 —— **静止 hazard 的禁区可达性** 与 **全高 danger 的
idle 窗口下界**。巡逻 hazard、moving-platform、hazard/danger 包住的收集物、收集顺序、同刻约束都只能落
`INSUFFICIENT_EVIDENCE`（或归 05），不得硬造阈值。A 在历史语料上有新增命中（3 个历史产物 + 1 个 probe 夹具），
必须由 08 逐案裁定，不能声称零误伤。

---

## 1. 封闭词表与组合面

十机制全部在 `MECHANICS` 里（`packages/contracts/src/vocabulary.ts:38-55`），组合面如下：

| 机制 | config / runtime 表示 | 04 的组合问题 | 04 结论 |
|---|---|---|---|
| `run` | `PlayerMove.speed`（`game-config.ts:105-110`）；每帧 `setVelocityX(±speed)`（`scene.ts:89`） | 穿越时间下界 = 距离 / speed | 作为 B 的输入，不单独立判据 |
| `jump` | `jumpVelocity` + `gravity`；`maxJumpHeight` / `jumpSpan`（`game-config.ts:274,288-291`）；只有落地才能跳（`scene.ts:90-91`） | 静止 hazard 能否跳过 | 由 A 的 hop 模型吸收；不单独立判据 |
| `gravity` | 玩家 body 的 `gravity.y`（`scene.ts:220`）；世界 gravity 0 | 下落/滞空 | 作为 A/B 的输入 |
| `collide-terrain` | `terrain` + `solid`（`scene.ts:150,228`） | 地形阻挡与落脚 | 归 03 空间层 |
| `collect-pickup` | `pickup` + `pickupCount`（`game-config.ts:267-268`）；overlap → `collect`（`scene.ts:151-155,334-341`） | hazard/danger 是否让必需 pickup 不可取得 | A/B 的目标；E 的误报边界 |
| `moving-platform` | `Motion` 正交于 `kind`（`game-config.ts:79-85`）；但运行时只在 hazard 分支消费（`scene.ts:157-165,270-281`） | 是否作为可玩性判据 | **不**；见 §6 |
| `hazard-contact` | `hazard`；overlap → `hitHazard` 复位（`scene.ts:157-163,355-362`） | 静止 hazard 封路；巡逻 hazard | A（静止）；C（巡逻，证据不足） |
| `reach-goal` | `goal` + `objective.gate` + `pickupCount`（`scene.ts:166-172,364-369`） | gate 被 hazard/danger 挡住；计数激活 | A/B 的目标；顺序归 05 |
| `open-chest` | `chest` + `range`；`advanceChests` 近距自动开（`scene.ts:175-185,315-327`） | chest 被 hazard/danger 包住 | A/B 的目标；E/F 的误报边界 |
| `avoid-danger` | `danger` + `strike{periodMs,activeMs}`（`game-config.ts:97-101`）；`dangerState`（`hazard.ts:28-33`） | 安全窗口 vs 必经路线 | B（全高退化）；其余证据不足 |

### 1.1 运行时事实（判据只能依赖这些）

1. **hazard 不阻挡、只复位**：`hazard` 是 static body；overlap 回调 `hitHazard()`；`hitHazard` 只
   `body.reset(spawn)`，不扣血、不重置 `collected`（`scene.ts:157-163,355-362`）。
2. **静止 hazard 不动，巡逻 hazard 按三角波移动**：`advanceHazards` 对每个 hazard 调
   `hazardAnchor(start, distance, periodMs, t0)`；`distance=0` 时原地（`hazard.ts:14-19`；
   `scene.ts:270-281`）。
3. **danger 的 `periodMs` 是 idle（安全）时长，`activeMs` 是喷发时长；完整周期 `P+A`，t=0 从 idle 开始**
   （`hazard.ts:22-33`；`scene.ts:287-307`）。有效配置里 danger 必带 `strike`（`game-config.ts:126`，
   `GameConfigSchema` 的 superRefine 拒绝缺 strike 的 danger）。
4. **danger 命中按 `d.box` 与玩家 body 相交**（`scene.ts:299-307`）；`d.box` 来自 `world.ts:178` 的
   `e.body ?? assetSize` + 资源锚点，所以 danger 的几何是确定的。
5. **pickup / hazard / goal 的物理 body 不读 `e.body`**：`scene.ts:152,158,167` 用
   `physics.add.existing(sprite, true)`，没有 `setSize(e.body)`；`e.body` 只进 `world.ts:178` 的
   `entityBox`/绘制。语料 0 个此类 `body` 覆盖（02 §7.3.2）。
6. **solid 的 `motion` 永不推进**：`case "solid"` 只 `addSolid(e.box)`；`advanceHazards` 只遍历
   `hazards` 数组（`scene.ts:150,270-281`）。`RUNTIME_IMPLEMENTED_MECHANICS` 不含
   `moving-platform`（`vocabulary.ts:86-99`）。
7. **收集跨复位保留**：`collect` / `openChest` 只增 `collected`、置状态；`hitHazard` 不碰它们
   （`scene.ts:315-341,355-362`）。
8. **gate 只数收集**：`tryWin` 在 `collected < pickupCount` 时直接返回；早到 gate 是空操作，gate 不会消失
   （`scene.ts:364-369`）。

---

## 2. 共同模型、输入与输出

### 2.1 判据输入

所有 04 判据只吃：

- `GameConfig`（`game-config/v1`）：`world.size`、`terrain`、`entities`、`player.at`、`player.move`、`objective`；
- `AssetPackManifest`：玩家 / 实体的 `size`、`anchor`（`auditReachability` 同款，`reachability.ts:44-60`）；
- `FixedRuntimeProfile`（framework §2.2），04 需要补充两条显式假设：
  1. **hazard 接触在 overlap 的同一帧生效**（不存在无敌帧；复位连续；不存在穿帧/隧穿豁免）。
  2. **danger 的相位从场景 t=0 起算，玩家可以在任意安全位置无限等待**；`periodMs`/`activeMs` 语义固定
     （`hazard.ts:28-33`）。
- 03/05 解析后的**目标集**：gate + 全部 pickup + 全部 chest（`pickupCount` 把 chest 算必需，
  `game-config.ts:267-268`；运行时 `tryWin` 读同一个数，`scene.ts:364-369`）。04 不自己另造目标集；
  在 03/05 落地前，chest 目标与 `range` 语义按 02 S1 / M4 的缺口处理。

### 2.2 输出形状

统一 `PlayabilityEvidence`（framework §3.1/§5.2）：

```
PlayabilityEvidence = {
  judgmentId: "PLAYABILITY_MECHANIC_*",
  target: 'entity "<id>"',
  detail: "人话定位",
  witness: { kind: "blocked" | "no-safe-window" | "coverage-gap", ... },
  coverage: { spatial, mechanic, completion },
  assetId?, expected?, actual?
}
```

`witness` 必须可机检：A 用 `blocked` + blocker 矩形 + 反事实可达性摘要；B 用 `no-safe-window` +
`idleMs`/`requiredMs`/`speed`/`playerWidth`/`box`；证据不足用 `coverage-gap` + 缺哪一维。

### 2.3 三态与聚合

- 任一 04 判据证明不可走 ⇒ `PROVEN_UNPLAYABLE`；
- 否则只要 04 的 mechanic 维不是 `checked`（存在 C/D/E/F/H 的缺口）⇒ `INSUFFICIENT_EVIDENCE`；
- 全部执行且未发现阻断 ⇒ `NO_PROVEN_BLOCKER`，**不等于** `PROVEN_PLAYABLE`（framework §3.3/§3.4）。
- `INSUFFICIENT_EVIDENCE` 不产 `ConfigIssue`；只有 A/B 的 `PROVEN_UNPLAYABLE` 映射为 error
  （framework §7.1/§7.2）。

---

## 3. 判据 A：`PLAYABILITY_MECHANIC_PATH_BLOCKED`（静止 hazard 封死唯一通路）

### 3.1 问题

一个**没有 `motion` 的 hazard** 是否让某个**必需目标**（gate / 必需 pickup / 必需 chest）在现有运行时下
不可达？这里的「不可达」不是「难」，而是「任何不接触 hazard 的路径都不存在」，且「接触 hazard 会被复位到
出生点、复位不带来前进」。

### 3.2 精确算法

输入：`config`、`manifest`、目标集 `T`（gate + pickup + chest，chest 用 `box` 外扩 `range`）、
`FixedRuntimeProfile`。

1. **玩家几何**：`pSize` / `pAnchor` 取 manifest；解不到玩家资源 ⇒ 本判据不报（引用族负责，
   `reachability.ts:44-60`）。
2. **实心体**：`terrain` + `kind:"solid"` 实体；solid 的 `motion` **按运行时静态原位** `e.box` 处理，
   **不**用整段行程（02 S5；`scene.ts:150`）。在 03 修好 S5 之前，若 config 有 moving solid，A 降为
   `INSUFFICIENT_EVIDENCE`（否则会继承 S5 的误报）。
3. **静止 hazard 矩形**：只收 `kind:"hazard" && !motion` 的实体；几何用**运行时物理体**（精灵帧尺寸 /
   资源锚点），**不用 `e.body`**（06 S7；`scene.ts:158`）。若该 hazard 带 `body` 覆盖、或资源有多帧且帧尺寸
   不同，A 降为 `INSUFFICIENT_EVIDENCE`（几何不可确定）。
4. **两张格子**（镜像 `reachability.ts:88-114` 的脚点模型）：
   - `blocked`：实心体按玩家宽高外扩；
   - `hazardMask`：静止 hazard 矩形按玩家宽高外扩，**只当禁区，不当地板**。
5. **落脚点**：`freeAt(x,y) = !blocked(x,y) && !hazardMask(x,y) && y+1 <= H && blocked(x,y+1)`。
   关键：hazard **不提供支撑**；世界底也不是地板（与 `reachability.ts:107-113` 一致）。这正是
   「hazard 当 solid」会漏报的地方（见 §3.5）。
6. **BFS**：与 `auditReachability` 相同的 hop 模型（真正的抛物线、水平匀速、`maxDx = jumpSpan(move,H)`、
   60Hz 采样），但每个采样点同时拒绝 `blocked` 与 `hazardMask`（`reachability.ts:139-213`）。
   起点仍是出生点附近 ±一个身位、不低于 `spawn.y - player.h` 的落脚点（`reachability.ts:177-198`）。
7. **反事实**：
   - `base`：`hazardMask` 全空（hazard 当空气）跑一遍；
   - `mask`：加上静止 hazard 跑一遍。
   只有 **`base` 可达 && `mask` 不可达** 才进入 A。若 `base` 也不可达，根因是地形/空间，归 03，A 不重复报。
8. **目标归属**：
   - 若目标的**可收集区域**与 `hazardMask` 相交（目标在 hazard 里 / 贴着 hazard），A **不报**，
     落 `INSUFFICIENT_EVIDENCE`（`coverage-gap: "target-inside-hazard"`）。原因是 pickup/chest 的收集
     可能在同一帧、复位之前/之后发生，且收集跨复位保留（§7）；gate 在 hazard 里也有 `tryWin` vs
     `hitHazard` 的回调顺序问题。误伤比漏报贵。
   - 否则，`mask` 不可达 ⇒ `PROVEN_UNPLAYABLE`，`PLAYABILITY_MECHANIC_PATH_BLOCKED`。
9. **薄 hazard / 隧穿**：若 blocker hazard 在穿越方向上的厚度小于 `FixedRuntimeProfile` 的
   `minHazardThickness`（建议取 `max(4, speed / 30)`，覆盖 30Hz 的一帧位移），A 降为
   `INSUFFICIENT_EVIDENCE`。语料最小 hazard 厚度 12px，speed 90 ⇒ 1.5px/帧，远大于阈值。
10. **出生点在 hazard 里**：若 seed 全被 hazardMask 拒绝或出生点与 hazard 相交，A 不报（出生点非法归
    03/`auditGameConfig` 的自洽族；`game-config.ts:553-561` 今天只查 solid）。
11. **去重**：每个目标只产一条 error；若同时被 A/B 证明，`witness` 列全部根因，id 取首先命中的那条
    （framework §7.1）。

### 3.3 输入字段 / 输出

输入：`config.terrain[]`、`entities[]`（`kind`、`at`、`asset`、`body`、`motion`、`range`）、
`player.at/move`、`objective.gate`、manifest 的 `assets[].size/anchor`。
输出：`PlayabilityEvidence`，`target` 是被挡住的实体 id；`witness.blockers` 列 hazard id 与矩形；
`witness.counterfactual` 记 `{withoutStaticHazard:"reachable", withStaticHazard:"unreachable"}`；
`witness.reachableSet` 记 BFS 访问数/前沿摘要（可机检的格子摘要）。

### 3.4 是否需要时序模拟

**不需要**。静止 hazard 在任何时刻都在；它只是在可达性里增加一个「不可站立、不可穿越」的禁区。
在 `FixedRuntimeProfile` 的「接触即复位、复位不前进」下，任何真实路径都必须避开 hazard 矩形；模型又是
**过宽**的移动上界（多段跳、跳得更远、飞过目标都算），所以「模型里不可达」⇒「真实不可达」。
这是 04 唯一不需要相位/时间展开的机制证明。

### 3.5 误报边界与合法设计反例

| 边界 | 为什么不是误报 / 如何处理 |
|---|---|
| **宽巡逻是合法设计（票 18 教训）** | A 只收 `!motion` 的 hazard；巡逻 hazard 一律不进 A。`fpvs-v1-p0` 票 18 的 `clampPatrolRange` 被撤，因为 `last-train` 的 `carriage distance=200` 是玩家**躲**的合法宽巡逻（`.scratch/fpvs-v1-p0/issues/18-patrol-range-gate.md:25-35`）。 |
| **静止 hazard 能跳过 / 绕开** | A 的 `mask` BFS 会找到路径 ⇒ 不报。07 必须配「刚好能跳过」的合法边界 fixture。 |
| **hazard 在支路 / 可选区** | 目标在支路外时 `base`/`mask` 都可达 ⇒ 不报。注意 config 没有 optional 字段，`pickupCount` 把 pickup+chest 全算必需（`game-config.ts:267-268`）；如果设计把某个收集物当可选，那不是 playability 误报，而是设计↔config 的不可表达（02 C4）。 |
| **pickup/chest 在 hazard 里** | A 主动抑制（§3.2 步骤 8）；见 §7。 |
| **hazard 当 solid 会漏报** | 若把 hazard 当 solid，模型允许玩家**站在 hazard 顶上**，`last-train` 的 48px static carriage 会「可达」（E3 §14：`staticHazard_asSolidReach=[]`），而正确的禁区模型会报（`staticCarriage_48px` 报 suitcase-3/signal）。所以不能用「改 kind 为 solid」实现 A；必须用 `hazardMask` 非支撑禁区。 |
| **低天花板 / 走路走廊** | A 复用了 `auditReachability` 的 hop-only 模型；02 S6 的低天花板误报会污染 `base`/`mask`。A 必须在 03 补 walk/clearance 边之后再落地；否则 A 不能当确定性证明。 |
| **moving solid / `body` 语义** | 03 S5/S7 未修前，含 moving solid 或 hazard `body` 覆盖的 config 落 `INSUFFICIENT_EVIDENCE`。 |
| **probe / 实验夹具** | `p0-02-*/09-probe-hazard` 等是机制 probe，不是关卡；07/08 必须排除或标注为非关卡。 |
| **薄 hazard 隧穿** | 用 `minHazardThickness` 抑制；否则模型比运行时更严（运行时可能穿过去）⇒ 会误报。 |
| **出生点在 hazard 里** | 不归 A；出生点非法归 03/自洽族。 |

### 3.6 分类与依赖

- **分类**：`deterministic error`（在上述 profile/几何前提下）。
- **依赖**：03 的 walk/clearance 边（S6）、solid motion 静态原位（S5）、`body` 语义（S7）、chest 目标与
  `range`（S1/M4）、目标用真实 overlap 而不是 `covers` 的宽松 一个身位（S3）。在这些修好之前，A 的实现
  可以存在，但发布门只能把它当 `INSUFFICIENT_EVIDENCE`。
- **与 mechanic-coverage**：A 不读 `buildMechanicCoverage`；`avoid-danger` 的 config 层只要有 hazard/danger
  就 `satisfied`（`mechanic-coverage.ts:124-127`），与 A 的 `PROVEN_UNPLAYABLE` 可以同时成立，互不推翻。
- **与既有 warning**：不升级台阶/行程 warning；不新增 warning（§13）。

### 3.7 历史语料影响（必须由 08 裁定）

`04-hazard-mask-corpus.mjs`（E3）在 20 个唯一配对 config 里对 9 个含静止 hazard 的 config 跑禁区模型，
**4 个新增命中**：

1. `.scratch/game-maker-v2/experiments/e2e-wasteland/raw/run-out-2026-10-13h/ruined-city-scavenger/run/v1/game-config.json`
   → `pickup-water-4`、`goal-1`（hazard-current-1 20×20 与 hazard-spikes-3 24×12 连成不可跳过的簇）。
2. `.scratch/game-maker-v2/experiments/e2e-wasteland/raw/run-out-2026-10-18a/wasteland-scavenger-assets/site/v1/game-config.json`
   → `scrap-4`、`scrap-5`、`scrap-6`、`gate-1`（spike-1 64×20 在唯一地面路径上）。
3. `.scratch/p0-02-second-demo-v2/runs/09-probe-hazard/hazard-contact/config.json` → `goal`（**probe 夹具，
   不是关卡**；probe 只测接触命中）。
4. `.scratch/visual-design-impl-v1/runs/2026-10-25-e2e-v4pro-promptfix/wasteland-scavenger/run/v1/game-config.json`
   → `pickup-3`、`chest-1`、`gate`（hazard-1 32×32 在唯一地面路径上）。

这些**不能自动叫误报**：三个历史产物没有 playtest 证据，QA 的 `reachability` 今天把 hazard 当空气
（`reachability.test.ts:46-50`），所以 QA 通过不说明 hazard 可通过。按 `jumpSpan=66px` 的几何，64×20 的
spike、32×32 的 hazard 在 32–72px 宽的玩家面前都超过「滞空期间可跨越的宽度」，很可能是**真阻断**。但也不能
自动叫真阳性：必须由 08 重判，且 07 为这 4 个案例各配合法边界。**在 08 裁定之前，A 不应作为硬拒上线。**
其中第 4 条的 `chest-1` 依赖 03/05 把 chest 纳入目标（S1）；即使不纳入，`gate` / `pickup-3` 的命中仍存在。

---

## 4. 判据 B：`PLAYABILITY_MECHANIC_PATH_NO_SAFE_WINDOW`（全高 danger 墙的安全窗口不足）

### 4.1 问题

一个 `danger` 的 `strike{periodMs, activeMs}` 是否让某个必需目标在**任何进入时刻**都无法在 idle 窗口内
到达？`periodMs` 是安全窗口时长，`activeMs` 是喷发时长；完整周期 `P+A`；t=0 从 idle 开始
（`hazard.ts:22-33`；E2 `hazard.test.ts:38-46`）。

### 4.2 精确算法（退化情形：单 danger、全列切面）

输入：`config`、`manifest`、目标集 `T`、`FixedRuntimeProfile`（玩家 speed、无加速度、无二段跳、危险接触
复位、复位到出生点、收集保留）。

1. **danger 几何**：`d.box` 用 `e.body ?? assetSize` + 资源锚点（运行时命中用 `d.box`，
   `scene.ts:299-307`；`world.ts:178`）。`strike` 必须存在（schema 保证）。
2. **全列切面**：把 danger 矩形按玩家宽高外扩成 `dangerMask`（非支撑），与 `blocked` 一起建格。
   精确的网格判定是：在 danger 的 x 区间（按玩家宽外扩）内，**只含 solid** 的格子算出的所有可站立脚点，
   其 y 都落在 danger 矩形按玩家高外扩的范围内 —— 即没有从上方、下方或侧面绕过去的自由缝隙。
   等价的操作判定：把 `dangerMask` 当禁区后，spawn 与 target 落在两个不同的连通分量。为降低误报，V1 只接受
   **单 danger + 全列切面**；多 danger 联合或非全列一律 `INSUFFICIENT_EVIDENCE`。
3. **目标侧别**：spawn 与 target 必须在 danger 的异侧；若 spawn 在 danger 里 → 不报（出生点非法）；
   若 target 在近侧 → 不需要穿越，不报；若 target 在 danger 里 → 用单向距离（步骤 5）。
4. **基础可达性**：`base`（danger 当空气）不可达 ⇒ 根因是地形/空间，归 03，B 不重复报。
5. **最小必需时间**：
   - target 在远侧：`requiredMs = ((d.box.w + player.w) / speed) * 1000`。
     玩家 body 从「右边缘刚过 danger 左边缘」到「左边缘刚过 danger 右边缘」，中心至少要移动
     `d.box.w + player.w`；水平速度最多 `speed`（`scene.ts:89`；空中同样）。
   - target 在 danger 内：`requiredMs = (max(0, targetRegion.x - d.box.x) / speed) * 1000`。
     收集/胜利不要求退出；pickup/chest 收集后复位也保留计数（§7），所以只需单向到达。
     用目标区域的**近边**（更小的下界）更保守，减少误报。
6. **安全窗口判定**：`idle = strike.periodMs`；若 `requiredMs > idle + frameMargin` ⇒
   `PROVEN_UNPLAYABLE`。`frameMargin` 建议取 1 帧（1000/60 ms）或更大；`requiredMs <= idle` 时**不报**
   （这只说明「可能过得去」，不是「证明可过」；B 从不产好消息）。等号附近按 `INSUFFICIENT_EVIDENCE`，
   避免帧边界误报。
7. **收集物语义**：pickup/chest 的收集跨复位保留（`scene.ts:334-341,355-362`），所以「收集后复位」是
   合法策略；B 只证明「在 active 开始前根本到不了目标」，不要求玩家安全退出。
8. **gate 计数**：`tryWin` 要求 `collected >= pickupCount`（`scene.ts:364-369`）；若 gate 在远侧，gate
   本身不可达已足够判死；若 gate 在近侧而必需 pickup/chest 在远侧，则每个远侧目标用步骤 5 判定，任一
   目标 `requiredMs > idle + margin` 即证明不可完成。

### 4.3 输入字段 / 输出

输入：`entities[].kind === "danger"` 的 `at`、`body`、`strike.periodMs`、`strike.activeMs`；
`player.move.speed`；玩家尺寸；目标区域；`world.size`。
输出：

```
{
  judgmentId: "PLAYABILITY_MECHANIC_PATH_NO_SAFE_WINDOW",
  target: 'entity "<targetId>"',
  detail: "danger \"<id>\" 全高封死唯一通路：idle <P>ms < 最少穿越 <T>ms（宽 <w> + 玩家 <pw>，速度 <s>）",
  witness: {
    kind: "no-safe-window",
    dangerId, box,
    idleMs: P, activeMs: A,
    requiredMs: T,
    speed, playerWidth,
    side: "near->far",
    fullColumnCut: true,
    targetRegion
  },
  coverage: { spatial: "checked", mechanic: "checked", completion: "<按 scope>" },
  expected: P, actual: T
}
```

### 4.4 是否需要时序模拟

**不需要完整模拟**。这是一条**闭式相位下界**：玩家可以在任意 safe 位置等待，每个周期有且仅有一段
`P` 长的 idle；玩家必须在同一段 idle 内完成从 danger 近边界到目标的最小水平距离。只要
`requiredMs > P`，**所有**进入时刻都不够，因此不存在安全窗口。它不需要搜索「最佳时机」，也不需要对
玩家策略做上界；它只用了 `speed` 的上界与 idle 的下界。

**静态模型能否给可靠上界？**
- `danger` 当空气：是上界（忽略危险）；「不可达」只能证明地形不可达，不能归因 danger。
- `danger` 当实心：**不是**上界。danger 只在 active 时危险，idle 时可穿过；把 danger 当实心会排除合法的
  idle 穿越，产生误报（E3 §14：`dangerWide_asSolidReach` 对合法宽 idle 激光也报 suitcase-3/signal）。
- **只有**「全列切面 + 最小停留 > idle」这条闭式下界是可靠的；其余 danger 全部 `INSUFFICIENT_EVIDENCE`。

### 4.5 误报边界与合法设计反例

| 边界 | 处理 |
|---|---|
| **宽 idle 激光**（`periodMs` 足够长） | `requiredMs <= idle` ⇒ 不报；07 必须配合法边界。 |
| **非全高激光 / 可从上方跳过 / 下方钻过** | 全列切面不成立 ⇒ `INSUFFICIENT_EVIDENCE`（宁可漏报）。 |
| **gate / pickup 在近侧** | 不需要穿越 ⇒ 不报。 |
| **spawn 在 danger 里** | 玩家 t=0 从 idle 开始，可以走出去；且出生点非法归 03 ⇒ 不报。 |
| **target 在 danger 的安全口袋 / 从另一侧可达** | 全列切面或连通分量判定会排除 ⇒ 不报。 |
| **多 danger 联合、周期不同、有安全口袋** | V1 一律 `INSUFFICIENT_EVIDENCE`；不能把多个 danger 当一个大实心。 |
| **`periodMs` 语义漂移** | FixedRuntimeProfile 必须钉 `dangerState`；运行时改语义必须重新评估（framework §2.2）。 |
| **玩家有加速度 / 冲刺 / 二段跳** | 当前 Runtime 没有；若未来加上，`requiredMs` 下界失效，必须重新评估。 |
| **帧边界等号** | 用 `frameMargin`，等号不报。 |
| **target 在 danger 里且距离很近** | 单向距离 <= idle ⇒ 不报；收集跨复位保留，允许「拿到就复位」。 |
| **target 在 danger 里且很深** | 单向距离 > idle ⇒ 可证；用近边下界避免误报。 |

### 4.6 分类与依赖

- **分类**：`deterministic error`（仅限单 danger、全列切面、`requiredMs > idle + margin` 的退化情形）。
- **依赖**：`dangerState` 语义（已实现，无缺口）；`strike`（已实现）；`d.box` 与 `e.body`（已实现）；
  玩家无加速度（当前 Runtime）；帧率/`danger` 判定的时序（`advanceDangers` 在 `update` 里，按帧采样；
  用 margin）。不依赖 moving-platform、不依赖时间展开。
- **语料**：真实语料只有 1 个 danger，且是 `avoid-danger` probe 夹具（`p0-02-second-demo-v2/runs/09-probe-all/avoid-danger/config.json`，
  danger 盒 x=40..160 覆盖出生点，`P=400,A=400`）。该夹具的 spawn 在 danger 里，B 按步骤 3 不报；
  它不是关卡。08 没有真实 danger 关卡可重判，B 只能靠 07 的合成负例证明会响。

---

## 5. 候选 C：巡逻 hazard 封死唯一通路（`INSUFFICIENT_EVIDENCE`，不注册）

### 5.1 问题与算法（仅供记录）

巡逻 hazard 的位置是 `hazardAnchor(start, distance, periodMs, t)`（`hazard.ts:14-19`）；
要证明「封死唯一通路」，需要对**位置 × 时间相位**做可达性：

- 状态 `(x, y, t)`：`t` 是自场景开始的绝对时间；
- 在安全落脚点等待任意 Δt；
- 每次 hop 用时 `t_arc`，水平/垂直轨迹同 `reachability.ts:139-175`；在每个采样时刻检查玩家 body 是否
  与 `hazardAnchor` 当前位置相交；
- 目标测试同 `covers`；
- 输出 `reachable / not-reachable / unknown`。

这是**上界模型 + 时间**；要得到「不可达」的可靠证明，必须保证模型对玩家能力是上界、对 hazard 占用是
下界（不能把 hazard 在非占用时刻当墙），且时间离散不能漏掉可行轨迹。当前 `auditReachability` 的 hop
模型没有时间维、没有 waiting 状态、没有 walk 边（02 S6），不能直接复用。

### 5.2 为什么 V1 不做

1. **整段行程当实心是错的**：hazard 只在扫过的那一段的**某一时刻**在那里；把整段当墙会排除
   「等它走开再走/跳」的合法策略。E3 `04-patrol-probe.mjs` 在 16 个含 moving hazard 的唯一配对 config 上
   跑「swept envelope as solid」，**1 个 config 新增 4 个 error**：
   `.scratch/game-maker-v2/experiments/e2e-wasteland/raw/run-out-2026-10-18a/wasteland-scavenger-assets/site/v1/game-config.json`
   的 `scrap-4` / `scrap-5` / `scrap-6` / `gate-1`（enemy-1 80×88，distance=60）。这正是票 18 的
   误伤类别。
2. **票 18 的冻结裁定**：`last-train` 的 `carriage distance=200` 是合法宽巡逻（玩家躲，不是跳）；
   「巡逻范围 ≤ 跳跃跨度」不是普适约束。`clampPatrolRange` 已被撤回
   （`.scratch/fpvs-v1-p0/issues/18-patrol-range-gate.md:25-35`；`.scratch/fpvs-v1-p0/map.md:58`）。
   任何「巡逻宽度 vs 跳跃跨度」的静态判据都重开这条裁定，禁止。
3. **静态模型只在上界方向可靠**：hazard 当空气是上界（「连空气都过不去」才是可靠的那半句话）；
   它无法证明「因为 hazard 所以过不去」。巡逻 hazard 的**下界**需要时间展开，V1 没有。
4. **`fixed runtime` 的 hazard 复位语义**：碰到就回出生点、收集保留；这意味着玩家可以等待/重试，
   但也意味着「被巡逻撞到」不是失败，只是回到起点。证明「任何等待/重试都不行」需要把等待策略纳入模型。

### 5.3 分类 / id / 依赖

- 分类：`INSUFFICIENT_EVIDENCE`。不产 `ConfigIssue`；`coverage.mechanic = partial`，
  `witness.kind = "coverage-gap"`，`gap = "moving-hazard-phase"`。
- id：若未来做时间展开，候选 `PLAYABILITY_MECHANIC_PATROL_PATH_BLOCKED`；**本轮不注册**。
- 依赖：新的时间展开可达性（Runtime 语义已够，但算法未实现；需要明确时间离散与等待策略）；
  不能依赖 swept envelope；不能把 agent smoke 失败当证据（票 18 的教训正是 smoke 的自动玩家限制）。

---

## 6. 候选 D：moving-platform（`INSUFFICIENT_EVIDENCE` / coverage gap，不注册）

### 6.1 事实

- `RUNTIME_IMPLEMENTED_MECHANICS` 不含 `moving-platform`（`vocabulary.ts:86-99`）。
- `Motion` 在 config 里正交于 `kind`（`game-config.ts:79-85`），但渲染器只在 `case "hazard"` 消费
  `motion`；带 `motion` 的 solid 是静态体、从不移动（`scene.ts:150,270-281`）。
- `shell-mechanic-witness.test.ts:29,76-78` 把 `moving-platform` 钉成 `experimental`，
  `WITNESS["moving-platform"] = null`。
- `world.ts:109-116` 的 `floorYOf` 明确排除带 `motion` 的 solid，不把它当地面。
- 03 S5：`auditReachability` 却把 moving solid 的**整段行程**当实心（`reachability.ts:67-73`），
  与运行时静态原位矛盾；语料 0 个 moving solid（02 §7.3.2）。

### 6.2 结论

**不创建 moving-platform 的 playability 判据**。理由：

1. 运行时没有「移动平台」语义；按 `FixedRuntimeProfile`，`solid` 是静态碰撞，`motion` 不推进。
   因此可达性应该用 **solid 的静态原位 `e.box`**，而不是 swept envelope。修正 swept envelope 是 03 S5
   的活，不是 04 的新判据。
2. 如果 config 依赖平台移动来搭桥，而运行时平台不动 ⇒ 目标不可达。这个「不可达」是**空间可达性**的
   普通 error（03），detail 可以指出「该 config 的 solid 带 motion，运行时不会移动，moving-platform 是
   experimental」；但不要另立 `PLAYABILITY_MECHANIC_MOVING_PLATFORM_*`，也不要把 `mechanic-coverage` 的
   `runtime: unsupported` 当成 playability 的硬拒来源。
3. `mechanic-coverage` 已经独立回答「这条机制端到端齐不齐」：`CONFIG_RULES["moving-platform"]` 要求
   `motion:cycle`（`mechanic-coverage.ts:115`），`RUNTIME_IMPLEMENTED_MECHANICS` 不含它 ⇒
   `runtime = unsupported` ⇒ 门禁失败（`isGateBlocking`，`mechanic-coverage.ts:100-102`）。这是
   **另一个门禁**，不是 `ConfigIssue`，也不改变 `PlayabilityVerdict`。
4. 不重开 `intent-to-mechanics-v1` 的 Q4 裁定（`.scratch/intent-to-mechanics-v1/rulings-2026-10-23.md`：
   「如实标记，不在本 effort 实现」）。

### 6.3 分类 / coverage

- 分类：`INSUFFICIENT_EVIDENCE` / coverage gap；不注册 id。
- 若 config 有 `solid+motion`：`coverage.mechanic = partial`，`witness.kind = "coverage-gap"`，
  `gap = "moving-platform-unsupported"`；不产 `ConfigIssue`。
- 不得使用 swept envelope；不得把 moving-platform 当成可玩性 error；不得把 `mechanic-coverage` 的
  verdict 读进 playability。

---

## 7. 候选 E：pickup/chest 被 hazard 完全包住（`INSUFFICIENT_EVIDENCE`，不注册）

### 7.1 为什么「包住 ⇒ 不可收集」是错的

1. **收集跨复位保留**：`hitHazard` 只 `body.reset(spawn)`；`collected`、chest 的 `opened`、pickup 的
   `active=false` 都不会被复位（`scene.ts:315-341,355-362`）。所以「碰到 hazard 拿到东西再被复位」是
   合法策略，计数不丢。
2. **pickup / hazard 的命中是 physics overlap 回调**：`scene.ts:151-163` 按实体注册顺序绑定；回调顺序
   由运行时/注册顺序决定，不是契约语义。pickup 在 hazard 里/贴着 hazard 时，同帧可能先 collect 再
   reset（或反之），不能静态证明「一定先 reset」。
3. **chest 是 `update` 里的近距几何判定**，不进 physics overlap：`advanceChests` 用玩家 body ×
   `box` 外扩 `range`（`scene.ts:315-327`）。即使 chest 在 hazard 里，只要 `range` 让交互区伸到安全侧，
   玩家可以在 hazard 外开箱；开箱状态跨复位保留。
4. **语料已有合法相交**：`04-composition-probe.mjs` 在
   `.scratch/game-maker-v2/experiments/e2e-wasteland/raw/run-out-2026-10-13h/ruined-city-scavenger/run/v1/game-config.json`
   找到 `pickup-scrap-5` 盒子 `{x:1174,y:240,w:12,h:10}` 与 `hazard-current-1` 盒子
   `{x:1170,y:228,w:20,h:20}` 相交（不包含）。这证明「目标与 hazard 相交」不是天然错误。
5. **设计意图**：如果设计者故意把奖励放在 hazard 里，让玩家「拿了就复位」，这是合法的风险/奖励设计；
   playability 不能把「必须接触 hazard」当成错。

### 7.2 可证的部分与不可证的部分

- **可证**：目标在静止 hazard 的**另一侧**，必须穿过 hazard 才能到达 ⇒ 归 A（`PATH_BLOCKED`）。
  这里不是「包住」，而是「挡在墙后」；玩家无法在复位前到达目标（除非目标与 hazard 边界同帧，A 的步骤 8
  会抑制）。
- **不可证**：目标**在 hazard 里**或与 hazard 可收集区域相交 ⇒ 复位/收集顺序、`range`、跨复位保留都
  使「不可收集」不成立。V1 落 `INSUFFICIENT_EVIDENCE`，并**主动抑制** A，避免误报。
- **danger 包住**：见 §8；danger 只在 active 时危险，idle 时可进入，收集跨复位保留，所以也不能用
  「包住」直接判死；只有「单向距离 > idle」的全列切面退化才可证。

### 7.3 分类 / id / 依赖

- 分类：`INSUFFICIENT_EVIDENCE`；不注册 `PLAYABILITY_MECHANIC_PICKUP_HAZARD_SEALED` /
  `..._CHEST_HAZARD_SEALED`。
- 依赖：若未来要证「hazard 里的目标」，必须先裁定 pickup/hazard 的 overlap 回调顺序、`body`/帧尺寸语义
  （S7）、chest `range` 的精确目标区域（M4），以及「复位保留计数」是否被设计允许。当前不满足精确可算门槛。

---

## 8. 候选 F：pickup/chest 被 danger 包住 / 挡在墙后

### 8.1 可证的退化

用 B 的同一套算法，只把 target 换成 pickup/chest 的可收集区域：

- danger 必须是**单 danger + 全列切面**；
- spawn 与 target 异侧；target 在近侧不报；spawn 在 danger 里不报；
- **单向**最小时间：`requiredMs = min(crossingMs, toTargetMs)`；
  - target 在 danger 外（远侧）：`crossingMs = (box.w + player.w) / speed`；
  - target 在 danger 内：`toTargetMs = max(0, targetRegion.x - box.x) / speed`（取近边下界）；
- `requiredMs > periodMs + frameMargin` ⇒ `PROVEN_UNPLAYABLE`，id 复用
  `PLAYABILITY_MECHANIC_PATH_NO_SAFE_WINDOW`，`target` 是 pickup/chest id；
- 收集跨复位保留 ⇒ 只要求到达，不要求安全退出（`scene.ts:334-341,355-362`）；
- chest 的 `range` 用它外扩后的交互区作为目标区域（`scene.ts:315-327`）；若交互区伸到安全侧，
  则从安全侧可达，不报。

### 8.2 不可证的边界

- danger 不是全列切面 / 可从上方跳过 / 下方钻过 / 有安全口袋 ⇒ `INSUFFICIENT_EVIDENCE`；
- 多 danger、不同周期、窗口组合 ⇒ `INSUFFICIENT_EVIDENCE`（见 §10）；
- target 在 danger 内但 `toTargetMs <= idle` ⇒ 不报（可进入收集；复位保留计数）；
- target 在 danger 内但玩家可以从远侧进入（已经穿过墙）⇒ 若墙能穿过，`crossingMs <= idle`，
  那么 `toTargetMs <= crossingMs <= idle`，不会误报；若墙不能穿过，远侧到不了，近侧是唯一入口。

### 8.3 语料与分类

- 真实语料 0 个 danger 关卡；唯一 danger 是 probe 夹具，且 spawn 在 danger 里，B/F 都不报。
- 分类：退化情形 `deterministic error`；其余 `INSUFFICIENT_EVIDENCE`。
- 07 必须合成：full-height danger + pickup/chest 在远侧/深处/浅处/安全口袋/宽 idle 的合法边界。

---

## 9. 候选 G：collect-then-reach 顺序 vs gate 激活（归 05，不是机制判据）

### 9.1 运行时事实

- `pickupCount = pickup + chest`（`game-config.ts:267-268`）；`tryWin` 只在
  `collected >= pickupCount` 时成功（`scene.ts:364-369`）。
- gate 早到是**空操作**：`tryWin` 直接返回，gate 不消失、不锁定；玩家可以在收集后再次进入。
- 收集跨复位保留；`hitHazard` 只复位位置（`scene.ts:355-362`）。
- **复位不是免费传送**：没有自毁/手动 respawn；只有接触 hazard/danger 才复位到出生点。一个单向坑里的
  玩家只有在坑里能碰到 hazard/danger 时才能回出生点。

### 9.2 结论

- 04 **不产生** `PLAYABILITY_MECHANIC_ORDERING_*`；gate 激活本身不引入机制层顺序约束。
- 顺序/完成性归 05：必须建模「每个必需目标可达 + 最终 gate 可达」，以及单向路径、复位作为**唯一**的
  hazard/danger 接触转移。05 需要知道：
  1. 收集跨复位保留 ⇒ 「收集 → 复位 → 再收集」是合法计划；
  2. 复位不是免费动作 ⇒ 单向坑只有在坑内有 hazard/danger 时才可退出；
  3. chest 的 `range` 可能让「到达 gate 前开箱」与几何到达不同；
  4. `tryWin` 的计数门槛是 gate 激活条件。
- 如果 05 要立 id，建议 `PLAYABILITY_COMPLETION_*`（framework §1/§8），不要在 04 里立。
- 与 A/B 的关系：A/B 证明的是「某个必需目标从出生点不可达」；如果 gate 可达但收集后回不到 gate，
  那是 05 的单向路径问题，不是 04 的机制问题。

---

## 10. 候选 H：必须在同一时机完成两件事（`INSUFFICIENT_EVIDENCE`，不注册）

### 10.1 为什么没有「同刻」约束

- 运行时没有攻击/交互/两键组合动作；`run` / `jump` 可同时按住（`scene.ts:79-96`）；
- pickup 是自动 overlap，chest 是近距自动开，gate 是自动 overlap；没有需要「在某一瞬间按两个键」的机制；
- 收集跨复位保留，所以「先收集 A，再复位，再收集 B」是合法的；不存在「A 和 B 必须在同一生命周期/
  同一窗口内都拿到」的机制约束；
- danger 窗口是全局时间（t=0 起算），玩家可以等待任意周期；所以两个目标可以分属不同 idle 窗口。

### 10.2 真正需要联合时序的退化

- 多个 danger 的活跃区间在必经走廊上**联合**覆盖，且中间没有安全口袋 ⇒ 需要时间展开的 product 模型；
  周期不同还要 LCM/事件驱动。V1 不做，`INSUFFICIENT_EVIDENCE`。
- 单 danger 已经由 B 覆盖；若单 danger 不能分离，多 danger 也不能单独用静态实心证明。
- 两个 pickup 在两个不同的 danger 墙后：可以分别在不同周期完成；只要每个单墙可由 B 证明/不证明，
  顺序不构成同刻约束。
- gate + pickup 在同一 danger 内：收集保留；如果 pickup 深到进不去，B/F 会证明；如果 pickup 能拿到，
  gate 也可以分下一窗口；不是同刻。

### 10.3 分类 / id

- 分类：`INSUFFICIENT_EVIDENCE`；不注册 `PLAYABILITY_MECHANIC_SIMULTANEOUS_*`。
- 依赖：时间展开的多 danger 联合模型（未来 effort）；不能把多个 danger 当一个实心，也不能把
  「单 danger 的 B」错误地推广到多 danger。

---

## 11. 静态上界什么时候可靠？

| 近似 | 与真实可走路径的关系 | 能否用于「不可达」证明 | 04 用法 |
|---|---|---|---|
| hazard 当空气（当前 `auditReachability`） | 真实 ⊆ 近似（忽略障碍 ⇒ 更宽） | 能，但只能证明地形/几何不可达，**不能归因 hazard** | `base` 反事实；03 空间层 |
| 静止 hazard 当**不可站立禁区** | 真实 ⊆ 近似（真实路径必须避开 hazard；模型移动能力过宽） | **能**（在接触即复位、无隧穿下） | **A** |
| 静止 hazard 当 solid | 真实 ⊆ 近似（solid 还多给一个可站立的顶，模型更宽） | 能但不完整（会漏报：玩家在模型里站上 hazard 顶） | **不用**；E3 证明 48px carriage 会漏 |
| moving hazard 的 swept envelope 当 solid | 近似 ⊄ 真实（hazard 大部分时间不在那里） | **不能**（会误报） | **禁止**；E3 1 config / 4 targets |
| danger 当空气 | 真实 ⊆ 近似 | 能，但只能证明地形不可达 | `base` |
| danger 当 solid | 近似 ⊄ 真实（排除 idle 穿越） | **不能**（会误报） | **禁止**；E3 宽 idle 激光也报 |
| danger 全列切面 + `requiredMs > idle` | 真实 ⊆ 近似（时间下界 + 禁区） | **能**（闭式） | **B** |
| moving solid 当静态原位 | 真实 = 运行时（`FixedRuntimeProfile`） | 能，但这是空间层 | 03 S5；不是 04 判据 |
| moving solid 的 swept envelope | 近似 ≠ 运行时 | 不能可靠 | **禁止**；03 S5 |

**结论**：当前静态模型在**放宽方向**（hazard/danger 当空气）是可靠上界，但只能证明地形不可达；要证明
「机制导致不可达」，静止 hazard 必须用**非支撑禁区**（A），danger 必须用**全列切面 + 时间下界**（B）。
把 hazard/danger/moving solid 当 solid 或用 swept envelope，都会破坏上界方向，分别产生漏报/误报。

---

## 12. coverage、聚合与 issue 映射

### 12.1 04 对 `coverage.mechanic` 的贡献

| 情况 | `mechanic` |
|---|---|
| 无 hazard/danger/solid+motion；A/B 空跑 | `checked`（空范围，明确记录） |
| 只有静止 hazard；A 执行且每个目标有结论 | `checked` |
| 只有单 danger 且全列切面；B 有结论 | `checked` |
| 有 moving hazard / 非全列 danger / 多 danger / solid+motion / target-inside-hazard | `partial` |
| 04 没跑 | `not-checked` |

`partial` 必须显式出现，不能因为没报 error 就隐去（framework §3.4）。

### 12.2 聚合

- A/B 任一 `PROVEN_UNPLAYABLE` ⇒ 总 `PROVEN_UNPLAYABLE`；
- 否则 `coverage.mechanic !== "checked"` 或任一判据返回证据不足 ⇒ `INSUFFICIENT_EVIDENCE`；
- 否则 `NO_PROVEN_BLOCKER`（仍不是 `PROVEN_PLAYABLE`）。

### 12.3 issue 映射

- 只有 A/B 的 `PROVEN_UNPLAYABLE` 映射 `ConfigIssue{severity:"error"}`；`target` → `where`，
  `detail` → `message`；**不带 `code`**（`CONFIG_ISSUE_CODES` 闭集，`game-config.ts:315-317`）；
- `INSUFFICIENT_EVIDENCE` / coverage gap 不产 issue（framework §7.1/§7.2）；
- 同一 `(target, 根因类)` 一条 error；A/B 同时命中时 witness 列全部根因（framework §7.1）。

---

## 13. 与 `mechanic-coverage`、既有 warning 的关系

### 13.1 `mechanic-coverage` 只判存在性

- `CONFIG_RULES` 只数 entity kind / `motion:cycle` / objective（`mechanic-coverage.ts:109-128`）：
  `avoid-danger` 只要有 hazard **或** danger 就 `satisfied`；`reach-goal` 只要有 goal + objective 就
  `satisfied`；`jump` 恒 `satisfied`。它**不看**几何、相位、可达性。
- 所以「A 说 gate 被唯一 hazard 挡死」与「`avoid-danger` config `satisfied`」可以同时成立；
  「B 说 gate 在全高 danger 后」与「`reach-goal` config `satisfied`」也可以同时成立。这不是矛盾，
  是两层回答不同问题。
- 04 **不读** `buildMechanicCoverage` / `mechanicCoverageProblem`，也不改 `mechanic-coverage` 的
  `verdict`；`moving-platform` 的 `runtime: unsupported` 归它，不变成 playability error。
- `mechanic-coverage` 的门禁位置（QA 之后、站点之前）不变；playability 的 `deterministic` 位置不变
  （framework §4.1/§4.2）。

### 13.2 既有 warning 原样保留

- 台阶高（`game-config.ts:563-578`）、周期行程越界（`:579-584`）仍是 warning，不升级、不被 04 读取；
- **不新增**「巡逻宽度 ≤ 跳跃跨度」warning/clamp（票 18 已撤，`fpvs-v1-p0/issues/18-patrol-range-gate.md:25-35`）；
- C/D/E/H 全部是 `INSUFFICIENT_EVIDENCE` / coverage gap；F 的退化情形并入 B，其余为 `INSUFFICIENT_EVIDENCE`；
  这些都不产 warning、不产 error；
- 只有 A/B 产 error；难度/节奏/路线优劣仍不是判据（`CONTEXT.md` / framework §0）。

---

## 14. 证据日志

### 14.1 E1：源码 / 契约定位

| 事实 | 位置 |
|---|---|
| hazard 三角波 `hazardAnchor`；danger `dangerState`（P=idle，A=active，t=0 idle） | `packages/demo/src/hazard.ts:14-19,22-33` |
| 玩家每帧 `setVelocityX(±speed)`；落地才 `setVelocityY(-jumpVelocity)`；gravity | `packages/demo/src/shell/scene.ts:89-91,220` |
| solid 静态；`advanceHazards` 只遍历 hazard | `packages/demo/src/shell/scene.ts:150,270-281` |
| hazard overlap → `hitHazard()`；`hitHazard` 只复位位置 | `packages/demo/src/shell/scene.ts:157-163,355-362` |
| danger 按 `d.box` × 玩家 body 命中；`dangerState` 驱动 | `packages/demo/src/shell/scene.ts:287-307` |
| chest 近距/`range`/`opened`；pickup `collect`；计数保留 | `packages/demo/src/shell/scene.ts:315-341` |
| gate `tryWin` 要求 `collected >= pickupCount` | `packages/demo/src/shell/scene.ts:364-369` |
| `Motion` 正交 `kind`；`Strike` 语义；`body`/`range`/`strike` 字段 | `packages/contracts/src/game-config.ts:79-85,97-101,105-127` |
| `pickupCount` 数 pickup + chest；`playerMoveOf`；`maxJumpHeight`；`jumpSpan` | `packages/contracts/src/game-config.ts:267-268,271,274,288-291` |
| `auditReachability` hazard 当空气；只收 pickup + gate；`covers` 宽松；hop/BFS | `packages/contracts/src/reachability.ts:15-18,60-73,124-175,177-213` |
| `RUNTIME_IMPLEMENTED_MECHANICS` 不含 moving-platform | `packages/contracts/src/vocabulary.ts:86-99` |
| `mechanic-coverage` 只数存在性；门禁语义 | `packages/contracts/src/mechanic-coverage.ts:100-128,200` |
| `world.ts` 的 `size = e.body ?? assetSize`；`floorYOf` 排除 moving solid | `packages/demo/src/world.ts:109-116,178` |
| 既有台阶/行程 warning | `packages/contracts/src/game-config.ts:563-584` |
| 出生点卡 solid 只查 solid，不查 terrain | `packages/contracts/src/game-config.ts:553-561` |
| `ConfigIssue.code` 闭集 | `packages/contracts/src/game-config.ts:315-317` |
| QA 仍 7 条；QA `reachability` 调 `auditReachability` | `packages/contracts/src/qa.ts:111-137`；`packages/qa/src/gameplay.ts:71-86` |

### 14.2 E2：既有测试

| 测试 | 断言 / 事实 |
|---|---|
| `packages/demo/tests/hazard.test.ts:38-46`「danger 定时打击状态：idle ↔ active」 | `dangerState(2000,500,0)=idle`、`:2000=active`、`:2500=idle` ⇒ P/A 语义与 t=0 idle 被钉住 |
| 同文件 `:47-53`「扫过多个周期不累积偏移」 | 任意 t 的相位 = `t % (P+A)` |
| `packages/demo/tests/shell-mechanic-witness.test.ts:29,76-78` | `moving-platform: null`；`deriveMechanicStatus("moving-platform")="experimental"`；不在 `RUNTIME_IMPLEMENTED_MECHANICS` |
| `packages/contracts/tests/reachability.test.ts:46-50`「扫过的车厢（hazard）当空气」 | `reach(CONFIG)===[]` ⇒ 现有判据完全忽略 hazard |
| 同文件 `:55-60` 沟 200px | 逐条 error；`message` 含「够不到」 |
| `packages/contracts/tests/config-audit.test.ts:37-56` | reachability error 进 `deterministic`，不进 `resampleable` |
| `packages/contracts/tests/mechanic-coverage.test.ts:118-127` | `moving-platform` 三层可阻断，门禁点名 |
| `packages/qa/tests/gameplay.test.ts:130-146` | QA `reachability` 只报「够不到」，从不报可达 |

### 14.3 E3：零付费只读探针

所有脚本在 `.scratch/level-playability-v1/research/` 下；命令均**退出码 0**，无 stderr：

```bash
node .scratch/level-playability-v1/research/04-composition-probe.mjs   # exit 0
node .scratch/level-playability-v1/research/04-patrol-probe.mjs        # exit 0
node .scratch/level-playability-v1/research/04-hazard-mask-corpus.mjs  # exit 0
node .scratch/level-playability-v1/research/04-synthetic-probe.mjs     # exit 0
node .scratch/level-playability-v1/research/04-hazard-mask-probe.mjs   # exit 0
```

#### 14.3.1 语料概览（`04-composition-probe.mjs`）

| 计数 | 值 |
|---|---|
| 唯一 `game-config/v1` | 21 |
| 能配对 manifest | 20 |
| 含 hazard 的 config / hazard 实体 | 17 / 31 |
| 静止 hazard / 带 motion hazard | 12 / 19 |
| 含 danger 的 config / danger 实体 | 1 / 1（`avoid-danger` probe 夹具） |
| 目标与 hazard 相交 / 被 hazard 包含 | 1 / 0（`pickup-scrap-5` × `hazard-current-1`） |
| 静止 hazard 当 solid 新增 reachability error | **0**（但这是漏报方向，见 14.3.3） |

#### 14.3.2 巡逻 swept envelope 的误报（`04-patrol-probe.mjs`）

| 计数 | 值 |
|---|---|
| 20 个配对中含 moving hazard | 16 |
| swept-envelope-as-solid 新增 error 的 config | **1** |
| 新增目标 | `scrap-4` / `scrap-5` / `scrap-6` / `gate-1` |
| 路径 | `.scratch/game-maker-v2/experiments/e2e-wasteland/raw/run-out-2026-10-18a/wasteland-scavenger-assets/site/v1/game-config.json` |

这是「巡逻 hazard 当整段实心」的直接反例；与票 18 的 `last-train carriage distance=200` 同类。

#### 14.3.3 静止 hazard 禁区模型（`04-hazard-mask-corpus.mjs`）

| 计数 | 值 |
|---|---|
| 20 个配对中含静止 hazard | 9 |
| 禁区模型新增 error 的 config | **4** |
| 其中 probe 夹具 | 1（`p0-02-second-demo-v2/runs/09-probe-hazard/hazard-contact/config.json`） |
| 其中历史产物 | 3（见下表） |

| 历史产物 | 新增目标 |
|---|---|
| `.scratch/game-maker-v2/experiments/e2e-wasteland/raw/run-out-2026-10-13h/ruined-city-scavenger/run/v1/game-config.json` | `pickup-water-4`、`goal-1` |
| `.scratch/game-maker-v2/experiments/e2e-wasteland/raw/run-out-2026-10-18a/wasteland-scavenger-assets/site/v1/game-config.json` | `scrap-4`、`scrap-5`、`scrap-6`、`gate-1` |
| `.scratch/visual-design-impl-v1/runs/2026-10-25-e2e-v4pro-promptfix/wasteland-scavenger/run/v1/game-config.json` | `pickup-3`、`chest-1`、`gate` |

这三份历史产物**没有 playtest 证据**；QA 的 `reachability` 把 hazard 当空气，所以 QA 通过不代表 hazard 可通过。
按 `jumpSpan=66px` 与玩家宽 32–48px，这些地面 hazard（64×20、32×32、24×12+20×20 的簇）在物理上很可能
确实不可跳过；但 08 必须逐案重判，不能据 agent 失败或 QA 通过下结论。**在 08 之前，A 不能作为硬拒上线。**

#### 14.3.4 合成方向（`04-synthetic-probe.mjs` / `04-hazard-mask-probe.mjs`）

| 场景 | 结果 |
|---|---|
| `last-train` 原样 | `reach=[]` |
| `carriage` 去掉 motion，改为 **solid** | `reach=[]` ⇒ **漏报**（模型允许站在 48px hazard 顶上） |
| `carriage` 去掉 motion，用**禁区**模型 | 报 `suitcase-3`、`signal` ⇒ A 的正确方向 |
| `carriage` 保持 motion，禁区模型跳过 moving hazard | `reach=[]` ⇒ C 的 `INSUFFICIENT_EVIDENCE` |
| `last-train` + 全高 danger（P=300,A=300） | danger 当空气 `reach=[]`；当 solid 报 `suitcase-3`、`signal`；闭式 `requiredMs≈1067ms > 300ms` ⇒ B 的可证退化 |
| 同上但 P=3000,A=300 | danger 当 solid 也报 `suitcase-3`、`signal` ⇒ **danger 当 solid 的误报**；闭式 `1067 < 3000` ⇒ 合法宽 idle |
| pickup 放进静止 hazard 盒内 | 禁区模型报该 pickup ⇒ 但 E 明确**抑制**（收集跨复位保留/回调顺序） |
| moving solid 静态原位 vs swept | 本夹具无差异；语料 0 moving solid；03 S5 负责对齐 |

### 14.4 与 02 基线的差异

02 §7.3.2 的语料扫描是 152 份 config / 21 唯一 / 96 配对 / 20 唯一配对，`auditReachability` 0 error；
本报告的 04 探针沿用同一套发现/配对逻辑，得到 21 唯一 / 20 配对 / 31 hazard（12 静止 + 19 motion）/
1 danger。02 的「0 error」是 hazard 当空气的基线，不是 playability 基线；A 的新增命中正是 02 §4.2 M1/M5
指出的盲区。02 §4.2 建议「先做可证明的退化情况」，与本报告的 A/B 选择一致。

---

## 15. 依赖与交接（07 / 09 / 08）

### 15.1 给 07（合成负例与合法边界矩阵）

必须覆盖：

1. **A 正例**：静止 hazard 封死唯一地面路径（gate 在远侧）⇒ `PROVEN_UNPLAYABLE`，
   `PLAYABILITY_MECHANIC_PATH_BLOCKED`，witness 列 hazard 矩形与反事实。
   **A 合法边界**：同一 hazard 可跳过/可绕开 ⇒ `NO_PROVEN_BLOCKER`；巡逻版本（同几何但带 `motion`）
   ⇒ `INSUFFICIENT_EVIDENCE`，不报 error。
2. **B 正例**：全高 danger，`P < requiredMs` ⇒ `PROVEN_UNPLAYABLE`，`..._NO_SAFE_WINDOW`。
   **B 合法边界**：`P > requiredMs`（宽 idle）⇒ 不报；非全高激光 ⇒ `INSUFFICIENT_EVIDENCE`（不报 error）；
   spawn 在 danger 内 ⇒ 不报；等号 ± 1 帧 ⇒ 不报。
3. **E/F**：pickup/chest 在静止 hazard 内 ⇒ 不报（`INSUFFICIENT_EVIDENCE`）；在 hazard 后 ⇒ A 报；
   chest `range` 伸到安全侧 ⇒ 不报；danger 全高 + 目标深处 ⇒ B/F 报；安全口袋/宽 idle ⇒ 不报。
4. **D**：`solid+motion` ⇒ 不报 playability error；`coverage.mechanic=partial`；
   若静态原位导致不可达，空间层报普通 error，detail 点出 moving-platform 不支持。
5. **H**：多 danger 同步/不同步/有安全口袋 ⇒ 全部 `INSUFFICIENT_EVIDENCE`，不报 error。
6. **G**：gate 早到、收集后回 gate、单向坑+复位 ⇒ 归 05 的正负例，不在 04 断言。
7. **薄 hazard / 隧穿**：厚度 < `minHazardThickness` ⇒ 不报。
8. **probe 夹具**：明确标注非关卡，不能拿 `p0-02-*/09-probe-*` 当合法边界或历史误伤。

07 的边界纪律：误报比漏报贵；每个正例都要配「接近阈值但合法」的负例（ticket 18 的教训）。

### 15.2 给 09（最小实施方案与契约候选）

1. **A 的实现**：在 `auditReachability` 内部抽出一个可参数化的网格/BFS（`blocked` + 可选
   `hazardMask`），**不是**把 hazard 改成 solid；`freeAt` 只让 solid 提供支撑；`hop` 同时检查两张掩码。
   目标集用 03/05 解析后的 pickup + chest + gate；chest 用 `range`。
2. **反事实**：先跑 `base`（hazard 空气），再跑 `mask`；只有 base 可达 && mask 不可达才报；
   target 与 hazardMask 相交 ⇒ 抑制并记 coverage gap。
3. **B 的实现**：单 danger、全列切面、异侧、`requiredMs > idle + frameMargin`；其余 coverage gap。
   不要把它实现成「danger 当 solid」。
4. **几何来源**：hazard 用运行时物理体（帧尺寸/锚点），不用 `e.body`；danger/chest/solid 用 `e.box`；
   若 `body`/多帧尺寸导致不确定 ⇒ `INSUFFICIENT_EVIDENCE`。
5. **前置**：03 的 S6（walk/clearance）、S5（solid motion 静态原位）、S7（body 语义）、S1/M4（chest
   target/range）、S3（真实 overlap）；03/05 未落地前，A/B 可以先作为内部纯函数存在，但发布门只把它们
   当 `INSUFFICIENT_EVIDENCE`。
6. **放置**：`auditPlayability` 内部；`PROVEN_UNPLAYABLE` 进 `auditConfigPipeline.deterministic`，
   替换 `auditReachability`（framework §4.1/§6）；发布闸改调 `auditPlayability`（framework §4.2）；
   QA 继续 `auditReachability`（framework §4.3）。不要新增并列判据/重复报。
7. **契约**：不新增 `ConfigIssue.code`；不新增 QA judgment；三态 `PlayabilityVerdict` 是内部纯函数结果；
   若 09 要把它变成导出 schema，必须按 Q5 单列审批。
8. **测试**：A/B 正例、合法边界、coverage partial、无重复 error、`NO_PROVEN_BLOCKER` 不升级为可玩、
   deterministic 不触发模型重采样；A 的 4 个语料命中回归；B 的合成负例。
9. **回退**：A/B 各自独立开关；若 08 发现 A 的误伤，先抑制 A 的争议子类（例如 target-inside-hazard、
   薄 hazard、moving solid），保留 B；不要回退成「hazard 当空气」的所有旧行为。
10. **风险**：A 的历史 4 命中；B 无真实语料；C/D/E/F/H 仍是 partial；moving-platform 无运行时；
    `body` 语义未裁定。

### 15.3 给 08（历史语料重判）

- 先按 06 的口径排除/标注机制 probe 夹具（`p0-02-*/09-probe-*`、`intent-to-mechanics-*` 的 probe
  config 等），它们不是关卡。
- 对 A 的 3 个历史命中逐案记录：hazard 几何、玩家尺寸、`jumpSpan`、目标列表、witness；判断是
  「真阻断」「probe 夹具」「旧 schema 归一化误差」还是「03 S6 的低天花板误报」。不要用 agent 失败当
  不可玩证据；如果某份产物有**真人/真实 playtest 成功**，那是反证，必须记录。
- 真实语料 0 个 danger 关卡；B 没有历史重判样本，只能用 07 合成。不要把 `avoid-danger` probe 夹具当关卡。
- 记录 12 静止 / 19 moving hazard、1 个 pickup-hazard 相交、0 个 hazard `body` 覆盖、0 moving solid；
  这些是 06/08 的输入事实。

### 15.4 给 10（审批包）

- 本报告不提出任何契约形状变更；A/B 只新增内部纯函数与 `PlayabilityEvidence` 的字段。
- 若 09 决定把三态结果或 `coverage` 变成持久化/导出 schema，那是 Q5 的单列审批点，不在本报告批准。

---

## 16. 附：探针脚本

| 脚本 | 作用 |
|---|---|
| `research/04-composition-probe.mjs` | 语料中 hazard/danger/target 的几何统计与「静止 hazard 当 solid」的反事实 |
| `research/04-patrol-probe.mjs` | 把 moving hazard swept envelope 当 solid，量巡逻误报 |
| `research/04-hazard-mask-corpus.mjs` | 静止 hazard 当**非支撑禁区**，量历史语料新增 error |
| `research/04-synthetic-probe.mjs` | `last-train` 上的 A/B/D/E 合成方向（solid vs 禁区 vs danger as solid） |
| `research/04-hazard-mask-probe.mjs` | 静止 vs 巡逻、48px vs 全高、pickup-in-hazard 的禁区模型对照 |

全部只读、零付费、无生产代码修改；输出只到 stdout（可重定向到 `/tmp`）。
