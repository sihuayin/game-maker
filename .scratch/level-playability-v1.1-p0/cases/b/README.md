# 案例 B：移动 Hazard 永久封锁（合成夹具）

> 本目录只准备配置、分析器输入与 playtest 场景；**不做 P0-03 的案例判断**。
> 绑定资源包：`fixtures/packs/last-train/v2`（manifest `sha256:145cb28d73e5723a458c2cffc7f3b362fa3009f8647ac879dad1ec819ffbd689`）。

## 场景

Hazard 的往返区间小于自身宽度，交集形成一条**始终被覆盖**的门；玩家从左侧出生、终点在右侧，必须穿过该门。

| 项 | 值 |
|---|---|
| 世界 | 1440 × 270，地面 `y=250` |
| 玩家 | `player-traveler`，出生 `(300,250)`，`speed=160 px/s`、`jumpVelocity=120`、`gravity=900` |
| Hazard | `hazard-sweeping-carriage`（64×48，anchor `{0.5,1}`），`at=(560,250)`，`motion cycle x` / `distance=20` / `periodMs=2000` |
| 终点 | `signal-endlight`（16×40，anchor `{0.5,1}`），`at=(700,250)` |
| 拾取物 | `pickup-suitcase`，`at=(350,250)` |
| 官方目标 | `collect-then-reach` → `case-b-goal` |

- 永久封锁门（所有可能位姿的交集，不带 lag pad）：
  `L = maxP − 0.5×64 = 580−32 = 548`，`R = minP + 0.5×64 = 560+32 = 592` ⇒ `[548,592]`，宽 44 > 0。
- 玩家起点盒 `[284,316]` 完全在门左；`goalX=670` 在门右。
- **垂直规避声明在本受控配置下成立**：`jumpVelocity=120 / gravity=900` ⇒ 单跳最大高度 `120²/(2×900)=8px`，
  而 Hazard 高 48px；没有可站立平台或绕行路线。

## 分析器输入

| 文件 | lagMs | 冻结原型预期（夹具自检） |
|---|---|---|
| `analyzer-input-lag16.67ms.json` | 16.67 | `PROVEN_UNPLAYABLE`（`permanent-gate` `[548,592]`） |
| `analyzer-input-lag200ms.json` | 200 | `PROVEN_UNPLAYABLE`（`permanent-gate` `[548,592]`） |

门按**交集**计算，lag 只会让可证明的门变窄，不会改变本例的正宽度门。

## Runtime 场景

[`scenario/case-b.json`](scenario/case-b.json)：单 action `reach_goal`，`setup = mutate-hazard`（同值重置 `t0=0`），
断言 `collected>=1`、`reset>=1`；期望五态 `AGENT_LIMITATION`。

⚠️ 有限试玩失败**只作旁证**；案例 B 的不可玩结论必须由上面的算法证明支撑。

## 夹具冒烟（不是验收证据）

```bash
node packages/demo/probe/playtest/playtest.mjs \
  --site .scratch/level-playability-v1.1-p0/cases/b/site-out/p0-03a-case-b/site/v1 \
  --scenario-dir .scratch/level-playability-v1.1-p0/cases/b/scenario \
  --out .scratch/level-playability-v1.1-p0/cases/b/smoke-run --repeat 2 --json
```

- 退出码 0；两次 attempt 投影一致。
- 两次均 `won=false`、`reset=5`、`stop.reason=reset-exhaustion`，终点从未到达；hazard 位置在 `[560,580]` 内往返。
- 冒烟只证明**夹具可执行且能取证**；P0-03 仍需记录 trace 最大间隔、安全余量、最终 `lagMs` 与 hitbox 来源审计。
