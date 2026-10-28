# Harness 动作能力与观测覆盖审计（FA-01A）

- 日期：2026-10-27
- 票：`.scratch/fpvs-v1-final/issues/02-harness-action-audit.md`
- 性质：只读研究；未启动 Chrome、未改 `packages/`、`fixtures/`、`game-maker.local.json` 或历史产物。
- 证据分级：E1 = 源码/契约；E2 = 现有测试；E3 = 真实产物（历史运行）。
- 审计对象：`wasteland-scavenger-recipe` · `site/v1` · `pack/v1` · shell 2 · 上一轮真实试玩
  `success-basic`（`AGENT_LIMITATION`，collected 3/6）。

**结论先行**

1. 现有 harness 能表达“按顺序收集 + 最后到达 gate”，也能在过关后给出启动、移动、跳跃/落地、拾取、
   宝箱、目标达成的观测；但它**不能可靠表达“等待巡逻相位、避开宽范围巡逻危险物”**。
2. `jump_over` 与 `assert_state` 两个动作在契约里存在，但执行层没有实现其语义：
   `jump_over` 被直接当成 `reach_goal`/`move_to gate`，`assert_state` 是空操作 [E1：
   `packages/demo/probe/playtest/runner.mjs:248-251`]。
3. 主要缺口是**场景动作表达/策略控制不足（AGENT_LIMITATION 族）**，不是已证明的“游戏不可完成”。
   依据：静态可达性检查未报不可达 [E3：`.../run/v1/qa-report.json:13`]；真实运行 v3 曾通过第一个巡逻危险物并到达
   x=772.5 [E3：`.scratch/playtest-v1/runs/2026-10-27-ticket-08/e2e-evidence/run/v1/playtest/v3/success-basic/trace.jsonl:326`]；
   需求文档也明确“该现象目前不能直接判定为游戏本身不可玩” [E1：`docs/v7.5/demo.md:37`]。
4. **无法确认**游戏在真实玩家手中一定可通关：没有任何历史运行通过第二个巡逻危险物；也没有人工试玩证据。
   因此本审计只能把结论落在“更可能是代理/场景表达限制”，不能落在“游戏必然可通关”。
5. **另有一条更硬的静态缺口**：按声明几何，`reach_goal`/`move_to gate` 在 `x >= gate.x - 20`
   （本关 x≈1360）就停，而 gate 盒左边界是 1380、玩家右边界是 x+12，可能还差约 8px 才能触发
   `tryWin()` [E1：`policy.mjs:74`；`game-config.json:166-173`]。这是**静态推断，需 FA-02 实跑确认**；
   若成立，则即使解决危险物时机，现有动作也无法完成目标（见 §1.2.1）。

---

## 1. 动作能力

### 1.1 共享执行模型

- 动作由 `runner.mjs` 的顺序循环执行；每个动作有 `completed` / `timeout` / `failed` / `skipped`
  四种结果摘要 [E1：`packages/demo/probe/playtest/runner.mjs:240-254`]。
- `move_to` / `jump_over` / `reach_goal` 共用 `runMoveTo`：**只按住 ArrowRight**，每隔
  `scenario.stepDelayMs` 读一次状态，策略自动决定是否按 Space；到达目标或场景终止条件即完成，
  否则到**场景全局 deadline** 返回 `timeout` [E1：`runner.mjs:153-169`]。
- 键盘只有右移与跳跃：`downRight` / `upRight` / `jump` [E1：`runner.mjs:101-117`；
  `packages/demo/probe/probe-harness.mjs:320-332`]。**没有左移、刹车、定点停、按时间等待**。
- `timeout` 会 `break` 掉后续所有动作 [E1：`runner.mjs:253`]。因此一个动作可以耗尽整个场景预算，
  后面的动作被记为 `skipped`。上一轮 `success-basic` 就是这样：`result.json` 里只有 `move_to`，
  `wait_until` 没有执行 [E3：`.scratch/playtest-v1/runs/2026-10-27-acceptance/artifacts/wasteland-scavenger-recipe/run/v1/playtest/v1/result.json:121-127`]。
- 场景/站点身份不匹配时在加载期拒绝，不伪装成执行 [E1：`runner.mjs:52-75`]。

### 1.2 逐动作

| 动作 | 契约 | 实际执行 | 终止/失败 | 目标表达 |
|---|---|---|---|---|
| `move_to` | `{kind:"move_to", target:{kind:"gate"} \| {kind:"pickup", index}}` [E1：`packages/contracts/src/playtest.ts:335-339`] | `runMoveTo`，持续右移 + 策略自动跳 [E1：`runner.mjs:153-169`] | 目标达成或 `termination` 达成 → `completed`；全局 deadline → `timeout` [E1：`runner.mjs:161-165`] | 语义 kind；gate 无参数；pickup 只认**数组下标** [E1：`packages/demo/probe/playtest/policy.mjs:71-80`] |
| `jump_over` | `{kind:"jump_over", target:{kind:"hazard", index}}` [E1：`playtest.ts:340`] | **未实现**：直接调用 `runMoveTo({target:{kind:"gate"}})`，`action.target` 被丢弃 [E1：`runner.mjs:249`] | 与 `move_to gate` 相同 | hazard index 只是 schema 字段，运行时不读 |
| `wait_until` | `condition` 只能是 `{kind:"won"}` 或 `{kind:"collected", value}`，另有 `timeoutMs` [E1：`playtest.ts:341-344`] | 松开方向键、原地轮询；条件成立 → `completed`，否则到动作 timeout → `timeout` [E1：`runner.mjs:171-184`] | 动作 timeout 或全局 deadline；`timeout` 后后续动作跳过 [E1：`runner.mjs:253`] | 只有 won / collected 两种条件；**没有时间、位置、危险物相位、玩家 x 条件** |
| `reach_goal` | 无参数 [E1：`playtest.ts:345`] | 与 `move_to gate` 完全相同 [E1：`runner.mjs:248`] | 到 gate（x ≥ gate.x - 20）或 `termination` [E1：`policy.mjs:74`] | 固定 gate |
| `assert_state` | `{kind:"assert_state", assertionId}`，schema 校验该 id 存在 [E1：`playtest.ts:346,388-391`] | **空操作**：直接返回 `completed` [E1：`runner.mjs:251`] | 不会失败，也不会在动作点求值 | 只有 assertionId，没有动作点断言语义 |

补充：

