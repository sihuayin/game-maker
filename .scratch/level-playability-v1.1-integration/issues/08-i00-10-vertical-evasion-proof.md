# I00-10 垂直规避证明（G-04）

Type: grilling
Status: open
Owner: —
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
