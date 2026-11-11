# I02-D3 安全通过 Witness 模型裁定

Type: grilling
Status: resolved
Owner: claude + user (wayfinder grilling session 2026-11-11)
Blocked by: 07, 08, 04, 19, 20
Map: ../map.md
Class: I-02 / DECISION

## Question

冻结「安全通过 Witness」的搜索模型与验证语义。I-02 需求 I02-02 要求每段路径带可验证的起止状态与时间区间，且等待阶段也参与碰撞检查；本票决定这些路径段从哪里来、在什么空间里搜索。

### 必须裁定

1. **搜索空间**：1D 走廊（P0 模型）还是 V1 2D 图（walk / walk-off / fall / hop）。
   - 若 1D：走廊如何从 config / graph 派生；排除哪些移动；排除后为何仍是保守的。
   - 若 2D：时间如何附着到图上；hop / fall 的时长如何建模；是否引入精确时序（I-02 非目标）。
2. **路径段类型**：等待、水平移动、必要的路径段（是否含 walk-off / fall / hop）；每段的起止状态与时间区间。
3. **段内玩家运动**：线性、最大速度、无加速度、瞬时转向；hop 是否只作可达性上近似（不消费时间维度）。
4. **等待安全**：等待段必须逐段碰撞检查；U9 安全等待格如何进入 Witness。
5. **连接连续性**：位置、时间、状态在段连接处必须连续。
6. **起点合法性与目标区域**：从合法初始状态出发，到达目标通过区域。
7. **完整性**：所有段通过连续时间验证才算 Witness；部分路径 / 未完成路径 / 未验证候选不得提升；预算耗尽时即使有候选也按完整证明处理。
8. **与 D1 的一致性**：Witness 的量化方向必须与 D1 裁定一致。
9. **Witness 数据形状**：供 D9 冻结内部契约。

### 产出

票内 `## Answer`：搜索模型、段语义、验证义务、反例清单。

### 下游

I02-D6、I02-D7、I02-D8、I02-D9、I02-AUTH。

## 相关证据

- [I02-03 连续时间求交可行性实验](../evidence/03-continuous-intersection.md)：闭式解与代价（F1）、开区间严格语义（F2）、跨折返点合并（F3）、任意小安全窗口（F4）、`lagMs` 的保守 pad vs 精确 ∃δ（F6）。§9 只给事实，裁定仍在本票。

## 相关证据

- [I02-05 性能与预算基线采集](../evidence/05-performance.md)：若搜索空间选“移动图脚点 × 相位”，容量约为 x 网格的 2 倍，`W=5760` 外推 ≈1.15M；搜索空间选择与 `maxStates` 预算在 D5 处耦合。

## 上游裁定（D2）

- [I02-D2 运动模型与输入契约裁定](08-i02-d2-motion-input-contract.md)：Goal Rect 采用空间层取整盒；到达谓词必须处理取整盒与未取整玩家盒的 ≤0.5px/边差异；起点安全与“对所有 φ0”判据归本票；玩家/hazard coverage 仍 `partial`（不得据此宣称 U9/W 的玩家几何门槛已满足）。

## Answer

用户 2026-11-11 逐题裁定。Q1–Q12 全部冻结；其中 **Q2 按用户修正**（禁止 `round(foot)` 静默改变真实 spawn），**Q1 / Q5 补入「静态连续碰撞义务」**。**修改产品目录：否**（仅本票、地图、`CONTEXT.md` 词条；未触碰 `packages/**`、Runtime、CLI、MCP、公共 Contract、I-00 / I-02 原文）。

> 本票只冻结 Witness 的**搜索模型与验证语义**，不代表 I-02 已实现或验收，不自动授权 I02-02～I02-05，更不授权 I-03 生产接入；首次签署仍只授权 I02-01。
> I-02 仍只产**模型条件性结果**（D2 §10），不得据此发布正式 `NO_PROVEN_BLOCKER` / `PROVEN_UNPLAYABLE`。

### 0. 裁定总览

