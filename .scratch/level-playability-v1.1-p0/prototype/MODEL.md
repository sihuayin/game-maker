# P0-02 最小时序模型原型说明

> ⚠️ **THROWAWAY PROTOTYPE**：不进生产包、不进 `pnpm test`、不改 `package.json`。
> 模拟器只服务算法回归，**不宣称**与真实 Runtime 等价。
> 依据：[P0-01R 裁定](../evidence/01r-ruling.md) / [P0-01 语义报告](../evidence/01-moving-hazard-semantics.md)。

## 运行

```bash
node --test .scratch/level-playability-v1.1-p0/prototype/temporal-model.test.mjs
```

Node 22 的 `node --test <dir>` 在本机把目录当模块解析，故使用精确文件路径（票面允许「等价精确路径」）。

## 问题

单个 **x 轴**移动 Hazard 是否存在玩家可等待、可通过的安全窗口；能否在不依赖离散采样假阴性的前提下给出：

- `NO_PROVEN_BLOCKER`：找到并逐段连续验证的安全轨迹（witness）；
- `PROVEN_UNPLAYABLE`：由「永久封锁门」证明给出；
- `INSUFFICIENT_EVIDENCE`：其余一切（含预算耗尽、找不到 witness、输入不确定）。

## 输入

```js
{
  world:   { xMin, xMax },                                  // 玩家左边缘可达范围
  player:  { startX, goalX, width, height, y, maxSpeed },   // maxSpeed: px/ms
  hazard:  { startX, distance, periodMs, width, height, anchorX, anchorY, y, axis: "x" },
  certainty: { phase: "known", hitbox: "known" },            // 非 known ⇒ IE
  assumptions: { verticalEvasionImpossible: true },          // PROVEN_UNPLAYABLE 的必需声明
  options: {
    lagMs,                        // 必须显式给出；一帧滞后的上界（ms）
    phaseSteps,                   // 时间步数 N，dt = periodMs / N
    xStep,                        // x 网格步长
    limits: { maxStates, timeBudgetMs },
  },
}
```

## 状态表示与搜索

- 时间离散为 `dt = periodMs / N`；第 k 步的 game-time 为 `k*dt`。
- 搜索状态 = `(x 网格点, k mod N)`；系统按 `periodMs` 周期化，因此每个 `(x, phase)` 只需访问一次。
- **等待边**：`x_{k+1} = x_k`。
- **移动边**：`|x_{k+1} - x_k| <= maxSpeed * dt`（方向任意）。
- 每条边都是一个**具体线段**：玩家左边缘在 `[k*dt, (k+1)*dt]` 内线性移动，速度 ≤ `maxSpeed`；witness 直接由这些线段组成，可执行。
- BFS 找到的第一条到达 `goalX` 的路径即 witness；BFS 耗尽只返回 `INSUFFICIENT_EVIDENCE`，**绝不**据此判不可玩。

## 连续区间判定（不是采样）

`segmentCollides`：

1. 按 hazard 折返点 `k*periodMs/2` 把玩家线段切段，使 hazard 位置 `P(t)` 在每段内线性。
2. 对每段解析求 `(x(t)+pw > hLeft(t)) ∧ (x(t) < hRight(t))` 的可行时间区间；非空即碰撞。
3. 严格 AABB：相切不算碰撞（与 Runtime 一致）。

**采样陷阱测试**专门构造「端点安全、区间内碰撞」的线段，断言连续判定能抓到，且分析器不会据此返回安全。

## 一帧滞后

- 检测位姿为 `P(t - δ)`，`δ ∈ [0, lagMs]`；`lagMs` 必须由调用方给出。
- 由于三角波是 `hazardSpeed`-Lipschitz，`P(t-δ) ∈ [P(t)-pad, P(t)+pad]`，`pad = hazardSpeed * lagMs`。
- 所有碰撞判定使用扩大后的扫掠带；这是**保守过近似**（可能多判危险，不会少判）。
- `lagMs` 缺省 / 非法 ⇒ `INSUFFICIENT_EVIDENCE`（拒绝精确帧时刻假设）。

