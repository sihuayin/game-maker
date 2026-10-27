# 08. 交付报告契约 + 落盘实施

Type: task
Status: resolved
Owner: main session · 2026-10-27
Map: ../map.md
Blocked by: 07

## Question

落地票 04 裁定的报告契约与落盘时机（实施）：

1. **契约**：在 `packages/contracts/src/qa.ts`（或同包新文件）给 `qa-report/v1` 新增可选 `delivery?: DeliveryReport`，**不升版**。
   `DeliveryReport` 按票 04 Q2：`runId` + `pack`（复用 subject）+ `config.file` + `site?`（可省略，未装配时不伪造）+
   `checks[]`（key/status/detail，status 用票 07 的 `DeliveryCheckStatus`）+ `verdict`（票 07 `deriveDeliveryVerdict`）+
   `visualReview`（pending/pass/fail + reviewer/reviewedAt/note）+ `evidence[]` + `knownLimitations?`。
   旧报告无 `delivery` 仍解析；`delivery` 不存在 ≠ 交付通过。
2. **检查项必需性**：用代码里的固定检查项注册表声明每个 `key` 是否必需及其判定规则；不得靠 `not-required` 隐式绕过必需检查。
3. **两阶段落盘**：QA 步写 QA 层（现状）；site 装配成功后补写 `delivery`（含 site 版本 + verdict）。site 版本用 `assembleSite` 显式分配的版本，不事后 patch。
4. **失败路径落盘**（票 04 Q4 表）：QA 硬失败 → 补写 `delivery`（QA fail、下游 blocked、视觉 pending→incomplete、最终 fail）；
   site/smoke/视觉失败或未完成 → 按表落盘；收尾异常不覆盖原始失败、不伪造 pass。pack/config 生成失败不强行造报告。
5. **测试**：旧报告兼容、site 未生成省略、QA 硬失败提前落盘、收尾异常不覆盖、必需检查缺失 / not-required 绕过。

边界：不升版、不新增平行报告文件、不伪造站点版本、不覆盖 QA 层已写事实。票 04 裁定全文见 issues/04-qa-report-contract.md。

## Answer（实施 · 2026-10-27）

- **契约**：`packages/contracts/src/delivery.ts` 新增 `DeliveryReportSchema`（`runId` + `pack` 复用 subject + `config.file` +
  `site?` + `checks[]`{key/status/detail} + `verdict` + `visualReview`{pending|pass|fail + reviewer/reviewedAt/note} +
  `evidence[]` + `knownLimitations?`）+ 六检查项注册表（`DELIVERY_CHECK_KEYS` / `DELIVERY_REQUIRED_CHECKS`，**全部必需**）。
  `qa.ts` 的 `QAReportSchema` 加可选 `delivery?`，**不升版** —— 旧报告无 `delivery` 仍解析；`delivery` 缺席 ≠ 交付通过。
- **检查项必需性**：必需性**不住在 `checks[]` 每条里**，由 `DELIVERY_REQUIRED_CHECKS` 声明。schema superRefine 拒绝
  「必需检查项缺失」与「必需检查项标 `not-required`」，并校验 `verdict` 与 `deriveDeliveryVerdict` 一致、`site` 字段与
  `site` 检查项一致（有版本却记未通过 / 记通过却没版本都拒）。
- **两阶段落盘**：`packages/pipeline/src/delivery.ts` 提供 `writeDeliveryToReport`（读回 qa-report.json 并进 delivery、
  **不覆盖 QA 层字段**）+ `buildSiteSuccessDelivery` / `buildSiteFailureDelivery` / `buildQaFailureDelivery`。
  CLI/MCP 在 `assembleSite` 成功/失败后补写（`assembleSite` 显式分配的 site 版本，不事后 patch）；`create-game.ts` 在
  QA 硬失败（含机制覆盖缺）时**提前**落。
- **失败路径落盘**（票 04 Q4 表）：QA 硬失败 → 提前落（qa `fail`、site/smoke `blocked`、视觉 `incomplete`、最终 `fail`）；
  站点确定性失败 → 落（site `fail`、smoke `blocked`）；收尾异常用 `tryWriteDelivery` 尽力写、**不覆盖原始失败、不伪造 pass**。
  pack/config 生成失败不强行造报告（没有 QA 报告可并）。
- **测试**：`contracts/tests/delivery.test.ts`（+20）与 `pipeline/tests/delivery.test.ts`（新，8 条）—— 覆盖旧报告兼容、
  site 未生成省略、QA 硬失败提前落、收尾异常不覆盖、必需检查缺失 / not-required 绕过、verdict 确定性、site 字段一致性。

**验证**：`pnpm vitest run packages/contracts/tests/delivery.test.ts packages/pipeline/tests/delivery.test.ts` 39/39 绿；
`pnpm test` 全仓 **2029/2029** 绿；`pnpm typecheck` 全绿；`pnpm check:deps` 绿。

**施工注**：CLI / MCP 因 `@game-maker/pipeline` 的新增 import 补了各自 tsconfig 的 `references`（此前缺这条边、靠陈旧
dist 侥幸通过，本票新导出暴露了这个缺口）。`pnpm check:links` 仍有 4 条 `.scratch/` 旧断链（asset-integration-v1 /
text-upstream-v1 / game-maker-v2），与本票无关、未动。

**范围注**：试玩（票 09）与视觉评审（票 10）的检查项**登记了口、落地在后续票** —— 本票把它们的 status 记为
`incomplete`（尚未做），最终结论因此 `incomplete`，**不冒充通过**。阶段C 真实产物验收（§8.4）与跨阶段集成测试仍列在
地图 `Not yet specified`，等 09/10 落地后做。