| 题 | 裁定 | 冻结要点 |
| --- | --- | --- |
| Q1 | A + 修正 | W 走廊 = spawn 脚点 y 上 `standable` 连续段；**格点连通不等于连续安全**，每条 move 必须连续检查 `graph.solids`。 |
| Q2 | A + 修正 | 真实 spawn 不得被取整改写；脚点 x 非整数格 ⇒ IE `spawn-not-on-lattice`；禁止 `startCells()` 宽松多起点。 |
| Q3 | A | 栅格锚在脚点整数格；状态可存左边缘，但由 `footX − w/2` 确定。 |
| Q4 | A | 段原语只有 `wait` / `move`；无 hop / walk-off / fall。 |
| Q5 | A + 修正 | 恒速线性、速度 ∈ `[0, maxSpeed]`、瞬时反向；每条边恰好一个相位格；只在状态边界判到达；静态连续检查同样适用于每条 move。 |
| Q6 | B | 到达 = 未取整玩家盒与四边内缩 0.5px 的取整 Goal Rect 严格相交。 |
| Q7 | A | Witness 以相位格 `k` 为符号起点；残差等待对整格位姿范围保守验证；跨折返点切段。 |
| Q8 | A | 统一 `overlapsStrict`、无 ε；任意正宽度碰撞开区间即失败；点相切安全；无最小安全窗口。 |
| Q9 | A | 全可达状态/转移验证 + 终止性 + 确定性排序；预算耗尽即使有验证前缀也只 IE。 |
| Q10 | A | 规范产物 = 策略表 + 逐转移验证记录 + 终止 rank + 可重放验证器输入；路径族是派生视图。 |
| Q11 | A | U9 复用同一 Witness 信封，`certificate: "u9"`，段带 `phaseChoice`。 |
| Q12 | A | 每档 lag 独立 Witness，禁止跨档拼接；字段清单交 D9 冻结类型。 |

### 1. 形式化状态与段模型（Q1、Q3、Q4、Q5、Q9）

#### 1.1 状态

```text
state = (footX, k)
  footX ∈ ℤ ∩ 𝕏_corridor             // 脚点 x，整数格
  k     ∈ ℤ_N, N = 周期相位数
  footY = spawn 脚点 y                // 全程固定
  playerBox(footX) = boxFromFoot({ x: footX, y: footY }, player.size)
                   = { x: footX − w/2, y: footY − h, w, h }
```

- `xStep = 1px` 指**脚点 x** 的整数格（`latticeAnchor: "foot-x"`），与 `graph.ts` 的脚点格同分辨率。
- 状态可以保存玩家盒左边缘 `x_left = footX − w/2`，但它必须由脚点坐标与玩家宽度确定，不得独立取样。
- 每个状态必须满足 `standableAt(footX, footY)`；走廊内不满足的格点不是合法状态。

#### 1.2 转移（只有两种）

- `wait(x, k) → (x, (k+1) mod N)`：`x(t) = x`，时长 `dt`。
- `move(x, k) → (x', (k+1) mod N)`：`x(t) = x + (x' − x)·(t − k·dt)/dt`，恒速，速度 `|x' − x| / dt ≤ maxSpeed`，方向任意，允许瞬时反向，不建模加速度。
- 每条转移恰好占用一个相位格 `[k·dt, (k+1)·dt]`（加任意整周期偏移）。
- **不引入第三种原语**：hop / walk-off / fall / 改变脚点 y 一律模型外；需要它们才能到达目标 ⇒ W / U9 不成立 ⇒ IE。

#### 1.3 每条转移的四项验证义务

| 编号 | 义务 | 失败语义 |
| --- | --- | --- |
| S1 | **静态连续碰撞**：`∀t ∈ [t0,t1]`，`playerBox(x(t))` 不与 `graph.solids` 中任一盒严格相交。 | 该转移无效 ⇒ 无 Witness |
| S2 | **Hazard 连续碰撞**：按折返点切段；Hazard x 范围按 `lagPad` 外扩后，与玩家盒做解析开区间求交；任意正宽度碰撞区间即失败。 | 同上 |
| S3 | **相位 / 时间**：区间恰为一个相位格；Hazard 位置由 D2 三角波模型给出；不得跨格。 | 同上 |
| S4 | **连续性**：`t1_prev = t0_next`、`x1_prev = x0_next`、相位格恰好前进 1（mod N）、玩家 y 与玩家盒定义不变。 | 同上 |

**用户 2026-11-11 强调**：`standable` 只管离散格点；它**不**证明两个格点之间的连续移动安全。每条 `move` 都必须单独执行 S1，即使起点与终点都 `standableAt`。例如 `maxSpeed·dt = 10px` 时，一条从 `footX=10` 到 `footX=20` 的 move 可以跨过位于 `x=15` 的实心体；只查端点会漏掉，S1 必须抓住。

