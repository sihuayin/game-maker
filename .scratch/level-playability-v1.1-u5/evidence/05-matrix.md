# U5-04 A–J 矩阵与跨单元组合 — 证据

| 项 | 值 |
| --- | --- |
| 日期 | 2026-11-13 |
| 分支 | `wayfinder/level-playability-v1.1-u5` |
| base | `ffc1fef`（F 证书形状裁定后） |
| 授权包 SHA-256 | `797cd6fc7b299e22b6e90b9ef8a9567376ea3a914d70f8b6f1fc0f9a6ecedc56`（未变） |
| 实现票 | [U5-04](../issues/05-u5-04-matrix.md) |

## 产品改动

| 文件 | 改动 |
| --- | --- |
| `packages/contracts/src/playability/temporal.ts` | +约 80：新增 `@internal resolveTwoLagInternalResults`，实现 D9 双档内部结果合并（一致 / 不一致 / 不完整三分） |
| `packages/contracts/tests/playability-temporal.test.ts` | +11 条 A–J 与跨单元测试 |

- I 测试暴露的缺口：`analyzeTemporalInternal` 是单档入口，D9 §9 I 需要双档合并结果，但此前没有内部合并函数。按 U5-04 票面「`temporal*.ts`（仅修复测试暴露的缺陷）」补最小合并逻辑；不做 I-03 接线。
- 一致时保留主档（`first`，16.67ms）结果；两档都完整但结论不同 ⇒ `lag-disagreement` + `certificate.kind="none"`；任一档不完整 ⇒ 保留该档实际预算 / 墙钟原因。
- `temporal-result.ts` / `temporal-witness.ts` / `temporal-gate.ts` / `temporal-evasion.ts` / 生产接线：零改动。
- 无新依赖、无 JSON fixture、无公共 barrel 导出、未扩闭集。

## A–J 映射

| 编号 | 测试 | 结果形状 |
| --- | --- | --- |
| A | `[I02-02][AC-03] A：安全等待窗口 ⇒ nb-candidate + witness COMPLETE` | `nb-candidate` + `witness/COMPLETE` + `phaseCoverage.complete` |
| B | `[I02-03][AC-05/06/07] B：永久门区且无垂直规避 ⇒ pu-candidate + 六条件` | `pu-candidate` + `permanent-gate/COMPLETE`；条件 1/3/4/6 PASS、2/5 BLOCKED |
| C | `[I02-05][AC-11] C：几何 / 时序 / 规避证据不足 ⇒ IE + 缺口一致` | spawn 缺口 ⇒ `spawn-not-on-lattice` + `spawn-box-out-of-world`；门区缺口 ⇒ `no-permanent-gate` + `none` |
| D | `[I02-01][AC-01/02] D：折返点切段与 witness verified 一致` | 跨 150ms 折返点的 tuple `[4,2,5,3,120,180,1]`；重放 `cutPoints=0` / `segments=2` / `verified=true` |
| E | `[I02-02][AC-03/04] E：等待阶段碰撞 ⇒ 不得 nb-candidate` | IE + `none`；原因集合含 `no-witness-found` |
| F | `[I02-03][AC-05] F：短暂安全窗口 ⇒ IE + no-permanent-gate + none` | 按 [增量裁定 08](../../level-playability-v1.1-i02/reports/08-u5-f-certificate-decision.md) |
| G | `[I02-04][AC-06/07] G：垂直规避 ⇒ permanent-gate INCOMPLETE + 图割原因` | `permanent-gate/INCOMPLETE` + `graph-cut-incomplete` |
| H | `[I02-05][AC-08] H：搜索预算超限 ⇒ IE + exhausted + budgetKind` | IE + `budgetStatus="exhausted"` + `budgetKind="edge-budget"` |
| I | `[I02-05][AC-09] I：两档 lag 合并 ⇒ 一致 / 不一致 / 不完整三分` | 一致 ⇒ nb-candidate；完整不一致 ⇒ IE + `lag-disagreement` + `none`；不完整 ⇒ `edge-budget-exhausted` + `exhausted` |
| J | `[I02-05][AC-10] J：相同输入重复运行 ⇒ determinismSignature 相等` | 签名 + 规范化完整序列化一致 |
| 跨单元 | `[I02-05][AC-13] 跨单元：NB / PU 互斥、门区 + 图割 + hop 联合、IE 优先级` | 单一 internalResult / 证书一致；PU 三要素缺一不可；`model-out` 压过 `invalid-budget`，预算压过普通否定证据 |

每条测试都显式断言 `publicCapability="BLOCKED"` 与 `publicResult=null`。

## 命令与退出码

| 命令 | 退出码 | 结果 |
| --- | ---: | --- |
| `pnpm build` | **0** | 通过 |
| `pnpm typecheck` | **0** | 通过（首次发现一个测试内类型收窄错误，已修） |
| 定向 `playability-temporal.test.ts` + `playability-temporal-budget.test.ts` | **0** | **63 / 63 passed**（A–J 文件 37 条） |
| `playability-temporal-input.test.ts --reporter=verbose` | **0** | **65 / 65 passed**；T-55 / T-57 / T-58 / T-61 / T-62 / T-64 全 ✓ |
| `pnpm test` | **0** | **176 files / 2871 tests passed**；2 条 `onTaskUpdate` RPC 超时（工具层，非断言失败） |

原始输出：`05-{build,typecheck,architecture,targeted,test}.log`（本地保留，不入库）。

| 日志 | sha256 |
| --- | --- |
| `05-build.log` | `88296fdc5444002a18f37d6b461bac2ddac5f3113e0e9fde7a13e8a6f4146a15` |
| `05-typecheck.log` | `8d15ba2e817b7a37795bb98277de33cbbfeacba04d90fafd1c6f854dea885c3a` |
| `05-architecture.log` | `cecef96333b067033843e022f7ef12b163d7df2c812fa382bb032c9319e81144` |
| `05-targeted.log` | `09ff9f2f47535fd7e358559e21ed28ad15c9d81e573478b28e945a8e1ac50d6a` |
| `05-test.log` | e2a0030d72a51c3ed82145c5f91c008a61c77c507fc63323632ce25ce146e732 |

## 已知缺口 / 限制

1. **I 的不一致用例使用「两个完整但结论不同」的真实单档结果**（NB 世界 vs 门区失败世界）来测试合并函数；在 fixture 参数空间内未找到**同一输入**在两档 lag 下结论不同的世界。同输入的逐档证据隔离 / 不跨档拼接回归由 **U5-05** 承担。
2. **D5 §7.2 的 `perLagResults` 未进 D9 `TemporalInternalResult`**：当前合并结果只保留主档（一致时）或被保留的实际原因（不完整时），不携带两档逐档结果。这是 D5 与 D9 的字段级缺口；若 U5-05 / 最终审计要求逐档结果，需要 HITL 裁定是否扩 D9。
3. U5-02 的 `stats.work.hopSamplesChecked = 0` 与 U4 独立搜索预算缺口仍在，不影响 A–J 语义结论。
4. F 已按增量裁定 08 使用 `none` + `no-permanent-gate`；G 仍保留 `permanent-gate + INCOMPLETE` 部分证明。

## 结论

A–J 十项与跨单元组合均有具名测试；`publicCapability` / `publicResult` 边界逐条断言；新增 11 条测试，定向 63 / 63，全量绿。U5-05 为下一 frontier 票。
