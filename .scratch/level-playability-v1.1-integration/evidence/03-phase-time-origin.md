# I00-03 证据：Hazard 运动相位与时间起点

- 票：[`issues/04-i00-03-hazard-phase-time-origin.md`](../issues/04-i00-03-hazard-phase-time-origin.md)
- 日期：2026-11-09
- 基线：`wayfinder/level-playability-v1.1-integration` @ `330d6dc3919d9f7fa9de05baff9668a4a1177133`
- PRD（只读冻结）：`docs/v7.8/移动.md` @ `sha256:3598cc19889b10a9fabf3a4f6f28ae7cee43a22355b639d8d61298e6d459cea9`
- Phaser：`phaser@3.90.0`（`packages/demo/node_modules/phaser/package.json`）
- 性质：**只读取证，不做裁定**（裁定属于 I00-R1）。未修改 `packages/**` / `docs/**` / `fixtures/**` / 其他票 / `map.md`；未 commit / push / 装依赖 / 付费。

**状态记号**：`CONFIRMED` = 源码或可复跑命令直接支持；`INFERRED` = 由已确认事实推出、未直接观测；`UNCONFIRMED` = 仓库内无法确认（浏览器调度 / 未测量）。

---

## 0. 命令与退出码（可复现）

| # | 命令 | 关键输出 | 退出码 |
| --- | --- | --- | --- |
| 1 | `node .scratch/level-playability-v1.1-integration/scripts/phase-origin-probe.mjs` | `anchors: 61/61 ok`；`corpus: json≈5.5k configs=59 hazards=53 moving=37`（`json` 计数会随 `.scratch/` 并发写入变动，**去重后的 config/hazard 计数稳定**）；`repoHead=330d6dc… productDirty=(empty)` | 0 |
| 2 | `node .scratch/…/scripts/phase-origin-probe.mjs --json` | 同上，结构化；`axisKinds=["cycle/x"]`、`distinctPeriods=[2000,2500,2600,3000,3500,3600,4000]`、一帧相位占周期 `0.417%–0.833%`、200ms 档 `5%–10%` | 0 |
| 3 | `npx vitest run packages/demo/tests/hazard.test.ts packages/demo/tests/shell-scene-wiring.test.ts` | `Test Files 2 passed (2)` / `Tests 10 passed (10)` | 0 |
| 4 | `npx vitest run packages/contracts/tests/playability-mechanic.test.ts packages/contracts/tests/playability-api.test.ts` | `Test Files 2 passed (2)` / `Tests 34 passed (34)` | 0 |
| 5 | 见 §4.1 的 `node --input-type=module` 片段（`last-train` fixture） | `{verdict:"INSUFFICIENT_EVIDENCE", coverage:{spatial:"partial",mechanic:"partial",completion:"checked"}, evidence:0}` | 0 |
| 6 | `git diff --stat -- packages fixtures docs` | （空） | 0 |
| 7 | `shasum -a 256 docs/v7.8/移动.md` | `3598cc19…9cea9` | 0 |

脚本 #1 的行为：逐条读回本文件引用的 **61 个 `file:line`**，断言该行仍包含被引用的片段（行号漂移 / 代码被改会当场 FAIL 并报真实行号），再只读扫描语料。它不写任何文件。

> ⚠️ 语料口径与 P0 不同：P0 的 E3 用 `.scratch/level-playability-v1/corpus/inventory.json` 的过滤条件（21 份 / 31 hazard / 19 moving）；本脚本按 `format ∈ {game-config/v1, game-maker/game-config@1}` 直接扫 `out/ fixtures/ .scratch/ packages/demo/fixtures/` 并按内容哈希去重（59 份 / 53 hazard / 37 moving）。**两套数字不可混用**；本文件只用后者，且只用它的「量级」，不用它的「全量性」。

---

## 1. 权威 `t=0`：时钟在哪里创建、在哪里累计

### 1.1 调用链（CONFIRMED）

