# I00-04 lagMs 来源与传递路径

| 项 | 值 |
| --- | --- |
| 日期 | 2026-11-09 |
| 分支 | `wayfinder/level-playability-v1.1-integration` |
| HEAD | `330d6dc3919d9f7fa9de05baff9668a4a1177133` |
| Node / pnpm | v22.23.2 / 10.7.1 |
| 安装中的 Phaser | `phaser@3.90.0`（`packages/demo/node_modules/phaser/package.json:3`） |
| 权威输入 | `docs/v7.8/移动.md`（SHA-256 `3598cc19…9cea9`，同 I00-00） |
| 性质 | 只读研究。未改 `packages/**`、`docs/**`、`fixtures/**`、P0 目录、其他票或 `map.md`；未 commit / push；零付费 |

**结论先行（事实，不是裁定）**

1. `lagMs = 200ms` 的源码依据**仍然成立**，且 P0 之后的 Runtime / Phaser 版本**未变**（§1.4）。
2. 但它只是「默认 `smoothStep` + 默认 `minFps=5`」条件下**单次 `scene.update` 的 game-time delta 上界**，不是墙钟帧间隔上界，更不是生产实测延迟（§1.3）。
3. 今天 auditor **没有任何可达的 lag 输入**：`FixedRuntimeProfile`、`GameConfig`、运行期外壳、`auditPlayability` / `auditConfigPipeline` 都不携带它（§2）。唯一能确定 200 的路径是「读 Phaser 源码默认值 + 读外壳未覆盖 `fps`」，这条路径不可被调用方覆盖，也不是审计输入。
4. 因此若要在生产满足 G-02（显式或可审计的可信配置）与两档敏感性，**必须扩展 contracts 输入/输出**；扩展面逐项都属于 PRD §9.2 的独立授权类别（§4）。
5. B 门的 `[548,592]` 在 P0 的真实模型下**与 lag 无关**（交集证明不读 `lagMs`）；即使把 pad 错并进交集门，200ms 时门仍有 36px 正宽，结论不翻（§5）。

---

## 1. 200ms 依据复核

### 1.1 版本（已确认）

| 检查 | 值 | 证据 |
| --- | --- | --- |
| `packages/demo/package.json` 声明 | `"phaser": "^3.90.0"` | `packages/demo/package.json:15` |
| lockfile 解析 | `phaser@3.90.0`（integrity `sha512-/cziz/5Z…`） | `pnpm-lock.yaml:641-642`、`:1086-1088` |
| 实际安装 | `3.90.0` | `node -e "require('.../phaser/package.json').version"` → `3.90.0`，退出码 0 |
| P0 核验时记录 | `phaser@3.90.0`（同一路径） | `.scratch/level-playability-v1.1-p0/evidence/01-moving-hazard-semantics.md:17` |

### 1.2 源码链（已确认）

Phaser 的 TimeStep 只拿 `game.config.fps`：

- `packages/demo/node_modules/phaser/src/core/Game.js:273` —— `this.loop = new TimeStep(this, this.config.fps);`
- `packages/demo/node_modules/phaser/src/core/Config.js:342` —— `this.fps = GetValue(config, 'fps', null);`
- 外壳**没有**提供 `fps` 键（`packages/demo/src/shell/entry.ts:75-85`）：只有 `type / parent / width / height / pixelArt / scale / physics / scene`。
- `GetValue` 对 `null` 源直接返回默认值（`packages/demo/node_modules/phaser/src/utils/object/GetValue.js:45-48`）。

⇒ TimeStep 取到全部默认：

| 参数 | 默认 | 位置 |
| --- | ---: | --- |
| `minFps` | `5` | `TimeStep.js:99`（`GetValue(config, 'min', 5)`） |
| `targetFps` | `60` | `TimeStep.js:113` |
| `deltaHistory` | `10` | `TimeStep.js:379` |
| `smoothStep` | `true` | `TimeStep.js:435` |
| `fpsLimit` | `0` ⇒ `hasFpsLimit=false` ⇒ 走 `step` 而非 `stepLimitFPS` | `TimeStep.js:138,152,548` |

派生与截断：

