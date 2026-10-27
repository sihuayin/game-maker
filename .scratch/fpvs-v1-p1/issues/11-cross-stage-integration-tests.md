# 11. 跨阶段集成测试（§8.2）

Type: task
Map: ../map.md

## Question

落地 §8.2 集成测试（前置：07/08/09/10 实施已落地）。用测试注入口 + 临时 out 树（**不付费、不跑真生图**）验证
`create → build → QA → site` 链上的报告关联，至少覆盖：

1. **站点构建失败** → `delivery.checks["site"] = fail`、`playable-smoke` blocked、最终 verdict `fail`。
2. **headless smoke 未完成**（`result.json` `ok:false` 超时）→ `mapPlayableSmoke` 映射 incomplete + UNKNOWN，状态传递进 delivery。
3. **资源包版本变化** → 旧包报告不误用于新包（`assertPublishableQa` 已挡，补一条跨版本集成断言）。
4. **视觉评审结果**（`review-verdict`）→ 进最终报告，verdict 重算。
5. **报告生成异常不静默成功**：delivery 写失败不伪造 pass。

边界：复用现有注入口（`BuildInput.qa` / `inspect` / `verify` 测试注入口）；产物只落 `out/` 或临时目录；
不重跑真生图/真付费。§8.2 测试策略原文见 `docs/v7.3/报告.md`。
