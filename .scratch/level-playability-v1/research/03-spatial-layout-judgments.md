# 空间布局候选判据（03）

- **Date**：2026-11-05
- **Baseline**：`main` @ `fa17c14`；本票工作树只多了 `.scratch/level-playability-v1/**` 的 docs / 脚本。
- **Nature**：只读研究。未修改生产代码、测试、fixture、契约、ticket、map；未 commit / 建分支 / 推送；
  零模型调用、零生图、零站点重建。
- **冻结输入**：[`framework.md`](../framework.md)（§0–§10，逐字约束）、
  [`rulings-2026-11-04.md`](../rulings-2026-11-04.md)、
  [`02-capability-gap-audit.md`](02-capability-gap-audit.md)（事实基线，不重做全量审计）。
- **输入边界**：只读 `(GameConfig, AssetPackManifest) + FixedRuntimeProfile`。不读 `GameDesignSpec`
  （`levels[].layout` 是 `z.string()`，`packages/contracts/src/game-design.ts:176-188`）、不读 viewport、
  不读 playtest、不读设计散文。
- **证据级别**：E1 = `file:line`；E2 = 既有测试名 + 断言；E3 = 零付费只读探针（命令、退出码、路径、计数）。
- **探针**：
  - `.scratch/level-playability-v1/research/03-spatial-probes.mjs`（合成正/负例，退出码 0）
  - `.scratch/level-playability-v1/research/03-corpus-spatial.mjs`（历史语料只读估算，退出码 0）

---

## 0. 结论速览

| # | 候选 | 判据 id | 分类 | 语料新增 error | 依赖 |
|---|---|---|---|---|---|
| 1 | chest 作为必需目标（含 `range`） | `PLAYABILITY_SPATIAL_CHEST_UNREACHABLE` / `..._CHEST_BLOCKED` | **deterministic error** | **0**（02：53 chest / 5 唯一 config，0 不可达；03 探针 0） | 无（AABB + 静态） |
| 2 | 真实盒重叠替换 `covers` | 无独立 id；强化 #1/#3/既有 pickup/gate | **deterministic correction**（模型原语） | **0** | 标称尺寸 = 帧尺寸（需写入 profile） |
| 3 | 完全埋进实心体的目标 | `PLAYABILITY_SPATIAL_{PICKUP,CHEST,GATE}_BLOCKED` | **deterministic error** | **0** | 同 #2 |
| 4 | 出生点埋进 terrain | `PLAYABILITY_SPATIAL_SPAWN_IN_TERRAIN` | **deterministic error（窄口径）**；纯盒重叠为 **observation / INSUFFICIENT** | **0**（纯盒重叠会误伤 11/20） | spawn 分离语义（profile 新增） |
| 5 | 出生点卡在 solid | 既有 `auditGameConfig`（`player.at`） | 既有 error，**不新增** | 0 | 无 |
| 6 | 出生点无落脚点 / 缺地板 | `PLAYABILITY_SPATIAL_SPAWN_NO_FOOTHOLD` | **INSUFFICIENT_EVIDENCE**（coverage-gap） | 0（不产 error） | 掉出世界语义（02 S8） |
| 7 | 世界边界 / 左·上探出 | 既有 `inWorld` + site warning | **不新增**；观察 | 0 | 无 |
| 8 | 走路 / 净空边 | 无独立 id；模型原语 | **deterministic correction** | **0 new / 0 fixed**；02 probe F 2→0 | 无 |
| 9 | moving solid 静态化 | 无独立 id；模型原语 | **deterministic correction** | **0**（0 moving solid） | moving-platform 未实现（静态 profile） |
| 10 | 资源锚点 / 脚点几何 | 无独立 id；输入假设 | 观察 / 部分不可写 | 0 | 逐帧 atlas 尺寸不可见 |
| 11 | pickup/goal 的 `body` 被运行时忽略 | `PLAYABILITY_SPATIAL_TARGET_BODY_IGNORED`（观察）；失败折入目标 error | **observation / INSUFFICIENT** | **0**（0 覆盖） | `body` 运行时语义未定（02 S7） |
| 12 | 沟宽 / 台阶高 / 走廊宽 | 既有 reachability + warning | **不新增** | 0 | 无 |
| 13 | 斜坡 / 非 AABB / 移动平台 / 设计↔config | — | **不可写 / INSUFFICIENT** | — | 需新 Runtime / 契约语义 |

**一句话**：03 真正新增的确定性 error 只有三类——**chest 不可取得**、**目标完全埋在实心体里**、
**出生点确实埋在 terrain（窄口径）**；其余四个候选都是**模型原语修正**（真实重叠、走路边、
moving solid 静态化、`body` 运行时几何），它们改变的是既有 `auditReachability` 的判定质量，
不新增并列判据。历史语料上三类新 error 合计 **0**。

---

## 1. 输入、几何原语与 FixedRuntimeProfile 补充

### 1.1 允许 / 不允许的输入（E1）

| 输入 | 用途 | 证据 |
|---|---|---|
| `config.world.size` | 搜索域、世界底不是地板 | `reachability.ts:46,103-114` |
| `config.terrain[]` | 不可见静态矩形 | `game-config.ts:237-241`（schema）；`scene.ts:51-52` |
| `config.entities[]` | `kind` / `at` / `asset` / `body` / `motion` / `range` / `strike` | `game-config.ts:109-127` |
| `config.player.at` / `move` | 出生点、手感参数 | `game-config.ts:194-202`；`playerMoveOf` `:272-273` |
| `config.objective.gate` | 胜利目标 id | `game-config.ts:227-231` |
| `manifest.assets[].size` / `anchor` | 玩家 / 实体盒子、脚点 | `assetpack.ts:170-180` |
| `manifest.assets[].animations` / `frames` | 不用于空间几何；仅引用族 | `assetpack.ts:151-160` |
| `FixedRuntimeProfile` | 静态 solid、无二段跳、无 kill plane、hazard 复位、viewport 不参与 | `framework.md` §2.2 |
| **不读** `GameDesignSpec` | `levels[].layout` 是自由文本，无坐标 | `game-design.ts:176-188`；`CONTEXT.md:491-498` |
| **不读** viewport | 运行时外壳用常量 `VIEWPORT` | `shell/entry.ts:65-84`；`draw.ts:15` |
| **不读** playtest | 试玩只作证据 | `rulings-2026-11-04.md` 特别边界 |

### 1.2 统一几何原语（03 建议的实现形状）

```text
pw, ph, pAnchor = manifest.player.size / anchor
solids = config.terrain
       ∪ { entityBox(e.at, e.body ?? size(e.asset), anchor(e.asset)) | e.kind == "solid" }   // motion 忽略（静态）

blocked[x][y] = ∃ s ∈ solids:
    x ∈ (s.x - pw/2, s.x + s.w + pw/2)  ∧  y ∈ (s.y, s.y + s.h + ph)          // 开区间：贴着不算撞
standable[x][y] = !blocked[x][y] ∧ y+1 ≤ H ∧ blocked[x][y+1]

foot(at) = ( at.x + (0.5 - ax)·pw , at.y + (1 - ay)·ph )                        // 与 reachability.ts:83-86 同式
playerBox(foot) = { x: foot.x - pw/2, y: foot.y - ph, w: pw, h: ph }

overlaps(a, b) = a.x < b.x+b.w ∧ a.x+a.w > b.x ∧ a.y < b.y+b.h ∧ a.y+a.h > b.y   // 严格 AABB
```

- **目标盒**：
  - `pickup` / `goal`：`entityBox(e.at, size(e.asset), anchor(e.asset))`——**运行时用帧尺寸，忽略 `e.body`**
    （`scene.ts:151-155,166-174`；`physics.add.existing(sprite, true)` 没有 `setSize(e.body)`）。
  - `chest`：`entityBox(e.at, e.body ?? size(e.asset), anchor(e.asset))` **再四边外扩 `range`**
    （`scene.ts:175-185,315-325`；`range` 缺省 0）。
  - `solid` / `danger`：`entityBox(e.at, e.body ?? size(e.asset), anchor(e.asset))`（运行时吃 `e.body`）。
- **轨迹边**（见 §3.8）：走路 1px 水平边、跳跃弧、下落弧（初始 `vy=0`、`|vx|≤speed`）。
- **覆盖**：目标被覆盖 ⇔ 存在某个可达状态或轨迹采样点，使 `playerBox(foot)` 与目标盒严格重叠。
- **BLOCKED**：目标的「可重叠脚点矩形」内没有任何 `blocked == 0` 的整数点（见 §3.3）。

### 1.3 FixedRuntimeProfile 建议新增的假设（不新增契约 schema，只进集中 profile）

> framework §2.2 已钉静态 solid、无二段跳、无 kill plane、hazard 复位、viewport 不参与。
> 03 的判据还依赖下面四条；**建议在 09 的单列 profile 里写明**，否则相关判据只能落 `INSUFFICIENT_EVIDENCE`。

| # | 假设 | 依据 / 风险 |
|---|---|---|
| P1 | **碰撞几何 = manifest 的标称 `size` + 资源级 `anchor`**；逐帧 atlas 的 `size` / `anchor` 不是允许输入。 | `assetpack.ts:170-180` 明写「各帧真实尺寸在 atlas JSON 里，这里只是标称尺寸」；若逐帧尺寸漂移，本报告所有盒判据不可靠。E1 |
| P2 | `body` 只在 `solid` / `chest` / `danger` 上被运行时消费；`pickup` / `hazard` / `goal` 上被忽略。 | `scene.ts:149-198`；`world.ts:175-189`；02 S7。E1 |
| P3 | chest 交互区 = 实体盒四边外扩 `range`；pickup / goal 交互 = 严格身体盒重叠；**不要求站在地面上**（飞行中碰到也算）。 | `scene.ts:315-325,151-174`。E1 |
| P4 | 出生点与静态几何重叠时，运行时由碰撞分离把玩家推出；**只有脚点低于地形顶面、且锚点无法解释、且玩家身体体积内没有可站立表面**时，才判为「埋进 terrain」。 | 03 语料证据：纯盒重叠 20 份唯一 config 里 11 份有重叠、10 份脚点在地形内，但锚点解释后埋葬量 ≤0.32px。见 §3.4。E3 |

