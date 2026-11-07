# P0-02 最小时序模型与独立原型

Type: prototype
Status: open
Owner:
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