- `TimeStep.js:174` —— `this._min = 1000 / this.minFps` = **200ms**。
- `TimeStep.js:186` —— `this._target = 1000 / this.targetFps` = **16.666…ms**。
- `TimeStep.js:563-585`（`smoothDelta`）：
  - `:569-574` 失焦 / cooldown 时 `delta = Math.min(delta, this._target)`（≤16.67ms）；
  - `:576` `if (delta > this._min)` ⇒ `:579` 用 `history[idx]`，`:584` 再 `Math.min(delta, this._min)`。
  - 两条路径的返回值都 ≤ 200ms；`history` 本身也只被写入已截断的值（`:590`）。
- `TimeStep.js:724-726` —— `step` 里 `if (this.smoothStep) delta = this.smoothDelta(delta);`，随后 `:739` `this.callback(time, delta)`。
- `Game.js:474,498` —— `Game.step(time, delta)` 把同一个 delta 交给 `this.scene.update(time, delta)`。
- `SceneManager.js:555-566` —— 原样 `sys.step(time, delta)`。
- `packages/demo/src/shell/scene.ts:79-81` —— 平台侧 `update(_time, delta)` 直接把 delta 交给 `advanceHazards` / `advanceDangers`。
- `packages/demo/src/shell/scene.ts:272` / `:289` —— `h.t0 += delta` / `d.t += delta`（hazard 相位就是**平滑后的 game-time**）。

### 1.3 成立条件与边界（已确认 / 推断）

**已确认**

- 上界 200ms 只对**默认 `smoothStep=true` 且未改 `fps.min`** 成立。若外壳将来加 `fps: { smoothStep: false }`，`rawDelta` 未截断（`TimeStep.js:717,719`），单次 `scene.update` 的 delta 可远超 200ms。
- 上界作用于**平滑后的 game-time delta**，不是墙钟帧间隔。`rawDelta`（`:717,719`，初始化见 `:405`）不设上界；无头 Chrome 的虚拟时间可给出任意大的 raw delta。仓库里 TD 侧已为此另设 `MAX_FRAME_MS = 250`（`packages/demo/src/td/sim.ts:26`）并把大 dt 切固定步长（`sim.ts:15-19,24,26`）；横版外壳没有对应夹取。
- 两处 Phaser 默认值都是**第三方源码事实**，不是本仓库的配置；契约侧读不到（§2）。

**推断**

- 生产环境中若外壳被替换 / 被配置成别的 `fps`，200ms 不再是上界。当前仓库里 `new Phaser.Game` 只有一处（`packages/demo/src/shell/entry.ts:75`，`packages/demo/src` 全量 grep 仅此一处），所以今天成立。

### 1.4 与 P0 核验的一致性（已确认）

- P0 记录 `phaser@3.90.0`（`01-moving-hazard-semantics.md:17`），并明确写「`entry.ts:75-85`（未覆盖 `fps` 配置）」（同文件 `:98`）。
- `git diff --stat c6424c2..HEAD -- packages/demo/src pnpm-lock.yaml packages/demo/package.json` **为空**（退出码 0）。
- `git show c6424c2:pnpm-lock.yaml` 与 `git show HEAD:pnpm-lock.yaml` 的 phaser 段逐字相同（`phaser@3.90.0`，同一 integrity）。
- ⇒ 版本与「外壳未覆盖 fps」两点在 P0 之后**未漂移**；200ms 的源码依据仍成立。

### 1.5 200ms / 16.67ms / 94ms 三者不是一回事（已确认）

| 值 | 是什么 | 来源 |
| ---: | --- | --- |
| 16.67ms | 标称 60fps 帧（`1000/targetFps`），也是失焦 / cooldown 的 clamp 值 | `TimeStep.js:113,186,569-574` |
| 200ms | 默认 `minFps=5` 的平滑 delta 硬上界（`1000/5`） | `TimeStep.js:99,174,576-585` |
| 94ms | P0 A/B 四轮 trace 的**最大观测间隔**，是 harness 采样间隔，**不是** delta 上界 | P0 `03-case-comparison.md:29-37`；`04-final-report.md:217` |

P0 自己已写明「不得直接当成 `lagMs`」（`03-case-comparison.md:37`）。200ms 是「源码上界」，94ms 是「观测下界参考」，两者不是同一量。

---

## 2. 可达输入矩阵

> 问题：auditor 能从哪里拿到帧间隔上界？结论：**今天哪一条都不够**（表末）。

