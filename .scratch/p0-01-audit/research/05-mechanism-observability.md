# P0-01D · 机制与可观测性矩阵（只读审计）

| 属性 | 值 |
|---|---|
| 审计基线 | 生产代码 `2c1a9d5`（`2c1a9d55c1ac94bc5271318514897b9485587bec`，分支 `main`，2026-10-29 14:12:37 +0800） |
| 审计时 HEAD | `a495da0`（本 effort 票 02 收口；`git diff 2c1a9d5..a495da0 -- packages/` 为空） |
| 审计开始时工作区 | 仅本 effort 的 `.scratch/p0-01-audit/**` 修改与未跟踪 `docs/v7.6/管线.md`；本票未修改生产代码/契约/测试/历史证据 |
| 审计方式 | 只读 shell（`git` / `rg` / `find` / `ls` / `sed` / `cat` / `wc` / `shasum` / `node -e`）；在 HEAD 运行 6 个机制相关离线 vitest 文件（89/89 pass，仅写 OS 临时目录）；**未**运行 `playtest` / 浏览器探针 / `create` / `build` / `pack` / `test:playtest`；未写历史目录 |
| 输入 | 本票；`docs/v7.6/管线.md` §P0-01D（未提交工作区文件，`:184-213`）；`CONTEXT.md` 的 `Mechanic Status` / `Mechanic Coverage` / `Runtime Shell` / `Playtest` 等词条；已收口 `research/01-baseline.md`、`02-safe-commands.md`、`03-real-pipeline.md`、`06-playtest-visual-evidence.md` |
| 证据分级 | E1 源码 · E2 自动化测试 · E3 真实产物/运行证据（均注明来源 commit 与适用边界） |
| 词汇权威 | `CONTEXT.md`：Mechanic Status / Mechanic Coverage / Runtime Shell / Playtest / Runtime Observation / Runtime Event Log / Playtest Outcome / DeliveryCheckStatus |

> 本票只核实机制链路，不修复。发现的问题作为审计线索记录；历史报告只证明对应的交付身份与场景，不外推为 HEAD 的普遍支持。

---

## 0. 结论先行

1. **机制词表是 10 条横版机制**（`MECHANICS`）：`run` / `jump` / `gravity` / `collide-terrain` / `collect-pickup` / `moving-platform` / `hazard-contact` / `reach-goal` / `open-chest` / `avoid-danger`。其中 **9 条有运行时实现见证**，`moving-platform` 仍是 `experimental`（`RUNTIME_IMPLEMENTED_MECHANICS` 不含它）。另有塔防 9 类构念，**不在机制词表、不在 RuntimeProfile、没有机制状态/覆盖/Playtest**。
2. **交付级 E3 只有 3 条**：`collect-pickup`、`open-chest`、`reach-goal`。它们在 wasteland 交付（pack/config/site/shell 身份绑定）上有真实 Playtest 断言通过，主状态可记 `E2E_VERIFIED`。其中**闭集声明→配置→运行时→观测→Playtest 判定全链严格成立的只有 2 条**（`collect-pickup` / `open-chest`）；`reach-goal` 在 `design.mechanics[]` 里**没有声明**，只在 `winConditions` / `levels.layout` 的自由文本里出现，但 config 的 `objective.gate` 与 Playtest 的 `won` 断言把它完整实现了。
3. **4 条只有真实运行间接证据**：`run` / `jump` / `gravity` / `collide-terrain`。成功 Playtest 确实移动到了 gate（`playerX=1371`）、记录了 9 次 `jump` / 9 次 `land`，但**没有任何机制级断言**；`gravity` / `collide-terrain` 甚至没有在设计层声明。
4. **`avoid-danger` 是“实现 + fixture probe，不是交付验收”**：真 Chrome probe 在 `fixtures/packs/last-train/v2` + 合成 config 上通过（2026-10-28），但冻结交付的设计声明了 `avoid-danger` 而 config 里**没有 danger 实体**；机制覆盖门禁仍判 `satisfied`。这同时是“状态字段/覆盖报告存在 ≠ 机制真实发生”的实证。
5. **`hazard-contact` 有真实发生证据，但没有正向判定**：2026-10-27 的失败样本里 `reset=10`（真实撞到巡逻危险物并复位），但运行被判 `AGENT_LIMITATION`；没有任何 probe/场景断言“撞到危险物 ⇒ 正确复位”。当前 v2 成功样本 `reset=0`，所以成功路径没有接触过该机制。
6. **`moving-platform` 没有运行时实现**：`Motion` 在 config 里与 `kind` 正交，但外壳只在 `case "hazard"` 读 `motion`；带 `motion` 的 `solid` 从不移动。设计层引用它会被 R12（`mechanic-experimental`）拒绝；但**手写 config 可以静默写入 `solid + motion`**（schema 通过；只有行程越界才报 warning，界内完全不报；外壳忽略），Playtest 仍可能通关 ⇒ 可被误读为“移动平台可用”。
7. **系统性断点有三处**：
   - **声明→配置不可机械保证**：config 编译器提示词不读 `design.mechanics`；`designBrief` 不含 `mechanics[]`；`kind` 铁律只列 `solid/pickup/hazard/goal/decor`（漏 `chest` / `danger`），骨架示例也不含 chest/danger。冻结交付正好演示了两个方向：`open-chest` 成功落地，`avoid-danger` 在 config 里消失；反过来，`reach-goal` 与 `hazard-contact` 在 config 里真实实现，却不在 `design.mechanics[]` 里。
   - **机制覆盖门禁只读 design**：`buildMechanicCoverage` 只看 `design.mechanics`，不检查 config；生产调用不传 `probeResults`，QA 层对 `QA_PROBED_MECHANICS` 默认“全部 passed”；覆盖报告不落盘（`qa-report` / delivery 都没有该字段）。于是 `avoid-danger` 可以在没有任何 danger 实体的交付上拿 `satisfied`。
   - **Playtest 判定不是机制通用**：CLI 默认场景 `success-basic` 把 `initialActivePickups=4`、`collected=6`、`siteVersion=1` 写死成 wasteland 常量；默认只断言 pickups / collected / won，不断言 `chest-open`、`danger-hit`、`reset`、`jump`、`moving`。第二个 Demo 要么自带手写场景目录，要么会被误判。
8. **实现与验收必须分开计数**：9/10 有实现；3/10 有交付级 E3；其中**严格从闭集声明起点的全链只有 2/10**（`collect-pickup` / `open-chest`；`reach-goal` 缺设计 `mechanics[]` 声明）；4/10 只有真实运行间接观测；1/10（`avoid-danger`）只有 fixture probe；1/10（`hazard-contact`）只有真实发生 + 无正向判定；1/10（`moving-platform`）无运行时。**没有任何机制有真实 E3 的失败路径**（真实 E3 只有 SUCCESS；失败/限制/超时都是 E2）。
9. **塔防不是“机制支持”，只是“有仿真实现”**：`td-config/v1` 的 9 类构念有纯层实现与 `td-sim` / `td-winnable` 测试，装配期用参考玩家做“退化输”判据；但塔防没有设计层、没有 QA、没有 delivery、不能 Playtest，Playtest 探针还写死了 `scene('shell')`（塔防场景 key 是 `td`），结构性读不到。
10. **本审计只有一个真实样本**：一个冻结横版 Demo、一个设计、一次成功 Playtest（外加两份 harness v2 重跑）。不能从它外推第二个玩法、第二个设计或塔防；机制结论必须按“实现事实 / 测试事实 / 该交付的真实运行事实”分层引用。

---

## 1. 口径与证据分级

### 1.1 机制、能力、塔防构念

- **机制（Mechanic）**：`packages/contracts/src/vocabulary.ts:38-59` 的 10 条封闭枚举。它是从 `game-config/v1` 反推的“这一代外壳真能做什么”，不是许愿单（文件头 `:14-37`）。
- **能力（Capability）**：`vocabulary.ts:130-147` 的 8 条，是机制以下的外壳能力（输入/相机/碰撞/坐标/HUD）。本票只作边界说明，不把能力混进机制矩阵。
- **塔防构念**：`td-config/v1` 的封闭枚举（`attack` / `targeting` / `slow` / …）。它没有机制词表、没有 `Mechanic Status` / `Mechanic Coverage`，因此不适用本票的六段链路，只单列边界。
- **RuntimeProfile**：`packages/contracts/src/runtime-profile.ts:114-123`，第一阶段唯一成员 `platformer/v1`，其 `mechanics` 故意等于词表全集；塔防不在注册表里。