`S1` 对每条 solid：玩家盒 x 区间随 `t` 线性移动，solid 的 x/y 区间静态；y 重叠是静态门槛，x 严格重叠的 `t` 集合是至多一个开区间。任意正宽度 ⇒ 失败。几何来源是 `graph.solids` 的同一批盒；`coverage.spatial` 仍如实记为 `partial`，不得因本检查提升。

### 2. W 的静态走廊（Q1）

- W 的 x 域 = 基础移动图中，与 spawn 具有**相同脚点 y** 的 `standable` 连续段（水平连通、含 spawn）。
- 目标（到达状态集，见 §4）不在该段内 ⇒ W 不成立 ⇒ `INSUFFICIENT_EVIDENCE`；**不得据此推导 PU**。
- 诊断记录：

```text
staticCorridor: {
  footY,
  xLo,
  xHi,
  source: "standable-run"
}
```

- **对 D10 §2.1 的显式收窄**：D10 原文的 `x ∈ [xMin, xMax − width]`（以及 D2 的世界边界范围）在本票收窄为上述连通段。收窄只减少可证明的路径，不产生假 NB；它必须在授权包中作为 D3 的正式修正记录，不得静默改写 D10。
- `graph.startCells()` 的宽松种子、`assessReachability` 的多起点播种属空间层既有行为，本票不改；时序 NB 不使用它们。

### 3. 出生状态（Q2，用户修正）

必须同时满足：

1. 真实 spawn 盒由 `config.player.at` 的脚点经 `boxFromFoot` 派生，**完全在世界内**且不与 `graph.solids` 严格重叠。
2. 真实 spawn 脚点必须**无位移地**落在 W 的脚点格上：`footX`、`footY` 均为整数。
3. 非整数脚点 x（例如 `10.4`）⇒ `INSUFFICIENT_EVIDENCE`，内部原因 `spawn-not-on-lattice`。**不得**静默吸附到 `round(foot)`；`round(foot)` 会替玩家换一个出生状态，不能作为证明起点。
4. 对应脚点格必须 `standableAt(footX, footY)`，否则 IE `spawn-not-standable`。
5. 起点状态集 = `{ (spawnFootX, k) : k ∈ ℤ_N }`，每个相位格一个。
6. 起点安全不单列前置检查：它由每格的**残差等待**（§5）覆盖；残差等待碰撞 ⇒ 该格失败。

> **遗留风险（不在本票放宽）**：若 19 关语料证明非整数出生点普遍存在，必须另开 HITL 裁定如何支持精确非整数起点；当前不接受任何形式的静默吸附。该风险交 D5 / D7 取证，并进入地图 **Not yet specified**。

### 4. 到达谓词与目标状态（Q6）

```text
arrivalPredicate:
  "overlapsStrict(playerBox, deflate(goalRect, 0.5))"
```

- `goalRect` 是 D2 冻结的空间层**取整盒**。
- 四边各内缩 `0.5px`。理由：取整盒与真实盒每边相差 ≤0.5px；内缩后的盒一定包含于任何落在该误差包络内的真实目标盒，因此不会把「差 0.5px 没到」翻转成假到达。
- 内缩后矩形为空或退化 ⇒ IE `goal-rect-degenerate`。
- 到达只在**状态边界**判定：`goalStates = { (footX, k) : arrivalPredicate(playerBox(footX)) }`，与相位 `k` 无关。
- 目标区域在 x 方向无法被任何合法格点表达（窄于 1px 或没有状态满足谓词）⇒ IE `goal-not-representable`；不得临时改成连续搜索或放宽谓词。
- 本谓词是**保守的模型内到达定义**，不声称与 Runtime 原始目标判定逐位相等。

### 5. 相位格起点与残差等待（Q7）

- 对每个相位格 `C_k = [k·dt, (k+1)·dt)`，真实 `φ0` 落在其中；Witness 记录的是**格**，不是某个具体 `φ0`。
- 第一条段是 spawn 原位的残差等待：从 `φ0` 到 `(k+1)·dt`，长度 ∈ `(0, dt]`。
- 验证：`φ0` 遍历整个 `C_k` 时，残差等待覆盖的 Hazard 位姿范围恰为 `C_k` 上的位姿范围；必须对该**完整范围**做保守验证（跨折返点切段），不得只检查格端点。任一碰撞 ⇒ 该相位格失败。
- 数据形状：

