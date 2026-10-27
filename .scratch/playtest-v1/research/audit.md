# 试玩 Harness 现状审计（票 01 · grounding 事实清单）

> 目标：把「试玩 harness 要取代的现状」盘点成事实，供 02 场景契约 / 03 观测 / 04 归因 / 05 重放基线 / 06 交付接入 引用。
> 纪律：只读。事实带 `文件:行号`；查不到就写「未确认」。

---

## 1. 现有试玩链路

### 1.1 `packages/demo/probe/playable-smoke.mjs`（P0-03 可玩性 headless smoke，票 10）

**命令与入口**
- 独立命令 `pnpm test:playable`（`package.json:14` = `pnpm build && node packages/demo/probe/playable-smoke.mjs`），不进默认 `pnpm test`（`playable-smoke.mjs:6-14`）。
- 参数开关（`playable-smoke.mjs:78-101`）：
  - `--negative gate|pickup|input`（缺省 = `positive`；非法值 exit 2）
  - `--pack` / `PLAYABLE_PACK`（默认 `packages/../.scratch/asset-integration-v1/runs/2026-10-20f-lurker/ruin-scavenger-extraction-assets/pack/v7`，`playable-smoke.mjs:46`）
  - `--config` / `PLAYABLE_CONFIG`（默认 `.scratch/asset-integration-v1/runs/2026-10-20e-site/game-config.json`，`playable-smoke.mjs:47`）
  - `--out` / `PLAYABLE_OUT`（默认 `.scratch/p0-construction-v1/runs/<今天>-ticket-10`，`playable-smoke.mjs:50`）
  - `--scenario`（只跑单个场景，`playable-smoke.mjs:99`）
  - `--timeout` / `PLAYABLE_TIMEOUT`（默认 45000ms，`playable-smoke.mjs:100`）
  - `--resetTimeout` / `PLAYABLE_RESET_TIMEOUT`（默认 30000ms，`playable-smoke.mjs:101`）

**场景全集（`playable-smoke.mjs:1115-1135`）**

| 模式 | 场景 key | 干什么 | 阶段序列与判定 |
|---|---|---|---|
| positive | `playable` | 正例：自动走到 gate 并胜利 | boot(reload→waitForScene) → spawn(waitForFloor) → 循环 → **won**(成功) / **floor**(掉穿地面 bottom>floorY+80) / **win**(到 gate 1.5s 仍 won=false，或 won=true 但 collected<expected) / **runtime**(won 但 console.error/异常) / 超时 → **move**·**pickup**·**navigate** 三选一（`playable-smoke.mjs:582-674`） |
| positive | `hazard-reset` | 软锁专项：两次触发 hazard 重置、30 帧回到 floorY、collected/won 不变 | reset-sequence / reset-floor / reset-state / reset-accumulate / runtime（`playable-smoke.mjs:763-839, 682-761`） |
| positive | `hazard-legacy` | 负例：会话内猴子补丁 `hitHazard` 成旧实现（只动 GameObject），期望在 reset-floor 失败 | 同上，但 1 次 attempt、`expected:'fail'`、期望 `caught=true`（`playable-smoke.mjs:769-806`） |
| negative `gate` | `negative-gate` | 把 `objective.gate` 指到不存在的 id，期望装配期拒绝 | `assemble`（`expected:'fail'`，装配拒绝=pass；`playable-smoke.mjs:843-880`） |
| negative `pickup` | `negative-pickup` | 运行时 destroy 一个 pickup，期望到 gate 不 won | `win`（`expected:'fail'`，在 win 阶段失败=pass；`playable-smoke.mjs:882-916`） |
| negative `input` | `negative-input` | 注入 `INPUT_BLOCKER`（吞 ArrowRight），期望走不动 | `move`（`expected:'fail'`，在 move 阶段失败=pass；`playable-smoke.mjs:918-941`） |

**`result.json` 落盘形状**（注意：`@game-maker/contracts` 的映射只读 5 个字段 `ok/stage/reason/expected`，其余一概不碰，`playable-smoke.ts:20-25`）