```
站点加载
  entry.ts:75-85            new Phaser.Game({...})            ← 没有任何 fps / visibility 配置
  Game.js:438               loop.start(Game.step)              ← TimeStep 起表
  TimeStep.js:535-542       deltaHistory 全部填 target；resetDelta()；startTime = now
  ↓
场景 preload（scene.ts:35-38，加载图集，异步）
  LoaderPlugin.js:945       loader.update 挂在 Scene UPDATE 上
  LoaderPlugin.js:1119-1122 所有文件完成 ⇒ loadComplete()
  LoaderPlugin.js:1155      emit(COMPLETE)
  SceneManager.js:505/527-529  COMPLETE ⇒ loadComplete ⇒ create(scene)   ← 通常在**两帧之间**（XHR 回调）
  SceneManager.js:613-644   scene.create() → t0 = 0（scene.ts:161）→ status = RUNNING(:641)
  ↓
下一帧 Game.step（Game.js:474-523）
  Game.js:498               scene.update(time, delta)          ← Systems.js:356-366
    Systems.js:362            emit(UPDATE)  → ArcadePhysics.world.update（物理步 / overlap 回调）
    Systems.js:364            sceneUpdate = scene.update → advanceHazards(delta)：h.t0 += delta（scene.ts:80,272）
  Game.js:514               scene.render(renderer)              ← 本帧第一张可见画面
```

### 1.2 四个「时刻」的关系

| # | 问题 | 结论 | 状态 | 证据 |
| --- | --- | --- | --- | --- |
| 1.1 | 游戏时间 `T` 在哪创建 | 不存在单独的 `T` 对象。唯一权威零点是**每个 hazard 自己的 `t0` 在场景 `create()` 时置 0**；`T` 是同一个 delta 流的累计和 | CONFIRMED | `scene.ts:161`（`t0: 0`）、`scene.ts:272`（`h.t0 += delta`）、`hazard.ts:14-19` |
| 1.2 | `T` 怎么累计 | `Systems.step` 把 Phaser **平滑后**的 `delta` 传给 `scene.update`，`advanceHazards` 是它的第一行 | CONFIRMED | `Systems.js:356-366`、`scene.ts:79-80`、`TimeStep.js:711-745` |
| 1.3 | 所有 hazard 是否同一时钟 | 每帧每个 hazard 都 `+=` 同一个 `delta`，起点同为 0 ⇒ 正常运行时 `t0` 恒等；`hitHazard()` 只复位玩家，**不碰** `t0` | CONFIRMED | `scene.ts:161,271-276,355-362` |
| 1.4 | 「关卡开始」（create）与「首帧渲染」是否同一时刻 | **不是。** `create()` 由图集加载完成回调触发，发生在两帧之间；首帧渲染发生在**下一帧**的 render 阶段 | CONFIRMED（机制）/ INFERRED（「下一帧」——依赖 XHR 回调不在 Game.step 内，JS 单线程保证） | `SceneManager.js:505,527-529,613-644`；`Game.js:498,514`；`LoaderPlugin.js:1119-1122,1155` |
| 1.5 | 「首帧渲染」与「玩家首次可操作」是否同一时刻 | **是同一帧。** `update()` 在同一帧里先读输入再渲染；但输入写入的 `velocity` 要到**下一物理步**才生效 | CONFIRMED | `scene.ts:79-91`、`Game.js:498,514`、`Systems.js:356-366`、`ArcadePhysics.js:142` |
| 1.6 | 玩家第一眼看到的相位是否 0 | **不是。** 精灵在 `create` 时摆在 `at`（`scene.ts:139`），首帧 `update` 已经 `advanceHazards(delta₁)`，随后才 render ⇒ 首帧可见相位 = `P(delta₁)`，源码只保证 `0 ≤ delta₁ ≤ 200ms`（正常路径约一帧 ≈16.7ms） | CONFIRMED（上界）/ **delta₁ 的具体值 UNCONFIRMED** | §1.3 的 clamp 事实 + `scene.ts:139,80,276`；`Game.js:498,514` |
| 1.7 | 有没有「关卡开始倒计时 / 就绪态 / 重启路径」 | 没有。`update` 第一帧就接受输入，hazard 同一帧开始走；站点内没有任何 `scene.restart` / `shutdown` / 重置 `t0` 的路径 | CONFIRMED | `scene.ts:79-91`；`grep restart\|shutdown` 于 `scene.ts`/`entry.ts` 无命中 |

