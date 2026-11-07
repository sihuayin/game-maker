# P0-03 A/B/C 三案例验证与真实 Runtime 对照

Type: task
Status: resolved
Owner: agent（AFK）· 2026-11-07
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

## Answer

**2026-11-07 完成（agent，AFK）。** 用 P0-02 冻结原型对 A/B/C 求值，并对 A/B 在真实 Phaser Runtime 上做 `--repeat 2` 对照；未新增观察字段、未改 Runtime / 生产判据 / 历史产物，零付费。

| 交付 | 结果 |
|---|---|
| 对照报告 | [`../evidence/03-case-comparison.md`](../evidence/03-case-comparison.md) |
| 原始运行目录 | [`../evidence/03-runs/a/`](../evidence/03-runs/a/)、[`../evidence/03-runs/b/`](../evidence/03-runs/b/)（各 `attempt-v1` / `attempt-v2`） |
| 运行摘要 | [`../evidence/03-runs/run-summary.json`](../evidence/03-runs/run-summary.json) |
| 分析器结果 | [`../evidence/03-analyzer-results.json`](../evidence/03-analyzer-results.json) |
| hitbox / E3 审计 | [`../evidence/03-runs/hitbox-rescan.json`](../evidence/03-runs/hitbox-rescan.json) |
| 分析脚本 | [`../tools/p0-03-analysis.mjs`](../tools/p0-03-analysis.mjs) |

### 命令与退出码

| 命令 | 退出码 |
|---|---|
| A playtest `--repeat 2 --json` | 0 |
| B playtest `--repeat 2 --json` | 0 |
| `node .../tools/p0-03-analysis.mjs --out .../evidence/03-analyzer-results.json --json` | 0 |
| `node .../tools/e3-rescan.mjs --out .../evidence/03-runs/hitbox-rescan.json --json` | 0 |

### 关键结果

- **Lag 审计**：四轮真实 trace 的观测最大间隔 **94 ms**（p95 39–40ms、中位数 37–38ms、无 >100ms）；
  最终 `lagMs = 200ms`（余量 106ms，锚定 P0-01 的 Phaser `delta ≤ 200ms` 源码上限）。
  16.67ms / 200ms 两档：A 均 `NO_PROVEN_BLOCKER`，B 均 `PROVEN_UNPLAYABLE`，C 均 `INSUFFICIENT_EVIDENCE`。
- **Hitbox 审计**：A `prop-luggage-pile`（1 帧）、B `hazard-sweeping-carriage`（2 帧），复制包 manifest
  `sha256:145cb28d…` 与 accepted pack 一致；帧 `sourceSize`/`anchor` 全部匹配；站点配置与案例配置逐字段相等。
- **A**：分析器安全窗口 `[1083.3,2916.7]`（16.67ms）/ `[1266.7,2733.3]`（200ms）；构造的「等待→通过」
  witness 两档均 `verifyWitness=null`。Runtime 两次均 `won=true` / `reset=0` / `collected=1`，等待约 2.7s 后通过。
- **B**：永久封锁门 `[548,592]`（宽 44）两档均 `PROVEN_UNPLAYABLE`；Runtime 两次均 5 次复位、`won=false`、
  `reset-exhaustion`。试玩失败只作旁证，不可玩结论来自证明。
- **C**：`phase-uncertain` / `hitbox-uncertain` 两档均 `INSUFFICIENT_EVIDENCE`；不是不可玩结论。
- **判断一致性**：A/B/C 均与分析器判断一致；A 的 Runtime 通过包含一次跳跃，P0-03R 应确认其与水平等待 witness 的关系。

### 边界

- 未修改 `fixtures/**`、`run/**`、`pack/**`、`site/**`、`packages/**` 源码；未新增依赖；零付费；未推送 / 合并。
- 站点字节两次运行前后 `site-integrity.unchanged=true`；没有新增观察字段。

### 提交与回退

- 本票工作提交：`968607a2717aa3c252158e779d88656e2739ce75` — `P0-03: A/B/C case validation with real-runtime comparison and lag/hitbox audits`
- 回退点：本票开始前 HEAD `be234df`（P0-03a 收口）。