```text
t0: { kind: "cell-start", cell: k, symbolic: true }
residualWait: "conservative-over-cell"
```

- 正式主张是 `∀φ0 ∈ C_k`（D1），不是「已逐一验证每个具体 `φ0` 的实际轨迹」。诊断与授权包不得把残差等待的保守覆盖写成「全部相位轨迹已验证」。

### 6. 碰撞与等待段语义（Q8）

- 残差等待、U9 整周期等待、W 的 `wait` 边统一使用：折返点切段 + 解析连续求交。
- 碰撞谓词 = `overlapsStrict`，**不带 ε**。
- 任意正宽度的碰撞开区间 ⇒ 该段失败；仅点相切 ⇒ 安全；**不设最小安全窗口**。
- 记录：

```text
collisionPredicate: "overlapsStrict"
epsilonUse: "none-in-collision-predicate"
```

- ε 只用于门宽或其他显式区间阈值，不得进入碰撞谓词。

### 7. 连续性、完整性与终止性（Q9）

- 段连接：时间连续、x 连续、相位格恰好前进 1（mod N）、玩家 y 与玩家盒定义保持一致。
- 验证范围 = 从 spawn 状态集出发、**策略实际可达的全部状态与全部转移**；不允许用若干条抽样路径替代全可达覆盖。
- 终止性：必须提供有限完整轨迹，或严格递减 rank / potential；仅有逐边安全不构成证明。
- 未验证的候选转移不得进入 Witness；部分路径、未完成路径、未经验证候选一律不得提升。
- 预算耗尽 ⇒ IE，即使已经得到一段安全前缀也不得提升为 NB。
- 状态遍历、策略选择、证据序列化与重放必须有确定性排序；不得依赖 `Set`、对象键枚举顺序或墙钟。

### 8. Witness 规范形状（Q10）与 U9 变体（Q11）

#### 8.1 规范产物

```text
Witness = {
  certificate: "winning-set" | "u9",
  lagMs, lagPad, hazardSpeed,
  staticCorridor, spawn, playerGeometry, lattice, phase,
  arrival: { predicate, goalRect, deflatedGoalRect, goalStates },
  policy,                       // 全部 N 个相位格的策略表
  segments: [Segment],          // 逐转移验证记录
  termination,                  // rank 或有限轨迹
  witnessForm: "policy+verification",
  volume,                       // 由 D5/D9 冻结计量
  verificationStatus
}

Segment = {
  phaseCell: k,
  kind: "wait" | "move",
  t0, t1, x0, x1,
  playerBox0, playerBox1,
  hazardPoseRange,              // 精确位姿范围，跨折返点则多段
  lagPad,
  staticCheck,                  // S1 结果
  hazardCheck,                  // S2 结果 + 碰撞开区间
  continuity,                   // S4 证据
  phaseChoice: "universal" | "existential" | "n/a"
}
```

- 按相位路径族由**确定性重放器**按需物化，作为派生视图，标记 `derived: true`。
- 策略表必须覆盖全部 `N` 个相位格，并包含所有从 spawn 可达、策略实际选择的转移记录。等价性来自**完整策略 + 验证记录 + 终止性**的构造，不来自数据结构本身；不能因为策略表与 Winning Set 同阶就省略转移验证。
- 具体字段类型、枚举、序列化形状与体积阈值交 D9 / D5；本票只冻结语义与最小字段集。

#### 8.2 U9 变体

- 同一信封，`certificate: "u9"`。
- 接近段：对每个相位格 `∀φ0`，用 `W_{→s}` 的策略与转移记录。
- 整周期等待：一条特殊 `wait` 段，`[T_arr, T_arr+P]` 上一次完成连续验证；`phaseChoice: "universal"`。
- 出口段：`∃ψ`，用 `W_{→goal}` 的策略与转移记录；`phaseChoice: "existential"`。
- U9 的接近、等待、出口义务逐字采用 D10 §1.6；复用数据形状不放宽任何一项。

### 9. 双 lag（Q12）

- 每个 `lagMs` 档单独生成 Witness；两档不得共享、拼接或借用另一档的证明记录。
- 每段记录 `lagMs` 与 `lagPad = hazardSpeed × lagMs`。
- 两档结论比较仍由 I-01 `resolveTwoLagResults` 处理；本票不新增跨档合并规则。

