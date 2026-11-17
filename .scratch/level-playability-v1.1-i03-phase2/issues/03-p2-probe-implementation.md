# P2 · Probe 实施 brief（含 P3 独立复核门）

Type: grilling
Status: open
Owner: (unclaimed)
Blocked by: 02
Map: ../map.md
Class: I-03-Phase2 / P2

## Question

为 P2 产出一份可交接的执行 brief：如何只消费 P1 冻结的契约 / 夹具 / hash 实现 geometry probe，产出与冻结契约一致的证据，并定义 P3（I03-03C）独立复核与用户签署门？

必须覆盖：probe 脚本与运行命令（真实浏览器 / 现有 demo；不新增 npm 依赖）；逐帧 / 逐 body 的 `expected / actual / delta / pass`；14 正例行 + 11 负例；`all-checked` 不是 `coverage.geometry=checked`；P3 fresh reviewer 的输入 hash、14+11 逐项 `PASS/FAIL/NOT_RUN`、独立重跑、限制与签署；`reports/P3-probe-review.md` 固定路径；P3 PASS 只允许 P6 消费，不开放能力；hash 不一致 ⇒ STOP；回滚。

约束：见 `reports/00-execution-protocol.md` §5 与 annex §5；P2 不得修改 P1 契约 / 夹具语义 / hash；产品 `packages/**` 零改动。
