# B1 网格采样不等式的方向证明

| 项 | 值 |
| --- | --- |
| 日期 | 2026-11-09 |
| 票 | [B1](../issues/15-b1-grid-sampling-inequality.md) · Blocks [I00-R1](../issues/10-i00-r1-contract-freeze.md) |
| 分支 / HEAD | `wayfinder/level-playability-v1.1-integration` |
| 模型 | `.scratch/level-playability-v1.1-p0/prototype/temporal-model.mjs`（只读） |
| 复现 | `node .scratch/level-playability-v1.1-integration/scripts/b1-grid-sampling-probe.mjs`，EXIT=0 |
| 原始输出 | [`b1-probe.out.json`](b1-probe.out.json) |
| 修改产品目录 | **否** |

## 0. 结论

**方向没有写反，但原来那条不等式的含义被误读了。** 存在两个不同的约束：

| 约束 | 正确形式 | 方向 | 保证什么 | 违反后果 |
| --- | --- | --- | --- | --- |
| **碰撞可靠性** | 不依赖 `dt` 与 `xStep` 的关系；依赖**解析连续求交** | — | 不漏检中途碰撞 | 不适用（不是靠采样保证的） |
| **搜索可行性** | `maxSpeed · periodMs / N ≥ xStep` | **≥** | 状态图里存在移动边 | 退化为只能等待 ⇒ `INSUFFICIENT_EVIDENCE` |

用户提出的 `v · periodMs / N ≤ xStep` 方向，**只对「逐点采样 Hazard 位置」的实现成立**。P0 的 `segmentCollides` 在折返点切段后解析求交，不是逐点采样，所以那条约束既不必要，也会把能力改坏（速度越大要求采样越粗）。

关键区分：**违反 `≥` 不会产生错误结论，只会产生 IE。** 它是能力约束，不是安全约束——因此契约里应归入「能力 / 降级」条款，而不是 G-06 的安全性条款。

## 1. 反例一：采样点全安全，Hazard 中途整段穿过

配置：player 静止于 `x=1000`（盒 `[1000,1004]`）；hazard `startX=50, distance=2000, periodMs=2000, width=20, anchorX=0.5` ⇒ 速度 2 px/ms，`P(0)=50`、`P(1000)=2050`、`P(2000)=50`。

- 采样点 `t=0`：hazard 盒 `[40,60]`，安全。
- 采样点 `t=1000`：hazard 盒 `[2040,2060]`，安全。
- 中途 `t=476`：hazard 盒 `[992,1012]`，与 `[1000,1004]` 严格相交。

`segmentCollides({t0:0,t1:1000,x0:1000,x1:1000})` ⇒ **捕获**，返回 `{t:476, hazardLeft:992, hazardRight:1012}`。

这段时间内 Hazard 位移 **2000 px = 1000 个 xStep**（xStep=2），依然没有漏检。

## 2. 反例二：采样粗细不影响捕获

取「包含碰撞瞬间」的采样对齐线段，在 N = 2 / 4 / 8 / 16 下逐一检验：

| N | dt (ms) | 线段 | Hazard 每 dt 位移 | 捕获 |
| --- | --- | --- | --- | --- |
| 2 | 1000 | [0, 1000] | 2000 px | ✅ |
| 4 | 500 | [0, 500] | 1000 px | ✅ |
| 8 | 250 | [250, 500] | 500 px | ✅ |
| 16 | 125 | [375, 500] | 250 px | ✅ |

四种采样粗细下「每 dt 位移 / xStep」分别是 1000× / 500× / 250× / 125×，**全部捕获**。因此不存在「Hazard 在相邻采样之间跨过网格而漏检」的机制。

## 3. 反例三：细采样导致搜索退化

固定 `maxSpeed = 0.1 px/ms`、`periodMs = 2000`、`xStep = 2` ⇒ `N_max = 0.1 × 2000 / 2 = 100`。