**一句话**：`t=0` 是**场景 create**，它比首帧渲染早一帧；首帧渲染与玩家首次可操作同帧；`t=0` 这一瞬间玩家**看不到**，玩家看到的第一帧相位是 `P(delta₁)`。

### 1.3 delta 的上界与首帧值（CONFIRMED 的边界 / UNCONFIRMED 的数值）

| # | 事实 | 状态 | 证据 |
| --- | --- | --- | --- |
| 1.8 | 站点没有覆盖 `fps` 配置 ⇒ Phaser 默认 `min=5`（`_min=200ms`）、`target=60`（`_target≈16.67ms`）、`smoothStep=true`、`deltaHistory=10`、`panicMax=120` | CONFIRMED | `entry.ts:75-85`；`TimeStep.js:99,113,174,186,379,392,435` |
| 1.9 | `smoothStep` 路径：`delta > _min` ⇒ 用 `history[idx]` 且再 clamp 到 `≤_min`；`!_inFocus` 或 `_coolDown>0` ⇒ clamp 到 `≤_target`；最后对 10 个历史值取平均 | CONFIRMED | `TimeStep.js:563-613,717-730` |
| 1.10 | 因此**任何一帧**进入 `scene.update` 的 `delta ≤ 200ms`（默认配置） | CONFIRMED | 同上；与 P0 结论包 §2.1 第 4 条一致 |
| 1.11 | 首帧 `delta₁` 不是 0：`start()` 把 `deltaHistory` 预填成 `_target`（`TimeStep.js:535-538`），随后取平均 | CONFIRMED（机制） | `TimeStep.js:535-542,563-613` |
| 1.12 | `delta₁` 的**具体毫秒数** | **UNCONFIRMED** —— 取决于图集加载完成落在哪一帧、该帧的平滑历史、以及浏览器是否降频。仓库内不能测（需要真浏览器跑站点） | — |

> 结论口径：**「首帧相位 = 0」是错的**（源码顺序反证）；**「首帧相位 ≤ 200ms 游戏时间」是对的**（源码上界）。P0 的 U8 可以从「未测量」收紧为「**未测量但有 ≤200ms 的源码上界**」。

---

## 2. 相位的可推导性：缺的是哪个量

### 2.1 分解

把「玩家抵达危险区域时刻的 hazard 相位」拆成四个量：

| 量 | 由什么决定 | 可否由 config + pack + 起点确定 | 状态 |
| --- | --- | --- | --- |
| A. hazard 位置 ↔ 游戏时间 T 的函数 | `at` / `distance` / `periodMs` + `hazardAnchor` 三角波 | **可以**（纯解析、无随机、无 `phase` 字段） | CONFIRMED（`game-config.ts:79-85,117,122`；`hazard.ts:14-19`；E2 `tests/hazard.test.ts`） |
| B. T 的零点 | 场景 create，`t0=0` | **可以**（恒为 0，没有自由参数） | CONFIRMED（`scene.ts:161`） |
| C. 玩家抵达时刻 `T_arr` | 玩家输入轨迹 + 物理步 + 平滑后的 delta 流 | **不可以** —— 输入不在 config/pack 里；「等一会儿再走」本身是合法玩法 | CONFIRMED（不在任何输入契约里；`scene.ts:84-91` 每帧从键盘读输入） |
| D. 接触瞬间的采样误差 | 物理步在 `scene.update` 之前 ⇒ hazard 碰撞位姿落后一帧 | 差值有上界（≤200ms），具体值不可确定 | CONFIRMED（P0 §4；`ArcadePhysics.js:142,145`；`Systems.js:362-364`；`scene.ts:79-82`） |

⇒ `P_arrival = T_arr mod periodMs`。**唯一缺的量是 C：玩家抵达的游戏时刻 `T_arr`。**

### 2.2 票面三个候选量逐项定级

