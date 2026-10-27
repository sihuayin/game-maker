# 11. 跨阶段集成测试（§8.2）

Type: task
Status: resolved
Owner: main session · 2026-10-27
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

## Answer（实施 · 2026-10-27）

- **集成测试文件**：`packages/pipeline/tests/delivery-integration.test.ts`（4 条，**不付费、假上游 + 临时 out 树**）。
- **QA 硬失败 → delivery 提前落盘**（端到端 through `runBuild`）：真链上响一次 `reachability`，断言报告先落盘、
  `delivery` 记 qa=`fail`、site/playable-smoke=`blocked`、visual-review=`incomplete`、verdict=`fail`、**不伪造站点版本**、
  QA 层 `subject` 原样。→ 锁死票 08 在 `create-game.ts` 接的那条线（此前只有 builder 单测、没有端到端）。
- **build → site → 视觉一路串**：站点成功（试玩/视觉 incomplete）→ 视觉评审 pass → verdict 仍 `incomplete`（试玩没做完，
  视觉通过 ≠ 交付通过）。
- **站点确定性失败 → delivery**：site=`fail`、smoke=`blocked`、verdict=`fail`、site 字段省略。
- **smoke 检查项并进 delivery**：`mapPlayableSmoke(navigate 超时)` → incomplete+UNKNOWN，作为 `playable-smoke` 检查项
  并进 `buildDeliveryReport`，verdict 归 incomplete（这是阶段C 读真实 result.json 后要做的同一件事）。

**验证**：`pnpm vitest run packages/pipeline/tests/delivery-integration.test.ts` 4/4 绿；`pnpm test` 全仓 **2058/2058** 绿；
`pnpm typecheck` 全绿。

**范围注**：票 11 项 3（跨版本不误用）由 `publish-gate.test.ts` 的「多个候选按 subject 精确匹配」覆盖（`assertPublishableQa`
已挡旧包报告给新包放行），本票不重复；项 5（报告生成异常不静默成功）由 `tryWriteDelivery`（票 08）+ QA 失败路径的
`try/catch` 收尾覆盖。smoke 真实 result.json 的读盘写盘留待 [12 阶段C 真实产物验收](issues/12-stage-c-real-artifact-acceptance.md)。
