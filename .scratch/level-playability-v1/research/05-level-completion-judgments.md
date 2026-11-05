# 关卡完成性候选判据（05）

- **Date**：2026-11-05
- **Baseline**：`main` @ `fa17c14`；本票只读研究，未改生产代码、ticket、map、git。
- **Nature**：枚举并评估 `objective: collect-then-reach` 下的**关卡完成性**原子判据。
  不改 `Objective` 契约、不改 gate 派生规则、不新增 goal kind、不新增 `ConfigIssue.code`。
- **Input**：`.scratch/level-playability-v1/framework.md`、`rulings-2026-11-04.md`、
  `research/02-capability-gap-audit.md`、`issues/05-level-completion-judgments.md`、
  `packages/contracts/src/{reachability,game-config,config-audit,screen-space}.ts`、
  `packages/demo/src/{world.ts,shell/scene.ts}`、既有测试。
- **Evidence**：E1 = `file:line`；E2 = 既有测试名 + 断言；E3 = 零付费只读探针
  （命令、退出码、路径、计数）。本票没有模型调用、生图、站点重建、Agent 试玩。
- **探针**：`.scratch/level-playability-v1/research/05-completion-probe.mjs`（scratch，非生产）。

---

## 0. 结论速览

| 候选 | 判据 id | 分类 | 语料影响 | 建议 |
|---|---|---|---|---|
| 宝箱交互区被实心体完全封死 | 03 的 `PLAYABILITY_SPATIAL_CHEST_BLOCKED` | 空间层 deterministic | 0 | **completion 不注册；消费 03** |
| 必需宝箱在完成上界内不可取得 | 03 的 `PLAYABILITY_SPATIAL_CHEST_UNREACHABLE` | 空间层 deterministic | 0 | **completion 不注册；消费 03** |
| 收齐必需收集物后到不了 gate / 无完成顺序 | `PLAYABILITY_COMPLETION_GATE_NOT_REACHABLE_AFTER_COLLECT` | deterministic error（**以 03 的移动图 + 04 的机制结论为前提**） | 有效 gate 配置 0；8 个「gate 缺失」负例由引用族负责 | **唯一推荐新注册的 completion id**；等 03 / 04 / 07 |
| 必需 pickup 不可取得 | 03 的 `PLAYABILITY_SPATIAL_PICKUP_{UNREACHABLE,BLOCKED}` | 空间层 | 0 | **不再注册完成性 id** |
| `pickupCount` 与 HUD/派生计数不一致 | 无 | 不是判据（构造上不可能） | 0 | 拒绝 |
| chest 顺序约束 | 并入 `GATE_NOT_REACHABLE_AFTER_COLLECT` | completion | 0 | 拒绝单列 |
| gate 激活 | 并入 `GATE_NOT_REACHABLE_AFTER_COLLECT` | completion | 0 | 拒绝单列 |
| 目标「站得住」 | 无 | 误报陷阱 | — | 拒绝 |
| 目标在世界内 | 既有 `auditGameConfig.inWorld` | deterministic（既有） | — | 不新增 |
| 设计层数量 / 可选性 / win 文本 | 无 | 结构性不可判 | — | `INSUFFICIENT_EVIDENCE` |
| 静止 hazard 封死唯一通路 | 04 的 `PLAYABILITY_MECHANIC_PATH_BLOCKED` | 机制层 deterministic（退化） | 04 探针另有命中 | completion 不覆盖；聚合 verdict 取 04 |
| 全高 danger 无安全窗口 | 04 的 `PLAYABILITY_MECHANIC_PATH_NO_SAFE_WINDOW` | 机制层 deterministic（退化） | 04 探针 | completion 不覆盖 |
| 巡逻 hazard / moving platform / 被机制包住的收集物 | 04 不注册 | 机制层 `INSUFFICIENT_EVIDENCE` | — | 不归完成性 |

**一句话**：完成性层真正新增的**只有一个**判据——**是否存在一条「收齐全部必需收集物 → 到达 gate」
的单次游玩走法**。必需的 chest 是否可取得，是 03 的空间判据（其理由已经引用 `pickupCount` /
`tryWin`），completion 只消费结果、不重复报。计数一致性、gate 激活、chest 顺序都不是独立判据；
它们在运行时语义下由 `pickupCount` 的派生规则与收集顺序自动覆盖。

**与 03 / 04 并行报告的对账（2026-11-05）**：

- 03 已注册空间层 id：`PLAYABILITY_SPATIAL_{PICKUP,CHEST,GATE}_{UNREACHABLE,BLOCKED}`，
  并明确「05 的完成性判据必须消费 03 的结果，不再重复报空间不可取得的目标」
  （`03-spatial-layout-judgments.md` §3.3 / §4.2）。
- 04 已注册机制层 id：`PLAYABILITY_MECHANIC_PATH_BLOCKED`（静止 hazard 封死）与
  `PLAYABILITY_MECHANIC_PATH_NO_SAFE_WINDOW`（全高 danger 窗口不足）；04 明确
  「collect-then-reach 顺序 vs gate 激活归 05」，并给出「复位不是免费传送、只有 hazard/danger
  接触才复位、收集跨复位保留」（`04-mechanic-composition-judgments.md` §9）。
- 因此：本票 **不注册** completion 的 chest / pickup / gate 几何 id；只注册
  `PLAYABILITY_COMPLETION_GATE_NOT_REACHABLE_AFTER_COLLECT`。下面 §3.1 / §3.2 保留
  「如果 completion 独立做会怎样」的算法与误报边界，作为 03 的交叉验证与 09 的备选；
  生产归属以 03 为准。

---

## 1. 运行时完成规则的事实（E1）

### 1.1 必需集合与计数

| 事实 | 源码 |
|---|---|
| `objective` 只有 `kind: "collect-then-reach"` 与 `gate`，**没有数量字段** | `game-config.ts:228-232` |
| `pickupCount()` = `kind:"pickup"` + `kind:"chest"` 的实体条数；数量**派生**，不重复声明 | `game-config.ts:264-268` |
| pickup 收集：static body + overlap → `collect()`，`collected += 1` | `scene.ts:151-155, 334-340` |
| chest 收集：不进 physics；每帧玩家盒 × `e.box` 外扩 `range` → `openChest()`，`collected += 1` | `scene.ts:175-185, 315-333` |
| gate 只认 `objective.gate` 指向的那一个 goal；其余 goal 只画不判 | `world.ts:178-186`、`scene.ts:166-174` |
| `tryWin()` 要求 `collected >= world.objective.pickupCount` | `scene.ts:364-369` |
| `pickupCount(config) === 0` 已是引用族 error | `game-config.ts:425-426` |
| `objective.gate` 必须是存在且 `kind:"goal"` 的实体 | `game-config.ts:421-423` |

结论：**config 里的每个 pickup / chest 都是必需的**；没有 optional 字段，没有第二套计数。
「捡齐 N 件」的 N 就是 `pickupCount`，HUD 槽位、world objective、`tryWin` 三处同源。

### 1.2 收集不会改变几何

- pickup 只隐藏自己、禁用自己的 static body（`scene.ts:334-340`）；不阻挡玩家。
- chest 没有 physics body，`openChest()` 只切帧、加计数（`scene.ts:327-333`）；不阻挡玩家。
- gate 只判 overlap，不产生碰撞；提前碰到 gate 不会胜利，也不会改变关卡状态（`scene.ts:364-369`）。
- 因此：**收集顺序只受有向移动图约束，不受实体状态机约束**。这是完成性可以做成
  「带标签的有向图 + 一次走法」而不是「状态空间搜索」的根本原因。

### 1.3 复位与死亡语义

| 事实 | 源码 |
|---|---|
| hazard 接触 → 复位到出生点；**`collected` 不重置** | `scene.ts:342-362` |
| danger active 窗口内接触 → 同一个 `hitHazard()` | `scene.ts:287-309, 342-362` |
| 没有 kill plane；掉出世界不判死，也没有世界底地板 | `reachability.ts:107-113`；02 §3 |
| 玩家 body 没有 `collideWorldBounds`；相机只是 `setBounds` | `scene.ts:69-73` |
| `solid` 带 `motion` 时运行时仍是静态体（`case "solid"` 只 `addSolid(e.box)`） | `scene.ts:149-150`；02 S5 |
| pickup / goal / hazard 的 physics body 用**帧尺寸 + 锚点**，忽略 `body` | `scene.ts:151-174`；02 S7 |
| chest / danger / solid 的几何用 `e.box`（`body` 生效） | `world.ts:178-186`、`scene.ts:175-185, 287-309` |

