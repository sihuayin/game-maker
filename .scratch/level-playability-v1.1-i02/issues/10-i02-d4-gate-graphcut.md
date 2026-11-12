# I02-D4 永久封锁门与垂直规避图割裁定

Type: grilling
Status: resolved
Owner: claude + user (wayfinder grilling session 2026-11-11)
Blocked by: 07, 08, 05, 19, 20
Map: ../map.md
Class: I-02 / DECISION

## Question

冻结 `PROVEN_UNPLAYABLE` 的两个证明半部：永久封锁门 + 垂直规避不存在；并明确 hop 参数化是否需要改 `graph.ts`。I-00 §7 六条件与 I-02 I02-03 / I02-04 必须逐条映射。

### 必须裁定

1. **门区定义**：`L = max_T P(T) − anchorX·width`、`R = min_T P(T) + (1−anchorX)·width`；y 区间；`R − L > ε`；任意相位、任意合法 lag 位姿下的交集（不带 pad）。
2. **完整周期**：三角波整周期、折返点、周期边界；不得由有限采样推断。
3. **判侧规则**：起点脚点在 `L` 左侧、终点在 `R` 右侧（或反向）；跨侧不成立 ⇒ 不得 PU；多门 / 门不在起点终点之间如何处理。
4. **forbidden region**：门区矩形按玩家盒外扩；`forbiddenBoxes` 注入；「不可穿越、不提供支撑」语义必须在 `reach.ts` 与 hop 路径上成立。
5. **图割**：含 hop 边的图上起点与终点不连通；几何 coverage 必须 `checked`；player `partial` 如何处理。
6. **hop 参数化**：
   - 是否修改 `graph.ts`（加可选 `hopSamples` 上限 / 采样密度参数）；
   - 若不修改，如何在 `temporal` 模块内复现同一弧线并保证不漂移；
   - 若修改，触发什么白名单 / 授权形态（`graph.ts` 在 I-00「需单独裁定」名单）。
7. **hop 加倍不变性**：`n` 加倍后连通性结论必须不变；量化失败条件与降级。
8. **模型外规避闭合**：`graph.ts` 的四种边是否构成玩家完整移动模型；如何证明/声明没有模型外规避；无法证明 ⇒ IE。
9. **PU 六条件逐条映射**：I-00 §7 六条 ↔ I-02 条文 ↔ 测试证据；任何修改需独立裁定。
10. **I02-03 与 I02-04 的依赖 / 先后 / 授权条件**：给出技术依据，交由 D8 落成正式顺序。

### 产出

票内 `## Answer`：门区正式语义、图割义务、hop 参数化裁定、PU 六条件映射表。

### 下游

I02-D6、I02-D7、I02-D8、I02-D9、I02-AUTH。

## 相关证据

- [I02-04 图割与 hop 加倍可行性实验](../evidence/04-graph-cut-hop.md)：`forbiddenBoxes` 语义（F1）、N1/N2 垂直绕行反例（F2）、hop 加倍的方向不对称（F3–F4）、采样上限从不触发（F5）、`graph.ts` 参数化的外部模拟可行（F6）。裁定仍在本票。

## 上游裁定（D2）

- [I02-D2 运动模型与输入契约裁定](08-i02-d2-motion-input-contract.md)：连续核心用未取整 `p(t) − anchor.x·w`；空间层保留 `entityBox` 取整；使用取整盒时必须对四条边各作 ≤0.5px 保守包络（未取整盒不重复扩张，不得混用两套几何）；Hazard 不是 solid、不提供支撑；门区只消费 y 区间。

## Answer

用户 2026-11-11 逐题裁定。Q1–Q6、Q8、Q10、Q11 通过；**Q7 按用户修正**（不要求 `n_double = 2·n_prime`，改为验证规范化采样位置覆盖），**Q9 第 6 条按用户修正**（构造性 lag 无关，而非「两档各跑一遍结果相同」）。**修改产品目录：否**（仅本票、地图、`CONTEXT.md`、冲突登记；未触碰 `packages/**`、Runtime、CLI、MCP、公共 Contract、I-00 / I-02 原文）。

> **本轮最重要的范围结论：I02-03 / I02-04 可以继续形成模型条件性的内部计算，但不能因此恢复生产 PU。**
> 当前生产 PU 至少受两项**独立阻塞**：几何 coverage 仍为 `partial`（I-00 §7 第 2 条）、空中水平控制未被移动模型闭合（I-00 §7 第 5 条）。
> 本票只冻结语义与授权边界，不代表 I-02 已实现或验收；首次签署仍只授权 I02-01。

