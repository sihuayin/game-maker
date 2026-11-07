# P0-03 A/B/C 三案例验证与真实 Runtime 对照

Type: task
Status: open
Owner:
Blocked by: 05, 06
Map: ../map.md

## Question

用 P0-02 原型对 A/B/C 求值，并对 A、B 使用真实 Phaser Runtime 做对照，产出配置、运行记录与判断对照报告。

### 必须交付

- `evidence/03-case-comparison.md`，逐案例记录：
  - 玩家位置、Hazard 位置、时间、碰撞事件（来自 playtest `trace` / `events` / `input`）；
  - 分析器判断与证据（安全窗口区间、或不可玩证明、或 `INSUFFICIENT_EVIDENCE` 的原因）；
  - 判断一致 / 不一致的结论。
- A：安全窗口必须同时被算法与真实 Runtime 支持（玩家等待后通过且未被命中）。
- B：不可玩结论必须由算法证明支撑；有限时间试玩失败只作旁证，**不得单独**证明不可玩。
- C：分析器明确落 `INSUFFICIENT_EVIDENCE`；不强制跑 Runtime。
- 原始运行目录、命令、退出码、commit SHA。

### P0-02 算法冻结对 P0-03 的要求（2026-11-07 用户裁定）

- 记录真实 Runtime `trace` 的最大帧间隔。
- 记录采用的安全余量及其理由。
- 记录最终 `lagMs`。
- 同时给出 `16.67ms` 与 `200ms` 两档 `lagMs` 的敏感性结果。
- **不得**把观测最大帧间隔直接宣称为 Runtime 的绝对上界。

### P0-02R 有条件通过的条件（2026-11-07 用户裁定）

本票产出的每个正式案例必须满足以下两项审计，否则**不得**作为确定性结论的验收证据：

1. **Hitbox 来源审计**：记录实际使用的 hitbox 来源，且能追溯到当前 accepted pack；无法证明时，即使 `certainty.hitbox = "known"` 也不得作为可靠的确定性证据。
2. **Lag 敏感性审计**：记录真实 trace 最大帧间隔、余量依据、最终 `lagMs`，以及 `16.67ms` / `200ms` 两档结果。

完整裁定见 [`../evidence/02r-ruling.md`](../evidence/02r-ruling.md)。

### 边界

- 复用现有 playtest harness；若 trace 无法提供必要证据，停止并提交 P0-03R 裁定，不得新增观察字段。
- 不修改 Runtime / 生产判据 / 历史产物；零付费。