**重点**：hazard/danger 复位是完成性专用的「回出生点」边，且**保留已收集计数**。
02 的 C2 只描述了「单向坑回不到 gate」，没有把这条固定运行剖面纳入。忽略它会在
「坑底收完东西，被坑底 hazard 复位回出生点，再去 gate」这种合法设计上**误报**。
本票的探针已按固定运行剖面补上复位边（见 §6 case 16）。

### 1.4 移动上界（沿用 `auditReachability`）

- 节点 = 脚点落在「自由且下面一格是实心」的整数格点（`reachability.ts:103-122`）。
- 边 = 一次跳跃抛物线；水平上限 `jumpSpan(move, H)`；撞实心体无效
  （`reachability.ts:139-175`）。
- 起点 = 出生点脚点附近 ±一个身位、不低于 `spawn.y - player.h` 的落脚点
  （`reachability.ts:177-198`）。
- hazard 当空气；下落不设限；`solid.motion` 用整段行程（当前实现；03 修静态语义）。
- 已知缺口：只有跳跃弧、没有走路边（S6）；moving solid 扫过整段（S5）；
  精细绕行 / 贴边 / 空中反向不在模型里（02 §3.3、文件头 `reachability.ts:22-24`）。

---

## 2. 完成性问题的形式化

### 2.1 输入与输出

输入：`(GameConfig, AssetPackManifest) + FixedRuntimeProfile`。不读设计文本、viewport、试玩。

输出：内部 `PlayabilityEvidence[]`（framework §3.1 / §5.2）：

```
{
  judgmentId, target, detail, witness, coverage,
  assetId?, expected?, actual?
}
```

映射到既有 `ConfigIssue`：`target → where`、`detail → message`，**不带 `code`**
（`CONFIG_ISSUE_CODES` 是闭集，`game-config.ts:316`）。

### 2.2 图与标签

在 03 修好的移动图上构造有向图 `G = (V, E)`：

- `V`：从出生点可达的落脚点；`E`：有效跳跃 `a → b`。
- 每个边 `e` 带四个标签：
  - `S(e)`：沿弧采样点与**必需收集物**的运行时交互盒相交的集合（含落点 `b` 的
    站立收集）。
  - `G(e)`：沿弧采样点与 gate 运行时盒相交（gate 可被提前碰，但不结算）。
  - `R(e)`：沿弧采样点与 hazard / danger 接触（可复位）。
  - 复位：`a --R--> spawn seeds`，标签 `S = ∅`（计数保留）。
- 每个节点 `v` 同理有 `S(v)`、`G(v)`、`R(v)`。
- 必需集合 `T = {pickup} ∪ {chest}`；gate `g = objective.gate`。

### 2.3 完成谓词

> 存在一条从出生点 seeds 出发的走法，沿路收集 `T` 中**每一个**目标（收集是强制的：
> 经过即收集），最后到达某个 `GatePre = {v | G(v)} ∪ {a | ∃e=(a,b), G(e)}` 的位置。

- **gate 不作为自动收集目标**：提前碰到 gate 不胜利、不改变状态，玩家可以继续走。
- **hazard/danger 复位**：从任何可达的 `R(v)` / `R(e)` 回到 seeds，mask 不变。
- **收集不改变几何**：所以图是静态的；完成性只做「带标签的路径可行性」。

### 2.4 参考算法（本票探针实际跑的）

`R[mask] = 某条已收 mask 的走法之后可能站到的落脚点集合`：

1. 初始：`R[S(seeds) ∪ S(spawn)] = seeds`。
2. 对每个 mask 做闭包：只走 `S(e) ⊆ mask` 的边（含 `S=∅` 的复位边）。
3. 转移：从 `R[mask]` 出发走 `S(e) ⊄ mask` 的边，落到 `R[mask | S(e)]`。
4. 若 `R[full] ∩ GatePre ≠ ∅` → 找到完成走法；否则无完成走法。
5. `k = |T|` 超过上限（本票取 12）→ 完成顺序落 `partial` / `INSUFFICIENT_EVIDENCE`。

**精确性边界**：`R[mask]` 把不同顺序的落点并在一起，因此是**完成可能性的上界近似**：
它只会漏报（把可行的顺序漏掉），不会把不可行的顺序说成可行。对「证明不可玩」是安全方向。
种子节点也做并集，同理。若 09 需要更紧/多项式的实现，可改成
「把每个收集边展开成 `a → t₁ → … → tₖ → b` 的共享目标节点图，再做 SCC 缩点 + DAG 链检查」；
本票不要求生产采用哪一种，但要求保持**只报 no-walk** 的方向。

---

## 3. 判据评估（逐条）

### 3.1 `PLAYABILITY_COMPLETION_CHEST_BLOCKED`（评估候选；不注册为 completion）

**归属决定**：03 已注册 `PLAYABILITY_SPATIAL_CHEST_BLOCKED`。完成性层**不得**再产同一 chest
的第二条 error。下面的算法 / 误报边界是给 03 的输入与交叉验证；只有当 03 最终决定不注册时，
才由 completion 接管这个候选 id。

**问题**：必需 chest 的交互区是否被静态实心体完全封死，玩家永远 overlap 不到。

#### 1) 算法 / 输入 / 输出

输入：`GameConfig` + `AssetPackManifest`（不需要移动图）。

1. 对每个 `kind:"chest"`：
   - `size = e.body ?? manifest.asset(e.asset).size`（chest 的 `body` **生效**）；
   - `anchor = manifest.asset(e.asset).anchor ?? FALLBACK_ANCHOR`；
   - `box = entityBox(e.at, size, anchor)`；
   - `interaction = box` 四边外扩 `range = e.range ?? 0`。
2. 静态实心体集合 `S`：
   - 所有 `terrain` 矩形；
   - 所有 `kind:"solid"` 的 `entityBox(e.at, e.body ?? assetSize, anchor)`；
   - **忽略 `motion`**：运行时 solid 是静态体（`scene.ts:149-150`），只挡初始盒。
   - 不含 hazard / danger / pickup / chest / goal / decor。
3. 计算 `interaction \ S` 的面积（整数坐标，可用 sweep-line；或 1px 栅格）。
   若为空 → 封死。
4. 输出：一条 `PlayabilityEvidence`。

输出形状：

```
{
  judgmentId: "PLAYABILITY_COMPLETION_CHEST_BLOCKED",
  target: `entity "${chest.id}"`,
  detail: "宝箱交互区（box + range）完全落在实心体/地形内 —— 玩家永远无法 overlap；"
        + "而 pickupCount 把它算作必需收集物。",
  witness: {
    kind: "blocked",
    interactionRect: {x,y,w,h},
    coveredBy: [{kind:"terrain", index}, {kind:"entity", id}]
  },
  coverage: { spatial: "checked", mechanic: "checked", completion: "checked" }
}
```

#### 2) 判据 id 与失败定位

- 候选 id：`PLAYABILITY_COMPLETION_CHEST_BLOCKED`（仅在 03 不注册时使用）；
  生产 id 是 03 的 `PLAYABILITY_SPATIAL_CHEST_BLOCKED`。
- `target`：`entity "<chest-id>"` → `ConfigIssue.where`。
- `detail`：人话 → `ConfigIssue.message`。
- `witness`：`blocked`，含交互矩形与覆盖它的实心体/地形。
- `coverage`：三维全 `checked`（这条判据不依赖移动图）。
- 不带 `code`。

#### 3) 误报边界（合法硬设计为什么不会被判）

- **只判「完全封死」**：交互区只要有一丝露在实心体外面，就不报。贴着墙、只露出一角的
  chest 不报；它能不能被走到由 `CHEST_NOT_COLLECTABLE` 再判。
- **`range` 生效**：`range=60` 的 chest 即使视觉盒在墙里，交互区伸出墙外就不报。
  运行时 chest 没有 LoS 要求（`scene.ts:315-325`），隔墙开箱是合法的。