### 1.2 六段链路的定义

| 节点 | 本票采用的判据 |
|---|---|
| 机制声明 | 设计层 `GameDesignSpec.mechanics[].mechanic`（封闭枚举）；意图层 `mechanics[].name` 是自由文本，只是声明的上游输入 |
| 配置表达 | `game-config/v1` 中有语义对应的构造（字段/实体 kind/参数），且该构造能通过校验 |
| Runtime 实现 | 外壳活代码里存在可执行分支（`path:line`），并由 witness 测试钉住 |
| 实际触发 | 在真实运行或可执行 probe 中，达到该分支的前置条件（按键/接触/周期/距离） |
| 状态或事件观测 | `READ_STATE` 暴露的状态、Playtest 11 类闭事件、probe 采样或 Playtest 断言可读的量 |
| Playtest 判定 | 有场景断言把“机制发生/未发生”判成 pass/fail（否定条件还必须可判，否则只能 unknown） |

### 1.3 状态词

- 主状态按地图 Q10：`IMPLEMENTED` ≈ E1、`TESTED` ≈ E2、`E2E_VERIFIED` ≈ E3 + 交付身份、`UNKNOWN` = 证据不足、`BLOCKED` = 无法核实到通过的端到端行为。
- **实现判定**与**验收判定**分列：一个机制可以“已实现 + 已测试”但验收仍是 `UNKNOWN`（缺交付级证据或断言）。
- `Mechanic Status` 的 `supported` 只由运行时见证推导；`QA probe` 是独立一层（`vocabulary.ts:64-118`）。本票不把 `supported` 当行为级验收。

### 1.4 本票实际执行 / 未执行

- 执行：6 个离线 vitest 文件（`vocabulary` / `mechanic-coverage` / `shell-mechanic-witness` / `shell-capability-witness` / `hazard` / `world`），89/89 pass。
- 未执行：`pnpm test` 全量、`playtest`、`test:playtest`、`test:mechanic` / `test:acceptance`（浏览器）、`create/build/plan/pack/compile-*`、`site`、任何写历史产物命令。
- 因此所有 E3 都是**读取既有历史产物**；本票没有产生新的真实运行证据。

---

## 2. 机制清单（以当前代码为准）

### 2.1 横版封闭词表 10 条

| # | 机制 | 设计要求（词表语义） | 配置表达 | 运行时见证 | 覆盖层 qa | 实现判定 | 验收判定 |
|---|---|---|---|---|---|---|---|
| 1 | `run` | 水平移动（`PlayerMove.speed`） | `player.move.speed`（可省，默认 90） | `scene.ts:85-89` | `not-tested` | 已实现 | 仅间接 E3 |
| 2 | `jump` | 单跳（`jumpVelocity`，无二段） | `player.move.jumpVelocity` | `scene.ts:87,90-91` | `not-tested` | 已实现 | 仅间接 E3 |
| 3 | `gravity` | 重力（`gravity`） | `player.move.gravity` | `scene.ts:217` | `not-tested` | 已实现 | 仅间接 E3 |
| 4 | `collide-terrain` | 地形/实体 AABB 碰撞 | `terrain[]` + `kind:"solid"` | `scene.ts:52,129-131,150,225` | `not-tested` | 已实现 | 仅间接 E3 |
| 5 | `collect-pickup` | 碰拾取物即收集 | `kind:"pickup"` + `objective` | `scene.ts:151-155,331-337` | `satisfied` | 已实现 | **E2E_VERIFIED** |
| 6 | `moving-platform` | 实体沿轴周期往复 | `Entity.motion{cycle}`（设计上可挂 solid） | **无**（见 §4.2） | `not-tested` | **未实现** | `BLOCKED` |
| 7 | `hazard-contact` | 碰 hazard 即复位 | `kind:"hazard"`（可带 motion） | `scene.ts:157-161,352-359` | `not-tested` | 已实现 | `UNKNOWN`（真实发生、无判定） |
| 8 | `reach-goal` | 收集齐后到 gate 即胜 | `kind:"goal"` + `objective.gate` | `scene.ts:163-170,361-366` | `not-tested` | 已实现 | **E2E_VERIFIED** |
| 9 | `open-chest` | 近距自动开箱、一次性奖励 | `kind:"chest"` + 可选 `range` | `scene.ts:172-181,312-329` | `satisfied` | 已实现 | **E2E_VERIFIED** |
| 10 | `avoid-danger` | 定时喷发 + 安全窗口、命中复位 | `kind:"danger"` + 必填 `strike` | `scene.ts:183-191,284-306` | `satisfied` | 已实现 | 仅 probe（fixture） |

> `覆盖层 qa` 是“若该机制被设计声明，`buildMechanicCoverage` 会给出的 qa 层”。真实设计只声明了 5 条（`run`/`jump`/`collect-pickup`/`open-chest`/`avoid-danger`）；`reach-goal` 与 `hazard-contact` 在 config 里真实发生，但**都不在 `design.mechanics[]`**（`reach-goal` 只在 `winConditions` / `levels.layout` 自由文本里出现，`hazard-contact` 只在敌人行为的自由文本里出现）。

### 2.2 机制状态与覆盖的代码事实

- 词表：`packages/contracts/src/vocabulary.ts:38-59`。
- 运行时实现见证：`:89-99`（9 条；缺 `moving-platform`）。
- QA probe 见证：`:114-118`（3 条：`collect-pickup` / `open-chest` / `avoid-danger`）。
- 状态推导：`:103-106`；`deprecated` 为空。
- 三层覆盖：`packages/contracts/src/mechanic-coverage.ts:74-101`；门禁阻断规则 `:64-65`（`not-tested` 不阻断）。
- 生产门禁：`packages/pipeline/src/create-game.ts:647-650`，调用 `buildMechanicCoverage(design)` **不传 probeResults**。

### 2.3 塔防 9 类构念（不在机制词表）

| # | 构念 | 配置表达 | 实现 | 验收 |
|---|---|---|---|---|
| T1 | 建造机关 | `towers[]` + `slots[]` + `economy.startScrap` | `td/sim.ts:113-121` | 参考玩家仿真 |
| T2 | 升级机关（L1→L2） | `levels` 元组 + `upgradeCost` | `td/sim.ts:122-130` | 参考玩家仿真 |
| T3 | 波次/出怪 | `waves[].groups[]`（`delayMs`/`gapMs`） | `td/sim.ts:131-153` | 参考玩家仿真 |
| T4 | 单体攻击 | `attack:"single"` + `range` | `td/sim.ts:190-206` | 参考玩家仿真 |
| T5 | AOE | `attack:"aoe"` + `range` | `td/sim.ts:207-211` | 参考玩家仿真 |
| T6 | 索敌 first/strongest | `targeting` | `td/sim.ts:192-195` | 参考玩家仿真 |
| T7 | 减速（取最强、刷新时长） | `levels[].slow` | `td/sim.ts:216-221` | 参考玩家仿真 |
| T8 | 护甲/伤害下限 1 | `enemies[].armor` | `td/sim.ts:213-215` | 参考玩家仿真 |
| T9 | 漏怪/声望/胜负 | `lives`、`leakCost`、`objective` | `td/sim.ts:155-173,242-249` | `auditWinnable`（只判 `killed==0`） |

塔防的共同限制见 §5。

---

## 3. 逐机制链路

### 3.1 `run` — 水平移动

| 链路节点 | 事实 | 证据 |
|---|---|---|
| 设计要求 | `PlayerMove.speed`；左右键改变水平速度 | `vocabulary.ts:39-40`；`game-config.ts:140-147` |
| 机制声明 | 意图自由文本 → 设计层 `mechanics[].mechanic="run"` | `game-intent.ts:159`；`game-design.ts:79-82,194` |
| 配置表达 | `player.move.speed`（可省；默认 90） | `game-config.ts:115,140-147` |
| 运行时实现 | 读 left/right（方向键或 A/D），`setVelocityX(±speed)` | `shell/scene.ts:85-89`；witness `shell-mechanic-witness.test.ts:24` |
| 触发条件 | `update()` 每帧；有方向输入即触发 | `shell/scene.ts:79-96` |
| 观测 | `READ_STATE` 的 `x` / `vx` / `scrollX`；Playtest 无直接事件 | `probe-harness.mjs:216-266` |
| Playtest 判定 | **无机制级断言**。成功场景只以 `won` / `terminationReached` 间接要求移动；`run` 本身没有 pass/fail 断言 | `scenarios/five-state/success-basic.json`；`observe.mjs:147-165` |
| Fixture/E2 | witness（源码行为串）+ `input:keyboard` 能力见证 + policy 测试；无 Phaser 场景单测 | `shell-mechanic-witness.test.ts:24`；`shell-capability-witness.test.ts:32` |
| 是否只有 fixture？ | **否**：有真实运行间接观测（无机制断言） | 06-attempt-1 / 冻结 v2 |
| 真实证据 | 06-attempt-1（harness v2，`8e92c69`，raw 未归因）`playerX=1371`、`won=true`；冻结 playtest v2（`5b8283f`/`5f29592`，harness v1）同样 `playerX=1371` | `.scratch/generic-playtest-v1/evidence/06-attempt-1/attempt-v1/result.json`；`.scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/run/v1/playtest/v2/result.json` |
| 结论 | 实现 + 测试 + 真实运行间接观测；**机制验收缺失** | 主状态 `TESTED`（真实 E3 仅间接） |

