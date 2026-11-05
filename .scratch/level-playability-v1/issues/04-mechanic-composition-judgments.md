# 机制组合候选判据

Type: research
Status: resolved
Owner: research subagent · 2026-11-05
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

## Answer

研究完成 2026-11-05。报告：[04-mechanic-composition-judgments.md](../research/04-mechanic-composition-judgments.md)；零付费探针 `04-*.mjs`（均退出 0）。

### 可进确定性 error 的只有两条退化判据

| 判据 id | 精确口径 | 依赖 |
|---|---|---|
| `PLAYABILITY_MECHANIC_PATH_BLOCKED` | 目标集 `pickup + chest + gate`；把**非移动** hazard 当「不可站立禁区」（不是 solid，避免站在 hazard 顶上造成漏报）；反事实成立才报：去掉 hazard 可达、加禁区不可达 | 03 的移动图；静止 hazard |
| `PLAYABILITY_MECHANIC_PATH_NO_SAFE_WINDOW` | **单个全高 danger 墙**：spawn 与目标异侧、无绕行缝隙；最小穿越 `requiredMs = (d.box.w + player.w) / speed * 1000`；`requiredMs > strike.periodMs + 1 帧` 才报；等号附近 `INSUFFICIENT_EVIDENCE`；目标在 danger 内用单向近边 | 03 的移动图；单 danger |

### 不注册 / `INSUFFICIENT_EVIDENCE`

- 巡逻 hazard：需时间展开 / 相位可达性；把整段扫掠当实心在 1 份历史 config 上新增 4 条误报（票 18 的宽巡逻教训）。
- `moving-platform`：运行时未实现，归 `mechanic-coverage`；`solid + motion` 按静态原位处理，coverage `partial`，不产 playability error。
- pickup / chest 被 hazard / danger 包住：复位保留收集计数、同帧回调顺序不可证、语料已有关键合法样本——抑制而非判错。
- 多 danger 联合、「同一时机完成两件事」：不可证，落 `INSUFFICIENT_EVIDENCE`。
- collect-then-reach 顺序 / gate 激活：归 05，不是机制判据。

### 误报边界

- 宽巡逻是合法设计，靠「必须非移动」排除；
- hazard 当 solid 会产生漏报，必须用不可站立禁区；
- danger 当 solid 会在合法宽 idle 激光上误报，只接受单 danger + 全列切面；
- 目标在 hazard 内不报；probe 夹具必须排除出关卡语料。

### 语料

20 份唯一配对 config 中 4 份命中（3 个历史产物 + 1 个 probe 夹具）。**不能自动叫真阳性或误报**：08 必须逐案裁定，07 必须为这些案例配合法边界；**在 08 裁定前，`PATH_BLOCKED` 不得作为硬拒上线**。

### 升级 07 / 09

- 07：为 A/B、pickup-in-hazard、moving platform、多 danger 准备正例 + 合法边界。
- 08：重判 4 个命中并排除 probe 夹具。
- 09：实现非支撑禁区模型；目标集含 chest；不加 `ConfigIssue.code`、不新增 QA 判据、不读 `mechanic-coverage`、不升级既有 warning。