- 正例成功路径（`ok:true`，如 `stage:'won'`）：`{ ok:true, stage, reason, durationMs, floorY, spawn, resets, final, shots, trace }`（`playable-smoke.mjs:639-642`）。`trace` 是逐帧 `{ t, ...slimState }`（`playable-smoke.mjs:610`），`slimState` 见 `playable-smoke.mjs:110-120`。
- 正例失败路径（`ok:false`，由 `StageError` 抛出被 catch）：`{ ok:false, expected:'pass', stage, reason, durationMs, extra, console, exceptions }`（`playable-smoke.mjs:1097-1104`）。**轨迹被塞进 `extra.trace`**（`playable-smoke.mjs:598-601`），不在顶层。真实产物样例：`.scratch/fpvs-v1-p0/runs/2026-10-26-e2e-r4/smoke3/playable/result.json`（顶层 keys = `ok/expected/stage/reason/durationMs/extra/console/exceptions`；`extra.trace` 1145 帧，`extra.last` 为最后一帧 slimState）。
- 负例路径：`{ ok, expected:'fail', stage, reason, ... }`（gate 带 `originalGate/mutatedGate/observed`；pickup/input 带 `removedPickup/expectedPickups/start`；`playable-smoke.mjs:870-878, 907-913, 932-939`）。

**`summary-<mode>.json` 结构**
- positive：`{ startedAt, mode, pack, config, out, chrome, chromeVersion, node, url, scenarios:[{name, ...r}] }`（`playable-smoke.mjs:1123`）。
- gate：`{ ...meta(同 positive 但无 url), scenarios:[r] }`（`playable-smoke.mjs:1052`）。
- pickup/input：`{ ...meta, chromeVersion, url, scenarios:[r] }`（`playable-smoke.mjs:1128, 1133`）。
- 环境级失败（找不到 Chrome/包/config/dist）：`failRun` 写 `summary-<mode>.json` 为 `{ startedAt, mode, ok:false, stage, reason, pack, config, out }` 并 exit 2（`playable-smoke.mjs:131-140`）。

**策略是状态感知、非固定时序**（`playable-smoke.mjs:27-29, 495-578`）：跳跃由读到的 `solids/hazards/pickups/body` 决定（`shouldJump`），无写死 x 坐标；只有 CDP 轮询间隔与按键保持时长是固定常数。

### 1.2 `packages/demo/probe/probe-harness.mjs`（可复用 harness，票 15）

**抽出的可复用机器**（`probe-harness.mjs:3-7`）：找/启 Chrome → CDP → 注入只读状态探针 → 驱动 → 读状态 → 断言。具体导出：
- 路径常量 `ROOT/SHELL_JS/DIST_JS`（`probe-harness.mjs:24-26`）、`CHROME_CANDIDATES`（`:28-35`）、`MIME`（`:37-48`）、`delay`/`writeJson`（`:50-55`）、`slimState`（`:57-69`）、`StageError`（`:71-77`）
- `findChrome`（`:79-91`）、`launchChrome`（`:93-162`）、`connectCdp`（`:164-200`）、`READ_STATE`（`:205-233`）、`PHASER_HOOK`（`:237-258`）、`INPUT_BLOCKER`（`:260-267`）、`makePage`（`:269-400`）、`startServer`（`:402-428`）、`assembleSiteForProbe`（`:434-440`）

**「两套真相」欠账**（`probe-harness.mjs:5-7` 原文承认）：`playable-smoke.mjs` **暂未迁移**到这份 harness，仍带着抽出来之前的**旧拷贝**（`findChrome/launchChrome/connectCdp/makePage/startServer` 在 `playable-smoke.mjs:144-493` 逐段重复）。具体漂移（不只是重复，还有字段差异）：
- `slimState`：harness 版含 `chests`/`dangers`（`probe-harness.mjs:65-66`）；playable-smoke 旧拷贝**没有**（`playable-smoke.mjs:110-120`）。
- `READ_STATE`：playable-smoke 的 `hazards` 多一个 `t0`（用于三角波相位判跳，`playable-smoke.mjs:291, 552-554`）；harness 版 `hazards` **无 `t0`**（`probe-harness.mjs:226`）。
- `READ_STATE`：harness 版有 `chests`/`dangers`（`:227-228`）；playable-smoke 版**没有**（`:270-296`）。

### 1.3 `packages/demo/probe/` 其他 probe

