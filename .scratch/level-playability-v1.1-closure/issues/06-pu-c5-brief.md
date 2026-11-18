# PU-C5 空中控制证据生产 brief

Type: grilling
Status: resolved
Owner: claude (wayfinder session 2026-11-18)
Blocked by: 02
Map: ../map.md
Class: V1.1-CLOSURE / UNIT-BRIEF

## Question

把已冻结的 PU 条件 5 合同（`I03-PU-Air-Control-Closure`）落成可授权、可复核的证据生产 brief。条件是**只产出证据**：条件 5 在 PASS + 用户签署前恒 `BLOCKED`，`PUBLIC_PU` 不变（Q9=A）。

必须裁定：

1. **执行方式**：`.scratch` 内 Phaser 探针 + 只读源码证据 + 负向测试；不修改 Runtime / `reach.ts` / `scene.ts` / `profile.ts` / `graph.ts`；不新增依赖。
2. **C1–C17 矩阵**：逐项定义输入、期望、证据形式（E1/E2/E3）、PASS / FAIL / INSUFFICIENT_EVIDENCE / NOT_RUN 判定；哪些已由现有证据覆盖，哪些要新产出。
3. **证明义务**：A 垂直包容（用冻结 `jumpVelocity` / `gravity` 算 `maxJumpHeight`）与 B 保守弧线扫掠；C 运行时探针只作支持证据，不得单独证明。
4. **探针与夹具**：探针落点、运行环境、逐帧采样内容、两次重跑一致性、跨环境处理；是否复用 P1 的 `geometry-probe` 夹具或需要新夹具（新夹具需说明为何不违反「不新建产品 fixture」）。
5. **证据 / 复核**：E1/E2/E3 路径、`SHA256SUMS`、fresh 独立复核、用户签署；条件 5 的 gate 行如何记录（仍 BLOCKED，直到签署后由 PU-ADMIT 消费）。
6. **STOP**：用 `midAirHits=0` / conditional 图割 / NB 结果替代条件 5；修改 Runtime；新增依赖；探针不可复现。

产出：PU-C5 unit brief；不实现探针、不跑证据。

## Answer

**Q1–Q8 = 用户裁定（2026-11-18，全部采纳）。** PU-C5 定为**纯证据生产**：只产出条件 5 的 E1 / E2 / E3 与 A/B 证明，不改产品源码、`temporal-gate.ts`、`movementModelClosure` 或 `PUBLIC_PU` gate。

交付：

- [`reports/PU-C5-brief.md`](../reports/PU-C5-brief.md) @ `sha256:696dbfafe5daaf3dea11a700220582d6988afa766236c4f7bfa5557331e435c5`（142 行，冻结；PU-C5 仍 `NOT_AUTHORIZED`）。
- `docs/v7.8/移动-收口.md` §6 已由占位改为 PU-C5 授权面（包 hash `4402561a…`）。

| # | 冻结 |
| --- | --- |
| Q1 | scratch-only：`pu-c5/{scripts,fixtures,evidence,reports}`；只读 import 产品 API；不改产品源码 / 产品测试 / `fixtures/**`；不加依赖 |
| Q2 | required = C1–C15；C16 / C17 为规则项；条件 5 `PASS` = required 全 PASS + A/B + 复核 + 签署 |
| Q3 | 复用 `probe-harness.mjs`；记录 Node / Chrome / demo build SHA；同环境两次重跑零容差；支持环境写死本机 |
| Q4 | 新建 scratch-only audit 夹具；不进 `fixtures/**`；P1 geometry-probe 仅在需要时按 audit 分支 SHA `0b21984` 只读引用 |
| Q5 | A/B 在 scratch 实现；A 只读复用 `maxJumpHeight`；证据 PASS 不改变产品常量 / gate |
| Q6 | 复核报告保留合同路径 `pu-air-control-closure-review.md`；收口侧建 `pu-c5/reports/PU-C5-acceptance.md` 证据索引；Ledger 引用两者 |
| Q7 | 条件 5 逐项四态；gate 行记「证据 PASS，gate 仍 `BLOCKED`」；PU-ADMIT 独立消费 |
| Q8 | STOP 继承合同 5 条 + 6 条（重跑不一致 / 夹具进产品 / 证据当 gate 变化 / 消费未签署证据 / E 外能力 / 需改产品）；回滚 = 丢弃 audit 分支，产品零回滚 |

**未做**：未实现探针、未跑证据、未改产品代码、未动 `PUBLIC_PU`。**下游**：前沿仅剩 `10-i05-temporal-fixtures`；`07-pu-admit-brief` 仍等 `06`（已 resolved）+ `10`。