> ⚠️ P1/P4 是本票发现的两个「不写就会误伤」的假设；P2 是 02 S7 的未决语义；P3 是 chest 判据的前提。
> 它们不改变 `GameConfig` / `AssetPackManifest` 的形状，只改变审计函数内部的集中假设。

---

## 2. 判据 id 与失败定位的公共规则

- id 形态：`PLAYABILITY_SPATIAL_<SUBJECT>_<FAILURE>`，`SUBJECT ∈ {PICKUP, CHEST, GATE, SPAWN}`，
  `FAILURE ∈ {UNREACHABLE, BLOCKED, NO_FOOTHOLD, IN_TERRAIN, BODY_IGNORED}`。
- 每个 id 在模块内的**封闭注册表**登记；**不导出为契约 schema**（framework §5.1、§3.5）。
- `PlayabilityEvidence` 字段：`judgmentId` / `target` / `detail` / `witness` / `coverage`，
  可选 `assetId` / `expected` / `actual`（framework §5.2）。
- `target` 沿用现有 `ConfigIssue.where` 格式：`entity "<id>"` / `player.at`。
- `witness.kind` 只用 framework 列的四种：`no-path` / `blocked` / `coverage-gap` / `count`。
- **不新增 `ConfigIssue.code`**：`CONFIG_ISSUE_CODES` 是闭集（`game-config.ts:315-317`）。
- **同一目标只产一条 error**：先判 `BLOCKED`（更强根因），否则 `UNREACHABLE`；
  如果 `auditGameConfig` 已对同一目标报 `inWorld`，建议抑制 playability 的同目标 error（见 §4）。

---

## 3. 候选判据逐条

### 3.1 chest 作为必需目标

**类型**：确定性 error（新增 target）。

#### 1) 算法 / 输入 / 输出

- **输入**：`config.entities.filter(kind === "chest")` 的 `at` / `asset` / `body` / `range`；
  `manifest` 的 `size` / `anchor`；`config.player` 的 `size` / `anchor` / `move`；`config.terrain`；
  `config.world.size`。
- **目标盒**：`chestRect = expand(entityBox(at, body ?? size, anchor), range ?? 0)`，四边各外扩 `range`
  （`scene.ts:321-322`：`left = box.x - range; right = box.x + box.w + range; top/bottom` 同理）。
- **判定**：把 `chest` 加入 §1.2 的 BFS target 集；覆盖 = 任一可达状态或跳跃/下落弧采样点使
  `playerBox(foot)` 与 `chestRect` 严格重叠。未覆盖时：
  - 若 `chestRect` 的可重叠脚点矩形内**没有** `blocked == 0` 的点 → `..._CHEST_BLOCKED`；
  - 否则 → `..._CHEST_UNREACHABLE`。
- **为什么是 error**：`pickupCount` 数 pickup + chest（`game-config.ts:264-268`），`tryWin` 要求
  `collected >= pickupCount`（`scene.ts:364-369`）。chest 不是奖励可选物；不可取得 = 凑不齐计数 = 不能赢。
  - ⚠️ 这条**不依赖**设计散文：config 没有 optional 字段，运行时把全部 pickup/chest 都算必需（02 C4）。
- **输出**：`PlayabilityEvidence[]`，一条 per chest。

#### 2) 判据 id 与失败定位

| 字段 | 值 |
|---|---|
| `judgmentId` | `PLAYABILITY_SPATIAL_CHEST_UNREACHABLE` / `PLAYABILITY_SPATIAL_CHEST_BLOCKED` |
| `target` | `entity "<chest-id>"` |
| `detail` | UNREACHABLE：「从出生点出发，用最宽能力上界也开不了这个宝箱（含 range 外扩 N px）」；BLOCKED：「宝箱的交互区完全落在实心体内，任何可达玩家盒都无法与它相交」 |
| `witness` | UNREACHABLE：`{ kind: "no-path", start: "spawn", reached: <count>, targetsReached: [...] }`；BLOCKED：`{ kind: "blocked", rect: chestRect, solids: [...] }` |
| `coverage` | `{ spatial: "checked", mechanic: "...", completion: "..." }`（spatial 维由 03 填；后两维由 04/05） |
| `assetId` | `e.asset`（可选） |
| `expected` / `actual` | `expected`: `overlap reachable`；`actual`: `no reachable overlap` |

#### 3) 误报边界

- **chest 埋在 solid 里但 `range` 够到外面**：用外扩后的 `chestRect`，不报。E3 合成
  `chest-inside-luggage-range0` → error，`range30` → 无 error。
- **chest 只能飞行中碰到**：弧线采样点也做重叠检查，不要求站得住。运行时 chest 触发只要求玩家盒相交
  （`scene.ts:315-325`），落地不是前提。
- **chest 隔着墙但 `range` 穿过墙**：运行时确实会隔墙触发；判据不要求视线。这不是误报，是运行时语义。
- **chest 的 `body` 覆盖**：运行时 honor `e.body`（`world.ts:175-189` + `scene.ts:175-185`），判据也用
  `body ?? size`；不会把「声明了更大交互盒」的 chest 误判成不可达。
- 唯一已知误报源：**P1 的逐帧尺寸漂移**。如果实际帧盒比标称盒大，判据可能报得比运行时严；
  在 profile 未钉 P1 前，这条判据的 coverage 只能是 `partial`。

#### 4) 语料影响

- 02：**53 个 chest 实例 / 34 个配对文件 / 5 份唯一 config**；把 chest 临时当 pickup 目标探测，
  **0 个不可达**（02 §7.3.2）。
- 03 探针（20 份唯一配对 config）：**6 个 chest、0 个 error**；其中 1 个 chest 带 `range:24`。
- **预计新增 error = 0**。

#### 5) 分类

**deterministic error**。

#### 6) 依赖

无（轴对齐、静态、无时序）。依赖 P1（标称尺寸 = 帧尺寸）与 P3（range 外扩）写进 profile。

#### 7) 与既有审计的关系

- **扩展，不是并列**：把 chest 加入 `auditReachability` 的 target 集（`reachability.ts:124-129` 今天
  只有 pickup + gate）。不新增第二个 BFS。
- **无重复**：今天没有任何判据以 chest 为目标，不会与 `auditReferences` 的引用族 / `auditGameConfig`
  的 HUD 槽位 / 机制覆盖重复。
- **发布闸**：若新逻辑只在 `auditPlayability` 里、不在 `auditReachability` 内，`publish-gate.ts:140`
  的 standalone 重跑覆盖不到（02 §5.2 第 2 条）。09 必须二选一：并进 `auditReachability`，或让 gate
  改调 `auditPlayability`（framework §4.2 推荐后者）。

---

### 3.2 真实盒重叠替换 `covers`

**类型**：模型原语修正（deterministic correction），**不是独立判据**。

#### 1) 算法 / 输入 / 输出

- **今天**（`reachability.ts:130-137`）：

```ts
if (!covered[i] && Math.abs(x - t.at.x) <= pSize.w && Math.abs(y - t.at.y) <= pSize.h) covered[i] = true;
```

  即以**脚点**到**目标锚点**的切比雪夫式距离（各自阈值 `p.w` / `p.h`）≤ 一个玩家宽/高就算「够到」。它不是盒重叠：
  - 会把「站在目标旁边一个身位、根本没碰到」算成够到（S3 的漏报）；
  - 对宽于玩家的目标（`T.w > p.w`，如大 chest / goal）反而可能漏掉边缘的真正盒重叠（假阴性）。
- **改为**：`playerBox(foot)` 与目标盒**严格 AABB 重叠**；在 BFS 状态、跳跃弧采样点、下落弧采样点
  都调用同一个 `coverAt(foot)`。
- **输入字段**：`manifest` 的 `size` / `anchor`；`config.player`；`config.entities[].at` / `asset` /
  `body` / `range`；`config.world.size`；`config.terrain`。
- **输出**：不产生独立 `ConfigIssue`；改变 §3.1 / §3.3 / 既有 pickup+gate 目标的 `covered` 判定，
  从而改变 `..._UNREACHABLE` / `..._BLOCKED` 的产出。

#### 2) 判据 id 与失败定位

- **无独立 id**。它强化的是：
  - `PLAYABILITY_SPATIAL_PICKUP_UNREACHABLE` / `..._PICKUP_BLOCKED`
  - `PLAYABILITY_SPATIAL_CHEST_UNREACHABLE` / `..._CHEST_BLOCKED`
  - `PLAYABILITY_SPATIAL_GATE_UNREACHABLE` / `..._GATE_BLOCKED`
- `witness` 里的 `blocked` / `no-path` 由新的重叠判定给出；不再用「一个身位内」措辞。

#### 3) 误报边界

- **目标浮空、只能飞行中碰到**：弧线采样点做重叠，仍算可达；不要求落地。合法设计（浮空 pickup /
  gate）不会被误伤。
- **目标嵌入实心体**：新判定会从「旁边覆盖」变成「无重叠」→ 由 §3.3 的 `BLOCKED` 报出。这是**修漏报**，
  不是误报；E3 合成 `goal-inside-luggage`：当前 `[]`，新版 `entity "signal"`。
