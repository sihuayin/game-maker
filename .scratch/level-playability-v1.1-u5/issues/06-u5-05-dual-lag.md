# U5-05 双档 lag 证据隔离回归

Type: task
Status: open
Owner: —
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

（resolved 时填写）
