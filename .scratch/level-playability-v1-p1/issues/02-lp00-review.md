# LP-00 复核：Runtime 语义证据是否充分

Type: grilling
Status: open
Owner: —
Blocked by: 01
Map: ../map.md

## Question

HITL 复核 [LP-00 Runtime 语义核验](01-lp00-runtime-semantics.md) 的证据档案，裁定是否可进入几何实现（PRD §4.1 / §6.3 第一次强制复核）。本票由用户裁定，agent 只呈现证据与影响分析。

### 必须裁定

1. P1–P4 每项证据是否充分、是否可复现？是否存在用推测补齐语义的情况？
2. 标为 `CONTRADICTED` / `INSUFFICIENT_EVIDENCE` 的项，相关判据是降级为 `INSUFFICIENT_EVIDENCE`，还是缩小本轮范围？
3. LP-01 可使用的几何语义边界是否明确？P1 的逐帧 atlas 误差边界是否已写清（本轮不解决，只记录）？
4. 是否通过复核。**不通过则硬停**：裁定修复、缩小范围或放弃，不得进入 LP-01。

### 输出

- 本票 `## Answer`：逐项裁定 + 受影响判据 + 对 LP-01～LP-04 的约束。
- 更新 `../map.md` 的 Decisions so far；必要时新增 / 调整票据，清理已清晰的 fog。

### 通过标准

- P1–P4 每项有明确处置（证据充分 / 降级 / 阻断）。
- 通过时能一句话回答：「哪些几何假设现在可以作为确定性判据的基础」。
