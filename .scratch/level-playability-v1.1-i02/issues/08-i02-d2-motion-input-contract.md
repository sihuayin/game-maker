# I02-D2 运动模型与输入契约裁定

Type: grilling
Status: resolved
Owner: claude + user (wayfinder grilling session 2026-11-11)
Blocked by: 03
Map: ../map.md
Class: I-02 / DECISION

## Question

冻结 I-02 的三角波运动模型与输入映射，逐条消解冲突登记表中「相位 / 速度 / 运动模型」行。只裁定**输入与几何**；Witness / 门区 / 图割留给 D3 / D4。

### 必须裁定

1. **三角波定义**：`t=0` 锚点在 `at`；`periodMs` 往返整周期；折返点 `periodMs/2`；两端不停留；位置函数与速度函数。
2. **速度**：由 `distance / periodMs` 导出，不得新增配置字段；给出唯一的导出式与单位。
3. **Hazard 碰撞盒**：
   - 用哪份几何（`Entity.at` + manifest `size` / `anchor` vs 逐帧 `sourceSize` / 帧 anchor）；
   - I-01 的 `TrustedAtlasInput` 如何进入判定；
   - `rotated` / `trimmed` 不支持时是否 IE；
   - 所有帧必须等于 manifest 标称值，还是允许帧间差异；若允许，用哪一帧。
4. **玩家盒与起终点**：player 几何来源；起点盒 / 目标区域的派生规则；「合法移动范围」与世界边界的语义。
5. **Hazard y 区间**：门区与 AABB 的 y 范围；hazard 不是 solid；顶面不提供支撑。
6. **模型外输入**：Y 轴、多移动 Hazard、Moving Platform、Danger 联合、非 `cycle`、状态转换 —— 统一 IE，不静默近似。
7. **输入校验顺序与失败语义**：哪些条件在进入算法前拒绝；失败只返回 IE，不新增公共 code。
8. **I-02 需求 §4 I02-01 输入清单的调和**：逐项标注「已由 I-00 冻结」「由配置派生」「属 I-02 需求误述 / 需裁定」。

### 产出

票内 `## Answer`：输入映射表 + 运动模型正式定义 + 冲突行裁定。

### 下游

I02-D3、I02-D4、I02-AUTH。

## 相关证据

- [I02-03 连续时间求交可行性实验](../evidence/03-continuous-intersection.md)：三角波形式化（F1）、ε 的两种语义（F5）、`lagMs` 的 ∃δ 方向性（F6）、坐标尺度可表示性（F7）。形式化定义可直接引用 §4.1–4.2。

## Answer

**结论：D2 冻结 I-02 的运动模型与输入契约。** 本票只产出裁定，不写产品代码、不授权修改 `packages/**`。

> 三条彼此独立的事实，不得互相替代：
> 1. **算法确定性**（同一输入、同一实现 → 同一输出）；
> 2. **证据重放确定性**（同一证据包 → 同一可复核结果）；
> 3. **Runtime 几何真实性**（分析所用的盒 == 玩家实际撞到的盒）。
> 前两条成立，不构成第三条的证据。

### 1. 三角波（Q1）

采用 I-00 §4.1–4.2 / `packages/demo/src/hazard.ts:14-19` / [I02-03 证据](../evidence/03-continuous-intersection.md) §4.1 的同一式：

```
u(t) = (((t mod P) + P) mod P) / P
p(t) = at + d · k(u),   k(u) = 2u      (u < 1/2)
                              = 2 − 2u  (u ≥ 1/2)
```

- `t=0` 时锚点在 `at`；`P = periodMs` 是**往返整周期**；折返点在 `t = kP/2`；两端不停留。
- `p(t)` 是 **Hazard 锚点**的位置，不是碰撞盒左上角。
- 时间只用 game-time（ms），允许负时间与多周期；`p(−t) = p(t)`。
- 速度只在**开区间**上定义为 `+2d/P`（上升段）或 `−2d/P`（下降段）。折返点处导数不存在；**不定义全局速度函数**，也不人为指定 0 或右连续。
- 折返点必须作为解析求交的**切段边界**；任何单段求交不得跨过折返点。