### 3.2 `jump` — 单跳

| 链路节点 | 事实 | 证据 |
|---|---|---|
| 设计要求 | `jumpVelocity`；只在地面时单跳，没有二段 | `vocabulary.ts:41-42`；`game-config.ts:140-147` |
| 机制声明 | 设计枚举 `jump` | `game-design.ts:79-82` |
| 配置表达 | `player.move.jumpVelocity`（默认 330） | `game-config.ts:115,140-147` |
| 运行时实现 | `onFloor` 时读上/空格/W，`setVelocityY(-jumpVelocity)` | `shell/scene.ts:87,90-91`；witness `shell-mechanic-witness.test.ts:25` |
| 触发条件 | 地面 + 跳跃键 | 同上 |
| 观测 | `onFloor` / `vy`；Playtest `jump` / `land` 是由 `onFloor` 翻转**推断**的事件（`inferred:true`） | `probe-harness.mjs:216-266`；`observe.mjs:111-112` |
| Playtest 判定 | **无机制级断言**。真实运行记录 9 次 `jump` / 9 次 `land`，但没有 `jump` 断言；执行器内部有 `JUMP_VERIFY_STEPS=3`（发键后 3 步内必须离地），失败会**降级为不跳**并可能记 `jump-exhaustion`/`AGENT_LIMITATION`——这是执行器能力诊断，不是机制判定 | `policy.mjs:28-30`；`runner.mjs:174` |
| Fixture/E2 | witness + policy / termination 测试 | `shell-mechanic-witness.test.ts:25`；`probe/playtest/tests/*` |
| 是否只有 fixture？ | **否**：有真实运行间接观测（9 jump/land，无机制断言） | 06-attempt-1 / 冻结 v2 |
| 真实证据 | 同上 06-attempt-1：`jump=9`、`land=9`；冻结 v2：`jump=9`、`land=9` | 同上 |
| 结论 | 实现 + 测试 + 真实间接观测；**未断言“跳”本身成功**；若关卡不需要跳，机制坏了也能 SUCCESS | 主状态 `TESTED` |

### 3.3 `gravity` — 重力

| 链路节点 | 事实 | 证据 |
|---|---|---|
| 设计要求 | `gravity` 拉到地面 | `vocabulary.ts:43-44` |
| 机制声明 | **真实设计未声明**；词表里有 | `game-design.json`（冻结）`mechanics` 只有 run/jump/collect-pickup/open-chest/avoid-danger |
| 配置表达 | `player.move.gravity`（默认 900） | `game-config.ts:115,140-147` |
| 运行时实现 | `s.setGravityY(world.player.move.gravity)` | `shell/scene.ts:217`；witness `shell-mechanic-witness.test.ts:26` |
| 触发条件 | 常开（物理步进） | 同上 |
| 观测 | `y` / `vy` / `onFloor` | `probe-harness.mjs:216-266` |
| Playtest 判定 | 无任何断言；只能由 `won` / `land` 间接推断 | `observe.mjs:147-165` |
| Fixture/E2 | witness；没有独立 gravity 行为测试 | `shell-mechanic-witness.test.ts:26` |
| 是否只有 fixture？ | **否**：有真实运行间接观测（无机制断言） | 06-attempt-1 / 冻结 v2 |
| 真实证据 | 真实运行有 `land=9`、`playerX=1371`、`won=true`；只能算间接 | 06-attempt-1 / 冻结 v2 |
| 结论 | 实现 + 测试；**没有设计声明，也没有机制验收** | `TESTED`（实现事实） |

### 3.4 `collide-terrain` — 地形与静态碰撞

| 链路节点 | 事实 | 证据 |
|---|---|---|
| 设计要求 | `terrain: Rect[]` + `kind:"solid"` 的实体碰撞 | `vocabulary.ts:45-46` |
| 机制声明 | 真实设计未声明；词表里有 | 冻结 `game-design.json` |
| 配置表达 | `terrain[]`；`entities[].kind="solid"`；`motion` 可挂但外壳不用于 solid | `game-config.ts:51,103,225-241` |
| 运行时实现 | 地形矩形进 `solids` 静态组；solid 实体进同一组；玩家 `collider(s, this.solids)` | `shell/scene.ts:52,129-131,150,225`；witness `shell-mechanic-witness.test.ts:27` |
| 触发条件 | 物理步进；玩家与静态组重叠 | 同上 |
| 观测 | `x/y/onFloor/blockedRight/touchingRight`；`solids[]` 几何 | `probe-harness.mjs:216-266` |
| Playtest 判定 | 无任何断言；只在 `won` 的间接路径里被要求 | `observe.mjs:147-165` |
| Fixture/E2 | witness + 能力见证 `collision:aabb` + config 校验测试 | `shell-capability-witness.test.ts:35`；`game-config.test.ts` |
| 是否只有 fixture？ | **否**：有真实运行间接观测（无机制断言） | 06-attempt-1 / 冻结 v2 |
| 真实证据 | 真实成功运行走完 1440 宽世界并停在 gate；间接 | 06-attempt-1 / 冻结 v2 |
| 结论 | 实现 + 测试；无声明、无机制验收 | `TESTED`（实现事实） |

### 3.5 `collect-pickup` — 拾取

| 链路节点 | 事实 | 证据 |
|---|---|---|
| 设计要求 | `kind:"pickup"`；碰到即收集，HUD 槽位/目标计数同源 | `vocabulary.ts:47-48`；`game-config.ts:245-249` |
| 机制声明 | 设计枚举 `collect-pickup`；意图自由文本“寻找资源” | 冻结 `game-design.json` / `game-intent.json` |
| 配置表达 | `entities[].kind="pickup"`；`pickupCount` 由 pickup+chest 条数派生；至少 1 个 pickup/chest | `game-config.ts:248-249,380` |
| 运行时实现 | `physics.add.overlap(player, pickup, collect)`；`collect` 置 inactive/invisible、`collected+1`、刷 pips | `shell/scene.ts:151-155,331-337`；witness `shell-mechanic-witness.test.ts:28` |
| 触发条件 | 玩家与 pickup 的物理 overlap | 同上 |
| 观测 | `pickups[].active`、`collected`；Playtest `pickup` 事件（active true→false）、`initialActivePickups`、`activePickups` | `probe-harness.mjs:216-266`；`observe.mjs:86-95,147-155` |
| Playtest 判定 | **成功**：冻结 acceptance 断言 `initial-pickups=4`、`all-collected=6`、`pickups-cleared=0`、`pickup-events>=4`、`won=true`；默认 `success-basic` 只断言前三个（4/6/won）。**失败**：`failure-missing-pickup` 场景移除一个 pickup，断言 `initialActivePickups` 期望值失败（自测里校准为 3） | `.scratch/fpvs-v1-final/scenarios/acceptance/acceptance-win-wasteland-v1.json`；`scenarios/five-state/success-basic.json:29-73`；`self-test.mjs:70-96` |
| Fixture/E2 | witness；`world.test.ts` 的 `pickupCount`；`observe.test.mjs`；probe 的 collect-pickup（真 Chrome，fixture pack + 合成 config） | `world.test.ts:187-189`；`probe/playtest/tests/observe.test.mjs`；`mechanic-probe.mjs:95-113` |
| 是否只有 fixture？ | **否**：真实交付 Playtest + 真 Chrome probe | 冻结 v2 / 07-acceptance |
| 真实证据 | 冻结交付：pack `wasteland-scavenger-recipe` v1、pack checksum `sha256:a162942d…feb3`、config `sha256:455d9c7f…5dcd`、site v1、shell 2；`pickup=4`、`collected=6`、`activePickups=0`、`won=true`；来源 `5b8283f`/`5f29592`；另有 `8e92c69` 的 harness v2 重跑（同一身份） | 冻结 `playtest/v2/result.json`；`06-attempt-1/attempt-v1/result.json` |
| 结论 | **完整链路成立，交付级 E3** | `E2E_VERIFIED`（仅该交付场景） |

