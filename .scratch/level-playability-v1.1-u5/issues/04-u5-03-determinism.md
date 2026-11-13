# U5-03 墙钟 abort 与确定性

Type: task
Status: open
Owner: —
Blocked by: 03
Map: ../map.md
Class: U5 / IMPLEMENTATION

## Task

硬化墙钟 abort-only 与确定性承诺：`determinismSignature` 排除 `wallClockMs` / `detail`，规范化序列化一致，跨进程可复现。

### 允许文件

- `packages/contracts/src/playability/temporal.ts` / `temporal-budget.ts`（仅缺口）
- `packages/contracts/tests/playability-temporal-budget.test.ts` / `playability-temporal.test.ts`
- `packages/contracts/tests/playability-temporal-fixtures.ts`

### 必须完成

1. 墙钟只作 abort-only：注入 `now` 确定性触发 `wall-clock-abort`；不得依赖真实耗时。
2. `determinismSignature` 必须排除 `wallClockMs` / `detail`；签名只覆盖语义字段（D5 Q1）。
3. 确定性测试：进程内连跑 ≥2 次，签名相等；剔除 `wallClockMs` / `detail` 的规范化完整序列化相等。
4. 跨进程确定性：同一输入的规范化结果在不同进程一致（脚本或测试；不得依赖墙钟字段）。
5. 所有影响策略选择的遍历 / 候选顺序必须确定性排序（D5 Q9）。
6. 测试标题带 `[I02-0x][AC-10]` 编号。
7. 复跑 build / typecheck / budget + 全量测试。

### 禁止

- 把墙钟纳入签名或作为通过条件；
- 引入真实时间依赖 / 随机源；
- 扩闭集 / 新增依赖 / 白名单外文件。

### 验收

AC-10 测试通过；墙钟 abort 可确定性触发；跨进程签名一致；全量测试绿。

## Answer

（resolved 时填写）
