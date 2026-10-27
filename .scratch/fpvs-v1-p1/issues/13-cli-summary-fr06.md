# 13. CLI 摘要（FR-06，P1）

Type: task
Map: ../map.md

## Question

落地 FR-06（**P1，不阻塞核心报告交付**）：从 `delivery` 派生终端交付聚合摘要，复用现有「观察摘要」机制
（票 04 Q5 裁定：追加最终 verdict + 失败项 + 未完成项 + 视觉评审状态 + 已知限制）。

- `delivery` 缺席时明示「尚无交付结论」，**不默认显示 pass**。
- `--json` / MCP 复用**同一份**结构化数据，不另建交付状态计算逻辑（复用 `deriveDeliveryVerdict` / `deliveryVerdictOf`）。
- 不重复输出完整报告（全文仍在 `qa-report.json`）。

边界：只做**摘要渲染**，不加评分/阈值/阻断；失败与未完成项分开列，不把同一问题在多个阶段的重复记录当多个缺陷。