| # | 候选来源 | `file:line` | 现状 | auditor 可达？ | 够不够 | 说明 |
| ---: | --- | --- | --- | :---: | :---: | --- |
| 1 | `FixedRuntimeProfile` | 类型 `packages/contracts/src/playability/profile.ts:37-47`；常量 `:49-58` | 只有 `id / collisionSource / chestInteraction / solidMotion` | 是（`api.ts:67` 可注入，且逐层下传） | **不够** | 它已是**唯一可注入的审计参数**，也是「立一个可审计常量」最自然的位置；但**没有任何时间字段**，加字段仍是 contracts 改动。 |
| 2 | `GameConfig` | `packages/contracts/src/game-config.ts:234-244`（顶层 schema）；`Motion` `:73-84`；`Strike` `:90-99`；`PlayerMove` `:159-166` | 有运动 `periodMs`、喷发 `periodMs/activeMs`、玩家 `speed/jumpVelocity/gravity` | 是（第一个入参） | **不够** | 没有 fps / frame / lag。把 lag 放进关卡配置还会把「Runtime 时间能力」和「关卡内容」混在一起（推断）。 |
| 3 | 运行期配置（外壳） | `packages/demo/src/shell/entry.ts:75-85`；`Config.js:342`；`TimeStep.js:99,113,379,435` | `new Phaser.Game({…})` **不含 `fps`** ⇒ 全部默认 | **否**（契约侧拿不到；只有人能读源码推导） | **不够** | 有效上界**可推导**（200ms），但不在任何审计输入里，调用方也无法覆盖。要让它进入契约，要么改 Runtime 暴露 `fps`，要么在 contracts 立一个派生常量。 |
| 4 | `RuntimeProfile`（外壳能力断言） | `packages/contracts/src/runtime-profile.ts:91-95`；`PLATFORMER_V1` `:114-119` | 只有 `mechanics[] / capabilities[]` | 是（设计层引用） | **不够** | 它是「外壳能做什么」的断言，不是几何/时间剖面；也没有 lag。加字段属于新的公开接口。 |
| 5 | 调用方传参 | `packages/contracts/src/playability/api.ts:64-68`；`config-audit.ts:28-37,39-42` | `auditPlayability(config, manifest, profile?)`；`auditConfigPipeline(config, ctx)`，ctx 只有 `manifest/design/levelId/viewport/hudLineHeight` | **否** | **不够** | 没有 lag 参数；新增即改公共签名。 |
| 6 | 现有隐式常量 | `packages/contracts/src/playability/mechanic.ts:62`（`FRAME_MARGIN_MS = 1000/60`），用于 `:226`、`:245`，经 `:281-284` 暴露为 `MECHANIC_LIMITS.frameMarginMs` | 已有的「1 帧（60Hz）余量」 | 是（同包内） | **不够** | 值是 **16.67ms**，语义是「帧边界余量」，不是 lag 上界；且它是 FR-04:151「不得把 lag 隐式写死在多个实现位置」点名要避免的形态。**这是一个先例，也是一个待收口的点。** |
| 7 | TD 固定步长常量 | `packages/demo/src/td/sim.ts:26`（`MAX_FRAME_MS = 250`） | 塔防自己的大 dt 夹取 | 否 | **不够** | 与 200 不同值，且属于另一种玩法（Out of scope）；它证明「帧时长假设今天已散落在实现里」。 |

**小结（已确认）**

- 今天 auditor **没有**任何生产可达的 lag 输入；能确定 200 的唯一路径是「Phaser 默认值 + 外壳未覆盖 `fps`」的**人工推导**，不可机读、不可覆盖、不可审计（§2 第 3 行）。
- 现有审计里唯一与帧时间有关的实现值是 `FRAME_MARGIN_MS = 16.67ms`（`mechanic.ts:62`），它与 P0 的 200ms 是**两个不同的假设**；将来同一层里若并存会出现「同一 lag 两个值」。
- `FixedRuntimeProfile` 是现有**最贴近**的注入点，但它当前只承载碰撞语义（`profile.ts:37-47`），放 lag 会改变它的职责边界（推断）。

---

## 3. 两档取值（16.67ms / 200ms）的含义与解释方式

### 3.1 各自代表什么

