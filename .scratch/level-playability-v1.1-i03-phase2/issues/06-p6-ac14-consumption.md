# P6 · AC-14 几何证据消费 brief

Type: grilling
Status: open
Owner: (unclaimed)
Blocked by: 03
Map: ../map.md
Class: I-03-Phase2 / P6

## Question

为 P6 产出一份可交接的执行 brief：如何在 P3 复核并签署后，以显式 `GeometryEvidenceInput` 接入 temporal evidence，保守合并 `coverage.geometry`，并保持 `PublicVerdictResult` 顶层形状不变？

必须覆盖：新 `playability/geometry-evidence.ts`；`temporal-evidence.ts` 扩展；`verdict.ts` 仅 geometry 类型加法式放宽（`runtimeBody: "unverified"|"verified"`、`coverage: "checked"|"partial"|"unknown"`、`limits.geometryCoverage` 同步）；`api.ts` 仅导出；`ops.ts` 仅显式可选参数接线（不自动读 scratch、不硬编码签署）；synthetic 测试无文件 I/O；合并语义（任一 unknown ⇒ unknown；否则任一 partial ⇒ partial；全 checked ⇒ checked；partial/unknown 不得提升；checked 必须带完整 review；`applicable:false` 不生成 geometry）；若需改 `public-verdict.ts` 或扩大白名单 ⇒ STOP；回滚。

约束：见 `reports/00-execution-protocol.md` §8 与 annex §8；P6 只能消费 P3 已签署证据，不自行验证签署真实性。
