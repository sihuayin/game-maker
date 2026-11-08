# P0-01 移动 Hazard Runtime 增量语义核验

Type: research
Status: resolved
Owner: research subagent · 2026-11-06
Blocked by: 01
Map: ../map.md

## Question

以 LP-00 报告为冻结基线，只核验**移动 Hazard 特有**的 Runtime 时序语义，产出一份「已确认 / 未确认」报告。目标不是重做全量 Runtime 审计，而是给 P0-02 的算法建模提供可引用的假设集合。

### 必须回答（逐条给 E1 `file:line`）

1. `hazardAnchor(start, distance, periodMs, elapsedMs)` 的轨迹：起点、终点、往返顺序；`periodMs` 是**单程**还是**往返整周期**；`t=0` 落在轨迹哪一点。
2. `start` 的来源：是 `entity.at` 还是 `entity.box`；`axis` 如何选；锚点 `{0.5,1}` 如何影响精灵与静态体的落位。
3. 时间推进：`scene.update(_time, delta)` 里 `h.t0 += delta` 的单位与累积；页面隐藏 / 大 delta / reset 后 `t0` 是否归零；Hazard 在玩家复位后是否继续运动。
4. 位置更新与碰撞检测的先后：`advanceHazards(delta)` 相对玩家输入、重力、Phaser Arcade 物理步与碰撞回调的顺序；是否存在「先判碰撞后移动」的一帧偏差。
5. 碰撞体：Hazard 的命中体来自图集帧还是 `entity.body`；`updateFromGameObject()` 后静态体如何跟随；当前语料 / scratch 站点中输入几何是否可复核。
6. 与 `danger` 的 `periodMs` 语义区别：hazard 的 `periodMs` 是运动周期，danger 的 `periodMs` 是安全窗口；不得混用。

### 交付

- `evidence/01-moving-hazard-semantics.md`：
  - 表格：事实 / 结论（CONFIRMED / UNCONFIRMED / 边界条件）/ 证据（E1 `file:line`，必要时 E3 scratch 实验）；
  - 「对算法建模的含义」一节：哪些事实可直接作为上界 / 下界 / 不可用；
  - 「未确认事项」清单：每条注明若无法确认，对应判据只能 `INSUFFICIENT_EVIDENCE`。
- 必要的零付费 scratch 实验（`cases/` 或 `evidence/` 下），不得修改站点或 Runtime。
- `## Answer`：命令、退出码、报告路径、commit SHA。

### 边界

- 只读 `packages/**`；不修改 Runtime、不新增机制、不接生产。
- LP-00 已明确回答的结论直接引用；LP-00 没有明确回答的**不得**写成已确认。

## Answer

**2026-11-06 核验 / 2026-11-07 落盘（research subagent，AFK）。** 只读研究：未修改 Runtime / 测试 / fixture / 历史产物；未 commit / push；零付费。

- 报告：[`../evidence/01-moving-hazard-semantics.md`](../evidence/01-moving-hazard-semantics.md)（310 行，逐条 E1 `file:line` + E2 测试 + E3 只读语料扫描）
- 本票工作提交：`4dd0ffa430218a5a6ba09d35844ad502666a3523` — `P0-01: moving hazard runtime semantics evidence`
- 基线 HEAD：`ed0c4341308ef635932c57e2d228ad3315cb8948`
- 命令 / 退出码：`npx vitest run packages/demo/tests/hazard.test.ts packages/demo/tests/shell-scene-wiring.test.ts` → 2 files / 10 tests passed / EXIT 0；E3 三个只读扫描 → EXIT 0；`git diff --stat main -- packages fixtures` 为空。
- 回退点：`git reset --hard ed0c434`（丢弃本票全部产物）。

### 六问结论

