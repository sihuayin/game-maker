# 07. 状态计算实施（枚举 + 最终交付状态计算 + §6 测试）

Type: task
Status: resolved
Owner: main session · 2026-10-27
Map: ../map.md

## Question

落地票 03 裁定的状态模型（实施，纯函数 + 契约 + 测试）：

1. **枚举**：在 `packages/contracts/src/` 新增 `DeliveryCheckStatus`
   （`"pass" | "fail" | "incomplete" | "blocked" | "not-required"`）与 `DeliveryVerdict`
   （`"pass" | "fail" | "incomplete" | "blocked"`）。小写连字符，独立于 `QAVerdict`/`HumanVerdict`/`RuntimeStatus`，
   不改现有枚举；各层通过显式映射转换。
2. **计算函数**：实现 `deriveDeliveryVerdict(checks)`，总序优先 `fail > blocked > incomplete > pass`；
   `not-required` 不参与最终状态计算；必需检查缺失 / 非法状态组合由契约校验拒绝，不靠异常兜底。
3. **§6 矩阵测试**：12 场景（A–L）全映射测试；再加：必需检查缺失、非法状态组合、
   「生成失败 → FAIL（下游 blocked 但最终 fail）」、`not-required` 绕过验收（必需检查不得标 not-required）等用例。
4. **CONTEXT.md**：在「交付与调用」节补 `DeliveryCheckStatus` / `DeliveryVerdict` 词条（领域词汇，不含实现细节）。

边界：不新增判据、不新增视觉阈值、不改现有枚举。票据 03 裁定全文见 issues/03-status-model.md。

## Answer（实施 · 2026-10-27）

- **枚举**：`packages/contracts/src/delivery.ts` 新增 `DeliveryCheckStatus`（`zod/v4` 五值 `pass/fail/incomplete/blocked/not-required`）+
  `DeliveryVerdict`（四值 `pass/fail/incomplete/blocked`），小写连字符、独立于 `QAVerdict`/`HumanVerdict`；从 `index.ts` 导出。
- **计算函数**：`deriveDeliveryVerdict(checks)` 实现总序 `fail > blocked > incomplete > pass`；`not-required` 不参与；
  必需检查项标 `not-required` → 抛错（兜底，不静默 pass）。
- **测试**：`packages/contracts/tests/delivery.test.ts` 19 条 —— §6 十二场景 A–L 全映射 + 总序优先 + not-required 排除 + 非法状态抛错。
- **CONTEXT.md**：「交付与调用」节补 `DeliveryCheckStatus` / `DeliveryVerdict` 词条（领域词汇，不含实现细节）。

**验证**：`pnpm vitest run packages/contracts/tests/delivery.test.ts` 19/19 绿；`pnpm typecheck` 全绿；`pnpm test` 全仓 2009/2009 绿。

**范围注**：「必需检查缺失」的检测不在本票 —— 纯函数只看得到「被标 required 的那些」，看不到「本该 required 却没出现的」；
它由票 08 的检查项注册表 + `DeliveryReport` schema 在写之前拒绝。