### 0. 裁定总览

| 题 | 裁定 | 冻结要点 |
| --- | --- | --- |
| Q1 | A | 全周期闭式恒覆盖门区；无 lag pad；y 严格重叠；`gateRect` 与 `expandedRect` 分列。 |
| Q2 | A | 只允许全周期解析极值；采样或子周期结果不得用于 PU。 |
| Q3 | A | 精确 spawn 盒；`goalRegion = inflate(goalRect, 0.5)`；跨门 / 同侧 / 无法判侧 ⇒ IE。 |
| Q4 | A | 只传原始 `gateRect`；由 `forbiddenBoxes` 扩张一次；不写 `blocked`。 |
| Q5 | A（仅条件性证据） | 精确 spawn；落脚盒与 hop 弧采样盒都查；`midAir` 命中否决 PU；**`midAirHits=0` 不是不可达证明**。 |
| Q6 | A + 拆审批 | `graph.ts` 可选尾参；D6 白名单 + 独立于 I-00 R2 的增量审批；`reach.ts` 不在范围。 |
| Q7 | **修正** | 双档独立跑；记录 n / 端点 / 参数 / cap；验证倍档规范化采样位置覆盖主档；不能证明覆盖 ⇒ IE；不要求 `n` 精确 2×。 |
| Q8 | A（范围裁定） | 生产 PU 不授权；`movementModelClosure="not-proven-air-control"`；仅做内部模型条件性计算。 |
| Q9 | **修正第 6 条** | 六条件逐条状态；第 6 条为构造性 lag 无关；Witness 仍按 lag 独立。 |
| Q10 | 顺序冻结 | I02-03 → 复核 → I02-04；`graph.ts` 独立审批；Q8 未闭合只授权内部计算。 |
| Q11 | 接受 + 补两项 | 增加 `hopSamplingCoverage`、`lagInvariantByConstruction`；`puConditions` 逐条状态 + 证据引用 + 阻塞原因，禁止布尔替代。 |

### 1. 门区正式语义（Q1、Q2）

#### 1.1 闭式公式

```text
p(θ) = at + d·k(θ/P)，θ ∈ [0, P)
gateRect = [L, R] × [hazY, hazY + hazH]

L = at + d − anchorX·w
R = at + (1 − anchorX)·w
width = R − L = w − d
有效条件：width > ε
```

- `w` / `anchorX` / `hazY` / `hazH` 来自 manifest `size/anchor`（D2）；`at` / `d` / `P` 来自 `Motion`。
- `ε` 是 I-00 §6.4 的单一具名常量，只用于门宽判定；具体落位归 D6。
- 门矩形 y 区间 = Hazard 盒 y 区间；必须先要求它与玩家盒 y 区间**严格重叠**，否则该 Hazard 不可能挡住玩家 ⇒ IE。

#### 1.2 lag 方向

`⋂_{φ0∈[0,P)} ⋂_{δ∈[0,lagMs]} H(φ0+δ)` 与 `⋂_{θ∈[0,P)} H(θ)` **等价**：`∀φ0` 已覆盖整个周期，δ 不扩大位姿集合。因此门区**不带 pad**；lag 方向只属于 Witness。

记录：

```text
lagMode: "gate-independent; witness-only"
gate: { L, R, width, eps, hazardY, hazardH,
        lagMode: "redundant-under-universal-phase" }
```

#### 1.3 完整周期

- 只允许全周期解析极值：`max p = at + d`、`min p = at`；极值在 `t = P/2` 与 `t = 0/P` 取得。
- 周期边界与折返点只作解析边界；**任何采样或子周期结果不得用于 PU**。
- 记录 `periodCoverage: "closed-form-full-period"`。

#### 1.4 `gateRect` 与 `expandedRect` 是两个对象

- `gateRect`：Hazard 全周期恒覆盖的**核心矩形**。
- `expandedRect`：`buildMovementGraph({ forbiddenBoxes })` 按玩家几何扩张后的禁入区域（`graph.ts:125-135`）。
- 两者都进 `forbiddenInjection` 诊断；**扩张只能发生一次**，且只由 graph 完成。

> 不得把整段扫掠区注入 forbidden：那会把「某时刻经过」当成「永久覆盖」，产出假 PU。

### 2. 判侧规则与目标取整包络（Q3）

```text
goalRegion = inflate(goalRect, 0.5)      // 四边各外扩 0.5px

左→右：spawnBox.x + spawnBox.w <= L  ∧  goalRegion.x >= R
右→左：spawnBox.x >= R                ∧  goalRegion.x + goalRegion.w <= L
```

