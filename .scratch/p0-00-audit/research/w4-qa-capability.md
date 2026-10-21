# W4：QA 真实判定能力（HEAD `ea53240`）

- **票**：[04-w4-qa-capability](../issues/04-w4-qa-capability.md)
- **基线**：分支 `v2-foundation`，HEAD `ea53240`（2026-10-20）
- **性质**：只读审计；**零付费**。未运行 `create` / `build` / `plan` / `pack` / `compile-runtime` / `compile-td-game` / `site`；未调用任何上游。`review` **未运行**（它是一次付费视觉调用，本票没有预算）。只跑了本地免费测试与 `inspect` / `verify`。
- **证据等级**（任务书附录 A）：E0 推测 · E1 源码 · E2 测试 · E3 真实产物。
- **行号说明**：下文行号均指上述 HEAD 的源码；源码一改就会漂移。
- **审计口径**：**模块存在 ≠ 已验证**。每条能力都追问三件事：读了什么输入、finding 由什么条件产生、结果是否影响退出码 / 站点产出。

---

## 0. 结论先行

1. **自动 QA 只跑 6 条判据里的 5 条**：`checked` 恒为 5/6，`layer-coverage` 不在任何族里，`qaVerdict` 恒为 `incomplete`。闸门看的是 `failures` 里的 `error`，**不看 verdict**。`packages/contracts/src/qa.ts:109`（`QA_JUDGEMENTS`）、`packages/qa/src/assemble.ts:89`（`layer-coverage: { ran: false }`）、`packages/pipeline/src/create-game.ts:215-226`（`assertQaPassed`）。E1 + E2。
2. **Visual QA 模块存在，但它不读图片、也不读参考风格**。`visualQaRunner` 只解析 `asset-recipe.json`、包 `manifest.json` 与创作态 drawlist JSON（`packages/qa/src/visual.ts:84-99,110-174`）；`packages/qa` 的依赖白名单只有 `contracts`（`packages/qa/package.json:13-14`、`scripts/check-deps.mjs:24`），因此够不着 PNG 解码器与参考图。**把「有 Visual QA」等同于「视觉一致性已验证」是错的**。E1。
3. **真正读真实像素的只有两条旁路**：免费的 `inspectPack`（`packages/assets/src/ops.ts:1900`）读图集/母版 PNG，算用色、色板外像素、层覆盖率、源图→目标长宽比；付费的 `reviewPack`（`packages/assets/src/review.ts:100`）把**联系表 + 原图**一起喂视觉模型。前者只作为 `observation`，后者是**人主动调用的诊断命令**，两者都**不阻断**（`packages/qa/src/assemble.ts:95-100`；`packages/pipeline/src/review.ts:4-7`）。E1 + E2 + E3（inspect）。
4. **自动链里没有一次「生成结果 vs 参考风格」的比较**。仓库里唯一做这件事的 `reviewPack` 不在创建链上（`packages/pipeline/src/review.ts:6`），它的输出是自由文本观察、无阈值、无评分、无阻断（`packages/assets/src/review.ts:100-170`）。因此「风格一致」目前**不是任何判据**，E3 也不存在。E1。
5. **Intent / Design 覆盖是 id 级集合差，不是语义覆盖**。`auditIntentCoverage` 只比 `entities` 按 `type` 落桶与 `mechanics` 的 id（`packages/contracts/src/intent-coverage.ts:110-131`）；文本那一半被实测证伪后**故意砍掉**（同文件 1-35 行）。同一 id 配上更弱的机制（例如 `m-double-jump` 保留 id、`mechanic` 填 `jump`）**过得了**覆盖判据。E1 + E2。
6. **Asset QA 对账的是「spec ↔ manifest 元数据」**：kind、标称尺寸、动画名/帧数、多余动画、drawlist viewBox（`packages/contracts/src/audit.ts:45-83`）。**不校验**文件是否存在、checksum、图集 JSON 里的真实帧尺寸；这些只在**手动** `verifyPack` 里（`packages/assets/src/ops.ts:1662-1730`），而 `runBuild` 不调用它。E1 + E3（verify 可独立通过/失败）。
7. **Gameplay QA 不启动游戏、不发输入**。`auditReachability` 是纯静态 BFS：从出生点、用过宽的移动模型，只报**够不到**的终点与拾取物（`packages/contracts/src/reachability.ts:44-225`；`packages/qa/src/gameplay.ts:37-43`）。它不验证 boot/input/movement/collision/interaction 的实际执行，也不验证胜利/失败条件。真实可玩性只在人工 CDP 记录里（`site-report.md`），不在 QA 链上。E1 + E3（人工）。
8. **阻断只对 `create --yes` / `build` 成立，且只被 `error` 触发**：报告**先落盘**、再抛 `invalid` → CLI 退出码 **4**、站点不产；报告留在 `run/v<N>/qa-report.json`，没有 `failed-*` 现场，也没有 `failureDir`（`create-game.ts:543-544`、`packages/cli/src/cli.ts:620`、`packages/contracts/src/command.ts:75-85`）。E2（`packages/cli/tests/cli-create.test.ts:409-420`；`packages/pipeline/tests/create-game.test.ts:649-660`）。**没有归档的真实 QA 失败产物可作 E3**。
9. **观察永远不阻断，已有真实产物证明**：真实包 `inspect` 报出 `player-scavenger.run` 的**长宽比差 +52.4%** 仍然退出 0；另一个真包报出 41 个色板外像素也退出 0。测试另有「把观察换成任意难听的话，裁决一个字不变」。E3 + E2（`packages/qa/tests/assemble.test.ts:119-150`；`packages/contracts/tests/qa.test.ts:210-216`）。
10. **发布门可被 `site` / `assemble_site` 绕过**：两者都只吃包 + config，不读 `qa-report.json`（`packages/cli/src/cli.ts:575-591`；`packages/mcp/src/server.ts:318-326`；`packages/demo/src/site.ts` 全文无 QA 引用）。而 `reachability` 是 **QA 独有**的判据——`compile-runtime` 不跑它、`site` 也不跑它（`packages/assets/src/ops.ts:1046-1052`；`packages/demo/src/site.ts:191-213`）。⇒ 一个「终点够不到」的关卡可以因 QA 失败而 `build` 退出 4，随后仍可用 `site` 装出站点。E1 + E2（`cli-create.test.ts:365` 证明这种 config 过得了上游业务校验）。
11. **CLI 与 MCP 的 QA 判定同源、呈现不同**：两边都走默认 `qaRunner` 与同一 `assertQaPassed`；但 CLI 的人类输出带 inspect 摘要，MCP **明确不展示**（`packages/cli/src/cli.ts:316,354,402-426` vs `packages/mcp/src/server.ts:44-62,295-296`；`packages/mcp/tests/create-game-no-digest.test.ts:96-130`）。MCP 也没有 `build` / `review` 工具，`create_game` 恒跑到底。E1 + E2。
12. **`incomplete` 与 `warning` 都不阻断；且 warning 今天没有生产者**。`qaVerdict` 把 `incomplete` 与 `pass/fail` 分开（`qa.ts:374-379`），闸门只筛 error；`merged()` 理论上能产 warning，但 `auditReferences` / `auditReachability` 只产 error（`gameplay.ts:96-106`；`game-config.ts:271-387`；`reachability.ts:215-224`）。`audit.ts:24-33` 的 `checkSize` 会产 warning，但**没有任何生产调用者**（仅测试）。E1 + E2（合成 warning 的 verdict 测试）。