- **hazard / danger 不算封死**：它们不阻挡、只复位；被它们包住的 chest 仍可开，
  计数保留（`scene.ts:342-362`）。见 §6 case 17。
- **moving solid 用静态初始盒**：不把扫过行程当实心；否则会把「chest 在扫过区、
  但不在静态盒里」误报（§6 case 15 证明当前移动图会误报）。
- **chest 的 `body` 生效**：用 `e.body ?? size`，与 `world.ts:178` / `scene.ts:175-185` 一致。
- 合法硬设计的例子：高台 chest、悬空 chest、range 很大的 chest、与 hazard 重叠的 chest、
  静态 solid 扫过区内的 chest（不在初始盒里）—— 都不报。

#### 4) 分类

**deterministic error**。这是纯几何 + 运行时碰撞语义，不需要移动图、不需要时序、
不需要玩家技巧。若未来 FixedRuntimeProfile 改变 solid 的 motion 语义，必须重评。

#### 5) 与现有规则冲突检查

- 与 `pickupCount` 一致：chest 计入必需数（`game-config.ts:267-268`、`scene.ts:364-369`）。
- 与 03 的 chest target 不重叠：02 的 `auditReachability` 今天完全不含 chest
  （`reachability.ts:124-129`），但 03 已注册 `PLAYABILITY_SPATIAL_CHEST_BLOCKED`。
  生产上用 03 的 id；本候选只做交叉验证，不能两条都报。
- 与 `auditGameConfig.inWorld` 不重叠：`inWorld` 判盒子越出世界右下边界
  （`game-config.ts:533-539`）；本判据判封死。两者可同时出现（不同根因），
  error 去重键 `(target, 根因类)` 保留两条根因、一条 error。
- 与 `auditReferences` 不重叠：资源解不到由引用族报，本判据跳过。
- 不改契约、不加 `code`、不改 `objective`。

#### 6) 语料影响

- 02 基线：53 个 chest 实例 / 34 个配对文件 / 5 份唯一 config；按目标探测 0 个不可达。
- 本票探针：同一 96 配对 / 20 唯一上，53 个 chest 实例全部可取得（0 不可达）。
  封死是「不可取得」的子集，因此预计新增 error **0**。
- 合成负例 `chest-sealed-in-solid` 稳定触发（§6 case 4）。
- 不需要全量重判；08 只需确认 0 新增。

#### 7) 结构性不可判

- 设计层是否本来想把 chest 做成可选奖励：不可判（`GameDesignSpec` 没有 optional 字段，
  C4）。config / 运行时把它当必需；判据只对 config 负责。
- 设计层是否想让它「藏在墙后但能隔墙开」：不可判；运行时语义是可开，判据不报。

---

### 3.2 `PLAYABILITY_COMPLETION_CHEST_NOT_COLLECTABLE`（评估候选；不注册为 completion）

**归属决定**：03 已注册 `PLAYABILITY_SPATIAL_CHEST_UNREACHABLE`（含 chest 作为 target、
`range`、严格盒重叠、walk / static motion 的修正）。完成性层只**消费** 03 的结果：
03 报 chest 不可取得时，completion 不再报一次。下面的算法 / 误报边界用于交叉验证 03，
并记录「如果 03 不做，completion 会怎么做」。

**问题**：必需 chest 在完成上界内是否能被任何可达位置 / 跳跃采样 overlap。

#### 1) 算法 / 输入 / 输出

输入：`GameConfig` + `AssetPackManifest` + **03 修好的移动图** + 复位边。

1. 对每个 chest 计算交互盒（同 3.1 第 1 步）。
2. 构造可达位置集合 `P`：
   - 移动图的所有可达落脚点 `v`；
   - 所有有效跳跃弧上的采样点（60Hz，步长 ≤ 1.5px；与 `reachability.ts:164-173` 同款）。
   - 复位边只回到 seeds，不新增位置，所以 `P` 不受影响。
3. 对每个 chest，检查是否存在 `p ∈ P` 使
   `playerRect(p) ∩ interactionRect ≠ ∅`。
4. 若不存在 → error。若交互盒完全被封死，witness 用 `blocked`（3.1 的证据）；
   否则用 `no-path`。
5. 若 03 的移动图覆盖为 `partial`（低天花板、moving solid、负坐标等），本判据
   必须落 `INSUFFICIENT_EVIDENCE`，不得硬拒。

输出形状：

```
{
  judgmentId: "PLAYABILITY_COMPLETION_CHEST_NOT_COLLECTABLE",
  target: `entity "${chest.id}"`,
  detail: "从出生点出发，用最宽移动上界都到不了它的交互区（没有任何可达落点/跳跃采样"
        + "能 overlap）；而 pickupCount 把它算作必需收集物。",
  witness: {
    kind: "no-path",
    interactionRect: {x,y,w,h},
    reachableNodes: N, reachableSamples: M,
    nearestReachable?: {x,y,dx,dy}
  },
  coverage: { spatial: "checked", mechanic: "checked|partial", completion: "checked|partial" }
}
```

#### 2) 判据 id 与失败定位

- 候选 id：`PLAYABILITY_COMPLETION_CHEST_NOT_COLLECTABLE`（仅在 03 不注册时使用）；
  生产 id 是 03 的 `PLAYABILITY_SPATIAL_CHEST_UNREACHABLE`。
- `target`：`entity "<chest-id>"` → `where`。
- `detail`：人话 → `message`。
- `witness`：`no-path`（含可达集摘要）或 `blocked`（完全封死时）。
- `coverage`：`completion` 至少 `checked`；`mechanic` 若继承了 04 的时序缺口则为 `partial`。
- 不带 `code`。

#### 3) 误报边界（合法硬设计为什么不会被判）

- **只要求 overlap，不要求「站得住」**：悬空 chest、必须在跳跃顶点穿过的 chest 都是合法的；
  只要弧采样能 overlap 就不报。§6 case 6 验证。
- **不要求视线（LoS）**：隔墙 + `range` 可开；§6 case 5 验证。
- **hazard/danger 不阻挡**：与 hazard 重叠的 chest 仍可开，复位保留计数；§6 case 17 验证。
- **复位边**：坑底 chest + 坑底 hazard，收完被复位回出生点再去 gate，是合法设计；
  §6 case 16 验证。没有复位边的模型会误报。
- **同时收集**：一次跳跃收多个目标由边标签处理；不会因为「收了一个另一个就漏了」误报。
- **chest 的 `body` 生效**：与运行时一致；不会把视觉盒当成碰撞盒。
- **moving solid 静态**：用静态初始盒；不把扫过行程当墙。
- **精细绕行/贴边**：如果实际能走到但图没建出边，会误报。这是继承 03 的 S6 / 绕行缺口，
  07 必须用合法边界夹具把它钉住。
- **mid-air touch-only**：目标只在一条「落不到任何落脚点」的弧上被碰到。本算法只认
  有效跳跃的弧；这种设计可能被误报。07 需要专门夹具；若真实存在，09 要么补
  「touch-and-return / touch-and-fall」边，要么把该情形降为 `INSUFFICIENT_EVIDENCE`。
- **负坐标**：目标在 `x<0` / `y<0` 时移动图不建模；运行时没有世界边界碰撞
  （`scene.ts:69-73`），不能证明不可达。必须 `INSUFFICIENT_EVIDENCE`。

#### 4) 分类

- **deterministic error**，但带**硬前提**：移动图必须是运行时移动的**上界**。
- 当前图上存在两个已知反例（低天花板走廊、moving solid 扫过区），所以本判据在
  03 修好之前只能产出 `INSUFFICIENT_EVIDENCE`；修好后才是硬 error。见 §7 / §10。

#### 5) 与现有规则冲突检查

- `pickupCount` 含 chest：一致。
- 03 已注册 `PLAYABILITY_SPATIAL_CHEST_UNREACHABLE`；本候选不是唯一实现，生产上由 03
  拥有 chest 可达判据，completion 只消费结果。
- 与 03 的 `PLAYABILITY_SPATIAL_CHEST_BLOCKED` / `..._CHEST_UNREACHABLE` 的关系：
  03 拥有 chest 空间判据；本候选只做交叉验证。生产上同一 chest 只产一条 error：
  先 BLOCKED，否则 UNREACHABLE（03 §4.2 的同目标去重规则）。completion 不再补第二条。