### 3.6 `moving-platform` — 周期运动平台

| 链路节点 | 事实 | 证据 |
|---|---|---|
| 设计要求 | `Motion{kind:"cycle",axis,distance,periodMs}`，实体沿轴周期往复 | `vocabulary.ts:49-50`；`game-config.ts:60-66` |
| 机制声明 | 设计枚举 `moving-platform` 存在；R12 会拒绝（`experimental`） | `build-design.ts:146-154`；测试 `build-design.test.ts:190-204` |
| 配置表达 | `entities[].motion` 对任意 `kind` 都可写（schema 正交） | `game-config.ts:103`；镜像 `config-tool.ts:44` |
| 运行时实现 | **不存在于 solid**：`case "solid"` 只 `addSolid(e.box)`，不读 motion；只有 `case "hazard"` 读 motion 并 `advanceHazards` | `shell/scene.ts:150,157-161,267-278`；witness 表 `moving-platform:null`（`shell-mechanic-witness.test.ts:29`） |
| 触发条件 | 若手写 `solid + motion`：schema 通过、`world.ts` 把 motion 搬进描述，但外壳从不移动该 solid | `world.ts:183`；`shell/scene.ts:150` |
| 观测 | 无。`READ_STATE.solids` 只给静态几何；没有“平台位移”状态；Playtest 也不采样 solid 的 motion | `probe-harness.mjs:216-266` |
| Playtest 判定 | **无**；没有任何场景/断言能判移动平台是否发生 | `observe.mjs:147-165` |
| Fixture/E2 | 只有 config schema 测试（motion 形状/越界 warning）、witness null、coverage 负例；没有运行时行为 test | `game-config.test.ts:88-90,371`；`mechanic-coverage.test.ts:30-42` |
| 是否只有 fixture？ | **是**：只有 schema / witness / coverage 测试，无任何运行时行为 test | 同上 |
| 真实证据 | **无**；冻结 Demo 的 solid 全部不带 motion（config 里 4 个 platform 均无 motion） | 冻结 `game-config.json` |
| 结论 | **实现缺失；设计层被 R12 拒绝；手写 config 可静默绕过并被误读** | `BLOCKED`（无运行时，无法产生验收证据） |

**额外不一致**：`world.ts:109-121` 的 `floorYOf` 明确把“带 motion 的 solid”排除出复位落点，理由写的是“会动的实体下一秒就不在那了”——它假设 solid+motion 会动，而外壳根本不动。这是同一份机制在纯层假设与渲染层实现之间的分叉；它不会报错，只会让复位落点与画面不一致。

### 3.7 `hazard-contact` — 碰到危险物复位

| 链路节点 | 事实 | 证据 |
|---|---|---|
| 设计要求 | `kind:"hazard"`；碰到即失败（无血量），实际表现为退回起点、计数保留 | `vocabulary.ts:51-52`；`shell/scene.ts:343-359` |
| 机制声明 | 真实设计**未声明** `hazard-contact`；设计声明的是 `avoid-danger`（见 §3.10） | 冻结 `game-design.json` |
| 配置表达 | `kind:"hazard"`，可带 `motion` 做巡逻；物理体为静态体，每帧按 `hazardAnchor` 摆位 | `game-config.ts:51,103`；`world.ts:183` |
| 运行时实现 | overlap(player, hazard) → `hitHazard()`；`body.reset(spawn)` 并按 `floorY` 对齐 | `shell/scene.ts:157-161,352-359`；`hazard.ts:14-19`；witness `shell-mechanic-witness.test.ts:30` |
| 触发条件 | 玩家与 hazard 物理 overlap；巡逻 hazard 每帧更新静态体 | `shell/scene.ts:267-278` |
| 观测 | 没有 `hazard-hit` 事件；Playtest 只能从 `x` 突降回出生点附近推导 `reset`；`READ_STATE.hazards` 给几何/相位，不给命中计数 | `observe.mjs:111-115`；`probe-harness.mjs:226-240` |
| Playtest 判定 | **没有正向断言**。`reset` 只进入归因：`stuck` 条件含 `reset>=3`，会被判 `AGENT_LIMITATION`，不是机制成功/失败 | `cli/playtest.ts:237-241`；`playtest-attribution.ts` |
| Fixture/E2 | `hazard.test.ts` 的三角波；`shell-scene-wiring`；`self-test` 的 `hazard-legacy` **猴子补丁了旧 `hitHazard`**，验证 reset-floor 能抓住旧 bug——它**不是**当前实现的验收 | `hazard.test.ts:14-19`；`self-test.mjs:160-231`；`summary.json` 2026-10-29 |
| 是否只有 fixture？ | **否**：有真实 reset 样本；但无正向断言（self-test 是补丁旧实现） | 见下一行真实证据 |
| 见证强度 | **witness 不唯一**：`shell-mechanic-witness.test.ts:30` 的 needle 是 `this.hitHazard()`，而 `advanceDangers`（`scene.ts:303`）也调用它。删掉 hazard overlap 分支（`scene.ts:160`）但保留 danger 分支时，witness 仍绿 ⇒ 该见证不能单独证明 `hazard-contact` 仍在。 | `shell-mechanic-witness.test.ts:30`；`shell/scene.ts:160,303` |
| 真实证据 | 2026-10-27 失败样本（harness v1，冻结身份）：`reset=10`、`outcome=AGENT_LIMITATION`。外壳唯一的复位路径是 `hitHazard()`（hazard overlap 或 danger active），而该 config 没有 danger ⇒ 这 10 次来自 hazard 接触；当前 v2 成功样本 `reset=0`，没有接触 | `.scratch/playtest-v1/runs/2026-10-27-ticket-08/e2e-evidence/run/v1/playtest/v1/result.json`（`5f29592`）；冻结 `artifacts/reference/playtest-v1/attempt-v1/result.json` |
| 结论 | 实现 + 测试；**真实发生过，但无正向判定**；失败样本不能当机制成功 | 主状态 `TESTED`；验收 `UNKNOWN` |

### 3.8 `reach-goal` — 收集齐后到达终点

| 链路节点 | 事实 | 证据 |
|---|---|---|
| 设计要求 | `kind:"goal"` + `Objective{collect-then-reach,gate}`；只有 `gate` 指定的 goal 算赢 | `vocabulary.ts:53-54`；`game-config.ts:203-214` |
| 机制声明 | **设计 `mechanics[]` 未声明 `reach-goal`**；只在 `winConditions`「…抵达关卡终点撤离区」与 `levels.layout`「最终抵达最右侧出口」的自由文本里；意图层也没有对应机制 | 冻结 `game-design.json` / `game-intent.json` |
| 配置表达 | `objective.gate` 必须指向真实 goal；只有该 goal 有 `wins` | `game-config.ts:209-214,380`；`world.ts:181` |
| 运行时实现 | overlap(player, winning goal) → `tryWin()`；`collected >= pickupCount` 才置 `won` 并显示“到达终点” | `shell/scene.ts:163-170,361-366`；witness `shell-mechanic-witness.test.ts:31` |
| 触发条件 | 玩家与 gate overlap，且已收集足够 | 同上 |
| 观测 | `won`；Playtest `win` 事件；`gateReached` 启发式（玩家右边界/底边进入 gate 盒） | `observe.mjs:102,130-131,151` |
| Playtest 判定 | **成功**：`won=true` + `win` 事件 >=1 + `terminationReached`。**失败**：`won` 的否定条件只有在 `gateReached` 时才可判；否则记 `unknown`（“没赢”不等于“机制失败”） | `observe.mjs:157-166,204-209`；`acceptance-win-wasteland-v1.json` |
| Fixture/E2 | witness；`world.test.ts` 的 gate/wins；Playtest 测试；probe 的 collect-pickup 用 `won` 间接验证 | `world.test.ts`；`mechanic-probe.mjs:105-112` |
| 是否只有 fixture？ | **否**：真实交付 Playtest | 冻结 v2 / 06-attempt-1 |
| 真实证据 | 冻结交付 `win=1`、`won=true`、`playerX=1371`；harness v2 重跑同样 `win=1` | 冻结 v2 / 06-attempt-1 |
| 结论 | **配置→运行时→观测→Playtest 判定全链成立，交付级 E3**；但设计闭集声明缺失（自由文本有） | `E2E_VERIFIED`（配置起）；声明链缺一格 |