### 2. 速度（Q2，消解 A-02）

**速度是派生量，不是配置输入。**

```
v_max = 2 · distance / periodMs      [px/ms]
```

- 不新增 `Motion` 字段；`distance` / `periodMs` 由 schema 保证严格大于零。
- canonical 术语：**Hazard Max Rate（hazard 最大速率）**。
- I-02 §4 把“速度”列为输入属于**需求误述**；实现不得据此新增字段或扩大输入契约。

### 3. Hazard 碰撞盒、帧与 Atlas 信任（Q3，消解 A-03 的几何半部）

1. **几何来源固定为 manifest 的 `asset.size` + `asset.anchor`。** Hazard 的 `Entity.body` 永远不参与（`profile.ts:51,92` 的 `frame` 源语义）。
2. **不挑选帧。** I-01 的 `verifyTemporalInput` 已保证每个声明帧的 `sourceSize` 与 `anchor` 等于 manifest（容差 1e-9），因此所有声明帧对应**同一个几何盒**。未来若出现帧间差异，I-01 直接失败 ⇒ IE；不得“挑一帧”。
3. `rotated = true` 或 `trimmed = true` ⇒ I-01 信任门禁失败 ⇒ I-02 返回 **IE**；不得自行反旋转、裁剪或换帧绕过。
4. `TrustedAtlasInput` 是**信任门禁**，不是几何来源：分析器必须先通过 brand/验证，再从 manifest 读取几何。
5. “帧间几何一致”**不能**推广成“所有资源都必有可用帧”。缺少必要资源、帧声明缺失、或几何不可解，仍是 **IE**。

### 4. 坐标：连续核心 vs 取整空间层（Q4）

- **连续时间核心**：使用未取整的 `p(t) − anchor.x · width`。这是保留三角波分段线性、闭式求交的前提，也与 demo 运行时的浮点 `setPosition`（`demo/src/shell/scene.ts:276-279`）一致。
- **既有空间层**：保留 `entityBox` 的 `Math.round`（`game-config.ts:151-157`）；本票不改变既有实现。
- **跨层安全性**：D4 使用取整盒时，必须把取整误差纳入**保守包络**，不能只登记误差。对经过取整的盒，**四条边各作最多 0.5px 的保守扩张**（或数学上等价的保守包络）；未取整的盒不得重复扩张。D4 不得混用两套几何，也不得因取整差异缩小危险范围。
- **y 轴同样适用**：取整影响四条边；hazard/player 的 y 边是静态的，D4 只需纳入一次。

### 5. 玩家盒、起点、目标、合法范围（Q5、Q13）

- **玩家盒**：manifest `size` + `anchor`，经 `footOf(at, size, anchor)` / `boxFromFoot` 派生；**不取整**。玩家动画帧的 `coverage` 仍如实为 `partial`。
- **起点**：`config.player.at` 按**脚点**解释；起点盒由脚点反推。盒子必须完全在世界内，否则 IE。
- **目标矩形（Goal Rect）**：采用现有 `runtimeEntityGeometry` 的**取整盒**（与 `assessReachability` 同一几何语义）。到达谓词归 D3；D3 必须处理取整盒与未取整玩家盒之间 ≤0.5px/边的差异，不得混用后声称完全一致。
- **合法移动范围**：玩家盒左上角坐标
  ```
  x_left ∈ [0, W − p_w]
  y_top  ∈ [0, H − p_h]
  ```
  玩家 y 固定于出生点，x 连续变化。越界是**非法状态**，不 clamp。脚点坐标必须先经 `boxFromFoot` 转成盒，再判边界。
- P0 的 `startCells()` 宽松接位是搜索播种策略，不是输入契约；是否采用归 D3。
- 起点“对所有 `φ0` 安全”与目标“到达”判据归 D3；D2 只冻结几何与范围。

### 6. Hazard y 区间与非 solid（Q6）