| probe | 干什么 | 与试玩 harness 是否重叠 |
|---|---|---|
| `mechanic-probe.mjs` | 机制化运行时断言（collect-pickup / open-chest / avoid-danger 三条，`mechanic-probe.mjs:94-175`）。import harness（`:21-24`），probe 结果进覆盖报告 QA 层（`:13-15`）。夹具包 `fixtures/packs/last-train/v2`（`:30`） | **重叠**：已消费 harness 的 `READ_STATE/slimState`，机制断言即「状态差推事件」的雏形（`opened=false→true`、`hits 递增`、`state idle↔active`）。是 harness 迁移完成后的参照系 |
| `smoke.mjs` | 横版外壳真冒烟：A 手工坏数据 + B 真链路装配，用 `--dump-dom` + 注入 `__probe.html`，不进 CI（`smoke.mjs:6-15`） | 老式外壳级冒烟，不读状态、不驱动玩法；与新 harness 不重叠（会被取代方向覆盖） |
| `smoke-td.mjs` | 塔防真冒烟，读 `<html data-td-state>` 快照验证「建塔→出怪→交火→结算」（`smoke-td.mjs:12-14, 133-147`） | 塔防专属；本图明确不纳入（`map.md:67`） |
| `td-balance.mjs` | 塔防平衡调参回路，纯 `sim.ts` 无浏览器（`td-balance.mjs:1-9`） | 塔防专属，纯领域模拟，不重叠 |
| `td-sweep.mjs` | 塔防数值刻度扫描，纯 `sim.ts`（`td-sweep.mjs:1-9`） | 塔防专属，不重叠 |
| `free-acceptance.mjs` | 免费验收闭环：vitest + mechanic-probe + 覆盖报告三绿（`free-acceptance.mjs:5-13`）。复用 harness 的 `ROOT/writeJson`（`:21`） | 是**编排器**不是试玩；会调 `mechanic-probe`。与新 harness 的关系待 06 交付接入裁定 |

---

## 2. 状态观测面（`READ_STATE`）

**canonical 版在 harness**（`probe-harness.mjs:205-233`；playable-smoke 有一份旧拷贝 `playable-smoke.mjs:270-296`，差异见 §1.2）。字段语义对照 `packages/demo/src/shell/scene.ts:24-30`（`hazards/chests/dangers` 的结构、`collected`、`won`）。

**读到的字段清单**：
- player：`x, y, bottom, top, left, right, width, height, vx, vy, onFloor, blockedRight, touchingRight, collected, won`
- `pickups[]`: `x, y, active, visible`
- `hazards[]`: `x, y, axis, distance, periodMs`（playable-smoke 版再加 `t0`）
- `chests[]`: `x, y, opened`
- `dangers[]`: `x, y, state, hits`
- `gate`: `x, y`；`solids[]`: `x, y, w, h`；`scrollX`

**逐字段「事件可由状态差推导 vs 只能快照」**

| 字段 | 语义 | 事件可由状态差推导？ |
|---|---|---|
| `collected` | 计数（pickup 与开箱都 `+1`，`scene.ts:327,335`） | **可推**：0→1 = 拾取/开箱事件；但**拾取 vs 开箱**需结合 `pickups[].active` / `chests[].opened` 区分 |
| `won` | 到 gate 且 collected 达标置 true（`scene.ts:362-363`） | **可推**：false→true = 胜利事件 |
| `pickups[].active` | 该 pickup 是否还活着 | **可推**：true→false = 该 pickup 被拾取；若拾取+消失发生在同一次轮询间隔内，会漏（结构性不可判） |
| `chests[].opened` | 宝箱开没开 | **可推**：false→true = 开箱事件 |
| `dangers[].state` | `idle↔active` 周期 | **可推**：沿变 = 喷发/归隐事件 |
| `dangers[].hits` | 命中计数 | **可推**：递增 = 命中事件 |
| `onFloor` / `blockedRight` / `touchingRight` | 布尔 | **可推边缘事件**：沿变 = 离地/着陆、被挡开始；但「跳起」这一瞬时动作只能由 onFloor true→false 反推 |
| `x/y/vx/vy`、`bottom/top/left/right/width/height`、`scrollX` | 位置/速度/体积瞬时值 | **只能快照**：本身不是事件，事件需由多帧组合差去「推导」，不是「观察」 |
| `hazards[].x/y` | 移动 hazard 的**实时**位置（三角波） | **快照为主**：「撞上 hazard」需 player.x 与 hazard.x 之差推导；hazard 移动中，轮询可能错过贴近又远离的瞬间 |
| `hazards[].axis/distance/periodMs`（`t0`） | 静态运动配置 | **不是事件**，是归因用的静态参数（用于判「是否该跳」的相位，`playable-smoke.mjs:552-554`） |
| `pickups[].x/y`、`chests[].x/y`、`dangers[].x/y`、`gate.x/y`、`solids[].x/y/w/h` | 静态位置/几何 | **只能快照**，静态不产生事件 |