- **目标盒与玩家盒只差 1px / 贴边**：严格重叠要求有正面积交集；与 Phaser 的 `overlap` 语义一致。
  `BLOCKED` 的「无自由脚点」检查建议再留 1px 安全边（见 §3.3），避免贴边误判。
- **逐帧尺寸 / 锚点漂移**：P1 未钉时，标称盒可能与实际帧盒不同；这是 `partial` coverage，不是设计误报。
- **`body` 覆盖**：pickup / goal 用标称盒（运行时忽略 `body`），见 §3.11；用 `body` 会漏报。

#### 4) 语料影响

- 02：`auditReachability` 在 96 个配对 / 20 份唯一 config 上 **0 error**。
- 03 探针：在 20 份唯一配对 config 上，严格重叠 + 走路/下落 + chest + 静态 motion 合计
  **0 new / 0 fixed**（`03-corpus-spatial.mjs`，退出码 0）。
- **预计新增 error = 0**；新增的是合成负例（埋进实心体）的命中。

#### 5) 分类

**deterministic correction（模型原语）**；不单独产生 error。

#### 6) 依赖

P1（标称尺寸 = 帧尺寸）。若逐帧尺寸/锚点不可知，严格重叠只能作为**上界模型的一部分**；
对「埋在实心体」的 BLOCKED 判定需要 P1 才敢报 error。

#### 7) 与既有审计的关系

- **替换而非叠加**：改 `reachability.ts` 内部的 `covers`，不新增第二套「更严格 overlap」判据。
  framework §7.1 第 4 条明确要求「替换而非叠加」。
- **既有测试要改**：`packages/contracts/tests/reachability.test.ts` 的
  「⚠️ **一个身位之内就算够到** —— goal 埋在行李堆正中间（站不进去）也**不报**」这条
  （E2，`expect(reach(c)).toEqual([])`）是**故意钉旧宽松边界**的；03 的规格要求它翻面。
  09 实施时必须把它改成「BLOCKED 报一条」，并保留一条合法边界（目标在实心体**旁边**、盒有暴露）不报。
- **QA 继承**：`qa/src/gameplay.ts:80` 继续调 `auditReachability`；函数内部改严后 QA standalone 自动继承，
  `QA_JUDGEMENTS` 仍 7 条（framework §7.3）。

---

### 3.3 完全埋进 / 被实心体封住的目标（BLOCKED）

**类型**：确定性 error（新增 failure 变体，与 §3.2 同一模型）。

#### 1) 算法 / 输入 / 输出

- 目标盒（pickup / goal 标称；chest 含 `range`）为 `T`。
- **可重叠脚点矩形**：

```text
OverlapFoot(T) = {
  x ∈ ( T.x - pw/2 , T.x + T.w + pw/2 ),
  y ∈ ( T.y        , T.y + T.h + ph   )
}
```

  因为玩家盒 `[x - pw/2, x + pw/2] × [y - ph, y]` 与 `T` 严格重叠的充要条件就是上式（开区间）。
- **BLOCKED(T)** ⇔ `OverlapFoot(T)` 内不存在整数 `(x,y)` 使 `blocked[x][y] == 0` 且 `0≤x≤W`、`0≤y≤H`。
  建议检查时把矩形外扩 1px（安全边），避免贴边/取整把「刚好能碰到」判死。
- **UNREACHABLE(T)** ⇔ 不是 BLOCKED，但 BFS 的覆盖集里没有 `T`。
- **输入**：同 §3.1 / §3.2。
- **输出**：`BLOCKED` 优先于 `UNREACHABLE`，每个目标一条。

#### 2) 判据 id 与失败定位

| 字段 | 值 |
|---|---|
| `judgmentId` | `PLAYABILITY_SPATIAL_PICKUP_BLOCKED` / `PLAYABILITY_SPATIAL_CHEST_BLOCKED` / `PLAYABILITY_SPATIAL_GATE_BLOCKED` |
| `target` | `entity "<id>"` |
| `detail` | 「这个目标的交互区完全落在实心体内：玩家盒在任何一个不撞墙的位置都无法与它相交」 |
| `witness` | `{ kind: "blocked", rect: T, overlapFoot: OverlapFoot(T), solids: [覆盖该矩形的 Rect...] }` |
| `coverage` | 同 §3.1 |
| `expected` / `actual` | `expected`: `∃ free foot ∈ OverlapFoot(T)`；`actual`: `∅` |
| `assetId` | `e.asset`（可选） |

#### 3) 误报边界

- **目标部分暴露**：`OverlapFoot` 内存在自由点 → 不报 BLOCKED；若 BFS 仍到不了，报 UNREACHABLE。
  这是对的：玩家可能从暴露面碰到。
- **chest 的 `range`**：外扩后可能伸进自由空间 → 不报。E3：`range0` → BLOCKED，`range30` → 不报。
- **目标在实心体旁边但盒完全贴住表面**：如果 `OverlapFoot` 内有自由点（哪怕只是贴着），不报 BLOCKED；
  1px 安全边进一步避免「刚好贴边」误杀。
- **目标在密封空腔里**：空腔内部自由，目标是 UNREACHABLE 而不是 BLOCKED；这两种根因要分开
  （`no-path` vs `blocked`），不要混。
- **P1 逐帧尺寸漂移**：同 §3.2。
- **完全被 terrain（不是 solid 实体）包围**：同样成立；`solids` 包含 terrain。

#### 4) 语料影响

- 03 探针：20 份唯一配对 config、92 个目标（pickup + chest + gate），**0 个 BLOCKED**。
- 02：96 配对 / 20 唯一 config，reachability 0 error，且 02 的「goal 埋 solid」是合成探针，不是语料。
- **预计新增 error = 0**。

#### 5) 分类

**deterministic error**。

#### 6) 依赖

P1；AABB / 静态。无时序、无机制依赖。

#### 7) 与既有审计的关系

- **替换旧漏报**：今天的 `covers` 会把埋在 solid 里的 goal/pickup 从旁边「覆盖」掉
  （E3 probe D：`goalInsideSolid.reachabilityWhere = []`；E2 同名测试）。新判据在同一目标上只产一条，
  用 BLOCKED 作为 `witness`，不额外产 UNREACHABLE。
- **与 `auditGameConfig.inWorld`**：如果目标同时越界（远端），`inWorld` 已报 error；建议 playability
  抑制同一目标的重复 error，避免同一 config 两条不同根因的噪声（§4）。
- **与 05**：05 的「必需 chest 不可取得」必须消费 03 的 chest BLOCKED/UNREACHABLE，不要再产一条
  completion error（同一 target、同一根因）。

---

### 3.4 出生点埋进 terrain（以及 spawn-in-solid 的归属）

**类型**：确定性 error（窄口径）；纯盒重叠版本是 **observation / INSUFFICIENT_EVIDENCE**。

#### 1) 算法 / 输入 / 输出

**关键证据（E3）**：20 份唯一配对 config 里，**11 份**玩家盒在出生点与 terrain 有重叠，**10 份**脚点
落在地形矩形内；但把「资源锚点预期的脚点偏移」扣掉后，**埋葬量全部 ≤ 0.32px**，即全部是锚点语义
（玩家 anchor 不是 1，`at` 是锚点落点而不是脚点）造成的正常嵌入。另一个极端的 108px「盒子重叠」
是出生点与左侧**竖墙**的横向重叠，脚点并不在墙内，物理会把玩家推出，关卡正常。

因此：

```text
playerBox = entityBox(player.at, playerSize, playerAnchor)
foot = ( playerBox.x + playerBox.w/2 , playerBox.y + playerBox.h )
for t in config.terrain:
  if foot.x ∈ (t.x, t.x + t.w) ∧ foot.y ∈ (t.y, t.y + t.h):
      depth       = foot.y - t.y
      anchorOffset = (1 - playerAnchor.y) · playerSize.h
      burial      = depth - anchorOffset
      nearbyStand = ∃ standable (x,y): |x - foot.x| ≤ pw/2 ∧ foot.y - ph ≤ y ≤ foot.y
      if burial > 1 ∧ !nearbyStand:
          error
```

- **输入**：`config.player.at`、`config.terrain[]`、`manifest` 的玩家 `size` / `anchor`、`config.world.size`。
- **输出**：`PlayabilityEvidence`（error）或什么都不产。
- **解释**：
  - `anchorOffset` 把「作者按锚点语义写的 `at`」与「玩家的脚」对齐；last-train（2.4px）、
    visual-design（7.68px）都归零。
  - `nearbyStand` 要求玩家身体体积内没有可站立表面；浅埋/锚点嵌入不算，因为运行时碰撞分离会把玩家
    放到最近表面。只有「深埋且附近没有表面」才判 error。
- **E3 合成结果**（`03-spatial-probes.mjs` → `spawnDx`，退出码 0）：

| 场景 | foot | burial | nearbyStand | error |
|---|---|---|---|---|
| last-train（anchor .95，at 250，top 250） | (40,252) | **-0.4** | true | **false** |
| 02 probe E（at 245，top 240） | (40,247) | **4.6** | true | **false**（浅埋，观察） |
| 深埋（top 100，at 200） | (40,202) | **99.6** | false | **true** |
| 1920 语料型横向墙（at 248，top 250，墙 0..20） | (40,250) | **-2.4** | false | **false**（`terrainHit=false`） |

  注：02 probe E 的 7px 浅埋在推荐口径下**不报 error**，因为地形顶面就在玩家身体体积内；
  这是本报告与 02 S4 的措辞差异，需 07/09 确认（02 把它标成缺口，但没有证明关卡不可玩）。
- **特别说明**：**不要用「玩家盒 vs terrain 盒有任何重叠」**作为判据。那会在 11/20 份唯一 config 上
  误报（见 §5）。