- 与 03 的 `covers` / 严格 overlap 规则：03 已把 `covers` 换成严格盒重叠，并为 chest
  定义了 `range` 交互盒；本候选应复用同一套判定。pickup/gate 也必须复用 03，
  不得在完成性层另造一套（否则会出现「同一个 goal 两套 overlap」）。
- 不改 `objective` / gate 派生 / `ConfigIssue.code`。

#### 6) 语料影响

- 53 个 chest 实例 / 34 配对 / 5 唯一 config；本票探针 0 不可达。
- 02 的 chest-as-pickup 探测同样 0 不可达。
- 03 探针（20 份唯一配对 config）：6 个 chest、0 个 error；其中 1 个 chest 带 `range:24`。
- 预计新增 error **0**；合成负例 `chest-sealed-in-solid` 触发。
- 不需要全量重判；03 与 08 共同确认 0 新增。

#### 7) 结构性不可判

- 设计层「这个 chest 是否本来可选」：不可判（C4）。
- 设计层「这个 chest 是否本来就不该在这个位置」：不可判（C6）。
- 「难但公平」的精确路线：不可判（02 §3.3）；只由 03 的移动图上界兜底。

---

### 3.3 `PLAYABILITY_COMPLETION_GATE_NOT_REACHABLE_AFTER_COLLECT`

**问题**：是否存在一条单次游玩走法，收齐**全部**必需 pickup/chest 后到达 gate；
包括「收集后回不到 gate」「多目标顺序不可满足」「gate 在收齐后不可重叠」。

#### 1) 算法 / 输入 / 输出

输入：`GameConfig` + `AssetPackManifest` + **03 修好的移动图** + 复位边 + chest 交互盒。

1. 构造 §2.2 的带标签图 `G`；必需集合 `T` 用 `pickupCount` 的同一口径
   （pickup + chest，`game-config.ts:267-268`）。
2. 起始 mask = `S(spawn) ∪ ⋃ S(seed)`；`R[mask] = seed 节点集`。
3. 复位边：对所有 `R(v)` / `R(e)` 命中的位置，加 `v → seeds`（`S=∅`），mask 不变。
4. 对 mask 做 §2.4 的闭包 / 转移，直到不动点。
5. `full = (1<<k)-1`；若 `R[full] ∩ GatePre ≠ ∅` → 找到完成走法，不报。
6. 否则：
   - 若某个必需 pickup/chest 在 03 的空间判据已报（`PLAYABILITY_SPATIAL_{PICKUP,CHEST}_
     {UNREACHABLE,BLOCKED}`）→ **抑制本判据**（同一根因，避免同一条目标报两遍）。
   - 若 gate 在 spatial 层已由 03 报（`PLAYABILITY_SPATIAL_GATE_{UNREACHABLE,BLOCKED}`）→
     **抑制本判据**（spatial 的 gate error 更基础）。
   - 若 04 已证明某个必需目标被静止 hazard 或全高 danger 封死
     （`PLAYABILITY_MECHANIC_PATH_BLOCKED` / `..._PATH_NO_SAFE_WINDOW`）→ completion
     不把「air 模型下可行」当反证；completion coverage 落 `partial`，aggregate verdict
     取 04 的 error。
   - 否则报 `GATE_NOT_REACHABLE_AFTER_COLLECT`，`target = entity "<gate-id>"`。
7. `k > 上限`（12）→ 完成顺序 `partial` / `INSUFFICIENT_EVIDENCE`，不硬拒。

输出形状：

```
{
  judgmentId: "PLAYABILITY_COMPLETION_GATE_NOT_REACHABLE_AFTER_COLLECT",
  target: `entity "${gate.id}"`,
  detail: "必需收集物都能单独取得，但不存在一条走法能收齐后再到达终点"
        + "（或收齐后 gate 不可重叠）……",
  witness: {
    kind: "no-path",
    required: [{id, kind}],
    collectableAlone: [...],
    trapTargets: [...],        // 例如：单向坑里那个 pickup/chest
    gatePre: { nodeCount, sampleCount },
    usedResetEdges: true
  },
  coverage: { spatial: "checked", mechanic: "checked|partial", completion: "checked|partial" }
}
```

#### 2) 判据 id 与失败定位

- id：`PLAYABILITY_COMPLETION_GATE_NOT_REACHABLE_AFTER_COLLECT`（稳定；`SUBJECT=GATE`，
  `FAILURE=NOT_REACHABLE_AFTER_COLLECT`）。
- `target`：`entity "<gate-id>"` → `where`；`detail` 点名 trapping 的 pickup/chest。
- `witness`：`no-path`，含必需集合、可达顺序、trapping 目标、GatePre 摘要。
- `coverage`：`completion` 至少 `checked`；若移动图有 S5/S6 缺口则 `partial`。
- 不带 `code`。

#### 3) 误报边界（合法硬设计为什么不会被判）

**不会被判的合法设计**（本票探针已覆盖）：

- **合法顺序存在，但不是任意顺序**：先上高台收 A，再掉到低层收 B，最后 gate；
  DP 找到 A→B→gate，不报。§6 case 14。
- **单向坑但 gate 在坑底同一层**：掉下去收完，直接到 gate；不报。§6 case 13。
- **单向坑 + 坑底 hazard 复位**：收完被复位回出生点，计数保留，再去 gate；不报。
  §6 case 16。这是 02 C2 没有覆盖的合法设计。
- **一次跳跃同时收多个 pickup**：边标签同时标记，不会误报「顺序不可满足」。§6 case 8。
- **chest 隔墙 + `range`**：不要求 LoS，不报。§6 case 5。
- **悬空 gate / 跳跃穿过 gate**：只要求 overlap，不要求站得住，不报。§6 case 10。
- **hazard/danger 挡路**：completion 的移动图按 reachability 的惯例把它们当空气，
  只把「接触 → 回出生点」作为复位边；因此 completion 不会因 hazard/danger 报错。
  如果 04 证明静止 hazard / 全高 danger 真的封死唯一通路，那是 04 的
  `PLAYABILITY_MECHANIC_PATH_BLOCKED` / `..._NO_SAFE_WINDOW`；completion 不覆盖、
  也不把 04 的 blocker 当作自己的误报。
- **chest 与 hazard 重叠**：开箱后复位，计数保留，不报。§6 case 17。
- **gate 提前被碰到但计数不够**：`tryWin` 不结算，玩家可以继续；模型不把 gate 当
  自动收集目标，不报。
- **难但公平的跳跃**：只要在 `jumpSpan` / `maxJumpHeight` 上界内，图会找到；
  不因难度报错。
- **moving solid**：运行时静态；用静态初始盒，不因扫过行程误报（03 修好后）。

**可能误报的边界**（必须在 07 的合法边界里钉住；不过就降级）：

- **低天花板 / 走路走廊**：现有图没有走路边（S6），可走走廊会被判不可达。
  §6 case 11 已复现：`p` 不可达、整体 no-walk。
- **chest 在 moving solid 扫过区、但不在静态盒里**：当前图把整段行程当实心（S5），
  §6 case 15 已复现 no-walk；运行时静态体并不挡它。
- **精细绕行 / 空中反向 / 贴边**：图的弧模型可能漏掉真实路线。
- **mid-air touch-only**：目标/ gate 只在一条落不到落脚点的弧上被碰到；模型可能漏。
- **负坐标 / 世界左/上边界外**：移动图不建模；不能证明不可达。
- **`k > 12`**：顺序未检查，必须 `INSUFFICIENT_EVIDENCE`，不能报 error。

#### 4) 分类

- **deterministic error**，带硬前提：移动图是运行时移动的上界（03），且 04 的机制结论
  不与之矛盾，且合法边界矩阵通过。
- 当前图上已复现两个误报（S5/S6），所以 03 修好之前只能 `INSUFFICIENT_EVIDENCE`；
  修好后才是硬 error。见 §10。

#### 5) 与现有规则冲突检查

- **`objective`**：不改；仍只有 `collect-then-reach` + `gate`。
- **`pickupCount`**：不改；必需集合直接复用 `pickupCount` 的口径（pickup + chest）。
- **gate 派生**：不改；只用 `objective.gate`，其他 goal 不参与。
- **现有 spatial gate target**：`auditReachability` 已经报「从出生点到不了 gate」；
  本判据只补「单独可达但收齐后不可达 / 顺序不存在」。若 spatial 已报 gate，抑制本判据。
