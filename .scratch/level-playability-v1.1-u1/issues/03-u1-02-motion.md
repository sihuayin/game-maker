# U1-02 运动原语与连续时间求交

Type: task
Status: open
Owner: —
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
