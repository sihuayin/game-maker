# 13. CLI 摘要（FR-06，P1）

Type: task
Status: resolved
Owner: main session · 2026-10-27
Map: ../map.md

## Question

落地 FR-06（**P1，不阻塞核心报告交付**）：从 `delivery` 派生终端交付聚合摘要，复用现有「观察摘要」机制
（票 04 Q5 裁定：追加最终 verdict + 失败项 + 未完成项 + 视觉评审状态 + 已知限制）。

- `delivery` 缺席时明示「尚无交付结论」，**不默认显示 pass**。
- `--json` / MCP 复用**同一份**结构化数据，不另建交付状态计算逻辑（复用 `deriveDeliveryVerdict` / `deliveryVerdictOf`）。
- 不重复输出完整报告（全文仍在 `qa-report.json`）。

边界：只做**摘要渲染**，不加评分/阈值/阻断；失败与未完成项分开列，不把同一问题在多个阶段的重复记录当多个缺陷。

## Answer（实施 · 2026-10-27）

- **摘要函数**：`packages/pipeline/src/delivery.ts` 新增 `deliverySummaryOf(delivery | undefined)`（共享给 CLI 与 MCP）——
  **只渲染、不重算**：`verdict` 直接读 `delivery.verdict`（`deriveDeliveryVerdict`/`deliveryVerdictOf` 已经算好）。
  失败 / 未完成 / 阻塞**分开列**，视觉评审状态 + 已知限制各一行；`delivery` 缺席 ⇒ 明示「尚无交付结论」，**不默认 pass**。
- **CLI 接线**：`buildAndSite` 返回 `delivery`（`buildSiteSuccessDelivery` 的产物既落盘、又给摘要），
  `createComplete` / `buildComplete` 追加 `deliverySummaryOf` 的 summary + data。
- **MCP 接线**：`create_game` 同样捕获 `delivery`，`structuredContent` 追加同一份 data。
- **同源**：`data` 里 `deliveryVerdict` / `deliveryChecks` / `visualReview` / `knownLimitations` 由**同一个函数**产出，
  `--json` 与 MCP 不各起一套。
- **测试**：`packages/pipeline/tests/delivery.test.ts` +4 条 —— 缺席不冒充 pass、全 pass、试玩 UNKNOWN、QA 硬失败分开列。

**验证**：`pnpm vitest run packages/pipeline/tests/delivery.test.ts` 16/16 绿；`pnpm test` 全仓 **2062/2062** 绿；
`pnpm typecheck` 全绿。

**范围注**：只做**摘要渲染**（不加评分/阈值/阻断）；全文仍在 `qa-report.json`。本票是地图**最后一张** ——
13 张票全收口，目的地已达。
