# P0-02 最小时序模型与独立原型

Type: prototype
Status: resolved
Owner: agent + amber（HITL prototype）· 2026-11-07
Blocked by: 03
Map: ../map.md

## Question

在 P0-01R 冻结的语义集合内，建立**单个移动 Hazard** 的最小时间状态模型，并交付独立算法原型与单元测试。判断玩家是否存在安全通过窗口；无法证明时返回 `INSUFFICIENT_EVIDENCE`。

### 最小范围（PRD §3 P0-02）

- 一个移动 Hazard；
- 已知运动轨迹与周期；
- 已有 Spatial 分析支持的场景；
- 玩家等待与正常移动；
- 可验证的碰撞体几何。

### 必须满足的证明纪律

1. **不得**仅凭离散采样「没碰撞」就证明安全；安全结论必须有区间 / 解析覆盖，或返回 `INSUFFICIENT_EVIDENCE`。
2. 玩家能力模型必须是**上界**（速度、跳跃、走 / 落、不穿墙）；Hazard 占用必须是**下界**（不得把非占用时刻当墙，也不得把可能占用当空气）。
3. 搜索超时、状态耗尽、未知语义**一律** `INSUFFICIENT_EVIDENCE`，不得解释为 `PROVEN_UNPLAYABLE`。
4. 不改变现有三态语义；原型不接 Pipeline、不进生产包。
5. 显式定义并报告状态空间上限与单次查询时限；超过上限的处置写进报告。

### P0-01R 冻结的硬约束（2026-11-07 用户裁定）

完整裁定见 [`../evidence/01r-ruling.md`](../evidence/01r-ruling.md) §4。本票验收必须逐条满足：

**证据边界**

1. 任何依赖**墙钟时间**的判据，一律 `INSUFFICIENT_EVIDENCE`。
2. 任何依赖**精确帧时刻**命中或不命中的判据，一律 `INSUFFICIENT_EVIDENCE`。
3. 非当前 pack 的**严格命中体几何不可确认**时，降级为 `partial / INSUFFICIENT_EVIDENCE`。

**时间与碰撞模型**

- 使用全局 game-time `T`，不得使用墙钟时间。
- 明确区分 `hazard.periodMs`（往返运动整周期）与 `danger.periodMs`（idle / 安全窗口），不得混用。
- Hazard 碰撞位姿**存在一帧滞后**；必须用**扫掠带与连续包络**保守覆盖。
- Runtime **不存在 swept collision**，算法不得假设其存在。
- **瞬时几何相交**不能单独作为安全或命中的证明。

**方向与范围**

- 主案例**仅支持 x 轴**移动 Hazard。
- y 轴未经真实 Runtime witness，不得给出确定性判据。
- **Moving Platform 不进入本阶段实现范围。**

### 交付

- `prototype/` 下的 `.mjs` 模块 + `node:test` 单元测试；JSDoc 标注输入、输出、状态含义。
- 运行命令：`node --test .scratch/level-playability-v1.1-p0/prototype/`（或等价精确路径）；不修改 `package.json`、不进入 `pnpm test`。
- 模型说明：状态表示、等待边、时间展开 / 区间判定、证明义务、已知边界。
- 单测至少覆盖：
  - 存在等待后安全窗口（A 型）；
  - 始终封锁且可证明无安全路径（B 型）；
  - 相位 / 碰撞边界不可确认 → `INSUFFICIENT_EVIDENCE`（C 型）；
  - **采样陷阱**：碰撞区间落在两个采样点之间时不得判安全；
  - 超时 / 状态耗尽 → `INSUFFICIENT_EVIDENCE`。
- `## Answer`：命令、退出码、测试清单、状态空间计数、commit SHA、回退点。

### 边界

- 不处理 moving platform、多 hazard、多 danger、复杂目标组合。
- 模拟器只服务算法回归，不宣称与真实 Runtime 等价。

## Answer

**2026-11-07 完成（prototype，HITL；用户 Q1–Q4 全部采纳推荐方案）。** 原型已交付并通过 9 项单测；算法规则冻结并纳入 P0-03 验证要求。

### 产物

- [`../prototype/temporal-model.mjs`](../prototype/temporal-model.mjs) —— 三角波、连续区间碰撞、lag 扫掠带、BFS witness、永久封锁门证明
- [`../prototype/temporal-model.test.mjs`](../prototype/temporal-model.test.mjs) —— 9 项 `node:test`
- [`../prototype/MODEL.md`](../prototype/MODEL.md) —— 状态表示、等待边、时间展开、证明义务、已知边界、算法冻结

### 命令与退出码

```bash
node --test .scratch/level-playability-v1.1-p0/prototype/temporal-model.test.mjs
# EXIT=0；# tests 9 / # pass 9 / # fail 0
```

> `node --test <dir>` 在本机 Node 22 把目录当模块解析；使用精确文件路径（票面允许「等价精确路径」）。

### 结果