#### 2) 判据 id 与失败定位

| 字段 | 值 |
|---|---|
| `judgmentId` | `PLAYABILITY_SPATIAL_SPAWN_IN_TERRAIN` |
| `target` | `player.at` |
| `detail` | 「出生点的脚点在 terrain[i] 内、比锚点预期深 `burial`px，且玩家身体范围内没有可站立表面」 |
| `witness` | `{ kind: "blocked", foot, terrain: Rect, burial, nearestStandable: null }` |
| `coverage` | 同 §3.1 |
| `expected` | `burial ≤ 1` 或 `∃ standable ∈ body volume` |
| `actual` | `burial = X, no standable` |

#### 3) 误报边界

- **last-train / visual-design 型锚点嵌入**（2.4 / 7.68px）：不报。E3 语料 10/10 通过。
- **横向卡在竖墙里**（108px 盒重叠、脚点不在墙内）：不报。E3 语料唯一一例通过。
- **出生点在 solid 实体里**：**不归本条**；既有 `auditGameConfig` 报
  （`game-config.ts:553-561`，`inside(config.player.at, boxOf(...))`）。framework §7.2 已钉归属。
- **出生点在半空、下方有地面**：脚点不在 terrain 内；玩家下落；不报。
- **出生点在很厚的地形块中间、但顶面仍在玩家身高以内**：`nearbyStand` 找到顶面 → 不报（物理可分离）。
  这是保守侧；只有顶面超过玩家身高/完全封死才报。
- **P4 未写入 profile**：运行时分离行为没有集中定义；在这种情况下，本条只能落 `INSUFFICIENT_EVIDENCE`，
  不能硬报。见 §6 的升级问题。

#### 4) 语料影响

- 纯盒重叠口径：**11/20 份唯一 config 会新增 error（全部是误报）**。
- 锚点感知口径（`burial > 1`）：**0**；`burialGt1` 计数 0；最大 burial 0.32px。
- 02 probe E（`player.at.y = 245`、terrain top 240、anchor .95）算得 `burial ≈ 4.6px`；
  若只要求 `burial > 1`，会报；若再加 `nearbyStand`（顶面 240 在脚点 247 上方 7px，玩家高 48
  内含）则**不报**。03 推荐加 `nearbyStand`，把 02 的 7px 浅埋降为观察。
- 合成长埋（top 100、at 200）算得 `burial ≈ 99.6px`、`nearbyStand=false` → **error**；
  这证明窄口径仍能响（E3 `spawnDx`）。
- **预计新增 error = 0**（推荐口径）。

#### 5) 分类

- 推荐口径：**deterministic error**（framework §7.2 的归属），但必须带 P4 的 profile 假设；
  没有 P4 → **INSUFFICIENT_EVIDENCE**。
- 纯盒重叠/任意浅埋：**observation**（不是 error）。

#### 6) 依赖

- **依赖 P4**（出生点碰撞分离语义）。这不是新契约，是 profile 假设；若 Runtime 行为改变，必须重新评估。
- 不依赖斜坡 / 非 AABB / 时序。

#### 7) 与既有审计的关系

- **归属**：framework §7.2 把「出生点埋在 terrain」判给 `auditPlayability`，把「出生点卡在 solid」
  留给 `auditGameConfig`。本票遵守这个分界，**不把 terrain 加进 `auditGameConfig` 的 solids 列表**
  （那会落进 resampleable，重抽 config 3 发，02 §5.1 已明确建议放 deterministic）。
- **不重复**：`auditGameConfig` 只遍历 `kind:"solid"` 实体（`game-config.ts:554`），不看 terrain；
  新判据只看 terrain。两者 target 都是 `player.at`，但根因不同。若同一出生点同时命中两者，
  建议只保留 `auditGameConfig` 的 solid 错误（先发生的硬失败），playability 抑制 terrain 重复。
- **与 02 probe E**：02 把它标为「可写缺口」；03 的证据显示 7.4px 的浅埋是锚点语义、运行时可分离，
  所以「可写」不等于「可报 error」——需要 07/09 确认口径（§6）。

---

### 3.5 出生点无落脚点 / 缺地板 / 世界底

**类型**：**INSUFFICIENT_EVIDENCE / coverage-gap**（不产 error）。

#### 1) 算法 / 输入 / 输出

- 尝试从出生点 seed BFS（当前 `reachability.ts:177-198`：foot ± pw、`y ≥ foot.y - ph` 的所有 standable）。
- seed 为空 → 不产 `ConfigIssue`；产一条 `PlayabilityEvidence`：

```text
judgmentId = PLAYABILITY_SPATIAL_SPAWN_NO_FOOTHOLD
target     = player.at
detail     = 「出生点附近没有可站立表面；当前 profile 没有定义掉出世界是否失败/复位」
witness    = { kind: "coverage-gap", missing: "spawn-support" }
coverage   = { spatial: "partial", mechanic: ..., completion: ... }
```

- **可选更精确的 seed**（推荐 09 实现）：从出生点 foot 出发，按「初始 `vy=0`、`|vx|≤speed`」的下落弧
  枚举所有可达 standable；这比当前 ±pw 的启发式更接近真实，也能区分「附近没有」与「横向漂移能到」。
- **输入**：`config.terrain` / `config.entities`（solid）、`config.player.at`、玩家几何、`move`、`world.size`。
- **输出**：coverage-gap，不产 error。

#### 2) 判据 id 与失败定位

- `PLAYABILITY_SPATIAL_SPAWN_NO_FOOTHOLD`
- `target = player.at`；`witness = { kind: "coverage-gap", missing: "spawn-support" }`。
- 不映射到 `ConfigIssue`（framework §7.1：只有 `PROVEN_UNPLAYABLE` 映射 error）。

#### 3) 误报边界

- **不报 error** 本身消除了误报；风险是**漏报**：出生点在半空、下方无地板，玩家掉出世界后无法回来，
  但若目标恰在下落路径上，仍可能完成。这个语义未定义（02 S8），所以只能 `INSUFFICIENT_EVIDENCE`。
- **不要把「world 底」当地板**：`reachability.ts:103-114` 已明确世界底不是地板；否则每条沟都会变成可通行
  （02 的实测教训）。
- **不要把「无 terrain」等同于不可玩**：solid 实体也可以是地板；BFS 的 solids 包含两者。

#### 4) 语料影响

- 03 探针：20 份唯一配对 config **0 份** no-seed。
- 02：96 配对 / 20 唯一 config，reachability 0 error；「出生点附近无落脚点」是既有测试里的合成场景
  （`reachability.test.ts`「出生点附近没有任何落脚点 ⇒ 一条都不报」），不是历史语料。
- **不新增 error**；只把今天的「静默返回」变成显式 coverage 缺口。

#### 5) 分类

**INSUFFICIENT_EVIDENCE**（spatial coverage = `partial`）。

#### 6) 依赖

- **依赖 S8 语义**：掉出世界是否算失败 / 是否复位 / 是否有 kill plane。framework §2.2 已说「kill plane
  不存在；掉出世界不判死」，但没有说「掉出后是否还能完成」。在这个语义补齐前，不能把 no-foothold
  升成 `PROVEN_UNPLAYABLE`。
- 若未来 profile 定义「掉出世界 = 失败」，可以写：
  `SPAWN_NO_FOOTHOLD ∧ 所有必需目标不能在下落轨迹上被覆盖 ⇒ PROVEN_UNPLAYABLE`。本票不写。

#### 7) 与既有审计的关系

- **修正今天的静默**：`reachability.ts:195-197` 在 seed 为空时 `return out`，即「一条都不报」。
  在 `ConfigIssue[]` 的世界里这等于「没发现问题」；在 `PlayabilityVerdict` 里必须映射为
  `INSUFFICIENT_EVIDENCE`，不能映射为 `NO_PROVEN_BLOCKER`（framework §0 第 3 条、§3.3）。
- **不重复**：不产 `ConfigIssue`，所以不与 `auditGameConfig` 的 spawn-in-solid / inWorld 重复。
- **同族**：玩家资源解不到（`reachability.ts:56-57` 直接 return）也属于 coverage-gap；
  建议统一成 `coverage.spatial = partial`，不要静默当成「通」。

---

### 3.6 世界边界 / 左·上探出

**类型**：不新增判据；既有检查 + 观察。

#### 1) 算法 / 输入 / 输出

- **远端（右/下）越界**：`auditGameConfig.inWorld` 对 terrain / entity / player 盒检查
  `b.x + b.w > W || b.y + b.h > H` → error（`game-config.ts:533-539`）。
- **近端（左/上）探出**：`site.ts:127-141` 的 `pokeOut` 只报 warning；理由是有意的「从画面外伸进来的墙 /
  半截装饰」。
- **玩家运行时没有 `collideWorldBounds`**（`scene.ts:69-73` 只 clamp 相机；`scene.ts:79-96` 只设速度）。
  玩家可以走到 `x<0` / `y<0`；掉到 `y>H` 则再也回不来，但没有 kill/reset（02 S8）。
- **输出**：无新 evidence。

#### 2) 判据 id 与失败定位

- **无新 id**。远端越界继续用 `auditGameConfig` 的 `where`（`terrain[i]` / `entity "<id>"` / `player.at`）。
- 近端探出是观察（site warning），不参与 verdict。

#### 3) 误报边界

- 如果要把「左/上探出的目标」判成不可达，会误伤「从画面外伸进来的实体」这一合法设计；
  `pokeOut` 的 warning 已经明确说这是有意的。所以不写 error。
