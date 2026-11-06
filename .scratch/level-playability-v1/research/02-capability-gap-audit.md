# 现有可玩性能力与缺口源码审计（02）

- **Date**：2026-11-04
- **Baseline**：`main` @ `fa17c14`（PR #27 合并后）。本票工作树 HEAD `b2e8b7e`；
  `git diff --stat fa17c14 HEAD -- packages fixtures docs CONTEXT.md package.json` 输出为空
  ⇒ 生产代码、fixture、文档与基线一致。本报告的 `file:line` 可直接按基线读。
- **Nature**：只读研究。未修改生产代码、测试、fixture、契约或历史语料；未 commit / 建分支 / 推送；
  零模型调用、零生图、零站点重建。只读分析脚本写在
  `.scratch/level-playability-v1/research/02-corpus-scan.mjs` 与 `02-gap-probes.mjs`。
- **Input**：本票 `issues/02-capability-gap-audit.md`、`map.md`、`rulings-2026-11-04.md`、
  `docs/v7.7/配置.md` §13、P1 的四张收口票、当前源码与既有测试。
- **证据级别**：E1 = `file:line`；E2 = 既有测试名 + 断言；E3 = 零付费只读复跑 / 语料重判
  （命令、退出码、路径、计数）。**仅历史推断**的句子会显式标「历史推断」。

---

## 0. 结论速览

| # | 问题 | 结论 | 证据 |
|---|---|---|---|
| 1 | 现有能力里有没有真正的「关卡可玩性」判据？ | **只有一条半**：`auditReachability`（终点 / pickup 的静态可达性）+ `auditGameConfig` 的台阶 / 行程**警告**。其余是引用、身份、HUD、背景、机制存在性。 | E1 |
| 2 | 它能否证明「不可玩」？ | **能证明「从出生点到不了某个目标」**，不能证明「关卡可完成」。空数组只代表「没发现阻断」，不是「保证可通关」。 | E1 + E2 + E3 |
| 3 | 最大漏报在哪？ | ① **chest 根本不是 reachability 的 target**，而 `pickupCount` 与 `tryWin` 把 chest 算作必需收集物；② **只从出生点出发**，不检查「拿到 pickup 之后还能否到 gate」（单向坑）；③ 出生点埋在 terrain 里不报；④ solid 的 `motion` 被当整段平台、运行时却是静态体；⑤ hazard/danger 被当空气，没有任何安全窗口 / 时序判定。 | E1 + E3 |
| 4 | 最大误报在哪？ | `auditReachability` 的 BFS 只建**跳跃弧**边、不建「走路」边：一条几何净空 60px（玩家高 48，头顶余量 12px）的低天花板走廊是走得通的，它会把两端目标都报成「够不到」。 | E3（probe F） |
| 5 | QA 有几条判据？ | 代码里实际是 **7 条**（不是多处注释写的 6 条）；gate / verdict 都按 `QA_JUDGEMENTS.length` 比较，所以功能上要求 7/7。 | E1 + E3 |
| 6 | 三态 `PROVEN_UNPLAYABLE` / `INSUFFICIENT_EVIDENCE` / `NO_PROVEN_BLOCKER` 存在吗？ | **不存在**。全仓没有这三个标识符；现有最接近的是 `QA fail/incomplete/pass`、`Playtest 五态+UNKNOWN`、`Delivery fail/blocked/incomplete/pass`。三态若要成为契约输出，是**新契约形状**。 | E1 + E3 |
| 7 | 历史语料能否直接重判？ | **不能直接**：171 份 manifest 里 81 份不是 `assetpack/v4`（v1 13 · v2 66 · v3 2），当前 `parseAssetPack` 只收 `assetpack/v4`；只读归一化后 152 份 config（21 份唯一内容）中 96 份能配对，`reachability` 新增 error **0**。 | E3 |
| 8 | 新增判据会不会改变失败阶段？ | **取决于放在哪一族**：放进 `auditConfigPipeline` 的 `deterministic`（如 `auditReachability` 内部）= 编译 / 汇合点硬拒、不进 QA；放进 `resampleable` / `auditGameConfig` = 被当「模型错」重采样三次；放在 `publish-gate` 之外 = standalone `site` 不执行。 | E1 |

**一句话**：现有能力足以支撑「从出生点够不到某个 pickup / gate」这一条窄判据，并已在 P1 被接进
编译、汇合点与发布闸；但它**不覆盖 chest、不覆盖收集后的返回路径、不覆盖 hazard/danger 的时序、
不覆盖 moving solid 的真实语义**，而且有一个已复现的低天花板误报边界。把这些缺口补成
`PROVEN_UNPLAYABLE` 判据，至少要新增纯算法与三态结果语义，**不是「把现有函数再调一次」**。

---

## 1. 调用链：哪些检查在何时跑、吃什么、产出什么、失败如何分档

### 1.1 全链一览

| 阶段 | 入口 / 位置 | 跑的检查 | 输入 | 产出 | 失败分档 |
|---|---|---|---|---|---|
| 理解段 | `pipeline/src/create-game.ts:767-782`（`createGame` → `runUnderstanding`） | 设计 / 意图 / DNA / VDS / 清单契约与覆盖闸；机制状态 `mechanic-experimental` 在设计层拒绝 | 需求、参考图、上游 | `run/v<N>/` 文书 | `invalid` / `upstream`；不在本票「可玩性」范围 |
| 构建段 · pack | `create-game.ts:540-567` | 生图、打包、checksum 完整性 | recipe + 上游 | `pack/v<N>/` | 失败即停，不产 config / QA / site |
| 构建段 · config | `create-game.ts:573-643` → `assets/src/ops.ts:1081-1320`（`compileRuntime`） | ① 契约 `parseGameConfig`；② 确定性钳位 `clampToWorld`；③ **resampleable**：`auditGameConfig` + `auditEntityIdentity`（有 design 时）+ `auditScreenSpace`；④ 循环后 **deterministic**：上面全部 + `auditLayerCoverage` + `auditReachability` | config 候选、manifest、design、levelId、viewport、hud 行高 | 通过的 config 落 `<out>/<id>/game-configs/v<N>.json`；失败只留账 | 循环内 error → `classifyConfigIssues`：`packRooted` 立即 `invalid`（attempts=1）；`configFixable` 重采样最多 3 发（`STRUCTURED_CALL_ATTEMPTS=3`，`contracts/src/structured-call.ts:25`）后 `invalid`；循环后 deterministic error → `invalid`、**不落盘**；warning 只进摘要 |
| 构建段 · 汇合点 | `create-game.ts:621-643` | **同一个** `auditConfigPipeline(...).deterministic.filter(error)` | 刚从磁盘读回的 config、pack manifest、design、`levels[0]`、viewport | 错误列表 | `invalid`，在 QA / site 之前；`reuseConfig` 与编译两条路径共用 |
| QA | `create-game.ts:645-734`；三个族 + 层覆盖（由合成器直接跑） | 玩法族 `reference-resolution` / `reachability`（`qa/src/gameplay.ts:71-86`）；层覆盖（`qa/src/layers.ts:48-60`）；视觉、意图族；机制覆盖门禁 | `packDir`、`configPath`、`intentPath`、`designPath`、`vdsPath`、viewport | `run/v<N>/qa-report.json`（落盘在阻断之前） | 判据 error 或 `checked` 不满 `QA_JUDGEMENTS.length` → `invalid`（`create-game.ts:237-262`）；同时落 `delivery`（qa=fail/incomplete，site/playable-smoke=blocked） |
| QA 后 · 机制覆盖 | `create-game.ts:716-723` | `buildMechanicCoverage(design, config)`：design/runtime/config 三层；`qa=not-tested`（build 不跑 probe） | design + config | `mechanic-coverage/v2` 核心（CLI 站点成功后落盘） | 任一机制 `design/runtime != satisfied`、`config.missing`、`qa=failed` → `invalid`；`not-tested` 不阻断 |
| 发布闸 | CLI `cli.ts:266-284`（build/create）、`cli.ts:717-721`（site）；MCP `server.ts:372-399,433-438`；`pipeline/src/publish-gate.ts:167-227` | 报告存在 + 属于当前包（pack id/version/manifestChecksum）+ 无 error + `checked` 满；**现场重跑 `auditReachability`** | `packDir`、`configPath`、`qaReportPath` / `outRoot` | 报告与路径 | `invalid`（退 4），在 `assembleSite` 之前；TD 显式跳过 |
| 站点装配 | `demo/src/site.ts:169-217` | `auditGameConfig`（含 `auditReferences` 与自洽族）+ `auditScreenSpace` + `auditGeometry`（层覆盖 / coverage 比例 / 近端探出警告） | pack、config、viewport | `site/v<N>/` | error → `invalid`，**一个目录都不写**；warning 只报告。**不跑** `auditReachability` / `auditEntityIdentity` / QA |
| 试玩 | CLI `cli/src/playtest.ts:375-468`；`pipeline/src/playtest.ts:28-95`；`contracts/src/playtest-attribution.ts:99-184` | 撤销旧 `playable-smoke` → harness（默认五态场景）→ 归因 → 身份校验 → 写回 | run 目录、site、scenario 目录 | `run/v<N>/playtest/v<K>/`、`delivery.playtest`、`playable-smoke` | **不阻断 build**。`GAMEPLAY_FAILURE` → `playable-smoke=fail`；`ENVIRONMENT_FAILURE` → `blocked`；`TIMEOUT` / `AGENT_LIMITATION` / `UNKNOWN` → `incomplete`；`SUCCESS` → `pass`。无 `PROVEN_UNPLAYABLE` |
| 交付结论 | `contracts/src/delivery.ts:46-56,79-101`；`pipeline/src/delivery.ts:53-112` | 六个检查项状态合成 `verdict` | 各阶段结果 | `qa-report.json` 的 `delivery` | `fail > blocked > incomplete > pass`；试玩 / 视觉未完成时整份仍 `incomplete` |

