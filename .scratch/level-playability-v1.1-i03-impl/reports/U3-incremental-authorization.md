# U3 增量实施授权记录

| 项 | 值 |
| --- | --- |
| 记录类型 | 增量实施授权；**独立记录**；不修改已签署授权包正文 |
| 签署人 | **amber** |
| 日期 | **2026-11-16** |
| 指令 | 用户在 U5 签署后指令「**继续 U5 合并与 Ledger，再开 U3**」；沿用整体指令「之后依次 U2 → U4 → U5 → U3」 |
| 授权依据 | U1–U5 均已签署 / 合并 / Ledger 更新（U1 PR #52 `f059afe…`、Ledger #53 `be1b72a…`；U2 PR #55 `c3522b6…`、Ledger #56 `b5b42d0…`；U4 PR #58 `7cdcabe…`、Ledger #59 `123a1c0…`；U5 PR #61 `a12df97…`、Ledger #62 `819bf1e…`）；已签署授权包（签署前 `2f89d572…` / 签署后 `f45332be…`；U1–U5 Ledger 后当前 `8a8349b1f26f20d08a6c7573875ed5d0a070d240158c183f1b75721b6ecaf917`）；独立审查报告 `40af4b4b…`；U3 brief `issues/06-i03-impl-u3.md`；`main` @ `819bf1e` |
| 授权范围 | **仅 U3**（contracts `mechanic.ts` gap 替换） |
| 执行 effort | `.scratch/level-playability-v1.1-i03-impl/`；分支 `wayfinder/level-playability-v1.1-i03-u3`，从更新后的 `main` |
| 结论 | U3 **AUTHORIZED**（限实施 + 独立复核 + 用户签署）；`PUBLIC_NB` / `PUBLIC_PU`、能力开放、probe / fixture 实施仍 **NOT_AUTHORIZED** |

> 本记录只授权 U3。U1 / U2 / U4 / U5 已完成；本记录不追溯修改其 Ledger。

## 1. 授权范围

| # | 授权项 | 状态 | 边界 |
| --- | --- | --- | --- |
| A1 | U3 实施（移除 `moving-hazard-phase` gap；temporal 层接管） | **AUTHORIZED** | 仅授权包 §11.2 U3 三行 |
| A2 | U3 独立复核 | **AUTHORIZED** | fresh reviewer；报告 `reports/U3-review.md` |
| A3 | U3 temporal takeover + 其他 mechanic 语义回归测试 | **AUTHORIZED** | 仅白名单测试与 `wide-patrol` fixture 行 |
| A4 | U3 回滚演练 | **AUTHORIZED** | 隔离 drill branch / worktree |

## 2. 允许文件（授权包 §11.2 U3，逐文件）

| 文件 | 操作 |
| --- | --- |
| `packages/contracts/src/playability/mechanic.ts` | 修改：删除 `movingHazards` 与 `moving-hazard-phase` gap；更新注释；其余 mechanic 语义不变 |
| `packages/contracts/tests/playability-mechanic.test.ts` | 修改：旧断言按新语义改写；temporal takeover；moving-platform / 其他语义回归 |
| `packages/contracts/tests/fixtures/playability-mechanic-matrix.json` | 修改：**仅 `wide-patrol` 行** |

- 只读 import：U1 类型 / U2 `mapPublicVerdict` / `PHASE1_CAPABILITY_*` / `auditPlayability`。
- **不修改** `api.ts` / U1 / U2 / U4 / U5 产品文件 / 其他 fixture 行 / CLI / MCP / Runtime / probe / `package.json` / lockfile / tsconfig。

## 3. 明确不放行

- 公共能力开放；`PUBLIC_NB` / `PUBLIC_PU`；gate 变更；probe / PU 条件 2/5。
- 把 `wide-patrol` 的层内 `NO_PROVEN_BLOCKER` 当作公共放行；公共 NB / PU 产出。
- 新增 gap / 新判据 / 白名单外任何产品文件 / 新依赖。
- `.scratch` 证据未经归档决定进入产品 PR。

## 4. 证据 / 复核 / 回滚

- 证据：`evidence/U3/`；复核输入 `reports/U3-review-input.md`；复核报告 `reports/U3-review.md`。
- fresh 独立 reviewer；逐项 `PASS / FAIL / NOT_RUN`；至少 2 条自选关键断言。
- **U3 必须实际执行回滚演练**：隔离 worktree / drill branch，revert U3 commit，跑 `playability-mechanic.test.ts` + 全量 `pnpm test`，保留日志 / 退出码 / hash。
- 回滚目标：U3 分支切出时的 `main` SHA（`819bf1e`）。
- 证据为独立 evidence-only commit；不预授权 `.scratch` 进入产品 PR。

## 5. 生效与失效

- 生效：本记录合入 `main` 之时。
- 失效：U3 用户签署完成后耗尽；U3 `FAIL` 或 STOP 时退回。
- 本记录不产生任何能力开放或验收授权。