- **当前 BFS 把搜索域 clamp 在 `[0,W] × [0,H]`**（`reachability.ts:170,203-204`）。如果目标盒因锚点向左/上
  探出，而玩家在运行时可以走出世界去碰它，BFS 可能误报 UNREACHABLE。语料 0 例；建议：
  - 若存在 `box.x < 0 || box.y < 0` 的目标，`coverage.spatial = partial`，或把搜索域向负方向扩一个玩家身位；
  - 不把这种情况写成 error。

#### 4) 语料影响

- 02：`auditGameConfig` 49 条 error 全部是 chest 单帧 / 缺 gate，**没有 inWorld**；warning 0。
- 03 探针：20 份唯一配对 config，0 个远端越界；0 个左/上探出目标导致 UNREACHABLE。
- **预计新增 error = 0**。

#### 5) 分类

**不新增**；近端探出 = **observation**；BFS 搜索域限制 = **coverage/INSUFFICIENT**（仅当出现探出目标）。

#### 6) 依赖

无。

#### 7) 与既有审计的关系

- **coexist**：远端越界已由 `auditGameConfig` 报；不要在 `auditPlayability` 里再报一次。
- 如果同一目标既越界又不可达，建议抑制 playability 的同目标 error（§4）。

---

### 3.7 台阶高 / 沟宽 / 走廊宽（既有判据的边界，不新增）

**类型**：不新增判据；既有 `auditGameConfig` warning + `auditReachability`。

#### 1) 算法 / 输入 / 输出

- **沟宽 vs `jumpSpan`**：已由 `auditReachability` 的跳跃弧覆盖；`jumpSpan` 是同一公式
  （`game-config.ts:283-289`；`reachability.ts:139-175`）。不要新增一条「沟宽 > 66px」的判据：
  - 落点更低时跳跃跨度更大（E2：`jumpSpan(DEFAULT_PLAYER_MOVE,150) ≈ 94.6`）；
  - 一段沟是否「必须跨过」需要 BFS，不是单点阈值能判的。
- **台阶高 vs `maxJumpHeight`**：既有 warning（`game-config.ts:563-578`），只对「一条平地面 + 若干台阶」
  （`groundY = max(terrain[].y)`）成立；不升级、不新增。
- **走廊宽 vs 玩家宽**：已由 §1.2 的 `blocked` 栅格编码。竖向窄缝没有 standable 状态，
  目标自然 UNREACHABLE；横向走廊的净空由 `ph` 编码。没有独立的「走廊宽」判据。
- **输出**：无新 evidence。

#### 2) 判据 id 与失败定位

- 无新 id；台阶 warning 沿用 `entity "<id>"` + 「台阶高 ...px」；沟宽/走廊由
  `..._UNREACHABLE` / `..._BLOCKED` 的 `no-path` / `blocked` witness 表达。

#### 3) 误报边界

- **台阶 warning 不升级**：framework §7.3 明确「可能正是设计」。如果某个目标因为台阶高而不可达，
  reachability 会报 UNREACHABLE；warning 与 error 可以并存（不同 `where` / message）。
- **沟宽不是绝对阈值**：落点高度、助跑、可踩平台都会影响；用 BFS，不用单点阈值。
- **走廊「窄但可走」**：玩家 width/height 的 AABB 已经编码；低天花板误报由 §3.8 修。

#### 4) 语料影响

- 02：`auditGameConfig` warning 0；reachability 0 error。
- **0 new**。

#### 5) 分类

**不新增**；既有 warning 保持 **observation**（不参与 verdict）。

#### 6) 依赖

无（AABB / 静态）。

#### 7) 与既有审计的关系

- **coexist**：不替换、不升级、不读取 warning 来推断 verdict（framework §7.1 第 3 条）。
- 新的走路边会**减少**「低天花板导致目标够不到」的误报，但不会改变台阶 warning 的语义。

---

### 3.8 走路 / 净空边（修低天花板误报）

**类型**：模型原语修正（deterministic correction），**不是独立判据**。

#### 1) 算法 / 输入 / 输出

今天的 BFS 只建**跳跃弧**边（`reachability.ts:154-175`）。一条几何净空足够、但头顶低于跳跃弧的走廊，
任何跳跃都会撞天花板，于是两端目标被误报「够不到」（02 probe F：`p` 与 `gate` 两条）。修法：

```text
边集 = 跳跃弧（保留）
     ∪ 走路边： (x,y) → (x±1, y)   若 standable[x±1][y]
     ∪ 下落弧： (x,y) → (x',y')    y' > y
                  ∧ |x' - x| ≤ speed · sqrt(2(y'-y)/g)
                  ∧ 抛物线下落采样点都 !blocked
```

- **走路边**只沿同一 `y`：不允许自由爬台阶；1px 高的台阶仍需跳跃。
- **下落弧**从 standable 状态出发，初始 `vy=0`、`|vx|≤speed`；这是玩家从平台边缘走下来的真实轨迹。
- 跳跃弧保留：从 standable 状态起跳（运行时只有 `blocked.down` 才能跳，`scene.ts:90-91`），
  所以 BFS 状态仍然只从 standable 出发。
- **输入**：`blocked` / `standable` 栅格、`move`、`world.size`。
- **输出**：不产独立 error；扩大可达集，改变所有 `..._UNREACHABLE` 的结果（只会减少 error）。

#### 2) 判据 id 与失败定位

- **无独立 id**。它服务于 `..._UNREACHABLE` / `..._BLOCKED` 的 `covered` 判定。
- 如果保留今天的低天花板误报，任何 `PLAYABILITY_SPATIAL_*_UNREACHABLE` 都不可信；所以它是
  **前置修正**，不是可选优化。

#### 3) 误报边界

- **走路边只沿同一 y**：不会把 1px 台阶当可走；不会凭空增加高度。
- **下落弧要求 y' > y**：不从低处「掉」到高处。
- **天花板低于玩家身高**：`blocked` 栅格没有 standable，目标仍 UNREACHABLE；这是正确的。
- **薄墙/1px 缝隙**：`blocked` 用开区间，贴着不算撞；1px 缝隙的玩家盒会撞，正确。
- **采样误差**：跳跃/下落弧按 60Hz 采样，可能漏掉极薄（<1.5px）的碰撞体；这是上界模型的一部分，
  误差方向是「更宽松」，不会把可玩关卡判死。

#### 4) 语料影响

- 02：96 配对 / 20 唯一 config，reachability **0 error**；所以语料上走路边 **0 fixed / 0 new**。
- 03 探针：20 份唯一配对 config **0 new / 0 fixed**。
- 02 probe F（合成低天花板）：当前 `["entity \"p\"", "entity \"gate\""]`，新版 **`[]`**（`03-spatial-probes.mjs`
  `low-ceiling` 场景）。这是**修复 2 条误报**。
- 既有正/负例全部保持：gap-200 报 4、gap-40 不报、wall-100 报 3、wall-40 不报、pickup-120 报 1、
  pickup-50 不报、baseline 不报（E3）。

#### 5) 分类

**deterministic correction（模型原语）**；不独立产 error。

#### 6) 依赖

- 依赖 FixedRuntimeProfile 的「无加速度 / 无摩擦 / 水平速度恒定 / 只有落地才能跳」；
  `scene.ts:79-96` 是实测语义。
- 不依赖斜坡 / 非 AABB / 时序。

#### 7) 与既有审计的关系

- **替换边集**，不新增并列判据。framework §7.1 第 4 条。
- **QA 继承**：`auditReachability` 内部改后，`qa/src/gameplay.ts:80` 自动获得修复；
  QA 判据条数不变。
- **发布闸**：gate 若仍只调 `auditReachability`，自动获得；若 09 改成 `auditPlayability`，同一实现。

---

### 3.9 moving solid 对齐运行时（静态）

**类型**：模型原语修正（deterministic correction），**不是独立判据**。

#### 1) 算法 / 输入 / 输出

- **今天**（`reachability.ts:67-73`）：带 `motion` 的 solid 把**整段行程**的包围盒当实心（扫过的整条都
  可踩）。
- **运行时**（`scene.ts:149-150`）：`case "solid": this.addSolid(e.box); break;`——只加原始盒，
  `advanceHazards` 只遍历 `this.hazards`（`scene.ts:270-281`），而 `hazards` 只在 `case "hazard"`
  里 push（`scene.ts:157-165`）。`vocabulary.ts:85-99` 明写「带 motion 的 solid 是静态体、从不移动」。
- **改为**：solid 的 `motion` 不参与几何；只用 `entityBox(e.at, e.body ?? size, anchor)`。
- **输入**：`config.entities`（`kind:"solid"`, `motion`, `at`, `body`, `asset`）、manifest `size`/`anchor`。
- **输出**：不产独立 error；改变 `..._UNREACHABLE` 的结果。

#### 2) 判据 id 与失败定位

- **无独立 id**。它服务于 `..._UNREACHABLE` / `..._BLOCKED` 的 `no-path` / `blocked` witness。
- 如果去掉「整段行程」后某个目标不可达，报对应 subject 的 `..._UNREACHABLE`，witness 里说明
  「solid 的 motion 在运行时被忽略，按静态盒计算」。

#### 3) 误报边界

- **设计者以为平台会动**：判据按**实际运行**（静态）判，目标可能不可达 → 这是真实的运行时失败，
  不是误报。如果设计意图是移动平台，那是 04 / mechanic-coverage 的「moving-platform 未实现」问题，
  不是空间判据的误报。
- **hazard 的 motion**：仍然会动（`scene.ts:157-165`），不属于本条；hazard 当空气（02 M1 / 04）。
- **`floorYOf` 已经排除 motion solid 作为复位地面**（`world.ts:109-122`）；与本条一致。
- **`auditGameConfig` 的行程越界 warning**：仍然会对 motion solid 报「周期运动的行程越界」；
  这条 warning 在静态语义下是**过时的**，但 framework §7.3 要求「不改变既有警告」。建议 09 把它
  保留为观察，或在 04 中重新裁定；不要在 03 删/升。