### 1.2 关键分档细节

- **`auditConfigPipeline` 两档是超集关系**：`deterministic = resampleable + 层覆盖 + reachability`
  （`contracts/src/config-audit.ts:39-56`）。调用方只 filter error；warning 不阻断。
- **`compileRuntime` 的循环内只看 `resampleable`**（`assets/src/ops.ts:1247-1269`）：
  `auditGameConfig`（引用 + 自洽 + 台阶 / 行程 warning）、`auditEntityIdentity`、`auditScreenSpace`
  的 **error** 都是「模型下一发可能写对」；`packRooted` 是清单根因，立即硬拒。
- **循环后只看 `deterministic`**（`ops.ts:1278-1295`）：层覆盖 + reachability 是「重抽 config 改不了」
  的确定性失败，**不重采样、不落盘**。
- **汇合点**（`create-game.ts:621-643`）对 `reuseConfig` 与编译两条路径跑同一份 deterministic；
  因此人工改过的 config / 换过 manifest 的复用路径也过 reachability。这是 P1 · B-02 之后的形状。
- **QA 的 reference / reachability 在链上通常恒绿**：能走到 QA 的 config 已经被编译或汇合点挡过
  （`qa/src/gameplay.ts:21-35`）。它们只在 standalone QA、手改 config、或发布闸之外的库调用上真会响。
- **站点不重跑 reachability / identity**：`site.ts` 的 import 与调用表里没有这两个函数
  （`demo/src/site.ts:17,195-217`）。standalone `site` 靠发布闸的 `auditReachability` 补；
  库直调 `assembleSite` 不过闸（`publish-gate.ts:6-8` 明写边界）。
- **`verify-mechanics` 不在 build 链里**：build 只写 `probe.executed=false` 的报告
  （`create-game.ts:716-723` + CLI `cli.ts:295-301` 注释）；`verify-mechanics` 是独立 CLI
  （`cli.ts:868`），启动 Chrome 跑 4 条 probe（`cli/src/verify-mechanics.ts:110-185`）。

---

## 2. 现有判据清单

> 方向约定：**误报（false positive）** = 关卡实际可玩 / 设计合法，判据却报 error；
> **漏报（false negative）** = 关卡实际不可完成，判据不响。

### 2.1 总表

| 判据 / 检查 | 家 | 严重度 | 是否阻断 | 是否属于「可玩性」 | 备注 |
|---|---|---|---|---|---|
| `auditReachability` | `contracts/src/reachability.ts:44-226` | error | 是（deterministic） | **是**（空间可达性） | 只报「够不到」，不报「可达」 |
| `auditGameConfig` · 引用族 | `contracts/src/game-config.ts:335-429`（由 `:503-506` 调用） | error | 是（resampleable） | 间接 | 资源存在 / kind / 动画 / 帧数 / gate |
| `auditGameConfig` · 自洽族 | `game-config.ts:508-561` | error | 是（resampleable / 汇合点） | 间接 | 出界、出生点卡 solid、HUD 面板尺寸 |
| `auditGameConfig` · 可通关族 | `game-config.ts:563-584` | **warning** | 否 | **半条** | 台阶高、周期行程越界 |
| `auditLayerCoverage` | `contracts/src/layer-coverage.ts:137-155` | error | 是 | 否 | 背景层盖不住世界（视差几何） |
| `auditScreenSpace` | `contracts/src/screen-space.ts:49-75` | error | 是 | 否 | HUD 必须在视口内 |
| `auditReferences` | `game-config.ts:335-429` | error | 是 | 间接 | 独立函数，QA `reference-resolution` 与 `auditGameConfig` 共用 |
| `auditEntityIdentity` | `game-config.ts:648-708` | error | 是（resampleable） | 间接 | 设计实体 ↔ config `sourceIntent` 对账 |
| 机制覆盖 | `contracts/src/mechanic-coverage.ts:167-202` | 报告级 `verdict` | 是（机制门禁） | 机制组合的**存在性** | 不是第七条 QA 判据 |
| QA 玩法族 | `qa/src/gameplay.ts:71-86` | 继承 issue severity | 是（QA gate） | **是** | `reference-resolution` + `reachability` 两条 |
| Playtest 归因 | `contracts/src/playtest-attribution.ts:99-184` | 五态 + `UNKNOWN` | 只改 `playable-smoke` | **试玩证据，不是判据** | `AGENT_LIMITATION/TIMEOUT` 不得转成不可玩 |

### 2.2 逐条

#### A. `auditReachability`（`packages/contracts/src/reachability.ts:44-226`）

- **输入**：`GameConfig` + `AssetPackManifest`。它只需要 manifest 的 `player.asset` 的 `size` / `anchor`，
  以及 `solid` 实体的 `asset` / `body` / `anchor`；不读 design、viewport、VCS。
- **输出**：`ConfigIssue[]`，逐条 `severity:"error"`、`where: entity "<id>"`、message 以「够不到」开头
  （`:215-224`）。一条都没有 = 通；**从不产 warning，也从不产「可达」**（`:20, :42-43`）。
- **算法**（E1）：
  - 实心体 = `terrain` + `kind:"solid"` 实体；带 `motion` 的 solid 用**整段行程**的包围盒
    （`:60-73`）。
  - 状态 = **脚点**（盒子底边中点），不是 `at` 锚点（`:75-86`）；`blocked` / `freeAt` 是整数格点
    （`:88-114`）；世界底**不是地板**，只有 `terrain` / solid 是地板（`:107-113`）。
  - 靶子 = **每一个 `kind:"pickup"` + `objective.gate` 指向的 goal**（`:124-129`）。**没有 chest。**
  - 「够到」= 轨迹采样点与目标 `at` 的 `|dx| <= player.w` 且 `|dy| <= player.h`（`:130-137`）。
  - 边 = 一次跳跃抛物线；水平距离 `> speed*t` 不可达；弧线撞 `blocked` 不可达；飞过目标也算够到
    （`:139-175`）。
  - 起点 = 出生点脚点附近 ±一个身位、且不低于 `spawn.y - player.h` 的所有落脚点
    （`:177-198`）；附近没有落脚点 ⇒ **一条都不报**（`:195-197`）。
  - 从起点做 BFS，直到所有靶子被覆盖或队列耗尽（`:200-213`）。
- **已知误报边界**：
  - **低天花板 / 走廊**：BFS 只建「跳跃弧」边，不建「走路」边。几何净空 60px（玩家高 48，头顶余量 12px）的走廊实际可走，
    但任何跳跃弧都撞天花板 ⇒ 两端目标被报「够不到」。
    **E3**：`node .scratch/level-playability-v1/research/02-gap-probes.mjs` 退出 0，
    `lowCeilingWalkable.reachabilityWhere = ["entity \"p\"", "entity \"gate\""]`。
  - **moving solid 的整段行程**可能把走廊在判定里封死，而运行时该 solid 是静态体、只挡原始盒子
    （见 §3、§4 S5）。
  - 需要贴边 / 连续蹬墙 / 绕顶的精细路线会被报成「可达」（文件头 `:22-24` 自白）。
- **已知漏报边界**：
  - **chest 不是 target**，但 chest 计入 `pickupCount` 且 `tryWin` 要求收集数达标
    （`game-config.ts:264-268`；`shell/scene.ts:364-369`）。
  - **只从出生点出发**：不检查「收集后能否到 gate」；单向坑可同时满足「从出生点到 pickup」与
    「从出生点到 gate」，却无法在一次游玩里完成。
  - **一个身位内算够到**：goal / pickup 埋在 solid 里也可以从旁边「覆盖」，不要求实际 overlap。
  - **hazard / danger 当空气**（`:15-18, :60-73`）：移动危险物、定时打击完全不影响可达性。
  - **下落不设限**：掉出世界不会死（`:107-113`），但没有「掉出即失败」的语义。
  - **出生点附近无落脚点不报**（`:195-197`）：与出生点非法（例如埋在 terrain 里）混在一起，
    因为 `auditGameConfig` 只查 `kind:"solid"` 实体的出生点（`game-config.ts:553-561`）。
  - **moving solid 的「平台」是假的**：判定把它当整段可踩，运行时 solid 不移动（见 S5）。
