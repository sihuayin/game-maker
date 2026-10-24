# 03. R12 拒绝契约：是否结构化 mechanicId / requirementId

Type: grilling
Status: resolved
Owner: main session · 2026-10-23
Blocked by: —
Map: ../map.md

## Question

R12 的拒绝是否要把 `mechanicId` / `requirementId` 从 `detail` 自由文本里提成**结构化字段**（文档 §FR-03 示例
`{code, stage, mechanicId, requirementId}`），还是维持现有 `{ reason, detail }`？

## 现状（E1）

- 错误契约 = `{ reason, detail }`（`build-design.ts:48`）；缺失项的 `id` + `saidAs` 其实**已经**结构化在
  `auditIntentCoverage` 的 `MissingIntentItem`（`intent-coverage.ts:81-99`）里，只是 `Rejection` 只留了 `detail` 文本。
- 文档 §FR-03 明写「具体字段应遵循仓库现有错误契约；以上仅为语义示例，不要求直接照搬」。

## 建议

**维持 `{ reason, detail }`，不改错误契约**。覆盖报告需要的 per-mechanic 关联**直接读 `auditIntentCoverage` 的
结构化输出**（[票 07](07-coverage-report.md)），不必让 R12 错误形状承载它——避免破坏既有消费者
（`compile-design.ts:288-299`、终端摘要）。若裁定要结构化，则承载实现：`Rejection` 加可选字段 + 终端渲染更新。

## Answer

**裁定（2026-10-23 · 用户逐字）**：(a) 维持 `{ reason, detail }`，不改错误契约。

- **零代码改动**。R12 拒绝继续只当「给人看的解释」。
- per-mechanic 结构化关联归 `auditIntentCoverage` 的 `MissingIntentItem`，由 [票 07](07-coverage-report.md) 直接读。
- 不做 `mechanicId` / `requirementId` 结构化（避免与 `auditIntentCoverage` 输出**漂移**——「同一份数据两个家」）。
