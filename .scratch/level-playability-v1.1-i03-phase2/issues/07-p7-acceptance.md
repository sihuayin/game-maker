# P7 · Phase-2 全量验收计划

Type: grilling
Status: open
Owner: (unclaimed)
Blocked by: 03, 04, 05, 06
Map: ../map.md
Class: I-03-Phase2 / P7

## Question

为 P7 产出一份可交接的验收计划：如何在 P2–P6 全部签署 / 合并 / Ledger 后，由 fresh 独立验收会话重跑 AC-01–AC-21，映射 AC-10→P4、AC-12→P5、AC-14→P6、AC-15→P2+P3，保留 phase-1 报告不可变，并判定 PASS / FAIL / INCOMPLETE 与退出码？

必须覆盖：独立验收前置（P7 用户单独授权）；固定报告 `.scratch/level-playability-v1.1-i03-phase2/reports/phase2-acceptance.md`；phase-1 报告不可变；AC-01–AC-21 逐项 required / E1–E3 / 证据 / 状态；AC-15 在 P3 完整时 PASS，否则 NOT_RUN，始终非 required；AC-11 NOT_RUN；G1–G11 / N1–N18 / T-55–T-65 / LP-06/07 / 跨进程确定性 / L1–L8；`PUBLIC_NB` / `PUBLIC_PU` 仍 BLOCKED；整体状态与退出码语义。

约束：见 `reports/00-execution-protocol.md` §9 与 annex §9；P7 不自行修补证据、不替用户签署。