| 档 | 含义 | 适用解释 | 不应被解释成 |
| ---: | --- | --- | --- |
| **16.67ms** | 标称 60fps 帧（`1000 / targetFps`，`TimeStep.js:113,186`），也是失焦 / cooldown 时的 clamp 值（`:569-574`） | 「乐观档 / 标称档」：假设浏览器按目标帧率交付，且没有可观测的滞后 | 生产真实延迟；也不是 lag 的**下界**（失焦时 delta 只会被压到 16.67，不代表正常帧就是 16.67） |
| **200ms** | 默认 `minFps=5` 的平滑 delta 硬上界（`TimeStep.js:99,174`；截断 `:576-585`） | 「保守档 / 源码上界档」：单次 `scene.update` 的 game-time 推进不会超过它 | 实测延迟；墙钟帧间隔上界（§1.3） |

两档是**敏感性支架（bracket）**，不是点估计：结论应表述为「在 16.67–200ms 的假设区间内，判定是否翻转」；若只在某一档成立，就必须显式报告依赖（PRD §6.2:287「使用的 lag 假设」）。这正对应 G-02:208「必须保留两档敏感性分析」与 §10:480 的待冻结项。

### 3.2 「必填 + 默认」的语义冲突（事实，不裁定）

- PRD 同时要求：「默认采用 P0 研究所使用的 `lagMs = 200ms` 作为集成评审基准」（`docs/v7.8/移动.md:149`）；「`lagMs` 必须是显式输入或由明确、可审计的可信配置提供」（`:207`）；「无法确定适用的 lag 假设 ⇒ IE」（`:155`、`:184`）；「既有调用方无需因本功能而被迫修改」（`:344`）。
- 在**类型层**，「必填」与「默认」互斥：有默认值就是可选参数；只有「没有默认值」才能强制调用方显式给出。
- 两者可以在**层级上**共存（这是三种可选设计，交给 I00-R1，不在本票裁定）：

| 方案 | 形状 | 满足 | 代价 |
| --- | --- | --- | --- |
| A. 核心 API 必填、无默认 | `auditPlayability(config, manifest, { lagMs, profile })` | G-02 最强（调用方必须显式） | 触碰全部既有调用点，与 `:344`「既有调用方无需被迫修改」冲突 |
| B. 核心 API 可选、单一默认 200 | `lagMs?: number`，默认值只在**一处**定义并写进输出 | `:149` 的基准 + `:151` 的「只写一处」 | 默认是隐式的；要靠 §6.2 输出与文档补足「可审计」 |
| C. 产品边界必填 / 核心 API 显式 | CLI/MCP 要求 `--lag`（或默认 200），core 只收**已解析**的值 | G-02 + `:344` 都较好 | 需要 CLI/MCP 两个入口同时改，且 core 仍要改签名 |

- 另有一个**不扩展签名**的候选：在 `FixedRuntimeProfile` 里加一个常量（方案 B 的变体，把默认值放在 profile 里）。它仍然改 contracts，但把「默认」收进了一个可审计的剖面，且与两档敏感性（profile 里放两个值 / 由调用方覆盖）可以在同一处表达。是否可接受属于 I00-R1。

---

## 4. 若必须扩展公共输入：扩展面清单

> 判据：PRD §9.2:437-450 明列 `Runtime / Pipeline / contracts / CLI / MCP / 新依赖 / 新的公开配置或接口 / 任何扩大现有支持模型的行为` 都**不得**从 P0 的 GO 自动推导授权，必须「独立 effort 的文件白名单、修改方案、测试计划和成本估算，并取得明确批准」。
> 下表「授权」列 = 是否落入 §9.2 的独立授权类别。