#### 4) 语料影响

- 02：**0 个 moving solid**（§7.3.2）；03 探针同样 0。
- **预计新增 error = 0**。
- 合成 `moving-solid-sweep`：当前 `[]`，新版报 `entity "high-pickup"`（与去掉 motion 的静态版本一致；
  `03-spatial-probes.mjs`）。这证明「判定对齐运行时」，不是新误报。

#### 5) 分类

**deterministic correction（模型原语）**；不独立产 error。

#### 6) 依赖

- 依赖 FixedRuntimeProfile 的「solid 静态」——已在 framework §2.2。
- moving-platform 本身未实现（`RUNTIME_IMPLEMENTED_MECHANICS` 不含它，`vocabulary.ts:85-99`）；
  本票**不要求**实现移动平台，只要求判定与当前 Runtime 一致。
- 如果未来 Runtime 实现移动平台，必须重新评估（framework §2.2 的「行为变化必须重评」）。

#### 7) 与既有审计的关系

- **替换** `reachability.ts:67-73` 的扫掠规则，不新增第二判据。
- **与 04**：04 负责「moving-platform 不存在 / 机制时序」。03 只把空间几何对齐到静态；
  04 不应再对同一个「solid+motion」产一条空间 error。
- **与 `auditGameConfig` warning**：coexist；warning 不参与 verdict。

---

### 3.10 资源锚点 / 脚点几何

**类型**：输入假设 / 观察；不是独立判据。

#### 1) 算法 / 输入 / 输出

- **统一公式**（全仓已有一处）：`entityBox(at, size, anchor)`（`game-config.ts:148-153`）；
  `foot` = 盒子的底边中点（`reachability.ts:83-86`）；玩家盒 = `buildWorld` 的 `boxAt`
  （`world.ts:207`）；玩家 body = `setSize(b.w, b.h, false)`（`scene.ts:219`）。
- **资产锚点不是脚**：last-train 的 `player-traveler` anchor 是 `{x:.5,y:.95}`（E3 manifest），
  所以 `at.y = 250` 时脚在 252.4，盒底 252；这就是 02 / 本票反复出现的 2.4px 嵌入。
  **不要**把「anchor.y != 1」判成错误；它合法，且运行时/纯层用同一公式。
- **实体锚点**：solid / chest / danger 的盒也由 anchor 推出；`at` 不是左上角。
- **逐帧 atlas 尺寸/锚点**：不在 allowed input；manifest 只有标称 `size` / 资源级 `anchor`
  （`assetpack.ts:170-180`）。如果逐帧不同，判据无法从 manifest 观测。

#### 2) 判据 id 与失败定位

- **无独立 id**。如果要做观察，可登记 `PLAYABILITY_SPATIAL_ANCHOR_MISMATCH`，但**不产 error**：
  - `witness = { kind: "coverage-gap", missing: "per-frame-geometry" }`（如果怀疑逐帧漂移）；
  - 或者只作为 `detail` 附在 spawn / target 的错误上。
- **不要**为「anchor.y ≠ 1」产 error；last-train 与 visual-design 都是合法产物。

#### 3) 误报边界

- 把 `at` 当左上角 → 全盘几何错位（02 票 48 的老坑）；本票坚持 `entityBox`。
- 把 `at` 当脚点 → last-train 的 2.4px 嵌入会被误判；本票用 `footOf` / anchor offset。
- 把逐帧锚点当资源锚点 → 纯层与渲染层可能差半个身位；本票只用资源级锚点，并标记 coverage。

#### 4) 语料影响

- 20 份唯一配对 config：10 份脚点在地形内，全部由 anchor offset 解释（burial ≤0.32px）；
  1 份横向墙重叠（108px 盒重叠）但脚点不在墙内。**0 个锚点导致的 error**。
- **预计新增 error = 0**。

#### 5) 分类

**观察 / 输入假设**；逐帧几何不可见时 **INSUFFICIENT_EVIDENCE**。

#### 6) 依赖

- P1（标称尺寸/资源锚点 = 碰撞几何）。
- 逐帧 atlas 数据不是 allowed input；要判它必须扩输入边界（本图不做）。

#### 7) 与既有审计的关系

- 所有空间判据共用 `entityBox` / `footOf`，不新增第二套几何。
- `auditGameConfig` 的 `boxOf` / `inWorld` 与 `world.ts` 的 `boxAt` 已统一；03 不另写。

---

### 3.11 `body` 在 pickup / goal 上被运行时忽略

**类型**：观察 / 部分不可写；失败时折入目标 error。

#### 1) 算法 / 输入 / 输出

- **运行时事实**（E1）：
  - `solid`：`this.addSolid(e.box)`（`scene.ts:150`）→ `e.body` 生效。
  - `pickup`：`physics.add.existing(sprite, true)`（`scene.ts:152`）→ 静态 body 用**帧尺寸/资源锚点**，
    没有 `setSize(e.body)`。
  - `goal`：`physics.add.existing(sprite, true)`（`scene.ts:167`）→ 同上。
  - `hazard`：同上（`scene.ts:158`）。
  - `chest`：`advanceChests` 用 `e.box`（`scene.ts:315-325`）→ `e.body` 生效。
  - `danger`：用 `e.box`（`scene.ts:287-309`）→ `e.body` 生效。
- **空间判据的取盒规则**：pickup / goal 用 `size(asset)`（忽略 `body`）；chest / solid 用
  `body ?? size(asset)`。
- **`body` 被忽略本身不是空间 error**：它可能让交互区比作者预期小/大，但不必然不可玩。
  只有当**按运行时几何**目标不可重叠/不可达时，才报 `..._BLOCKED` / `..._UNREACHABLE`，
  并在 `detail` / `witness` 里注明「`body` 被运行时忽略」。
- **输入**：`config.entities[].body`、manifest `size`/`anchor`、player 几何。
- **输出**：不产独立 error；折入目标 error。

#### 2) 判据 id 与失败定位

- 若登记观察：`PLAYABILITY_SPATIAL_TARGET_BODY_IGNORED`，`target = entity "<id>"`，
  `witness = { kind: "coverage-gap", missing: "runtime-body-semantics" }`，**不产 ConfigIssue**。
- 若造成失败：用 `..._PICKUP_BLOCKED` / `..._GATE_UNREACHABLE` 等，`detail` 里写清
  「声明的 `body` 是 W×H，运行时用标称 S×S；按运行时几何不可取得」。

#### 3) 误报边界

- **用 `body` 判可达**：会漏报。E3 合成 `pickup-body-override-inside`：pickup 在行李堆里、声明
  `body 200×200`；当前 `[]`，按运行时几何 → `entity "p-body"`，按声明 `body` → `[]`。
  这就是为什么判据必须用运行时几何。
- **`body` 让交互区更大**：运行时不用它；判据也不该用它来「救」目标；否则是漏报。
- **`body` 让交互区更小**：运行时不用它；判据也不该用它来「杀」目标；否则是误报。
- **P2 未定**：如果未来 Runtime 改为 honor `body`，本条必须重评；当前 profile 写死「忽略」。

#### 4) 语料影响

- 02：**0 个 pickup / hazard / goal `body` 覆盖**（§7.3.2）；03 探针全量扫描同样 **0**
  （`danger` 有 14 个 `body`，但 danger 不在空间目标里；`solid`/`chest` 的 `body` 0 个）。
- **预计新增 error = 0**。

#### 5) 分类

- `body` 被忽略本身：**observation / INSUFFICIENT_EVIDENCE**。
- 由此导致的目标不可取得：**deterministic error**（`..._BLOCKED` / `..._UNREACHABLE`），
  但根因标注为 `body` 语义，不另开一条 error。

#### 6) 依赖

- 02 S7：`body` 运行时语义未定。若 09 / 未来 effort 改 Runtime，本条重评。
- 不依赖斜坡 / 时序。

#### 7) 与既有审计的关系

- **不新增并列判据**：把「运行时几何」作为 §3.2 的取盒规则；失败时用同一目标 error。
- **与 04**：hazard 的 `body` 忽略影响 hazard 命中区 / 安全窗口，归 04；03 只处理 pickup / goal。
- **与 `auditReferences`**：`body` 不是引用，不重复。

---

### 3.12 不可写 / 只能 INSUFFICIENT 的项

| 项 | 为什么不可写 | 处理 |
|---|---|---|
| 斜坡 / 非 AABB 碰撞 | Runtime 没有；`game-config/v1` 只有 AABB Rect / `body` Size | 不写判据；若出现，`coverage.spatial = partial` |
| 移动平台 | `RUNTIME_IMPLEMENTED_MECHANICS` 不含；solid + motion 是静态（`vocabulary.ts:85-99`） | 静态判；机制层归 04 |
| 逐帧 atlas 尺寸 / 锚点 | 不是 allowed input；manifest 只有标称尺寸/资源锚点 | P1 假设；否则 INSUFFICIENT |
| 设计↔config 空间一致性 | `layout` 自由文本、无坐标（`game-design.ts:176-188`） | 不写（02 C6） |
| 难度 / 路线优劣 / 体验 | 主观，不是「错了一定不是设计」 | 观察，不进 error |
| 试玩结果 | `AGENT_LIMITATION` / `TIMEOUT` / `ENVIRONMENT_FAILURE` 不得转不可玩 | 证据层，不进判据 |
| 目标是否「必须站立」 | Runtime 只要求 overlap，不要求 standable；浮空 pickup/gate 合法 | 不写；只判可重叠 |
| 收集后回 gate / 单向路径 / 收集顺序 | 属 05 完成性；03 只判「spawn → 单个目标」 | 交 05；不要在 03 写 |
| 目标是否需要被设计文本点名 | 设计散文不可读 | 不写 |

