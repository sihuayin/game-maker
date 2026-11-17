# P5 · Global gate close brief

Type: grilling
Status: open
Owner: (unclaimed)
Blocked by: 04
Map: ../map.md
Class: I-03-Phase2 / P5

## Question

为 P5 产出一份可交接的执行 brief：如何实现 capability gate 状态、假 NB / 假 PU 的全局关闭、证据基线失效与关闭优先，且保持 `PublicVerdictResult` 形状不变？

必须覆盖：`packages/contracts/src/playability/capability-gate.ts`；测试与矩阵；`public-verdict.ts` 仅最小接线；`api.ts` 仅导出；gate `BLOCKED` 时 admission 成功不得放行；关闭优先于缓存 / 历史 / 逐关；NB / PU 两 gate 独立负路径；若需改 `PublicVerdictResult` ⇒ STOP；回滚。

约束：见 `reports/00-execution-protocol.md` §7 与 annex §7；P5 不依赖 P3 / P6。