- Hazard Box 的 `y/h` 与 `x` 同源（manifest `size` + `anchor`）。
- Hazard **不是 solid**，不提供支撑，不生成 `standable`（`graph.ts:140` 的 `standable` 只看 `blocked`；hazard 只进 `forbidden`）。
- 连续时间核心只处理 x 运动；玩家 y 固定。D4 消费 Hazard 的 y 区间，不重新定义来源或支撑语义。
- Hazard 行程 `[at, at+distance]` 与碰撞盒允许部分越出世界边界，不 clamp。

### 7. 模型外输入（Q7）

| 输入情况 | 结果 |
| --- | --- |
| 没有移动 Hazard | `applicable:false` |
| 有移动 Hazard，`axis = "y"` | `applicable:true` + IE |
| 多于一个移动 Hazard | `applicable:true` + IE |
| Moving Platform | `applicable:true` + IE |
| Danger 联合 | `applicable:true` + IE |
| 非 `cycle` / `strike` 等状态转换 | `applicable:true` + IE |
| Hazard 资源缺失或几何不可解 | `applicable:true` + IE |

- **不适用** = 没有需要分析的移动 Hazard；**IE** = 存在分析对象，但当前证明模型无法处理。
- 每个模型外形状给内部 reason；不静默近似；不新增公共 `ConfigIssue.code`。

### 8. 输入校验顺序（Q8）

**公共包装顺序不变**（`auditPlayabilityTemporal`）：`lag → trustedInput brand → scope`（`temporal.ts:98-101`）。

**I-02 内部语义校验顺序**：

1. `lagMs` 合法（有限、非负）；
2. `TrustedAtlasInput` brand/验证通过；
3. scope：没有移动 Hazard ⇒ `applicable:false`；
4. 模型外输入检查；
5. 单个 x-cycle 运动形状检查；
6. 几何可解性：player/hazard asset、anchor、帧信任；
7. 起点盒与目标矩形完全在世界内；
8. 预算参数合法。

任一步失败 ⇒ IE + 内部 reason。schema 已保证的字段约束不重复报错；不新增公共 code；公共包装既有行为不因 I-02 改变。

### 9. 三角波实现位置（Q9）

- canonical 公式放在 **contracts 内部模块**；`packages/demo/**` 不修改（I-00 §11）。
- 加**只读 cross-check** 回归测试，对照 demo 现有实现。
- cross-check 只防漂移，**不替代**对公式、折返点切段与连续时间求交的正确性证明。
- contracts 内部模块不得新增公共 Contract、公共导出或改变既有配置 schema。
- **具体文件、导出边界、测试路径与允许修改的文件由 D6 列入白名单；白名单批准前，本票不构成对 `packages/contracts/**` 的修改授权。**

### 10. Coverage 与结论状态（Q10）

- 公共 `coverage` **保持 `partial`**，不得提升为 `checked`。
- 内部诊断区分：
  - `geometryChain = "manifest+atlas-metadata"`
  - `runtimeBody = "unverified"`
- I-02 可以使用 manifest 几何执行**确定性、可重放**的计算，产出**模型条件性分析结果**（model-conditional results），并记录候选证书、几何假设与计算过程。
- 但 I-02 **不得**仅凭这些结果发布正式的 `PROVEN_UNPLAYABLE` 或 `NO_PROVEN_BLOCKER`。
- **PU**：I-00 §7.2 第 2 条要求参与判定的几何 `checked`；当前 `partial`，不能建立正式 PU 证明。
- **NB**：即使 NB 不直接继承 §7.2 门槛，玩家实际碰撞几何未验证仍影响路径安全证明；若 D2/D9 无法证明算法使用的玩家盒与 Runtime 实际碰撞盒一致，NB 也必须 IE。
- I-03 必须补齐并验证运行时几何证据、满足相应 I-00 条件后，才允许开放公共确定性 Verdict。
- “在 manifest 几何模型下成立”不得被升级成“实际游戏可玩/不可玩已证明”。

### 11. I-02 §4 输入清单分类（Q11）