| N | maxStepPx | verdict | reason | statesVisited | edgesChecked |
| --- | --- | --- | --- | --- | --- |
| 90 | 2.2222 | `NO_PROVEN_BLOCKER` | witness-found | 1720 | 5120 |
| 99 | 2.0202 | `NO_PROVEN_BLOCKER` | witness-found | 1720 | 5120 |
| **100** | **2.0000** | `NO_PROVEN_BLOCKER` | witness-found | 1720 | 5120 |
| 101 | 1.9802 | `INSUFFICIENT_EVIDENCE` | no-witness-found | 101 | 101 |
| 110 | 1.8182 | `INSUFFICIENT_EVIDENCE` | no-witness-found | 110 | 110 |

越过 `N_max` 后 `statesVisited == N`（只剩等待边），搜索完全退化。

同一现象在速度维度复现（N=200 固定）：

| maxSpeed | maxStepPx | 移动可行 | verdict |
| --- | --- | --- | --- |
| 0.02 | 0.2 | ✗ | IE（no-witness-found） |
| 0.05 | 0.5 | ✗ | IE（no-witness-found） |
| 0.10 | 1.0 | ✗ | IE（no-witness-found） |
| 0.15 | 1.5 | ✗ | IE（no-witness-found） |
| **0.20** | **2.0** | ✓ | `NO_PROVEN_BLOCKER` |
| 0.50 | 5.0 | ✓ | `NO_PROVEN_BLOCKER` |

这复现了 I00-06 的附带缺陷：固定 `N=200` 在默认 90 px/s 下 19/19 语料退化。

## 4. 为什么可靠性不依赖采样比

`segmentCollides`（`temporal-model.mjs:173-260`）的步骤：

1. 把玩家线段按 hazard 折返点 `k · periodMs/2` **切段**，使 hazard 位置在每段内线性；
2. 对每段解析求 `(x(t) + pw > hLeft(t)) ∧ (x(t) < hRight(t))` 的可行时间区间；
3. 区间非空即碰撞。

Hazard 的位置在每一时刻都是**解析精确值**，不是采样点插值。因此「两次采样之间发生了什么」根本不进入判定——判定对象是整段连续区间。唯一的数值依赖是 `EPS`，与 `dt`、`xStep` 无关。

**推论**：把 `v_hazard · dt ≤ xStep` 写进契约不会提高任何安全性；它只会要求「hazard 越快，时间采样必须越粗」，从而减少相位分辨率、降低能力。若某个实现改成逐点采样 hazard 位置，那它必须先违反 I00-05 Q6 的「实现必须解析求交」条款。

## 5. 建议冻结的条文

1. **模型下限**：`N ≥ 2`（`analyze` 的既有输入门）。
2. **移动可行性（能力约束）**：`N ≤ floor(maxSpeed · periodMs / xStep)`。审计必须在此上界内选择 `N`；若无法满足，返回 `INSUFFICIENT_EVIDENCE`，原因码建议 `grid-resolution-infeasible`。
3. **N 的选择规则**：在可行上界内取**最大** `N`（相位分辨率最高），再受 `maxStates` / `timeBudgetMs` 约束；预算耗尽 ⇒ IE。
4. **无 `≤` 方向约束**：不得要求 `v_hazard · dt ≤ xStep`。可靠性的保证来自解析连续求交，不是来自采样密度。
5. **条款归属**：第 2–3 条写进「能力 / 降级」条款，不写进 G-06 的安全性条款——因为它们只会产生 IE，不会产生错误结论。
6. **空区间**：当 `floor(maxSpeed · periodMs / xStep) < 2` 时，模型无法同时满足移动与相位分辨率 ⇒ IE。

## 6. 边界与未确认

- 本票只验证 P0 原型的语义。生产实现若改变求交方式（例如回退到逐点采样），第 4 条不再成立，必须重新论证。
- `EPS` 的具体取值属 I00-05 Q3 的容差条款，本票不重复裁定。
- 未验证「窄安全窗口落在两个采样时刻之间」的情形；按模型该情形只会导致 `INSUFFICIENT_EVIDENCE`（保守），不会导致假安全——但这是**推断**，需 I-02 用对抗用例确认。