- **失败阶段**：deterministic；编译循环后、汇合点、发布闸、QA 四处都会调同一个函数。
- **E2**：
  - `packages/contracts/tests/reachability.test.ts`「真夹具：一条都不报」→ `expect(reach(CONFIG)).toEqual([])`。
  - 同文件「挖一条 200px 的沟 ⇒ … 够不到」→ `expect(who(bad)...).toEqual([...])`，且每条 `severity === "error"`。
  - 同文件「竖一面 100px 高的墙 ⇒ 墙那边的够不到」→ `expect(who(bad)).toContain('entity "suitcase-3"')`。
  - 同文件「40px 的沟：跳得过去 ⇒ 不报」/「40px 高的墙 ⇒ 不报」/「50px 高的 pickup ⇒ 不报」→ `toEqual([])`。
  - 同文件「出生点附近没有任何落脚点 ⇒ 一条都不报」→ `expect(reach(c)).toEqual([])`。
  - 同文件「goal 埋在行李堆正中间（站不进去）也不报」→ `expect(reach(c)).toEqual([])`。
  - 同文件「扫过的车厢（hazard）当空气」→ `expect(reach(CONFIG)).toEqual([])`。
  - 同文件「沟宽 60 通 / 100 报」→ `expect(jumpSpan(DEFAULT_PLAYER_MOVE)).toBeCloseTo(66, 1)` 与 `who(...).toContain('entity "signal"')`。
  - `config-audit.test.ts`「reachability error 进 deterministic、不进 resampleable」→
    `expect(p.deterministic).toContainEqual(i)`、`expect(p.resampleable.filter(...)).toEqual([])`。
  - `qa/tests/gameplay.test.ts`「挖一条 200px 的沟 ⇒ 一条 error，detail 里逐条点名」→ `expect(...).toMatch(/够不到/)`。
- **E3**：见 §7 语料重判（0 条 reachability error）与缺口探针 A/B/C/F。

#### B. `auditGameConfig`（`packages/contracts/src/game-config.ts:498-587`）

- **输入 / 输出**：`GameConfig` + `AssetPackManifest` → `ConfigIssue[]`；先 `auditReferences`
  （`:503-506`），再自洽族 error（`:508-561`），最后可通关族 **warning**（`:563-584`）。
- **调用的引用族**：`auditReferences`（见 E）。
- **自洽族（error）**：
  - `inWorld`：terrain / entity / player 盒子的**底边 / 右边**超出世界（`:533-539`）；
    左 / 上探出在站点侧只是 warning（`demo/src/site.ts:127-140`）。
  - `auditPanelSize`：HUD 面板声明尺寸与资源尺寸 / 九宫格下界（`:546-551`）。
  - **出生点卡在 solid 实体里**：只遍历 `kind:"solid"` 的实体，用 `config.player.at` 与实体盒做
    闭区间判断（`:553-561`）。**不看 terrain、不看 moving solid 的整段行程、不看玩家盒 / 脚点**。
- **可通关族（warning，不阻断）**：
  - 台阶高（`:563-578`）：`groundY = max(terrain[].y)`（没有 terrain 则 `H`），对每个 **solid 实体**
    算 `step = groundY - (box.y + box.h)`；`step > apex` 报 warning。
    - **只对「一条平地面 + 若干台阶」成立**（`:566-567` 自白）。
    - **不看 terrain 台阶、不看 pickup/chest/goal 的高度、不看多层地形、不看天花板**。
  - 周期行程越界（`:579-584`）：任意带 `motion` 的实体，`end = at[axis] + distance > W/H` 报 warning。
    - 只比较**锚点 + 单程距离**，不比较实体盒宽度 / 高度；也不看反方向（`distance` 恒正）。
    - **warning 不阻断**：A 到 B 的台阶可能正是设计（该绕路）。
- **E2**：`packages/contracts/tests/game-config.test.ts`
  - 「台阶高过最大跳跃高度 → 警告（正例）」→ `expect(w[0]!.severity).toBe("warning")`、`expect(errs(c)).toEqual([])`、
    message 匹配 `/台阶高 100px，而最大跳跃高度只有 60.5px/`。
  - 「台阶在能力之内 → 一条警告都没有」→ `expect(warns(base())).toEqual([])`。
  - 「手感参数进 config 之后，同一条台阶的判决会跟着变」→ 改 `jumpVelocity: 500` 后 `expect(warns(c)).toEqual([])`。
  - 「周期运动的行程越出世界 → 警告」→ message 匹配 `/越出了世界的 x 边界 1440/`。
- **失败阶段**：error 在 compile 循环内（resampleable）→ 重采样 / 硬拒；在汇合点 / 站点是硬拒；
  warning 任何阶段都不阻断。

#### C. `auditLayerCoverage`（`packages/contracts/src/layer-coverage.ts:137-155`）

- **输入**：`viewport`、`worldSize`、`LayerCoverageEntry[]`（每层 `parallax` / `drawn`）。
  `backgroundLayerEntries`（`:116-127`）把 config 的背景资源层转成条目；解不到背景 ⇒ 空数组、不报。
- **输出**：逐层 `error`，message 自包含世界 / 视口 / parallax / 最坏剩余像素（`:146-152`）。
- **边界**：只判「层画出来多大 - parallax × travel >= 视口」；不判像素覆盖率（那是 `pack` 的
  `coverage.json`，站点 `auditGeometry` 另判）。与可玩性无关。
- **失败阶段**：deterministic（编译循环后、汇合点、QA 层覆盖）；站点也重跑同一个函数。
- **E2**：`packages/contracts/tests/layer-coverage.test.ts`「恰好两条 error，where 是 [0] / [1]」、
  「cover 恰好等于视口 ⇒ 不报」、「纵向也判」。

#### D. `auditScreenSpace`（`packages/contracts/src/screen-space.ts:49-75`）

- **输入**：`viewport` + `ScreenItem[]`（`box` / `height` / 都没有）。
- **输出**：逐项 `error`：盒子不完全在视口内、纯文字起点/高度放不下、或 HUD 项没有可量法。
- **边界**：只判 HUD 屏幕空间；不判世界空间、不判可玩性。
- **失败阶段**：resampleable（编译循环内，模型错）；站点也重跑。
- **E2**：`demo/tests/site.test.ts`「第五族：HUD 摆到屏幕外 → 硬失败」；
  `contracts/tests/qa.test.ts` / `screen-space` 相关用例（HUD 项必须有 box 或 height）。

#### E. `auditReferences`（`packages/contracts/src/game-config.ts:335-429`）

- **输入**：`GameConfig` + `AssetPackManifest`。
- **输出**：`ConfigIssue[]`，全部 `error`，部分带 `code`（`entity-asset-kind` / `entity-state-frames`）。
- **检查**：
  - `scene.background` 是 background 资源（`:369`）。
  - `player.asset` 是 animation；`player.anims` 三格逐个解引用；三格必须指**三个不同动画**
    （`:370-397`）。
  - 每个实体的 `asset` 在 `ENTITY_ASSET_KINDS` 允许集内（`:62-70, :405-416`）；
    `chest` / `danger` 必须解析出 ≥2 帧（`:409-416`）。
  - `hud.panel` / `hud.pip` 是 `ui`（`:418-419`）。
  - `objective.gate` 必须指向存在且 `kind:"goal"` 的实体（`:421-423`）。
  - `pickupCount > 0`（`:425-426`）。
- **边界**：只判「解得到 / 种类对 / 帧数够」；不判尺寸与身体、空间关系、可达性、body/anchor 的
  运行时是否消费；不判背景层与帧的一一对应（`buildBackground` 在站点侧报）。
- **误报 / 漏报**：真实 120 份 config 零误伤（文件注释 `:59-60`）；漏报包括「引用到了但摆得走不到」
  与「body 与帧尺寸不一致」。历史旧 config 在 `chest` 单帧上会命中（语料 41 条，见 §7），这是
  契约收紧后的预期，不是新判据的误报。
- **失败阶段**：resampleable（可重采样）；`classifyConfigIssues` 可按 `where` 归到 `packRooted`。
  QA `reference-resolution` 与站点 `auditGameConfig` 也调它。

#### F. `auditEntityIdentity`（`packages/contracts/src/game-config.ts:648-708`）

- **输入**：`GameDesignSpec` + `GameConfig` + 可选 `levelId`。
- **输出**：`error`：`scope`（多关缺 levelId / levelId 不存在）、coverage（设计实体在 config 无
  `sourceIntent`）、dangling（`sourceIntent` 指向不存在）、wrong-scope（指向别的关卡）、
  kind 兼容（`DESIGN_BUCKET_KINDS`）。
- **边界**：只对账身份 / 桶，不判几何、不判可达性；`interactables` 同桶误归属不拦（已知限制，
  `:601-603`）；孤儿实体（无 `sourceIntent`）合法（`:646`）。
- **失败阶段**：resampleable（模型错，重采样）。
- **E2**：`contracts/tests/game-config.test.ts`「coverage：设计实体在 config 里没有对应 sourceIntent → error」；
  「兼容：跨桶可证明 —— enemy 被做成 pickup → error」；「多关不传 levelId → scope error」。

#### G. 机制覆盖（`packages/contracts/src/mechanic-coverage.ts:167-202`）

- **输入**：`GameDesignSpec` + `GameConfig` + 可选 `probeResults`。
- **输出**：`mechanic-coverage/v2` 核心：每条机制 `design` / `runtime` / `config` / `qa` 四格；
  `verdict` 是「全部可阻断层 satisfied」。