| 候选 | 是不是缺的量 | 理由 | 证据 |
| --- | --- | --- | --- |
| **关卡起点时间** | **不是**（在「要不要钉相位」的意义上）。运行时的起点恒为 create / `t0=0`，没有可调参数；如果契约想让它成为自由参数，那是**新增语义**（见 §4 选项 b），不是「缺测量」 | `scene.ts:161`；`Motion` 无 phase 字段 `game-config.ts:79-85` |
| **首帧 delta** | **是，但是有界余量**：`delta₁ ∈ [0, 200ms]`（正常路径约一帧），它把整条时钟平移一小段，**不累积**；对相位的影响 = `delta₁/periodMs` ≤ 5–10%（当前语料） | §1.3；本文件 §0 命令 #2 |
| **页面可见性** | **不是相位量**：后台不产生「额外相位偏移」（没有补帧、没有跳变，见 §3）；它只改变 `T_arr` 与墙钟的对应关系，而 `T_arr` 本来就不在仓库里 | §3 |

### 2.3 一个关键的正面结论（供裁定参考，非裁定）

**只要「玩家可以在安全格无限等待」成立，抵达相位就恰好取满整个 `[0, periodMs)`。** 这不是猜测，而是由「三角形周期函数 + 可等待」推出的：

- 等待 `w` ms ⇒ 抵达相位 = `(T₀ + w) mod P`，`w` 连续可任取 ⇒ 覆盖整个周期；
- 「安全等待格」的存在性**可以从 config + manifest 判**：落在 `sweptBox`（`completion.ts:352-357`）之外的格子天然对任意相位安全；
- 当前语料 37 个移动 hazard **全部**是 `kind=cycle / axis=x`（命令 #2），PRD 限定的单 X 轴模型内。

⇒ 「相位自由」不是「因为测不到所以放弃」，而是一个**可证明的模型事实**；而「首帧 delta / 页面可见性」只影响这个结论的边角（`T_arr` 的取值分布），不影响「可达相位集合 = 全周期」。

反过来，**如果玩家没有安全等待格**（出生点/通路被扫过包络覆盖），那么抵达相位就被钉死在某个值附近，这时「相位自由」会**高估**可行域 —— 这是需要在契约里显式检查的前提，不是可以默认的。

### 2.4 「能推导出什么」与「推导不出什么」

| 可以推导 | 不可以推导 |
| --- | --- |
| `create` 时刻每个 hazard 的相位 = 0（代码事实，但不是玩家可见状态） | 玩家抵达时的相位（除非钉死玩家轨迹） |
| hazard 在任意给定游戏时间 T 的位置 | 游戏时间 T 与墙钟的对应 |
| 「存在安全等待格」这一前提（用 `sweptBox` 判定） | 「玩家一定会在某个具体 T 抵达」 |

---

## 3. 页面暂停与后台计时：调用链、clamp 与分界

### 3.1 源码路径（CONFIRMED）

| # | 事实 | 证据 |
| --- | --- | --- |
| 3.1 | `VisibilityHandler` 监听 `visibilitychange`（`document.hidden`）与 `window.onblur/onfocus` | `VisibilityHandler.js:28-56,63-71` |
| 3.2 | 隐藏 → `Game.onHidden` → **`this.loop.pause()`** + 发 `PAUSE` | `Game.js:449-452,590-595` |
| 3.3 | `TimeStep.pause()` **只记录 `_pauseTime`**；不改 `running`、不取消 RAF | `TimeStep.js:468-471` |
| 3.4 | 可见 → `Game.onVisible` → `loop.resume()` → `TimeStep.resume()`：`resetDelta()` + `pauseDuration` + `startTime += pauseDuration` | `Game.js:629-634`；`TimeStep.js:479-485` |
| 3.5 | `resetDelta()`：`delta=0`、`deltaHistory[i]=min(_target, …)`、**`_coolDown = panicMax = 120` 帧** | `TimeStep.js:494-514` |
| 3.6 | `RAF` 循环**不看可见性**：`step` 只要 `isRunning` 就继续 `requestAnimationFrame` | `RequestAnimationFrame.js:89-96,130-146` |
| 3.7 | `Game.step` 只在 `isPaused` 时早退；`isPaused` 只由显式 `Game.pause()` 置位，**`onHidden` 不置它** | `Game.js:481-484,608-618` |
| 3.8 | `smoothDelta`：`delta > 200ms` ⇒ 换成 `history[idx]` 再 clamp 到 200；`!_inFocus` / `_coolDown>0` ⇒ clamp 到 16.67ms | `TimeStep.js:563-613` |
| 3.9 | ⇒ **隐藏期间不存在「按隐藏时长补帧」**：每个真正派发到的帧最多推进 `≤200ms`，通常 ≈16.67ms | 3.3–3.8 合取 |
| 3.10 | 站点侧**没有任何** `visibilitychange` / `document.hidden` / pause 处理 | `grep` 于 `packages/demo/src` 无命中；`scene.ts` 只碰 `t0 += delta` |

