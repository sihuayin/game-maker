# U5-04 A–J 矩阵

Type: task
Status: open
Owner: —
Blocked by: 04
Map: ../map.md
Class: U5 / VERIFICATION

## Task

新建 `playability-temporal.test.ts`，按授权包 §8.2 落 A–J 矩阵与跨单元组合断言。

### 允许文件

- `packages/contracts/tests/playability-temporal.test.ts`（新建）
- `packages/contracts/tests/playability-temporal-fixtures.ts`（`TEST_ONLY`）
- `packages/contracts/src/playability/temporal*.ts`（仅修复测试暴露的缺陷）

### 必须完成

1. A–J 每条至少一个具名测试，标题带 `[I02-0x][AC-xx]`：
   - A 安全等待窗口 ⇒ `nb-candidate` + `certificate.kind="witness"` + `COMPLETE`；
   - B 永久门区且无垂直规避 ⇒ `pu-candidate` + `permanent-gate` + `COMPLETE` + 条件 1/3/4/6 `PASS`、2/5 `BLOCKED`；
   - C 证据不足 ⇒ `insufficient-evidence` + 缺口一致；
   - D 折返点临界碰撞；E 等待阶段碰撞 ⇒ 不得 `nb-candidate`；
   - F 短暂安全窗口 ⇒ `permanent-gate` + `INCOMPLETE` + `no-permanent-gate`；
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

（resolved 时填写）