- **config 规则**（`:109-128`）：
  - `run` / `jump` / `gravity`：token 为空，**恒 satisfied**。
  - `collide-terrain`：terrain 数 > 0。
  - `collect-pickup`：pickup 数 > 0。
  - `moving-platform`：任意实体 `motion.kind === "cycle"` 的计数 > 0（`:131-145`）。
  - `hazard-contact`：hazard 数 > 0。
  - `reach-goal`：goal 数 > 0 且 `objective.kind === "collect-then-reach"`。
  - `open-chest`：chest 数 > 0。
  - `avoid-danger`：danger 或 hazard 任一存在。
- **门禁**（`:100-101, :205-218`）：`design != satisfied`、`runtime != satisfied`、`config.missing`、
  `qa == failed` 任一 → 阻断；`not-tested` 不阻断。
- **边界 / 漏报**：**只判存在性，不判组合**。「有 hazard」不等于「巡逻封不死唯一通路」；
  「有 jump」不等于「跨度够」；`reach-goal` 完全不调用 reachability；`moving-platform` 的 config
  层可被**任意** motion 满足，但运行时只实现 hazard 的 motion（见 H / `vocabulary.ts:85-99`）。
- **E2**：`demo/tests/shell-mechanic-witness.test.ts`「`moving-platform` 推导为 `experimental`」→
  `expect(deriveMechanicStatus("moving-platform")).toBe("experimental")` 且
  `expect(RUNTIME_IMPLEMENTED_MECHANICS).not.toContain("moving-platform")`；
  `contracts/tests/mechanic-coverage.test.ts` 的多条 config 缺失 / qa 缺失用例。
- **probe 覆盖**：`QA_PROBED_MECHANICS` 只有 4 条：`collect-pickup` / `open-chest` /
  `avoid-danger` / `hazard-contact`（`vocabulary.ts:114-119`）；`mechanic-probe.mjs` 也只有这 4 个 probe
  （`demo/probe/mechanic-probe.mjs:96,116,147,177`）。`run/jump/gravity/collide-terrain/reach-goal/moving-platform`
  没有行为 probe。

#### H. QA 玩法族（`packages/qa/src/gameplay.ts:71-86`）

- **输入**：`ctx.packDir` 的 `manifest.json` + `ctx.configPath` 的 config。
- **输出**：`judgements` 里只声明 `reference-resolution`（`auditReferences`）与 `reachability`
  （`auditReachability`）两条；`observations: []`。
- **严重度投影**（`merged` `:96-107`）：任一 issue error ⇒ finding `error`；只有 warning ⇒ `warning`；
  无 issue ⇒ 空数组。所有 issue 合成**一条** finding，`target` 恒 `game-config`，逐条 `where` 前缀
  留在 `detail` 里。
- **边界**：**只吃引用族**，不吃 `auditGameConfig` 的自洽族（`:32-34`）；链上通常恒绿（`:21-30`）；
  与 compile / gate 调同一个 `auditReachability`，所以 chest / 时序 / 单向路径的缺口原样继承。
- **E2**：`qa/tests/gameplay.test.ts`「只声明自己那两条 —— 另外四条缺席」、
  「引用族真的会响（把一个动作名指到不存在的动画 ⇒ 一条 error）」、
  「挖一条 200px 的沟 ⇒ 一条 error」、
  「把地形扔到世界外 ⇒ reference-resolution 一声不响，而 auditGameConfig 会响」。

#### I. Playtest 归因（`packages/contracts/src/playtest-attribution.ts:99-184`）

- **输入**：`PlaytestAttributionEvidence`：场景报告、实际 stage、环境健康、runtime errors、动作统计
  （attempted/completed/timedOut/explorationExhausted/stuck/progressPx/可选 `capabilityGapPx`）、
  deadline / structural undecidable。
- **输出**：`PlaytestOutcome` 五态 + `UNKNOWN`（`:27-33`），或 `not-executed`。
- **规则**（E1）：
  - `prepare` 有环境故障 ⇒ `ENVIRONMENT_FAILURE`；否则 `not-executed`（`:103-107`）。
  - `boot` 无环境证据 ⇒ `UNKNOWN`（`:108-113`）。
  - 环境健康前置门：`envFailure` ⇒ `ENVIRONMENT_FAILURE`；不健康但无具体故障 ⇒ `UNKNOWN`
    （`:118-122`）。
  - runtime error 来源 game ⇒ `GAMEPLAY_FAILURE`；来源 unknown ⇒ `UNKNOWN`（`:124-131`）。
  - 断言 fail 的正面证据：`initialActivePickups`、`kind:"invariant"`、终止达成但聚合 fail、
    `won` 断言 fail ⇒ `GAMEPLAY_FAILURE`（`:133-147`）。
  - 终止达成 + 全部断言 pass + 无错误 ⇒ `SUCCESS`（`:149-157`）。
  - 执行器主动 stop / explorationExhausted + stuck / progress < 10 ⇒ `AGENT_LIMITATION`
    （`:163-172`）。
  - 结构性不可判优先于 deadline ⇒ `UNKNOWN`；deadline ⇒ `TIMEOUT`；其余 ⇒ `UNKNOWN`
    （`:174-183`）。
- **边界**：`capabilityGapPx` **全仓只有定义与读取，没有任何生产者**（E3 grep：
  `playtest-attribution.ts:47,169` 之外无命中），所以「能力参数 vs 关卡几何」这条证据今天不会出现；
  归因只看本次运行证据，不读 config 几何；`AGENT_LIMITATION` / `TIMEOUT` 永不映射成游戏失败
  （符合本图裁定）。`GAMEPLAY_FAILURE` 也可能来自场景 setup（例如 harness 删掉 pickup），
  不是「config 不可玩」的证明。
- **投递映射**（`playtest.ts:518-540`）：`GAMEPLAY_FAILURE` → `playable-smoke fail`；
  `SUCCESS` → `pass`；`ENVIRONMENT_FAILURE` → `blocked`；`TIMEOUT` / `AGENT_LIMITATION` /
  `UNKNOWN` → `incomplete`；必需场景未执行 → `blocked`。
- **E2**：`packages/contracts/tests/playtest-attribution.test.ts`
  「初始态 pickup 缺失 ⇒ GAMEPLAY_FAILURE」、「到 gate 但 won=false ⇒ GAMEPLAY_FAILURE」、
  「普通 state 断言 fail 不自动升级 GAMEPLAY_FAILURE；有 stuck/耗尽 ⇒ AGENT_LIMITATION」、
  「环境故障优先于游戏失败」、「单纯超时 ⇒ TIMEOUT；超时 + 结构性不可判 ⇒ UNKNOWN」、
  「执行器主动停止 ⇒ AGENT_LIMITATION」。
- **试玩入口的额外门禁**（`cli/src/playtest.ts:23-45,183-188`）：默认五态场景只服务
  `wasteland-scavenger-recipe v1`；其他 Demo 必须用 `--scenario-dir` 提供本 Demo 的必需场景。
  这意味着**现有试玩不能直接判任意关卡**，它本身也不是自动创建链的一步。

---

## 3. Runtime 实际消费语义（`packages/demo/src`）

> 下面只描述代码实际做的事，不评价设计意图。关键点：**`buildWorld` 是纯层，`shell/scene.ts` 是物理 / 渲染层**；
> 判据只能依赖两者都承认的语义。

### 3.1 玩家

- **出生 / 盒子**：`buildWorld` 用 `boxAt(cfg.player.at, playerSize, playerAnchor)` 得到盒子
  （`world.ts:191-213`）；`scene.addPlayer` 用 `setSize(b.w, b.h, false)`、`setGravityY(move.gravity)`
  （`scene.ts:211-229`）。`body` 的位置 = `at - displayOrigin`，与 `entityBox` / `footOf` 的几何
  在「帧尺寸 == 资源标称尺寸」时一致；逐帧尺寸不同是否漂移，**纯层观测不到**。
- **移动**：每帧 `setVelocityX(left ? -speed : right ? speed : 0)`（`scene.ts:79-96`）；空中同样可改
  水平速度。**没有加速度、摩擦、冲刺、二段跳、蹬墙、土狼时间、可变跳跃高度。**
- **跳跃**：只有 `body.blocked.down` 为真时 `setVelocityY(-jumpVelocity)`（`scene.ts:90-91`）；
  按住跳跃键落地会立刻再跳。
- **重力**：玩家 body 的 `gravity.y = move.gravity`；世界 Arcade gravity 为 0（`shell/entry.ts:83`）。
- **死亡 / 重置**：没有血量、没有掉落死亡、没有世界底地板。hazard 或 danger 命中 → `hitHazard`
  用 `body.reset(spawn)` + `floorY` 校正（`scene.ts:355-362`），**已收集计数保留**。
- **世界边界**：玩家 body 没有 `collideWorldBounds`；相机 `setBounds(0,0,W,H)` 后跟随玩家
  （`scene.ts:69-73`）。掉出世界不会被杀，只会继续下落 / 被相机丢下。

### 3.2 实体与机制