- `move_to pickup` 的完成条件是“该下标的 pickup **已经 inactive**（或下标越界）”
  [E1：`policy.mjs:75-78`]。因此它只能作为“收集到第 N 个地面 pickup”的停点；
  **不能以宝箱、坐标、实体 id 为目标**。⚠️ 下标没有存在性校验：越界时 `!p` 直接视为已到达，
  场景会立即 `completed`；本关只有 4 个地面 pickup，写 `index:4` 是静默空操作。
- `reach_goal` / `move_to gate` 到达 gate 时，如果 `collected < pickupCount`，`tryWin()` 静默不置胜
  [E1：`packages/demo/src/shell/scene.ts:361-366`]。由于没有左移，未收集全就到达 gate 是**不可回退**的。
- `jump_over` / `reach_goal` / `assert_state` 在现有测试中没有行为测试；契约测试只覆盖
  `move_to` + `wait_until` 形状 [E2：`packages/contracts/tests/playtest.test.ts:310-327`；
  `packages/demo/probe/playtest/tests/observe.test.mjs:17`]。

### 1.2.1 gate 停点的静态缺口（需 FA-02 实跑确认）

这是一条独立于“危险物时机”的缺口，可能在危险物问题解决后仍然阻止通关：

- `targetReached` 的 gate 判定是 `st.x >= st.gate.x - 20` [E1：`policy.mjs:74`]；
  `runMoveTo` 一旦满足就立刻返回 `completed`，不再按右 [E1：`runner.mjs:161-168`]。
- 本关 `exit-gate` 的 `at.x = 1380`，资源是 `wasteland-platform-tile`，尺寸 32×32、锚点 `{x:0,y:0}`
  [E1：`game-config.json:166-173`；`.../pack/v1/manifest.json:337-351`]；按 `entityBox` 的公式，
  gate 盒左边界 = 1380 [E1：`packages/contracts/src/game-config.ts:132-138`]。
  场景层用的是同一个盒子 [E1：`packages/demo/src/world.ts:173-187`]。
- 玩家盒子宽 24、锚点 `{x:0.5,y:1}` [E1：manifest 同上]；trace 实测 `x=40` 时 `left=28/right=52`，
  即 `right = x + 12` [E3：`.../success-basic/trace.jsonl:1`]。
- 因此在停点 `x≈1360` 时，玩家右边界约 1372，gate 左边界 1380，**静态相差约 8px**；
  按几何不会触发 `tryWin()` 的 overlap [E1：`scene.ts:163-170,361-366`]。
- 之后 `wait_until won` 不会按方向键 [E1：`runner.mjs:171-184`]，玩家无法再向前 8px。
- 现有动作里没有“继续向右但不以 gate 为停点”的动作：`move_to gate`/`reach_goal`/`jump_over`
  都走同一个停点；`move_to pickup[index]` 的四个 pickup 都在 gate 左侧（x≤1052）
  [E1：`game-config.json:36-164`]；越界下标会立即 `targetReached` [E1：`policy.mjs:75-78`]。
- `READ_STATE` 的 `gate` 只暴露 sprite 的 `x/y`，不暴露静态体左边界 [E1：
  `probe-harness.mjs:231`]；因此以上是**按声明几何的静态推断**。FA-02 实跑时应读取 gate 静态体
  边界或观察是否真的 `won=true`，不能把推断当事实。
- 如果实跑确认这 8px 缺口，则**即使六件全部收集，现有 `reach_goal` / `move_to gate` 也可能无法通关**；
  同时 `gateReached` 会在 x=1360 置真，`won` 断言随后 fail，误触发 `GAMEPLAY_FAILURE`
  （见 §2.3）。这不是游戏不可完成，而是 harness 停点阈值与 gate 盒不一致的确定性缺口。

### 1.3 目标如何表达

- 只有**语义 kind + 下标**：`gate`（无参数）、`pickup[index]`、`hazard[index]`（未实现）。
- **没有**实体 id 目标、坐标目标、宝箱目标、平台目标、危险物相位目标、巡逻安全窗口目标
  [E1：`playtest.ts:335-347`]。
- pickup 的下标顺序来自 `READ_STATE` 的 `pickups` 数组顺序，也就是 config 实体顺序
  [E1：`probe-harness.mjs:227`；`game-config.json:36-164`]。顺序一旦变化，场景下标就漂移。

### 1.4 四个具体表达需求

| 需求 | 能否表达 | 依据 |
|---|---|---|
| 避开宽范围巡逻危险物 | **不能可靠表达** | 没有“等待安全相位/停在某处”的动作；`jump_over` 的 hazard 目标被忽略；策略只在 `phase < 0.5` 时主动跳，且 `pickupAbove` 等条件会绕过它 [E1：`policy.mjs:56-68`] |
| 上平台取物 | **部分可以** | 用 `move_to pickup index` 让策略自动爬平台；真实产物已收集 platform-1 上的 pickup 并打开 chest-1 [E3：`.../success-basic/events.jsonl:20-22`；trace 中 bottom=190 的落台状态] |
| 等待时机 | **不能** | `wait_until` 只有 `won` / `collected` 两种条件，且原地不动；没有按时间、按危险物相位、按 x 位置的等待 [E1：`playtest.ts:341-344`；`runner.mjs:178-179`] |
| 先收集再到达 gate | **可以按顺序表达，但不能回退/补漏** | pickup 从 x=220 到 x=1052 全部在 gate 左侧；四个 `move_to pickup` 检查点 + `reach_goal` 即可表达顺序。但宝箱没有目标；漏掉 chest-2 后无法回头 [E1：`game-config.json:36-173`；`policy.mjs:75-78`] |

### 1.5 策略为什么会撞上巡逻危险物（关键）

- 危险物是三角波：`start → start+distance → start`，周期 `periodMs` [E1：`packages/demo/src/hazard.ts:14-19`]。
  本关 patroller-1：起点 x=340，distance=100，periodMs=3000 [E1：`game-config.json:46-60`]；
  patroller-2：x=720，distance=120，periodMs=3500 [E1：`game-config.json:101-115`]。
- 策略只在“危险物在前方 100px 内、y 相近、且 phase < 0.5（向右远离玩家）”时跳
  [E1：`policy.mjs:56-64`]；`phase >= 0.5`（向左朝玩家来）时**不跳也不等**，继续右移。
