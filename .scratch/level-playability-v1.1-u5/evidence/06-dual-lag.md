# U5-05 双档 lag 证据隔离回归 — 证据

| 项 | 值 |
| --- | --- |
| 日期 | 2026-11-13 |
| 分支 | `wayfinder/level-playability-v1.1-u5` |
| base | `4d1aa55`（U5-04） |
| 授权包 SHA-256 | `797cd6fc7b299e22b6e90b9ef8a9567376ea3a914d70f8b6f1fc0f9a6ecedc56`（未变） |
| 实现票 | [U5-05](../issues/06-u5-05-dual-lag.md) |

## 产品改动

| 文件 | 改动 |
| --- | --- |
| `packages/contracts/src/playability/temporal.ts` | +约 30：新增 `@internal TemporalTwoLagInternalResult` 与 `analyzeTemporalInternalTwoLag` |
| `packages/contracts/tests/playability-temporal.test.ts` | +6 条 AC-09 双档隔离测试 |

**为什么需要**：D5 §7.2 要求两档分别完整执行、独立预算 / 独立证据，并记录逐档结果；D9 `TemporalInternalResult` 没有 `perLagResults` 字段。U5-05 新增一个**内部双档入口**，把逐档原始结果放在 `first` / `second`、D9 合并结果放在 `combined`，不扩 D9、不改单档入口：

```ts
export type TemporalTwoLagInternalResult = {
  readonly first: TemporalInternalResult;   // input.lagMs（主档，通常 16.67ms）
  readonly second: TemporalInternalResult;  // secondLagMs（默认 200ms）
  readonly combined: TemporalInternalResult; // D9 合并
};
```

- 两档各自调用一次完整的 `analyzeTemporalInternal`；每次创建独立预算对象与证据。
- 不共享 / 拼接转移记录、Witness 或证明；`first` / `second` 是逐档原始结果。
- `combined` 使用 U5-04 的 `resolveTwoLagInternalResults`：一致 ⇒ 主档结果；完整但不一致 ⇒ IE + `lag-disagreement`；任一档不完整 ⇒ 保留该档实际预算 / abort 原因。
- `temporal-result.ts` / `temporal-witness.ts` / `temporal-gate.ts` / `temporal-evasion.ts` / 生产接线：零改动。
- 无新依赖、无 JSON fixture、无公共 barrel 导出、未扩闭集。

## 测试清单（标题均带 `[I02-05][AC-09]`）

| # | 测试 | 断言 |
| --- | --- | --- |
| 1 | 两档各自完整执行：独立预算 / 逐档证据可复现 | `two.first` ≡ 独立主档、`two.second` ≡ 独立第二档（签名 + 规范化序列化）；两档各有 `witness/COMPLETE`；证书对象不共享；`combined` 为 D9 七字段且一致 ⇒ 主档 |
| 2 | 两档都因预算不完整 | 两档各自 `edge-budget-exhausted` / `exhausted`；`combined` 保留 `edge-budget-exhausted`，不是 `lag-disagreement` |
| 3 | 一档完整、一档 edge 预算耗尽 | 正反顺序均保留 `edge-budget-exhausted`；`combined` 为 IE + `none`，不保留乐观档 |
| 4 | 一档完整、一档墙钟 abort | 保留 `wall-clock-abort` / `aborted`，不是 `lag-disagreement` |
| 5 | 两档完整但不一致 | 正反顺序均 IE + `lag-disagreement` + `none`；`budgetStatus="complete"`；不保留乐观档 |
| 6 | 两档都因墙钟不完整 | 两档各自 `wall-clock-abort` / `aborted`；`combined` 保留 `wall-clock-abort`，不是 `lag-disagreement` |

## 命令与退出码

| 命令 | 退出码 | 结果 |
| --- | ---: | --- |
| `pnpm build` | **0** | 通过 |
| `pnpm typecheck` | **0** | 通过 |
| 定向 `playability-temporal.test.ts` + `playability-temporal-budget.test.ts` | **0** | **69 / 69 passed**（A–J/双档文件 43 条） |
| `playability-temporal-input.test.ts --reporter=verbose` | **0** | **65 / 65 passed**；T-55 / T-57 / T-58 / T-61 / T-62 / T-64 全 ✓ |
| `pnpm test` | **0** | **176 files / 2877 tests passed**；2 条 `onTaskUpdate` RPC 超时（工具层，非断言失败） |

原始输出：`06-{build,typecheck,architecture,targeted,test}.log`（本地保留，不入库）。

| 日志 | sha256 |
| --- | --- |
| `06-build.log` | `18529c73cfb0aad4eeeec9b781feef2baafa334cae00a0a090ea7835f170fdbe` |
| `06-typecheck.log` | `9c40c811eeea9939af9ee93a8943081b427016ba7581e498db2e3f244af83f0b` |
| `06-architecture.log` | `f037f7957c610f59a5a4f3cf7ea3e9de0b1509b542a9fb7ddd1f174cc7d6101e` |
| `06-targeted.log` | `f9d818f788cffea08f6cc821bc369195fd95fe311c59244a46b5aa0964c14b63` |
| `06-test.log` | `bd96fed715aa27f103f2285d54fdc48c4cd241d882b4b586503442f633023d3e` |

## 已知限制

1. **同一输入的两档「完整但不一致」世界仍未找到**：测试用两个完整但结论不同的真实单档结果（NB 世界 vs 门区失败世界）验证合并逻辑。两档的独立执行与不共享证据由 test 1 的「逐档结果 ≡ 独立运行」证明；「同一输入」的完整不一致世界若后续找到，可作为补充用例，不改变当前合并语义。
2. U5-04 的 `perLagResults` 缺口已由本票的 `TemporalTwoLagInternalResult` 关闭（不扩 D9）；I-03 若需要逐档结果，消费该内部入口即可。
3. U5-02 的 `stats.work.hopSamplesChecked = 0` 与 U4 独立搜索预算缺口仍在，不影响双档隔离结论。
4. F 已按增量裁定 08 使用 `none` + `no-permanent-gate`。

## 结论

两档各自完整执行、独立预算与逐档证据可复现；任一档不完整保留实际预算 / 墙钟原因；两档完整不一致 ⇒ `lag-disagreement`；逐档结果通过 `first` / `second` 保留，D9 合并不扩字段。新增 6 条测试，定向 69 / 69，全量绿。U5-06 为下一 frontier 票。
