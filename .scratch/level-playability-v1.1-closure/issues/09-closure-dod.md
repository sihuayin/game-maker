# V1.1 Closure DoD 追溯矩阵

Type: grilling
Status: open
Owner: —
Blocked by: 01, 04, 05, 06, 07, 11
Map: ../map.md
Class: V1.1-CLOSURE / DECISION

## Question

把 PRD 的 Definition of Done 与七项硬门槛映射到 4 个单元、证据与验收，冻结 V1.1 closure 的判定方式与最终能力声明边界。

必须裁定：

1. **DoD 逐项映射**：PRD §12 的 10 个 checkbox（I-00～I-05、七项硬门槛、A/B/C、补充正向/负向/边界、V1 回归、模型外降级、证据可解释/复现/审计、Pipeline 真实流程、修改范围与授权一致、最终报告）→ 单元 / 证据 / 验收。
2. **七项硬门槛**：G-01～G-07 逐项映射到 I-01～I-05 的哪些证据；哪些由 P7 覆盖、哪些由 I-04/I-05/PU-ADMIT 补。
3. **状态定义**：closure `PASS / FAIL / INCOMPLETE` 的判定；逐项不得用通过率；required / supporting 的区分。
4. **能力声明**：最终声明必须限定为单 X 轴 moving hazard 的受限时序分析；不得宣称通用动态障碍物；`PUBLIC_NB` / `PUBLIC_PU` 仍 `BLOCKED` 如何写进声明。
5. **最终报告**：Closure DoD 矩阵在 `.scratch/level-playability-v1.1-closure/reports/V1.1-closure.md` 中的位置与签名；与 I-05 报告的关系。
6. **残余风险**：LP-06/07 非 vitest、PU 资格未开放、公共 gate BLOCKED、模型外边界等如何披露。

产出：Closure DoD 追溯矩阵 + 状态规则；不判定任何证据为 PASS。