---

## 1. 8 维能力矩阵（总表）

| 维度 | 自动入口 / 实现 | 实际读什么 | 判定性质 | 默认链上能响吗 | 阻断？ | 状态 | 证据 |
|---|---|---|---|---|---|---|---|
| **Contract / Schema** | 各族入口的 `parseRecipe` / `parseAssetPack` / `parseGameConfig` / `safeParse(GameIntent/GameDesign)`；报告本身在 `runBuild` 再过 `QAReportSchema` | 已落盘的 JSON 产物 | 结构 + 文档内跨字段业务约束；不产 finding，**失败即抛** | 输入坏就抛（但链上产物已被上游 parse 过） | 抛 = 硬失败；CLI 对 `CommandError("invalid")` 退 4，**对族的裸 `Error` 退 1** | implemented（但无 QA 报告行） | `visual.ts:85-88`、`gameplay.ts:72-75`、`intent.ts:81-86`、`create-game.ts:533-538`、`command.ts:46,88` |
| **Intent QA** | `intentQaRunner` → `auditIntentCoverage` | `game-intent.json` + `game-design.json` | id 级集合差；实体按 `type` 落桶，机制按 id | **链上恒绿**（`compile-design` 先拒） | `error`；理论阻断 | partial（id 半；文本半故意 absent） | `intent.ts:77-98`、`intent-coverage.ts:110-131`、`build-design.ts:97` |
| **Design QA** | **没有 QA 族**；最接近的是 `compile-design` 的 R12 拒绝 | intent + VWS + design + RuntimeProfile | schema 门 + 相机支持 + 机制/能力差集 + 意图 id 覆盖 | 在生图前硬拒 | `DesignRejectedError` → 退 4 | partial（只在生成前；不产 QA 报告） | `build-design.ts:132-181`、`compile-design.ts:288-300`、`pipeline/create-game.ts:305-315` |
| **Asset QA** | `constructiveConstraint`（visual 族）+ `auditAssetSpec` | recipe spec + manifest 元数据 + drawlist JSON | spec ↔ 产物元数据对账 | 能响（`pack` 只返回 audit、不失败） | `error` | partial | `visual.ts:110-137`、`audit.ts:45-83`、`pack.ts:1290-1300` |
| **Visual QA** | `visualQaRunner`（两条判据）+ 免费 `inspectPack` 观察 + 手动 `reviewPack` | 自动：JSON 元数据；inspect：真实 PNG（只观察）；review：联系表 + 原图（付费、手动） | 自动链**不做风格比较** | 只有元数据类错误能响 | 元数据 `error` 阻断；观察/review 不阻断 | **partial → absent（风格相似度）** | `visual.ts:84-174`、`ops.ts:1900-1945`、`review.ts:100-170` |
| **Gameplay QA** | `gameplayQaRunner` → `auditReferences` + `auditReachability` | `game-config.json` + manifest | 引用族 + **静态**可达性（上界） | `reachability` **能响**（QA 独有）；`reference-resolution` 链上恒绿 | `error` | partial（无真实启动/输入/胜负） | `gameplay.ts:71-106`、`reachability.ts:44-225`、`ops.ts:1046-1052` |
| **Integration QA** | 无独立族；QA 的 `reference-resolution` + 上游 `compile-runtime` / `assembleSite` 的引用/几何/HUD 审计 | config ↔ manifest；包 → 站点拷贝 | 静态引用与几何；**不验证 Demo 真的加载/渲染** | 上游先拒；QA 的引用族链上恒绿 | 上游 error → 退 4 | partial | `game-config.ts:271-387`、`site.ts:191-213`、`demo/world.ts:60-100` |
| **Publish Gate** | `assertQaPassed`（创建/构建）；`site` / `assemble_site` **不读 QA** | `qa-report.json.failures`（仅 `severity:"error"`） | 只挡 `create/build` 的站点产出 | 是 | error → CLI 4 / MCP `isError`；其余不阻断 | **partial（可绕过）** | `create-game.ts:215-226,543-544`、`cli.ts:575-591`、`server.ts:318-326` |

---

## 2. 逐维详表

### 2.1 Contract / Schema

**入口与实现**
- 视觉族：`parseRecipe`（`packages/qa/src/visual.ts:85`）、`parseAssetPack`（`:87`）。
- 玩法族：`parseAssetPack`（`packages/qa/src/gameplay.ts:72`）、`parseGameConfig`（`:74`）。
- 意图族：`GameIntentSpecSchema.safeParse` / `GameDesignSpecSchema.safeParse`（`packages/qa/src/intent.ts:81-86`），用 `formatIssues` 而非 `parseWith`（同文件 78-80 的注释：Zod v3/v4 边界）。
- 报告自身：`runBuild` 在落盘前 `QAReportSchema.safeParse(produced)`，不过就是 `CommandError("invalid")`（`packages/pipeline/src/create-game.ts:533-538`）。

**只验结构还是也验跨字段业务约束？**
- **不是只验结构**。schema 层已有大量跨字段约束：
  - `AssetSpecSchema`：层名重复、动画名重复、`sheet.columns × rows === frames`、九宫格中央区非空（`packages/contracts/src/asset-spec.ts:177-243`，规则在 192/216/225/235/237 行）。
  - `GameDesignSpecSchema`：必填字符串非空、数组元素非空、`levels`/`abilities`/`goals`/`coreLoopSteps` 至少一条、`player + 四桶` id 唯一、`levels[].entities[]` 悬空引用（`packages/contracts/src/game-design.ts:124-328`，id 唯一在 305 行、悬空引用在 322 行）。
  - `AssetPackManifest`：`palette.size == values.length`、色板无重复、资源/图集 id 互指、`provenance.mode` 由 origin 唯一派生、`files[]` 覆盖 atlas/authoring 引用、帧名/动画名唯一、层与帧一一对应（`packages/contracts/src/assetpack.ts:265-335`）。
  - `GameConfigSchema`：实体 id 唯一（`packages/contracts/src/game-config.ts:190-207`）。