### 3.9 `open-chest` — 近距自动开箱

| 链路节点 | 事实 | 证据 |
|---|---|---|
| 设计要求 | `kind:"chest"` + 可选 `range`；近距自动触发、一次性奖励并入收集计数 | `vocabulary.ts:55-56`；`game-config.ts:104-105,245-249` |
| 机制声明 | 设计枚举 `open-chest`；意图“寻找宝箱” | 冻结 `game-design.json` / `game-intent.json` |
| 配置表达 | `entities[].kind="chest"`；`range` 缺省 0；`pickupCount` 数到 chest | `game-config.ts:104-105,248-249` |
| 运行时实现 | 每帧算玩家盒 × 外扩 `range` 的交互区；相交则 `openChest`：置 `opened`、切 open 帧、`collected+1`、刷 pips；一次性 | `shell/scene.ts:172-181,312-329`；witness `shell-mechanic-witness.test.ts:32` |
| 触发条件 | 玩家进入交互区；不依赖按键 | 同上 |
| 观测 | `chests[].opened`；Playtest `chest-open` 事件；`chestsOpened`；`collected` 增量 | `probe-harness.mjs:240-243`；`observe.mjs:97-100,128,153` |
| Playtest 判定 | **成功**：冻结 acceptance 断言 `chests-opened=2`、`chest-events>=2`；`all-collected=6`（4 pickup + 2 chest）间接确认奖励并入。默认 `success-basic` 只断言 `collected=6`，不断言 chest 事件。**失败**：没有交付级负向场景；probe 有“一次性”断言 | `acceptance-win-wasteland-v1.json`；`success-basic.json:50-56`；`mechanic-probe.mjs:115-143` |
| Fixture/E2 | witness；`world.test.ts` 的 range/pickupCount；probe（真 Chrome）；playtest 事件测试 | `world.test.ts:159-189`；`mechanic-probe.mjs:115-143` |
| 是否只有 fixture？ | **否**：真实交付 Playtest + 真 Chrome probe | 冻结 v2 / 07-acceptance |
| 真实证据 | 冻结交付 `chest-open=2`、`chestsOpened=2`、`collected=6`；来源 `5b8283f`/`5f29592`；harness v2 重跑同样 2/2 | 冻结 v2 / 06-attempt-1 |
| 结论 | **完整链路成立，交付级 E3**；交付的 `collected=6` 会在重复奖励时失败（>6），probe 显式覆盖“开箱后驻留不再增长”；没有交付级负向场景 | `E2E_VERIFIED` |

### 3.10 `avoid-danger` — 定时喷发与安全窗口

| 链路节点 | 事实 | 证据 |
|---|---|---|
| 设计要求 | `kind:"danger"` + 必填 `strike{periodMs,activeMs}`；idle↔active 周期，喷发窗口命中复位；规避 = 在 idle 窗口穿过 | `vocabulary.ts:57-58`；`game-config.ts:68-82,106-107,230-233`；`hazard.ts:21-32` |
| 机制声明 | 冻结设计声明 `avoid-danger`（意图 `dodge-hazards`）；**config 里没有 danger 实体** | 冻结 `game-design.json` / `game-config.json` |
| 配置表达 | `kind:"danger"` 必须带 `strike`；`periodMs` 是安全窗口、`activeMs` 是喷发窗口；命中区 = 实体盒 | `game-config.ts:230-233` |
| 运行时实现 | 每帧 `dangerState` 推周期、切 idle/active 帧；active 窗口内玩家盒与打击盒相交 ⇒ `hits+1`（每个窗口一次）+ `hitHazard()` 复位 | `shell/scene.ts:183-191,284-306`；`hazard.ts:28-32`；witness `shell-mechanic-witness.test.ts:33` |
| 触发条件 | 场景启动即周期计时；玩家在 active 窗口进入打击盒 | 同上 |
| 观测 | `READ_STATE.dangers[]`：`state` / `hits` / 盒 / `periodMs` / `activeMs` / `t`；Playtest `danger-erupt`（进入 active）与 `danger-hit`（hits 增量） | `probe-harness.mjs:244-263`；`observe.mjs:104-109` |
| Playtest 判定 | **没有交付场景断言**。唯一可用场景 `limitation-wide-patrol` 是 `required:false` + `mutate-hazard`，只进 harness 直跑，不进交付；`success-basic` / acceptance 都没有 danger 实体 | `scenarios/five-state/limitation-wide-patrol.json`；`cli/playtest.ts:88-101` |
| Fixture/E2 | `hazard.test.ts` 的 `dangerState` 周期；`playtest/tests/danger-forms.test.mjs` 的策略窗口；probe（真 Chrome，fixture pack + 合成 config） | `hazard.test.ts:38-58`；`danger-forms.test.mjs`；`mechanic-probe.mjs:146-174` |
| 是否只有 fixture？ | **否**：真 Chrome probe（fixture pack + 合成 config）；但没有交付级运行 | 07-acceptance |
| 真实证据（probe） | 2026-10-28，Chrome 156.0.8078.48，pack `fixtures/packs/last-train/v2`（manifest `sha256:145cb28d…`），合成 config `sha256:be9147a3…`，`passed=true`，57 个采样；`mechanic-coverage` 三条 `satisfied`；来源 `5f29592` | `.scratch/generic-playtest-v1/evidence/07-acceptance/probe/{avoid-danger/result.json,summary.json,mechanic-coverage.json}` |
| 真实证据（交付） | **无**：冻结交付 config 无 danger；真实 Playtest 的 `danger-hit=0` / `danger-erupt=0` 是“没有这个实体”，不是“躲开了” | 冻结 `game-config.json`；冻结 v2 `result.json` |
| 结论 | 实现 + 测试 + **fixture probe 的真实运行时证据**；**交付级链路断裂**；probe 只证明“danger 会喷发并命中”，**不证明“能规避”** | 主状态 `TESTED`；验收 `UNKNOWN`（delivery） |

**关键实证（声明 ≠ 配置 ≠ 发生）**：冻结设计 `mechanics` 含 `{id:"dodge-hazards", mechanic:"avoid-danger"}`；`game-config.json` 的 13 个实体里 `danger` 数量为 **0**，只有 2 个 `hazard`（带 x 轴 motion）。`buildMechanicCoverage` 仍会给 `avoid-danger` 三层 `satisfied`（因为它只读 design + 默认 probe 表），生产门禁因此放行。真实 Playtest 也 SUCCESS——**但声明的机制一次都没发生**。

---

## 4. 横切断点

### 4.1 声明 → 配置：没有任何机械保证

| 事实 | 证据 |
|---|---|
| config 编译器提示词不包含 `design.mechanics`；`designBrief` 只列 title/genre/camera/核心循环/player/world/四桶/levels，**没有 `mechanics[]`** | `packages/assets/src/prompt.ts:854-872`；`packages/assets/src/ops.ts:1132` |
| 提示词第 5 条把 `kind` 写成 `solid / pickup / hazard / goal / decor` —— **漏了 `chest` 和 `danger`** | `packages/assets/src/ops.ts:1103` |
| 给模型看的骨架 `gameConfigExample` 只有 pickup/solid/hazard/goal，**没有 chest / danger / strike / range** | `packages/assets/src/ops.ts:874-898` |
| 工具 schema 其实接受全部 7 种 kind + `motion` / `range` / `strike` | `packages/contracts/src/config-tool.ts:39,44-46` |
| 设计提示词的机制列表从 `MECHANICS` 插值（10 条），但散文字面仍写“8 个值” | `packages/game-design/src/prompts.ts:226,279,345` |
| QA 的 `visual-config-coherence` 只对账**设计四桶实体**与 config 实体，不对账 `mechanics[]` | `packages/qa/src/visual.ts:205-280` |
| 冻结交付：`open-chest` 有 `interactables[].type="chest"` 作为载体 → config 有 2 个 chest；`avoid-danger` 没有实体载体 → config 无 danger | 冻结 `game-design.json` / `game-config.json` |