- **既有测试边界**：`reachability.test.ts`「goal 埋在行李堆正中间（站不进去）也不报」
  是旧 `covers` 的故意宽边界。03 已决定在实施时把它改成
  `PLAYABILITY_SPATIAL_GATE_BLOCKED` 报一条（03 report §3.3 / §4.2）。
  **本判据必须复用 03 的 gate 判定**，不得在完成性层另造更严格的 gate overlap；
  测试更新由 03 / 09 统一做，completion 只消费结果。
- **warning 所有权**：不读、不升级台阶 / 行程 warning（framework §7.1）。
- **hazard/danger**：只作为复位边 / 空气；不判定「封死」；时序归 04。
- **`ConfigIssue.code`**：不加；`CONFIG_ISSUE_CODES` 闭集不变（`game-config.ts:316`）。
- **QA**：不新增 QA 判据；`QA_JUDGEMENTS` 仍 7 条（`qa.ts:111-160`）。
- **失败阶段**：`deterministic`（`config-audit.ts:44-55`），不得进 `resampleable`，
  否则会被当「模型错」重采样 3 发（B-02 的既有裁定）。

#### 6) 语料影响

- 96 配对 / 20 唯一 config；`k` 分布：1（4 份唯一）、3（8）、4（1）、5（3）、6（3）、
  9（1）；最大 k=9，在 12 的 DP 上限内。
- 本票探针：96 配对中 88 份 completable；8 份 no-walk **全部是
  `config-gate-missing` 负例**（`objective.gate` 指向不存在 id，gate=null）；
  这些已由 `auditReferences` 报 `objective.gate`（`game-config.ts:421-423`），
  完成性判据应跳过 / 不重复报。
- 20 份唯一 config：18 completable，2 份 `config-gate-missing` 负例；
  **有效 gate 的 no-walk = 0**。
- 53 个 chest 实例（34 配对 / 5 唯一）全部可取得；0 不可达。
- 结论：**有效语料新增 error 0**；8 个负例不是新误伤，是引用族的既有 error。
- 不需要全量重判；08 只需按此口径排除负例并确认 0 新增。

#### 7) 结构性不可判

- 设计层「应当先收什么、后收什么」：不可判；完成性只判**存在**某个顺序。
- 设计层「win 文本是不是 collect-then-reach」：不可判（C5）。
- 设计层数量 / 可选性：不可判（C4）。
- 设计层空间意图：不可判（C6）。
- hazard/danger 的安全窗口、玩家到达时刻：不可判（04 / 02 §3.3）。
- moving platform 乘坐：运行时未实现（02 M2）；不是完成性判据。
- 玩家技巧 / 逐帧物理 / 精确路线：不可判（02 §3.3）。
- 目标在 `x<0` / `y<0`：当前移动图不建模，`INSUFFICIENT_EVIDENCE`。

---

## 4. 候选矩阵（其余方向：合并、拒绝、移交）

| 候选方向 | 处理 | 分类 | 理由 / 证据 |
|---|---|---|---|
| **必需 pickup 不可取得** | 复用 03 的 `PLAYABILITY_SPATIAL_PICKUP_UNREACHABLE` / 严格 overlap 判据 | 空间层 deterministic | `auditReachability` 已把 pickup 当 target（`reachability.ts:124-129`）；03 负责 S3 / 包围 / 走路边。完成性不另造一套 pickup overlap，避免同一 pickup 两条 error。 |
| **gate 从出生点可达** | 03 的 `PLAYABILITY_SPATIAL_GATE_{UNREACHABLE,BLOCKED}` | 空间层 deterministic | gate 是现有 target（`reachability.ts:124-129`）；完成性只补「收齐后」与「顺序」，并消费 03 的 gate 判定。 |
| **`pickupCount` 与 HUD / 目标计数一致性** | 不注册判据 | 不是判据 | `pickupCount` 从实体派生（`game-config.ts:267-268`）；HUD pips（`world.ts:216,226`）、world objective（`world.ts:241`）、screen-space（`screen-space.ts:98`）三处同源；`Objective` 没有数量字段（`game-config.ts:228-232`）。构造上不可能不一致。`pickupCount===0` 已由 `game-config.ts:425-426` 报。设计层数量不可判（C4）。 |
| **chest 顺序约束** | 并入 `GATE_NOT_REACHABLE_AFTER_COLLECT` | completion | chest 无前置状态：近距自动开、一次性、只加计数（`scene.ts:315-333`）；gate 只查总数（`scene.ts:364-369`）。唯一顺序是路径顺序，已由一次走法 DP 覆盖。 |
| **gate 激活** | 并入 `GATE_NOT_REACHABLE_AFTER_COLLECT` | completion | `tryWin` 只查 `collected >= pickupCount`（`scene.ts:364-369`）；没有单独的「激活」状态。收齐 + 到达即胜；提前碰到 gate 不结算。 |
| **pickup/chest 被地形/实心体包围** | 03 的 `PLAYABILITY_SPATIAL_{PICKUP,CHEST,GATE}_BLOCKED` / `..._UNREACHABLE` | 空间层 deterministic | 03 已注册 chest / pickup / gate 的空间判据；完成性不注册，只消费。本票 §3.1 / §3.2 是交叉验证与备选。 |
| **pickup/chest 被机制包围** | 04 不注册（E） | 机制层 `INSUFFICIENT_EVIDENCE` | 04 §7：hazard 只复位、收集计数保留，同帧回调顺序不可证；语料有 pickup 与 hazard 相交的合法样本。completion 也不报；把 hazard 当空气 + 复位边。 |
| **目标在世界内** | 既有 `auditGameConfig.inWorld` | deterministic（既有） | `game-config.ts:533-539` 检查 terrain / entity / player 盒的**右边 / 底边**越出世界。不新增完成性判据；左/上越界不是 error，且移动图不建模负坐标 → `INSUFFICIENT_EVIDENCE`，不要硬拒。 |
| **目标「站得住」** | 拒绝 | 误报陷阱 | 目标只需要**可 overlap**，不需要能站。悬空 gate / 跳跃穿过的 chest 是合法设计（§6 case 6/10）。「站得住」会把它们全部误报。spawn 的落脚由 reachability seeds / `auditGameConfig` 负责，不是完成性。 |
| **多目标顺序不可满足** | 并入 `GATE_NOT_REACHABLE_AFTER_COLLECT` | completion | 一次走法 DP 覆盖；§6 case 7/14。 |
| **设计层数量 / 可选性** | 不注册 | 结构性不可判（C4） | `GameDesignSpec` 无 `count` / optional；config 的 pickup/chest 全部必需。不能把设计意图转成判据。 |
| **设计层 win/lose 文本** | 不注册 | 结构性不可判（C5） | `winConditions` / `loseConditions` 是自由文本；运行时只有 `collect-then-reach`。 |
| **设计 ↔ config 空间一致性** | 不注册 | 结构性不可判（C6） | `levels[].layout` 是自由文本、无坐标。 |
| **非 gate 的 goal / decor** | 不注册 | 结构性不可判（C7） | 运行时只认 `objective.gate`（`world.ts:178-186`）；其他 goal 合法且只画。设计意图无法对账。 |
| **静止 hazard 封死唯一通路** | 04 的 `PLAYABILITY_MECHANIC_PATH_BLOCKED` | 机制层 deterministic（退化） | 04 §3；completion 的 air 模型会漏掉它，但 aggregate verdict 取 04 的 error，completion 不得用「可行」反驳。 |
| **全高 danger 无安全窗口** | 04 的 `PLAYABILITY_MECHANIC_PATH_NO_SAFE_WINDOW` | 机制层 deterministic（退化） | 04 §4；其余 danger 时序 `INSUFFICIENT_EVIDENCE`。 |
| **moving platform 乘坐** | 04 不注册 / 03 静态 | 机制层 | 运行时 `solid` 从不推进 motion（`scene.ts:149-150`）；`moving-platform` 不在 `RUNTIME_IMPLEMENTED_MECHANICS`（02 M2）。不是完成性判据。 |
| **`body` 覆盖语义** | 由 03 / 04 裁决；完成性只按运行时几何读 | 非判据 | pickup/goal 忽略 `body`（`scene.ts:151-174`），chest 用 `body`（`world.ts:178` / `scene.ts:175-185`）。完成性不新造 body 规则；读运行时几何。 |

