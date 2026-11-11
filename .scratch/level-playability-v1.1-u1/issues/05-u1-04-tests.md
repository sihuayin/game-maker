# U1-04 测试矩阵与 TEST_ONLY 夹具

Type: task
Status: open
Owner: claude (wayfinder session 2026-11-11)
Blocked by: 02, 03, 04
Map: ../map.md
Class: U1 / TESTS

## Task

为 U1 写定向测试与内存夹具。测试只覆盖 U1；不写 U2–U5 的 A–J 场景。

### 允许文件

- `packages/contracts/tests/playability-temporal-fixtures.ts`（`TEST_ONLY`）
- `packages/contracts/tests/playability-temporal-motion.test.ts`
- `packages/contracts/tests/playability-temporal-budget.test.ts`

### 夹具约束

- 内存构造 `GameConfig` / manifest / box；**不读写文件系统、不注册测试、不含产品逻辑**；
- 不被 `src/**` 引用；
- 不新增 JSON fixture；不修改既有测试文件。

### 运动 / 几何测试（R1 证据）

- 三角波：`t=0` 在 `at`、`P/2` 折返、`P`、负时间、多周期、两端不停留、折返点不定义速度。
- AABB：严格重叠 / 相切 / 角接触 / 零面积；y 轴同判据。
- ε：门宽 / 区间阈值两侧；ε 不进碰撞谓词。
- 连续求交：折返点切段、开区间、相邻区间合并、不采样；`c1 === 0` 精确分支；同速 / 近速。
- 退化：`dt = 0`、非有限值、极短安全窗口（如 `1.005e-6 ms`）、极短通道 / 临界门宽。
- 反例：I02-03 §8 的 6 处 P0 差异；采样陷阱；折返点相切。
- 测试标题带 `[I02-01][AC-01]` / `[I02-01][AC-02]` 编号。

### 预算测试（U1 前置）

- `BudgetProfile` 默认 / 硬上限；非法预算（非有限、`timeBudgetMs ≤ 0`、`maxStates < 1`）；派生上界溢出。
- `maxCutsPerCheck`（cutPoints）触发；`cutPointsTotal` / `segmentsTotal` 计数。
- wall-clock abort：注入假 `now` 确定性触发；不得靠真实耗时。
- `budgetStatus` / `budgetKind`；`invalid-budget` / `budget-bound-overflow`。
- `determinismSignature`：FNV-1a 指纹 + 剔除 `wallClockMs` / `detail` 的完整规范化序列化同时比较。
- **不测** `maxCutsPerBranch` 的搜索执行、Witness 体积、相位网格（U2）。
- 测试标题带 `[I02-01][budget]` / `[AC-08]` 等可追溯编号；不得把 U5 硬化写成 U1 已通过。

### 命令

```bash
pnpm build
pnpm exec vitest run packages/contracts/tests/playability-temporal-motion.test.ts packages/contracts/tests/playability-temporal-budget.test.ts
pnpm test
```

### 验收

定向 vitest 与全量 `pnpm test` 通过；既有测试零修改；无 JSON fixture / 文件系统依赖；测试计数与命令写入 U1-05 报告。