**含义**：机制从 design 到 config 只靠“设计实体/自由文本”间接传达，LLM 可能把一条机制解释成另一种 kind，也可能完全省略。冻结交付的实际映射是：意图 `dodge-hazards`（“躲避危险和敌人”）→ 设计 `avoid-danger` → config **hazard 巡逻（`hazard-contact`）**。`hazard-contact` 与 `avoid-danger` 在自然语言里都与“躲避敌人”相近，但语义不同：前者是碰到就复位，后者是定时喷发 + 安全窗口。封闭枚举只能拒绝“词表外”，**不能判两条近义机制的映射对错**；机制覆盖门禁也不检查 config。

### 4.2 配置 → 运行时：`moving-platform` 的静默缺口

- `Motion` 与 `kind` 正交（`game-config.ts:54-66`），`Entity.motion` 任何 kind 都能写（`:103`）。
- 外壳只在 `case "hazard"` 读 motion（`scene.ts:157-161`），`case "solid"` 只加静态体（`:150`）。
- `world.ts:183` 把 motion 原样搬进 `EntityDesc`，但 `scene.ts` 的 solid 分支不消费它。
- `auditGameConfig` 只对 motion 越界报警告（`game-config.ts:509-512`），不拒绝 `solid + motion`。
- 设计层引用 `moving-platform` 会被 R12 拒绝（`build-design.ts:146-154`），但**手写 config / 手工 site 路径**可以绕过设计层，写进一份外壳不会执行的 motion。
- `floorYOf` 又把“带 motion 的 solid”当会动的实体排除（`world.ts:109-121`），与渲染层事实相反。

**含义**：这是“配置表达存在 ≠ 机制发生”的最明确例子；第二个 Demo 若把移动平台当作必要机制，当前管线既不能在设计中接受它，也不能在 config 中拒绝它，更不能在 Playtest 中观测它。

### 4.3 机制覆盖门禁：设计层自证，不碰配置，不碰 probe 结果

| 事实 | 证据 |
|---|---|
| `buildMechanicCoverage(design)` 只遍历 `design.mechanics` | `mechanic-coverage.ts:74-94` |
| 生产调用不传 `probeResults` | `create-game.ts:647` |
| 无 `probeResults` 时，`QA_PROBED_MECHANICS` 全部按 passed | `mechanic-coverage.ts:79-81` |
| 覆盖报告只用于即时门禁，**不写进 `qa-report.json` 或 delivery** | `QAReportSchema` 无该字段（`qa.ts:283-305`）；`buildMechanicCoverage` 调用点无落盘 |
| `not-tested` 不阻断；`failed` 才阻断，但生产永远不会传 failed | `mechanic-coverage.ts:59-65` |
| `hazard-contact` 实际发生但未被 design 声明 ⇒ 不在报告里；`avoid-danger` 被声明但未发生 ⇒ 在报告里且 `satisfied` | 冻结 design/config + 上述代码 |

**含义**：机制覆盖报告回答的是“设计声明的机制在这一代外壳的**词表/见证表**里是否有实现”，不是“这份交付的配置是否真的包含并触发了该机制”。它既不看 config，也不看真实运行；probe 结果只由 `test:mechanic` / 免费验收脚本在仓库外强制。

### 4.4 Playtest 判定：默认场景是 wasteland 专用常量

| 事实 | 证据 |
|---|---|
| CLI 默认场景目录 `packages/demo/probe/playtest/scenarios/five-state` | `cli/playtest.ts:23` |
| 只有 `harnessCondition="none"` 且 `required=true` 的场景进入交付 | `cli/playtest.ts:88-101` |
| 默认 `success-basic`：`target.siteVersion=1`、`initialActivePickups=4`、`collected=6`、`won=true` | `scenarios/five-state/success-basic.json:8-73` |
| 默认 `success-basic` 的动作只有 `move_to gate` + `wait_until won`；**不显式访问 4 个 pickup** | 同文件 `:15-27` |
| 冻结交付另用 effort 场景 `acceptance-win-wasteland-v1`（4 次 move_to pickup + wait collected 6 + reach_goal），断言 8 条（含 chest 事件） | `.scratch/fpvs-v1-final/scenarios/acceptance/acceptance-win-wasteland-v1.json` |
| `READ_STATE` 只认 `scene('shell')`；塔防场景 key 是 `td` | `probe-harness.mjs:210`；`demo/src/shell/td/scene.ts:45` |
| CLI `playtest` 要求 `delivery.site.status=pass` 且 `delivery.checks.qa=pass`；塔防 `site` 不写 delivery | `cli/playtest.ts:116-125`；research 03 |
| 否定条件只有 `won`/`collected`/`win`/`pickup` 在 `gateReached` 时可判；其余默认可判 | `observe.mjs:157-166` |
| `won` 没观察到但未到 gate ⇒ `unknown`，不是 `fail` | 同上 |

**含义**：

- 第二个 Demo 若 pickup/chest 数量不是 4/6，默认 `success-basic` 会失败；这是**场景常量不匹配**，不是机制失败。必须提供新的 `--scenario-dir`，而仓库没有生成场景的工具。
- 默认场景不断言 `chest-open`、`danger-*`、`reset`、`jump`/`land`；这些机制只能靠自定义场景或 probe。
- 塔防既过不了 CLI 的 delivery 前置，也读不到 `scene('shell')`；结构性不可 Playtest。
- “执行器没走到”不等于“游戏失败”：`won` 否定不可判时是 `unknown`；`AGENT_LIMITATION`/`TIMEOUT` 也不自动判机制失败。这是正确方向，但也意味着**机制失败可能被归因为执行器限制而漏判**。

### 4.5 观测：哪些机制根本没有可判定信号

| 机制 | 可观测状态/事件 | 能否判“发生” | 能否判“成功/失败” |
|---|---|---|---|
| `run` | `x/vx`、trace | 能（间接） | 否（无断言） |
| `jump` | `onFloor`、`jump/land`（推断） | 能（推断） | 否（无断言） |
| `gravity` | `y/vy/onFloor` | 能（间接） | 否 |
| `collide-terrain` | `x/y/onFloor/solids` | 能（间接） | 否 |
| `collect-pickup` | `pickups[].active`、`pickup` 事件、`collected` | 能 | **能**（真实） |
| `moving-platform` | **无**（solid 无 motion 状态） | 否 | 否 |
| `hazard-contact` | `reset` 事件（启发式） | 能（推断） | 否（无正向断言） |
| `reach-goal` | `won`、`win` 事件、`gateReached` | 能 | **能**（真实） |
| `open-chest` | `chests[].opened`、`chest-open`、`chestsOpened` | 能 | **能**（真实） |
| `avoid-danger` | `dangers[].state/hits`、`danger-erupt`/`danger-hit` | 能（probe） | probe 只判“会命中”，不判“能规避” |

### 4.6 “状态字段存在 ≠ 机制发生”的实例

1. `design.mechanics` 里有 `avoid-danger`，`config.entities` 里没有 `danger`；覆盖报告仍 `satisfied`。
2. `config.entities[].motion` 存在，`solid` 却从不移动。
3. `playtest-result.eventCounts` 永远含 `danger-hit:0`、`reset:0`；字段存在不等于发生过。
4. `delivery.playtest.aggregate="SUCCESS"` 只说明本次场景成功，不说明每条声明机制都发生。
5. `QA_PROBED_MECHANICS` 包含 `avoid-danger`，不等于生产构建时跑过 probe。
6. `collected=6` 同时包含 pickup 与 chest；单看 `collected` 无法区分两个机制，必须看 `pickup`/`chest-open` 事件或 `chestsOpened`。

### 4.7 “执行器无法完成动作 ≠ 机制成功/失败”的实例

1. 2026-10-27 的 `reset=10` 失败样本被判 `AGENT_LIMITATION`：真实发生了 hazard 接触，但运行失败；不能把它读成 `hazard-contact` 验收通过或游戏机制失败。
2. `self-test` 的 `hazard-legacy` 故意猴子补丁旧 `hitHazard`，验证“旧 reset-floor 会被抓住”；它证明的是自测有判别力，不是当前 `hitHazard` 成功。
3. `failure-missing-pickup` 是故意移除 pickup 的负向夹具；它失败是设计好的，不是管线缺陷。
4. `won` 没观察到但未到 gate ⇒ `unknown`；不能把“执行器没走到终点”判成 `reach-goal` 失败。
5. `jump` 策略在连续 3 次未离地后降级为“不跳”，并可能记 `jump-exhaustion`；这是执行器能力边界，不是跳跃机制验收。
6. 默认 `success-basic` 在第二个 Demo 上失败时，先怀疑场景常量（4/6/site v1），不要先判游戏失败。