---

## 5. 完成性如何收紧现有可达性上界

### 5.1 现有判据只回答「每个目标单独从出生点够不够得到」

`auditReachability` 对每个 pickup 与 gate 做一次 BFS，只报「不在可达集里」
（`reachability.ts:124-137, 215-224`）。它**不要求这些目标出现在同一条走法里**。
因此：

- 单向坑可以同时满足「spawn → pickup」与「spawn → gate」，却无法在一次游玩里完成
  （02 probe B）。
- 02 的 `auditReachability` 里 chest 根本不在 target 里（S1 / C1）；03 已把 chest
  加入它的空间 target（`PLAYABILITY_SPATIAL_CHEST_UNREACHABLE/BLOCKED`）。
- gate 的计数门槛没有参与（C3）；虽然「spawn → pickup → gate」是传递可达的，
  但独立 BFS 不会验证这条复合路径。

### 5.2 完成性加的是「一次走法」的全称约束，不是新的移动假设

完成性判据**不收紧移动模型**：

- 仍使用同一套跳跃弧 / 落脚点 / `jumpSpan` / `maxJumpHeight` 上界。
- hazard/danger 仍当空气；复位边只会**增加**可能性（更宽松），不会把合法设计判死。
- 不要求 LoS、不要求目标可站立、不要求精确时机。
- 完成性层本身不新增几何：chest 的运行时交互盒（box + range）由 03 的空间判据提供，
  pickup / gate 的严格重叠也由 03 提供。完成性只消费这些目标判定，再加路径顺序。

它加的是：

1. **必需集合 = pickup ∪ chest**（与 `pickupCount` 同源）。
2. **同一条走法**必须收集全部必需集合，再到达 gate。
3. **收集是强制的**：经过即收集；一次跳跃可同时收多个（边标签）。
4. **hazard/danger 复位**可作为回出生点的边，计数保留。
5. **gate 只在收齐后结算**；提前碰到不算。

这些都是运行时事实，不是设计口味。因此「no-walk」是可靠的那半句话；
「找到走法」仍只是上界内的可行，不等于已证明可玩（framework §3.2）。

### 5.3 不误伤的条件

要在上界内收紧而不误伤，必须同时满足：

1. **移动图是上界**：补走路 / clearance 边（S6），solid 按静态语义（S5），
   覆盖精细绕行 / 空中反向的可行路线；否则 §6 的两个合法反例会误报。
2. **目标几何与运行时一致**：chest 用 `body ?? size` + `range`；pickup/gate 用帧尺寸
   并忽略 `body`（S7）；chest 隔墙可开（无 LoS）。
3. **复位边**：hazard/danger 复位到 spawn、计数保留；否则会误报「坑底收完回不来」。
4. **同时收集**：边标签同时标记多个目标；否则会误报「一次跳跃收两个」的顺序不可满足。
5. **gate 判定复用 03**：不要在完成性层另造一个比 spatial 更严格的 gate overlap。
   03 已决定把既有「goal 埋在行李堆里也不报」改为 `PLAYABILITY_SPATIAL_GATE_BLOCKED`
   报一条；completion 只消费 03 的结果，测试更新由 03 / 09 负责。
6. **k 上限**：超过上限时顺序未检查，必须 `INSUFFICIENT_EVIDENCE`，不能报 error。

本票探针逐条验证了 2–4；1 的两个反例仍然存在，是 03 / 07 的前置条件。

---

## 6. 合成正/负例证据（E3）

命令：

```bash
node .scratch/level-playability-v1/research/05-completion-probe.mjs synthetic
# exit 0
node .scratch/level-playability-v1/research/05-completion-probe.mjs corpus
# exit 0
```

探针复用 `auditReachability` 的移动公式（实心体、脚点、`jumpSpan`、弧采样），
额外记录每个落脚点 / 每次跳跃收集到哪些目标，以及 hazard/danger 复位接触。
它是 scratch 研究仪器，不是生产实现。

### 6.1 synthetic 结果

| # | case | 期望 | 探针结果 | 说明 |
|---|---|---|---|---|
| 1 | baseline-last-train | completable | completable | 真夹具 3 pickup + gate |
| 2 | one-way-pit-pickup | no-walk | no-walk | 02 probe B；无复位机制 |
| 3 | one-way-pit-chest | no-walk | no-walk | chest 版本 |
| 4 | chest-sealed-in-solid | not collectable | no-walk + `unreachable: sealed-chest` | 03 `PLAYABILITY_SPATIAL_CHEST_BLOCKED` 目标 |
| 5 | chest-behind-wall-with-range | completable | completable | 无 LoS；range 可开 |
| 6 | chest-midair-jumpthrough | completable | completable | 不要求站得住 |
| 7 | two-one-way-branches | no-walk | no-walk | 两个 pickup 各自可达但收不齐 |
| 8 | two-pickups-one-arc | completable | completable | 同时收集，不误报顺序 |
| 9 | gate-sealed-in-solid | no-walk | no-walk | 03 已决定把既有「goal 埋行李堆也不报」改成 `PLAYABILITY_SPATIAL_GATE_BLOCKED` 报一条 |
| 10 | gate-midair-jumpthrough | completable | completable | 只要求 overlap |
| 11 | low-ceiling-walkable | completable（真设计） | **no-walk + `p` 不可达** | **已知误报**：S6 无走路边 |
| 12 | pickup-body-override-runtime-ignores | completable | completable | pickup 运行时忽略 `body` |
| 13 | one-way-pit-gate-on-pit-floor | completable | completable | 单向坑本身不是错 |
| 14 | order-required-high-then-low | completable | completable | 强制 A→B→gate 的顺序存在 |
| 15 | chest-inside-moving-solid-sweep | completable（真设计） | **no-walk + chest 不可达** | **已知误报**：S5 solid 扫过整段 |
| 16 | pit-chest-with-reset-hazard | completable | completable | 需要复位边；否则会误报 |
| 17 | chest-overlapping-hazard | completable | completable | hazard 不阻挡，开箱后复位、计数保留 |

**结论**：15/17 符合预期；2 个反例（11、15）正是 03 的 S5/S6 缺口，
不是完成性判据本身的新假设错误。它们必须在 07 的合法边界里保留，并作为
03 修复 / 09 启用的前置条件。

### 6.2 corpus 结果

| 指标 | 数值 |
|---|---|
| 配对 config | 96 |
| 唯一 config | 20 |
| 唯一 config 的 k 分布 | 1:4 · 3:8 · 4:1 · 5:3 · 6:3 · 9:1 |
| completable（配对 / 唯一） | 88 / 18 |
| no-walk（配对 / 唯一） | 8 / 2 |
| no-walk 且 gate 有效 | **0** |
| no-walk 的 8 份 | 全部 `config-gate-missing`（`objective.gate` 不存在，gate=null） |
| chest 实例（配对 / 唯一） | 53 / 6 |
| chest 不可达 | **0** |
| 目标资产解析失败 | 0（96 配对全部解析） |
| k 最大值 | 9 |
| 单 config 最慢 / 总耗时 | 916ms / 8424ms（仅供参考，scratch 实现） |

8 份 no-walk 不是完成性新误伤：`objective.gate` 缺失已由 `auditReferences`
报 error（`game-config.ts:421-423`）。完成性判据在 gate 不存在时应跳过 / 由引用族
Ownership，不重复报。

**跨层说明**：本探针的 completion 模型按 reachability 的惯例把 hazard/danger 当空气
（只加复位边），因此这里没有 04 的静态 hazard / 全高 danger 命中。04 的探针在同一
20 份唯一 config 里对 3 个历史产物 + 若干 probe 夹具另有机制层命中；那是
`PLAYABILITY_MECHANIC_*`，不是完成性误报，aggregate verdict 由 04 的 error 决定。

---

## 7. 证据清单

### 7.1 E1（file:line）

