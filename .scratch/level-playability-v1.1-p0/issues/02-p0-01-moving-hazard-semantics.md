# P0-01 移动 Hazard Runtime 增量语义核验

Type: research
Status: open
Owner:
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
