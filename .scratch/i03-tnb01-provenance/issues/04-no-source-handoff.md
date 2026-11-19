# 无合格来源时的阻塞与治理移交

Type: grilling
Labels: wayfinder:grilling
Status: resolved
Owner: codex (2026-11-19)
Blocked by: 01, 02
Map: ../map.md

## Question

若在明确的搜索范围内找不到满足准入条件的既有交付，如何记录覆盖范围、阻塞和最小可审阅的后续选项，并准确指向现有 FIX 独立治理而不自动授权新建 fixture？

## Resolution

用户于 2026-11-19 确认：

1. 报告实际查过的来源、时间、排除原因与未覆盖区域，结论仅表述“在本次范围内未找到合格来源”；T-NB-01 保持 BLOCKED，不宣称所有真实场景均不可行。
2. 同时提出两条可审阅路径：继续追溯尚未覆盖的真实交付；或按现有 FIX 独立治理申请新建真实 fixture。列明各自前置和缺口，不自动选择或授权任何路径。
3. 阻塞不改变真实可信输入、两档各自完整 witness 与重复执行可复现的验收要求；不以合成 fixture、静态 NB 或降低断言替代。Phase-2 几何 P2 与公共 gate 边界不变。
