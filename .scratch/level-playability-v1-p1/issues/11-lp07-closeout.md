# LP-07 最终收口

Type: grilling
Status: open
Owner: —
Blocked by: 10
Map: ../map.md

## Question

汇总 LP-00～LP-06 的实现与证据，形成可审查、可复现、可回退的完整交付，并由用户裁定收口（PRD §4.8）。本票 HITL。

### 必须交付

1. 完整实现代码、全部自动化测试。
2. 历史语料回归报告与 39 例矩阵验收报告。
3. Runtime 语义证据档案（LP-00）。
4. 判据结果及误报分析。
5. Pipeline 集成证据。
6. 版本与 commit 记录。
7. 已知限制与回退说明（含未证明项与 `INSUFFICIENT_EVIDENCE` 清单）。

### 必须裁定

1. AC-01～AC-12 逐项是否满足。
2. 是否存在越界修改（Runtime / Contract / CLI / MCP / 历史产物）。
3. 是否将 Draft PR 转为正式 PR。**不自动合并、不推送 `main`**。
4. 是否关闭本图；未决问题如何交接。

### 输出

- `../evidence/07-final-report.md`（或更新同名报告）：完整验收结论与证据索引。
- 本票 `## Answer`：逐项裁定、PR 链接、已知限制、回退点。
- 更新 `../map.md` 的 Status 与 Decisions so far，关闭地图。

### 通过标准

- 最终 PR、完整证据与回退说明齐全。
- 最终报告保留 `NO_PROVEN_BLOCKER` ≠ 「可玩」的语义区别。