- 更关键的是 `pickupAbove`：只要前方 130px 内有高于脚下 20px 的 pickup，就无条件触发跳跃
  [E1：`policy.mjs:65-68`]。本关 scrap-2 在 x=466、y=150（平台上方）[E1：`game-config.json:91-99`]，
  会在玩家约 x=336 时触发跳跃，正好落在 patroller-1 的巡逻区（340–440）；
  scrap-3 在 x=850、y=200（chest-2 上方）[E1：`game-config.json:118-135`]，会在玩家约 x=720 时触发跳跃，
  正好落在 patroller-2 的巡逻区（720–840）。这解释了为何自动跳跃会“主动”进入危险区。
- 真实产物佐证：上一轮 45 秒运行有 10 次 `reset`、55 次 `jump`、54 次 `land`，最终 collected 3/6，
  `hits=0`（`hits` 只统计 `danger`，不统计巡逻 `hazard`）[E3：`.../result.json:105-147`]。
  另一个真实运行 v3 曾通过 patroller-1 到达 x=772.5，随后在 patroller-2 附近 reset
  [E3：`.../v3/success-basic/trace.jsonl:326-327`；`.../v3/success-basic/events.jsonl:28`]。

> 计算旁注（E1 推导，不是运行证据）：默认 `speed=90`、`jumpVelocity=330`、`gravity=900`
> [E1：`packages/contracts/src/game-config.ts:115`]，跳跃顶点 60.5px、同高滞空 0.733s、水平跨度 66px。
> 越过 32px 高的危险物时，脚底高于其顶部的窗口约 0.503s、水平约 45.3px；而玩家 24px + 危险物 24px
> 需要约 48px 的完整分离 [E1：manifest 尺寸 `.../pack/v1/manifest.json:208-232,308-326`]。
> 静止危险物单跳清不过去；只有危险物向右远离（phase < 0.5）时才有约 33px 额外余量。
> 这说明“相位”不是装饰，而是通关的必要条件；现有动作语言没有表达它的入口。

---

## 2. 观测面

### 2.1 READ_STATE 与持久化快照

`READ_STATE` 返回 [E1：`packages/demo/probe/probe-harness.mjs:207-235`]：

- 玩家：`x/y/bottom/top/left/right/width/height/vx/vy/onFloor/blockedRight/touchingRight`
- 进度：`collected/won`
- 实体：`pickups[{x,y,active,visible}]`、`hazards[{x,y,axis,distance,periodMs,t0}]`、
  `chests[{x,y,opened}]`、`dangers[{x,y,state,hits}]`、`gate{x,y}`
- 几何：`solids[{x,y,w,h}]`、`scrollX`

但落盘的 `trace.jsonl` 经过 `snapshotOf` 裁剪 [E1：`packages/demo/probe/playtest/observe.mjs:8-21`]：

- 保留：`x,y,bottom,left,right,vx,vy,onFloor,blockedRight,touchingRight,collected,won,pickups{x,y,active},hazards{x,y},chests{x,y,opened},dangers{x,y,state,hits},gate,scrollX`
- **丢弃**：`top/width/height`、`pickup.visible`、`hazard.axis/distance/periodMs/t0`、`solids`。

影响：

- 事后无法从 trace 直接重建危险物的巡逻参数/相位，只能从 `hazards.x` 序列反推；
- 无法从 trace 直接核对平台/碰撞体几何（需要回看 config）；
- `trace` 是状态快照，不是输入轨迹；`input.jsonl` 才是实际按键 [E1：
  `packages/demo/probe/playtest/README.md:32-34`]。

### 2.2 11 类事件

闭集定义 [E1：`packages/contracts/src/playtest.ts:43-57`；`observe.mjs:23-26`]：

| 事件 | 触发（状态差） | 证据性质 |
|---|---|---|
| `scene-ready` | 第一次读到状态 | 直接/轮询 |
| `spawn` | 第一次读到状态 | `inferred:true`，与 scene-ready 同点 |
| `pickup` | pickup `active:true → false` | 轮询；同窗口多个时 `ambiguous:true` |
| `win` | `won:false → true` | 轮询 |
| `chest-open` | chest `opened:false → true` | 轮询 |
| `danger-hit` | `dangers[i].hits` 增加 | 轮询；**只对 `danger` 实体，不对 `hazard`** |
| `danger-erupt` | danger `idle → active` | 轮询 |
| `land` | `onFloor:false → true` | `inferred:true` |
| `jump` | `onFloor:true → false` | `inferred:true` |
| `reset` | x 突降 >150、靠近 spawn、prev.x > spawn+100 | **启发式**，没有 hazard 身份 |
| `runtime-error` | CDP console error / exception | `source:"cdp"` |

本关只有 `kind:"hazard"`，没有 `kind:"danger"` [E1：`game-config.json:46-60,101-115`]，
所以 `danger-hit` / `danger-erupt` 计数恒为 0；巡逻危险物的接触只能通过 `reset` + trace 位置间接判定
[E1：`observe.mjs:104-115`]。`reset` 的唯一来源是 `hitHazard()` [E1：`scene.ts:343-359`]，
因此 `reset` 是“发生过危险接触/复位”的强间接证据，但不能说明是哪一个 hazard（`actor:null`）。

### 2.3 断言三值与证据门控

- 结果只有 `pass` / `fail` / `unknown`；场景聚合规则：任一 fail → fail；否则任一 unknown → unknown；
  全 pass → pass；没有断言 → unknown [E1：`packages/contracts/src/playtest.ts:143-148`]。
- `unknown` 的来源 [E1：`observe.mjs:167-201`]：
  - 轮询出现 `state-unreadable` 间隙（`poll-gap`）；事件断言在 `op !== gte` 时即使计数已满足也降为 unknown；
  - 否定条件不可判（`negative-not-judgeable`）：例如未到 gate 时 `won=false` 不能判 fail；
    `collected` 只有在 gate 到达且所有地面 pickup inactive 时才可判否定。
- `onInsufficient` 在 schema 里被写死为字面量 `"unknown"` [E1：`playtest.ts:330-331`]，
  执行层没有读取它；作者不能把“证据不足”改判成 pass/fail。它是声明，不是开关。
- `withinMs` 只被写进报告，**没有被执行层用来限定断言窗口** [E1：`observe.mjs:173`；
  全仓 `withinMs` 没有比较逻辑]。
- `requires` 也只是元数据；断言求值并不检查所依赖的观测是否存在 [E1：`observe.mjs:169-173`]。
- 断言路径只有 `collected/won/hits/chestsOpened/activePickups/initialActivePickups`
  [E1：`playtest.ts:298-299`；`observe.mjs:146-154`]。没有 `playerX`、`onFloor`、平台/坐标路径。