| 案例 | Verdict | 证据 |
|---|---|---|
| A 等待后通过 | `NO_PROVEN_BLOCKER` | 66 段 witness，31 段静止等待；`verifyWitness = null`；`statesVisited=2771`、`edgesChecked=13672`、`elapsedMs=7` |
| B 始终封锁 | `PROVEN_UNPLAYABLE` | `permanent-gate`：`[49.6, 50.4]`（lagMs=20 扫掠带）；无需搜索 |
| C 相位 / 碰撞边界不确定 | `INSUFFICIENT_EVIDENCE` | `phase-uncertain` / `hitbox-uncertain` |
| 采样陷阱 | 不返回安全 | 端点无碰撞、区间内碰撞被连续判定抓到 |
| 一帧滞后 | 不返回安全（lag 下） | `lagMs=0` 安全、`lagMs=100` 碰撞 |
| 预算耗尽 | `INSUFFICIENT_EVIDENCE` | `search-budget-exhausted`，绝不 `PROVEN_UNPLAYABLE` |

### 状态空间（A 案例）

`xPositions=99`、`phaseSteps=200`、`dtMs=10`、`maxStepPx=5`、`statesEnqueued=2832`、`statesVisited=2771`、`edgesChecked=13672`、`elapsedMs=7`、`budgetExceeded=false`。
B 由证明直接给出，`statesVisited=0`；C 在输入门直接返回。

### 算法冻结（用户 2026-11-07 裁定）

| 问题 | 裁定 | 锁定规则 |
|---|---|---|
| Q1 witness 形态 | **(a)** | 接受任意可执行安全路径；不改 BFS 代价函数；P0-03 的 A 案例单独构造原地等待场景 |
| Q2 不可玩证明 | **冻结** | 只有「正宽度永久封锁门 + 显式垂直规避声明」可判 `PROVEN_UNPLAYABLE`；单点门、BFS 无解、预算耗尽、采样无窗口、不能排除垂直规避 ⇒ 一律 `INSUFFICIENT_EVIDENCE` |
| Q3 `lagMs` | **(c) + (d)** | P0-03 记录真实 trace 最大帧间隔、采用的安全余量及理由、最终 `lagMs`；另报 `16.67ms` 与 `200ms` 敏感性；不得把观测最大帧间隔宣称为绝对上界 |
| Q4 接口 | **是** | 沿用单一 config + `certainty` / `assumptions` / `options.lagMs`；输出三态 + `witness` / `proof` / `stats`；字段语义由 JSDoc 与测试覆盖；不改三态定义 |

- Q3/Q4 要求已写入 [P0-03 A/B/C 三案例验证与真实 Runtime 对照](07-p0-03-case-validation.md)；Q2 已追加到 [P0-02R 模型健全性复核](05-p0-02r-model-review.md) 第 12 条。
- 本票不授权提前进入 P0-03，也不授权 Pipeline 集成。

### 提交与回退

- 原型提交：`f60f486` —— `P0-02: minimal temporal model prototype + tests (awaiting HITL reaction)`
- 算法冻结 + P0-03 要求：`703c62a` —— `P0-02: freeze algorithm rules and P0-03 lag requirements`
- 回退点：`git reset --hard 417f67b`（丢弃本票全部产物）；或 revert 上述提交。

### 单测清单

1. `periodMs` 往返整周期语义（`t=0` / `P/2` / `P`）
2. A 型：等待后通过，witness 含静止段并逐段连续验证
3. B 型：正宽度永久封锁门 ⇒ `PROVEN_UNPLAYABLE`
4. B 型缺少垂直规避声明 ⇒ IE，不得判不可玩
5. C 型：相位 / 命中体不确定 ⇒ IE
6. 采样陷阱：区间内碰撞被连续判定抓到，分析器不返回安全
7. 一帧滞后：`lagMs=0` 安全、`lagMs=100` 碰撞
8. 预算耗尽 ⇒ IE，绝不 `PROVEN_UNPLAYABLE`
9. 缺 `lagMs` ⇒ IE（拒绝精确帧假设）

### 下一票

[P0-02R 模型健全性复核](05-p0-02r-model-review.md)（grilling，HITL）已解锁。通过前 P0-03 保持 blocked。

### P0-02R 复核修正（2026-11-07）

复核发现初版永久封锁门误用 lag **并集**（pad）计算保证覆盖区间，会**加宽**门，属不健全证明。

- 原 B 数字 `[49.6, 50.4]` **作废**：width 20 / travel 20 的真实交集退化为单点 `x=50`，不构成正宽度门。
- 修正：门改用所有可能位姿的**交集**，不带 pad：`L = maxP - anchorX*w`，`R = minP + (1-anchorX)*w`；要求 `L < R`。
- B 夹具改为 width 60 / travel 20，门 `[30, 70]`；新增单点门、y 轴、门公式回归测试，测试数 9 → 12，全部通过。
- 修正后的原型与 `MODEL.md` 见 `prototype/`；原 Answer 其余内容仍有效。本条为复核后的记录更新，不静默覆盖原数字。