- 但**没有一条 QA 判据叫 schema**：schema 失败是**抛**，不是 finding。报告里的 6 条判据全部是跨文档/产物对账，不是结构检查。

**finding 生成条件**：无 finding。读不出来 / 不过契约 → 抛。
**severity / blocking**：族抛裸 `Error`（`visual.ts:86,88`；`gameplay.ts:73,75`；`intent.ts:83,86`）。`runBuild` 不捕获（`create-game.ts:521`）；CLI `asCommandError` 只翻译 `{rejections}` / `{failure}` 形状，裸 `Error` 原样穿过（`packages/cli/src/cli.ts:207-221`），`exitCodeOfError` 给它 **1**（`packages/contracts/src/command.ts:88`）。这与「产物不合法 = 4」的退出码表并不一致；只有包在 `CommandError("invalid")` 里才是 4。
**正例 / 负例测试**：正例——`packages/qa/tests/*.test.ts` 都用真 fixture 起现场；负例——`visual.test.ts:180`「塞一份坏清单 ⇒ 抛」、`gameplay.test.ts:148-158`「配置不过契约 ⇒ 抛 / 包清单读不到 ⇒ 抛」、`intent.test.ts:127-152`「设计不是 JSON / 手改坏设计 / 意图不存在 ⇒ 抛」、`assemble.test.ts:153-165`「族读不到 ⇒ 合成器冒出去，不生成半截报告」、`create-game.test.ts:626-637`「一份过不了 `qa-report/v1` 的报告 ⇒ 拒」。
**未覆盖**：没有一条测试把「族抛 → CLI 退出码」钉成 4 或 1；即上一条的退 1 行为无测试。

### 2.2 Intent QA

**入口与实现**：`packages/qa/src/intent.ts:77-98`（`intentQaRunner`）→ `packages/contracts/src/intent-coverage.ts:110-131`（`auditIntentCoverage`）。
**判据**：单向 `意图 ⊆ 设计`；实体按 `type` 映射到四个桶（`ENTITY_BUCKETS`），在**同名桶**里按 id 找；找不到时再扫其它桶，用 `foundIn` 区分「串桶」与「真缺失」（`intent-coverage.ts:116-131`）。机制按 id（`design.mechanics[].id`）找（`:127-129`）。
**能否发现实体/机制缺失及近似替代？**
- 缺失：**能**。测试 `intent.test.ts:87-96`（删实体）、`:107-115`（删机制）、`:97-106`（串桶）。
- 近似替代：**只能发现改了 id 的那种**；**同一 id 填了更弱的 `mechanic` 过不了任何判据**。`GameDesignMechanicSchema` 是 `{id, mechanic}`（`packages/contracts/src/game-design.ts:79-82`），覆盖只比 id。仓库自己在 `intent-coverage.ts:31-34` 写明模型会挑近似机制顶替而本函数抓不住。
- 文本层面的「设计是否放大了意图」：**故意不查**。`coreLoopSteps` / `winConditions` / `loseConditions` / `player.goals` 的文本相等被 4 发真输出量到 0% 命中后砍掉（`intent-coverage.ts:1-35`；`qa.ts:135-146`），并有钉子测试 `intent.test.ts:77-85` + `contracts/tests/intent-coverage.test.ts:53-72`。
**链上可响性**：**恒绿**。`compile-design` 在 `intent-entity-missing` / `intent-mechanic-missing` 上直接拒（`packages/game-design/src/build-design.ts:97-128,175-176`），走不到 QA；`intent.ts:37-49` 自己写了这条自白。
**severity / blocking**：缺失 → **一条** finding，`target: "game-design"`，`severity: "error"`（`intent.ts:117-125`）；多个缺项并进 `detail` 的多行（契约禁止同一 `(judgement,target)` 重复，`qa.ts:285-295`）。
**CLI / MCP**：同一 runner、同一装配；无差异。
**正例 / 负例**：正例 `intent.test.ts:64-85`（真对、零 finding、文本被改写仍绿）；负例 `:86-126`。
**未覆盖**：近似替代（同 id 弱化）；设计多出来的项（合法，且无落点，`intent.ts:51-60`）；`ambiguity`（明确不读，`intent.ts:58-60`）；语义层面的目标/核心循环覆盖。

### 2.3 Design QA

**入口与实现**：**没有 Design QA 族，也没有 `design-coverage` 这种判据**。设计层的机器检查全部发生在 `compile-design` / `buildDesign`：
- schema gate：`GameDesignSpecSchema.safeParse`（`packages/game-design/src/build-design.ts:155-162`）。
- 相机：`cameraSupported`（`:132-142`），`vws.camera.mode` 对 `RuntimeProfile.capabilities`。
- 档案差集：`profileDifferences` 的 `mechanics[].mechanic − profile.mechanics` 与 `runtimeRequirements − profile.capabilities`（`:145-153`；今天两边同源，第二条恒空，文件头自白）。
- 意图覆盖：`intentCoverage` → `auditIntentCoverage`（`:89-129`）。
- 任一拒绝 → `{ok:false, kind:"rejected"}`（`:175-176`），`compileDesign` 抛 `DesignRejectedError`，**只走一趟、不重采样**（`packages/game-design/src/compile-design.ts:288-300`）。

**能否验证设计对意图的覆盖，而非只检查文本相似？**
- **可以验证「覆盖」，但只是 id 集合**（同 2.2）；**明确不检查文本相似**。所以答案不是「文本相似」，也不是「语义覆盖」。
- 覆盖之外的设计质量（关卡布局、目标/失败条件是否自洽、反馈、progression、难度）**没有判据**。`GameDesignSpecSchema` 的文件头明写「它管有没有做决定，不管决定对不对」（`game-design.ts:96-119`）。
**finding / severity / blocking**：不是 QA finding，是 `Rejection[]`（`design-attempts.ts` 的契约）；退出码 4，且在**生图之前**（`create-game.ts:305-315`、`pipeline/tests/create-game.test.ts:339-344`）。
**CLI / MCP**：同一 `compileDesign`；无差异。
**正例 / 负例**：`packages/game-design/tests/build-design.test.ts:94,103,113`（意图缺机制/缺实体/串桶）、`:137-157`（相机不支持）、`:171-178`（profile 缺机制）；`compile-design.test.ts:99-136`（拒绝只走一趟、账上无失败痕迹、相机拒绝）。
**未覆盖**：设计语义质量；多关卡（契约允许多关，链上一次只出一份 config）；意图里的「近似机制」；设计是否真的可实现为可玩关卡（那被 `reachability` 部分覆盖，但只覆盖终点/拾取物）。

