# P0-02R 模型健全性复核裁定

| 项 | 值 |
|---|---|
| 日期 | 2026-11-07 |
| 复核对象 | [P0-02 最小时序模型与独立原型](../issues/04-p0-02-temporal-model-prototype.md) @ `f60f486` / `703c62a`；健全性修正 @ `eb30032` |
| 复核人 | amber（HITL） |
| 裁定 | **有条件通过** |
| 条件 | ① Hitbox 来源审计；② Lag 敏感性审计（见 §3） |
| 性质 | 只产出裁定记录与原型修正，不产生产品代码 commit |

## 1. 复核发现并修正的健全性缺陷

初版 `provePermanentGate` 把 lag 扫掠带的 `pad` 加进保证覆盖区间：

```
L = maxP - pad - anchorX*w
R = minP + pad + (1-anchorX)*w
```

这是**并集**方向（hazard 可能在哪），不是不可玩证明需要的**交集**（hazard 一定覆盖哪）。反例：width 20 / travel 20 时真实交集退化为单点 `x=50`；初版报出 `[49.6, 50.4]`，而 `P=40` 时实际区间为 `[30, 50]`，`50.4` 未被覆盖。

**修正**（`eb30032`）：

- 门取所有可能位姿的**交集**，不带 lag pad：
  `L = maxP - anchorX*w`，`R = minP + (1-anchorX)*w`。
- 要求严格正宽度 `L < R`；单点门 ⇒ `INSUFFICIENT_EVIDENCE`。
- B 夹具改为 **width 60 / travel 20**，门 `[30, 70]`。
- 原 B 证据 `[49.6, 50.4]` **作废**，不再引用。
- 新增单点门、y 轴、门公式回归测试；测试 **9 → 12**，全部通过。
- 安全侧仍用并集扫掠带（覆盖 lag 的所有可能位姿）；两侧方向相反，不得混用。

## 2. 12 项复核清单

| # | 项目 | 结论 | 证据 |
|---|---|---|---|
| 1 | 玩家上界 / Hazard 占用下界 | 通过（修正后） | BFS 每步位移 ≤ `maxSpeed·dt`，是水平可达集上界；安全侧并集保守、不可玩侧交集保证 |
| 2 | 离散采样假阴性 / 采样陷阱 | 通过 | 每条 BFS 边用 `segmentCollides` 连续判定；测试 8 证明端点安全、区间内碰撞被抓住 |
| 3 | 等待 / 走 / 跳 / 落语义 | 通过（范围边界） | 建模等待与水平走；跳/落不建模；SAFE witness 只走水平路径，UNPLAYABLE 强制 `verticalEvasionImpossible` |
| 4 | 状态空间与时限 | 通过 | `phaseSteps` / `xStep` / `maxStates` / `timeBudgetMs` 显式，`stats` 全量；测试 10 断言耗尽 ⇒ IE |
| 5 | 与生产隔离 | 通过 | `git diff --stat 417f67b HEAD -- packages fixtures package.json pnpm-lock.yaml vitest.config.ts` 为空；只用 Node 内建模块 |
| 6 | 「未观察到碰撞 = 安全」 | 通过 | SAFE 只来自逐段连续验证的 witness；BFS 无解 ⇒ IE |
| 7 | 扫掠带覆盖一帧滞后 | 通过（安全侧） | 并集 `pad = speed·lagMs`；测试 9；缺 `lagMs` ⇒ IE（测试 11）。不可玩侧已改为交集 |
| 8 | 连续包络保守 | 通过 | 折返点切段后解析求交，严格 AABB；不做固定网格采样 |
| 9 | 墙钟 / 精确帧时刻 | 通过 | 物理只用 game-time `T`；`Date.now()` 只用于搜索预算；不依赖精确帧 |
| 10 | y 轴 / 非当前 pack | 通过（有条件） | y 轴 ⇒ IE（测试 6）；非当前 pack 依赖调用方 `certainty.hitbox = "unverifiable"`，P0-03 必须记录 hitbox 来源 |
| 11 | 超时误判不可玩 | 通过 | 只有封锁门能返回 UNPLAYABLE；测试 10 断言预算耗尽 ⇒ IE |
| 12 | UNPLAYABLE 的唯一来源 | 通过（修正后） | 正宽度永久封锁门 + 垂直规避声明；单点门（测试 5）、BFS 无解、预算耗尽、采样无窗口 ⇒ IE |

## 3. 有条件通过的两个附加条件

### 条件 1：Hitbox 来源审计

- 每个正式案例必须记录实际使用的 hitbox 来源，且能追溯到**当前 accepted pack**。
- 如果无法证明 hitbox 来自当前 accepted pack，**即使**输入声明 `certainty.hitbox = "known"`，该案例也**不得**作为可靠的确定性验收证据。

### 条件 2：Lag 敏感性审计

- 记录真实 Runtime `trace` 的最大帧间隔。
- 记录采用的安全余量及其依据。
- 记录最终 `lagMs`。
- 同时给出 `16.67ms` 与 `200ms` 两档 `lagMs` 的敏感性结果。
- 未满足以上记录的案例，**不得**作为确定性结论的验收证据。

## 4. 接口裁定

- 保持 `certainty.hitbox = "known" | "unverifiable"`，**不新增** `hitboxSource`。
- `known` 是分析器调用方提供的确定性声明。
- accepted pack 来源是 **P0-03 的外部证据责任**，不是模型内部可验证的事实。
- 无法证明来源时，`known` 不使案例成为可靠的确定性证明。

## 5. 解锁与执行边界

- **P0-03 可以开始**（在 P0-03a 站点就绪后），但必须落实 §3 两个条件；未落实的案例不得作为确定性结论的验收证据。
- A/B 使用真实 Phaser Runtime；C 用分析器侧证据验证降级行为。
- 不新增 harness 观察字段；不修改 Runtime、公开契约、CLI/MCP、Pipeline。
- 完成后提交证据，等待独立 P0-03R HITL 复核。

## 6. 证据与提交

- 原型：`f60f486`；算法冻结：`703c62a`；健全性修正：`eb30032`。
- 测试：

```bash
node --test .scratch/level-playability-v1.1-p0/prototype/temporal-model.test.mjs
# EXIT=0；# tests 12 / # pass 12 / # fail 0
```

- 修正后 B：`PROVEN_UNPLAYABLE`，`permanent-gate` `[30, 70]`，`statesVisited=0`。
- 修正后单点门（width 20 / travel 20）：`INSUFFICIENT_EVIDENCE`（`no-witness-found`）。
- 隔离检查：生产路径与 `package.json` 无 diff。

## 7. 最终裁定

**有条件通过。** 算法原型已达到进入真实场景验证的门槛，但尚未证明它在真实 Runtime 中可靠；P0-03 的证据必须通过 §3 的 hitbox 与 lag 审计，并由 P0-03R 独立复核。
