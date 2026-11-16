# U4 增量实施授权记录

| 项 | 值 |
| --- | --- |
| 记录类型 | 增量实施授权；**独立记录**；不修改已签署授权包正文 |
| 签署人 | **amber** |
| 日期 | **2026-11-16** |
| 指令 | 用户在 U2 签署问题中选择「**签署 U2，继续 U4**」；并沿用整体指令「之后依次 U2 → U4 → U5 → U3」 |
| 授权依据 | U1 / U2 已签署 / 合并 / Ledger 更新（U1 PR #52 `f059afe…`、Ledger #53 `be1b72a…`；U2 PR #55 `c3522b6…`、Ledger #56 `b5b42d0…`）；已签署授权包（签署前 `2f89d572…` / 签署后 `f45332be…`；U1/U2 Ledger 行政更新后当前 `32152c01…`）；独立审查报告 `40af4b4b…`；U4 brief `issues/04-i03-impl-u4.md`；`main` @ `b5b42d0` |
| 授权范围 | **仅 U4**（assets `runTemporalAudit` 接真实分析并产出证据） |
| 执行 effort | `.scratch/level-playability-v1.1-i03-impl/`；分支 `wayfinder/level-playability-v1.1-i03-u4`，从更新后的 `main` |
| 结论 | U4 **AUTHORIZED**（限实施 + 独立复核 + 用户签署）；U5 / U3、`PUBLIC_NB` / `PUBLIC_PU`、能力开放仍 **NOT_AUTHORIZED** |

> 本记录只授权 U4。U5 / U3 各需独立增量授权记录。

## 1. 授权范围

| # | 授权项 | 状态 | 边界 |
| --- | --- | --- | --- |
| A1 | U4 实施（真实分析接入 + 公共 evidence / verdict） | **AUTHORIZED** | 仅授权包 §11.2 U4 三行 |
| A2 | U4 独立复核 | **AUTHORIZED** | fresh reviewer；报告 `reports/U4-review.md` |
| A3 | U4 定向 / 集成测试 | **AUTHORIZED** | 仅白名单测试 |

## 2. 允许文件（授权包 §11.2 U4，逐文件）

| 文件 | 操作 |
| --- | --- |
| `packages/assets/src/ops.ts` | 修改：`runTemporalAudit` 接真实分析并产出证据 / 公共 verdict |
| `packages/assets/tests/ops.test.ts` | 修改：U4 覆盖 / 集成 smoke / 失败路径 / 兼容性 |
| `packages/contracts/tests/playability-temporal-input.test.ts` | 修改：**仅 T-58** |

只读 import：U1 adapter / U2 mapper / 第一阶段常量 / `analyzeTemporalInternalTwoLag`；`temporal.ts` / `temporal-result.ts` 不修改。

## 3. 明确不放行

- U5 / U3 实施；`publish-gate.ts`；`mechanic.ts`；U1 / U2 文件修改（除 T-58）。
- 公共能力开放；`PUBLIC_NB` / `PUBLIC_PU`；gate 变更；probe / PU 条件 2/5。
- 白名单外任何产品文件、新依赖、`package.json` / lockfile / tsconfig 变化。
- `.scratch` 证据未经归档决定进入产品 PR。

## 4. 证据 / 复核 / 回滚

- 证据：`evidence/U4/`；复核输入 `reports/U4-review-input.md`；复核报告 `reports/U4-review.md`。
- fresh 独立 reviewer；逐项 `PASS / FAIL / NOT_RUN`；至少 2 条自选关键断言。
- **U4 必须实际执行回滚演练**：隔离 worktree / drill branch，revert U4 commit，跑 `ops.test.ts` + `playability-temporal-input.test.ts` + 全量 `pnpm test`，保留日志 / 退出码 / hash。
- 回滚目标：U4 分支切出时的 `main` SHA（`b5b42d0`）。
- 证据为独立 evidence-only commit；不预授权 `.scratch` 进入产品 PR。

## 5. 生效与失效

- 生效：本记录合入 `main` 之时。
- 失效：U4 用户签署完成后耗尽；U4 `FAIL` 或 STOP 时退回。
- 本记录不产生 U5 / U3 的任何隐含授权。