- 目标 / 计数 / gate：
  `game-config.ts:228-232`（Objective）· `:267-268`（pickupCount）·
  `:421-423`（gate 引用）· `:425-426`（0 件）·
  `scene.ts:364-369`（tryWin 计数门槛）。
- 收集：
  `scene.ts:151-155`（pickup）· `:175-185`（chest）· `:315-325`（chest overlap + range）·
  `:327-333`（openChest）· `:334-340`（collect）。
- 复位：
  `scene.ts:342-362`（hitHazard，不重置 collected）· `:287-309`（danger active）。
- 几何：
  `world.ts:178-186`（`e.body ?? assetSize`、`range`、`wins`）·
  `game-config.ts:121-126`（body / motion / range / strike）·
  `game-config.ts:151`（entityBox）。
- 移动 / 上界：
  `reachability.ts:60-73`（实心体）· `:103-122`（落脚点）· `:124-137`（targets / covers）·
  `:139-175`（hop）· `:177-198`（seeds）· `:200-213`（BFS）· `:215-224`（只报够不到）。
- 运行时：
  `scene.ts:69-73`（相机 bounds，无 world bounds）· `:79-96`（移动 / 跳跃）·
  `:149-150`（solid 静态）· `:211-229`（玩家 body）。
- 分档 / 集成：
  `config-audit.ts:44-55`（reachability 在 deterministic）·
  `publish-gate.ts:140`（发布闸只重跑 reachability）·
  `qa/src/gameplay.ts:80`（QA standalone 仍只跑 reachability）·
  `game-config.ts:316`（ConfigIssue code 闭集）·
  `qa.ts:111-160`（7 条 QA 判据）。

### 7.2 E2（既有测试名 + 断言）

- `packages/contracts/tests/reachability.test.ts`
  - 「真夹具：这一关是通的」→ `expect(reach(CONFIG)).toEqual([])`。
  - 「扫过的车厢（`hazard`）当空气」→ `expect(reach(CONFIG)).toEqual([])`。
  - 「挖一条 200px 的沟 ⇒ …」→ `who(bad)` 含 `entity "signal"` / `suitcase-1..3`。
  - 「40px 的沟 / 40px 的墙 / 50px 的 pickup ⇒ 不报」→ `toEqual([])`。
  - 「出生点附近没有任何落脚点 ⇒ 一条都不报」→ `toEqual([])`。
  - 「goal 埋在行李堆正中间（站不进去）也不报」→ `toEqual([])`。
    注意：这是旧 `covers` 的**故意宽**边界；03 已决定实施时改成
    `PLAYABILITY_SPATIAL_GATE_BLOCKED` 报一条，测试更新由 03 / 09 负责；
    completion 复用 03 的 gate 判定，不单独翻它。
  - 「玩家资源解不到 ⇒ 也不报」→ `toEqual([])`。
- `packages/contracts/tests/game-config.test.ts`
  - 「`pickupCount` 从实体派生 —— 数量不重复声明」→ `expect(pickupCount(base())).toBe(3)`。
  - 「票 13：`pickupCount` 数 pickup **和** chest」→ `expect(pickupCount(c)).toBe(4)`。
- `packages/demo/tests/world.test.ts`
  - 「`range` 缺省 0（交互区 = 实体盒子本身），给了就照实带」→ `expect(chest.range).toBe(12)`。
  - 「`pickupCount` 数到 chest —— objective 与 HUD 槽位同源」→
    `expect(w.objective.pickupCount).toBe(4)`、`expect(w.hud.pips).toHaveLength(4)`。
- `packages/demo/tests/shell-capability-witness.test.ts:38`
  - objective witness needle：`this.collected < world.objective.pickupCount`。
- `packages/demo/tests/shell-mechanic-witness.test.ts:32`
  - `open-chest` witness needle：`this.openChest(c)`。
- `packages/contracts/tests/config-audit.test.ts`
  - 「不可达 config：每条 reachability error 都在 deterministic 里」→ `toContainEqual`。
  - 「不可达 config：reachability error 一条都不进 resampleable」→ `filter(...) = []`。
- `packages/qa/tests/gameplay.test.ts`
  - 「挖一条 200px 的沟 ⇒ 一条 error，detail 里逐条点名够不到的实体」→ `toMatch(/够不到/)`。
- `packages/demo/tests/shell-scene-wiring.test.ts`
  - 「hitHazard 用 body.reset 同步物理体与 prev，并按 floorY 校正脚线」→ 包含 `.reset(`。
    注意：这条不验「collected 保留」，后者是 E1 `scene.ts:342-362`。

### 7.3 E3（零付费探针）

- `node .scratch/level-playability-v1/research/05-completion-probe.mjs synthetic` → exit 0；
  17 个合成 case，15 符合预期，2 个已知 03 缺口误报（§6.1）。
- `node .scratch/level-playability-v1/research/05-completion-probe.mjs corpus` → exit 0；
  96 配对 / 20 唯一；有效 gate no-walk 0；chest 不可达 0；8 个 gate-missing 负例由引用族负责。
- 未修改生产代码、fixture、历史产物；未调用模型 / 生图 / 站点重建；未使用 Agent 试玩。

---

## 8. 契约 / 规则冲突检查汇总

| 规则 | 完成性是否冲突 | 处理 |
|---|---|---|
| `Objective` 只有 `kind` + `gate` | 不冲突 | 不新增 count / goal kind / 字段 |
| `pickupCount` 派生 | 不冲突 | 必需集合直接复用同一口径（pickup + chest） |
| HUD pip 数量 | 不冲突 | 同源派生（`world.ts:216,226`；`screen-space.ts:98`）；无新判据 |
| gate 引用 | 不冲突 | 复用 `auditReferences` / `auditReachability` 的 gate 判定 |
| 既有 pickup / gate target | 不重复 | pickup / chest / gate 的不达归 03；完成性只补一次走法 |
| 既有「goal 埋行李堆」宽边界 | 03 已裁决 | 03 实施时改成 `PLAYABILITY_SPATIAL_GATE_BLOCKED` 报一条；completion 复用 03，不另造 gate overlap |
| `auditGameConfig.inWorld` | 不重复 | 越界仍由自洽族报；完成性不新增 out-of-world error |
| `auditGameConfig` 台阶 / 行程 warning | 不升级 | 完成性不读、不升级 warning（framework §7.1） |
| `ConfigIssue.code` 闭集 | 不冲突 | 不加 code；`CONFIG_ISSUE_CODES` 不变（`game-config.ts:316`） |
| `deterministic` vs `resampleable` | 必须放对 | 完成性必须进 `deterministic`（`config-audit.ts:44-55`），否则重采样 3 发 |
| QA 7 条 | 不新增 | 不改 `QA_JUDGEMENTS`；QA standalone 仍只跑 `auditReachability` |
| 发布闸 | 需改调用 | `publish-gate.ts:140` 只调 `auditReachability`；09 改为 `auditPlayability` |
| 汇合点 / compile | 自动覆盖 | `auditConfigPipeline` 若替换 reachability，`ops.ts` / `create-game.ts` 自动覆盖 |
| 04 的静态 hazard / danger 窗口 | 不覆盖 | completion 的 air 模型可能漏；aggregate verdict 取 04 的 error，completion 不得用「可行」反驳 |
| standalone `assembleSite` | 残余风险 | 需 09 决定是否接线；不接线则直调不过闸 |

---

## 9. 结构性不可判 / 必须 `INSUFFICIENT_EVIDENCE` 的完成性面向

1. **设计层数量**：`GameDesignSpec` 没有 `count` 字段；config 的数量是派生的（C4）。
2. **pickup / chest 的可选性**：设计没有 optional 字段；config 全部必需（C4）。
3. **win / lose 文本**：自由文本，运行时只有 `collect-then-reach`（C5）。
4. **设计 ↔ config 空间一致性**：`levels[].layout` 无坐标（C6）。
5. **设计意图**：为什么这个 chest 在这里、为什么 gate 放那边 —— 不可判。
6. **难度 / 路线优劣 / 体验**：观察，不是判据。
7. **精确操作 / 逐帧物理 / 起跳时机 / 空中反向**：不可判（02 §3.3）。
8. **hazard / danger 的安全窗口与到达时刻**：04 / `INSUFFICIENT_EVIDENCE`。
9. **moving platform 乘坐**：运行时未实现（02 M2）；不是完成性。
10. **目标在 `x<0` / `y<0`**：移动图不建模，且运行时没有世界边界碰撞；不能证明不可达。
11. **mid-air touch-only**（目标只在落不到落脚点的弧上被碰到）：当前模型可能漏；
    需要 07 夹具；若确认合法，09 补 touch-and-fall 边或降级。
