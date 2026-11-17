# P1 · Probe 契约冻结与夹具物化 brief

Type: grilling
Status: open
Owner: (unclaimed)
Blocked by: 01
Map: ../map.md
Class: I-03-Phase2 / P1

## Question

为 P1 产出一份可交接的执行 brief：如何在 audit 分支 `.scratch/level-playability-v1.1-i03-phase2/geometry-probe/` 物化 I03-03A/B2/B2a 已冻结的 probe 契约与夹具，录入 F2 修正后的 **11 个负例**（10 `geometry-mismatch` 含 `body-bounds-mismatch` + 1 `missing-evidence`）、固定 manifest / 文件 hash，并定义 P2 可消费的输入与 STOP 条件？

必须覆盖：`geometry-probe/{contract,fixtures,scripts,evidence/p1}` 结构；F2 manifest hash `dd880628176f617819752d0d866c6adc923238e706444f20bbe0807e1e87943b`；14 正例行（hazard 2 / player 8 帧 + body 1 / graph 3）；原始 fixture 只读与受控副本关系；audit 分支 `wayfinder/i03-phase2-probe-evidence` 的提交与 hash 记录；P1 独立复核与用户签署；回滚；**本 brief 不写实现**。

约束：见 `reports/00-execution-protocol.md` §4 与 annex §4；产品 `packages/**` / `fixtures/**` 零改动。
