# 02. design→config 修复方案裁定

Type: grilling
Status: resolved
Blocked by: 01
Map: ../map.md

## Question

给定票 01 定位的 design→config（compile-runtime）缺口，裁定修复方案。至少覆盖：

1. **修在哪一层**：提示词层（改 compile-runtime 提示词让 LLM 正确落槽）· 确定性后处理（加校验/修复 pass）·
   契约层（改 design→config 可表达的范围）—— 或组合。
2. **口径**：最小增量（只修暴露的失败形态）vs 原则性修复（让 compile-runtime 的落槽 / HUD 绑定稳健正确）。
3. **验证**：修复如何被免费离线验证（在票 04 免费验收前）。

HITL：用户逐字裁定，不替用户答。

## Answer（划出范围 · 2026-10-25）

票 01 研究确认：design→config 5 条硬失败**已被 `recipe-config-gap-v1` 修复**（solid→sprite kind 锁 + `hudUiGate` +
业务校验重采样），本图无缺口可修。本票作废，不进入 Decisions so far，见 map `## Out of scope`。