| 实体 / 字段 | Runtime 实际行为 | 判据可依赖？ |
|---|---|---|
| `terrain` | 不可见静态矩形，加入 `solids` static group 与玩家 collider（`scene.ts:51-52,129-132,228`） | 是 |
| `solid` | 同上；`e.body` 覆盖盒子尺寸（`world.ts:175-189` + `scene.ts:150`） | 是（静态） |
| `solid` + `motion` | **仍只 `addSolid(e.box)`，从不推进 motion**；`advanceHazards` 只遍历 `hazards`（`scene.ts:149-165,270-281`）。`vocabulary.ts:85-99` 明确写「带 motion 的 solid 是静态体、从不移动」 | 是（静态），**不是**判定里的整段行程 |
| `hazard` | static body；无 `motion` 时不动；有 `motion` 时按 `hazardAnchor` 三角波移动并 `updateFromGameObject`（`hazard.ts:14-19`；`scene.ts:157-165,270-281`）。与玩家 overlap → `hitHazard` 复位；**不阻挡、不造成血量损失** | 位置可算；时序 / 复位不可静态判定 |
| `danger` | 静止盒；`dangerState(periodMs, activeMs, t)` 在 idle/active 间切换，active 落在周期最后 `activeMs`（`hazard.ts:28-33`；`scene.ts:287-309`）。只有 active 窗口内与玩家盒相交才复位；`hitThisWindow` 每窗口只记一次 | 几何可算；时序不可静态判定 |
| `pickup` | static body；与玩家 overlap → `collect`，`active=false`、隐藏、`collected += 1`（`scene.ts:151-155,334-340`）。**不阻挡** | 是（但 reachability 的「够到」比 overlap 宽） |
| `chest` | **不进 physics overlap**；每帧算玩家 body × `e.box` 外扩 `range` 的矩形相交，相交即自动打开、`collected += 1`、一次性（`scene.ts:175-185,315-325`）。`range` 缺省 0 | 是（几何 + range），但 **reachability 不把它当 target** |
| `goal` | 只有 `wins`（`id === objective.gate`）的那个注册 overlap；`tryWin` 要求 `collected >= pickupCount`，命中后 `won=true` 并显示文字（`scene.ts:166-174,364-369`）。其余 goal 只画不判 | 是（gate + 计数门槛） |
| `decor` | 只画，不注册任何行为（`scene.ts:196`） | 是（无行为） |
| `motion`（非 hazard，尤其 solid） | **忽略**；`advanceHazards` 只处理 `kind:"hazard"` 的数组 | 否（未实现） |
| `body`（pickup / hazard / goal） | **物理 body 仍按 sprite 帧尺寸 / 锚点创建**，没有 `setSize(e.body)`；只有 `entityBox` / 绘制的 `d.w/h` 用 `body`（`world.ts:175-189`；`scene.ts:151-174`）。`solid` / `chest` / `danger` 的几何才用 `e.box` | **部分**：判定用的盒子与真实 overlap 可能不是同一个 |
| `range`（chest） | 命中判定使用；reachability 不用 | 是（若新判据读它） |
| `strike`（danger） | 命中判定使用；reachability 不用 | 是（若新判据读它） |

### 3.3 判据「观测不到」的东西

- 玩家的**路线选择 / 操作技巧 / 起跳时机**；同一几何可能「难而公平」。
- 到达某个点时的**危险物相位**（hazard 的 `t0`、danger 的 `t` 从 0 起，但玩家何时到达不可知）。
- **逐帧实际物理**：Arcade 的分离、`OVERLAP_BIAS`、穿透、帧率、body 与帧 origin 的细微差。
- **运行时外壳的视口**：`shell/entry.ts:65-67` 用 `buildWorld(manifest, config, { packBase })`，
  不传 viewport；`new Phaser.Game` 的宽高是常量 `VIEWPORT`（`entry.ts:75-84`，`draw.ts:15`）。
  因此自定义 viewport 只影响站点装配 / 审计，不影响运行时外壳（D-01 的已知限制）。
- **设计层的空间意图**：`GameDesignSpec.levels[].layout` 是自由文本（`contracts/src/game-design.ts:176-188`），
  没有坐标；`CONTEXT.md:491-498` 明确把 VDS/设计↔config 的空间关系列为结构性不可判。
  ⇒ **只能判 config 自身几何 / 运行时语义，不能判「config 是否符合设计布局」。**
- **`pickup` / `chest` 是否是可选**：config 没有 optional 字段，`pickupCount` 把所有 pickup + chest
  都算必需；设计文本里的「可选奖励」无法机械对账。

---

## 4. 缺口清单

> 标签定义：
> - **可写**：现有 config 字段 + 现有运行时语义足以精确计算；可以新增纯函数，不需要改契约形状或 Runtime。
> - **需新语义**：需要先定义当前契约没有的语义（时间相位、返回路径、可选性、移动平台乘坐、
>   `body` 的运行时语义等）；可能不改 schema，但规格必须先补。
> - **不可写**：只靠 config / 现有 runtime 无法确定性判定（依赖设计文本、玩家技巧、主观意图、
>   或运行时根本没有实现的行为）。

### 4.1 空间可达性

| ID | 缺口 | 现有判据为什么抓不到 | 标签 | 证据 |
|---|---|---|---|---|
| S1 | **chest 被排除在 target 之外** | `auditReachability` 只收 `kind:"pickup"` + gate（`reachability.ts:124-129`）；`pickupCount` 却数 pickup + chest（`game-config.ts:264-268`），`tryWin` 要求达到这个数（`scene.ts:364-369`） | **可写** | E1 + E3 probe A：同一位置放 pickup 会报 `entity "probe-pickup"`，chest 不报；所需收集数 5 |
| S2 | **只看「出生点 → 每个目标」，不看「收集后 → gate」** | BFS 起点固定为 spawn（`reachability.ts:177-198`），单向边（跳上容易、跳回难）不被检查 | **可写**（新增图算法；不需要 schema） | E3 probe B：从 spawn `[]`；把起点放到坑底 pickup 后报 `entity "gate"` |
| S3 | **「一个身位内」不是实际 overlap** | `covers` 用 `|dx| <= player.w`、`|dy| <= player.h`（`reachability.ts:130-137`）；goal / pickup 埋在 solid 里也能被旁边覆盖 | **可写**（改为实体盒 overlap；需与 body / 帧尺寸对齐） | E2：「goal 埋在行李堆正中间（站不进去）也不报」；E3 probe D |
| S4 | **出生点埋在 terrain 里不报** | `auditGameConfig` 只遍历 `kind:"solid"` 实体（`game-config.ts:553-561`）；`auditReachability` 附近无落脚点就返回空（`:195-197`） | **可写** | E3 probe E：`auditGameConfig=[]`、`reachability=[]` |
| S5 | **moving solid 的整段行程 vs 运行时静态体** | `auditReachability` 把 motion solid 扫过的整条当实心（`reachability.ts:67-73`）；运行时 `case "solid"` 只 `addSolid(e.box)`（`scene.ts:149-150`），从不推进 motion | **可写**（把判定对齐到静态；或把「motion 在 solid 上」定义为非法） | E1 + E3 probe C：`withMotion` `[]`，`withoutMotion` 报 `entity "high-pickup"` |
| S6 | **低天花板 / 走路走廊误报** | BFS 只建跳跃弧边，没有「走路」边；任何跳跃都会撞天花板（`reachability.ts:154-175`） | **可写**（补 walk / clearance 边）；否则现有判据不能当「不可玩」证明 | E3 probe F：几何净空 60px 走廊，`["entity "p"", "entity "gate""]` |
| S7 | **body 覆盖在 pickup / hazard / goal 上被运行时忽略** | schema 允许 `body`（`game-config.ts:109-127`），`entityBox` / 绘制 / 判定都用它；但 `physics.add.existing(sprite, true)` 没有 `setSize(e.body)`（`scene.ts:151-174`）。`solid/chest/danger` 才用 `e.box` | **需新语义**（先裁定 `body` 在运行时是否应被消费，或改判据只用帧尺寸） | E1；语料 0 个此类实体，但契约允许 |
| S8 | **无底坑 / 掉出世界不是「死亡」** | 世界底不是地板（`reachability.ts:107-113`）；运行时没有 kill plane / 世界边界碰撞（`scene.ts:69-73,79-96`） | **需新语义**（「掉出世界」是否算失败 / 是否复位，当前没有定义） | E1 |

### 4.2 机制组合

