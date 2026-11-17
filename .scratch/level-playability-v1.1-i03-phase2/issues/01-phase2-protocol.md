# Phase-2 执行协议、UNSIGNED annex 与 Ledger 模型

Type: grilling
Status: resolved
Owner: claude (charting 2026-11-17)
Blocked by: —
Map: ../map.md
Class: I-03-Phase2 / P0

## Question

如何冻结 Phase-2 的执行协议、UNSIGNED annex、逐单元授权模型、5 行 Ledger 与 P7 独立验收授权，使 P1–P6 可以在不修改 I-03 正文的前提下逐单元实施？

## Answer

**Q1–Q36 = 用户裁定（2026-11-17）。** P0 交付：

- [`reports/00-execution-protocol.md`](../reports/00-execution-protocol.md)：单元拓扑、授权 / 复核 / 签署 / 合并 / Ledger / 回滚 / STOP 协议。
- [`docs/v7.8/移动-I03-phase2.md`](../../../docs/v7.8/移动-I03-phase2.md)：**UNSIGNED** annex 草案；签署后 hash 成为 Phase-2 授权基线。
- Annex §12.2：5 行 Ledger（P1、P2、P4、P5、P6）；P3 复核记录嵌套在 P2 行。

关键边界：

- annex 签署不等于 P1–P6 授权；每个单元仍需独立增量授权记录。
- P7 由用户另行授权 fresh 验收会话，annex 不自动授权验收。
- 本图不写产品代码、不运行 probe、不开放 `PUBLIC_NB` / `PUBLIC_PU`。

## Comments

- 2026-11-17 charting：地图与 7 张票建立；P0 关闭，frontier 从 P1 开始，但 P1 在 annex 签署 + P1 授权前保持 BLOCKED。