- 归因侧：SUCCESS 要求 `terminationReached` + 至少一条断言 + 全部 pass + 零 runtime-error
  [E1：`packages/contracts/src/playtest-attribution.ts:149-157`]。
- **归因陷阱**：如果玩家到达 gate 但 `collected < pickupCount`，`won` 断言会 fail
  （`judgeableNegative` 对 `won` 只看 `gateReached`）[E1：`observe.mjs:156-165`]，
  归因规则 ④ 会把“gate 到达 + won=false”判成 `GAMEPLAY_FAILURE`
  [E1：`playtest-attribution.ts:145-147`]。而漏捡宝箱可能是代理限制，不一定是游戏缺陷。
  草案因此需要在 gate 前加“集齐守卫”，见 §5。

### 2.4 trace / input 粒度

- `trace.jsonl`：每次 `readState` 一条，循环间隔为 `scenario.stepDelayMs`（默认 35ms）
  [E1：`runner.mjs:156-164,171-181`]。报告里的 `runtime.pollIntervalMs` 固定写 50
  [E1：`runner.mjs:320`]，但 `scenario.pollIntervalMs` 实际没有被使用；真实采样间隔是
  `stepDelayMs`。`runtime.viewport` 固定写 `1000x600` [E1：`runner.mjs:322`]，而本关实际视口是
  `480x270` [E1：`packages/demo/src/draw.ts:15`；E3 console 日志]。
- `input.jsonl` 只有 `keyDown/keyUp + key/code/t/seq/source`；`source` 是动作 kind 或 `cleanup`
  [E1：`playtest.ts:113-122`；`runner.mjs:101-117`]。`wait_until` / `assert_state` 不发按键，
  因此 input 里没有它们的边界记录；动作边界只能看 `result.json` 的 `actions` 摘要。
- 事件 `frame` 恒为 `null` [E1：`observe.mjs:62-64`]；没有逐帧证据。
- 35ms 轮询可以覆盖 0.733s 的跳跃，但事件仍是“状态差”而不是逐帧观测；同一窗口内的跳跃+落地
  可能合并，事件载荷用 `inferred` / `ambiguous` 标注 [E1：`observe.mjs:1-6,111-112`]。

### 2.5 七个验收维度逐项判断

| 维度 | 结论 | 直接/间接 | 关键观测 | 真实产物现状 |
|---|---|---|---|---|
| 启动 | **可证明** | 直接 | `scene-ready` + `spawn` + `setup.json` + console/exceptions；boot 失败记 not-executed [E1：`runner.mjs:190-208`] | 上一轮：scene-ready=1、spawn=1、无异常 [E3：`.../events.jsonl:1-2`；`exceptions.json` 为空] |
| 玩家移动 | **可证明** | 直接 | `trace.x` 随时间增加 + `input` 的 ArrowRight [E1：`probe-harness.mjs:218-221`；`runner.mjs:104-117`] | 上一轮 x 从 40 到约 407，input 113 行 [E3：`trace.jsonl`；`input.jsonl`] |
| 跳跃与落地 | **可证明（间接）** | 状态差 | `jump` / `land`（`inferred:true`）+ `trace.onFloor/vy/bottom` [E1：`observe.mjs:111-112`] | 上一轮 jump 55、land 54 [E3：`.../result.json:143-144`] |
| 收集物 | **可证明** | 直接 | `pickup` 事件 + `pickups.active` + `collected` [E1：`observe.mjs:87-95`] | 上一轮 pickup=2、collected=3（含 chest-1） [E3：`.../result.json:105-110,138`] |
| 宝箱 | **可证明** | 直接 | `chest-open` + `chests.opened` + `collected` [E1：`observe.mjs:97-100`] | chest-1 已开（chestsOpened=1）；chest-2 未到，未观测 |
| 危险物 | **可间接证明“接触/复位”** | 间接 | `reset` 事件 + trace 中 hazard 位置；`hits` 只对 `danger`，本关恒 0 [E1：`observe.mjs:104-115,127,215`] | 上一轮 reset=10、hits=0 [E3：`events.jsonl:7-123`]；可证明发生过复位，不能直接说明是哪一个 hazard |
| 游戏目标 | **达成时可证明** | 直接 | `win` 事件 + `won` + `gate`；gateReached 用 x≥gate.x-20 [E1：`observe.mjs:102,130,210-220`] | 上一轮未达成（won=false）；v3 也未达成 |

结论：观测面足以证明“通关事实”和启动/移动/拾取/宝箱/复位；**不足以直接证明“成功躲避了哪一个危险物”**，
也没有 `hazard-hit` 事件。若一次运行 0 次 reset 且 won=true，可以间接主张成功躲避，但需要 trace 佐证；
若有 reset，FR-02 的“接触、重置”证据是成立的 [E1：`docs/v7.5/demo.md:151`]。

---

## 3. 场景契约

### 3.1 `playtest-scenario/v1` 是否允许新增验收通关场景

**允许，不需要改协议。** `PlaytestScenarioSchema` 是通用 schema，没有“五态专用”字段或 id 白名单
[E1：`packages/contracts/src/playtest.ts:357-393`]。新增场景只要满足：

- `formatVersion: "playtest-scenario/v1"` [E1：`playtest.ts:357-358`]
- `id` / `version` / `expectedOutcome` / `baselineEligible` / `target.siteVersion`
- `actions` ≥ 1、`assertions` ≥ 1、`termination`、`timeoutMs`
- 其余字段有默认值：`required` 默认 true、`harnessCondition` 默认 none、`setup` 默认 none、
  `pollIntervalMs` 默认 50、`stepDelayMs` 默认 35、`comparableEvents` 默认 `["pickup","win"]`
  [E1：`playtest.ts:357-381`]

加载层只校验格式版本、schema、`target.siteVersion`，不按文件名/目录区分场景用途
[E1：`runner.mjs:52-75`]。因此“验收通关场景”可以作为 v1 场景存在，无需扩展协议。

### 3.2 `target.siteVersion` 如何绑定

- 场景只写 `target.siteVersion` [E1：`playtest.ts:365-366`]；加载时与目标 site 目录名 `v<N>` 比对，
  不匹配进 `rejections` [E1：`runner.mjs:33-48,69-72`]。