| ID | 缺口 | 现有判据为什么抓不到 | 标签 | 证据 |
|---|---|---|---|---|
| M1 | **hazard 巡逻 / danger 喷发的安全窗口** | reachability 明确把 hazard 当空气（`reachability.ts:15-18`）；danger 完全不在几何模型里；没有时间展开 / 相位可达性 | **需新语义**（时间相位、玩家等待策略、复位语义） | E1 + `reachability.test.ts`「扫过的车厢当空气」 |
| M2 | **moving platform 运行时根本没有实现** | `RUNTIME_IMPLEMENTED_MECHANICS` 不含 `moving-platform`（`vocabulary.ts:85-99`）；`motion` 只在 hazard 分支被消费 | **需新语义**（要么 Runtime 实现，要么把 solid+motion 定义为非法；本图不改 Runtime） | E1 + `shell-mechanic-witness.test.ts`「moving-platform 推导为 experimental」 |
| M3 | **机制覆盖只判存在性，不判组合约束** | `CONFIG_RULES` 只数实体 / motion（`mechanic-coverage.ts:109-128`）；`reach-goal` 不调 reachability；`jump` 恒 satisfied | **需新语义**（组合原子判据；可能不改 schema） | E1 |
| M4 | **chest 的 `range` / 触发几何** | reachability 不把 chest 当 target（S1），也不读 `range`；运行时用玩家 body × `box` 外扩 `range`（`scene.ts:315-325`） | **可写**（把 chest 作为「带 range 的目标」；需定义 range 的 overlap 语义） | E1 + E3 probe A |
| M5 | **hazard / danger 与 solid 的重叠、必经走廊覆盖** | 没有任何几何相交判据；hazard 不阻挡、可以穿过 solid；danger 只看自己的 `box` | **可写**（几何观察 / 候选判据；是否构成错误需明确「必经」语义） | E1 |
| M6 | **probe 只覆盖 4 条机制** | `QA_PROBED_MECHANICS = [collect-pickup, open-chest, avoid-danger, hazard-contact]`（`vocabulary.ts:114-119`）；`reach-goal` / `jump` / `gravity` / `collide-terrain` / `moving-platform` 无行为 probe | 不可写为「每关 probe」；**需新语义**（probe 的设计） | E1 + `mechanic-probe.mjs:96,116,147,177` |

### 4.3 关卡完成性

| ID | 缺口 | 现有判据为什么抓不到 | 标签 | 证据 |
|---|---|---|---|---|
| C1 | **必需收集物包含 chest，但 reachability 不检查 chest** | 同 S1；`pickupCount` / `tryWin` 把 chest 算必需 | **可写** | E3 probe A；语料 53 个 chest 实例 / 5 份唯一 config，按目标探测 0 个不可达 |
| C2 | **收集后无法返回 gate（单向路径）** | 同 S2；BFS 只从出生点出发，图是有向的 | **可写**（新增「每个必需目标 → gate」或「存在收集顺序」的判定） | E3 probe B |
| C3 | **「终点激活」需要收集数，而不只是到达 gate** | reachability 把 gate 当普通目标；`tryWin` 要求 `collected >= pickupCount`（`scene.ts:364-369`） | **可写**（与 C1/C2 合并：gate 必须从所有必需收集物可达） | E1 |
| C4 | **设计层没有数量 / 可选性** | `GameDesignSpec` 没有 `count` / optional 字段；四桶实体可空（`game-design.ts:107-115`）；config 的 pickup/chest 全部必需 | **不可写**（设计意图数量无法对账；config 侧「全部必需」是确定的） | E1 + `CONTEXT.md:495-497` |
| C5 | **设计层的 win/lose 条件是自由文本** | `winConditions` / `loseConditions` 是 `string[]`（`game-design.ts:196-197`）；运行时只有 `collect-then-reach` 一种 objective | **不可写**（无法从文本判定是否一致） | E1 |
| C6 | **config 与设计布局是否一致** | `levels[].layout` 是自由文本、无坐标（`game-design.ts:176-188`）；`CONTEXT.md:491-498` 把跨文档空间关系列为结构性不可判 | **不可写** | E1 |
| C7 | **非 gate 的 goal / decor 是否被误当目标** | 运行时只认 `objective.gate`；config 里其他 goal 合法且只画（`scene.ts:166-174`） | **不可写**（设计意图无法对账；运行时语义本身确定） | E1 |

### 4.4 缺口排序（对后续 03/04/05 的建议输入，不裁定实施）

1. **S1 / C1 chest 盲点**：最小、最确定、已有运行时语义；语料零新增 error（探测）。应最先补规格。
2. **S2 / C2 / C3 单向路径与收集顺序**：需要新的图算法，但不改 schema；是「关卡完成性」与
   「空间可达性」的分界点。
3. **S4 / S3 / S6**：出生点 / overlap / 走路边，都是现有判据的误报或漏报边界；补之前必须先决定
   `covers` 与 walk 边的语义，否则会新增误伤。
4. **S5 / M2 moving solid**：现有判定与运行时直接矛盾；要么判定对齐静态，要么把 solid+motion
   定义为非法；不要二选一都做。
5. **M1 / M5 时序**：最贵，最容易误伤；建议先做「可证明的退化情况」（例如危险物整周期覆盖唯一
   通道且无等待点），其余落 `INSUFFICIENT_EVIDENCE`。
6. **S7 / C4 / C5 / C6 / C7**：语义缺失，暂不可写；不要用观察或阈值补造。

---

## 5. 重复与分档：候选判据与既有警告 / error 的重叠

### 5.1 重叠表

| 候选判据 | 与谁重叠 | 会不会重复报告 | 若新增，应放哪一档 | 失败阶段会怎么变 |
|---|---|---|---|---|
| chest 可达（S1） | 无（现有 reachability 完全不看 chest） | 不会；但若同时把 chest 改成 pickup target，需只报一次 | **deterministic**（扩展 `auditReachability` 的 targets） | config 编译 / 汇合点 / 发布闸 / QA 都提前；与 B-02 后 reachability 同阶段 |
| 收集后到 gate（S2/C2/C3） | 与 reachability 的「gate 从 spawn 可达」部分重叠 | 可能同一 `entity "gate"` 两条；需合并为一条或按「after pickup」区分 where | **deterministic** | 同 reachability；新增错误会在 QA 之前 |
| 更严格的 overlap（S3） | 与 reachability 的 `covers` 重叠 | 可能同一目标两条；应替换而不是新增第二判据 | **deterministic** | 同 reachability；会把现有「一个身位内」放行的样例变成 error |
| 出生点在 terrain（S4） | 与 `auditGameConfig` 的「出生点卡在 solid」同族 | 不会重复（现有只查 solid）；但若同时把 terrain 加进 `auditGameConfig` 的 solids 列表，需只报一次 | **deterministic**（布局 / config 错误，不应重采样） | 若放 `auditGameConfig`（resampleable）→ 3 发重采样；放 deterministic → 编译 / 汇合点硬拒。**建议后者** |
| moving solid 对齐（S5） | 与 reachability 的 motion 规则重叠 | 不会；是修同一条规则 | **deterministic** | 同 reachability；语料 0 个 solid motion，当前影响为 0 |
| 低天花板 walk 边（S6） | 与 reachability 的 hop 规则重叠 | 不会；是修同一条规则 | **deterministic** | 同 reachability；会**减少**现有误报，不是新增错误 |
| hazard / danger 安全窗口（M1） | 与 reachability「hazard 当空气」直接冲突 | 不会重复，但会改变现有测试的乐观前提 | **deterministic（保守）** 或 **观察 / INSUFFICIENT_EVIDENCE** | 若成 error，会从「QA 前只报够不到」变成「编译 / 汇合点报时序不可通行」；必须先证伪「难度 vs 不可玩」 |
| 台阶高（现有 warning） | 与 reachability 的「目标够不到」部分重叠 | 已有：台阶 warning + 目标 reachability error 可能同时出现（不同 where / 不同 message） | **保持 warning**，不要把现有 warning 升级为 error | 升级会绕过「可能正是设计」的既有裁定，并改变失败阶段 |
| 机制组合（M3） | 与 mechanic coverage 的存在性规则重叠 | 不会重复，但会改变 `mechanic-coverage` 的 `verdict` | **mechanic-coverage 门禁**（不是 `ConfigIssue`） | 在 QA 之后、站点之前；`invalid`，但不会进 compile |
| 设计↔config 空间（C6） | 与 `auditEntityIdentity` / QA `visual-config-coherence` 部分重叠 | 可能重复（同一个 sourceIntent） | **不可写**；不要新增 | 不要用观察 / 阈值补造 |

### 5.2 分档纪律（给 09 / 10 的事实输入）

1. **reachability 家族必须留在 `deterministic`**。放进 `resampleable` 会被 `compileRuntime` 当
   「模型错」重采样 3 发；`classifyConfigIssues` 对 `entity "<id>"` 的保守规则还会把它归成
   `configFixable`（因为实体存在、允许 kind 在包里）——结果是「布局不可达」被误诊成「模型没写好」。
   B-02 已经把它移出 `resampleable`（`config-audit.ts:49-54`），不要退回。
2. **新增判据若只放进 `auditConfigPipeline`、不放进 `auditReachability`，发布闸覆盖不到**：
   `publish-gate.ts:140` 只调 `auditReachability`。standalone `site` / `assemble_site` 的 config
   只有在 `auditReachability` 内部才会被重跑。因此要么把新判据并进 `auditReachability`，
   要么在 gate 显式调用新函数（后者会扩大 P1 · publish-gate 的修改面）。
3. **新增判据若放进 `auditGameConfig`，它会在站点装配被重跑**，也会在 compile 循环内被当
   resampleable；这对「引用 / 自洽」是对的，对「布局不可达」是错的。
4. **不要新增 `ConfigIssue.code`** 除非单独审批：`CONFIG_ISSUE_CODES` 是闭集
   （`game-config.ts:315-317`），加码是契约形状变更。用 `where` / `message` 足够表达现有判据。
