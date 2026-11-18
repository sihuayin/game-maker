# 五 Wave 依赖与并行边界

Type: grilling
Status: open
Owner: —
Blocked by: 04, 05, 06, 07
Map: ../map.md
Class: V1.1-CLOSURE / DECISION

## Question

在 P1 已闭合的前提下，冻结 V1.1 剩余收口的依赖图与并行边界（Q11=A）。

必须裁定：

1. **Wave 结构**：Wave 1 `P2 ∥ P4 ∥ PU-C5`；Wave 2 `P5`（P4 后）∥ `P6`（P3 后）；`PU-ADMIT` 在 P6 + PU-C5 后（可与 P7 并行）；Wave 3 `P7`；Wave 4 `I-04`；Wave 5 `I-05` + 最终报告。
2. **启动条件**：每个 Wave 的前置签署 / 合并 / Ledger / 证据；哪些可以真正并行，哪些只是时间上重叠但必须独立授权。
3. **证据交接**：每个 Wave 向下游交付什么（P3 证据 → P6 → PU-ADMIT；P7 报告 → I-04；I-04 + PU-ADMIT → I-05）。
4. **禁越界**：I-04 不得在 P7 冻结基线前开跑；I-05 不得在 I-04 / PU-ADMIT 签署前开跑；PU-ADMIT 不得消费未签署的 P3/PU-C5 证据。
5. **失败/停止**：任一 Wave FAIL 或 STOP 时，下游如何处理；哪些已完成的证据仍可复用；是否回滚。
6. **关键路径与估算**：标注关键路径与每单元会话估算（沿用 I-00 的 3–4 / 2–3，补 PU-C5 / PU-ADMIT 估算）。

产出：Wave 依赖表 + 证据交接表；不执行任何 Wave。