### 3.2 可支持范围 / 必须降级

| 判据 | 分界 | 状态 |
| --- | --- | --- |
| 只用 **game-time `T`**（Σ smoothed delta），不用墙钟 | **可支持**（源码唯一语义） | CONFIRMED |
| 隐藏页期间 `T` 何时走、走多少 | **不可支持**：取决于浏览器是否/多久派发一次 RAF —— 不在仓库内 | UNCONFIRMED（= P0 U1，仍未解除） |
| 「隐藏期间 `T` 会按隐藏时长跳变 / 补帧」 | **可支持地否定**（3.3/3.5/3.8：不补帧 + 回前台后 120 帧冷却 + 单帧 ≤200ms） | CONFIRMED |
| 「回前台第一帧会出现大 delta」 | **可支持地否定**（`resetDelta` 先 `delta=0` 再 clamp） | CONFIRMED |
| 「首帧相位 = 0」 | **必须降级**（是错的，见 §1.2 #1.6） | CONFIRMED |
| 「首帧相位 = 某个具体值」 | **必须降级**（未测量） | UNCONFIRMED |
| 「玩家抵达相位 = 某个具体值」（在可等待的前提下） | **必须降级**：相位应作为自由变量 | 见 §2.3 |
| 「玩家没有安全等待格」的关卡 | **必须降级**：此前提下相位自由不成立，需要另一套带来源的时序输入 | INFERRED（由 §2.3 的前提反向推出） |
| 多移动 hazard 的**同步相位** | 不属于 V1.1 模型（PRD FR-01 限单移动 hazard），且当前代码里它们确实共享 `t0` | CONFIRMED（`scene.ts:161,272`） |

> **给裁定的一句话**：U1 听起来像「相位不确定」，但它其实是「**游戏时间与墙钟的对应不确定**」。只要分析只消费 game-time、并把抵达时刻当自由变量，隐藏页行为**不会削弱**模型的可靠性；它只会让「预测玩家会在第几秒到达」这类墙钟判据失效——而那类判据本来就被 PRD G-03 禁止。

---

## 4. 契约选项 (a)–(d)

**今天的现状（先记事实）**：任何含移动 hazard 的关卡，`mechanic.ts:119` 都会 `addGap("moving-hazard-phase")`；`aggregateLayer` 在「无 evidence 且有 gap」时返回 `INSUFFICIENT_EVIDENCE`（`verdict.ts:113`），整关随之 `IE`（`api.ts:87-92`）。移动 hazard 不参与静止 hazard 的 A/B 判据（`mechanic.ts:115-120`），只在 completion 的复位边里用**扫过包络**（`completion.ts:143-150`）。

### 4.1 现状实测（E3）

```bash
node --input-type=module -e '
import fs from "node:fs";
import { auditPlayability, parseGameConfig } from "./packages/contracts/dist/index.js";
const raw = JSON.parse(fs.readFileSync("fixtures/game-configs/last-train.json","utf8"));
const manifest = JSON.parse(fs.readFileSync("fixtures/packs/last-train/v2/manifest.json","utf8"));
const v = auditPlayability(parseGameConfig(raw).value, manifest);
console.log(JSON.stringify({verdict:v.verdict, coverage:v.coverage, evidence:v.evidence.length}));
'
# ⇒ {"verdict":"INSUFFICIENT_EVIDENCE","coverage":{"spatial":"partial","mechanic":"partial","completion":"checked"},"evidence":0}
# EXIT=0
```