5. **三态结果需要新形状**：`ConfigIssue[]` 只能表达「有 error / 没 error」；`INSUFFICIENT_EVIDENCE`
   没有落点。可以先用「空数组 = NO_PROVEN_BLOCKER」近似，但它不能区分「证明可玩」与「没查」；
   若要严格三态，必须新增报告 / 结果类型（Q5 的单列审批点）。
6. **QA 的 7 条不要写成 6 条**：`assertQaPassed`、`publish-gate`、`qaVerdict` 都读
   `QA_JUDGEMENTS.length`；写成 6 会让 `checked` 判定与注释不一致。

---

## 6. P1 影响（已有事实，不重开裁定）

### 6.1 B-02：deterministic reachability

- `config-audit.ts:49-54` 把 `auditReachability` 放进 `deterministic`；`resampleable` 不含它。
- `compileRuntime` 循环后（`ops.ts:1278-1295`）与 `runBuild` 汇合点（`create-game.ts:621-643`）都会
  在 QA / site 之前硬拒不可达 config；不重采样、不落盘。
- 行为变化（P1 票 02 已记录）：不可达 config 的失败阶段从 QA **提前到编译 / 汇合点**；退出码仍
  `invalid`(4)，但落盘时机与文案不同；QA 的 `reachability` 判据保留，但链上通常走不到。
- **对本图的含义**：任何新增的 reachability 家族判据，若并进 `auditReachability`，会自动获得
  同一阶段；若另起函数，必须显式接进 compile 后 deterministic、汇合点与发布闸。

### 6.2 publish-gate：standalone site / assemble_site 的 reachability 复验

- `publish-gate.ts:134-144` 现场重跑 `auditReachability`；`:219-224` 在报告 identity / verdict 之后、
  返回之前调用；四个真实发布入口都传 `configPath`（P1 票 03 的入口复核表）。
- **只重跑 `auditReachability`，不跑 `auditConfigPipeline` / `auditEntityIdentity` / QA**。
  ⇒ 新判据若不在 `auditReachability` 里，standalone `site` / `assemble_site` **不会**被它拦。
- TD 显式跳过（`publish-gate.ts:168-169`）；`configPath` 缺省跳过（库调用 / 既有测试）。
- 库直调 `assembleSite` 不过闸（`publish-gate.ts:6-8`）；站点本身不跑 reachability
  （`demo/src/site.ts:195-217`）。

### 6.3 D-01：viewport 全链贯通

- `AuditConfigPipeline` 的 `viewport` 只喂 `auditScreenSpace` / `auditLayerCoverage`；
  `auditReachability` **不读 viewport**，只读 `config.world.size`。
- 站点 / 世界构建 / 屏幕空间都用同一个 `opts.viewport ?? VIEWPORT`（`demo/src/site.ts:190,209-214`；
  `pipeline/src/create-game.ts:631-637,675`）。
- 运行时外壳仍用常量 `VIEWPORT`（`demo/src/shell/entry.ts:65-67,75-84`），不读自定义 viewport；
  CLI / MCP 也只传默认 480×270。⇒ **自定义 viewport 是程序化 API 增量，不是运行时行为**。
- 对本图的含义：空间可达性判据应使用 **`world.size`**；不要用 viewport，除非判的是 HUD / 背景覆盖。
  若新判据涉及「一屏能看到多少」，要与运行时外壳常量对齐，不能只用站点传入值。

### 6.4 D-03：modelHard 归因与受限重采样反馈

- `classifyConfigIssues` 只处理 `resampleable` 的 error（`config-audit.ts:87-134`）；它按 `where`
  形态归因：`entity "<id>"`、`hud.*`、`player*`、`scene.background*`，其余兜底 `configFixable`。
- 新判据若留在 `deterministic`，不经过归因、不进反馈，直接硬拒；这是正确的。
- 新判据若误入 `resampleable`：`entity "<id>"` 的 reachability 错误会被归成 `configFixable`
  （实体存在、允许 kind 在 manifest 里），于是 **3 发重采样 + 反馈**；这是 D-03 之后的错误用法。
- `packRooted` 只对「能力明确 + manifest 无任何满足能力的资产」生效；不要把布局错误塞进这个分类器。

---

## 7. 证据日志（E1 / E2 / E3）

### 7.1 E1：源码 / 契约定位

本报告正文已逐条标注。关键入口再列一次：

| 入口 | 文件:行 |
|---|---|
| 统一审计 | `packages/contracts/src/config-audit.ts:39-56` |
| reachability | `packages/contracts/src/reachability.ts:44-226` |
| auditGameConfig | `packages/contracts/src/game-config.ts:498-587` |
| auditReferences | `packages/contracts/src/game-config.ts:335-429` |
| auditEntityIdentity | `packages/contracts/src/game-config.ts:648-708` |
| 层覆盖 | `packages/contracts/src/layer-coverage.ts:137-155` |
| 屏幕空间 | `packages/contracts/src/screen-space.ts:49-75` |
| 机制覆盖 | `packages/contracts/src/mechanic-coverage.ts:100-101,109-128,167-202` |
| QA 判据全集 | `packages/contracts/src/qa.ts:111-160,405-409` |
| QA 玩法族 | `packages/qa/src/gameplay.ts:71-86,96-107` |
| Playtest 归因 | `packages/contracts/src/playtest-attribution.ts:99-184` |
| 运行时玩家 | `packages/demo/src/shell/scene.ts:79-96,211-229,355-362` |
| 运行时实体 | `packages/demo/src/shell/scene.ts:129-198,270-325` |
| 运行时 hazard / danger | `packages/demo/src/hazard.ts:14-19,28-33` |
| 外壳入口 / 视口 | `packages/demo/src/shell/entry.ts:65-67,75-84` |

### 7.2 E2：既有测试（命令、退出码、断言）

**命令**：

```bash
pnpm exec vitest run \
  packages/contracts/tests/reachability.test.ts \
  packages/contracts/tests/config-audit.test.ts \
  packages/contracts/tests/game-config.test.ts \
  packages/contracts/tests/layer-coverage.test.ts \
  packages/contracts/tests/playtest-attribution.test.ts \
  packages/qa/tests/gameplay.test.ts \
  packages/pipeline/tests/publish-gate.test.ts \
  packages/pipeline/tests/playtest.test.ts \
  packages/pipeline/tests/delivery.test.ts \
  packages/demo/tests/hazard.test.ts \
  packages/demo/tests/world.test.ts \
  packages/demo/tests/site.test.ts \
  packages/demo/tests/shell-scene-wiring.test.ts \
  packages/demo/tests/shell-mechanic-witness.test.ts
```

**结果**：退出码 **0**；**14 个测试文件、297 个测试全过**（日志 `/tmp/02-vitest.log`，本报告引用具体
测试名与断言；不落仓）。

### 7.3 E3：零付费只读复跑 / 语料重判

#### 7.3.1 缺口探针

**命令**：

```bash
node .scratch/level-playability-v1/research/02-gap-probes.mjs
```

**退出码**：0。**输出**（`/tmp/02-gap-probes.json`，摘要）：

```json
{
  "chestNotATarget": {
    "reachabilityWhere": ["entity \"probe-pickup\""],
    "requiredCollectibleCount": 5
  },
  "oneWayPit": {
    "fromSpawn": [],
    "fromPitAfterPickup": ["entity \"gate\""]
  },
  "movingSolidSweep": {
    "withMotion_pickupY100": [],
    "withoutMotion_pickupY100": ["entity \"high-pickup\""]
  },
  "goalInsideSolid": { "reachabilityWhere": [] },
  "spawnInsideTerrain": { "auditGameConfigWhere": [], "reachabilityWhere": [] },
  "lowCeilingWalkable": { "reachabilityWhere": ["entity \"p\"", "entity \"gate\""] }
}
```

- A（chest）：同一位置放 pickup 会报，chest 不报；所需收集数 5。
- B（单向坑）：从 spawn 不报；把起点放到坑底 pickup 后报 `entity "gate"` ⇒ 现有判据证明不了
  「一次游玩能完成」。
- C（moving solid）：带 motion 时判定说可达，去掉 motion 才报不可达；运行时 solid 本就不动
  ⇒ 带 motion 的判定与运行时不一致。
- D（goal 埋 solid）：不报（现有 `covers` 宽松边界）。
- E（spawn 埋 terrain）：`auditGameConfig` 与 reachability 都不报。
- F（低天花板）：几何净空 60px（玩家高 48）走廊实际可走，现有 reachability 误报两个目标不可达。

#### 7.3.2 历史语料重判

**命令**：

```bash
node .scratch/level-playability-v1/research/02-corpus-scan.mjs
```

**退出码**：0。**输出**（`/tmp/02-scan.json`）：

