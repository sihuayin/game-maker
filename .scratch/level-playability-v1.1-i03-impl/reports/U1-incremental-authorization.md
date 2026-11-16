# U1 增量实施授权记录

| 项 | 值 |
| --- | --- |
| 记录类型 | 增量实施授权；**独立记录**；不修改已签署授权包正文 |
| 签署人 | **amber** |
| 日期 | **2026-11-16** |
| 指令原文 | 「另开 I-03 实施 effort：从 main（ac6ce56）创建 U1 执行分支，按 I03-IMPL-02 U1 brief 实施；之后依次 U2 → U4 → U5 → U3，最后由独立验收会话按 I03-IMPL-07 运行最终验收。」 |
| 授权依据 | 已签署授权包（签署前 `sha256:2f89d572008b538be5871fef11d9f539e16829d1f4ceafe6e25a8a250fb9a52e` / 签署后 `sha256:f45332bedd87209353a6f3e482408484151deed788c42996e36436437e1120cb`）；独立审查报告 `sha256:40af4b4b243abf1fbaac5a794cf1a8ccaf32b65e3c7ed29278e1d21502feed09`；F2 修正证据 `sha256:17ea5f9137b9dbf3dbf7ab715fc26e598c0ee419ff94794a9b974584086a8c2a`；U1 brief `issues/02-i03-impl-u1.md`；`main` @ `ac6ce56` |
| 授权范围 | **仅 U1**（contracts 公共 temporal 类型 + 纯适配器 + 指定测试） |
| 执行 effort | `.scratch/level-playability-v1.1-i03-impl/`；分支 `wayfinder/level-playability-v1.1-i03-u1`，从更新后的 `main` |
| 结论 | U1 **AUTHORIZED**（限实施 + 独立复核 + 用户签署）；U2 / U4 / U5 / U3、`PUBLIC_NB` / `PUBLIC_PU`、能力开放仍 **NOT_AUTHORIZED** |

> 用户指令给出整体实施路线；本记录只授权 **U1**。U2 / U4 / U5 / U3 各需独立增量授权记录。

## 1. 授权范围

| # | 授权项 | 状态 | 边界 |
| --- | --- | --- | --- |
| A1 | U1 实施（公共 temporal 类型 + 纯适配器） | **AUTHORIZED** | 仅授权包 §11.2 U1 五行文件 |
| A2 | U1 独立复核 | **AUTHORIZED** | fresh reviewer；报告 `reports/U1-review.md` |
| A3 | U1 定向测试 + API 回归 | **AUTHORIZED** | 仅白名单测试 |

## 2. 允许文件（授权包 §11.2 U1，逐文件）

| 文件 | 操作 |
| --- | --- |
| `packages/contracts/src/playability/verdict.ts` | 修改：公共 temporal 类型 + coverage / witness / evidence 加法字段 |
| `packages/contracts/src/playability/temporal-evidence.ts` | 新增：纯适配器 |
| `packages/contracts/src/playability/api.ts` | 修改：U1 导出 |
| `packages/contracts/tests/playability-api.test.ts` | 修改：U1 API / 非时序回归 |
| `packages/contracts/tests/playability-temporal-evidence.test.ts` | 新增：适配器矩阵 |

只读 import：`temporal.ts` / `temporal-result.ts` / `geometry.ts`；**不修改 `temporal.ts`**。

## 3. 明确不放行

- U2 / U4 / U5 / U3 实施；`api.ts` 的 U2 职责；`ops.ts`；`publish-gate.ts`；`mechanic.ts`。
- 公共 Verdict 映射；`PUBLIC_NB` / `PUBLIC_PU` 开放；gate 变更；probe / PU 条件 2/5 证明。
- 白名单外任何产品文件、新依赖、`package.json` / lockfile / tsconfig 变化。
- `.scratch` 证据未经归档决定进入产品 PR；推送 / 合并除本单元 PR 流程外。

## 4. 证据 / 复核 / 回滚

- 证据：`evidence/U1/`；复核输入 `reports/U1-review-input.md`；复核报告 `reports/U1-review.md`。
- fresh 独立 reviewer；逐项 `PASS / FAIL / NOT_RUN`；至少 2 条自选关键断言。
- 回滚目标：U1 分支切出时的 `main` SHA（`ac6ce56`）+ 精确命令；U1 只文档化回滚，不做演练。
- 证据为独立 evidence-only commit；不预授权 `.scratch` 进入产品 PR。

## 5. 生效与失效

- 生效：本记录合入 `main` 之时。
- 失效：U1 用户签署完成后耗尽；U1 `FAIL` 或 STOP 时退回。
- 本记录不产生 U2 / U4 / U5 / U3 的任何隐含授权。
