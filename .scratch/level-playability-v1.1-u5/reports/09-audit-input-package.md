# I-02 U5 最终审计输入包

| 项 | 值 |
| --- | --- |
| 用途 | U5-AUDIT（AC-12 / AC-13）输入；**不是 R5 门**，不授权后续能力 |
| 审计对象 | U5（I02-05）实施与证据 |
| 授权包 | [`docs/v7.8/移动-I02.md`](../../../docs/v7.8/移动-I02.md) · `sha256:797cd6fc7b299e22b6e90b9ef8a9567376ea3a914d70f8b6f1fc0f9a6ecedc56` |
| 分支 / base | `wayfinder/level-playability-v1.1-u5` ← `wayfinder/level-playability-v1.1-i02` @ `b41f076` |
| 审计时 HEAD | `3b9f732`（U5-07；U5-08 docs 提交前） |
| 完成报告 | [`U5-completion.md`](../../level-playability-v1.1-i02/reports/U5-completion.md)（作者侧；审计必须独立复核，不得以其结论替代） |
| 独立性 | 审计会话必须**未参与 U5 实现**；只依据本输入包、完成报告、冻结规格、产品源码与证据路径 |

## 1. 交付物

- U5 完成报告：`.scratch/level-playability-v1.1-i02/reports/U5-completion.md`
- 增量授权：`.scratch/level-playability-v1.1-i02/reports/07-u5-incremental-authorization.md`
- F 裁定：`.scratch/level-playability-v1.1-i02/reports/08-u5-f-certificate-decision.md`
- U5 票与证据：`.scratch/level-playability-v1.1-u5/issues/`、`.scratch/level-playability-v1.1-u5/evidence/`
- 性能脚本：`.scratch/level-playability-v1.1-i02/scripts/bench-temporal.mjs`
- A–J / 预算测试：`packages/contracts/tests/playability-temporal.test.ts`、`playability-temporal-budget.test.ts`
- 架构断言：`packages/contracts/tests/playability-temporal-input.test.ts`
- 白名单审计：`.scratch/level-playability-v1.1-u5/evidence/08-audit.md`
- LP 回归：`.scratch/level-playability-v1.1-u5/evidence/07-lp-regression.md`

## 2. 产品改动 / 白名单事实

`git diff --name-status b41f076..HEAD -- packages docs fixtures`：

```text
M packages/contracts/src/playability/temporal.ts
M packages/contracts/src/playability/temporal-budget.ts
M packages/contracts/src/playability/temporal-evasion.ts
M packages/contracts/src/playability/temporal-witness.ts
M packages/contracts/tests/playability-temporal-budget.test.ts
M packages/contracts/tests/playability-temporal-fixtures.ts
A packages/contracts/tests/playability-temporal.test.ts
```

需独立核对：

- 上述 7 个文件是否全部在授权包 §5.2 白名单内；
- `temporal-result.ts` / `temporal-gate.ts` / `temporal-motion.ts` / `graph.ts` / `reach.ts` / `profile.ts` / `targets.ts` / `game-config.ts` / `geometry.ts` / `spatial.ts` / `completion.ts` / `mechanic.ts` / `api.ts` / `assets/ops.ts` 是否零 diff；
- `packages/pipeline` / `packages/cli` / `packages/mcp` / `packages/demo` 是否零 diff；
- `fixtures/packs/**` / `docs/**` 是否零 diff；
- `package.json` / `pnpm-lock.yaml` / `pnpm-workspace.yaml` / `packages/contracts/package.json` 是否零 diff；
- 是否存在新增产品 JSON / 新公共 barrel / 新公共导出；
- `analyzeTemporalInternal` / `resolveTwoLagInternalResults` / `analyzeTemporalInternalTwoLag` / `TemporalTwoLagInternalResult` 是否只在 `temporal.ts`，不在 barrel / `api.ts`。

## 3. 必须重跑的命令

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

审计人必须记录每条命令的退出码、关键计数、原始输出摘要或 hash；不得以作者总结替代自己的复核。

## 4. 验收表（审计人填写 `PASS / FAIL / NOT_RUN`）

| AC | 要求 | 预期证据 | 状态 | 备注 / 证据 hash |
| --- | --- | --- | --- | --- |
| AC-08 | 预算：工作预算是唯一语义预算；墙钟 abort-only；累计 cut 按 segments；恰好 / 超限、非法、溢出 | `playability-temporal-budget.test.ts`；A–J H；`03-budget.md` |  |  |
| AC-09 | 双档 lag：两档完整执行、独立证据；一致 / 不一致 / 不完整三分；不保留乐观档 | `playability-temporal.test.ts` U5-05 6 条；A–J I；`06-dual-lag.md` |  |  |
| AC-10 | 确定性：签名 / 规范化完整序列化；排除 `wallClockMs` / `detail`；跨进程 | U5-03 7 条；`04-cross-process.json`；`04-determinism.md` |  |  |
| AC-11 | 模型外 / 几何 / 时序 / 规避证据不足 ⇒ IE 且原因一致 | U5-01 模型外测试；A–J C / E；`02-assembly.md` / `05-matrix.md` |  |  |
| AC-12 | 范围与白名单审计 | `git diff` 核对；`08-audit.md` |  |  |
| AC-13 | 核心测试 + LP-06/07 回归 + 性能证据完整性 | A–J 11 条；全量测试；`07-lp-regression.md`；`06-performance.md` / `06-performance.json` |  |  |

逐项判定，不得用总通过率替代。未运行项不得因其他测试通过而推定通过。

## 5. 需独立核对的已知限制（不是作者结论）

1. F 使用 `certificate.kind="none"` + IE `no-permanent-gate`（增量裁定 08）；核对 D9 类型未被修改。
2. `geometry-checked` / `model-out-excluded` 恒 `BLOCKED`；`geometryCoverage` 恒 `partial`。
3. U9 未进入组装；NB 由 W 承载。
4. 历史语料 20/20 全部 IE 早退；性能证据的搜索分布为 0；synthetic 只作 sanity。
5. `stats.work.hopSamplesChecked` 仍为 0；U4 独立搜索预算未实现。
6. 同一输入的 lag 不一致世界未找到；合并逻辑用两个完整但结论不同的真实单档结果测试。
7. `perLagResults` 由内部 `TemporalTwoLagInternalResult` 提供，D9 字段未扩。
8. `PUBLIC_NB` / `PUBLIC_PU` 仍 `BLOCKED`；I-03 未接线。

## 6. 独立验证要求

- 至少独立验证 **2 条关键断言**，自选并记录理由与结果。
- 检查 A–J 覆盖、六条件 `puConditions`、`publicCapability="BLOCKED"`、T-55/57/58/61/62/64、生产接线零改动。
- 不修改产品代码 / 测试 / 证据；不推送 / 建 PR / 合并。
- 写 `.scratch/level-playability-v1.1-i02/reports/U5-final-audit.md`：逐项结论、命令与退出码、证据 hash、未覆盖项、限制、独立签署。
- 不得把审计结论扩展为公共能力 / I-03 授权。

## 7. 审计签署（审计人填写）

- 审计人：____________________
- 日期：____________________
- 结论：____________________
- 备注：____________________
