# U1-04 测试矩阵与 TEST_ONLY 夹具

Type: task
Status: resolved
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

## Answer

**2026-11-11 完成。新增 3 个测试侧文件；`packages/contracts/src/**` 零修改。**

### 产出

- `tests/playability-temporal-fixtures.ts`（**TEST_ONLY**）：三角波 / Hazard / AABB / check 输入构造器、`okResult` / `intervalAt` 断言辅助、D9 结果夹具、规范化 JSON 与剔除 `wallClockMs` / `detail` 的完整视图。不注册测试、不读写文件系统、不被 `src/**` 引用。
- `tests/playability-temporal-motion.test.ts`：**35 tests**。
  - 三角波：`t=0` / `P/2` / `P`、负时间对称、多周期、两端不停留、折返点速度 `null`、`±2d/P`、`pieceSlope` 不跨折返点、`distance ≤ 0`、非法参数抛 `RangeError`。
  - AABB / 几何：`overlapsStrict` 正面积 / 相切 / 角接触 / 零面积接触 / y 轴；`playerBoxAt` / `hazardBoxAt` 不取整。
  - ε：公式两侧；ε 不进谓词（x / y 各 5e-10 重叠仍算撞）；默认阈值 0 保留 2e-10 ms 窗口；显式阈值 1e-10 / 3e-10 两侧；1.005e-6 ms 安全窗口；临界门宽只在“严格大于 ε”层面测（实际门区闭式属 U3）。
  - 连续求交：折返点两窗口、切点相切保留零测度安全点、切点真实重叠合并、`c1 === 0` 精确分支、近速不归零、短于 60Hz 帧间隔仍能求出、`dt = 0` 点查询与区间表达一致、y 不重叠仍计数、负时间、切点计数、`non-finite` / `invalid-input` / `cut-budget`。
  - 反例：D-P0-1（y ε）、D-P0-2（速度差钳位）、D-P0-3（区间阈值）、D-P0-4（极短跨折返点段）、D-P0-5（`dt=0`）、D-P0-6（对称 lag）、采样陷阱、折返点相切。
- `tests/playability-temporal-budget.test.ts`：**23 tests**。
  - 默认值与硬上限逐字段冻结；`maxBranching` / `maxEdges` 派生；覆盖合并与硬上限边界。
  - 非法预算（非有限 / 非整数 / ≤0 / 超硬上限）⇒ `invalid-budget`；派生上界溢出 ⇒ `budget-bound-overflow`。
  - `maxCutsPerCheck` 与 `cutPointsTotal` / `segmentsTotal` 累计；停止单向；非法计量抛 `RangeError`。
  - 注入时钟在 work 检查点触发 `wall-clock-abort`；未到检查点不读时钟；`finish()` 定格；`wallClockMs` 只作诊断。
  - 签名：FNV-1a 已知向量交叉校验、8 位十六进制；重复运行签名 + 完整规范化序列化同时相等；排除 `wallClockMs` / `detail`；`budgetProfile` 不进签名但完整序列化仍能区分；work / grid / 原因码 / 预算状态变化均改变签名；键序无关。

### 边界

- 未写 U2–U5 的 A–J 场景；未测 `maxCutsPerBranch` 搜索执行、Witness 体积、相位网格。
- 预算测试明确标为 **U1 前置**，不声称 U5 硬化已通过。
- 无 JSON fixture、无文件系统依赖、未修改既有测试。

### 验证

- 定向：`pnpm exec vitest run .../playability-temporal-motion.test.ts .../playability-temporal-budget.test.ts` → **2 files / 58 tests passed**。
- `pnpm typecheck` exit 0；`pnpm build` exit 0。
- `playability-temporal-input.test.ts`：65/65 PASS；T-55 / T-57 / T-58 / T-61 / T-62 / T-64 原样通过。
- `pnpm test`：**172 files / 2674 tests passed**（基线 170 / 2616，+2 files / +58 tests）；2 条已知 Vitest worker RPC 超时（与基线一致）。
- `git status` 仅 3 个新增测试侧文件；`analyze:` / `Symbol(` / `node:fs|crypto` / `TEMPORAL_LAG_*` 零命中。

### 下游

U1-05（回归、白名单 / diff 审计与实现报告）进入 frontier。
