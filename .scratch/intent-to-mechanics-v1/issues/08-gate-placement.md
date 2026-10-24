# 08. Pipeline Gate 接入点：覆盖门禁放哪

Type: grilling
Status: resolved
Owner: main session · 2026-10-23
Blocked by: 07
Map: ../map.md

## Question

机制覆盖门禁（文档 FR-08）接在流水线哪里，满足「尽可能早失败」：设计阶段早失败（R12 已做）？`assertQaPassed`
之后？还是 `publish-gate` 的 `verdictProblem`（让 `site` 也被拦）？

## 现状（E1）

- 无正式 gate 抽象，检查内联；唯一命名门禁 `publish-gate.ts:145 assertPublishableQa`（`verdictProblem :127-137`
  =「无 error 且 6/6」）。QA 块 `create-game.ts:560-622`，`assertQaPassed :621`。
- R12 在设计阶段 `compileDesign` 已抛 `DesignRejectedError`（`compile-design.ts:288-298`）——即「最早失败」已存在，
  扩 registry 后自动受益（[票 01](01-mechanic-registry-status.md)）。

## 建议

**早失败 = 设计阶段 R12（已存在，靠 registry 扩展覆盖到新机制）**；覆盖报告门禁**接在 `assertQaPassed` 之后 +
`publish-gate`**（保证 `site` 也被拦），消费 [票 07](07-coverage-report.md) 的 per-mechanic 报告，任一必需机制
`missing/unsupported/failed` 即门禁失败。承载实现：门禁接线 + 失败报告。

## Answer

**裁定（2026-10-23）** —— 门禁接在 `create-game.ts` 的 `assertQaPassed` **之后**：

- **早失败** = 设计阶段 R12（已存在，`mechanic-experimental` 覆盖到新机制）—— 不重复。
- **门禁**（`create-game.ts` QA 块末尾）：`buildMechanicCoverage(designParsed.data)` → `mechanicCoverageProblem`
  非空 ⇒ `throw CommandError("invalid", problem)`。六判据先放行、再查「机制端到端齐不齐」。
- **`publish-gate`**：`assertPublishableQa` 吃 QA 报告（6/6）；机制覆盖门禁的失败在 QA 阶段就 `invalid` 抛出，
  `site` 自然也到不了（构建没完成）。无需在 `verdictProblem` 再开一条 —— 门禁已经硬拦在构建里。

`mechanicCoverageProblem` 逐格点名（`设计层 unsupported` / `运行时层 unsupported` / `QA 层 failed`），
`not-tested` 不阻断（票 07 的裁定）。