| I-02 §4 原文 | 冻结分类 | 说明 |
| --- | --- | --- |
| 单个 X 轴周期移动 Hazard | 直接输入 + 模型约束 | 从 `Motion` 与实体清单判断；超出模型范围 ⇒ IE |
| Hazard 运动区间、速度、周期及相位信息 | 混合；部分是误述 | 区间由 `at + distance` 派生；最大速率由 `2d/P` 派生；周期来自 `Motion.periodMs`；**相位是自由变量 `φ0`，不是输入** |
| 玩家碰撞体和合法移动范围 | manifest 派生 + config 派生 | 盒由 manifest `size/anchor` 与 `player.at` 派生；范围由 `world.size` 与盒完全在世界内确定 |
| 已通过 I-01 验证的逐帧几何证据 | 直接输入（信任门禁） | `TrustedAtlasInput`；证明 Atlas 元数据一致性，不证明 Runtime hitbox |
| Runtime 所需的碰撞体与边界参数 | 固定常量 + config 派生 + 直接输入 | `FixedRuntimeProfile` 固定实例；`world.size` 来自 config；`lagMs` 与预算按各自契约提供 |

授权包必须明确标注：**“速度”是派生量，“相位”是全称量化中的自由变量**；I-02 §4 将二者并列为输入属于需求误述，实现不得据此新增字段。

### 12. 已消解 / 仍开放的冲突行

- **A-02 速度**：`RESOLVED（D2）`——派生量，非输入。
- **A-03 Hazard 运动模型**：`RESOLVED（D2）`——公式、折返点、实现位置原则已冻结；文件白名单归 D6。
- **B-06 三角波实现位置**：`PARTIAL（D2）`——原则冻结（contracts 内部模块 + demo 不动 + cross-check），文件/白名单待 D6。
- **B-02 几何 coverage vs checked**：`PARTIAL（D2）`——几何来源与信任门禁冻结；**拒绝提升 coverage**；把 `TrustedAtlasInput` 接入 `runtimeEntityGeometry`、补运行时几何证据仍归 I-03/D6。
- **B-01 profile / 预算**：仍归 D6/D9；本票只确认输入校验顺序。
- **A-04 hop 参数化**：不属 D2。
- **B-05 ε / 连续求交**：不属 D2（I02-03 已给事实，D3/D6 定口径）。

### 13. 交接条款

- **D3**：Goal Rect 为空间层取整盒；到达谓词必须处理与未取整玩家盒的 ≤0.5px 边界；起点安全与“对所有 `φ0`”判据归 D3；玩家/hazard coverage 仍 `partial`。
- **D4**：使用取整盒时对四条边各作 ≤0.5px 保守包络；不得混用连续/取整几何；Hazard 不提供支撑；门区只消费 y 区间，不重定义来源。
- **D6**：三角波内部模块的文件、导出边界、测试路径、白名单；contracts 内部模块不得新增公共导出/schema。
- **D9**：内部结果需能记录 `geometryChain` / `runtimeBody` 与“模型条件性结果”状态；不得把内部候选证书写成正式 PU/NB。
- **I-03**：补齐运行时几何证据（PNG / manifest / Runtime hitbox equality）后，才开放公共确定性 Verdict。

### 14. 边界

- 本票未修改任何产品文件；未新增 fixture pack。
- 本票不构成实施授权；`packages/contracts/**` 的修改必须等 I-02 授权包签署且 D6 白名单批准。
- 证据来源：[I02-03](../evidence/03-continuous-intersection.md)、[I02-04](../evidence/04-graph-cut-hop.md)、[I02-05](../evidence/05-performance.md)、[I02-02 冲突登记](../evidence/02-conflict-register.md)、[I02-01 代码事实](../evidence/01-code-facts.md)。

## 后续裁定（D3，2026-11-11）

[I02-D3 安全通过 Witness 模型裁定](09-i02-d3-witness-model.md) 收口本票的两个交接项：到达谓词 = 未取整玩家盒与四边内缩 0.5px 的取整 Goal Rect 严格相交；spawn 必须无位移落在脚点整数格，否则 IE `spawn-not-on-lattice`，禁止 `round()` 吸附或 `startCells()` 宽松起点。本票其余内容不变。
