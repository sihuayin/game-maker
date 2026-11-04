# 机制组合候选判据

Type: research
Status: open
Owner: —
Blocked by: 01, 02
Map: ../map.md

## Question

枚举并评估**现有 10 条机制的组合约束**中可精确判定的候选判据。输入限定为 `(GameConfig, AssetPackManifest)`；不新增机制、不改 Runtime。

### 现有机制（封闭词表）

`run` / `jump` / `gravity` / `collide-terrain` / `collect-pickup` / `moving-platform` / `hazard-contact` / `reach-goal` / `open-chest` / `avoid-danger`。

### 候选方向（不限于）

- 巡逻 `hazard` 封死唯一通路：把 hazard 当空气的可达性上界是否足够，还是需要时序/相位证据；
- `danger` 的安全窗口 vs 必经路线：能否从 `strike{periodMs,activeMs}` 与玩家速度推导「无安全窗口」；
- `moving-platform` 是 `experimental`（外壳不移动带 motion 的 solid）：是否应作为「不支持」而不是可玩性判据；
- 拾取物/宝箱被 hazard/danger 完全封死；
- 收集-到达目标（`objective: collect-then-reach`）与 gate 的激活顺序；
- 机制组合是否产生「必须在同一时机完成两件事」的不可行约束。

### 02 已确认的事实

- `moving-platform` 不在 `RUNTIME_IMPLEMENTED_MECHANICS`；`motion` 只在 hazard 分支被消费；语料 0 个 solid motion。
- hazard / danger 被 reachability 当空气；`danger` 完全没有时间相位模型。
- `body` 在 pickup / hazard / goal 上被运行时 physics 忽略（用帧尺寸 / 锚点）；语料 0 个此类覆盖。
- 机制覆盖只判存在性，不判组合；probe 只覆盖 4/10 条机制。

### 每条判据必须给出

1. 精确算法（图搜索/时间窗/相位判定），输入字段，输出形状；
2. 是否需要时序模拟；若需要，现有静态模型能否给出可靠上界；
3. 失败定位字段；
4. 误报边界与合法设计反例（例如「宽巡逻是合法设计，玩家应躲而不是跳」——前序 `fpvs-v1-p0` 票 18 的教训）；
5. 分类：`deterministic error` / `observation` / `INSUFFICIENT_EVIDENCE`；
6. 是否依赖未实现的 Runtime 语义。

### 输出

- `../research/04-mechanic-composition-judgments.md`。
- 本票 `## Answer` 摘要；更新 map 的 Decisions so far。

### 边界

- 不新增机制、不改 Runtime、不把 `moving-platform` 的伪支持修成支持。
- 不把「agent 打不过去」当不可玩证据。
- 不重开 `intent-to-mechanics-v1` 的 moving-platform 裁定。