---

## 4. 去重、分档与归属矩阵

### 4.1 与 framework §7.2 的对照

| 根因 | 本票结论 | 归属 | 严重度 | 重复风险 |
|---|---|---|---|---|
| 出生点卡在 `solid` | 既有 | `auditGameConfig`（`game-config.ts:553-561`） | error | 03 不新增 |
| 出生点埋在 terrain（窄口径） | 新 | `auditPlayability` | error | 不重复（既有只查 solid）；同点双命中时建议抑制 playability |
| 目标不可达（spawn → target） | 既有 + 新 | `auditPlayability`（内部升级 reachability） | error | 同一目标只一条 |
| 目标完全埋进实心体 | 新 | `auditPlayability`（`..._BLOCKED`） | error | 与 UNREACHABLE 互斥（BLOCKED 优先） |
| chest 不可取得 | 新 | `auditPlayability`（`..._CHEST_*`） | error | 05 不得重复 |
| 台阶高 | 既有 | `auditGameConfig` warning | warning | coexist；不升级 |
| 周期行程越界 | 既有 | `auditGameConfig` warning | warning | coexist；solid motion 的 warning 语义过时，交 04/09 |
| 机制时序 | 04 | `auditPlayability` | 不产 issue | 03 不碰 |
| 机制存在性 | 既有 | `mechanic-coverage` | 独立 verdict | 03 不碰 |
| QA standalone reachability | 既有 | `qa/src/gameplay.ts:80` | 继承 | 函数内部升级后自动继承 |

### 4.2 同目标去重规则（建议）

1. 对每个目标，先判 `BLOCKED`；若是，只产 `..._BLOCKED`，不再产 `..._UNREACHABLE`。
2. 若 `auditGameConfig.inWorld` 已对同一 `where` 报 error，抑制 playability 的同目标 error（不同根因，
   但同一 config 已经被硬拒；避免两条噪声）。
3. 若 `auditReferences` 已报 `objective.gate` 缺失 / pickup 引用不存在，playability 不应再报同一目标
   （无法计算盒子时直接 coverage-gap）。
4. 05 的完成性判据必须消费 03 的结果：空间上不可取得的目标，不再在 completion 层重复报；
   completion 只报「单独可达、但组合不可完成」（如收集后回不去）的根因。

### 4.3 放置位置（交 09）

- 把 §1.2 的几何 / BFS / 重叠 / BLOCKED / walk / fall / static motion 实现在**一个内部可达性组件**里，
  由 `auditReachability` 调用（保持 QA / 既有测试的入口），由新的 `auditPlayability` 映射成三态并加
  spawn / coverage 判据。
- **不要**把 chest / spawn 判据放进 `auditGameConfig`：那会落进 `resampleable`
  （`config-audit.ts:44-48`），布局错误被当「模型下一发可修」重采样 3 发（02 §5.2 第 1 条）。
- **发布闸**：`publish-gate.ts:140` 今天只调 `auditReachability`。framework §4.2 已裁定 gate 改调
  `auditPlayability`；03 需要 gate 覆盖 chest / BLOCKED / spawn 判据，否则 standalone `site` 会漏。
- **QA**：`qa/src/gameplay.ts:80` 继续调 `auditReachability`；若它内部升级，QA 自动获得 chest/overlap/walk
  的修复，但 QA 仍是 7 条判据，不新增。

---

## 5. 语料影响（E3，引用 02 + 03 只读探针）

### 5.1 02 的基线

| 计数 | 值 |
|---|---|
| 扫描 JSON / 可解析对象 | 5,244 / 5,243 |
| `game-config/v1` 文件 / 唯一 config | 152 / 21 |
| manifest / 当前 v4 可解析 / 旧 schema | 171 / 90 / 81 |
| 配对成功 / 未配对 | 96 / 2 |
| 唯一配对 config | 20 |
| `auditReachability` error | **0** |
| `auditGameConfig` error / warning | 49 / 0 |
| chest 实例 / 配对文件 / 唯一 config | 53 / 34 / 5 |
| chest 临时当目标后不可达 | **0** |
| moving solid / 非 hazard motion | 0 / 0 |
| pickup/hazard/goal `body` 覆盖 | 0 |

### 5.2 03 探针（同一配对策略，20 份唯一配对）

| 指标 | 值 |
|---|---|
| 唯一配对 / 未配对 | 20 / 1（`packages/demo/fixtures/empty-world.json`；02 为 2，差异见 §7.3.2） |
| 目标数（pickup + chest + gate） | 92 |
| chest 数（唯一配对） | 6（1 个 `range:24`） |
| **新版 reachability 新增 error** | **0** |
| **新版 reachability 移除 error** | **0** |
| BLOCKED 目标 | **0** |
| chest 不可达 | **0** |
| moving solid | **0** |
| pickup/goal/hazard `body` 覆盖 | **0** |
| 出生点纯盒重叠 terrain | **11 / 20**（若按纯盒重叠报 error → 11 条误报） |
| 出生点脚点在 terrain 内 | **10 / 20** |
| 锚点解释后的最大 burial | **0.32px**（last-train 型 2.4px、visual-design 型 7.68px 都归零） |
| `burial > 1px` | **0** |
| 横向墙重叠（盒 108px，脚点不在墙内） | 1（不报） |
| spawn-no-foothold | **0** |

### 5.3 合成正/负例（`03-spatial-probes.mjs`，退出码 0）

| 场景 | 当前 `auditReachability` | 03 原型 | 结论 |
|---|---|---|---|
| baseline last-train | `[]` | `[]` | 不误伤 |
| gap-200 | 4 条 | 4 条 | 保持 |
| gap-40 | `[]` | `[]` | 保持 |
| wall-100 | 3 条 | 3 条 | 保持 |
| wall-40 | `[]` | `[]` | 保持 |
| pickup-120 | 1 条 | 1 条 | 保持 |
| pickup-50 | `[]` | `[]` | 保持 |
| **goal 埋在行李堆** | `[]` | `entity "signal"`（BLOCKED） | **修漏报** |
| **低天花板走廊** | `p` + `gate` | `[]` | **修误报** |
| **chest 在坑对面** | `[]` | `entity "chest"` | **修漏报** |
| chest 埋行李 + `range:0` | `[]` | `entity "chest-in"`（BLOCKED） | 修漏报 |
| chest 埋行李 + `range:30` | `[]` | `[]` | 合法边界 |
| **pickup 埋行李** | `[]` | `entity "p-inside"`（BLOCKED） | 修漏报 |
| pickup 在行李顶上 | `[]` | `[]` | 合法边界 |
| pickup `body 200×200` 埋行李 | `[]` | 运行时几何：error；声明 body：`[]` | 证明必须用运行时几何 |
| moving solid 扫过 | `[]` | `entity "high-pickup"`（静态） | 对齐运行时 |
| spawn 附近无落脚点 | `[]` | coverage-gap（不产 error） | 不误报 |
| **spawn 浅埋/锚点嵌入**（last-train、02 probe E） | `[]` | `[]`（推荐口径） | 不误报 |
| **spawn 深埋且无 nearby standable** | `[]` | error（`spawnDx`） | 判据会响 |
| **spawn 横向墙重叠**（1920 语料型） | `[]` | `[]` | 不误报 |

> 合成负例只证明判据会响；历史语料零新增才是 Q6 的零误伤基线（08 负责全量重判）。

---

## 6. 必须升级给 07 / 09 的问题

1. **spawn-in-terrain 的口径（07/09）**：framework §7.2 写「error」，但纯盒重叠在 20 份唯一 config 上
   误报 11 份。03 推荐窄口径（脚点 + 锚点 offset + 无 nearby standable），语料 0 新增；请 07 在矩阵里
   同时放：
   - 合法边界：last-train 型 2.4px / visual-design 型 7.68px 锚点嵌入 → `NO_PROVEN_BLOCKER`；
   - 负例：深埋且玩家身体范围内无 standable（03 合成：top 100、at 200、burial 99.6）→ `PROVEN_UNPLAYABLE`；
   - 观察：02 probe E 的 4.6px burial / 7px 浅埋 → 按推荐口径**不报**，不要把它当负例。
2. **P4 spawn 分离 profile（09）**：如果 09 不把「出生点与静态几何重叠时的分离行为」写进
   FixedRuntimeProfile，spawn-in-terrain 只能落 `INSUFFICIENT_EVIDENCE`。请单列 profile 假设。
3. **P1 逐帧几何（09）**：所有盒判据依赖「manifest 标称 size + 资源 anchor = 运行时碰撞几何」。
   请决定是否写入 profile；如果不写，严格重叠 / BLOCKED / chest 判据的 coverage 都是 `partial`。
4. **`body` 运行时语义（04/09）**：03 建议空间判据用运行时几何（pickup/goal 忽略 `body`），
   并把「`body` 被忽略」作为观察。若未来 Runtime 改 honor `body`，必须重评。
5. **moving solid 的 warning（04/09）**：03 把空间几何对齐静态；`auditGameConfig` 的「周期运动行程越界」
   warning 在静态语义下过时。framework §7.3 要求不改变既有 warning，请 04/09 决定是保留观察还是
   在后续 effort 重裁。
6. **发布闸 / QA 覆盖（09）**：`publish-gate.ts:140` 只调 `auditReachability`。若 chest / BLOCKED /
   spawn 判据不在该函数内，standalone `site` 会漏；若 gate 改调 `auditPlayability`，QA 仍调旧函数，
   需确认两者共享同一内部可达性组件。