- spawn 用 D3 的精确盒（脚点整数格），**不**外扩。
- PU 的到达方向与 NB 相反：为证明「到不了」，目标区域取**过近似**，所以外扩 0.5px；D3 的 NB 到达谓词是内缩，两者方向相反、不可混用。
- 目标跨门、起点不在严格一侧、起点与目标同侧 ⇒ IE。
- 单 Hazard 只有一个门；不存在「多门择一」。起点与目标被门分离是 PU 的必要条件，不是充分条件。

记录：`sideRule: { spawnSide, goalSide, goalInflation: 0.5, ok }`。

### 3. forbidden region 注入（Q4）

- 把原始 `gateRect` 原样传给 `buildMovementGraph({ forbiddenBoxes: [gateRect] })`。
- 扩张由 `graph.ts:125-135` 按玩家半宽 / 玩家高度完成；**不预外扩、不重复扩张、不写入 `blocked`**。
- `forbiddenBoxes` 语义（I02-04 F1）：不可穿越、不提供支撑、门顶不是地板。`standable` 只看 `blocked`（`graph.ts:140`）。
- 图必须与空间层使用同一份静态 solids、玩家几何与 profile。
- 记录 `forbiddenInjection: { gateRect, expandedRect, source: "forbiddenBoxes" }`。

### 4. 图割判据（Q5，仅条件性证据）

- 起点 = D3 的精确 spawn 脚点格；**不得**使用 `startCells()` 的宽松多起点。
- 「目标不可达」的图内判据：
  1. 没有任何可达落脚点的玩家盒与 `goalRegion` 严格相交；
  2. 没有任何可达 hop 弧采样点的玩家盒与 `goalRegion` 严格相交。
- 用 `assessReachability(graph, move, [{ rect: goalRegion }], { full: true })` 并检查 `covered` / `midAir`。
- **`midAirHits = 0` 不是不可达证明**：`reach.ts:155+` 是 32 条常速弧的 60Hz 采样，且代码自注「保守保护，不是可达性证明」。它只能作为**否决条件**（命中 ⇒ 不得 PU），永远不能反过来作为支持 PU 的正面证据。
- 该限制必须写进 D4 / D9，不得只留在说明文字里；`graphCut.verdict` 只能标 `conditional`。
- 记录 `graphCut: { startCell, goalRegion, reachableCells, hopArcSamples, midAirHits, verdict: "conditional" }`。

### 5. hop 参数化与审批边界（Q6）

接受加法式尾参，但审批必须拆开：

1. `graph.ts` 进入 I-02 D6 白名单。
2. 增量审批**独立于 I-00 R2**；不得以「I-00 R2 已批准」推定获批。
3. 只允许 `hopSamples` / `hopEdges` / `hopTargets` 的可选尾参 `HopSampling = { hz?: number; maxSamples?: number }`；`reachableCells` 仅在确实需要时逐项列明。
4. 默认 `{ hz: 60, maxSamples: 120 }`，默认行为保持不变。
5. 不允许顺带调整跳跃公式、现有采样语义或其他导出函数。
6. `reach.ts` **不在本次授权范围**；Q5 的 `midAir` 检查继续使用 `reach.ts` 现有 60Hz 行为，**不得**描述成参与了双档参数化。

若该增量审批未获准：I02-04 不能在生产代码中执行双档检查；只能保留外部 scratch 分析，生产 PU 继续不授权。

### 6. hop 加倍不变性（Q7，按用户修正）

#### 6.1 两档参数

- 主档：`{ hz: 60, maxSamples: 120 }`。
- 倍档：`{ hz: 120, maxSamples: 240 }`。
- 两档各自**独立运行完整目标可达性检查**；不得只跑倍档，也不得只比较单条 hop 边。

#### 6.2 不要求 `n_double = 2·n_prime`

`n(f) = ceil(T·f)`，通常 `ceil(2Tf) ≠ 2·ceil(Tf)`（例：`Tf = 1.2` ⇒ 主档 2、倍档 3）。因此：

- **禁止**把 `n_double === 2·n_prime` 作为通过条件；它会产生与采样器正确性无关的假 IE。
- 改为验证：倍档使用**相同弧参数**（同一 `(ax, ay, bx, by)` 与同一 `MoveParams`），且其**规范化采样位置覆盖主档的对应位置**。
- 形式化：`F1 = { i/n1 : 0 ≤ i ≤ n1 }`、`F2 = { j/n2 : 0 ≤ j ≤ n2 }`；要求 `F1 ⊆ F2`（用整数交叉乘判定，不用浮点容差）。
- 若实现无法证明 `F1 ⊆ F2` ⇒ IE `hop-doubling-coverage-unproven`；**不得放宽检查**。
- 记录每条弧的实际 `n`、采样端点、采样参数与 cap 状态。

