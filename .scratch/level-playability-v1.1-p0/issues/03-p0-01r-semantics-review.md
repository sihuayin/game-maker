# P0-01R 语义证据复核

Type: grilling
Status: resolved
Owner: amber（HITL 复核）· 2026-11-07
Blocked by: 02
Map: ../map.md

## Question

人工复核 P0-01 的增量语义报告，裁定哪些事实可以作为 P0-02 的建模假设。

### 复核清单

1. 每条用于算法建模的关键假设是否都有源码或实验依据（E1 / E3）？
2. 「未确认事项」是否被诚实标出，而不是被默认值掩盖？
3. reset 后 Hazard 是否继续运动、位置更新与碰撞检测的先后顺序是否有明确证据？
4. 每个未确认事实是否映射到「对应判据只能 `INSUFFICIENT_EVIDENCE`」？
5. 是否有超出移动 Hazard 范围的结论被误写进来？

### 交付

- 复核票只产出裁定记录：`evidence/01r-ruling.md` + 本票 `## Answer`。
- 裁定必须逐条列出：**可采信 / 需补证 / 不可采信**，以及对应的 P0-02 约束。
- 不产生产品代码 commit。

### 通过标准

- 用户明确批准（或要求补证 / 暂停）。
- 未通过时 P0-02 保持 blocked；不得用 agent 自评代替人工批准。

## Answer

**2026-11-07 完成（用户 HITL 裁定）。** 通过（附硬约束）；P0-02 解锁，P0-03 仍由 P0-02R 阻断。

- 裁定记录：[`../evidence/01r-ruling.md`](../evidence/01r-ruling.md)
- 本票裁定与约束提交：`8f66a3af0871ff4e48fd14b13a70801091f73cf9` — `P0-01R: ruling record and hard constraints into P0-02/02R/03a`
- 复核对象：`01-moving-hazard-semantics.md` @ `4dd0ffa430218a5a6ba09d35844ad502666a3523`
- 复核人：amber

### 逐项裁定

| 复核项 | 裁定 |
|---|---|
| Q1 六项 CONFIRMED | 全部可采信；三条证据边界作为 P0-02 硬约束 |
| Q2 一帧碰撞滞后 | 可采信；用扫掠带与连续包络覆盖，不以瞬时几何相交证明安全或命中 |
| Q3 y 轴 mover | 源码级采信；主案例限定 x 轴，无 Runtime witness 不得给确定性结论 |
| Q4 E3 语料数字 | 有条件采信（b 方案）：辅助证据；P0-03a 必须落盘扫描脚本并复跑 |
| Q5 U1–U8 | U1/U2/U3/U5/U6/U8 硬降级；U4 边界条件；U7 范围事实 |
| Q6 CONTEXT.md | 不修改；不新增 ADR；记录在 ruling 与 P0-02 约束中 |

- **不可采信**：无。
- **需补证（不阻断 P0-02）**：E3 扫描脚本未落盘 → P0-03a 交付可重复脚本并复跑，差异必须解释。
- 硬约束已写入 [P0-02 最小时序模型与独立原型](04-p0-02-temporal-model-prototype.md)、[P0-02R 模型健全性复核](05-p0-02r-model-review.md)、[P0-03a 合成案例与 scratch 站点](06-p0-03a-case-fixtures.md)。
- 最终原则：宁可多返回 `INSUFFICIENT_EVIDENCE`，也不能用未经证明的时间或碰撞假设制造 `PROVEN_UNPLAYABLE`。
- 本票不产生产品代码 commit。