7. **BLOCKED / UNREACHABLE 的 id 拆分（09）**：03 建议按 subject 拆成
   `..._PICKUP_BLOCKED` / `..._CHEST_BLOCKED` / `..._GATE_BLOCKED`，并在同一目标上互斥；
   这是内部注册表，不是契约 schema，但需要 09 确认 id 冻结。
8. **coverage 映射（09）**：spawn-no-foothold、玩家资源解不到、逐帧几何不可见都必须映射
   `coverage.spatial = partial` + `INSUFFICIENT_EVIDENCE`，不能映射 `NO_PROVEN_BLOCKER`。
9. **05 去重（09/05）**：chest 空间不可取得只由 03 报；05 只报「单独可达但组合不可完成」
   （如收集后回 gate / 收集顺序），不得对同一 chest 再产一条 completion error。
10. **07 的合法边界**：至少包含
    - chest 藏在 `range` 能覆盖的实心体里（不报）；
    - pickup/gate 完全埋在实心体里（BLOCKED）；
    - 低天花板可走走廊（不报）；
    - 40px 沟 / 40px 墙 / 50px 抬高 pickup（不报）；
    - spawn 锚点嵌入（不报）；
    - moving solid 的静态目标（报）；
    - `body` 覆盖 pickup 的运行时几何（报）。

---

## 7. 证据日志

### 7.1 E1：源码 / 契约定位

| 入口 | 文件:行 |
|---|---|
| reachability 实心体 / motion 扫掠 | `packages/contracts/src/reachability.ts:60-73` |
| 脚点公式 | `packages/contracts/src/reachability.ts:83-86` |
| blocked / standable 栅格 | `packages/contracts/src/reachability.ts:93-114` |
| targets（无 chest） | `packages/contracts/src/reachability.ts:124-129` |
| `covers` 宽松判定 | `packages/contracts/src/reachability.ts:130-137` |
| 跳跃弧 | `packages/contracts/src/reachability.ts:154-175` |
| seed / 静默返回 | `packages/contracts/src/reachability.ts:177-198` |
| BFS | `packages/contracts/src/reachability.ts:200-213` |
| 错误输出 | `packages/contracts/src/reachability.ts:215-224` |
| `pickupCount`（含 chest） | `packages/contracts/src/game-config.ts:264-268` |
| Entity 字段（body/motion/range） | `packages/contracts/src/game-config.ts:109-127` |
| `entityBox` | `packages/contracts/src/game-config.ts:148-153` |
| `inWorld` | `packages/contracts/src/game-config.ts:533-539` |
| spawn-in-solid（点） | `packages/contracts/src/game-config.ts:553-561` |
| 台阶 / 行程 warning | `packages/contracts/src/game-config.ts:563-584` |
| `CONFIG_ISSUE_CODES` 闭集 | `packages/contracts/src/game-config.ts:315-317` |
| pipeline 分档 | `packages/contracts/src/config-audit.ts:39-56` |
| QA reachability | `packages/qa/src/gameplay.ts:80` |
| publish gate | `packages/pipeline/src/publish-gate.ts:140` |
| solid / pickup / hazard / goal / chest / danger 运行时 | `packages/demo/src/shell/scene.ts:149-198` |
| 玩家 body | `packages/demo/src/shell/scene.ts:219` |
| hazard 推进（只遍历 hazards） | `packages/demo/src/shell/scene.ts:270-281` |
| danger 推进 | `packages/demo/src/shell/scene.ts:287-309` |
| chest 交互区（range 外扩） | `packages/demo/src/shell/scene.ts:315-325` |
| tryWin 计数门槛 | `packages/demo/src/shell/scene.ts:364-369` |
| `floorYOf` 排除 motion solid | `packages/demo/src/world.ts:109-122` |
| 实体盒用 `body` | `packages/demo/src/world.ts:175-189` |
| 玩家盒 | `packages/demo/src/world.ts:207-212` |
| moving-platform 未实现 | `packages/contracts/src/vocabulary.ts:85-99` |
| `layout` 自由文本 | `packages/contracts/src/game-design.ts:176-188` |
| 近端探出 warning | `packages/demo/src/site.ts:127-141` |

### 7.2 E2：既有测试

命令：

```bash
pnpm exec vitest run \
  packages/contracts/tests/reachability.test.ts \
  packages/contracts/tests/game-config.test.ts \
  packages/contracts/tests/config-audit.test.ts
```

结果：**退出码 0；3 个文件、115 个测试全过**（2026-11-05 本票复跑）。关键测试：
- `reachability.test.ts`「真夹具：一条都不报」→ `expect(reach(CONFIG)).toEqual([])`。
- 「挖一条 200px 的沟 ⇒ ...」→ `expect(who(bad).sort()).toEqual([...])`。
- 「40px 的沟：跳得过去 ⇒ 不报」→ `toEqual([])`。
- 「出生点附近没有任何落脚点 ⇒ 一条都不报」→ `toEqual([])`（本票把它映射为 coverage-gap）。
- 「goal 埋在行李堆正中间（站不进去）也**不报**」→ `toEqual([])`（本票要求翻面为 BLOCKED）。
- `config-audit.test.ts`「reachability error 进 deterministic、不进 resampleable」。

### 7.3 E3：零付费只读探针

#### 7.3.1 合成正/负例

```bash
node .scratch/level-playability-v1/research/03-spatial-probes.mjs
# 退出码 0；输出 /tmp/03-probes.json
```

摘要（**不是原样 JSON**；原样输出在 `/tmp/03-probes.json`，由上面的命令生成）：

| 场景 | 当前 `auditReachability` | 03 原型 |
|---|---|---|
| baseline-last-train | `[]` | `[]` |
| gap-200 | 4 条 | 4 条 |
| gap-40 | `[]` | `[]` |
| wall-100 | 3 条 | 3 条 |
| wall-40 | `[]` | `[]` |
| pickup-120 | 1 条 | 1 条 |
| pickup-50 | `[]` | `[]` |
| goal-inside-luggage | `[]` | `entity "signal"`（embedded） |
| low-ceiling | `p` + `gate` | `[]` |
| chest-in-pit | `[]` | `entity "chest"` |
| chest-inside-luggage-range0 | `[]` | `entity "chest-in"`（embedded） |
| chest-inside-luggage-range30 | `[]` | `[]` |
| pickup-inside-luggage | `[]` | `entity "p-inside"`（embedded） |
| pickup-on-luggage | `[]` | `[]` |
| pickup-body-override-inside | `[]` | 运行时几何 1 条；声明 body 0 条 |
| moving-solid-sweep | `[]` | `entity "high-pickup"` |
| spawn-no-foothold | `[]` | 原型列出全部目标 + `gaps: ["spawn-no-foothold"]` |

> `spawn-no-foothold` 的 `next` 是原型在 seed 为空时的 artifact；03 **不**把它当 error，
> 只映射为 coverage-gap（§3.5）。

#### 7.3.2 历史语料只读估算

```bash
node .scratch/level-playability-v1/research/03-corpus-spatial.mjs
# 退出码 0；输出 /tmp/03-corpus.json
```

摘要（**不是原样 JSON**；原样输出在 `/tmp/03-corpus.json`，由上面的命令生成）：

| 字段 | 值 |
|---|---|
| `result.totalConfigs` / `uniqueConfigs` | 152 / 21 |
| `result.paired` / `unpaired` | 20 / 1（`packages/demo/fixtures/empty-world.json`） |
| `result.spawnEmbed.boxOverlap` | 11 |
| `result.spawnEmbed.footInside` | 10 |
| `result.spawnEmbed.burialGt1` | 0（键缺席 = 0） |
| `result.features` | `movingSolids:0, bodyIgnored:0, chests:6, targets:92` |
| `details.newErrors.length` | **0** |
| `details.fixedErrors.length` | **0** |
| `details.embedded.length` | **0** |
| `details.chest.length` | **0** |

- `boxOverlap: 11`：如果按「玩家盒与 terrain 有任何重叠」判 spawn-in-terrain，会新增 11 条 error；
  这正是 §3.4 拒绝纯盒重叠的理由。
- `footInside: 10`：脚点在地形内，但 `burial = footDepth - anchorOffset` 全部 ≤ 0.32px；
  `burial > 1px` = 0。
- `details.newErrors.length = 0`：严格重叠 + 走路/下落 + chest + 静态 motion 在唯一配对语料上零新增。
- `movingSolids: 0` / `bodyIgnored: 0`：与 02 §7.3.2 一致。
- 配对策略与 02 同源（最近覆盖引用的 manifest，旧 schema 只读归一化），未配对计数略有差异
  （02：2；03 按唯一 config 去重后：1）。这是 08 要统一的口径，不是本票的新事实。

#### 7.3.3 基线一致性

```bash
git diff --stat fa17c14 HEAD -- packages fixtures docs CONTEXT.md package.json
# 输出为空；退出码 0（02 已验）
```

本票未修改 `packages/**`、`fixtures/**`、`docs/**`、ticket、map。

---

## 8. 一句话总结

03 的空间判据应当**把可达性模型修对**（真实重叠、走路/下落边、solid 静态、运行时 `body` 几何），
再在同一个模型上**加三个目标/出生点判据**（chest、BLOCKED、窄口径 spawn-in-terrain）；
其余候选（沟宽、台阶、走廊、锚点、世界边界）要么已由既有 warning/reachability 覆盖，
要么只能落观察 / `INSUFFICIENT_EVIDENCE`。历史语料上三类新 error 合计 **0**；
最大的误伤风险是「把浅埋的锚点语义当 spawn-in-terrain」——03 用脚点 + 锚点 offset + `nearbyStand`
把它挡在 error 之外。