**结构性不可判**（本图已裁，`map.md:36-38`）：只读外部轮询无法捕获「同一帧内发生又消失」的瞬时事件；这类归 [[结构性不可判]] 而非补造证据。

---

## 3. 交付消费点

### 3.1 `packages/contracts/src/playable-smoke.ts`（试玩结果 → `playable-smoke` 检查项，FPVS-V1-P1 票 09）

- `PlayableSmokeResult`（`:20-25`）：只认 `ok / stage? / reason? / expected?` 五字段，其余（`trace/console/exceptions/screenshots` 等）一概不碰。文件头明说：`result.json` 是**松散形状，不是契约**（`:4-5`）。
- `PlayableSmokeAttribution`（`:28`）：三档 `GAMEPLAY_FAILURE | AGENT_LIMITATION | UNKNOWN`；但 `mapPlayableSmoke` **永不产 `AGENT_LIMITATION`**（`:8-9, 28` 注释，`mapPlayableSmoke` 体内确实只有 pass/blocked/fail(GAMEPLAY_FAILURE)/incomplete(UNKNOWN) 四出口，`:44-52`）。
- `PLAYABLE_SMOKE_GAMEPLAY_FAILURE_STAGES = ["floor","win","runtime"]`（`:31`）：**非超时**的确定性玩法失败 stage。
- `mapPlayableSmoke(result)`（`:44-52`）：`undefined→blocked`；`ok:true→pass`；`ok:false` 且 stage∈floor/win/runtime → `fail + GAMEPLAY_FAILURE`；其余（move/pickup/navigate 超时等）→ `incomplete + UNKNOWN`。
- `playableSmokeKnownLimitations(result)`（`:65-68`）：仅当 `stage:'navigate'` 且非 ok 时返回一条**硬编码措辞**（`:61-63`，特指 3/4 场景宽巡逻、跳 ~66px < 巡逻 100px）。措辞不通用，是「推测受限」不是「确定 AGENT_LIMITATION」。
- `playableSmokeEvidence(result, smokeDir)`（`:74-87`）：恒产 `smoke-result/console/exceptions` 三条 `DeliveryEvidence`；失败再补 `fail-<stage>.png`。

### 3.2 `packages/contracts/src/delivery.ts`（交付检查项与结论，FPVS-V1-P1 票 03/07/08）

- `DeliveryCheckStatus` 五值（`:25-26`）：`pass / fail / incomplete / blocked / not-required`（`not-required` 必须来自明确适用性规则，`:17`）。
- `DeliveryVerdict` 四值（`:28-29`）：`pass / fail / incomplete / blocked`（`not-required` 不参与最终计算）。
- `deriveDeliveryVerdict` 总序（`:45-55`）：**fail > blocked > incomplete > pass**，先命中先赢；只对 `required:true` 计算；必需项标 `not-required` 兜底抛错。
- 六检查项注册表（`:78-100`）：`DELIVERY_CHECK_KEYS = ["asset-pack","config","qa","site","playable-smoke","visual-review"]`，**全部必需**（`DELIVERY_REQUIRED_CHECKS = [...DELIVERY_CHECK_KEYS]`）；`DELIVERY_CHECK_LABELS`（`:89-96`）里 `playable-smoke` = 「自动试玩」。必需性**不住在 `checks[]` 每条里**，由这张注册表说了算（`:72-75`）。
- `DeliveryReportSchema`（`:134-192`）：strictObject，`runId / pack / config / site? / checks[] / verdict / visualReview / evidence / knownLimitations?`；superRefine 五条：①checks 不许重复 key ②每个必需 key 必须在 ③必需 key 不得 not-required ④verdict 与 `deriveDeliveryVerdict` 一致 ⑤site 字段与 site 检查项一致。
- `buildDeliveryReport`（`:221-233`）纯函数；`deliveryVerdictOf`（`:196-202`）是「哪个 key 必需」接到 derive 的**唯一**处；`applyVisualReview`（`:254-267`）只动视觉三处。