### 2.4 Asset QA

**入口与实现**：`packages/qa/src/visual.ts:110-123`（`constructiveConstraint`）逐资产调 `packages/contracts/src/audit.ts:45-83`（`auditAssetSpec`）。`pack` 自己也调一次同一函数，但**只把结果放进返回值、不失败**（`packages/assets/src/pack.ts:1290-1300`）；`runBuild` 不消费 `packed.audit`（`create-game.ts` 全文无 `audit`），所以**真正让不一致变成 error 的是 QA**。
**finding 生成条件**
- recipe 里的 id 在包里没有 → `error`（`visual.ts:114-117`）。
- `spec.kind ≠ entry.kind`（`audit.ts:49`）。
- 标称尺寸不一致（`audit.ts:51-52`）；`entry.size` 来自**实际第一帧**的像素尺寸（`pack.ts:1211`），所以这条对账确实反映产物。
- 动画名缺失/多余、帧数不一致（`audit.ts:57-65`）；非 animation 却带多帧（`audit.ts:75-76`）。
- drawlist 的 `viewBox` ≠ 声明尺寸（`audit.ts:79-83`）；drawlist 文件不存在则**静默跳过**（`visual.ts:127-137`，`:132`）。
**不检查**：文件是否存在、`files[].checksum`、图集 JSON 里的真实帧矩形/尺寸、第二帧及之后的尺寸、额外资源（包里有、recipe 里没有）、透明通道、内容质量。checksum 只在 `verifyPack`（`packages/assets/src/ops.ts:1662-1730`）；`runBuild` 不调用它。
**severity / blocking**：全部 `error`（`visual.ts:115,120`），会阻断 `create/build`。
**CLI / MCP**：同一 runner、同一结果；无差异。
**正例 / 负例**：正例 `visual.test.ts:55-68`（真包 last-train/v2 零 finding）；负例 `:71-95`（尺寸）、`:87-99`（帧数）、`:100-114`（清单有包里没有）、`:115-125`（viewBox）；契约侧 `packages/contracts/tests/asset-spec.test.ts:255-321`（动画/帧数/尺寸/kind/viewBox）。
**真实产物**：`verify` 对真包 `pack/v1` 退出 0（15 文件 checksum）、对 `pack/v7` 退出 0（157 文件）——这证明**手动 verify 有效**，但不证明它在链上被调用。E3。

### 2.5 Visual QA

**入口与实现**
- 自动：`packages/qa/src/visual.ts:84-99`（`visualQaRunner`），两条判据 `constructive-constraint` / `palette-binding`。
- 免费观察：`packages/pipeline/src/create-game.ts:509-519` 在 QA 前调 `inspectPack`，把 `summary` 塞进 `QaContext.inspectObservation`；合成器只把它原样放进 `observations`（`packages/qa/src/assemble.ts:97-100`）。
- 付费手动：`packages/pipeline/src/review.ts:76-142` → `packages/assets/src/review.ts:100-170`（`reviewPack`），CLI `review` 独占（`cli.ts:603-607`），**不在创建链**。

**自动 Visual QA 到底读什么？**
- `ctx.recipePath`（JSON）、`packDir/manifest.json`（JSON）、以及 `manifest.assets[].authoring[]` 指向的 drawlist JSON（`visual.ts:85-88,127-137`）。
- `palette-binding` 读 `manifest.palette.coverage` 与逐资产 `entry.paletteBinding` 的**声明计数**（`visual.ts:157-174`）；文件头 142-155 行明写「扫不了像素……这里做的是报表级的对账」。
- **不读**：任何 PNG、参考图、stylespec、视觉模型、像素统计。`packages/qa` 的依赖只有 `contracts`（`packages/qa/package.json:13-14`；`scripts/check-deps.mjs:24`）。
- **不消费 `inspectObservation` 做判据**：`ctx.inspectObservation` 的唯一读者是 `assemble.ts:97`（装配观察），三条判据族都不看它。

**比较对象、阈值、误报边界**
- 自动链：**没有比较对象，没有相似度阈值**。`palette-binding` 是 0 容差的对账；`constructive-constraint` 是精确相等/数量相等。`qa.ts:113-121` 的注释明确：`style/palette/silhouette/composition/material` 没有可算形式，`character/animation consistency` 的可算代理（逐帧外接矩形）在跳跃帧会误伤，全部**不做判据**。
- 免费 `inspect`：读真实图集/母版 PNG，算 `paletteUsage`（`ops.ts:1751+`）、`sourceSizes`（`ops.ts:1850-1890`）、`backgroundCoverage`（`packages/assets/src/coverage.ts:21`）。它**不和参考图比**，只报数；没有阈值；`inspectPack` 的文件头与行内文案反复写「观察，不是判据」。
- 付费 `reviewPack`：**真的把联系表 + 原图一起喂模型**（`review.ts:145-160`；提示词在 `:157`：「哪些地方不像上面这个风格规格（也就是不像第一张原图）？不要打分，不要给通过/不通过」）。无阈值、无自动裁决、失败不抛（`review.ts:118-166`；`packages/assets/tests/review.test.ts:54-95`）。实验记录明确写着「改了之后视觉模型会不会真看出差异 —— 没量」（`.scratch/game-maker-v2/experiments/78-reviewpack-wiring/README.md` 的「明确没量的」段）。
- 误报边界（自动）：drawlist 缺失静默跳过；尺寸只比标称（第一帧）；`paletteBinding` 只比声明；`unbound` 不要求为 0（`visual.ts:151-155`）。

