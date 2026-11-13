# U5-04 A–J 矩阵

Type: task
Status: resolved
Owner: claude (U5-04 session 2026-11-13)
Blocked by: 04
Map: ../map.md
Class: U5 / VERIFICATION

## Task

扩展 `playability-temporal.test.ts`（U5-01 已新建），按授权包 §8.2 落 A–J 矩阵与跨单元组合断言。

### 允许文件

- `packages/contracts/tests/playability-temporal.test.ts`（已存在；U5-01 新建，U5-04 扩展）
- `packages/contracts/tests/playability-temporal-fixtures.ts`（`TEST_ONLY`）
- `packages/contracts/src/playability/temporal*.ts`（仅修复测试暴露的缺陷）

> **F 的证书形状**由 [增量裁定 08](../../level-playability-v1.1-i02/reports/08-u5-f-certificate-decision.md) 冻结为
> `insufficient-evidence` + `no-permanent-gate` + `certificate.kind = "none"`；U5-04 **不得**
> 按授权包 §8.2 的字面 `permanent-gate + INCOMPLETE` 断言，也不得伪造门区字段。

### 必须完成

1. A–J 每条至少一个具名测试，标题带 `[I02-0x][AC-xx]`：
   - A 安全等待窗口 ⇒ `nb-candidate` + `certificate.kind="witness"` + `COMPLETE`；
   - B 永久门区且无垂直规避 ⇒ `pu-candidate` + `permanent-gate` + `COMPLETE` + 条件 1/3/4/6 `PASS`、2/5 `BLOCKED`；
   - C 证据不足 ⇒ `insufficient-evidence` + 缺口一致；
   - D 折返点临界碰撞；E 等待阶段碰撞 ⇒ 不得 `nb-candidate`；
   - F 短暂安全窗口 ⇒ `insufficient-evidence` + `no-permanent-gate` + `certificate.kind = "none"`（[增量裁定 08](../../level-playability-v1.1-i02/reports/08-u5-f-certificate-decision.md)；不得伪造门区证明）；
   - G 垂直规避 ⇒ `INCOMPLETE` + `graph-cut-incomplete` / `hop-doubling-changed` / `movement-model-unclosed`；
   - H 预算超限 ⇒ `budgetStatus="exhausted"` + 对应 `budgetKind`；
   - I 双档 lag 不一致 ⇒ `lag-disagreement`，两档都完整；
   - J 相同输入重复运行 ⇒ `determinismSignature` 相等。
2. 每条测试显式断言 `publicCapability="BLOCKED"` 与 `publicResult=null`。
3. 跨单元组合：NB 与 PU 的互斥、门区 + 图割 + hop 的联合判定、IE 优先级。
4. 复跑 build / typecheck / 定向矩阵 + 全量测试。

### 禁止

- 修改既有单元测试断言；
- 发布公共 Verdict / 改公共 Contract；
- 新增依赖 / JSON fixture / 白名单外文件。

### 验收

A–J 全覆盖且标题带编号；每条断言 `publicCapability` / `publicResult`；全量测试绿。

## Answer

**完成。** A–J 十项与跨单元组合均有具名测试；补齐了 I 所需的内部双档合并函数；F 按增量裁定 08 使用 `none`。

| 项 | 结果 |
| --- | --- |
| 产品改动 | `temporal.ts` +约 80：新增 `@internal resolveTwoLagInternalResults`（一致 / 不一致 / 不完整三分）；其余产品文件零改动 |
| A | `nb-candidate` + `witness/COMPLETE` + `phaseCoverage.complete` |
| B | `pu-candidate` + `permanent-gate/COMPLETE`；条件 1/3/4/6 PASS、2/5 BLOCKED |
| C | spawn 缺口 ⇒ `spawn-not-on-lattice` + 具体 gap；门区缺口 ⇒ `no-permanent-gate` + `none` |
| D | 跨 150ms 折返点 tuple `[4,2,5,3,120,180,1]`；重放 `cutPoints=0` / `segments=2` / `verified=true` |
| E | IE + `none`；原因集合含 `no-witness-found`；不得 `nb-candidate` |
| F | IE + `no-permanent-gate` + `certificate.kind="none"`（[增量裁定 08](../../level-playability-v1.1-i02/reports/08-u5-f-certificate-decision.md)） |
| G | `permanent-gate/INCOMPLETE` + `graph-cut-incomplete` |
| H | IE + `budgetStatus="exhausted"` + `budgetKind="edge-budget"` |
| I | 一致 ⇒ nb-candidate；完整不一致 ⇒ IE + `lag-disagreement` + `none`；不完整 ⇒ `edge-budget-exhausted` + `exhausted`（正反顺序均测） |
| J | 签名 + 剔除 `wallClockMs` / `detail` 的规范化完整序列化一致 |
| 跨单元 | NB / PU 互斥；PU 三要素缺一不可；`model-out` 压过 `invalid-budget`，预算压过普通否定证据 |
| 边界 | 每条测试显式断言 `publicCapability="BLOCKED"` / `publicResult=null` |
| 命令 | `pnpm build` 0；`pnpm typecheck` 0；定向 63 / 63；架构断言 65 / 65；`pnpm test` 176 files / 2871 tests，退出码 0 |

### 已知缺口 / 限制

- I 的不一致用例使用「两个完整但结论不同」的真实单档结果；fixture 参数空间内未找到同一输入在两档 lag 下结论不同的世界。同输入的逐档隔离 / 不跨档拼接回归由 **U5-05** 承担。
- D5 §7.2 的 `perLagResults` 未进 D9 `TemporalInternalResult`；当前合并结果不携带逐档结果。若 U5-05 / 最终审计要求，需 HITL 裁定是否扩 D9。
- U5-02 的 `stats.work.hopSamplesChecked = 0` 与 U4 独立搜索预算缺口仍在，不影响 A–J 语义结论。

证据：[`../evidence/05-matrix.md`](../evidence/05-matrix.md)。本票未推送 / 建 PR / 合并。