- 运行时报告身份还会写入 `siteVersion / packId / packVersion / packChecksum / configChecksum /
  shellVersion / harnessVersion / rulesVersion` [E1：`runner.mjs:300-312`]；写回层再与当前
  `delivery` 的 site/pack/config 身份比对，不匹配拒写 [E1：`packages/pipeline/src/playtest.ts:51-63`；
  `packages/contracts/src/delivery.ts:327-331`]。
- 本关冻结对象是 `site/v1`、`pack/v1`、shell 2；场景写 `siteVersion: 1`。注意：`target.siteVersion`
  本身是粗绑定，真正的字节身份靠报告的 checksum 与写回校验。**FA-01 快照尚未生成**，本审计无法验证
  快照哈希；场景绑定应在 FA-01 完成后再落到快照的工作区。

### 3.3 场景放哪、CLI 如何选中

- harness 本身支持任意目录：`playtest.mjs --scenario-dir <目录>`，默认
  `scenarios/five-state` [E1：`packages/demo/probe/playtest/playtest.mjs:17,40`]。
  因此 `.scratch/fpvs-v1-final/scenarios/` 可以被 harness 直接运行。
- **CLI 不能选**：`game-maker playtest <run>` 只接受 run 目录，没有 `--scenario-dir`/`--scenario`
  [E1：`packages/cli/src/cli.ts:758-765`]；内部 `SCENARIO_DIR` 硬编码为
  `packages/demo/probe/playtest/scenarios/five-state` [E1：`packages/cli/src/playtest.ts:23`]，
  并且只选 `harnessCondition === "none"` 且 `required === true` 的场景 [E1：
  `packages/cli/src/playtest.ts:109-122`]。
- CLI 会把选中的场景复制到临时目录再跑 harness，然后做归因与写回 [E1：
  `packages/cli/src/playtest.ts:325-368`]。所以：
  - **想通过 CLI 产生 `delivery` 写回**：验收场景必须被 CLI 选中；按当前代码，只能在五态目录里且
    `required:true`（这会违反 FA-02 “不混入五态自测目录”）。
  - **放在本 effort 的 `scenarios/`**：只能直接跑 `playtest.mjs`，得到原始观测报告；CLI 不会做归因、
    不会写 `delivery.playtest`。这是**工具/选择面缺口**，不是协议缺口。

### 3.4 `expectedOutcome` / `baselineEligible` / `required` 怎么设

- `expectedOutcome`：场景**设计意图**，不参与归因（归因器明确不吃它）[E1：
  `packages/contracts/src/playtest-attribution.ts:3`；`playtest.ts:196-197`]。验收场景设
  `"SUCCESS"` 只表达意图，不会让失败被写成成功。
- `baselineEligible`：当前代码只做 schema 校验和报告转抄 [E1：`playtest.ts:198,364`；
  `runner.mjs:85,268`]；基线比较按 `scenarioId` 查
  `fixtures/playtest-baselines/<id>/baseline.json`，**不检查 `baselineEligible`**
  [E1：`packages/cli/src/playtest.ts:229-242`]。验收场景没有基线文件，所以设 `false` 最干净；
  它目前不会自动阻止或触发比较。
- `required`：
  - harness 执行层不看 `required`；它只被记录进报告 [E1：`runner.mjs:371-374`；`playtest.ts:361`]。
  - CLI 只看 `required:true` 的场景 [E1：`cli/src/playtest.ts:116-117`]；`required:false` 会被 CLI 跳过。
  - 交付聚合里 `mapPlaytest` 会用 `required` 判断“必需场景未执行 ⇒ blocked” [E1：
    `playtest.ts:493-495`]；`playtest` 摘要 schema 也要求 pass 时所有 required 场景 executed+SUCCESS
    [E1：`delivery.ts:217-220`]。
- 为了**不污染五态自测**：验收场景放本 effort 的 `scenarios/`，`required:false`、
  `baselineEligible:false`、`harnessCondition:"none"`，用 harness 直接跑；不要放进五态目录。
  如果后续要进 CLI 交付链，需要显式工具变更（见 §4.3），而不是把场景塞进五态。

---

## 4. 缺口分类

### 4.1 场景表达/动作语义缺口（主因）

0. **gate 停点与 gate 盒相差约 8px（静态推断，需实跑确认）**：`targetReached` 在
   `x >= gate.x - 20` 就停，而 gate 盒左边界是 1380、玩家右边界是 x+12；x=1360 时还差约 8px
   [E1：`policy.mjs:74`；`game-config.json:166-173`；`entityBox`/manifest 尺寸]。现有动作没有
   “越过 gate 停点继续向右”的入口；见 §1.2.1。这是最优先要确认的确定性缺口。
1. **没有等待/相位/位置条件**：`wait_until` 只有 won/collected [E1：`playtest.ts:341-344`]，
   没有“等到 patroller phase < 0.5”“等到玩家 x=...”“等待 N ms”。
2. **`jump_over` 目标未实现**：schema 有 hazard index，执行层当 `reach_goal` [E1：`runner.mjs:249`]；
   不能做“靠近某 hazard 再跳”的定点动作。
3. **`assert_state` 未实现**：动作点不求值 [E1：`runner.mjs:251`]；断言只在场景结束时按累计
   max/最终值求值 [E1：`observe.mjs:167-201`]。因此不能证明“在平台上”“拾取 1 之后、宝箱 1 之前”等时序。
4. **没有左移/刹车/定点停**：只有 ArrowRight + Space [E1：`runner.mjs:101-117`]；漏捡后不能回头。
5. **没有宝箱/实体 id/坐标目标**：`move_to` 只有 gate 或 pickup index [E1：`playtest.ts:335-339`]。
6. **策略交互缺陷**：`pickupAbove` 会在危险区前无条件触发跳跃 [E1：`policy.mjs:65-68`]，
   正好与本关 scrap-2/scrap-3 的位置叠加 [E1：`game-config.json:91-135`]；这是自动玩家反复 reset 的直接原因。

### 4.2 观测面缺口（次要，但影响证明措辞）

1. 没有 `hazard-hit` 事件；巡逻危险物接触只能由 `reset` + trace 间接判定 [E1：`observe.mjs:104-115`]。
2. `endState.hits` 只统计 `danger`，本关恒 0，不能当作“没接触过危险物”的证据 [E1：`observe.mjs:127,215`]。
3. trace 丢弃 hazard 的 `axis/distance/periodMs/t0` 与 `solids` [E1：`observe.mjs:8-21`]；
   事后无法直接复算相位或平台几何。