**finding / severity**：构造性约束与色板对账的每条 finding 都是 `error`（`visual.ts:115,120,164,170`）。`palette-binding` 不在包里另找像素；`palette.size` 自洽由 manifest 自己的 `superRefine` 守（`assetpack.ts:302-303`），不在 QA 重复。
**阻断**：`error` 会阻断（见 2.8）；观察与 review 不阻断。
**CLI / MCP**：同一 runner；差异只在人类输出（CLI 有 inspect 摘要，MCP 没有，见 §5）。
**正例 / 负例**：`visual.test.ts:55-68`（真包零 finding）、`:71-167`（尺寸/帧数/缺资产/viewBox/coverage/ref）；`assemble.test.ts:95-118`（inspect 观察原样装配，不改变 verdict）、`:119-150`（观察换成任意内容，裁决不变）；`create-game.test.ts:769-800`（inspect 成功/抛错两档）。
**未覆盖**：风格相似度、色板相似度、剪影、构图、材质、角色一致性、动画一致性（都是**观察或人工**）；像素级色板绑定；参考图是否被正确使用；生成图是否真的像参考图；Aspect 差异是否可接受（+52.4% 也只是观察）。

**关键证明（回答票面硬边界）**
1. **读的是真实产物吗？** 自动 QA 读的是**真实落盘的 JSON 元数据**（recipe/manifest/drawlist），不是图片；`entry.size` 由真实第一帧尺寸生成（`pack.ts:1211`），所以尺寸对账有真实成分。E1。
2. **和参考风格比过吗？** **自动链没有**；免费 inspect 只读产物、不读参考图；只有付费手动的 `review` 做了真实比较。E1 + E2（测试是假 fetch）+ **E3 absent**（从未真跑）。
3. **影响验收/退出码吗？** 元数据 `error` 会（E2）；观察与 review 不会（E2 + E3）。真实 `qa-report.json`（`.scratch/game-maker-v2/experiments/e2e-wasteland/raw/run-out-2026-10-18a/wasteland-scavenger-assets/run/v1/qa-report.json`）显示 `checked` 5 条、`failures: []`、`inspect/review` 均 `unavailable`——它是 v3 接线**之前**的产物（理由文案还是「创建链没有跑 inspect」），**没有**提供「inspect 进链后」的真实证据。

### 2.6 Gameplay QA

**入口与实现**：`packages/qa/src/gameplay.ts:71-86` → `auditReferences`（`game-config.ts:271-387`）+ `auditReachability`（`reachability.ts:44-225`）。
**是否真实启动游戏并执行输入？** **否**。`gameplay.ts:37-43` 明写「不跑游戏（Playwright / headless 那一簇本图不做）」，改用纯静态可达性。仓库里确有真实浏览器冒烟 `packages/demo/probe/smoke.mjs` / `smoke-td.mjs`，但它们**不进 CI**（`smoke.mjs:5-8` 自白）、不接 QA、只在人工命令里跑；真实输入证据是 `.scratch/asset-integration-v1/runs/2026-10-20e-site/site-report.md` 的 CDP `ArrowRight` / `Space` 驱动。
**能否验证目标/失败/胜利/关卡可达？**
- 目标与拾取物可达：**部分**。`auditReachability` 找出 `pickup` 与 `objective.gate`（`reachability.ts:124-129`），只报够不到的（`:215-224`）。
- 「可达」不被证明：文件头 11-24 行明写模型往「玩家更强」偏、可达集是**上界**；「在里面」什么都不保证。
- 失败/胜利的实际执行：**不查**。`objective` 只有 `collect-then-reach`（`game-config.ts`），但没有任何东西验证运行时真的触发胜利/失败。
- 输入/移动/碰撞/交互：**不查**（`gameplay.ts:9-18` 说明它们是外壳行为原语，不可能是「这一版设计错了」的证据）。
- 危险物：当作空气（`reachability.ts:15-18`），所以「冲过危险物」不会被判不可达，也不会被判可玩。
**finding / severity**：引用族 `merged` 把多条 `ConfigIssue` 合成一条；有任一 error 就是 error，否则 warning（`gameplay.ts:96-106`）。可达性每条不可达实体一条 error（`reachability.ts:215-224`）。
**链上可响性**：`reference-resolution` **恒绿**（`compile-runtime` 的 `auditGameConfig` 先拒，`gameplay.ts:21-30`）；`reachability` **能响**，是 QA 独有的一条（CLI 实测 `cli-create.test.ts:409-420`）。
**CLI / MCP**：同一 runner；无差异。
**正例 / 负例**：`gameplay.test.ts:53-63`（真配置零 finding）、`:65-100`（坏动画/错种类/多问题合一）、`:102-124`（自洽族不进本判据）、`:126-146`（挖沟报不可达、从不报可达）；契约侧 `reachability.test.ts:35-116`（通/沟/墙/高台/出生点非法/一个身位）。
**未覆盖**：真实 boot；键盘输入；移动/跳跃/碰撞；拾取与胜利触发；失败/死亡；多关卡；危险物；难度；真实可通关（只有上界）。

### 2.7 Integration QA

**入口与实现**
- QA 侧：`reference-resolution`（`gameplay.ts:79`）→ `auditReferences`（`game-config.ts:271-387`）→ `resolvePackRef`（`assetpack.ts:377-427`）。
- 上游侧：`compileRuntime` 在写 config 前跑 `auditGameConfig` + `auditScreenSpace` + `auditLayerCoverage`，error 就不落盘（`packages/assets/src/ops.ts:1046-1059`）。
- 站点侧：`assembleSite` 重新跑 `auditGameConfig` + `auditScreenSpace` + `auditGeometry`，error 就不产站点（`packages/demo/src/site.ts:191-213`）；`laySite` 复制包与 config。
**是否验证资源被 GameConfig 正确引用并进入最终 Demo？**
- 引用：**验证**（id、种类、动画名、帧、砖尺寸、HUD kind/尺寸、背景层）。测试 `game-config.test.ts:128-135` 等。
- 进入最终 Demo：**不验证**。站点层只验证 config/包/几何/HUD，不验证 Phaser 真的加载了每张图；`@game-maker/demo` 不引用 QA（`packages/demo/src/site.ts` 全文无 `qa-report` / `qaVerdict`）。真实「19/19 都进了场景」来自手工 CDP 报告（`site-report.md` 的资源可见性表），不是自动 QA。
- `buildWorld` **绝不抛**，坏数据会画占位符（`packages/demo/src/world.ts:60-100`），所以「能起站点」不等于「资源都在」。
**链上可响性**：`reference-resolution` 恒绿（上游先拒）；站点层自己会在装配期拒，不依赖 QA。
**severity / blocking**：上游 `error` → `CommandError("invalid")` → 退 4；QA error 也会阻断创建链；但 `site` 独立命令只跑上游审计，不跑 reachability/QA。
**CLI / MCP**：CLI `create/build` 走 `assembleFromConfig`（按 format 分派），MCP `create_game` / `assemble_site` 直接 `assembleSite`（没有 TD 分派）；见 W1 票。QA 本身一致。
**正例 / 负例**：`packages/demo/tests/site.test.ts:79-139`（引用缺资源/坏 schema/层盖不住/HUD 出屏 → 不产站点）、`:266-317`（层覆盖与 config 侧同一判据）；`gameplay.test.ts:65-100`。
**未覆盖**：`verifyPack` 不在链上；atlas JSON 与 manifest 帧的一致性；实际渲染/加载；资源是否进入场景；站点是否可启动（人工 CDP 除外）；`site` 绕过 QA。