---

## 5. 塔防（不在机制词表内）

| 属性 | 事实 | 证据 |
|---|---|---|
| 契约 | `td-config/v1` 兄弟格式；`attack` single/aoe、`targeting` first/strongest、`slow`、两级机关、敌人、波次、经济、HUD | `packages/contracts/src/td-config.ts:33-280` |
| 纯层实现 | `stepOnce`：建造/升级/开波/出怪/推进/漏怪/开火/伤害/护甲/减速/死亡/清波/胜负 | `packages/demo/src/td/sim.ts:107-249` |
| 站点外壳 | 同一份 bundle 按 `format` 分派；塔防场景 key=`td` | `demo/src/shell/entry.ts:65-67`；`demo/src/shell/td/scene.ts:45` |
| 装配期判据 | `auditTdConfig`（引用/自洽/几何）+ `auditWinnable(playReference(world),world)` | `demo/src/td/site.ts:134,146` |
| 可通关判据 | 只有一条：`lost && killed===0`（退化的输）；其余是带尺子的诊断，不是判据 | `demo/src/td/winnable.ts:84-123` |
| E2 | `td-sim.test.ts`、`td-winnable.test.ts`、`td-world.test.ts`、`td-site.test.ts` | `packages/demo/tests/td-*.test.ts` |
| 设计声明 | **无**：塔防没有 `GameDesignSpec` / `mechanics[]`，`compile-td-game` 从需求文本 + 包直接产 config | research 03；`ops.ts` `compileTdGame` |
| QA / delivery | **无**：`publish-gate` 显式跳过 TD；`site` 不写 delivery | `publish-gate.ts:16-18,145-147`；research 03 |
| Playtest | **结构性不可**：CLI 要 delivery；`READ_STATE` 写死 `scene('shell')`，TD 是 `td` | `cli/playtest.ts:116-125`；`probe-harness.mjs:210`；`td/scene.ts:45` |
| 真实 E3 | **未发现**塔防的真实浏览器 Playtest / 交付级运行；只有纯层仿真与装配测试。旧的实验站点（`.scratch/game-maker-v2/experiments/72-two-shell-size/site/counter-siege/site/v1/`）不是本基线证据 | 本票检索 |
| 结论 | 塔防“实现 + 测试 + 参考玩家判据”成立；**机制声明/QA/交付/Playtest 链不成立**；不能因 `compile-td-game` 存在就判“塔防端到端支持” | 主状态 `TESTED`（实现事实）；验收 `UNKNOWN` |

---

## 6. 能力边界（非机制）

`CAPABILITIES` 8 条（`vocabulary.ts:130-147`）由 `shell-capability-witness.test.ts:31-42` 逐条钉源码：

`input:keyboard` · `camera:side-scroll` · `camera:parallax` · `collision:aabb` · `motion:cyclic` · `objective:collect-then-reach` · `hud:screen-space` · `coord:delivery-pixels`。

- 注意 `motion:cyclic` 作为**能力**是成立的（hazard 用它）；作为**机制** `moving-platform` 是不成立的（solid 不用它）。能力表描述“外壳能承载什么”，机制表描述“玩家能玩出什么”；不要把前者当后者。
- 真实运行能观测到：键盘输入、横版相机、AABB 碰撞、收集目标、HUD 屏幕空间（视觉记录）；视差与坐标 1:1 有视觉/结构性证据，但没有机制级断言。本票不把它们混入机制验收。

---

## 7. 实现 vs 验收总表

| 机制 | 实现 | E2 | 真实运行 | 交付级验收 | 主要缺口 |
|---|---|---|---|---|---|
| `run` | 有 | witness | 间接（位移） | 无断言 | 机制级 pass/fail 缺失 |
| `jump` | 有 | witness + policy | 间接（9 jump/land） | 无断言 | 同上；执行器降级 ≠ 判定 |
| `gravity` | 有 | witness | 间接 | 无声明、无断言 | 设计未声明 |
| `collide-terrain` | 有 | witness + capability | 间接 | 无声明、无断言 | 设计未声明 |
| `collect-pickup` | 有 | witness + world + probe | **交付 E3** | **E2E_VERIFIED** | 单 Demo / 单场景 |
| `moving-platform` | **无** | schema/witness null | 无 | `BLOCKED` | 运行时缺失；config 可静默绕过 |
| `hazard-contact` | 有 | hazard + self-test（补丁旧实现） | **真实 reset=10（失败样本）** | `UNKNOWN` | 无正向断言/probe |
| `reach-goal` | 有 | witness + world + playtest | **交付 E3** | **E2E_VERIFIED**（配置起） | 设计 `mechanics[]` 未声明；`won` 否定多判 `unknown` |
| `open-chest` | 有 | witness + world + probe | **交付 E3** | **E2E_VERIFIED** | 一次性只有 probe；交付无负向 |
| `avoid-danger` | 有 | hazard + probe | **probe E3（fixture）** | `UNKNOWN`（delivery） | 配置断链；覆盖门禁假 `satisfied`；probe 不判“规避” |

计数：**实现 9/10；交付级 E3 3/10（严格闭集声明起点的全链 2/10）；真实运行间接观测 4/10；仅 probe 1/10；真实发生无判定 1/10；无运行时 1/10**。
**交付级 E3 的失败路径 0/10**：交付内真实运行都是 SUCCESS；失败/限制/超时状态只有 E2（见 research 06）。

---

## 8. 对第二个 Demo 的机制含义（供 07/08 使用）

1. **只有 3 条机制能被当前交付路径验收**。候选若把 `avoid-danger`、`moving-platform` 或 `hazard-contact` 当作核心玩法，当前管线不能给出交付级证明；`move`/`jump`/`gravity`/`collide` 也只能靠间接的 `won`。
2. **“设计通过”不等于“机制可做”，反过来也一样**：`avoid-danger` 冻结设计通过了 R12 和机制覆盖门禁，config 里却没有 danger；`reach-goal` / `hazard-contact` 在 config 里真实发生，却不在 `design.mechanics[]`。第二个 Demo 的候选评估必须逐个检查“设计要求 → config 实体/参数 → probe/scenario 断言”，不能只看 `design.mechanics`，也不能只看 config。
3. **默认 Playtest 场景不可复用**：`success-basic` 的 4 pickup / 6 collected / site v1 是 wasteland 专用；任何新 Demo 必须自带 `--scenario-dir`，且新场景的断言要按机制写，否则“失败”只是常量不匹配。
4. **新机制（不在 10 条词表）在设计中直接不可表达**：二段跳、攻击、血量、交互/推箱/切换、俯视移动等都会被 `GameDesignSpec.mechanics` 的封闭枚举或 R12 拒绝；这不是配置问题，是外壳能力问题。
5. **TD 不能作为“已支持”的旁路**：它没有设计/QA/delivery/Playtest；`compile-td-game` 能产 config 不等于端到端可验证。

---

## 9. 证据索引

### 9.1 代码与契约（基线 `2c1a9d5`）

| 主题 | 路径:行 |
|---|---|
| 机制词表 / 状态 / probe 表 / 能力 | `packages/contracts/src/vocabulary.ts:38-59,64-118,130-147` |
| RuntimeProfile 与注册表 | `packages/contracts/src/runtime-profile.ts:114-129` |
| 机制覆盖报告 / 门禁 | `packages/contracts/src/mechanic-coverage.ts:29-116` |
| `game-config/v1` 构造 | `packages/contracts/src/game-config.ts:51,60-82,97-107,115,140-147,169-187,203-214,225-249,509-512` |
| `td-config/v1` 构造 | `packages/contracts/src/td-config.ts:33-280` |
| 设计层 R12 | `packages/game-design/src/build-design.ts:136-158` |
| 设计提示词机制列表 | `packages/game-design/src/prompts.ts:226,278-281,345` |
| config 提示词 / 骨架 / designBrief | `packages/assets/src/ops.ts:874-898,1103,1132`；`packages/assets/src/prompt.ts:854-872` |
| config 工具镜像 | `packages/contracts/src/config-tool.ts:39,44-46` |
| 外壳（横版） | `packages/demo/src/shell/scene.ts:79-96,129-131,149-194,225,267-306,312-337,352-366` |
| 纯层（横版） | `packages/demo/src/world.ts:109-121,173-187`；`packages/demo/src/hazard.ts:14-32` |
| 塔防纯层 / 站点 / 判据 | `packages/demo/src/td/sim.ts:107-249`；`td/site.ts:134,146`；`td/winnable.ts:84-123`；`td/world.ts:77` |
| 塔防场景 key | `packages/demo/src/shell/entry.ts:65-67`；`packages/demo/src/shell/td/scene.ts:45` |
| 生产门禁接入 | `packages/pipeline/src/create-game.ts:647-650` |
| Playtest CLI / 默认场景 | `packages/cli/src/playtest.ts:23,88-101,106-162,345-430` |
| Playtest 状态探针 / 事件推导 | `packages/demo/probe/probe-harness.mjs:207-267`；`packages/demo/probe/playtest/observe.mjs:86-115,147-221` |
| Playtest 事件闭集 | `packages/contracts/src/playtest.ts:64-77,113-132` |
| 机制 probe | `packages/demo/probe/mechanic-probe.mjs:94-175,179-186,281-284` |
| 写回 | `packages/pipeline/src/playtest.ts:27-76` |