4. `withinMs` / `requires` / `onInsufficient` 都不被执行层强制 [E1：`observe.mjs:169-173`；
   `packages/contracts/src/playtest.ts:330-331`]；
   断言窗口和依赖是声明性的。
5. `reset` 是启发式事件（x 突降 + 靠近 spawn + prev.x > spawn+100）[E1：`observe.mjs:114-115`]；
   靠近 spawn 的复位可能漏记。
6. 报告 `runtime.pollIntervalMs=50`、`viewport=1000x600` 是硬编码；实际采样约 35ms、实际视口
   480×270 [E1：`runner.mjs:320-322`；`draw.ts:15`]。这会影响证据可复核性，但不影响动作语义。

### 4.3 工具/选择面缺口

- CLI 硬编码五态目录、只收 required:true；本 effort 的验收场景无法被 CLI 选中，也就无法通过
  `game-maker playtest` 写回 `delivery.playtest` [E1：`cli/src/playtest.ts:23,109-122`；
  `cli.ts:758-765`]。
- 这不是协议缺口：场景契约允许任意目录；是 CLI 没有暴露场景目录/选择参数。

### 4.4 归因风险

- “到 gate 但漏捡”会触发 `won` 断言 fail → 归因规则 ④ `GAMEPLAY_FAILURE`
  [E1：`observe.mjs:156-165`；`playtest-attribution.ts:145-147`]。这会把代理漏捡误判成游戏缺陷。
- 本关 chest-2 没有目标动作；如果策略跳过 chest-2，玩家无法回头，最终可能到 gate 但 collected=5。
  这是 FA-02 需要特别避免/记录的误归因风险。

### 4.5 是“场景表达不足”还是“游戏不可完成”

- **不是已证明的“游戏不可完成”**：
  - 静态可达性检查（把 hazard 当空气、只报不可达）没有报错 [E1：`reachability.ts:15-20,124-129`；
    E3：`qa-report.json:13` 且 failures 只有两条 visual warning]；
  - 平台高度 50px < 跳跃顶点 60.5px [E1：`game-config.json:63-79`；`game-config.ts:115`]；
  - v3 真实运行曾通过 patroller-1，到达 x=772.5 [E3：trace/events 上引]；
  - 需求文档明确说该现象不能直接判定游戏不可玩 [E1：`docs/v7.5/demo.md:37`]。
- **也不能确认“人类一定可通关”**：没有人工试玩证据；patroller-2 从未被通过；以上只是“不可完成未被证明”。
- 还存在一条 **harness 停点缺口**（§1.2.1，静态推断）：gate 停点可能比 gate 盒早约 8px。
  它同样不是游戏不可完成，而是执行层阈值与盒几何不一致；需要实跑确认后按缺陷修复流程处理。
- 因此分类为：**场景动作表达/代理控制不足（AGENT_LIMITATION 族）+ harness 确定性停点缺口**，
  而不是 GAMEPLAY_FAILURE；若最终无法取得通关，应按证据记 `AGENT_LIMITATION` / `TIMEOUT` / `incomplete`，
  不能升级成游戏缺陷。

### 4.6 最小可行方案

| 方案 | 是否改协议 | 能否真正提高通关概率 | 备注 |
|---|---|---|---|
| A. 仅用现有动作 + 更长 timeout，靠当前策略碰运气 | 否 | 低/不可复现 | v3 只通过 patroller-1；45s 内 9-10 次 reset；不作为最终通关证据 |
| B. 改策略（危险物接近时松开右键等待；危险区内抑制 `pickupAbove`；按相位再跳） | 否（但改 harness 动作语义） | 高 | 需要批准；FA-02 明文“不改 harness 动作语义”，必须单开票 |
| C. 实现 `jump_over` 的 hazard 目标 + `assert_state` 动作点断言 | 否（字段已存在，补实现） | 中/高 | 仍是动作语义变更，需要批准；不是协议变更 |
| D. 扩展 `wait_until` 条件（时间/相位/位置）或加 `move_to` 实体/坐标目标 | **是** | 高 | 需要协议审批票；FA-02 期间不做 |
| E. CLI 增加 `--scenario-dir` / run 级场景覆盖 | 否（工具/CLI 变更） | 不直接提高 | 解决“验收场景无法被 CLI 选中/写回”；需批准 |
| F. 人工试玩（键盘真人）并标记为人工证据 | 否 | 可完成，但不是自动通过 | FR-02 明确允许；必须标记人工，不得伪装成自动 SUCCESS [E1：`docs/v7.5/demo.md:176`] |
| G. 修复 gate 停点阈值（`targetReached` / `gateReached` 改为按 gate 盒左边界或玩家右边界判定） | 否 | 消除 8px 硬缺口 | 这是 harness 确定性缺陷修复；需先实跑确认，再按审批流程修；不是协议变更 |

最小组合建议：**A 先作为 FA-02 的诊断运行**（产出真实失败证据）；若失败，优先申请 **B/C+E**
（不改协议，但需批准动作语义/CLI），而不是改协议；若审批不通过，按 **F** 补人工证据，
并在交付中保留 `AGENT_LIMITATION`，不把人工证据写成自动 playtest SUCCESS。

---

## 5. 动作序列草案（草案，不是最终证据）

> 这是供 FA-02 执行的草案；它不声称已通关，也不作为最终验收证据。它使用现有
> `playtest-scenario/v1` 字段；放在 `.scratch/fpvs-v1-final/scenarios/`，用
> `playtest.mjs --scenario-dir` 运行。不要放进五态目录；不要用 `setup.mutate-hazard` 改危险物
> 来“造通关”（那会绕过真实游戏 [E1：`runner.mjs:119-151`；`docs/v7.5/demo.md:174`]）。