### 2.8 Publish Gate

**闸门实现**：`packages/pipeline/src/create-game.ts:215-226`（`assertQaPassed`），只筛 `failures.filter(f => f.severity === "error")`；在 `:543` 先 `writeJson(qaReportPath, qa)`，`:544` 再 `assertQaPassed`。CLI 的 `create --yes` / `build` 走 `buildAndSite`：`runBuild` 抛在 `assembleFromConfig` 之前（`packages/cli/src/cli.ts:224-248`），所以站点不产。
**哪些 finding 会阻断成功退出 / 正式发布？**
- 会：`severity: "error"` 的 QA finding（5 条里任何一条），以及上游 schema/业务校验的 error。
- 不会：`warning`（类型允许，但今天没有生产者）、`incomplete` verdict、`observations`（`ok` / `unavailable`）、`review` 的任何结果。
**退出码与目录状态**
- CLI：`CommandError("invalid")` → `EXIT.invalid = 4`（`command.ts:46`）；报告已落盘；站点不产；`run/v<N>` 已定稿并保留；`pack/v<N>` 已产出（钱已经花完）；**没有 `failed-*` 现场、没有 `failureDir`**（`CommandError` 只由 `pack` 带 failureDir，`command.ts:75-85`；`create-game.ts:218-225` 未传）。
- MCP：`create_game` 的 `runBuild` 抛 → 外层 catch 回 `isError: true, _exitCode: 4`（`server.ts:352-360`）；`assembleSite` 在抛点之后，不会执行（`server.ts:280-290`）。
- 测试：`cli-create.test.ts:409-420`（退出码 4、`site` 目录不存在、报告有 `reachability` 失败）；`create-game.test.ts:649-660`（`kind: "invalid"`、报告已落盘）。
**绕过**
- `game-maker site <pack> --config <config>`（`cli.ts:575-591`）与 MCP `assemble_site`（`server.ts:318-326`）**完全不读 `qa-report.json`**。它们只跑 `auditGameConfig` + `auditScreenSpace` + `auditGeometry`（`site.ts:191-213`），而 `reachability` 不在其中（`ops.ts:1046-1052` 也只跑前三族）。
- 一个「终点够不到」的 config 过得了 `compile-runtime` 的业务校验、只有 QA 看得见（`cli-create.test.ts:365` 的注释与测试前提）；因此 QA 失败之后，**同一份包 + config 仍可被 `site` 装配**。E1（源码）+ E2（该 config 过上游校验的测试）。
- `review` 失败不会挡任何产物（`review.ts:4-7`），这是设计。
- `qa: null` 可在 API 层关掉 QA（`create-game.ts:200-201,445`），CLI/MCP 都不暴露这个开关。
**未覆盖**：没有测试覆盖「QA 失败后用 `site` 再装配」这条绕过；没有测试覆盖 MCP 的 QA 失败路径；没有真实归档的 QA 失败 run。

---

## 3. 阻断规则表（汇总）

| 条件 | 生成位置 | 影响 `qaVerdict` | 阻断 `create/build`？ | 退出码 / 表现 | 证据 |
|---|---|---|---|---|---|
| QA finding `severity:"error"` | 三族 | `fail` | **是** | CLI 4；MCP `isError=true, _exitCode=4`；报告已落盘；站点不产 | `create-game.ts:215-226,543-544`；E2 `cli-create.test.ts:409-420` |
| QA finding `severity:"warning"` | 今天无生产者 | 否 | **否** | 正常运行 | `qa.ts:160-162,374-379`；E2 `contracts/qa.test.ts:198-200` |
| `checked < 6` | 恒真（5/6） | `incomplete` | **否**（闸门不看 verdict） | 正常运行；CLI 打「5/6 · 没跑的：层覆盖」 | `assemble.ts:89`；`create-game.ts:206-213`；E2 `create-game.test.ts:575-587` |
| `observation`（inspect/review）任意内容 | `assemble.ts:97-100` | 否 | **否** | 完全不影响 | E2 `assemble.test.ts:119-150`；E3 真包 +52.4% 仍退 0 |
| 族读不到 / 不过契约 | 三族入口 | 不产报告 | 是（硬失败） | 裸 `Error` → CLI **1**（不是 4）；无报告 | `visual.ts:86-88`；`command.ts:88`；E1 |
| 装配出的报告不过 `qa-report/v1` | `runBuild` | 不适用 | 是 | `CommandError("invalid")` → 4 | `create-game.ts:533-538` |
| `qa: null` | 调用方 API | 不适用 | **否（QA 整个不跑）** | 无 `qa-report.json`；无 `qa` 字段 | E2 `create-game.test.ts:590-597` |
| `site` / `assemble_site` | 壳层 | 不适用 | **不读 QA** | 只跑上游审计；可绕过 reachability | E1 `cli.ts:575-591`；`server.ts:318-326` |
| `review` 失败 | 手动命令 | 不适用 | **否** | 自己的 3/4 退出码；包与站点不受影响 | `review.ts:71-74,118-124` |

---

## 4. CLI 与 MCP 一致性