### 10. 交给 D9 的最小字段集（Q12）

`certificate`、`staticCorridor`、`spawnCell`、`arrivalPredicate`、`latticeAnchor`、`residualWait`、`collisionPredicate`、`phaseCellsCovered`、`phaseCoverageComplete`、`transitionChecks`、`termination`、`witnessForm`、`witnessVolume`、`verificationStatus`、`budgetStatus`、`lagMs`、`lagPad`。

字段类型、枚举与序列化形状由 D9 冻结；本票不提前锁定类型。

### 11. 反例清单（必须失败 / 必须 IE）

1. `move` 两端都 `standable`，但中间跨过 `graph.solids` 的墙 ⇒ S1 失败，无 Witness。
2. `config.player.at` 的脚点 x 为 `10.4` ⇒ IE `spawn-not-on-lattice`，不得从 `footX=10` 开始。
3. 取整 Goal Rect 未内缩，玩家盒与真实目标盒差 0.4px ⇒ 不得判到达。
4. 残差等待只检查 `C_k` 两端位姿，Hazard 在格中穿过 spawn ⇒ 该相位格失败。
5. wait 边端点安全、区间内碰撞（采样陷阱）⇒ 该段失败。
6. 预算耗尽但已有一条验证前缀 ⇒ IE，不得输出 NB。
7. 策略每条边都安全但形成循环、无终止 rank ⇒ 不是 Witness。
8. 把 16.67ms 档的转移记录接到 200ms 档的结论上 ⇒ 禁止。
9. 用 `startCells()` 的邻近落脚点替代真实 spawn ⇒ 禁止。
10. 目标在静态走廊外 ⇒ IE，不得输出 PU。
11. Goal Rect 退化，或没有任何合法格点满足到达谓词 ⇒ IE `goal-not-representable` / `goal-rect-degenerate`。
12. `move` 只检查起点/终点静态 `standableAt`，不做连续 S1 ⇒ 禁止。
13. 把残差等待的整格保守覆盖写成「全部具体 φ0 轨迹均已验证」⇒ 禁止。

### 12. 对上游裁定的影响

- **D10 §2.1（显式收窄）**：W 的 x 域由 `[xMin, xMax − width]` 收窄为 spawn 脚点 y 上的 `standable` 连通段。D10 的其余内容（最小不动点、残差等待、终止性、U9 判据、组合语义）不变。
- **D1 §4（不变）**：Witness 仍是按初始相位覆盖的路径族；`policy + verification` 是 D10 §4 六条件成立的等价压缩形式。
- **D2 §5（收口）**：到达谓词按本票 §4 冻结；`startCells()` 宽松接位不进入时序 NB；真实 spawn 的精确性按本票 §3 冻结。
- **D4（不受阻）**：PU 的六条件与门区 / 图割仍由 D4 独立裁定；本票不改变任何 PU 条件，也不提供 PU 证据。
- **D5**：预算与体积必须覆盖「策略表 + 逐转移验证记录」；非整数 spawn 普遍性会影响语料可用范围，需取证。
- **D6**：白名单需容纳三角波内部模块、静态连续检查与 `standable` 走廊派生；不得改 `demo`。
- **D7**：测试矩阵必须覆盖 §11 反例；优先内存夹具，不新增 fixture pack。
- **D8**：R1 复核清单应包含 §1.3 的 S1–S4、§2 的静态走廊、§3 的 spawn 精确性、§5 的残差等待与 §7 的终止性。
- **D9**：按 §10 字段集冻结内部契约；`verificationStatus` 不得把「模型内验证」写成生产验收。
- **AUTH**：把本票作为 Witness 模型的正式章节；D10 §2.1 的收窄与 D2 的到达/spawn 收口必须在授权包中单列。

### 13. 边界与仍开放的风险

- 本票未修改任何产品文件；未新增 fixture pack；未运行生产测试。
- `coverage.temporal` 前置条件仍按 D10 Q1 处理；`coverage.spatial` 如实为 `partial`，静态连续检查不提升它。
- 玩家 y 固定于 spawn：目标若不在同一脚点 y 带，W 无法到达 ⇒ IE；这是模型范围，不是本票缺陷。
- **非整数出生点**：当前一律 IE，待语料取证后另裁。
- 本票不产生任何生产验收声明；`NO_PROVEN_BLOCKER` 仍不等于可玩。