### 3.3 `qa-report.json` 的 `delivery` 子对象 schema

- `packages/contracts/src/qa.ts:283-304`：`QAReportSchema` 顶层 strictObject 加 **可选** `delivery: DeliveryReportSchema.optional()`。**可选 = 旧报告仍可解析（向后兼容），不升版**（`qa.ts:301-304`；「加它是加性的、不升版」）。
- 真实产物样例（`.scratch/fpvs-v1-p1/runs/2026-10-27-stage-c/qa-report.json`）`delivery` keys = `runId / pack / config / site / checks / verdict / visualReview / evidence / knownLimitations`；其中 `playable-smoke` 检查项 = `{ status:'incomplete', detail:'UNKNOWN' }`，`verdict:'incomplete'`，`visualReview:'pass'`，`evidence` 四条（smoke-result/console/exceptions/fail-navigate.png）。

### 3.4 关键缺口：真实管线**不接线** smoke

- 真实 create 管线（`packages/pipeline` / `packages/cli` / `packages/mcp`）**从不运行** `playable-smoke.mjs`，也**不 import** `mapPlayableSmoke`。三个 builder（`packages/pipeline/src/delivery.ts:51-110`）只把 `playable-smoke` 硬编码为 `blocked`（QA fail / site fail）或 `incomplete`（site success）；`initialDeliveryWithReview` 也是 `incomplete`（`delivery.ts:193`）。
- `mapPlayableSmoke` 对真实 `result.json` 的唯一消费者是**手动验收脚本** `.scratch/fpvs-v1-p1/acceptance.mjs:35,53-54`（阶段C，读历史 smoke 产物组装统一报告）。CLI/MCP 只 import `buildSiteSuccessDelivery/buildSiteFailureDelivery/tryWriteDelivery/writeVisualReviewToReport`（`packages/cli/src/cli.ts:18`、`packages/mcp/src/server.ts:15`）。
- 结论：`playable-smoke` 检查项在真实交付里**只会是 `blocked` 或 `incomplete`**，`pass/fail/GAMEPLAY_FAILURE/UNKNOWN` 目前只存在于 `acceptance.mjs` 与测试里。这正是票 06「交付接入」要补的那段。

---

## 4. 已出局词汇史

**当前 `CONTEXT.md`「已出局」区原文**（`CONTEXT.md:673-686`，2026-09-24 随终点重画整体出局，仅保留以免误读）：

- `CONTEXT.md:679` **Runtime Observation / RuntimeEntity / Runtime Event Log / Runtime Black Box** —— 游戏运行时的语义快照与事件流。
- `CONTEXT.md:680` **Runtime Bridge（运行时桥）** —— 游戏内部暴露语义状态的通道。
- `CONTEXT.md:681` **Semantic Test Action（语义测试动作）** —— 以游戏语义而非屏幕坐标表达的测试操作。
- `CONTEXT.md:682` **GameplayTestPlan / Critical Path** —— 玩法测试计划与关键路径。
- `CONTEXT.md:684` **Evidence（证据）** —— QA Issue 携带的可追溯凭据。

**原始出处（git log -S / git grep 追到的两个 commit）**

