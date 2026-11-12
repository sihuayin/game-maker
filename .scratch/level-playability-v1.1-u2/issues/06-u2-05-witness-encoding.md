# U2-05 Witness 编码、体积与确定性

Type: task
Status: open
Owner: claude (U2-05 session 2026-11-12)
Blocked by: 04, 05
Map: ../map.md
Class: U2 / IMPLEMENTATION

## Task

把 W / U9 的验证记录编码为 D9 `Witness`，并执行体积与确定性约束。

### 必须实现

- D9 §6.2 形状：`form: "u9" | "winning-set"`；`derived: true`；`verifications: WitnessTransition[]`；`policy` 下标；`termination`；`phaseCoverage`；`volume`。
- 每转移 `[fromFoot, fromK, toFoot, toK, t0, t1, verified]`；`policy` 只引用 `verified = 1`。
- 体积：**最终确定性序列化 UTF-8 字节数**；`maxWitnessTransitions = 1M`、`maxWitnessBytes = 64 MiB`；任一超限 ⇒ IE `witness-volume`，**不得截断**。
- 确定性序列化：键序固定、数字格式固定、无 `undefined`；同策略重复序列化逐字节一致。
- 派生盒与解析盒一致：由 `(footX, k, t)` + 冻结公式派生，标 `derived: true`。
- 两档 lag 各自独立编码；禁止跨档共享 / 拼接。
- 输出 `Witness` + 状态；**不组装 `TemporalInternalResult`**（入口与完整结果归 U5）。

### 禁止

- 修改 `temporal-result.ts` / `temporal.ts`；公共导出；A–J；门区 / 图割；测试文件（U2-06 负责）。

### 验收

`pnpm build` / `pnpm typecheck` 通过；字节数可复算；超限 IE；无 `TemporalInternalResult` 入口；diff 只含 `temporal-witness.ts`。