```json
{
  "formatVersion": "playtest-scenario/v1",
  "id": "acceptance-win-wasteland-v1",
  "version": 1,
  "required": false,
  "expectedOutcome": "SUCCESS",
  "baselineEligible": false,
  "target": { "siteVersion": 1 },
  "harnessCondition": "none",
  "setup": { "kind": "none" },
  "actions": [
    { "kind": "move_to", "target": { "kind": "pickup", "index": 0 } },
    { "kind": "move_to", "target": { "kind": "pickup", "index": 1 } },
    { "kind": "move_to", "target": { "kind": "pickup", "index": 2 } },
    { "kind": "move_to", "target": { "kind": "pickup", "index": 3 } },
    { "kind": "wait_until", "condition": { "kind": "collected", "value": 6 }, "timeoutMs": 2000 },
    { "kind": "reach_goal" },
    { "kind": "wait_until", "condition": { "kind": "won" }, "timeoutMs": 120000 }
  ],
  "assertions": [
    {
      "id": "initial-pickups", "kind": "state", "requires": ["initialActivePickups"],
      "expect": { "kind": "state", "path": "initialActivePickups", "op": "eq", "value": 4 },
      "withinMs": 120000, "onInsufficient": "unknown"
    },
    {
      "id": "all-collected", "kind": "state", "requires": ["collected"],
      "expect": { "kind": "state", "path": "collected", "op": "eq", "value": 6 },
      "withinMs": 120000, "onInsufficient": "unknown"
    },
    {
      "id": "chests-opened", "kind": "state", "requires": ["chestsOpened"],
      "expect": { "kind": "state", "path": "chestsOpened", "op": "eq", "value": 2 },
      "withinMs": 120000, "onInsufficient": "unknown"
    },
    {
      "id": "pickups-cleared", "kind": "state", "requires": ["activePickups"],
      "expect": { "kind": "state", "path": "activePickups", "op": "eq", "value": 0 },
      "withinMs": 120000, "onInsufficient": "unknown"
    },
    {
      "id": "pickup-events", "kind": "event", "requires": ["pickup"],
      "expect": { "kind": "event", "type": "pickup", "op": "gte", "value": 4 },
      "withinMs": 120000, "onInsufficient": "unknown"
    },
    {
      "id": "chest-events", "kind": "event", "requires": ["chest-open"],
      "expect": { "kind": "event", "type": "chest-open", "op": "gte", "value": 2 },
      "withinMs": 120000, "onInsufficient": "unknown"
    },
    {
      "id": "win-event", "kind": "event", "requires": ["win"],
      "expect": { "kind": "event", "type": "win", "op": "gte", "value": 1 },
      "withinMs": 120000, "onInsufficient": "unknown"
    }
  ],
  "termination": { "kind": "won" },
  "timeoutMs": 120000,
  "pollIntervalMs": 50,
  "stepDelayMs": 35,
  "comparableEvents": ["pickup", "win", "chest-open"]
}
```

### 5.1 每一步的语义与预期观测

| 步 | 动作 | 语义 | 预期观测（成功路径） |
|---|---|---|---|
| 1 | `move_to pickup[0]` | 从 x=40 向右，收地面 scrap-1（x=220） | trace.x 约 40→220；`pickup` index 0；collected 0→1 |
| 2 | `move_to pickup[1]` | 继续向右，借策略自动跳上 platform-1，收 scrap-2（x=466） | `jump`/`land`；trace 出现 bottom=190 的落台；`pickup` index 1；collected→2 |
| 3 | `move_to pickup[2]` | 穿过 chest-1（x=498，自动开）、patroller-1、patroller-2，收 scrap-3（x=850，chest-2 上方） | `chest-open` chest[0]；可能多次 `reset`（接触危险物）；`chest-open` chest[1]；`pickup` index 2；collected→5 |
| 4 | `move_to pickup[3]` | 跳上 platform-3，收 scrap-4（x=1052） | 再次 `jump`/`land` 落台；`pickup` index 3；collected→6 |
| 5 | `wait_until collected≥6` | **集齐守卫**：若 chest-2 漏开，原地等到 2s 超时并中止，避免带着 5 件到达 gate 被误判 | 若 collected=6：立即 completed；否则 timeout，后续 `reach_goal` 被跳过 |
| 6 | `reach_goal` | 从 x≈1052 向右到 gate（x=1380） | trace.x 到 ≥1360；`win` 事件；won=true |
| 7 | `wait_until won` | 确认胜利已置位（通常立即完成） | 立即 completed；若未 won 则剩余时间后 timeout |

### 5.2 草案的已知风险与限制

- **gate 停点可能直接阻止通关**：按 §1.2.1 的静态几何，`reach_goal` 可能在 x≈1360 就完成，
  距 gate 盒还有约 8px；随后 `wait_until won` 不会前进。若实跑确认，本草案**即使收集全也无法通关**，
  需要先修 `targetReached` 阈值（方案 G）或另找入口。这是草案之前就存在的硬缺口，不是草案造成的。
- **不是确定性通关**：第 3 步仍依赖当前策略在 patroller-1/2 的安全相位附近跳；历史 45s 运行
  9–10 次 reset，v3 只通过 patroller-1。若第 3 步耗尽 120s，后面的动作会被 `skipped` [E1：
  `runner.mjs:253`]。
- **chest-2 无法定向**：如果策略跳过 chest-2，脚本无法回头；第 5 步守卫只能避免误到 gate，
  不能补开宝箱。
- **`assert_state` 没有使用**：它在执行层是空操作 [E1：`runner.mjs:251`]；草案不把它伪装成检查点。
  所有断言都在场景结束时按累计 max/最终值求值；`withinMs` 不被执行层强制 [E1：`observe.mjs:167-201`]。
- **没有使用 `won` 状态断言**：由于 §1.2.1 的 gate 停点缺口，先只用 `win-event` + `termination`
  证明目标；如果保留 `won` 状态断言，一旦停在 x≈1360，`gateReached` 会置真而 `won=false`，
  按 §2.3 会被误归因成 `GAMEPLAY_FAILURE`。等 gate 停点确认/修复后，再把 `won` 状态断言加回来。
- **证据范围**：如果成功，`result.json` + `events.jsonl` + `trace.jsonl` + `input.jsonl` 能证明
  启动/移动/跳跃落地/拾取/宝箱/复位/目标；不能直接证明“避开了哪一个危险物”。
- **CLI 不入链**：草案放在 effort `scenarios/` 时只能直接跑 harness；要写回 `delivery.playtest`
  需要 §4.6 的方案 E（CLI 场景目录支持）或把场景塞进五态（不推荐，违反 FA-02）。

---

## 6. 结论

1. **动作全集**：`move_to` / `reach_goal` 可用但只向右、只认 gate 或 pickup 下标；`wait_until`
   只有 won/collected；`jump_over` 的 hazard 目标未实现；`assert_state` 是空操作。
   表达“上平台取物”“先收集再到达 gate”可以；表达“等待巡逻相位/避开宽范围巡逻”不行。
   另外，**gate 停点按声明几何可能早约 8px**（静态推断，需实跑确认），现有动作没有越过该停点的入口。