| 项 | CLI | MCP | 一致？ |
|---|---|---|---|
| 默认 runner | `runBuild` 默认 `qaRunner`（`create-game.ts:200-201,445`） | 同 | ✅ |
| 闸门 | `assertQaPassed`（同一 pipeline） | 同 | ✅ |
| 报告落盘 | `run/v<N>/qa-report.json` | 同 | ✅ |
| 失败表现 | 退 4 + stderr 文案（`cli.ts:620`） | `isError:true` + `_exitCode:4`（`server.ts:359`） | 语义一致，传输不同 |
| 失败时站点 | 不产 | 不产（throw 在 assemble 之前） | ✅ |
| inspect 观察的人类输出 | `qaReportOf(..., b.inspectData, ...)` 打摘要（`cli.ts:316,354,402-426`） | `qaReportOf(qa, path, outDir)` **不收 inspectData**，不打（`server.ts:44-62,295-296`） | ❌ 有意为之，且有反证测试（`mcp/tests/create-game-no-digest.test.ts:127-129`） |
| `build` / `review` 工具 | 有（`cli.ts:496,603`） | **无**（TOOLS 列表 `server.ts:72-175`） | 入口面不同 |
| `site` 绕过 QA | 有（`cli.ts:575-591`） | 有（`assemble_site`, `server.ts:318-326`） | ✅（两边都能绕） |
| QA 失败路径测试 | 有（`cli-create.test.ts:409-420`） | **无** | ❌ 测试缺口 |

---

## 5. 测试覆盖（正例 / 负例 / 缺口）

| 维度 | 正例 | 负例（真会响） | 缺口 |
|---|---|---|---|
| Contract/Schema | 三族真 fixture 干净用例（`qa/tests/*.test.ts:55+`） | 坏 JSON / 坏 schema ⇒ 抛（`visual.test.ts:180`、`gameplay.test.ts:148-158`、`intent.test.ts:127-152`、`assemble.test.ts:153-165`） | 族抛到 CLI 的退出码无测试；跨字段业务约束有大量契约测试，但没有「QA 报告层面的 schema 判据」 |
| Intent | `intent.test.ts:64-85` | 缺实体/串桶/缺机制/多缺合一（`:86-126`） | 近似替代（同 id 弱化）无判据、无测试 |
| Design | `build-design.test.ts` 多个 ok 用例 | 缺实体/机制、相机不支持、profile 缺机制（`build-design.test.ts:94-178`）；拒绝不重采样（`compile-design.test.ts:99-136`） | 设计语义质量、文本覆盖（故意不查）、多关卡 |
| Asset | 真包 last-train/v2 零 finding（`visual.test.ts:55-68`） | 尺寸/帧数/缺资产/viewBox/coverage/ref（`:71-167`）；`asset-spec.test.ts:255-321` | 文件缺失/checksum/atlas 帧一致性/额外资源/真实像素尺寸 |
| Visual | 同上 | 同上（都是元数据） | **没有任何「视觉不像参考图」的自动判据或测试**；review 只有假 fetch 测试（`assets/tests/review.test.ts:54-170`） |
| Gameplay | 真配置零 finding（`gameplay.test.ts:53-63`） | 坏引用/不可达（`:65-146`；`reachability.test.ts:54-116`） | 真实启动、输入、胜负、危险物、难度 |
| Integration | `demo/tests/site.test.ts:29-77`（装配成功） | 缺资源/坏 schema/层覆盖/HUD（`:79-139,178-317`） | QA 与站点联合验收；真实渲染；`site` 绕过 QA |
| Publish | `cli-create.test.ts:358-408`（干净 build） | `cli-create.test.ts:409-420`（退 4、无站点、报告在）；`create-game.test.ts:649-660` | MCP 失败路径；`site` 绕过；真实 QA 失败归档（E3 缺失） |

---

## 6. 尚未覆盖的维度（明确 absent / unknown）

**Absent（已确认没有实现）**
- 风格相似度 / 色板相似度 / 剪影 / 构图 / 材质相似度 / 角色一致性 / 动画一致性的**自动判据**（`qa.ts:113-121`、`visual.ts:7-18` 自白；review 仅为人工观察）。
- 自动 QA 读取参考图或真实生成像素（`packages/qa` 不依赖 `assets`；`visual.ts` 无 PNG/参考图读取）。
- 真实启动游戏、执行输入、验证胜利/失败/交互（`gameplay.ts:37-43`；probe 不进 CI）。
- 链上 checksum / 文件存在性校验（`verifyPack` 手动，`runBuild` 不调用）。
- 图集 JSON ↔ manifest 帧的一致性（QA 与 site 都不查）。
- 包内「额外资源」（recipe 没要求但包里存在）的对账。
- `site` 产出后与 QA 报告的一致性校验。

**Unknown / 只有人工证据**
- 视觉风格是否真的匹配参考图：只有付费 `review` 能做，且**从未真跑**（实验 README 明确「没量」）；E3 不存在。
- 真实玩法是否可通：只有人工 CDP 一次（`site-report.md`），不在自动 QA；无重复执行记录。
- `inspect` 进链后的真实 `qa-report.json`：归档中三份报告都是接线前产物（inspect 理由为「创建链没有跑 inspect」）；接线后的证据只有 E2（`create-game.test.ts:775-793`）。
- MCP 的 QA 失败行为：源码可读（E1），无测试、无真实产物。

---

## 7. 本次免费核验（命令 + 退出码）

| # | 命令 | 结果 |
|---|---|---|
| 1 | `npx vitest run packages/qa packages/contracts/tests/qa.test.ts packages/pipeline/tests/create-game.test.ts packages/cli/tests/cli-create.test.ts packages/mcp/tests/create-game-no-digest.test.ts` | **EXIT 0**；8 文件 / **153 tests passed** |
| 2 | `node packages/cli/dist/cli.js inspect .scratch/game-maker-v2/experiments/e2e-wasteland/raw/run-out-2026-10-18a/wasteland-scavenger-assets/pack/v1` | **EXIT 0**；读真实 PNG：色板 9 色、`player-scavenger.run` 源图 1344×768 → 目标 288×108、**长宽比差 +52.4%**；色板外像素 0 |
| 3 | `node packages/cli/dist/cli.js verify <same pack>` | **EXIT 0**；「15 个文件的 checksum 全部对得上」 |
| 4 | `node packages/cli/dist/cli.js inspect .scratch/asset-integration-v1/runs/2026-10-20f-lurker/ruin-scavenger-extraction-assets/pack/v7` | **EXIT 0**；19 资源 / 4 图集；`health-icon` 色板外 41 像素；源图→目标观察多行 |
| 5 | `node packages/cli/dist/cli.js verify <pack/v7>` | **EXIT 0**；「157 个文件的 checksum 全部对得上」 |
| 6 | `node -e` 查 `exitCodeOfError`：裸 `Error` → 1，`CommandError("invalid")` → 4 | **1 / 4** |

**没有运行**：`create` / `build` / `plan` / `pack` / `compile-runtime` / `compile-td-game` / `site` / `review`（前七项按票面禁止；`review` 会触发一次付费视觉调用，且本票无预算）。

