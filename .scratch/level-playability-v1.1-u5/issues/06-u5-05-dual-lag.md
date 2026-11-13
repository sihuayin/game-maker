# U5-05 双档 lag 证据隔离回归

Type: task
Status: resolved
Owner: claude (U5-05 session 2026-11-13)
Blocked by: 05
Map: ../map.md
Class: U5 / VERIFICATION

## Task

验证 16.67ms / 200ms 两档 lag 各自完整执行、证据隔离、降级原因区分（授权包 §8.5）。

### 允许文件

- `packages/contracts/tests/playability-temporal.test.ts` / `playability-temporal-budget.test.ts`
- `packages/contracts/tests/playability-temporal-fixtures.ts`
- `packages/contracts/src/playability/temporal*.ts`（仅修复缺陷）

### 必须完成

1. 两档分别完整执行：每档独立预算、独立证据；不共享 / 拼接转移记录、Witness、证明。
2. 两档结论一致 ⇒ 按冻结规则处理；不一致 ⇒ `insufficient-evidence` + `lag-disagreement`。
3. 「至少一档不完整」保留实际预算 / abort 原因，不得伪装成 `lag-disagreement`。
4. 不允许只保留较乐观或较确定的一档。
5. 测试标题带 `[I02-0x][AC-09]` 编号；断言两档各自的证据与原因。
6. 复跑 build / typecheck / 定向 + 全量测试。

### 禁止

- 跨档共享 Witness / 转移记录；
- 把不一致与不完整混为同一原因；
- 新增依赖 / 白名单外文件。

### 验收

AC-09 通过；两档证据隔离可审计；降级原因区分正确；全量测试绿。

## Answer

**完成。** 新增内部双档入口，逐档完整执行、独立预算 / 独立证据；逐档结果与 D9 合并结果分列，未扩 D9。

| 项 | 结果 |
| --- | --- |
| 产品改动 | `temporal.ts` +约 30：`TemporalTwoLagInternalResult`（`first` / `second` / `combined`）+ `analyzeTemporalInternalTwoLag`；其余产品文件零改动 |
| 独立执行 | 两档各自调用完整 `analyzeTemporalInternal`；`two.first` / `two.second` 与各自独立运行逐字段一致（签名 + 规范化序列化） |
| 证据隔离 | 两档各自拥有完整 Witness；证书对象不共享；无跨越 / 拼接转移记录 |
| 逐档记录 | `first` / `second` 保留逐档结果，`combined` 仍是 D9 七字段；D5 §7.2 的 per-lag 要求在不扩 D9 的前提下满足 |
| 一致 | `combined` = 主档结果 |
| 完整但不一致 | IE + `lag-disagreement` + `certificate.kind="none"`；正反顺序均测；不保留乐观档 |
| 有档不完整 | 保留该档 `edge-budget-exhausted` / `wall-clock-abort` 等实际原因；不伪装成 `lag-disagreement`；不保留乐观档 |
| 两档都不完整 | 两档各自保留原因；合并保留实际原因（预算 / 墙钟），不拼成 disagreement |
| 测试 | 新增 6 条，标题均带 `[I02-05][AC-09]`；定向 69 / 69；架构断言 65 / 65 |
| 命令 | `pnpm build` 0；`pnpm typecheck` 0；`pnpm test` 176 files / 2877 tests，退出码 0 |

### 已知限制

- **同一输入**的两档「完整但不一致」世界仍未找到；测试用两个完整但结论不同的真实单档结果验证合并逻辑。两档独立执行 / 不共享证据由「逐档结果 ≡ 独立运行」证明。
- U5-04 的 `perLagResults` 缺口已由 `TemporalTwoLagInternalResult` 关闭，不扩 D9；I-03 若需要逐档结果可消费该内部入口。
- U5-02 的 `stats.work.hopSamplesChecked = 0` 与 U4 独立搜索预算缺口仍在，不影响双档隔离结论。
- F 已按增量裁定 08 使用 `none` + `no-permanent-gate`。

证据：[`../evidence/06-dual-lag.md`](../evidence/06-dual-lag.md)。本票未推送 / 建 PR / 合并。