#### 6.3 判败条件

- 任一档 cap 绑定（`ceil(T·hz) > maxSamples`）⇒ IE `hop-sample-cap-bound`。
- 任一档判「目标可达」⇒ 不得 PU（IE）。
- 两档结论不一致 ⇒ IE `hop-doubling-disagreement`。
- 两档都判不可达才允许进入下一步；但**双档不可达仍只是图模型内的稳定结果**，不足以证明真实 Runtime 不可达（Q8 的阻塞不能由 Q7 消除）。

记录：

```text
hopDoubling: {
  prime: { hz, maxSamples, nPerArc, endpoints },
  double: { hz, maxSamples, nPerArc, endpoints },
  samplingCoverage,          // F1 ⊆ F2 的逐弧结果
  capBound, verdictPrime, verdictDouble, agreement
}
```

### 7. 模型外规避闭合（Q8，本轮最关键的范围裁定）

**生产 PU 不授权。**

```text
movementModelClosure: "not-proven-air-control"
```

事实链：

- `packages/demo/src/shell/scene.ts:89` 每帧无条件 `setVelocityX(±speed / 0)`，`onFloor` 只约束跳跃（`:90-91`）⇒ 运行时存在**全空域水平控制**。
- `hopSamples`（`graph.ts:225-255`）只模拟**恒定水平速度**的抛物线；空中变速路径不在图内。
- `midAirTouchableTargets`（`reach.ts:155+`）是 32 条常速弧的 60Hz 采样，代码自注「保守保护，不是可达性证明」。
- `walk-off` 只做同列竖直下落，不建模下落中的水平漂移。

因此 walk / walk-off / hop **不是运行时完整移动模型**；「当前图没有找到路径」不能改写成「玩家不存在路径」。I-00 §7 第 5 条「模型外规避已排除」**未证明**。

**允许的内部计算**（仅限 `.scratch/` 与内部结果，不得发布）：

- 全周期门区；
- forbidden region；
- 图割；
- 双档 hop 采样敏感性；
- PU 六条件的逐条状态。

**禁止**：发布 `PROVEN_UNPLAYABLE`；把模型条件性结果写入公共 Verdict；把内部计算成功当作 PU 授权。

**未来恢复 PU 的路径**：另开 HITL 票研究「过近似图割」。该票必须明确要求：新图是 Runtime 真实可达集的**超集**，而不是再做一份常速跳跃弧近似；只有超集也无法触达目标，才有资格支持不可达证明。该研究不属于 I-02，不塞进本图。

### 8. PU 六条件逐条映射（Q9，第 6 条修正）

| I-00 §7 条件 | 内部状态 | 说明 |
| --- | --- | --- |
| 1. 门区恒覆盖 | 可计算 | 全周期闭式交集；`width > ε`；无 pad |
| 2. 几何 `checked` | **BLOCKED** | `profile.ts:97` / `graph.ts:97` 当前恒 `partial` |
| 3. 图割不连通 | 条件性可计算 | 受 Q8 移动模型闭合限制 |
| 4. hop 加倍不变 | 条件性可计算 | 需 Q6 接口审批与修正后的 Q7 |
| 5. 模型外规避排除 | **BLOCKED** | 空中水平控制未被模型闭合 |
| 6. 双档 lag 一致 | **构造性可证明** | 门区与静态图割均不消费 lag |

#### 第 6 条的构造性证明

不是「两档各跑一遍、结果相同」，而是：

- 门区是全周期位姿交集，对 lag 不敏感（§1.2）；
- forbidden graph 是静态几何图，构建与遍历不消费 `lagMs`；
- 因此 PU 图割分支在两档 lag 下**在定义上相同**。

记录：

```text
lagInvariantByConstruction: true
lagMode: "gate-independent; witness-only"
```

该性质**不**允许 Witness 跨 lag 复用；Witness 仍必须按 `lagMs` 独立生成与验证（D3 §9）。

最终 `modelConditional: true`；公共 Verdict 仍由 I-03 的几何与 Runtime 证据门槛决定。

### 9. I02-03 / I02-04 的先后与授权条件（Q10）