| # | 扩展面 | `file:line` | 改动性质 | §9.2 类别 | 需独立授权？ |
| ---: | --- | --- | --- | --- | :---: |
| 1 | `auditPlayability` 签名 | `packages/contracts/src/playability/api.ts:64-68` | 新增参数（lag 或 options） | contracts + 新的公开接口 | **是** |
| 2 | `FixedRuntimeProfile` / `FIXED_RUNTIME_PROFILE` | `packages/contracts/src/playability/profile.ts:37-47,49-58` | 新增字段 | contracts + 新的公开配置 | **是** |
| 3 | `ConfigAuditContext` / `auditConfigPipeline` | `packages/contracts/src/config-audit.ts:28-37,39-42,53` | ctx 增字段 + 透传 | contracts + 新的公开接口 | **是** |
| 4 | 审计输出（evidence / witness） | `packages/contracts/src/playability/verdict.ts:74-86`（`PlayabilityEvidence`）、`:55-72`（witness 联合） | 若要在输出里记录 lag 假设，需要新字段（PRD §6.2:287） | contracts + 新的公开输出 | **是** |
| 5 | `compileRuntime` 的两个调用点 | `packages/assets/src/ops.ts:1247`（resample 循环）、`:1284`（deterministic 落盘前）；函数 `:1081` | 传参 / 新增入口参数 | Pipeline（构建链） | **是** |
| 6 | `runBuild` 汇合点 | `packages/pipeline/src/create-game.ts:631` | 传参 | Pipeline | **是** |
| 7 | publish gate | `packages/pipeline/src/publish-gate.ts:134`（`configProblem`）、`:140`（本文件唯一 `auditPlayability` 直调）、`:221` | 传参 / 处理新降级 | Pipeline | **是** |
| 8 | CLI | `packages/cli/src/cli.ts:673`（compile-runtime）、`:704,717`（site）、`:281`（buildAndSite） | 新增 flag / 传参 | CLI | **是** |
| 9 | MCP | `packages/mcp/src/server.ts:340`（compile_runtime）、`:374`（create_game）、`:433`（assemble_site） | 新增 tool 参数 / 传参 | MCP | **是** |
| 10 | Runtime 外壳（仅当要让 auditor 读到 `fps`） | `packages/demo/src/shell/entry.ts:75-85` | 暴露 / 声明 `fps` 配置 | Runtime + 新的公开配置 | **是** |
| 11 | contracts 公开导出 | `packages/contracts/src/index.ts:143,150` | 若新增常量 / 类型 | contracts | **是** |
| 12 | 时间模型本体（移动 hazard 判定） | 生产侧尚无消费点；`packages/contracts/src/playability/mechanic.ts:119` 今天只记 `moving-hazard-phase` gap | 扩大支持模型 | 「任何扩大现有支持模型的行为」 | **是** |
| 13 | 新依赖 | — | 本票脚本只用 Node 标准库；**不需要** | 新依赖 | 否（不新增） |
| 14 | 测试 / fixture | — | 随实现 effort 自带 | 不属于产品面 | 否（但 §9.2:450 要求测试计划） |
| 15 | 只读复核（读 Phaser 源码 / 读 `entry.ts` / 跑本票脚本） | 本文件 §6 | 不改变产品 | — | **否** |

**扩展面规模（事实）**

- 若走「核心 API 必填」：**9–10 个文件**（contracts 3–4（含输出字段 / 公开导出）、assets 1、pipeline 2、cli 1、mcp 1），全部落在 §9.2。
- 若走「只在 profile 里立一个可审计常量 + 输出两档」：contracts 仍是必经点（#1/#2/#4），但可**不碰 CLI/MCP**（不新增公开 flag），扩展面缩到 contracts + 输出；代价是调用方无法按关卡覆盖 lag。
- 无论哪条路，**都不需要新依赖**；也**不需要**改 Runtime（除非要声称「lag 来自运行期配置」而不是「来自 Phaser 默认值」）。
- 今天的审计链上，`auditPlayability` 只有 **2 个**直接调用点（`config-audit.ts:53`、`publish-gate.ts:140`）；`auditConfigPipeline` 有 **3 个**（`ops.ts:1247,1284`、`create-game.ts:631`）。扩展面虽然跨 5 个包，但收敛点很少。

---

## 5. 误判方向与 B 门敏感度

### 5.1 P0 模型里的两种方向（已确认）

P0 的原型把「一帧碰撞滞后」建模为检测位姿 `P(t-δ)`，`δ ∈ [0, lagMs]`（`.scratch/level-playability-v1.1-p0/prototype/MODEL.md`「一帧滞后」节；`temporal-model.mjs:104-119`）。两种用法**方向相反**，P0 明确禁止混用：