**真实产物索引**
- 归档 QA 报告（接线前）：`.scratch/game-maker-v2/experiments/e2e-wasteland/raw/run-out-2026-10-18a/wasteland-scavenger-assets/run/v1/qa-report.json`（另见 `run-out-2026-10-13h/...`、`run-out-2026-10-17d/...`）。三份均 `checked=5`、`failures=[]`、`inspect/review=unavailable`。
- 真实包：同上 `pack/v1`；最终包 `.scratch/asset-integration-v1/runs/2026-10-20f-lurker/ruin-scavenger-extraction-assets/pack/v7`。
- 真实站点 + 人工玩法：`.scratch/asset-integration-v1/runs/2026-10-20e-site/site-report.md`、`drive-cdp.mjs`、`cdp-run.png` / `cdp-jump.png` / `cdp-a.png` / `cdp-b.png`；该 run 下**没有** `qa-report.json`（`find` 为空），说明它是 `site` 独立命令装配的。
- 手动 CDP 冒烟脚本：`packages/demo/probe/smoke.mjs:5-8`（自白「不进 CI」）、`smoke-td.mjs:12-13`（TD 各自一套）。

---

## 8. 快速定位

- QA 判据全集与裁决：`packages/contracts/src/qa.ts:109`（`QA_JUDGEMENTS`）、`:160`（severity）、`:266`（报告 schema）、`:340`（`buildQAReport`）、`:374`（`qaVerdict`）。
- 三族：`packages/qa/src/visual.ts:84`、`gameplay.ts:71`、`intent.ts:77`；装配：`assemble.ts:73`。
- 闸门与落盘：`packages/pipeline/src/create-game.ts:215-226,509-544`。
- 契约审计：`audit.ts:45`、`intent-coverage.ts:110`、`reachability.ts:44`、`game-config.ts:271`、`layer-coverage.ts:94`。
- 真实像素观察：`packages/assets/src/ops.ts:1850-1945`（`sourceSizeObservations` / `inspectPack`）、`packages/assets/src/coverage.ts:21`。
- 付费视觉比较：`packages/assets/src/review.ts:100-170`；手动接线：`packages/pipeline/src/review.ts:76-142`。
- 站点审计（无 QA）：`packages/demo/src/site.ts:37-160,167-213`。
- 壳层输出：`packages/cli/src/cli.ts:402-426`、`packages/mcp/src/server.ts:44-62`。

---

## Answer

**W4 的裁定：现有 QA 是「静态判定为主、观察为辅」的能力，不是「视觉/玩法验收」。8 维里真正成立的只有 Contract/Schema、Intent（id 半）、Asset（元数据半）、Gameplay（静态可达性）；Visual 的风格一致性、真实玩法、Demo 集成均未成立；发布闸门存在但可被 `site` / `assemble_site` 绕过。**

关键结论与证据强度：

1. **自动 QA = 5/6 判据 + 2 条观察，`incomplete` 恒真且不阻断。** `layer-coverage` 不归任何族（`qa.ts:109`、`assemble.ts:85-89`）；闸门筛 `failures` 的 `error`（`create-game.ts:215-226`）。E1 + E2。
2. **Visual QA 不读真实图片、不读参考风格，只对账 JSON 元数据。** 两条判据是 `auditAssetSpec` 与色板声明计数（`visual.ts:110-174`）；`packages/qa` 依赖白名单只有 `contracts`（`package.json:13-14`、`check-deps.mjs:24`）。「有 Visual QA 模块」≠「视觉一致已验证」。E1。
3. **真实视觉比较只存在于付费、人工、非阻断的 `review`**：`reviewPack` 确实把联系表 + 原图一起喂模型（`review.ts:100-170`；提示词 `:157`），但它不在创建链、无阈值、无评分、永不阻断（`pipeline/review.ts:4-7`），且**从未真跑过**（实验 README 的「明确没量的」）。E1 + E2；E3 absent。
4. **免费 `inspect` 读真实 PNG，但结果只进 `observations`**：`inspectPack` 解图集/母版（`ops.ts:1850-1945`），`assemble.ts:97-100` 只装配；真实包 `player-scavenger.run` 长宽比差 **+52.4%** 仍然退出 0。这证明「观察不阻断」有真实证据，也证明「真实偏差不会被判失败」。E1 + E3。
5. **Intent / Design 覆盖是 id 集合，不是语义。** `auditIntentCoverage` 只比实体桶与机制 id（`intent-coverage.ts:110-131`）；同一 id 填更弱的 `mechanic` 能过。文本相似被证伪后故意砍掉（同文件 1-35 行）。Design QA 没有独立族，R12 拒绝只在生成前做 schema/相机/机制/覆盖检查（`build-design.ts:132-181`）。E1 + E2。
6. **Asset QA 不验证文件/checksum/真实帧尺寸**：`auditAssetSpec` 只对账 spec 与 manifest 元数据（`audit.ts:45-83`）；`verifyPack` 是唯一 checksum 闸，但 `runBuild` 不调用（`ops.ts:1662-1730`）。E1 + E3（verify 独立有效）。
7. **Gameplay QA 不启动游戏**：`auditReachability` 是上界 BFS，只报够不到的终点/拾取物（`reachability.ts:44-225`）；输入/碰撞/胜利/失败/危险物均不验证（`gameplay.ts:9-43`）。真实可玩性只有一次人工 CDP（`site-report.md`）。E1 + E3（人工）。
8. **发布阻断只在 `create/build` 上成立，且可被 `site` / `assemble_site` 绕过**：QA error → 报告先落盘再抛 → CLI 4 / MCP `isError`，站点不产（E2）；但 `site` 与 `assemble_site` 不读 `qa-report.json`，且不跑 reachability（E1）。一个「终点够不到」的 config 过得了上游业务校验（E2 `cli-create.test.ts:365`），所以 QA 失败后仍可手工发布。
9. **CLI/MCP 判定同源，呈现与入口面不同**：CLI 打 inspect 摘要，MCP 明确不打（`mcp/tests/create-game-no-digest.test.ts:127-129`）；MCP 没有 `build` / `review`，但同样可用 `assemble_site` 绕过 QA；MCP 的 QA 失败路径**无测试**（E1）。
10. **证据缺口**：没有归档的真实 QA 失败 run（阻断只有 E2）；没有接线后的真实 `qa-report.json`（三份归档均是接线前）；视觉相似度没有 E3；MCP 失败路径与 `site` 绕过均无测试。E0/E1 不应被写成已验收。
