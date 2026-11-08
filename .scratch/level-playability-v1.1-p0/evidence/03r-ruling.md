# P0-03R 案例证据复核裁定

| 项 | 值 |
|---|---|
| 日期 | 2026-11-07 |
| 复核对象 | [P0-03 A/B/C 三案例验证与真实 Runtime 对照](../issues/07-p0-03-case-validation.md) @ `968607a`；证据 [`03-case-comparison.md`](03-case-comparison.md)、[`03-runs/`](03-runs/) |
| 复核人 | amber（HITL） |
| 裁定 | **证据复核通过 · 证据充分** |
| 结论 | P0-03 可以收口；P0-04 从 blocked 解阻 |
| 性质 | 只产出裁定记录；不产生产品代码 commit |

## 1. 逐项裁定

| 票项 | 裁定 | 必须保留的边界 |
|---|---|---|
| Q1 — A 双侧支持 | **接受 (a)** | 算法证明水平等待后通过；Runtime 通过跳跃。Runtime 未逐段复现水平 witness，不得声称同机制验证。 |
| Q2 — B 永久封锁 | **接受** | 永久封锁门的几何证明覆盖所有等待、折返和重试策略。Runtime 复位与 `reset-exhaustion` 仅作一致旁证。 |
| Q3 — C 不确定性 | **接受** | 两类不确定性均正确降级为 `INSUFFICIENT_EVIDENCE`，不需要额外 Runtime 测试。 |
| Q4 — `lagMs=200ms` | **接受** | 94ms 是已观测最大间隔，不是绝对上界；200ms 是源码级上界。两档敏感性结果均须保留。 |
| Q5 — Hitbox / fixture | **接受** | accepted pack 来源、manifest 哈希、帧几何、配置一致性及 fixture 未修改证据满足要求。 |
| Q6 — 总体证据 | **证据充分** | 附带 A 的机制表述限制；不新增案例、不扩展 harness。 |

## 2. 写入结论包的正式裁定

1. **A：安全通过方式得到双侧支持，但机制不等价。**
   算法支持水平等待后穿越；真实 Runtime 支持等待后跳跃。只能得出**该案例存在安全通过方式**，
   不能得出 **Runtime 已验证水平 witness**。
2. **B：不可玩证明成立。**
   永久封锁门覆盖所有可能位姿，且受控配置排除了跳跃和绕行。Runtime 复位仅作为一致旁证。
3. **C：不确定性降级正确。**
   `phase-uncertain` 与 `hitbox-uncertain` 均返回 `INSUFFICIENT_EVIDENCE`，没有把证据不足误判成不可玩。
4. **时间边界：`lagMs=200ms` 是最终采用值。**
   94ms 仅为观测值，不能写成 Runtime 最大帧间隔的绝对保证。
5. **输入完整性：**
   A/B 的 hitbox 均能追溯至 accepted pack；fixture 与配置完整性检查通过。

## 3. 对后续工作的影响

- **P0-03**：可以收口，不再补证。
- **P0-04**：从 blocked 解阻，进入最终 HITL 裁定。
- **P0-04 的裁定范围**：只允许在 `GO / CONDITIONAL GO / NO-GO` 中作最终技术结论，
  **不自动授权** Pipeline / Runtime 集成。
- **后续若为 GO**：只能提出推荐集成范围与前置条件，必须**另开 effort、另行授权**。

## 4. 总体证据边界

本次通过证明的是**单个移动 Hazard 案例的时序分析能力**，
不是对所有 Runtime 运动机制的等价验证。
P0-04 若建议 GO，必须同时写入以下限制：

- A 的机制不等价（算法水平等待 vs Runtime 跳跃）；
- B 的证明适用范围（单 Hazard、x 轴、受控配置下垂直规避不可能、永久封锁门）；
- C 的不确定性降级（`phase-uncertain` / `hitbox-uncertain`）；
- `lagMs=200ms` 的源码级上界，以及 94ms 只是观测值。

GO 仅表示 **Temporal Playability P0 的技术可行性得到支持**，
不代表 V1.1 已可直接进入 Runtime 或 Pipeline。
