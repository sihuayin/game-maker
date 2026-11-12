# U1-02 运动原语与连续时间求交

Type: task
Status: resolved
Owner: claude (wayfinder session 2026-11-11)
Blocked by: 01
Map: ../map.md
Class: U1 / IMPLEMENTATION

## Task

实现三角波、AABB 派生与连续时间解析求交。**不采样、不接生产、不做 Witness / 门区 / 图割。**

### 允许文件

- `packages/contracts/src/playability/temporal-motion.ts`（新增）

### 必须实现

- 三角波：`trianglePosition`、`triangleSpeed`、`pieceSlope`；`t=0` 在 `at`、`P/2` 折返、负时间 / 多周期、两端不停留、折返点不定义速度。
- 几何：`playerBoxAt`、`hazardBoxAt`（manifest `size`/`anchor` 派生）；只读复用 `./geometry.js` 的 `overlapsStrict`，不复制第二套谓词。
- ε：`max(1e-9, 1e-9 × (xMax − xMin))`；只用于门宽 / 显式区间阈值，**不进入碰撞谓词**。
- 连续求交：折返点切段、开区间求交、`c1 === 0` 精确分支、相邻区间合并、`cutPoints` / `segments` 计数。
- `lagPad`：Witness 方向的 `hazardSpeed × lagMs` 保守带；不得用于门区。
- 非有限值 / `dt = 0` / 同速 / 近速 / 极短窗口等退化路径。

### 禁止

- 采样替代连续判定；
- 用 `hi − lo > 1e-9` 吞掉安全窗口；
- 对速度差设绝对容差；
- 门区 / 图割 / Witness / 预算搜索；
- 修改 `temporal.ts` 或任何 U2–U5 文件；
- 测试文件（U1-04 负责）。

### 验收

`pnpm build` / `pnpm typecheck` 通过；`git diff` 只含 `temporal-motion.ts`；无公共导出。

## Answer

**2026-11-11 完成。只新增 `temporal-motion.ts`；未触碰 `temporal.ts`、barrel 或测试。**

### 产出

- 三角波：`trianglePosition`、`triangleSpeed`、`pieceSlope`、`triangleMaxRate`。`t=0` 在 `at`，`P/2` 折返，负时间 / 多周期由模运算覆盖；折返点速度返回 `null`，跨折返点的段 `pieceSlope` 也返回 `null`，不人为取 0 / 右连续。
- 几何：`playerBoxAt`（`boxFromFoot`，不取整）、`hazardBoxAt`（`at` + manifest `size` / `anchor`，不取整）；碰撞谓词只复用 `geometry.ts` 的 `overlapsStrict`，未复制第二套。
- `epsilon(xMin, xMax)`：严格按 `max(1e-9, 1e-9·(xMax−xMin))`；不进入谓词。
- `lagPad`：`hazardSpeed × lagMs` 的单侧保守带，方向取折返点右极限（`t=0` 向上、`P/2` 向下）；门区不得使用。
- `intersectContinuous`：折返点切段 → 每段两个线性不等式取开区间交集 → 合并；返回 `intervals` / `cutPoints` / `segments`，失败返回 `non-finite` / `invalid-input` / `cut-budget`。

### 冻结行为

- `c1 === 0` 走精确分支；速度差没有绝对容差。区间保留阈值 `intervalTolerance` 默认 `0`，只能是调用方显式传入的阈值，不用 `1e-9` 吞窗口。
- 相邻段共享切点时，用切点姿态的 `overlapsStrict` 决定是否合并：真实重叠才合并；只在切点相切时保留零测度安全点。
- `t0 === t1` 退化为瞬时点查询：撞则返回 `[t0, t0]`，与 `dt>0` 的区间表达一致。
- 切点先数后建；超过 `maxCuts`（默认 `BUDGET_DEFAULTS.maxCutsPerCheck`）直接 `cut-budget`，不静默截断。
- `distance ≤ 0` 按原地不动；非法周期 / 非有限输入显式失败，不静默修复。

### 验证

- `pnpm typecheck` exit 0；`pnpm build` exit 0。
- `playability-temporal-input.test.ts`：65/65 PASS；T-55 / T-57 / T-58 / T-61 / T-62 / T-64 原样通过。
- `pnpm test`：170 files / 2616 tests passed；2 条已知 Vitest worker RPC 超时（与基线一致）。
- 一次性 dist 冒烟（未入库）：三角波端点 / 对称 / 多周期 / 折返点速度、ε、lag 方向、双窗口、切点相切不合并、切点重叠合并、`c1=0`、近速、y 不重叠、`dt=0`、负时间、切预算、非有限输入全部符合预期。正式测试矩阵由 U1-04 落地。
- `git status` 仅一个新增文件；barrel 未导出；`analyze:` / `Symbol(` / `node:fs|crypto` / `TEMPORAL_LAG_*` 零命中。

### 下游

U1-03 的两项前置（U1-01、U1-02）均已 resolved；U1-02 完成使 U1-03 进入 frontier。