该 fixture 的 6 个实体里只有 `carriage` 带 `motion`。⇒ **“拒绝相位不确定的关卡”今天已经是事实行为（在 verdict 层）**，只是原因是一个自由字符串 gap，而不是一条有来源、可定位的相位契约。

### 4.2 逐项对比

> 误判方向按两条轴分开写：
> **FP-A（过度宣称可通行）** = 找到了「安全通过」的 witness，但真实运行时过不去；
> **FP-B（过度宣称封锁）** = 判 `PROVEN_UNPLAYABLE` 但真实可通行；
> **FN** = 明明有结论却只给 `INSUFFICIENT_EVIDENCE`（保守、但损失收益）。

| | 内容 | FP-A | FP-B | FN | 所需授权 | 依赖/风险 |
| --- | --- | --- | --- | --- | --- | --- |
| **(a)** 相位当自由变量（P0 做法） | 分析里对抵达相位做全称/存在量化，不引入任何配置字段 | **低**，但**非零**：只有在「存在安全等待格」前提成立时才是零；否则可能找到依赖不可能相位的 witness | **低**：封锁门必须在**所有**相位成立才报，天然保守 | 有：可能找不到 witness ⇒ `IE` | **不改公共契约**；仍属 I-0x 实施，需 I00-R2 白名单授权 | 需要一条**可审计的前提检查**（安全等待格 ⊆ `sweptBox` 之外）。今天 `mechanic.ts:119` 的 gap 已经等价于「一律降级」，(a) 是把这条 gap 换成真正的时序模型 |
| **(b1)** 调用方显式提供起点（只喂审计，运行时不变） | 新增审计输入（`auditPlayability` / `ConfigAuditContext` / CLI / MCP 参数）声明 `t0` / 起始相位 | **上升**：相位从「自由变量」变成「不可验证的调用方声明」。声明错 ⇒ 直接 FP-A / FP-B 都可能 | 同上 | 下降（更精确） | **PRD §9.2 公共输入契约变更**（PRD §7 禁止只信调用方声明，G-01/G-03 同精神） | 运行时的 `t0` 恒为 0（§1.2 #1.1），调用方给非 0 值就是**与外壳不符的声明**；且仓库里唯一能读到真实 `t0` 的通道是 CDP 注入的 `READ_STATE`（`probe-harness.mjs:207-242`，**不在站点 bundle 内**） |
| **(b2)** 调用方显式提供起点（运行时也认） | `Motion` 加 `phaseMs` / `startMs`，`scene.ts` 按它初始化 `t0` | 可控（相位变成数据，可审计） | 可控 | 下降 | **contracts + Runtime 双改**（PRD §9.2 + 另提白名单） | 会改变**所有现存关卡**的时序语义（今天一律 phase=0）；语料 37 个移动 hazard 的既有 playtest 基线全部受影响；属于「新增语义」，不是「补测量」 |
| **(c)** 审计自行推导 | 审计从 config + pack + 起点「算出」相位 | **高**：若推导含「玩家按某固定轨迹/速度抵达」，则把 C（`T_arr`）当成了已知量；玩家可等待、可慢走 ⇒ 既可能 FP-A 也可能 FP-B | 高（同上） | 下降 | 不改公共契约，但需要**新的、有依据的玩家时序模型**授权（PRD FR-03 只允许 Runtime Geometry Profile 内的运动能力，不允许虚构轨迹） | 「能推导的」只有 B（`t0=0`）与 A（位置↔时间）；C 推不出来（§2.1）。把 C 假设掉 = 把不确定藏进实现 |
| **(d)** 拒绝任何相位不确定的关卡 | 移动 hazard 一律 `IE` / 不产结论 | **零** | **零** | **最大**：所有移动 hazard 关卡永远拿不到结论，与 PRD 的目的相悖 | **不需要新授权**（= 现状，§4.1） | 优点是零风险；缺点是 FR-01/FR-02 的收益归零，且「相位不确定」没有变成一条可定位的契约信号，只是一个 gap 字符串 |