1. `e2143cc`「init: GAME_CREATION_RUNTIME_V1 技术规范与 demo 骨架」—— 最早，`docs/文档.md`（3216 行技术规范）+ `demo/src/` 骨架。定义（`git show e2143cc:docs/文档.md`）：
   - §17 `GameplayTestPlan`（`:779-793`）：`{ id, gameSpecId, tests, criticalTests, successCriteria }`；配套 `GameplayTestCase`。
   - §24/25 `Runtime Observation` + `RuntimeObservation`（`:1063-1101`）：`{ id, runId, frame, timestamp, scene, camera, player?, entities:RuntimeEntity[], ui, gameState(booting|playing|paused|won|lost|error), events:RuntimeEvent[], screenshot? }`；架构「Game Runtime → Observation Layer → Visual/Gameplay/Runtime QA」三共享。
   - §26 `RuntimeEntity`（`:1121-1143`）：`{ id, type, position{x,y}, bounds{x,y,width,height}, visible, state, interactive }`。
   - §27 `Runtime Event Log`（`:1151-1191`）：`RuntimeEvent` 十一类（game_started/scene_loaded/entity_spawned/entity_interacted/item_collected/state_changed/ui_opened/objective_completed/game_won/game_lost/error）。
   - §28 `Runtime Black Box`（`:1193-1208`）：事件日志用于 Debug/QA/Repair/**Replay**/Recovery；V1 不实现完整 Event Sourcing，采用 Run State + Event Log + Checkpoint。
   - §74 `Game Runtime Bridge`（`:2800-2820`）：`GameRuntimeBridge { getState/getEntities/getPlayer/getScene/getUI/getEvents/execute(action) }`；「AI 不应该通过截图猜玩家在哪里」。
   - Critical Path（`:1357` 附近）：`Boot→Move→Reach Crop→Interact→Harvest→Inventory Increase→Objective Complete`，任何失败 ⇒ Gameplay Gate = FAIL。
   - §59 `Evidence First`（`:2266-2296`）：所有 QA 输出必须携带 Evidence；`EvaluationEvidence[]`。
   - ⚠️ `Semantic Test Action` **不在** e2143cc 里（spec 只有 `execute(action: TestAction)`）。
2. `0ce36ed`「docs: 建 wayfinder 地图并解决票 01（模型代理调用契约）」—— 首版 `CONTEXT.md` 给了这些词的中文权威定义（`git show 0ce36ed:CONTEXT.md:86-111`）：`Runtime Observation（运行时观察）` / `Runtime Bridge（运行时桥，window.__GAME_RUNTIME__，手写固定 SDK 不由 AI 生成）` / **`Semantic Test Action（语义测试动作）`（`interact('crop.tomato.01')` 而非 `click(532,421)`）** / `GameplayTestPlan（玩法测试计划，从 GameSpec 自动推导，含 Critical Tests）` / `Critical Path（关键路径，核心玩法循环动作链）` / `Evidence（证据，每条 QA Issue 必须携带的截图 id/区域 id/observation id）`。

**出局时间点**：`git log -S "已出局" -- CONTEXT.md` 最早命中 `1cc6b74`（2026-09-24 终点重画「两个可独立交付产物」那次收口），把上述整簇术语收进「已出局」一节。

---

## 5. 证据分级现状

**E0–E3 定义出处**：`docs/v4/P0-00-task-brief.md:332-339` 附录 A——E0 推测 / E1 源码 / E2 测试 / E3 真实产物（真实执行产物与操作结果）；核心能力结论原则上需 E3，E0/E1 不得写成已验收。本图沿用它并加「运行证据（命令+退出码+路径）」为 E3 的补强（`map.md:45`）。

**现有 smoke 产出的证据文件**（`playable-smoke.mjs` + 真实产物目录 `.scratch/fpvs-v1-p0/runs/2026-10-26-e2e-r4/smoke3/`）：

| 证据 | 落点 | 分级 |
|---|---|---|
| `result.json`（含 `trace` 逐帧状态 / 或失败时 `extra.trace`） | `<out>/<scenario>/result.json` | E3（真实运行 + 逐帧运行状态） |
| `console.json` / `exceptions.json` | 同目录（`makePage.writeLogs`，`playable-smoke.mjs:457-460`） | E3（运行期控制台/异常捕获） |
| 截图 `00-start.png / pickup-N.png / reset-N.png / won.png / fail-<stage>.png / fail-timeout.png` | 同目录 | E3（真实画面） |
| `chrome.log` | `<out>/chrome.log` | E3（浏览器日志） |
| `assemble.json` | `<out>/assemble.json`（`playable-smoke.mjs:1017`） | E3（装配摘要） |
| `summary-<mode>.json` | `<out>/` | E3（汇总） |

