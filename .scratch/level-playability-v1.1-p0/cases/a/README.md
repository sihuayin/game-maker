# 案例 A：等待后通过（合成夹具）

> 本目录只准备配置、分析器输入与 playtest 场景；**不做 P0-03 的案例判断**。
> 绑定资源包：`fixtures/packs/last-train/v2`（manifest `sha256:145cb28d73e5723a458c2cffc7f3b362fa3009f8647ac879dad1ec819ffbd689`）。

## 场景

移动 Hazard 周期扫过通道；玩家先在带外等待，再在安全相位通过并到达终点。全程不修改既有 `fixtures/**`。

| 项 | 值 |
|---|---|
| 世界 | 1440 × 270，地面 `y=250` |
| 玩家 | `player-traveler`，出生 `(500,250)`，`speed=160 px/s`、`jumpVelocity=330`、`gravity=900` |
| Hazard | `prop-luggage-pile`（40×40，anchor `{0.5,1}`），`at=(600,250)`，`motion cycle x` / `distance=120` / `periodMs=4000` |
| 终点 | `prop-awning-steps`（56×32，anchor `{0.5,1}`），`at=(670,250)` |
| 拾取物 | `pickup-suitcase`，`at=(530,250)` |
| 官方目标 | `collect-then-reach` → `case-a-goal` |

- Hazard 几何：P(t) ∈ [600,720]（anchor x），盒足迹扫掠带 `[580,740]`；速度恒为 `2×120/4000 = 0.06 px/ms`。
- 玩家盒：宽 32、高 48；出生左边缘 484。终点盒 `[642,698] × [218,250]`。
- 分析器目标 `goalX=612`（玩家左边缘；玩家右边缘 644 与终点盒重叠 2px）。

## 分析器输入

| 文件 | lagMs | 冻结原型预期（夹具自检） |
|---|---|---|
| `analyzer-input-lag16.67ms.json` | 16.67 | `NO_PROVEN_BLOCKER`（`witness-found`） |
| `analyzer-input-lag200ms.json` | 200 | `NO_PROVEN_BLOCKER`（`witness-found`） |

⚠️ 冻结 BFS 返回的 witness 是**低速前进**（不是静止等待）；逐段连续验证通过（`verifyWitness = null`）。
真正的「等待安全窗口」由 P0-03 在真实 Runtime 中演示，并且 P0-03 必须用真实 trace 决定最终 `lagMs`。

## Runtime 场景

[`scenario/case-a.json`](scenario/case-a.json)：单 action `reach_goal`，`setup = mutate-hazard`（同值重置 `t0=0`），
断言 `won=true`、`collected>=1`、`reset=0`；期望五态 `SUCCESS`。

## 夹具冒烟（不是验收证据）

```bash
node packages/demo/probe/playtest/playtest.mjs \
  --site .scratch/level-playability-v1.1-p0/cases/a/site-out/p0-03a-case-a/site/v1 \
  --scenario-dir .scratch/level-playability-v1.1-p0/cases/a/scenario \
  --out .scratch/level-playability-v1.1-p0/cases/a/smoke-run --repeat 2 --json
```

- 退出码 0；两次 attempt 投影一致。
- 两次均 `won=true`、`reset=0`、`collected=1`、`jump=1`，步数 101/102。
- 冒烟只证明**夹具可执行**；P0-03 仍需记录 trace 最大间隔、安全余量、最终 `lagMs` 与 hitbox 来源审计。