### 4.3 补充：三个选项其实回答的是不同的问题

- (a) 回答「相位**范围**是什么」→ 全周期（有前提）。
- (b) 回答「相位**值**是什么」→ 由调用方声明（需要来源验证与运行时一致性）。
- (c) 回答「相位**应该**是多少」→ 由模型推（今天没有可信模型）。
- (d) 回答「不回答」。

因此 (a) 与 (b) **不互斥**：可以先按 (a) 做声明的保守分析，再把 (b2) 当作未来的精度提升路径。真正互斥的是 (c) 与 (a)——(c) 把自由变量钉死，(a) 把它放开。

---

## 5. 相位不确定性与 `lagMs`：是否重复、是否独立

| # | 事实 / 判断 | 状态 | 证据 |
| --- | --- | --- | --- |
| 5.1 | 帧内顺序：物理步（collide/overlap）在 `scene.update` **之前**；`advanceHazards` 是 `scene.update` 第一行 ⇒ 帧 N 的碰撞用 hazard 在帧 N−1 结束时的位姿 | CONFIRMED | `ArcadePhysics.js:142,145`；`Systems.js:356-366`；`scene.ts:79-82,270-281` |
| 5.2 | ⇒ `lagMs` 的物理来源是**采样离散 + 一帧顺序**，方向固定（hazard 碰撞位姿**落后**渲染），量级 = 一帧 delta，默认配置上界 200ms | CONFIRMED | 5.1；`TimeStep.js:174,576-585` |
| 5.3 | 相位不确定性的来源是**抵达时刻自由**，量级 = 整个周期 `[0, periodMs)`，**没有上界**（不是 200ms） | CONFIRMED | §2.1 C；`scene.ts:84-91` |
| 5.4 | 二者成因**正交**：一个是「什么时候碰到」，一个是「碰到时采样误差有多宽」 | CONFIRMED（由 5.1–5.3 推出） | — |
| 5.5 | 在 **(a) 相位自由**模型里，单 hazard 的 `lagMs` 扫掠带是相位扫描的**子集**（固定抵达时刻、相位取遍全周期 ⇒ hazard 可出现在行程任意位置，自然包含 ±lag 的那一段）。再加 lag pad **不是错**，但会**缩小可证安全窗口** | INFERRED（几何推理，未在原型上量化） | §2.3；`hazard.ts:14-19` |
| 5.6 | 在 **(b)/(c) 相位被钉死**的模型里，`lagMs` 是**唯一**覆盖采样缺口的量，必须保留 | INFERRED | 5.1 |
| 5.7 | 有**一条 lag 分量永远不被相位自由吸收**：玩家的输入在 `scene.update` 读取、**下一物理步**才生效，且玩家自身位置也有帧采样误差 | CONFIRMED（顺序） | `scene.ts:84-91`；`Systems.js:356-366` |
| 5.8 | 结论：**不会重复计算错误**（两者都只往保守方向加），但**会重复保守**；「相位自由 + 全周期」与「lagMs=200ms」不能简单相加当成一个总体时间预算来报 | INFERRED | 5.5–5.7 |

> 给裁定的一句：`lagMs` 与相位**不是同一件事的两种写法**——相位是「状态变量可取哪些值」，`lagMs` 是「固定状态下的采样宽度」。在相位自由的模型里，前者的取值集合包含后者；但把 `lagMs` 当 0 会在任何钉死相位的方案里立刻出错。

---

## 6. 未确认项清单（本票的边界）