| 用法 | 公式 | lag 变大时 | 误判方向 |
| --- | --- | --- | --- |
| **安全 witness（并集 / 扫掠带）** | `pad = hazardSpeed × lagMs`，碰撞带 `[P-pad-½w, P+pad+½w]`（`temporal-model.mjs:111-119`） | 碰撞集**变大** ⇒ 更容易判碰撞、更难找 witness | lag 过**小** ⇒ 漏掉真实碰撞 ⇒ **假阴（把不可玩的判成可通行）**；lag 过**大** ⇒ **假阳（误判不可玩）** |
| **永久封锁门（交集）** | `L = maxP − ½w`，`R = minP + ½w`，**不读 `lagMs`**（`temporal-model.mjs:254-277`） | 门**不变**（P0 实现） | 无 lag 依赖 |
| （反事实）把 pad 并入交集门 | `L' = L + pad`，`R' = R − pad` ⇒ 宽 `44 − 2·pad` | 门**变窄** | lag 过**小** ⇒ 门过宽 ⇒ **假阳（误判不可玩）**；lag 过**大** ⇒ 门过窄 / 消失 ⇒ **假阴（漏报不可玩）** |

⚠️ **任务书原话「取小假阳 / 取大假阴」对应的是第三行**（把扫掠带 pad 并进交集门），**不是** P0 实际用的第二行，也**不是**第一行（witness 方向恰好相反）。三种方向都列在这里，供 I00-R1 对齐口径；本票不裁定哪一行是集成时要用的。

### 5.2 B 门 `[548,592]` 的敏感度（重算，非引用）

B 的输入（`.scratch/level-playability-v1.1-p0/cases/b/analyzer-input-lag200ms.json`）：hazard `start=560, distance=20, periodMs=2000, width=64, anchorX=0.5`；玩家 `startX=284, goalX=670, width=32`。

- `hazardSpeed = 2·distance/periodMs = 0.02 px/ms`（`temporal-model.mjs:58-61`）。
- 真实交集门：`L = 580 − 32 = 548`，`R = 560 + 32 = 592`，宽 **44px**。
- 反事实（pad 并入）门宽：`44 − 2 × 0.02 × lag`。

脚本 `.scratch/level-playability-v1.1-integration/scripts/lagms-sensitivity.mjs`（只读导入 P0 原型，不改 P0 目录）输出：

| lagMs | ≤200ms(源码界) | pad (px) | P0 交集门 | 门宽 | 反事实门（pad 并入） | 反事实门宽 | verdict |
| ---: | :---: | ---: | --- | ---: | --- | ---: | --- |
| 0 | 是 | 0.00 | `[548,592]` | 44 | `[548.00,592.00]` | 44.00 | `PROVEN_UNPLAYABLE` |
| 16.67 | 是 | 0.33 | `[548,592]` | 44 | `[548.33,591.67]` | 43.33 | `PROVEN_UNPLAYABLE` |
| 94 | 是 | 1.88 | `[548,592]` | 44 | `[549.88,590.12]` | 40.24 | `PROVEN_UNPLAYABLE` |
| 200 | 是 | 4.00 | `[548,592]` | 44 | `[552.00,588.00]` | 36.00 | `PROVEN_UNPLAYABLE` |
| 250 | 否(不可达) | 5.00 | `[548,592]` | 44 | `[553.00,587.00]` | 34.00 | `PROVEN_UNPLAYABLE` |

- **结论（已确认）**：B 的判定在 0–200ms 全区间**不翻转**。P0 的真实门与 lag 无关；即使按错误方式把 pad 并进交集门，200ms 时仍有 36px 正宽（门归零需要 lag = `44 / (2×0.02)` = **1100ms**，远超源码界）。
- 这同时说明：**B 这类「永久封锁」结论对 lag 不敏感；敏感的是「存在安全窗口」那一侧**（A/C 类）。

### 5.3 一个 lag 敏感的线段（已确认）

在 A 的输入上，`segmentCollides` 存在「16.67ms 判安全、200ms 判碰撞」的线段。例如玩家左边缘 `x0=536 → x1=537.6`、`t ∈ [0,10]`：

- lag=16.67：`pad=1.00px`，hazard 左边缘 ≈ 579.0，玩家右边缘 ≤ 569.6 ⇒ **无碰撞**。
- lag=200：`pad=12.00px`，碰撞点 `t=5, x=536.8`，hazard 带 `[568.3, 632.3]` ⇒ **有碰撞**。

⇒ **lag 过小会漏掉真实碰撞**（安全 witness 侧）；这正是 FR-04/G-02 要求显式上界与两档敏感性的原因。脚本未把这条线段硬编码为断言，命令见 §6 的 `node -e` 片段。

---

