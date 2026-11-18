# Out of scope 与不变量

Type: grilling
Status: open
Owner: —
Blocked by: —
Map: ../map.md
Class: V1.1-CLOSURE / DECISION

## Question

把 Q14 的排除项落成可执行的边界，防止它们在 I-04 / I-05 / PU-C5 / PU-ADMIT 的 brief 中悄悄回潮。

必须裁定：

1. 逐项确认并分类：`PUBLIC_NB` / `PUBLIC_PU` gate 状态变化（ADMITTED / OPEN）、P2–P7 执行、新算法 / Runtime / CLI / MCP / 产品代码、新 fixture、多移动 Hazard / moving platform / y 轴 / Danger strike、修改已签署文档、LP-06/07 转 vitest、付费上游、单元实际执行。
2. 每项写明「为什么出图」与「未来归属」（独立公开能力 effort / Phase-2 / fixture 授权票 / 测试基建票 / 不计划）。
3. 给出总授权包中的 Out-of-scope 小节文本与 STOP 规则：任一单元 brief 需要跨过这些边界 ⇒ STOP + HITL。
4. 明确「允许的只读 import / 只读使用」不等于修改：例如 I-04 可读 `packages/**` 测试，但不得改产品文件。

产出：Out-of-scope 与不变量章节，可直接并入 `docs/v7.8/移动-收口.md`。
