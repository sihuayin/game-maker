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
- **安全 witness（并集）**：所有碰撞判定使用扩大后的扫掠带；这是保守过近似（可能多判危险，不会少判）。
- **不可玩证明（交集）**：永久封锁门使用所有可能位姿的**交集**，**不带 pad**：
  `g` 对每个 `P ∈ [minP, maxP]` 都被覆盖 ⇔ `g ∈ [maxP - anchorX*w, minP + (1-anchorX)*w]`。
  lag 的不确定性只会让可证明的门**变窄**，绝不会变宽。两者方向相反，不可混用。
- `lagMs` 缺省 / 非法 ⇒ `INSUFFICIENT_EVIDENCE`（拒绝精确帧时刻假设）。

## 证明义务

| 结论 | 允许的来源 | 不允许的来源 |
|---|---|---|
| `NO_PROVEN_BLOCKER` | BFS witness，且每个线段通过连续区间判定 | 采样点无碰撞；未经验证的候选路径 |
| `PROVEN_UNPLAYABLE` | **永久封锁门**：存在正宽度区间 `[L,R]`，hazard 在所有时刻、所有可能 lag 位姿下覆盖它，且起点盒在其左、终点在其右（或反向） | 搜索超时 / 状态耗尽 / 找不到 witness / 单点门 |
| `INSUFFICIENT_EVIDENCE` | 未知输入、非 x 轴、不确定相位 / 命中体、缺 lagMs、预算耗尽、无 witness | — |

永久封锁门（`provePermanentGate`）：

- `L = max_T P(T) - anchorX*width`
- `R = min_T P(T) + (1-anchorX)*width`
- **不带 lag pad**：这是所有可能位姿的**交集**（保证覆盖），不是并集（扫掠带）。
- 要求 `L < R`（**正宽度**；`L == R` 时玩家可能在恰好相切的瞬间穿过，严格 AABB 下该证明不成立）。
- 起点盒 `[startX, startX+width]` 完全在 `L` 左侧、终点 `goalX` 在 `R` 右侧（或反向）。
- 玩家从起点到终点必须让盒子跨过 `(L,R)`；该区间每时每刻、每个可能 lag 位姿下都被 hazard 覆盖 ⇒ 必然严格相交。
- 仅当调用方显式声明 `assumptions.verticalEvasionImpossible === true` 时才允许返回 `PROVEN_UNPLAYABLE`；否则返回 IE。

> **复核修正（2026-11-07）**：初版误用 lag 并集（`pad`）计算门，会把保证覆盖区间**加宽**；
> 例：width 20 / travel 20 时真实交集退化为单点 `x=50`，初版却报出 `[49.6, 50.4]`。
> 已改为交集且不带 pad；B 案例夹具改为 width 60 / travel 20，门 `[30, 70]`。

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

## 测试清单（`temporal-model.test.mjs`，12 项全绿）

1. Q1 周期语义：`t=0` 在 start、`P/2` 在 start+distance、`P` 回到 start。
2. A 型：等待后通过，witness 含静止段且逐段连续验证通过。
3. B 型：正宽度永久封锁门 ⇒ `PROVEN_UNPLAYABLE`（width 60 / travel 20，门 `[30,70]`）。
4. B 型缺少垂直规避声明 ⇒ IE，不得判不可玩。
5. 单点门（width 20 / travel 20）⇒ 不得 `PROVEN_UNPLAYABLE`。
6. y 轴 hazard ⇒ IE。
7. C 型：相位 / 命中体不确定 ⇒ IE。
8. 采样陷阱：端点安全、区间内碰撞被连续判定抓到，分析器不返回安全。
9. 一帧滞后：`lagMs=0` 安全、`lagMs=100` 碰撞（扫掠带覆盖）。
10. 预算耗尽 ⇒ IE，绝不 `PROVEN_UNPLAYABLE`。
11. 缺 `lagMs` ⇒ IE（拒绝精确帧假设）。
12. 永久封锁门直接用交集（无 pad）计算：width 60 / travel 20 ⇒ `[30,70]`；width 20 / travel 20 ⇒ null。

## 算法冻结（2026-11-07 用户裁定）

完整裁定见 [P0-02 的 Answer](../issues/04-p0-02-temporal-model-prototype.md)。锁定规则：

1. **witness**：接受任意可执行安全路径；不修改 BFS 代价函数来迎合案例叙事；P0-03 的 A 案例单独构造「原地等待」真实 Runtime 场景。
2. **`PROVEN_UNPLAYABLE`**：只允许「正宽度永久封锁门（所有可能位姿的交集，不带 lag pad）+ 显式 `verticalEvasionImpossible` 声明」。单点门、BFS 无解、预算耗尽、采样未发现安全窗口、不能排除垂直规避——一律 `INSUFFICIENT_EVIDENCE`。
3. **`lagMs`**：P0-03 使用真实 trace 的观测最大帧间隔 + 明确余量；同时报告 `16.67ms` 与 `200ms` 两档敏感性；不得把观测最大帧间隔宣称为 Runtime 的绝对上界。
4. **接口**：输入为单一 config 对象（`certainty` / `assumptions` / `options.lagMs`）；输出为三态 + 适用时的 `witness` / `proof` / `stats`。字段语义由 JSDoc 与测试覆盖；不得改变已有三态定义。

算法找不到路 ≠ 游戏没有路。只有能证明永久封锁，才有资格判不可玩。