## 6. 复现

```text
$ node --version && pnpm --version
v22.23.2
10.7.1

$ node -e "console.log(require('./packages/demo/node_modules/phaser/package.json').version)"
3.90.0
退出码 0

$ git diff --stat c6424c2..HEAD -- packages/demo/src pnpm-lock.yaml packages/demo/package.json
（空输出）
退出码 0

$ git show c6424c2:pnpm-lock.yaml | grep -A1 '^  phaser@'
  phaser@3.90.0:
    resolution: {integrity: sha512-/cziz/5ZIn02uDkC9RzN8VF9x3Gs3XdFFf9nkiMEQT3p7hQlWuyjy4QWosU802qqno2YSLn2BfqwOKLv/sSVfQ==}
（HEAD 同）

$ node .scratch/level-playability-v1.1-integration/scripts/lagms-sensitivity.mjs \
    .scratch/level-playability-v1.1-p0/prototype/temporal-model.mjs \
    .scratch/level-playability-v1.1-p0/cases/b/analyzer-input-lag200ms.json
（§5.2 的表格 + 一行 JSON:…）
退出码 0
```

lag 敏感线段的复核（可选）：

```text
$ node --input-type=module -e '
import { pathToFileURL } from "node:url";
import fs from "node:fs";
const m = await import(pathToFileURL(".scratch/level-playability-v1.1-p0/prototype/temporal-model.mjs").href);
const cfg = JSON.parse(fs.readFileSync(".scratch/level-playability-v1.1-p0/cases/a/analyzer-input-lag200ms.json","utf8"));
const seg = { x0:536, t0:0, x1:537.6, t1:10 };
console.log(m.segmentCollides(seg,cfg,16.67), m.segmentCollides(seg,cfg,200));
'
null { t: 5, x: 536.8, hazardLeft: 568.3, hazardRight: 632.3 }
退出码 0
```

---

## 7. 未确认 / 推断（不得当成已确认）

| # | 项 | 级别 | 说明 |
| ---: | --- | --- | --- |
| 1 | 200ms 是**当前生产**的实际上界 | **推断** | 成立条件是「外壳保持 `entry.ts:75-85` 的默认 `fps`」；若有第二处 `new Phaser.Game` 或外壳被替换，需重新核。今天全仓只有一处。 |
| 2 | lag 应放在 `FixedRuntimeProfile` 还是独立 options | **未定** | 取决于 I00-R1 对「必填 / 默认」与扩展面的裁定（§3.2、§4）。 |
| 3 | 两档是否都要进**输出** | **未定** | PRD §6.2:287 要求解释「使用的 lag 假设」，但 §6.2:279 又说「不预设新增持久化字段」；现有 `PlayabilityEvidence`（`verdict.ts:74-86`）无 lag 字段。 |
| 4 | 生产 lag 的真实分布 | **未测** | P0 只有 94ms 的 trace 观测间隔；没有单帧 delta 的实测分布。`lagMs=200ms` 是源码上界，不是实测。 |
| 5 | 把 lag 放进 `GameConfig` 是否可接受 | **推断为否** | 理由：lag 是 Runtime 时间能力，不是关卡内容；且会扩大 `game-config/v1` 的公开面。未见仓库内反例。 |
| 6 | `FRAME_MARGIN_MS`（16.67）与未来的 `lagMs` 是否会重复 | **推断会** | 两者都是「一帧时间」的不同假设，且 `mechanic.ts:226,245` 已把它写死。FR-04:151 要求不得在多处隐式写死。 |

---

## 8. 不裁定（留给 I00-R1）

本票只给事实。以下需要裁定，证据已在上文就位：

1. `lagMs` 在 contracts 的**归属**：`FixedRuntimeProfile` 字段 / `auditPlayability` 的 options / 独立导出常量。
2. 「必填」与「默认 200」如何分层（§3.2 的 A/B/C）。
3. 是否把两档写进输出（新增字段 vs 只进 `detail` 文本）。
4. 扩展面是否拆成**独立前置 effort**（map.md:141 的开放问题）；若是，采用 §4 的「只改 contracts + 输出」最小面，还是全链（CLI/MCP）公开 flag。
5. 16.67 档是保留为「标称档」还是改成「失焦 clamp 档」的语义命名（两者数值相同、含义不同，见 §1.5、§3.1）。