**缺口确认**：
- **回归基线：完全没有。** `playable-smoke.mjs` 全文无「上一次通过结果的存储/比对/golden」逻辑；`trace` 只在当次 run 内消费，跑完即弃。没有任何「基线 vs 本次」diff。
- **重放：完全没有。** `trace` 记录的是**状态快照**（`slimState`），不是**输入事件流**（按键/时序）；`playable-smoke.mjs` 没有任何「读回一份记录并原样重放」的入口或 flag。它每次都是**现场驱动**（按当前读到的状态重新决策），不是重放。`shouldJump` 靠实时读状态，不是靠回放输入。
- 结论：现状只有「现场执行 + 落盘证据」，**可复现靠重跑同一条命令**（且依赖固定的默认包/config 路径），**不靠「记录→重放→比对」**。这与 `docs/v7.4/试玩.md:14` 的「可重放测试与回归基线」要求正好相反。

---

## 6. 缺口清单（现状离 `docs/v7.4/试玩.md` 完成条件的距离）

完成条件原文（`docs/v7.4/试玩.md:24`）：离线测试覆盖**成功、游戏失败、环境故障、代理限制、超时**五种结果，每种有明确判定和证据，不出现未知状态被误判为通过。范围内另列「试玩场景契约与版本绑定 / 结构化观测 / 失败归因规则 / 可重放测试与回归基线 / 接入 QA·delivery」（`试玩.md:11-15`）。

| # | 缺口 | 现状事实 | 去向 |
|---|---|---|---|
| 1 | **五态缺「代理限制」与「环境故障」的归因档** | 归因三档 `GAMEPLAY_FAILURE/AGENT_LIMITATION/UNKNOWN`（`playable-smoke.ts:28`），但 `mapPlayableSmoke` **永不产 AGENT_LIMITATION**（`:8-9`）；「环境故障」只在 `failRun` 里以 stage=`browser/assemble` + exit 2 表达（`playable-smoke.mjs:131-140`），没有统一五态 taxonomy | 04 归因 |
| 2 | **「超时」被归 UNKNOWN 而非独立态** | 超时三 stage `move/pickup/navigate` → `incomplete+UNKNOWN`（`playable-smoke.ts:50-51`）；「超时」不是一个一等归因值 | 04 归因 |
| 3 | **代理限制只有一条硬编码措辞，无判定逻辑** | `PLAYABLE_SMOKE_NAVIGATE_KNOWN_LIMITATION` 是写死的字符串（`playable-smoke.ts:61-63`），不通用、不计算 | 03/04 |
| 4 | **无场景契约 / 版本绑定** | 场景集硬编码在 `main` 里，包/config 用写死路径（`playable-smoke.mjs:46-47`）；没有「场景契约 + 版本」可被 harness 读取的载体 | 02 场景契约 |
| 5 | **观测只有状态快照，无事件流** | `trace` 是 `slimState` 快照（`playable-smoke.mjs:610`），事件需状态差推导，漏采归结构性不可判；无「Runtime Event Log」等价物 | 03 观测 |
| 6 | **无重放** | 无输入事件记录、无回放入口，`trace` 是状态不是输入 | 05 重放基线 |
| 7 | **无回归基线** | 无 golden/上一次结果比对；跑完即弃 | 05 重放基线 |
| 8 | **smoke 未接入真实交付管线** | 真实 CLI/MCP 只把 `playable-smoke` 写死 `blocked/incomplete`（`pipeline/src/delivery.ts:64,86,105,193`）；`mapPlayableSmoke` 只有 `acceptance.mjs` 手动消费（`.scratch/fpvs-v1-p1/acceptance.mjs:35`） | 06 交付接入 |
| 9 | **「两套真相」欠账未清** | `playable-smoke.mjs` 未迁移到 harness，自带旧拷贝且字段漂移（`probe-harness.mjs:5-7`，§1.2） | Harness 实现（Not yet specified） |
| 10 | **「不误判通过」这一点现状已对** | UNKNOWN 映射为 `incomplete` 而非 `pass`（`playable-smoke.ts:50-51`），`delivery` 缺席 ≠ 通过（`qa.ts:302-303`、`delivery.ts:219-224`） | 保持，不需补 |

---

来源：本审计只读，未改任何代码。
