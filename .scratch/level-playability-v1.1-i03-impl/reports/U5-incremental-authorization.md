# U5 增量实施授权记录

| 项 | 值 |
| --- | --- |
| 记录类型 | 增量实施授权；**独立记录**；不修改已签署授权包正文 |
| 签署人 | **amber** |
| 日期 | **2026-11-16** |
| 指令 | 用户在 amended U4 签署问题中选择「**签署 amended U4，继续 U5**」；并沿用整体指令「之后依次 U2 → U4 → U5 → U3」 |
| 授权依据 | U1 / U2 / U4 已签署 / 合并 / Ledger 更新（U1 PR #52 `f059afe…`、Ledger #53 `be1b72a…`；U2 PR #55 `c3522b6…`、Ledger #56 `b5b42d0…`；U4 PR #58 `7cdcabe…`、Ledger #59 `123a1c0…`）；已签署授权包（签署前 `2f89d572…` / 签署后 `f45332be…`；U1/U2/U4 Ledger 后当前 `5e3fa97f…`）；独立审查报告 `40af4b4b…`；U5 brief `issues/05-i03-impl-u5.md`；`main` @ `123a1c0` |
| 授权范围 | **仅 U5**（pipeline `publish-gate` 诊断字段） |
| 执行 effort | `.scratch/level-playability-v1.1-i03-impl/`；分支 `wayfinder/level-playability-v1.1-i03-u5`，从更新后的 `main` |
| 结论 | U5 **AUTHORIZED**（限实施 + 独立复核 + 用户签署）；U3、`PUBLIC_NB` / `PUBLIC_PU`、能力开放仍 **NOT_AUTHORIZED** |

> 本记录只授权 U5。U3 需独立增量授权记录。

## 1. 授权范围

| # | 授权项 | 状态 | 边界 |
| --- | --- | --- | --- |
| A1 | U5 实施（发布闸时序诊断字段） | **AUTHORIZED** | 仅授权包 §11.2 U5 两行 |
| A2 | U5 独立复核 | **AUTHORIZED** | fresh reviewer；报告 `reports/U5-review.md` |
| A3 | U5 G1–G11 + 变异测试 | **AUTHORIZED** | 仅白名单测试 |

## 2. 允许文件（授权包 §11.2 U5，逐文件）

| 文件 | 操作 |
| --- | --- |
| `packages/pipeline/src/publish-gate.ts` | 修改：诊断字段消费 |
| `packages/pipeline/tests/publish-gate.test.ts` | 修改：G1–G11 + 变异测试 |

- 只读 import：`runTemporalAudit` / `TemporalAuditReport`（assets）；contracts 的 `TemporalCoverageState` / `PlayabilityVerdictState` / `PlayabilityEvidence`。
- **不修改** `create-game.ts` / `create-game.test.ts` / `ops.ts` / contracts / CLI / MCP / scripts / docs / fixtures。

## 3. 明确不放行

- U3 实施；公共能力开放；`PUBLIC_NB` / `PUBLIC_PU`；gate 变更；probe / PU 条件 2/5。
- 白名单外任何产品文件、新依赖、`package.json` / lockfile / tsconfig 变化。
- `.scratch` 证据未经归档决定进入产品 PR。

## 4. 证据 / 复核 / 回滚

- 证据：`evidence/U5/`；复核输入 `reports/U5-review-input.md`；复核报告 `reports/U5-review.md`。
- fresh 独立 reviewer；逐项 `PASS / FAIL / NOT_RUN`；至少 2 条自选关键断言。
- **U5 必须实际执行回滚演练**：隔离 worktree / drill branch，revert U5 commit，跑 `publish-gate.test.ts` + 全量 `pnpm test`，保留日志 / 退出码 / hash。
- 回滚目标：U5 分支切出时的 `main` SHA（`123a1c0`）。
- 证据为独立 evidence-only commit；不预授权 `.scratch` 进入产品 PR。

## 5. 生效与失效

- 生效：本记录合入 `main` 之时。
- 失效：U5 用户签署完成后耗尽；U5 `FAIL` 或 STOP 时退回。
- 本记录不产生 U3 的任何隐含授权。
