# I00-10 垂直规避证明（G-04）

Type: grilling
Status: resolved
Owner: 用户裁定 · 2026-11-09
Blocked by: 01
Map: ../map.md
Class: I-00 / DECISION

## Question

G-04 规定：**不得相信调用方提供的 `verticalEvasionImpossible` 布尔标记**，必须根据可信几何与当前支持的玩家运动模型判断是否存在垂直规避路径；不能证明不存在时，不得以该假设输出永久封锁。

P0 原型恰恰把它当作调用方假设（`../level-playability-v1.1-p0/prototype/MODEL.md`），其 B 案的 `PROVEN_UNPLAYABLE` 依赖这条声明。同时 V1 的 `graph.ts` 已建模 walk-off / fall / 抛物线 hop，`FixedRuntimeProfile` 也固定了玩家几何——所以「垂直规避不可能」在本仓库不是无据可依；但把它接到时序分析上，会立刻碰到 PRD §2.2 的非目标（不做「玩家跳跃、下落、重力与移动 Hazard 的精确时序耦合」）。

### 必须裁定

1. **可用模型**：允许用 V1 的 hop / fall 图（不带时序）排除垂直规避，还是连这条也要排除？
2. **可证明的形状**：在什么几何条件下，`verticalEvasionImpossible` 可以被结构性证明（通路上下被 solid 封闭、hazard 高度 ≥ 可跳高度、无落脚点等）？
3. **无法证明时**：一律 `INSUFFICIENT_EVIDENCE`（即本次集成可能**无法**产出 `PROVEN_UNPLAYABLE`），还是把范围缩到特定关卡类别？
4. **对 G-01 / G-02 的依赖**：垂直规避的几何证据需要多强的来源保证；是否与 [I00-02](03-i00-02-asset-geometry-provenance.md) 共用同一套信任链。
5. **若结论是「必须精确建模跳跃时序」**：这直接超出 PRD 非目标 ⇒ 只剩「缩范围」或「停 effort」，须显式写成退出条件。

### 产出

裁定记录写入本票 `## Answer`；作为 [I00-R1](10-i00-r1-contract-freeze.md) 的输入。

### 备注

本票是对用户 2026-11-09 骨架的补充：G-04 在骨架里没有独立落点，而它决定 `PROVEN_UNPLAYABLE` 能否落地。

## Answer

用户 2026-11-09 裁定：**五个问题全部采纳推荐方案**。

### Q1 证明策略 —— (c) 组合

- **主证明：V1 图割。** 把「所有相位下恒被覆盖的门区」作为 forbidden region 放进 `graph.ts` 的移动图；起点与终点不连通 ⇒ 无垂直规避路径。
- **快速路径：结构化满高门。** hazard 在门区间覆盖整个可通行垂直区间时，直接判定，不必建图。
- 正当性来源：`graph.ts:26-30` 明写模型「往玩家更强那一侧偏」——更强的玩家都过不去，真实玩家必然过不去。
- 图割**不消费时间维度**，因此不触碰 PRD §2.2 的「跳跃与移动 Hazard 精确时序耦合」。

### Q2 hop 上近似的地位

- **允许**作为「受支持的玩家运动模型」的一部分。
- 契约限定语：**时序分析只消费 hop 的可达性上近似，不消费其时间维度**。跳跃可用于**排除**垂直规避，不可用于**证明**某个时间窗口存在。

### Q3 几何可信度门槛

- **硬门槛**：参与判定的全部 terrain / solid / hazard 几何 coverage 必须为 `checked`；hazard 帧几何还必须通过 I00-02 的信任链。
- 任一 `partial` / `unknown` ⇒ `INSUFFICIENT_EVIDENCE`，不得以图割结论输出 `PROVEN_UNPLAYABLE`。
- 已知影响面：terrain 为 `checked`，实体几何可能 `partial`（`profile.ts:92-97`），因此本门槛会实际挡下一部分关卡。

### Q4 门区构造

- forbidden region = `[L, R] × hazard 的 y 区间`，**按玩家几何外扩**（脚点图 + 玩家盒子尺寸）。
- **不带 lag pad**：与 P0 永久封锁门一致，取所有可能位姿的交集，不取并集。
- **不预设纵向满高**：图会自己找到绕行；找不到绕行才是证明。

### Q5 证明不了时的默认与退出条件

- 一律 `INSUFFICIENT_EVIDENCE`。**接受**「一部分真实不可玩的关卡永远不会被判 `PROVEN_UNPLAYABLE`」。
- 冻结文档的能力声明必须写明：`PROVEN_UNPLAYABLE` 仅在三条同时成立时给出——**门区恒覆盖 + 全部参与判定的几何 `checked` + 图割不连通**。
- **退出条件是缩范围，不是放宽**：某类关卡反复落 IE 而理论上有解，属于 I-02 要补的能力，不得把 IE 改写成 PU。

### 下游

并入 [I00-R1](10-i00-r1-contract-freeze.md)；实测方案与负例并入 [I00-07](09-i00-07-hard-gate-matrix.md) 的 G-04 条目。