2. **观测面**：11 类事件 + trace/input 足以证明启动、移动、跳跃/落地、收集、宝箱、危险物接触/复位
   和目标达成；但危险物没有 `hazard-hit` 事件，`hits` 只统计 `danger`，危险物归因只能靠 `reset` +
   trace 间接判定。`withinMs` / `requires` / `onInsufficient` 是声明性的。
3. **场景契约**：可以在不改 `playtest-scenario/v1` 的情况下新增验收场景；放在 effort 的
   `scenarios/` 用 `--scenario-dir` 跑；`target.siteVersion=1` 绑定 site，报告 checksum 提供更强身份。
   但 CLI 硬编码五态目录且只收 `required:true`，所以本 effort 场景目前进不了 CLI/写回链。
4. **缺口分类**：主因是场景动作表达/代理控制不足（AGENT_LIMITATION 族），不是已证明的游戏不可完成；
   需求文档、静态可达性和 v3 通过 patroller-1 都支持这一点。人类可通关性**无法确认**。
5. **最小方案**：先用本文草案做一次真实诊断运行（预期可能 AGENT_LIMITATION/TIMEOUT）；
   若失败，申请“不改协议”的策略/CLI 变更（方案 B/C/E），或按 FR-02 用人工试玩补证据并明确标记；
   不建议用 `mutate-hazard` 或改 config 造通关。

---

## 7. 证据索引

### E1 源码/契约

- 动作契约：`packages/contracts/src/playtest.ts:335-348`、`357-393`
- 场景加载/身份：`packages/demo/probe/playtest/runner.mjs:33-75`、`300-312`
- 动作执行：`runner.mjs:101-184`、`240-254`
- 观测：`packages/demo/probe/playtest/observe.mjs:8-21`、`23-26`、`76-134`、`146-201`
- 策略：`packages/demo/probe/playtest/policy.mjs:24-88`
- READ_STATE：`packages/demo/probe/probe-harness.mjs:207-235`、`320-332`
- 游戏规则：`packages/demo/src/shell/scene.ts:84-92`、`157-195`、`267-366`
- 玩家参数/拾取计数：`packages/contracts/src/game-config.ts:115`、`248-249`
- 盒子公式/锚点：`packages/contracts/src/game-config.ts:132-138`；`.../pack/v1/manifest.json:337-351`
- 静态可达性：`packages/contracts/src/reachability.ts:15-20`、`124-129`
- 归因：`packages/contracts/src/playtest-attribution.ts:3`、`145-157`
- CLI：`packages/cli/src/cli.ts:758-765`；`packages/cli/src/playtest.ts:23`、`109-122`、`229-242`、`325-368`
- 写回：`packages/pipeline/src/playtest.ts:27-76`；`packages/contracts/src/delivery.ts:217-220`、`327-331`
- 需求：`docs/v7.5/demo.md:37`、`151`、`174-176`

### E2 测试

- 场景版本绑定：`packages/demo/probe/playtest/tests/scenarios.test.mjs:26-58`
- 事件三值/策略：`packages/demo/probe/playtest/tests/observe.test.mjs:23-118`
- 场景契约形状：`packages/contracts/tests/playtest.test.ts:310-327`
- 无 `jump_over`/`reach_goal`/`assert_state` 行为测试（全仓 grep 仅 schema + runner 分派）
- 写回/交付：`packages/pipeline/tests/playtest.test.ts`、`packages/contracts/tests/playtest.test.ts`

### E3 真实产物

- 上一轮真实试玩：`.scratch/playtest-v1/runs/2026-10-27-acceptance/artifacts/wasteland-scavenger-recipe/run/v1/playtest/v1/`
  - `result.json`：AGENT_LIMITATION、collected 3、chestsOpened 1、actions 仅 move_to、eventCounts reset=10
  - `success-basic/events.jsonl`：pickup/chest-open/reset/jump/land
  - `success-basic/trace.jsonl`：x/hazards/chests 位置；reset 行 111、329
  - `success-basic/input.jsonl`：113 行，ArrowRight + Space
- 补充真实运行 v3（通过 patroller-1 到 x=772.5）：
  `.scratch/playtest-v1/runs/2026-10-27-ticket-08/e2e-evidence/run/v1/playtest/v3/`
  - `result.json`：AGENT_LIMITATION、collected 3、reset=9
  - `success-basic/trace.jsonl:326-327`；`success-basic/events.jsonl:28`
- 验收对象配置：`.scratch/fpvs-v1-p0/runs/2026-10-26-e2e-r4/wasteland-scavenger-recipe/run/v1/game-config.json`
  （与 `site/v1/game-config.json` 同 sha256 `455d9c7f...`）
- QA 静态可达性：`.scratch/fpvs-v1-p0/runs/2026-10-26-e2e-r4/wasteland-scavenger-recipe/run/v1/qa-report.json:13`
  （failures 只有两条 visual-config-coherence warning）
- 冻结快照：`.scratch/fpvs-v1-final/artifacts/` 在本审计时为空，FA-01 尚未生成；本审计无法验证快照哈希。

---

## 8. Postscript（FA-02 · 2026-10-28）

本文第 4.6 节推荐的最小组合里，**方案 B（改策略，不改协议）** 被 FA-01C 批准并采用：
`policy.mjs` 增加 `decide()`——巡逻带外沿等待（松开右键）+ 按实时几何/相位跨带起跳 +
危险区抑制 `pickupAbove` + 通用起跳安全推演；`runner.mjs` 支持循环内松开/恢复方向键；
`READ_STATE` 增加只读危险物盒足迹。方案 D（扩协议）/ F（人工证据）未使用。

结果：冻结产物上自动 `SUCCESS`（`won=true`、`collected=6`、`chestsOpened=2`、`resets=0`），
4 次真实运行一致；`game-maker playtest --scenario-dir` 写回 `delivery.playtest`（`playable-smoke=pass`，
视觉审核未做 ⇒ 交付 `verdict=incomplete`）。证据与报告：`../runs/2026-10-28-acceptance/`。

⚠️ 本文 §1.5 对"撞巡逻危险物"的静态分析仍然成立，但当时**没有**考虑"贴着巡逻带外沿等到
危险物朝自己走来、再在滞空窗口内越过"这条路线——它要求停点非常贴近带边（约 2px），
这是 FA-02 迭代 1 失败（过冲被视为"已在带内"）后修正的关键。