| # | 结论 | 关键事实 |
|---|---|---|
| Q1 轨迹 | **CONFIRMED** | 三角波 `start → start+distance → start`；`periodMs` 是**往返整周期**（单程 = `periodMs/2`）；`t=0` 在 `start` 并向 +axis 出发；速度恒为 `2*distance/periodMs`；所有 hazard 共享同一个全局 game-time `T`（`t0` 恒等，schema 无 phase）。`hazard.ts:14-19`、`scene.ts:61,161,271-276`、`game-config.ts:79-85` |
| Q2 start / axis / 锚点 | **CONFIRMED** | `start = entity.at` 的轴分量（不是 `e.box`）；`axis = motion.axis ?? "x"`；`{0.5,1}` 时 `at` 是底边中心，命中体底边中心沿轨迹走。`scene.ts:139,161,277-279`、`draw.ts:143-163`、`world.ts:176` |
| Q3 时间推进 | **CONFIRMED（隐藏页为边界）** | `delta` 单位 ms；`h.t0 += delta` 永不重置；delta 是 Phaser 平滑值（默认上限 200ms，失焦 clamp 16.67ms）；玩家 `hitHazard()` 只复位玩家，**不碰 hazard 时钟**；隐藏页不补帧。`scene.ts:272,355-362`、`TimeStep.js:563-585`、`Game.js:590-594` |
| Q4 更新与碰撞顺序 | **CONFIRMED** | 帧内顺序：物理步 + overlap 回调 → `scene.update`（`advanceHazards` 第一行）。⇒ 帧 N 碰撞使用 hazard 在帧 N−1 的位姿，**碰撞位姿比渲染晚一帧**；玩家 body 不滞后。`Systems.js:356-366`、`ArcadePhysics.js:142`、`scene.ts:79-82,270-280` |
| Q5 碰撞体 | **CONFIRMED（accepted pack 边界）** | 命中体 = 图集帧 `StaticBody`（`displayWidth/Height`），**不是** `entity.body`；每帧 `updateFromGameObject()`；坐标 float，不做 `entityBox` 取整；无 swept collision。当前语料 E3：19 个移动 hazard / 121 帧 / `badSize=0`、`badAnchor=0`。`scene.ts:158,279`、`StaticBody.js:56-65,171,579-596` |
| Q6 与 danger.periodMs 区别 | **CONFIRMED** | hazard `periodMs` = 往返整周期；danger `periodMs` = idle 安全窗口，完整周期 = `periodMs + activeMs`，active 在最后。hazard 在 AABB 内恒致命；danger 仅 active 致命。`hazard.ts:21-33`、`game-config.ts:90-99` |

### 对 P0-02 的最小假设与降级要求

- **可用**：1 维全局 game-time `T`；三角波闭式轨迹；命中体 = manifest `size` + `anchor` 的 AABB；接触 = 复位到出生点，无 i-frames / 无阻挡；hazard 无 idle 窗口。
- **只能作过近似**：扫掠带（`[at, at+distance]` 沿 axis 的整条带，覆盖所有相位与一帧滞后）、全相位搜索。
- **只能作下界 / 欠近似**：固定 60fps 网格采样、连续轨迹瞬时相交（Runtime 是离散 AABB 采样，无 swept collision）。
- **不可用**：墙钟时间、每个 hazard 独立 phase、把 hazard 当 solid / 有冷却、用 `danger.periodMs` 语义解释 hazard、用 `entity.body` / `e.box` 取整坐标当命中体。

### 未确认事项（均须降级为 `INSUFFICIENT_EVIDENCE`）

`U1` 隐藏页期间 `t0` 的精确行为（墙钟判据）；`U2` 单帧碰撞采样的精确时刻（精确时刻命中判据）；`U3` 任意非当前 pack 的帧几何 == manifest（严格命中体判据 → partial）；`U4` y 轴 mover 无语料 / 测试回归（实测依赖判据）；`U5` 同帧多物理步的 hits 计数（计数类判据）；`U6` 非 accepted pack 的动画换帧几何（同 U3）；`U7` P0 scratch 站点尚不存在（scratch 输入几何判据）；`U8` 首次渲染相位 `P(delta1)` 未测量（到达相位只能作自由变量）。

### 后续

下一票：[P0-01R 语义证据复核](03-p0-01r-semantics-review.md)（grilling，HITL，blocked by 02）已解锁。在用户复核裁定前，P0-02 不得启动。
