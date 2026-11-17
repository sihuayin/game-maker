# P4 · NB admission machinery brief

Type: grilling
Status: open
Owner: (unclaimed)
Blocked by: 02
Map: ../map.md
Class: I-03-Phase2 / P4

## Question

为 P4 产出一份可交接的执行 brief：如何实现 NB 十项准入规则、固定 synthetic 夹具、正负路径与 `ADMITTED` 判定，使 gate `BLOCKED` 时任何输入都不得 `ADMITTED`，并在 P3 签署后接入 checked 几何正例？

必须覆盖：`packages/contracts/src/playability/admission.ts`；`playability-admission.test.ts`；`playability-admission-matrix.json`；`api.ts` 仅导出；不修改 `public-verdict.ts` / `verdict.ts` / `capability-gate.ts`；gate `BLOCKED` 负路径；synthetic 正例必须真实满足准入合同；P3 前不得把 AC-10 标 PASS；回滚。

约束：见 `reports/00-execution-protocol.md` §6 与 annex §6；公共 `PlayabilityVerdict` 形状不变。