## 证明义务

| 结论 | 允许的来源 | 不允许的来源 |
|---|---|---|
| `NO_PROVEN_BLOCKER` | BFS witness，且每个线段通过连续区间判定 | 采样点无碰撞；未经验证的候选路径 |
| `PROVEN_UNPLAYABLE` | **永久封锁门**：存在正宽度区间 `[L,R]`，hazard 在所有时刻覆盖它，且起点盒在其左、终点在其右（或反向） | 搜索超时 / 状态耗尽 / 找不到 witness |
| `INSUFFICIENT_EVIDENCE` | 未知输入、非 x 轴、不确定相位 / 命中体、缺 lagMs、预算耗尽、无 witness | — |

永久封锁门（`provePermanentGate`）：

- `L = max_T P(T) - pad - anchorX*width`
- `R = min_T P(T) + pad + (1-anchorX)*width`
- 要求 `L < R`（**正宽度**；`L == R` 时玩家可能在恰好相切的瞬间穿过，严格 AABB 下该证明不成立）。
- 起点盒 `[startX, startX+width]` 完全在 `L` 左侧、终点 `goalX` 在 `R` 右侧（或反向）。
- 玩家从起点到终点必须让盒子跨过 `(L,R)`；该区间每时每刻都被 hazard 覆盖 ⇒ 必然严格相交。
- 仅当调用方显式声明 `assumptions.verticalEvasionImpossible === true` 时才允许返回 `PROVEN_UNPLAYABLE`；否则返回 IE。

## 状态空间与时限

- 默认 `maxStates = 200_000`，`timeBudgetMs = 5_000`；结果 `stats` 记录 `xPositions`、`phaseSteps`、`dtMs`、`maxStepPx`、`statesEnqueued`、`statesVisited`、`edgesChecked`、`elapsedMs`、`budgetExceeded`。
- 超限 ⇒ `INSUFFICIENT_EVIDENCE`，`reason = "search-budget-exhausted"`。
- 墙钟只用于**搜索预算**，不参与任何物理 / 时序判断。

## 已知边界（明确不建模）

- 只支持**单个 x 轴** Hazard；y 轴、多 hazard、moving platform、danger 一律 IE。
- 不建模跳跃 / 下落 / 垂直规避；`PROVEN_UNPLAYABLE` 依赖调用方的 `verticalEvasionImpossible` 声明。
- 不建模地形 / solid；假设「已有 Spatial 分析支持的场景」。
- 命中体几何按当前 accepted pack（manifest `size` + `anchor`）假设；非当前 pack ⇒ 调用方应传 `certainty.hitbox = "unverifiable"` ⇒ IE。
- `periodMs` 是 hazard 的**往返整周期**；不使用 `danger.periodMs` 的 idle 窗口语义。
- 精确帧时刻、墙钟相位不作为判据；所有时间都是 game-time `T`。

## 测试清单（`temporal-model.test.mjs`，9 项全绿）

1. Q1 周期语义：`t=0` 在 start、`P/2` 在 start+distance、`P` 回到 start。
2. A 型：等待后通过，witness 含静止段且逐段连续验证通过。
3. B 型：永久封锁门 ⇒ `PROVEN_UNPLAYABLE`。
4. B 型缺少垂直规避声明 ⇒ IE，不得判不可玩。
5. C 型：相位 / 命中体不确定 ⇒ IE。
6. 采样陷阱：端点安全、区间内碰撞被连续判定抓到，分析器不返回安全。
7. 一帧滞后：`lagMs=0` 安全、`lagMs=100` 碰撞（扫掠带覆盖）。
8. 预算耗尽 ⇒ IE，绝不 `PROVEN_UNPLAYABLE`。
9. 缺 `lagMs` ⇒ IE（拒绝精确帧假设）。
