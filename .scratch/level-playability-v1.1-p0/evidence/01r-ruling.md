# P0-01R 语义证据复核裁定

| 项 | 值 |
|---|---|
| 日期 | 2026-11-07 |
| 复核对象 | [P0-01 移动 Hazard Runtime 增量语义核验](../issues/02-p0-01-moving-hazard-semantics.md) / [`01-moving-hazard-semantics.md`](01-moving-hazard-semantics.md) @ `4dd0ffa430218a5a6ba09d35844ad502666a3523` |
| 复核人 | amber（HITL） |
| 复核方式 | 逐条核对 E1 `file:line` / E2 测试 / E3 语料扫描；抽查 Phaser 帧序与测试（2 files / 10 tests passed） |
| 裁定 | **通过（附硬约束）**；P0-02 解锁，P0-03 仍由 P0-02R 阻断 |
| 性质 | 只产出裁定记录，不产生产品代码 commit |

## 1. 逐项裁定

| 复核项 | 裁定 | 采信内容 | 绑定约束 |
|---|---|---|---|
| Q1 六项 CONFIRMED | **可采信** | 轨迹（三角波、`periodMs` 为往返整周期、`t=0` 在 `start`）、`start` 来源 / axis / 锚点、时间推进、帧内更新与碰撞顺序、命中体几何、与 `danger.periodMs` 的区别 | 六项作为 P0-02 建模基线；三条证据边界见 §4.1 |
| Q2 一帧碰撞滞后 | **可采信** | 物理步与 overlap 回调先于 `scene.update`；hazard 碰撞位姿比渲染晚一帧；无 swept collision | 用扫掠带与连续包络覆盖；不得以瞬时几何相交证明安全或命中（§4.2） |
| Q3 y 轴 mover | **源码级采信** | 源码支持 `axis:"y"`，与 x 轴同构 | 主案例限定 x 轴；无真实 Runtime witness 时不得给确定性结论（§4.3） |
| Q4 E3 语料数字 | **有条件采信（b 方案）** | 作为辅助证据，仅支撑「当前语料几何可直接建模」 | P0-03a 必须落盘只读扫描脚本并复跑；差异必须解释（§5） |
| Q5 U1–U8 | **按修订版采信** | U1/U2/U3/U5/U6/U8 硬降级；U4 边界条件；U7 范围事实 | 见 §3 |
| Q6 术语与范围 | **不修改 `CONTEXT.md`** | 不新增 ADR；术语与 periodMs 区分记录在本文与 P0-02 约束中 | 见 §4.2 |

### 不可采信

无。

### 需补证（不阻断 P0-02）

| 项 | 缺口 | 补救与责任票 |
|---|---|---|
| E3 可复现性 | 三个只读扫描以临时 `node - <<'EOF'` 执行，数字在报告中但脚本未落盘 | P0-03a 落盘可重复执行的只读扫描脚本并复跑；新结果与原文不一致时必须解释差异，不得静默覆盖旧报告 |

## 2. 命中体与时间的采信边界

- 采信「命中体 = accepted pack 下图集帧 `StaticBody`（manifest `size` + `anchor`）」；非当前 pack 的严格命中体几何不可由审计输入复核时，降级为 `partial / INSUFFICIENT_EVIDENCE`。
- 采信「命中体坐标为 float，不做 `entityBox` 四舍五入」；模型若用 `entityBox` 采样，必须把 ≤0.5px 差异纳入包络。
- 采信「全局 game-time `T`」；`T` 是场景 `create` 起累加的平滑 delta（ms），不是墙钟。

## 3. 未确认事项分类（修订版）

| # | 原事项 | 修订分类 | 对应判据 |
|---|---|---|---|
| U1 | 隐藏页期间 `t0` 的精确行为 | **硬降级** | 任何依赖墙钟时间的判据 → `INSUFFICIENT_EVIDENCE` |
| U2 | 单帧碰撞采样的精确时刻 | **硬降级** | 任何精确帧时刻命中 / 不命中的判据 → `INSUFFICIENT_EVIDENCE` |
| U3 | 任意非当前 pack 的帧几何 == manifest | **硬降级** | 严格命中体判据 → `partial / INSUFFICIENT_EVIDENCE` |
| U4 | y 轴 mover 无语料 / 测试回归 | **边界条件**（源码已确认，非未确认） | 无 Runtime witness 时不得给确定性结论 |
| U5 | 同帧多物理步的 hits 计数 | **硬降级** | 任何依赖命中次数的判据 → `INSUFFICIENT_EVIDENCE` |
| U6 | 非 accepted pack 的动画换帧几何 | **硬降级** | 同 U3 |
| U7 | P0 scratch 站点尚不存在 | **范围事实**（非 Runtime 语义未知） | 由 P0-03a 解决 |
| U8 | 首次渲染相位 `P(delta1)` 未测量 | **硬降级** | 到达相位只能作自由变量；精确相位判据 → `INSUFFICIENT_EVIDENCE` |

## 4. P0-02 硬约束（用户裁定，已写入 P0-02 验收条件）

### 4.1 三条证据边界

1. 任何依赖**墙钟时间**的判据，一律 `INSUFFICIENT_EVIDENCE`。
2. 任何依赖**精确帧时刻**命中或不命中的判据，一律 `INSUFFICIENT_EVIDENCE`。
3. 非当前 pack 的**严格命中体几何不可确认**时，降级为 `partial / INSUFFICIENT_EVIDENCE`。

### 4.2 时间与碰撞模型

- 使用全局 game-time `T`，不得使用墙钟时间。
- 明确区分 `hazard.periodMs`（往返运动整周期）与 `danger.periodMs`（idle / 安全窗口），不得混用其语义。
- Hazard 碰撞位姿**存在一帧滞后**。
- 使用**扫掠带与连续包络**保守覆盖一帧滞后。
- **不存在 swept collision** 的 Runtime 事实不得被算法假设成存在。
- **瞬时几何相交**不能单独作为安全或命中的证明。

### 4.3 方向与范围

- P0-02、P0-03 主案例**仅支持 x 轴**移动 Hazard。
- y 轴虽然源码支持，但缺少语料和测试回归；未经真实 Runtime witness，不允许给出确定性判据。
- **Moving Platform 不进入本阶段实现范围。**

## 5. E3 交付条件（写入 P0-03a）

P0-03a 建立 scratch 站点时，必须提供**可重复执行的只读扫描脚本**，并重新记录：

- hazard 总数与 moving 数量；
- frames 数量；
- `badSize`、`badAnchor`；
- 速度区间；
- 扫描范围、输入基线 SHA 和脚本版本。

新扫描结果与 `01-moving-hazard-semantics.md` 的原数字不一致时，**必须解释差异**，不能静默覆盖旧报告。

## 6. P0-02R 必查项（写入 P0-02R 复核清单）

- 扫掠带是否真正覆盖一帧滞后；
- 连续包络是否保守；
- 是否错误使用墙钟时间或精确帧时刻；
- y 轴和非当前 pack 几何是否正确降级；
- 搜索超时是否被错误解释为不可玩。

## 7. 最终原则

**宁可多返回 `INSUFFICIENT_EVIDENCE`，也不能用未经证明的时间或碰撞假设制造 `PROVEN_UNPLAYABLE`。**

## 8. 解锁结论

- **P0-02**：解锁（open · frontier）。
- **P0-03**：仍由 P0-02R 硬阻断，不得提前进入。
- **P0-03a**：仍按原票流等待，但已追加 §5 的 E3 交付条件。
- 本裁定不授权任何生产代码、Pipeline、CLI / MCP 或公开契约修改。