| ID | 事项 | 状态 | 对契约的影响 |
| --- | --- | --- | --- |
| U1 | 隐藏页期间 RAF 是否派发、派发几次 | **UNCONFIRMED（不在仓库内）**；但「不补帧 / 单帧 ≤200ms / 回前台 120 帧冷却」是 CONFIRMED | 只允许 game-time；禁止墙钟相位判据；不构成相位自由的反例 |
| U8 | 首帧 `delta₁` 的具体值 | **UNCONFIRMED**，但 `0 < delta₁ ≤ 200ms` 是 CONFIRMED | 不得假设「首帧相位 = 0」；可作为 ≤200ms 的相位余量 |
| 新增 U9 | 「安全等待格」是否存在、是否可达 | 可由 config + manifest 判定（`sweptBox`），但**本票未实现/未测量** | 相位自由的前提；缺失时应降级 |
| 新增 U10 | 平滑后的 delta 累计 `T` 与墙钟的长期偏差 | 未测量；机制上 `T = Σ EMA(10 帧)`，不是墙钟 | 禁止用 `T` 反推墙钟，反之亦然 |
| 新增 U11 | 站点未暴露 `t0`（生产通道） | 生产里只能从代码得知 `t0` 恒从 0 起；唯一外部读取是 CDP 注入的 `READ_STATE`（`probe-harness.mjs:231`），不进 bundle | (b1) 的输入只能来自「声明」，不能来自「测量」 |

---

## 7. 复现方法

```bash
cd /Volumes/shy/some-projects/game-maker
# 1) 锚点复核 + 语料量级（只读；写 0 个产品文件）
node .scratch/level-playability-v1.1-integration/scripts/phase-origin-probe.mjs          # EXIT 0
node .scratch/level-playability-v1.1-integration/scripts/phase-origin-probe.mjs --json   # EXIT 0（结构化）

# 2) 既有见证 / 回归
npx vitest run packages/demo/tests/hazard.test.ts packages/demo/tests/shell-scene-wiring.test.ts      # EXIT 0（10 passed）
npx vitest run packages/contracts/tests/playability-mechanic.test.ts packages/contracts/tests/playability-api.test.ts  # EXIT 0（34 passed）

# 3) 现状 verdict（§4.1 的片段）
# 4) 只读性
git diff --stat -- packages fixtures docs   # 空；EXIT 0
```

脚本 #1 若有任何锚点漂移会返回 `EXIT=1` 并打印 `FAIL <file>:<line> — 期望…实际…（真实行 N）`，用来防止本文件随代码演进悄悄过期。

---

## 8. 证据索引（本文件引用的全部锚点）

契约 / 运行时（产品代码）：
`packages/contracts/src/game-config.ts:79-85,117,122` ·
`packages/contracts/src/playability/mechanic.ts:115-120,252-258` ·
`packages/contracts/src/playability/completion.ts:143-150,352-357` ·
`packages/contracts/src/playability/verdict.ts:104-115` ·
`packages/contracts/src/playability/api.ts:64-68,81-92,113-118` ·
`packages/contracts/src/config-audit.ts:39-55` ·
`packages/pipeline/src/publish-gate.ts:134-143` ·
`packages/demo/src/hazard.ts:14-19,28-33` ·
`packages/demo/src/shell/scene.ts:40,58,61,75-76,79-91,139,161,187-193,270-281,355-362` ·
`packages/demo/src/shell/entry.ts:75-85` ·
`packages/demo/probe/probe-harness.mjs:207-242` ·
`packages/demo/tests/hazard.test.ts`（E2）·
`packages/contracts/tests/playability-mechanic.test.ts:133-137`（E2）。

Phaser 3.90.0（第三方，只读引用）：
`core/TimeStep.js:99,113,174,186,379,392,435,468-471,479-485,494-514,535-542,563-613,711-745` ·
`core/Game.js:438,445,449-452,481-484,498,514,590-595,608-618,629-634` ·
`core/VisibilityHandler.js:28-56,63-71` ·
`dom/RequestAnimationFrame.js:89-96,130-146` ·
`scene/Systems.js:356-366` ·
`scene/SceneManager.js:505,527-529,555-576,613-644` ·
`loader/LoaderPlugin.js:915-947,1119-1122,1136-1156` ·
`physics/arcade/ArcadePhysics.js:138-146`。

前序证据（只读引用）：
`.scratch/level-playability-v1.1-p0/evidence/01-moving-hazard-semantics.md` §3、§4、§8 ·
`.scratch/level-playability-v1.1-p0/evidence/04-final-report.md` §2.1、§6。
