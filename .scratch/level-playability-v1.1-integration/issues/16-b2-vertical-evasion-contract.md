# B2 G-04 垂直规避证明的契约边界

Type: task
Status: claimed
Owner: agent（AFK）· 2026-11-09
Blocked by: —
Blocks: 10（R1 签署）
Map: ../map.md
Class: I-00 / DELIVERABLE

## Question

把 G-04 的证明边界写成可冻结的**正式契约条文**。R1 已给定方向，但尚未成文；「图割不连通」四个字不足以构成证明。

### 必须交付

1. **图的边界声明**：`graph.ts` 的运动模型覆盖哪些边（walk / walk-off / fall / hop），哪些不支持（精确跳跃时序、下落与重力的时间耦合、模型外状态转换）。逐条给 `file:line`。
2. **图割证明的形式条文**：门区定义（`[L, R] × hazard 的 y 区间`，按玩家几何外扩，**不带 lag pad**）、forbidden region 的注入方式、连通性判据、起点/终点相对门区的判侧规则。
3. **降级条文**：任一参与判定的几何非 `checked`、存在模型外垂直规避可能、或无法证明不存在 ⇒ `INSUFFICIENT_EVIDENCE`。
4. **禁止条文**：不得接受调用方 `verticalEvasionImpossible = true`；不得以「图割实现麻烦」为由跳过；不得把 hop 的时间维度引入时序判定。
5. **负例清单**：每条对应一个 I-04 用例（踩平台绕过、从上方绕过、门下方有坑、可爬墙、门区与地形重叠等）。
6. **与 G-01 的耦合**：几何来源不可信时本条文自动失效 ⇒ G-04 不成立 ⇒ `PROVEN_UNPLAYABLE` 不可达。

### 产出

`evidence/b2-vertical-evasion-boundary.md`——条文草案，可直接并入 `docs/v7.8/移动-I00.md`。

### 边界

只读；不改产品代码；不 commit。

## Answer

（待补）
