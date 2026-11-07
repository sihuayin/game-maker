# P0-03R 案例证据复核

Type: grilling
Status: resolved
Owner: amber（HITL）· 2026-11-07
Blocked by: 07
Map: ../map.md

## Question

人工复核三案例的配置、真实 Runtime 记录与判断对照，裁定证据是否足以进入结论包。

### 复核清单

1. A 的安全窗口是否同时有算法区间与真实 Runtime 行为支持？有没有「刚好没撞到」的偶然性？
2. B 的不可玩结论是否来自证明，而不是有限试玩失败？证明是否覆盖所有等待 / 重试策略？
3. C 是否明确 `INSUFFICIENT_EVIDENCE`，且原因与 P0-01R 的未确认事项对应？
4. 案例配置是否受控、可复现？是否修改了既有 fixture / 历史配置？
5. 是否存在 harness 限制被误当成游戏结论？
6. 是否需要补证 / 暂停 / 扩展案例？
7. 每个正式案例是否记录了 hitbox 来源，且可追溯到当前 accepted pack？无法追溯时，是否被排除在确定性结论之外？
8. 是否记录了真实 trace 最大帧间隔、余量依据、最终 `lagMs`，以及 `16.67ms` / `200ms` 两档敏感性？未记录的案例是否被排除在确定性结论之外？

### 交付

- `evidence/03r-ruling.md` + 本票 `## Answer`：**证据充分 / 需补证 / 不通过**，逐案例列裁定。
- 不产生产品代码 commit。

### 通过标准

- 用户明确批准；未通过时 P0-04 保持 blocked。

## Answer

**2026-11-07 用户裁定（amber，HITL）：证据复核通过 · 证据充分。** 完整裁定见 [`../evidence/03r-ruling.md`](../evidence/03r-ruling.md)。

| 票项 | 裁定 | 必须保留的边界 |
|---|---|---|
| Q1 — A 双侧支持 | 接受 (a) | 算法证明水平等待后通过；Runtime 通过跳跃。Runtime 未逐段复现水平 witness，不得声称同机制验证。 |
| Q2 — B 永久封锁 | 接受 | 永久封锁门的几何证明覆盖所有等待、折返和重试策略。Runtime 复位与 `reset-exhaustion` 仅作一致旁证。 |
| Q3 — C 不确定性 | 接受 | 两类不确定性均正确降级为 `INSUFFICIENT_EVIDENCE`，不需要额外 Runtime 测试。 |
| Q4 — `lagMs=200ms` | 接受 | 94ms 是已观测最大间隔，不是绝对上界；200ms 是源码级上界。两档敏感性结果均须保留。 |
| Q5 — Hitbox / fixture | 接受 | accepted pack 来源、manifest 哈希、帧几何、配置一致性及 fixture 未修改证据满足要求。 |
| Q6 — 总体证据 | 证据充分 | 附带 A 的机制表述限制；不新增案例、不扩展 harness。 |

### 写入结论包的正式裁定

1. **A：安全通过方式得到双侧支持，但机制不等价。** 只能得出该案例存在安全通过方式，不能得出 Runtime 已验证水平 witness。
2. **B：不可玩证明成立。** 永久封锁门覆盖所有可能位姿；受控配置排除跳跃与绕行；Runtime 复位仅作一致旁证。
3. **C：不确定性降级正确。** `phase-uncertain` / `hitbox-uncertain` 均落 `INSUFFICIENT_EVIDENCE`，未误判为不可玩。
4. **时间边界：** 最终 `lagMs=200ms`；94ms 仅为观测值，不能写成 Runtime 最大帧间隔的绝对保证。
5. **输入完整性：** A/B 的 hitbox 均可追溯至 accepted pack；fixture 与配置完整性检查通过。

### 后续影响

- **P0-03**：可以收口，不再补证。
- **P0-04**：从 blocked 解阻，进入最终 HITL 裁定。
- **P0-04 裁定范围**：只允许在 `GO / CONDITIONAL GO / NO-GO` 中作最终技术结论，不自动授权 Pipeline / Runtime 集成。
- **若为 GO**：只能提出推荐集成范围与前置条件，必须另开 effort、另行授权。

### 总体证据边界

本次通过证明的是**单个移动 Hazard 案例的时序分析能力**，不是对所有 Runtime 运动机制的等价验证。
GO 仅表示 Temporal Playability P0 的技术可行性得到支持，不代表 V1.1 已可直接进入 Runtime 或 Pipeline。

- 本票不产生产品代码 commit；复核对象为 `968607a`。