| 计数 | 值 |
|---|---|
| 扫描 JSON 文件 | 5,244 |
| 可解析 JSON 对象 | 5,243 |
| `game-config/v1` 文件 | 152 |
| 唯一 config（按内容） | 21 |
| manifest 形状文件 | 171 |
| 当前 `assetpack/v4` 可解析 | 90 |
| 旧 schema（只读归一化） | 81 |
| config 解析失败 | 0 |
| 配对成功 / 未能配对 | 96 / 2（`out/__probe/empty/site/v1/game-config.json`、`packages/demo/fixtures/empty-world.json`） |
| 唯一配对 config | 20 |
| `auditReachability` error | **0** |
| `auditGameConfig` error / warning | 49 / 0 |
| `auditLayerCoverage` error | 2 |
| `auditScreenSpace` error | 0 |
| `auditEntityIdentity` error（仅能就近找到 design 的） | 16 |
| chest 实体 / 含 chest 的配对文件 / 唯一含 chest config | 53 / 34 / 5 |
| 把 chest 临时当 pickup 目标后不可达的 chest | **0** |
| hazard + motion 实体 / danger 实体 | 84 / 6 |
| 唯一 config 中的 moving solid / 非 hazard motion / pickup-hazard-goal `body` 覆盖 | 0 / 0 / 0 |

**解释**：

- `auditReachability` 在 96 个配对（20 个唯一 config）上 **0 error**，与 P1 的 0 error 基线一致。
- 49 条 `auditGameConfig` error 全部是历史产物 / 负例：22+19 条 chest 单帧状态帧、8 条负例
  `objective.gate` 缺失；**没有一条是本次新引入或 reachability 相关**。
- 81/171 份历史 manifest 不是 `assetpack/v4`（v1 13 · v2 66 · v3 2），当前 `parseAssetPack` 只收 `assetpack/v4`
  （`packages/contracts/src/assetpack.ts:57`）⇒ **历史语料不能直接按当前 parser 重判**；本扫描
  只读归一化了 `assets` 结构。这是 06 / 08 的前置事实。
- 语料里 **0 个 moving solid、0 个非 hazard motion、0 个 pickup/hazard/goal `body` 覆盖**；
  S5 / S7 / M2 的缺口只能靠合成负例建立，不能靠历史语料。
- 53 个 chest 实例 / 5 份唯一 config，目前按目标探测 0 个不可达 ⇒ chest 盲点在历史语料上
  **没有已发生样本**，但风险仍在（合成负例可稳定触发）。

#### 7.3.3 基线一致性

```bash
git diff --stat fa17c14 HEAD -- packages fixtures docs CONTEXT.md package.json
# 输出为空；退出码 0
```

⇒ 本报告依赖的源码 / fixture / 文档与 `main` @ `fa17c14` 一致。当前工作树 HEAD `b2e8b7e` 仅比
基线多 docs 提交（`b2e8b7e` `6e5306a` `413d993`）。

#### 7.3.4 三项标识符不存在

```bash
grep -rn "PROVEN_UNPLAYABLE\|INSUFFICIENT_EVIDENCE\|NO_PROVEN_BLOCKER" \
  packages docs CONTEXT.md --include='*.ts' --include='*.md'
# 无输出；退出码 1（grep 未命中）
```

⇒ 三态是本图新引入的词汇，当前没有类型、报告字段或落点。

#### 7.3.5 QA 判据实际 7 条

```bash
node --input-type=module -e "import { QA_JUDGEMENTS } from './packages/contracts/dist/index.js'; \
  console.log(QA_JUDGEMENTS.length, QA_JUDGEMENTS.join(','))"
# 7 palette-binding,constructive-constraint,layer-coverage,reference-resolution,
#   reachability,intent-coverage,visual-config-coherence
```

⇒ 代码功能是 7 条；`qa.ts:104`、`CONTEXT.md:518,630`、`delivery.ts:68,93`、`create-game.ts:229`
等处的「六条」是文档漂移。

#### 7.3.6 `capabilityGapPx` 没有生产者

```bash
grep -rn "capabilityGapPx" packages --include='*.ts' --include='*.mjs' | grep -v node_modules
# 只有两处：contracts/src/playtest-attribution.ts:47（类型字段）与 :169（读取）
# 没有任何赋值 / 计算 / harness 输出 ⇒ 这条能力缺口证据今天不会出现。
```

#### 7.3.7 历史 manifest 格式分布

`02-corpus-scan.mjs` 同一次输出里的 `stats.manifestFormats`（退出码 0）：

```json
{ "assetpack/v2": 66, "assetpack/v4": 90, "assetpack/v1": 13, "assetpack/v3": 2 }
```

⇒ 共 171 份，81 份不是 v4；这与 §7.3.2 的「当前 parser 只收 v4」是同一件事。

---

## 8. 父级必须知道的事实 / 矛盾 / 缺失输入

1. **三态不存在，需新契约形状**：`PROVEN_UNPLAYABLE` / `INSUFFICIENT_EVIDENCE` /
   `NO_PROVEN_BLOCKER` 全仓无标识符（§7.3.4）。`ConfigIssue[]` 只能表达「有 error / 没 error」；
   若要求严格三态，必须新增结果类型或报告字段，属于 Q5 的契约形状审批点。不要假设
   「空数组 = NO_PROVEN_BLOCKER」等于「已证明可玩」；现有 reachability 自己就写着
   「只报不可达、从不报可达」（`reachability.ts:20`）。
2. **QA 是 7 条不是 6 条**：多处注释 / CONTEXT / delivery 标签仍写「六条」，但 `QA_JUDGEMENTS`
   有 7 个值，`qaVerdict` / `assertQaPassed` / `publish-gate` 都按 7 比较。后续票若按「六条」
   设计集成或报告文案会漂移。
3. **设计层没有空间语义**：`GameDesignSpec.levels[].layout` 是自由文本，无坐标
   （`game-design.ts:176-188`）；`CONTEXT.md:491-498` 把 VDS/设计↔config 的空间关系列为结构性不可判。
   ⇒ 只能判 **config 自身几何 + 运行时语义**；不能判「config 是否符合设计布局」。这不是本图的
   新增裁定，是既有边界。
4. **历史 manifest 大多过不了当前 parser**：81/171 不是 v4（v1 13 · v2 66 · v3 2）；152 份 config 里 21 份唯一内容，96 份能配对（20 份唯一）。06（语料清单）与 08（历史重判）必须先定义「旧 schema 归一化 / 迁移 / 排除」
   的口径，否则会把 parser 失败误读成 config 不可玩。
5. **chest 是运行时必需、判据视野之外**：`pickupCount` 数 pickup + chest；`tryWin` 要求收集数达标；
   `auditReachability` 的 targets 只有 pickup + gate。历史语料 53 个 chest 实例、0 个按目标探测
   不可达，所以现有语料不会暴露它；必须用合成负例证明判据会响。
6. **moving platform 在运行时不存在**：`RUNTIME_IMPLEMENTED_MECHANICS` 不含它，
   `shell-mechanic-witness.test.ts` 把它钉成 `experimental`；语料 0 个 solid motion。任何
   「移动平台可通行」判据在现行 Runtime 下都**不可写**（除非把 solid+motion 定义为非法，或
   另起 Runtime effort）。
7. **`body` 在 pickup / hazard / goal 上被运行时忽略**：schema 允许，`entityBox` / reachability 用它，
   但 physics body 用帧尺寸 / 锚点。历史语料 0 个此类样本；未来判据必须先裁定运行时语义，
   否则「判据认的盒子」与「真正 overlap 的盒子」不是同一个（S7）。
8. **现有 reachability 有一个可复现的误报**：低天花板 / 走路走廊。若 03 直接拿现有函数做
   「空间不可达」判据，这条误报会进入 error；必须先补 walk / clearance 边或显式声明
   「只对跳跃可达性成立」。
9. **发布闸只重跑 reachability**：新判据若不在 `auditReachability` 内，standalone `site` /
   `assemble_site` 不会执行（`publish-gate.ts:140`）；库直调 `assembleSite` 连闸都不过。
10. **试玩不能当判据**：`AGENT_LIMITATION` / `TIMEOUT` / `UNKNOWN` 已按裁定不映射为游戏失败；
    默认场景只服务 wasteland v1；`capabilityGapPx` 没有生产者；`GAMEPLAY_FAILURE` 也可由场景 setup
    产生。现有 Playtest 是证据层，不是 `PROVEN_UNPLAYABLE` 的来源。
11. **`verify-mechanics` 不在创建链上**：build 只写 `probe.executed=false`；四机制 probe 是独立
    CLI / `pnpm test:mechanic`，不是每关的机制组合验证。
12. **没有缺失的输入**：本票所需的源码、fixture、历史语料、P1 收口票都在仓内可读；唯一需要外部
    口径的是 06/08 的旧 manifest 处理策略（见第 4 点）。

---

## 附录 A：一句话索引

- **现有可玩性判据**：`auditReachability`（只报够不到）+ `auditGameConfig` 台阶 / 行程 warning。
- **现有失败阶段**：compile resampleable → 3 发；compile deterministic / 汇合点 → 编译期硬拒；
  QA → 报告先落盘再拒；publish-gate → site 前拒；site → 不产站；playtest → 只改 delivery。
- **最大漏报**：chest 不是 target；只看 spawn → 目标，不看收集后 → gate；hazard/danger 当空气；
  moving solid 当整段平台；出生点埋 terrain 不报。
- **最大误报**：低天花板走廊（只建跳跃弧、不建走路边）。
- **三态**：不存在；严格实现需要新契约形状。
- **语料**：152 份 config / 21 唯一 / 96 配对 / reachability 0 error；历史 manifest 81 份旧 schema。
