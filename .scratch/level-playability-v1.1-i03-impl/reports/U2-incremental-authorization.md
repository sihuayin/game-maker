# U2 增量实施授权记录

| 项 | 值 |
| --- | --- |
| 记录类型 | 增量实施授权；**独立记录**；不修改已签署授权包正文 |
| 签署人 | **amber** |
| 日期 | **2026-11-16** |
| 指令 | 用户在 U1 签署问题中选择「**签署 U1，继续 U2**」；并沿用整体指令「之后依次 U2 → U4 → U5 → U3」 |
| 授权依据 | U1 已签署 / 合并 / Ledger 更新（U1 PR #52 merge `f059afe…`；Ledger PR #53 merge `be1b72a…`）；已签署授权包（签署前 `2f89d572…` / 签署后 `f45332be…`）；独立审查报告 `40af4b4b…`；U2 brief `issues/03-i03-impl-u2.md`；`main` @ `be1b72a` |
| 授权范围 | **仅 U2**（contracts 能力门 + 公共 Verdict 映射 + 指定测试） |
| 执行 effort | `.scratch/level-playability-v1.1-i03-impl/`；分支 `wayfinder/level-playability-v1.1-i03-u2`，从更新后的 `main` |
| 结论 | U2 **AUTHORIZED**（限实施 + 独立复核 + 用户签署）；U4 / U5 / U3、`PUBLIC_NB` / `PUBLIC_PU`、能力开放仍 **NOT_AUTHORIZED** |

> 本记录只授权 U2。U4 / U5 / U3 各需独立增量授权记录。

## 1. 授权范围

| # | 授权项 | 状态 | 边界 |
| --- | --- | --- | --- |
| A1 | U2 实施（能力门 + 公共 Verdict 映射） | **AUTHORIZED** | 仅授权包 §11.2 U2 三行 |
| A2 | U2 独立复核 | **AUTHORIZED** | fresh reviewer；报告 `reports/U2-review.md` |
| A3 | U2 定向测试 | **AUTHORIZED** | 仅白名单测试 |

## 2. 允许文件（授权包 §11.2 U2，逐文件）

| 文件 | 操作 |
| --- | --- |
| `packages/contracts/src/playability/public-verdict.ts` | 新增：能力门 + 公共 Verdict 映射 + 第一阶段常量 + 冲突异常 |
| `packages/contracts/src/playability/api.ts` | 修改：U2 相关 `@internal` 导出；仅限 U2 职责 |
| `packages/contracts/tests/playability-public-verdict.test.ts` | 新增：U2 映射 / 优先级 / 冲突 / 合并测试 |

只读 import：`verdict.ts` 叶子类型；**不 import `api.ts`**。

## 3. 明确不放行

- U4 / U5 / U3 实施；`ops.ts`；`publish-gate.ts`；`mechanic.ts`；U1 白名单外改动。
- 公共 `publicCapability` 字段；`PUBLIC_NB` / `PUBLIC_PU` 开放；准入链实现。
- 白名单外任何产品文件、新依赖、`package.json` / lockfile / tsconfig 变化。
- `.scratch` 证据未经归档决定进入产品 PR；推送 / 合并除本单元 PR 流程外。

## 4. 证据 / 复核 / 回滚

- 证据：`evidence/U2/`；复核输入 `reports/U2-review-input.md`；复核报告 `reports/U2-review.md`。
- fresh 独立 reviewer；逐项 `PASS / FAIL / NOT_RUN`；至少 2 条自选关键断言。
- 回滚目标：U2 分支切出时的 `main` SHA（`be1b72a`）+ 精确命令；U2 只文档化回滚，不做演练。
- 证据为独立 evidence-only commit；不预授权 `.scratch` 进入产品 PR。

## 5. 生效与失效

- 生效：本记录合入 `main` 之时。
- 失效：U2 用户签署完成后耗尽；U2 `FAIL` 或 STOP 时退回。
- 本记录不产生 U4 / U5 / U3 的任何隐含授权。