### 9.2 测试（E2）

| 测试 | 覆盖 |
|---|---|
| `packages/demo/tests/shell-mechanic-witness.test.ts` | 10 条机制的源码行为串；`moving-platform:null` |
| `packages/demo/tests/shell-capability-witness.test.ts` | 8 条能力的行为串 |
| `packages/contracts/tests/vocabulary.test.ts` | EntityKind→机制、负面词表、状态推导 |
| `packages/contracts/tests/mechanic-coverage.test.ts` | 三层矩阵、`not-tested` 不阻断、`moving-platform` 失败 |
| `packages/demo/tests/hazard.test.ts` | `hazardAnchor` / `dangerState` |
| `packages/demo/tests/world.test.ts` | chest/danger 映射、`pickupCount` 数到 chest |
| `packages/game-design/tests/build-design.test.ts:190-204` | R12 拒绝 `moving-platform` |
| `packages/demo/probe/playtest/tests/*` | 观测/策略/终止/危险形态（E2，非真实浏览器） |
| `packages/pipeline/tests/playtest.test.ts` / `playtest-baseline.test.ts` | 报告/交付投影（fixture） |

本票在 HEAD 运行 6 个机制相关文件：`vocabulary` / `mechanic-coverage` / `shell-mechanic-witness` / `shell-capability-witness` / `hazard` / `world` —— **89/89 pass**（2026-10-29）。

### 9.3 真实证据（E3）

| 证据 | 路径 | 身份 / 来源 commit / 说明 |
|---|---|---|
| 冻结交付身份 | `.scratch/fpvs-v1-final/artifacts/identity.json` | 生成 `040b907`；冻结 `5b8283f`；pack `wasteland-scavenger-recipe` v1、site v1、shell 2；manifest `sha256:a162942d…feb3`、config `sha256:455d9c7f…5dcd` |
| 冻结 demo config | `.scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/run/v1/game-config.json` | 同 config checksum；实体：4 pickup / 2 hazard(motion) / 4 solid / 2 chest / 1 goal / **0 danger** |
| 冻结 demo design | `.../run/v1/game-design.json` | `sha256:20878809…`；`mechanics` = run / jump / collect-pickup / open-chest / **avoid-danger** |
| 冻结 Playtest v2 | `.../run/v1/playtest/v2/result.json` | `sha256:1826a5e1…`；harness/rules v1；SUCCESS；pickup 4 / chest-open 2 / win 1 / jump 9 / land 9 / danger-hit 0 / reset 0；`5b8283f`（地图 Q6 的 `5f29592` 证据集） |
| harness v2 重跑 | `.scratch/generic-playtest-v1/evidence/06-attempt-1/attempt-v1/result.json` | `sha256:f80d2b89…`；harness/rules v2；同一 pack/config 身份；raw 无 outcome；来源 `8e92c69` |
| hazard 真实复位样本 | `.scratch/playtest-v1/runs/2026-10-27-ticket-08/e2e-evidence/run/v1/playtest/v1/result.json` | harness v1；`reset=10`、`outcome=AGENT_LIMITATION`；已提交于 `5f29592` |
| 机制 probe 汇总 | `.scratch/generic-playtest-v1/evidence/07-acceptance/probe/summary.json` | `sha256:7d38bae0…`；Chrome 156.0.8078.48；pack `fixtures/packs/last-train/v2`（manifest `sha256:145cb28d…`）；3/3 passed；`5f29592` |
| 机制 probe 结果 | `.../probe/{collect-pickup,open-chest,avoid-danger}/result.json` | 合成 config：`collect` `sha256:758d50aa…` / `chest` `sha256:001cdbac…` / `danger` `sha256:be9147a3…` |
| 机制覆盖（fixture） | `.../07-acceptance/mechanic-coverage.json` | `sha256:d4b8b05b…`；8 条 fixture 设计机制；`avoid-danger` 三层 satisfied |
| 免费验收总判 | `.../07-acceptance/free-acceptance.json` | `sha256:804268c1…`；vitest + probe + coverage 全绿 |
| 早期 probe | `.scratch/intent-to-mechanics-v1/runs/2026-10-23-mechanic-probe/summary.json` | `sha256:ec0dc917…`；Chrome 155；同 pack；3/3 pass；来源 `d3e9137` |
| Playtest 自测 | `.scratch/playtest-v1/runs/2026-10-29-self-test/summary.json` | `sha256:18143056…`；`hazard-legacy` 使用**猴子补丁旧实现**，不是当前机制验收 |
| 最终证据重验 | `.scratch/evidence-integrity-v1/runs/2026-10-29T05-04-57Z-final-acceptance/report.json` | `2c1a9d5`；清单 `ba7a485b…`；只证明冻结证据完整性，不证明机制行为 |

**代码同一性核对**：`shell/scene.ts` / `world.ts` / `hazard.ts` / `game-config.ts` / `vocabulary.ts` / `probe-harness.mjs` / `mechanic-probe.mjs` / `create-game.ts` / `cli/playtest.ts` 在 `5f29592` 与 `2c1a9d5` 的 sha256 **相同**。因此上述 probe 与 Playtest 的运行时/探针代码适用于基线；但冻结 Playtest 报告是 harness/rules v1，且冻结 delivery 信封不是当前 `buildAndSite` 写出的（research 03）——E3 只证明该交付的运行时行为，不证明当前生成链能重建同一交付。

---

## 10. 审计限制

1. **没有新跑真实浏览器**：所有 E3 都是读既有产物；本票未产生新的 probe/Playtest 证据。`test:mechanic` / `test:acceptance` 按票 02 只允许在“确实需要新观测”时使用，本票不需要。
2. **只有一个真实 Demo / 一个设计 / 一个成功样本**：冻结 wasteland（pack/site v1）不能外推到第二个玩法、第二个设计或不同关卡。`collect-pickup` / `open-chest` / `reach-goal` 的 E2E 只对 4 pickup + 2 chest + 1 goal 的场景成立。
3. **交付级 E3 的 harness 是 v1**：当前基线是 harness/rules v2；虽然 `scene.ts` / probe 代码同一，Playtest 报告生产者为 v1。harness v2 只有 raw 重跑（未归因、未写回），不能替代 v2 CLI 写回的 E3（research 06）。
4. **冻结 delivery 信封是 effort 脚本初始化的**：不是当前 `buildAndSite` 的产物（research 03）；因此 E3 证明“这份冻结交付的机制行为”，不证明“当前创建链会产出同样的 delivery”。
5. **probe 使用 fixture 包 + 合成 config**：不是设计生成的真实 config；`avoid-danger` 的 probe 只证明外壳行为，不证明“某个设计的 danger 配置能生成并被交付”。
6. **Playtest 事件是轮询状态差**：瞬态事件可能结构性漏采；`pickup`/`danger-hit` 等计数在两次成功读取之间可能漏（research 06 §2）。本票不把“未观察到”外推为“未发生”。
7. **塔防没有真实 E3**：只有纯层测试/参考玩家判据；旧实验站点不是本基线证据。塔防的 `killed==0` 只是“退化的输”，不是“机制验收”。
8. **未运行全量 `pnpm test`**：只跑了 6 个机制相关文件（89/89）；全量测试基线见票 01（149 文件 / 2,231 tests）。两者不矛盾，但本票的 E2 断言只覆盖机制相关文件。
9. **未读本地凭据、未改生产代码/契约/测试/历史产物、未提交/推送**：工作区与审计开始时一致（仅本 effort 文件和未跟踪 PRD）。