12. **k > DP 上限**：顺序未检查，必须 `partial` / `INSUFFICIENT_EVIDENCE`。

注意：`NO_PROVEN_BLOCKER` 永远不是 `PROVEN_PLAYABLE`；coverage 必须显式记录
`completion: partial` / `not-checked` 的原因。

---

## 10. 对 07（合成负例 / 合法边界矩阵）的升级

### 10.1 必须加入的合法边界（预期 `NO_PROVEN_BLOCKER`）

| case | 最小改动 | 关键点 |
|---|---|---|
| 低天花板走路走廊 | 02 probe F | 现有图会误报；必须由 03 的 walk 边修复 |
| chest 在 moving solid 扫过区、不在静态盒 | §6 case 15 | 现有图会误报；必须由 03 的静态 solid 修复 |
| 坑底 chest + 坑底 hazard 复位 | §6 case 16 | 复位保留 collected；没有复位边会误报 |
| 单向坑 + gate 在坑底同层 | §6 case 13 | 单向地形本身不是错 |
| 强制 A→B→gate 的顺序 | §6 case 14 | 存在顺序就不报 |
| 一次跳跃收两个 pickup | §6 case 8 | 同时收集不能被判成顺序不可满足 |
| chest 隔墙 + range | §6 case 5 | 无 LoS 要求 |
| 悬空 chest / gate 跳跃穿过 | §6 case 6 / 10 | 只要求 overlap，不要求站得住 |
| chest / pickup 与 hazard 重叠 | §6 case 17 | hazard 不阻挡；开箱后复位、计数保留 |
| pickup 带 `body` 覆盖 | §6 case 12 | pickup 运行时忽略 body |
| 40px 墙 / 40px 沟 / 50px pickup | `reachability.test.ts` 既有 | 完成性不得把既有的合法边界翻红 |

### 10.2 必须加入的负例（预期 `PROVEN_UNPLAYABLE` + 预期判据）

| case | 最小 fixture | 预期判据 | 预期定位 |
|---|---|---|---|
| chest 交互区完全封死 | §6 case 4 | 03 `PLAYABILITY_SPATIAL_CHEST_BLOCKED` | `entity "sealed-chest"` |
| 单向坑 pickup / chest + gate 在远侧 | §6 case 2/3 | 03 `PLAYABILITY_SPATIAL_{PICKUP,CHEST}_UNREACHABLE`（若目标本身在坑里可达，则用 `GATE_NOT_REACHABLE_AFTER_COLLECT`） | 对应 chest / gate |
| 两条互不连通的单向岔路 | §6 case 7 | `GATE_NOT_REACHABLE_AFTER_COLLECT` | `entity "<gate>"`，detail 点名两个 pickup |
| gate 只在收齐前可达（单向下落） | 由 case 2 改 gate 位置 | `GATE_NOT_REACHABLE_AFTER_COLLECT` | `entity "<gate>"` |
| gate 缺失 / 指向不存在 id | corpus `config-gate-missing` | **不是完成性**：`auditReferences` 的 `objective.gate` | `objective.gate` |
| gate 埋进实心体 | §6 case 9 | 03 `PLAYABILITY_SPATIAL_GATE_BLOCKED`；完成性不另造 | `entity "<gate>"` |

### 10.3 07 必须做的裁决

1. **既有 `reachability.test.ts`「goal 埋在行李堆正中间也不报」**：03 已决定实施时改成
   `PLAYABILITY_SPATIAL_GATE_BLOCKED` 报一条。07 的负例按 03 的裁决写；completion
   只消费 03 的 gate 判定，不再单独决定翻不翻。
2. **低天花板 / moving solid 两个合法反例**：在 03 修好之前，完成性必须
   `INSUFFICIENT_EVIDENCE`；07 的矩阵要把这条「不硬拒」写成预期。
3. **mid-air touch-only**：需要至少一个合法边界夹具；若通过，09 补边；若不通过，
   该情形降级，不得作为硬 error。

---

## 11. 对 09（最小实施方案）的升级

1. **顺序**：先做 03 的移动图修复（walk / clearance 边、solid 静态语义、body 语义、
   接触采样）与 03 的 chest / gate 判据，再启用 `GATE_NOT_REACHABLE_AFTER_COLLECT`。
   03 的 `CHEST_BLOCKED` 不依赖移动图，可先上线；completion 不注册 chest id。
2. **入口**：按 framework §6，放在 `auditPlayability`，**替换** `auditConfigPipeline`
   里的 `auditReachability`（`config-audit.ts:53`），不要并列；发布闸
   `publish-gate.ts:140` 改调 `auditPlayability`。compile 循环 / 汇合点经
   `auditConfigPipeline` 自动覆盖。
3. **QA 不变**：`qa/src/gameplay.ts:80` 仍只跑 `auditReachability`；
   QA standalone 看不到完成性 error，这是残余风险，09 要明写。
4. **算法**：本票的 mask DP（上限 12）可作为参考实现；语料最大 k=9，性能足够。
   若 09 想避免 `2^k`，可用「共享目标节点 + SCC 缩点 + DAG 链检查」的多项式版本；
   两者都必须保持「只报 no-walk」的方向。
5. **复位边**：完成性图要加 hazard/danger 复位边（回 seeds、mask 不变），
   否则会误报 §6 case 16。
6. **去重 / 优先级**：
   - 所有空间不可取得（pickup / chest / gate）：03 报；completion 抑制。
   - chest 封死 vs 不可取得：03 先 BLOCKED，否则 UNREACHABLE；同 target 一条 error。
   - 04 的静止 hazard / danger 窗口 blocker：04 报；completion coverage `partial`，
     aggregate verdict 取 04。
   - gate 不存在：引用族报；completion 跳过。
7. **coverage**：`completion` 在 k > 12、目标负坐标、移动图 partial、mid-air touch-only
   未验证时为 `partial`；不得因为「没有 error」而标 `checked`。
8. **既有测试**：`reachability.test.ts` 的「goal 埋行李堆」边界由 03 的实施统一改成
   `PLAYABILITY_SPATIAL_GATE_BLOCKED`；completion 不单独翻它。
9. **契约**：不加 `ConfigIssue.code`，不改 `Objective`，不新增 goal kind，
   不新增 QA 判据，不落盘 `PlayabilityVerdict`。判据 id 只进内部注册表。
10. **回退**：每条判据独立可回退；若某条误伤，降为 `INSUFFICIENT_EVIDENCE`，
    不影响另一条（例如保留 03 的 `CHEST_BLOCKED`，关掉 completion 的 gate 顺序判据）。

---

## 12. 残余风险

- **低天花板 / moving solid 误报**：在 03 修好之前，完成性图判据不能硬拒；这是本票
  最大的前置条件。
- **精细路线 / 空中反向 / 贴边 / mid-air touch-only**：移动图不是严格上界；需要 07
  夹具与 03 的边界决定。
- **负坐标目标**：运行时没有世界边界碰撞，移动图不建模；只能 `INSUFFICIENT_EVIDENCE`。
- **既有 gate 宽边界**：`covers` 会放行埋在 solid 里的 gate；完成性复用 03 的判定，
  不单独收紧；这是一条已知 miss，不是新增误伤。
- **QA standalone**：仍只跑旧 reachability；完成性 error 不会出现在 QA 报告里。
- **standalone `assembleSite` 直调**：若 09 不接线，仍不过闸（framework §4.2 的残余风险）。
- **hazard / danger 时序与静止 hazard 封死**：完成性把它们当空气 + 复位边；如果静止 hazard
  或全高 danger 实际上封死唯一通路，完成性不会报（04 的
  `PLAYABILITY_MECHANIC_PATH_BLOCKED` / `..._NO_SAFE_WINDOW`）。aggregate verdict 取 04 的
  error；completion 的「可行」不是对 04 的反证。
- **设计层意图**：数量、可选性、win 文本、空间布局都不可判；不要用观察补造。