1. I02-03 先完成门区数学与证据。
2. I02-03 复核通过后，才考虑 I02-04。
3. I02-04 还需要 `graph.ts` 的**独立增量审批**（§5）。
4. Q8 未闭合时，I02-04 只能授权**内部条件性计算**，不能授权生产 PU。
5. I02-03 / I02-04 完成不自动授权 I-03。

具体放行形态由 D8 落成正式顺序与增量授权条件；**不得先放行 I02-04，再补公共接口审批**。

### 10. D4 → D9 诊断字段（Q11）

基础字段：

`gate`、`periodCoverage`、`sideRule`、`forbiddenInjection`、`graphCut`、`hopDoubling`、`movementModelClosure`、`puConditions`、`geometryCoverage`（hazard / player / graph）、`lagMode`、`modelConditional`、`degradationReason`。

新增两项：

```text
hopSamplingCoverage
lagInvariantByConstruction
```

`puConditions` 必须逐条保存：

- 状态：至少区分 `PASS` / `BLOCKED` / `INSUFFICIENT_EVIDENCE` / `NOT_RUN`；
- 证据引用；
- 阻塞原因。

**禁止**用一个 `puEligible` 布尔值替代六项证据。

### 11. 反例清单（必须失败 / 必须 IE）

1. 门宽用 pad 或扫掠并集计算 ⇒ 门被放大 ⇒ 假 PU。
2. 按相位格采样求交或只取上升段 ⇒ 门宽错误。
3. 把整段扫掠区注入 `forbiddenBoxes` ⇒ 假 PU。
4. 手工预扩张门、再经 `forbiddenBoxes` 扩张 ⇒ 重复扩张 ⇒ 假 PU。
5. 判侧直接用取整 Goal Rect（不外扩 0.5px）⇒ 可能在真实目标跨门时假 PU。
6. 起点与目标同侧、目标跨门或起点不在严格一侧 ⇒ 仍输出 PU。
7. 用 `midAirHits = 0` 作为「不存在空中触达」的正面证明 ⇒ 不健全。
8. 用 `startCells()` 宽松种子替代精确 spawn ⇒ 假 PU。
9. 只跑倍档或只比较单条 hop 边 ⇒ 不健全。
10. 把 `n_double === 2·n_prime` 当作通过条件 ⇒ 与采样正确性无关的假 IE。
11. 忽略 `scene.ts:89` 的空中水平控制，把图割不连通写成 Runtime 不可达 ⇒ 假 PU。
12. 在 `coverage.partial` 或移动模型未闭合时发布 `PROVEN_UNPLAYABLE` ⇒ 禁止。
13. 把 Witness 的 lag pad 方向用到门区 ⇒ 假 PU。

### 12. 对上游裁定与冲突登记的影响

- **D1 §5 / D10 §5.2（澄清，不改条件）**：门区在 `∀φ0` 下等价于全周期交集；`⋂δ` 由全相位量化自动满足；实现取闭式全周期交集、无 pad。
- **D2 §10（确认）**：`coverage.partial` 使 I-00 §7.2 第 2 条不成立；D4 将其登记为 PU 的独立阻塞。
- **D3（不冲突）**：D3 的 NB 到达谓词内缩 0.5px；D4 的 PU 目标区域外扩 0.5px；两者方向相反，不得混用。
- **冲突登记**：A-04 标记 `RESOLVED（D4；graph.ts 尾参 + 独立增量审批）`；A-05 标记 `RESOLVED（D4；六条件表已冻结，2/5 BLOCKED）`；B-12 标记 `RESOLVED（D4：图割替代 P0 声明，标记不复用）`；B-02 仍 `OPEN`，但注明 D4 确认为 PU 条件 2 的阻塞。
- **D8**：按 §9 的顺序与授权条件落成正式门槛。
- **D9**：按 §10 字段集冻结内部契约；`hopSamplingCoverage` 与 `lagInvariantByConstruction` 必须可见。
- **AUTH**：必须把生产 PU 标为未授权，列出两项独立阻塞与未来恢复条件。

### 13. 边界与仍开放的风险

- 本票未修改任何产品文件；未新增 fixture pack；未运行生产测试。
- `graph.ts` 的任何改动仍待 D6 白名单与独立增量审批；`reach.ts` 不在范围。
- 生产 PU 不授权；I02-03 / I02-04 的内部结果只标 `modelConditional: true`。
- 未来恢复 PU 需要新的过近似图割研究（超集证明），不属于 I-02。
- 本票不产生任何生产验收声明；`NO_PROVEN_BLOCKER` 仍不等于可玩。
