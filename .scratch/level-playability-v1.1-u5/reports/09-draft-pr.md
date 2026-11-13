# Draft PR 描述（**未推送 / 未创建**）

> ⚠️ 本文件只准备 PR 描述。按 U5 地图与 U5-08 票面：**不推送、不创建 PR、不合并**；需要用户另行明确指令。

## 标题

`I-02 U5: budget/determinism hardening, A–J matrix, performance evidence, completion report`

## Base / Head

- Base：`wayfinder/level-playability-v1.1-i02`
- Head：`wayfinder/level-playability-v1.1-u5`
- 类型：**Draft**（准备阶段；未创建）

## 摘要

完成 I-02 U5（I02-05）：D9 内部结果组装、预算 / 确定性硬化、A–J 矩阵、双档 lag 证据隔离、性能证据、LP-06/07 回归、白名单审计与完成报告。

- U5-00 基线 / 增量授权 / 完成协议
- U5-01 `analyzeTemporalInternal` 组装 + F 缺口登记
- F 裁定：`certificate.kind="none"` + IE `no-permanent-gate`
- U5-02 预算闭合 / 降级硬化
- U5-03 墙钟 abort-only / 确定性
- U5-04 A–J 矩阵 + 内部双档合并
- U5-05 双档证据隔离 + `TemporalTwoLagInternalResult`
- U5-06 性能证据（冻结脚本路径）
- U5-07 LP-06/07 回归
- U5-08 白名单审计 + 完成报告 + 本 Draft

## 产品改动（白名单）

```text
M packages/contracts/src/playability/temporal.ts
M packages/contracts/src/playability/temporal-budget.ts
M packages/contracts/src/playability/temporal-evasion.ts
M packages/contracts/src/playability/temporal-witness.ts
M packages/contracts/tests/playability-temporal-budget.test.ts
M packages/contracts/tests/playability-temporal-fixtures.ts
A packages/contracts/tests/playability-temporal.test.ts
```

- 无新依赖、无产品 JSON fixture、无公共 barrel / 新公共导出。
- `ops.ts` / `mechanic.ts` / `api.ts` / Runtime / Pipeline / CLI / MCP 零 diff。
- `graph.ts` / `reach.ts` / `profile.ts` 等只读文件零 diff。

## 测试计划

```bash
pnpm build
pnpm typecheck
pnpm test
pnpm exec vitest run packages/contracts/tests/playability-temporal.test.ts
pnpm exec vitest run packages/contracts/tests/playability-temporal-budget.test.ts
pnpm exec vitest run packages/contracts/tests/playability-temporal-input.test.ts --reporter=verbose
pnpm build && node .scratch/level-playability-v1-p1/acceptance-corpus.mjs
pnpm build && node .scratch/level-playability-v1-p1/acceptance-matrix.mjs
pnpm build && node .scratch/level-playability-v1.1-i02/scripts/bench-temporal.mjs
```

作者侧结果：build / typecheck 0；A–J 43 / 43；预算 26 / 26；架构 65 / 65；全量 176 files / 2877 tests；LP-06/07 与基线逐字节一致；bench 3 进程摘要一致。最终审计未进行。

## 证据

- 完成报告：`.scratch/level-playability-v1.1-i02/reports/U5-completion.md`
- 增量授权：`.scratch/level-playability-v1.1-i02/reports/07-u5-incremental-authorization.md`
- F 裁定：`.scratch/level-playability-v1.1-i02/reports/08-u5-f-certificate-decision.md`
- U5 证据：`.scratch/level-playability-v1.1-u5/evidence/`
- 审计输入包：`.scratch/level-playability-v1.1-u5/reports/09-audit-input-package.md`

## 已知限制

- 几何 `partial` / Runtime body 未验证；空中控制未闭合；PU 条件 2/5 恒 `BLOCKED`。
- U9 未进入组装；NB 由 W 承载。
- F 使用 `none`，不是永久门区证明。
- 历史语料 20/20 全部 IE 早退；性能搜索分布为 0；synthetic 只作 sanity。
- `hopSamplesChecked` 仍为 0；U4 独立搜索预算未实现。
- 同一输入 lag 不一致世界未找到；`perLagResults` 由内部 wrapper 提供。
- `PUBLIC_NB` / `PUBLIC_PU` 未授权；I-03 未接线。

## 不包含

- `PUBLIC_NB` / `PUBLIC_PU`、I-03 接线、公共 Verdict。
- 推送 / 创建 PR / 合并（本文件只是描述）。
- 修改已签署授权包 / I-00 / I-02 原文。
