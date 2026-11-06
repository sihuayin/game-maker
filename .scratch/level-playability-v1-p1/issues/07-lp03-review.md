# LP-03 复核：机制判据语义一致性

Type: grilling
Status: open
Owner: —
Blocked by: 06
Map: ../map.md

## Question

HITL 复核 [LP-03 机制可通行性判据](06-lp03-mechanic.md)（PRD §4.4 / §6.3 第三次强制复核）。本票由用户裁定。

### 必须裁定

1. 判据是否基于已核实的真实机制语义？是否存在把「危险存在」等同于「不可通行」的情况？
2. 安全窗口判定的时间 / 空间证据是否充分？巡逻 hazard 等未建模情况是否保持 `INSUFFICIENT_EVIDENCE`？
3. 合法危险机制是否被误阻断？阻断结果是否可解释、可复现？
4. 是否通过复核。**通过后进入完成性分析**；不通过则硬停，裁定修复、缩小范围或放弃。

### 输出

- 本票 `## Answer`：逐条判据裁定 + 机制语义结论 + 后续约束。
- 更新 `../map.md` 的 Decisions so far。

### 通过标准

- 机制判据符合真实机制语义；无误伤；通过后允许进入 LP-04。

## Context

- 实现：`1a5c369`；票据 Answer 在 [06-lp03-mechanic.md](06-lp03-mechanic.md)。
- 生产夹具：`packages/contracts/tests/fixtures/playability-mechanic-matrix.json`（6 例）；测试：`packages/contracts/tests/playability-mechanic.test.ts`（25 例）。
- 语料证据：[evidence/05-lp03-mechanic.json](../evidence/05-lp03-mechanic.json)（20 唯一 config；4 个历史/probe 命中、14 证据不足、2 层内无阻断）。
- **必须裁定**：`pickup-in-static-hazard`（#28）的生产层 verdict 是 `PROVEN_UNPLAYABLE` —— 被包住的 pickup 本身仍是 gap，但同一 hazard 封死其后的 suitcase-3/gate。39 例机制分布因此为 **18/17/4**，而不是 LP-02 复核时的 17/17/5。
- **已按 V1 边界降级**：巡逻 hazard、moving-platform、被 hazard/danger 包住的目标、多 danger、非全列 danger、mid-air touch-only。
