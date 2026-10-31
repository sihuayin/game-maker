# P0-00 能力差距证据表

| 属性 | 内容 |
|---|---|
| 审计基线 | `v2-foundation` · `ea53240`（2026-10-20） |
| 当前 HEAD（写作时） | `7aa98d7`（2026-10-21） |
| 任务书 | [P0-00-task-brief.md](P0-00-task-brief.md) |
| 证据来源 | [W1](../../.scratch/p0-00-audit/research/w1-call-graph.md) · [W2](../../.scratch/p0-00-audit/research/w2-field-consumption.md) · [W3](../../.scratch/p0-00-audit/research/w3-asset-routes.md) · [W4](../../.scratch/p0-00-audit/research/w4-qa-capability.md) · [W5](../../.scratch/p0-00-audit/research/w5-test-matrix.md) · [W6](../../.scratch/p0-00-audit/research/w6-e2e-evidence.md) |
| 相关交付物 | [调用链](P0-00-call-graph.md) · [测试矩阵](P0-00-test-matrix.md) · [E2E 证据](P0-00-e2e-evidence.md) · [P0 范围](P0-00-p0-scope.md) |
| P0 裁定 | [Q1–Q10 全部 (a)](P0-00-p0-scope.md#0-裁定逐字记录) |

## 0. 使用说明

### 0.1 状态定义（任务书 §4）

- `implemented`：源码存在，调用链已接通，测试覆盖关键行为，且所需产物证据成立。
- `partial`：有部分实现，但调用链、边界、测试或真实产物至少一项不完整。
- `absent`：已检查相关入口和调用链，确认没有实现该能力。
- `unknown`：尚未完成足够核查；**不得**写成 `absent`。

### 0.2 证据强度（任务书附录 A）

`E0` 推测 · `E1` 源码 · `E2` 测试 · `E3` 真实产物。
涉及「能生成风格一致的游戏」「玩法可用」「QA 能阻断错误产物」等核心结论，原则上需要 E3；
E0/E1 不得写成已验收。

### 0.3 分流（任务书 §6）

`复用` · `修正` · `新增` · `补测` · `补文档` · `暂缓`。

### 0.4 优先级

- **P0**：直接阻断「风格图 + 意图 → 资源完整、风格匹配、可玩的 Demo」，或可能导致错误地宣告成功。
- **P1**：显著影响质量、可诊断性或维护成本，但存在可接受的临时人工步骤。
- **P2**：优化项，不影响当前最小端到端验收。

> P0 只定范围与验收口径，不实施；具体施工见 [P0 范围](P0-00-p0-scope.md)。
> 行号来自 `ea53240`；`7aa98d7` 后主链未变，但新增 `accept`，行号可能漂移。

## 1. 能力总览（按区域）

| 区域 | 已成立（implemented / E2–E3） | 主要缺口 | 结论 |
|---|---|---|---|
| 入口与调用链 | 两段式主链、版本分配、失败现场、CLI/MCP 共用 core | MCP 错误翻译、`stylePath`、工具面、少量路径/清理细节 | **partial** |
| 规格字段消费 | `camera.mode`、`style.palette`、`styleReferences`、`characterId`/`masterAsset`、`runtimeProfile`、`levels[0].id`、`GameConfig` 多数运行字段 | 大量 prompt-only 字段；胜负/进阶/难度无运行时落点；`objective.gate` 假胜利；fps/loop 断链；motion 只 hazard | **partial** |
| 资源生产路线 | `planAssets` 唯一规划入口、`resolveRoute` 唯一路线写入、三值 route、sidecar、六类样例 | `frames` 静默折叠；`import` 不可达；六类语义规则粗；import 缺文件裸 ENOENT | **partial** |
| 资源包执行 | pack 四类 source、帧/尺寸对账、失败现场、checksum（手动 `verify`） | `verifyPack` 不在链上；空色板 gate 太晚；文件/像素完整性无链上校验 | **partial** |
| QA / 发布闸门 | 5 条静态判据、引用族、静态可达性、`create/build` 的 error 阻断、CLI/MCP 同源 | 6/6 不齐、Visual 不读像素/参考图、Gameplay 不启动、`site` 可绕过、`incomplete` 不阻断 | **partial → absent（视觉/玩法）** |
| 测试与 fixture | 契约负例、路线 resolver、pack 对账、失败现场、两段式等值 | 新实体、启动+输入、CLI/MCP 对照、全链 site 失败、真实 image/import 包 fixture | **mixed（3 existing / 5 needs strengthening / 3 missing）** |
| E2E | 归档上游真跑、HEAD 下游零付费重放可玩、失败样例 | 无 HEAD 单跑；归档单跑出现「QA 全绿但不可玩」 | **partial；单跑 absent** |

## 2. P0 能力差距（13 条）

> 这 13 条是 Q1–Q8 裁定后的 P0 范围。每条的施工边界与依赖见 [P0 范围](P0-00-p0-scope.md)。

| ID | 能力 / 需求 | 状态 | 源码证据 | 调用链 | 测试证据 | 真实产物证据 | 缺口 | 影响 | 分流 | 优先级 | 验收条件 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `CAP-ENTRY-01` | MCP `create_game` 对设计拒绝 / 契约错误 / 上游不可达返回与 CLI 一致的 3/4 退出码 | partial | `mcp/server.ts:338-360`；`cli/cli.ts:207-221`；`contracts/command.ts:88` | MCP `create_game` → `runUnderstanding`/`runBuild` 抛 `DesignRejectedError` / `CompileDesignError` / `AnalyzeReferenceError` → 外层 catch → `exitCodeOfError` → `_exitCode:1` | 无；`server.test.ts:112-118` 只钉 usage=2 | 无 | 裸 Error 未按形状翻译 | MCP 调用方无法区分上游(3) / 不合法(4) / 内部错误(1) | 修正 + 补测 | **P0**（Q9） | MCP 设计拒绝 ⇒ 4；HTTP 失败 ⇒ 3；契约错误 ⇒ 4；usage ⇒ 2；有测试 |
| `CAP-ENTRY-02` | MCP `create_game` 接受绝对路径 `stylePath`（与 CLI 相同） | partial | `mcp/server.ts:273`；`cli/cli.ts:188`；`visual-world.ts:90-93` | MCP `create_game` → `String(args.stylePath)` → `runUnderstanding` → `StyleReferencePath` 拒绝对路径（裸 Error） | 无；`create-game-no-digest.test.ts` 注释自白，测试手工转相对路径 | 无 | MCP 未相对化 | 常见输入在 MCP 第一笔上游前失败 | 修正 + 补测 | **P0**（Q9） | 绝对路径与相对路径同样成功；测试覆盖 |
| `CAP-SPEC-01` | `GameConfig.objective.gate` 决定胜利；只有 gate 能触发胜利 | partial | `game-config.ts:184-188,338-339`；`demo/shell/scene.ts:158-162,269-274,26,160` | config → `buildWorld` 给每个 goal 绑 `tryWin()` → overlap → `tryWin()` 只看 `pickupCount`；`this.gate` 赋值后从未读 | `game-config.test.ts:128-135` 只验引用；无「只有 gate 能赢」 | 10-17d config 有 `chest-1` 与 `gate-1` 两个 goal | 任一 goal 都能赢 | 提前胜利；目标语义失效 | 修正 + 补测 | **P0**（Q5） | 两 goal 配置：捡齐后碰非 gate goal 不胜利，碰 gate 才胜利；测试在 `demo/tests` |
| `CAP-SPEC-12` | 设计四桶（enemies / npcs / interactables / resources）→ 资源清单的覆盖闸 | absent | `assets/ops.ts:201-238`（只有玩家动画闸）；`planner-masters.ts` 只补母版；无 design→recipe id 对账 | `GameDesignSpec` 四桶 → `assetPlanPrompt` → 模型 recipe；规划期不核对 id 是否被覆盖 | `plan-assets-player-gate.test.ts` 只覆盖玩家 | 10-17d 恰好对齐，但无 gate；10-18a recipe/manifest 不一致只作完整性异常登记 | 模型可漏 / 改名而不被拒 | 资源不完整仍成功 | 新增判据 + 补测 | **P0**（Q7） | 删掉一个敌人资源 ⇒ 规划期拒绝；豁免规则有测试 |
| `CAP-SPEC-17` | 空 VWS 色板在下游付费调用前被拒 | partial | `visual-world.ts:199-206`（允许空）；`assets/ops.ts:1503-1504`（pack 才拒）；`ops.ts:249` 入口不查 | `analyzeReference` → 空色板 VWS → 设计 / DNA / 规划已发调用 → `pack` `readStyle` 才抛 | `style-gate.test.ts` 只测 pack 期拒绝 | 无 | gate 后移 | 设计 / 规划的钱已花掉才失败 | 修正（前移 gate） | **P0**（Q7） | `analyzeReference` 产出 VWS 后、下游任何付费调用前拒绝空色板；单独 `planAssets` 入口同样拒绝；测试断言下游调用 0 次 |
| `CAP-ASSET-01` | `frames` 候选不再被静默改写成 `image` | partial | `assets/ops.ts:372`；`route.ts:143-155`；`contracts/recipe-tool.ts:128` 允许 `frames`；`prompt.ts:807-810` 只告诉模型三值 | 模型给 `frames` → `planAssets` 映射成 `image` → `sourceForDecision` 写 `{kind:"image"}` → sidecar `candidate:"image"` | `pack-frames.test.ts:37-90` 只直接喂 `buildAssetPack`；无 planner / resolver / sidecar 测试 | 无 `frames` 规划产物 | 静默降级；模型原选择丢失 | 逐帧生成被换成「一图 N 帧」，与「不得静默降级」相抵触 | 修正 + 补测 | **P0**（Q6） | `frames` 候选 ⇒ 明确 `invalid`（推荐）或参数化保留；**P0 采用明确失败：消息点名资源与真实候选（`frames`），不落 sidecar**；测试覆盖 planner + 失败消息（2026-10-22 票 12 裁定 A） |
| `CAP-ASSET-06` | `runBuild` 在 pack 之后、config / QA / site 之前校验包完整性 | absent | `assets/ops.ts:1662-1730`（`verifyPack`）；`pipeline/create-game.ts:417-551`（`runBuild` 不调用）；`contracts/audit.ts:45-83`（QA 只对账元数据） | `runBuild` → `packAssets` → `compileRuntime` → `qaRunner`；`verifyPack` 只在手动 CLI `verify` | `cli.test.ts:123-138`（verify 命令）；无链上用例 | 手动 `verify pack v7` exit 0（157 checksum） | 链上无 checksum / 文件存在性 | 损坏或缺文件的包可继续到 QA / site | 修正 + 补测 | **P0**（Q7） | 篡改包内文件 ⇒ `runBuild` 在 config / QA / site 前 `invalid`；报告 / 退出码有测试 |
| `CAP-QA-01` | QA 跑满 6/6 判据；`incomplete` 不可发布 | partial | `contracts/qa.ts:109`（`QA_JUDGEMENTS`）；`qa/assemble.ts:89`（`layer-coverage: { ran: false }`）；`create-game.ts:215-226`（闸门只看 error） | `qaRunner` → `assemble` → `checked=5/6` → `qaVerdict=incomplete`；闸门忽略 verdict | `create-game.test.ts:575-587` 反而钉住 5/6 | 归档三份 `qa-report` 均 `checked=5` | 一条判据从未跑；`incomplete` 不阻断 | 「QA 通过」语义不完整 | 修正 + 补测 | **P0**（Q4） | 干净包 `checked=6`；`layer-coverage` 有正负例；`incomplete` 阻断发布 |
| `CAP-QA-02` | 已读真实像素的完整性指标成为可回归的 QA 判据（阈值化） | partial | `assets/ops.ts:1900-1945`（`inspectPack`）；`pipeline/create-game.ts:509-519`（塞进 `QaContext`）；`qa/assemble.ts:97-100`（只作 observations）；`qa/visual.ts` 不读像素 | `runBuild` → `inspectPack` summary → `QaContext.inspectObservation` → `observations`；三条判据族都不消费 | `inspect.test.ts` 明确「观察，不是判据」；`assemble.test.ts:119-150` 观察不改变裁决 | 真包 `player-scavenger.run` 长宽比差 **+52.4%**、v7 `health-icon` 41 个色板外像素，均 exit 0 | 没有阈值、不阻断 | 明显坏的像素仍被宣告成功 | 修正 + 补测 | **P0**（Q3） | 已知坏统计 fixture ⇒ QA `error`；已接受包 ⇒ 通过；阈值文档化；有新测试 |
| `CAP-QA-07` | 发布前真实启动游戏、注入输入、验证拾取与胜利 | absent | `qa/gameplay.ts:37-43`（「不跑游戏」）；`contracts/reachability.ts:44-225`（静态 BFS）；`demo/probe/smoke.mjs:5-8`（不进 CI） | `gameplayQaRunner` → `auditReferences` + `auditReachability`；无 boot / input / win 执行 | **missing**（W5 类别 8）；`td-sim` 只是纯领域模拟 | 人工 CDP 一次（`site-report.md`）；W6 的 HEAD 重放 | 无启动 / 输入 / 胜负执行 | 「QA 绿但不可玩」无法自动发现 | 新增 + 补测 | **P0**（Q2） | 最小 headless smoke：启动站点 + 状态感知移动/跳跃 + 拾取 + 胜利；负例故意打断 gate/pickup ⇒ 红；零付费 |
| `CAP-QA-08` | 所有发布路径（`create/build`、`site`、MCP `assemble_site`）验证当前包的 QA | partial | `cli/cli.ts:575-591`；`mcp/server.ts:318-326`；`demo/site.ts` 全文无 QA 引用；`create-game.ts:215-226` | `site` / `assemble_site` → `auditGameConfig` + `auditScreenSpace` + `auditGeometry` → `buildWorld`；不读 `qa-report.json`，不跑 reachability | `cli-create.test.ts:365` 证明「终点够不到」的 config 过得了上游校验；无绕过测试；MCP 失败路径无测试 | `2026-10-20e-site` 下无 `qa-report.json`；归档第二十跑 QA 全绿但不可玩 | 发布路径不验证 QA | QA 失败后仍可手工发布 | 修正 + 补测 | **P0**（Q4） | `site` / `assemble_site` 缺 QA、有 error、`incomplete` ⇒ 拒；通过 ⇒ 产站点；CLI/MCP 各有测试 |
| `CAP-RUNTIME-01` | 危险物重置玩家后物理体与地面关系正确，不软锁 | partial | `demo/shell/scene.ts:264-267`（`hitHazard` 只 `setPosition`，无 `body.reset()` / 速度归零） | hazard overlap → `hitHazard()` → `setPosition(spawn)`；物理体可能在地面以下 | `hazard.test.ts` 只测三角波位置；无 boot / 输入测试 | `hazard-repro-trace.json` + 截图：重置后 y=262.5（地面顶 250）继续下落到 413+ | 重置不重置物理体 | 掉穿地面、不可恢复 | 修正 + 补测 | **P0**（Q5） | 空中/固体上被重置后玩家在地面以上、可继续；重复重置不累积；有测试 |
| `CAP-E2E-01` | HEAD 上从「风格图 + 意图」到可玩 Demo 的单跑验收 | absent | 主链存在（见[调用链](P0-00-call-graph.md)） | `create` → `runUnderstanding` → `runBuild` → `assembleSite` | 不适用（真实运行，不属于测试套件） | 归档上游 + HEAD 下游重放；**无 HEAD 单跑** | 没有一次单跑 | 不能宣称端到端验收通过 | 新增（验证能力）+ 付费票 | **P0 最终验收门**（Q8） | 一次真实单跑：记录输入、命令、产物、ledger、截图、玩法轨迹；或记录阻塞与最小补充条件；不得无条件宣称通过 |

> **2026-10-22 修订（票 12 裁定 A）**：`CAP-ASSET-01` 的「验收条件」已按票 12 修订为
> 「明确失败 + 失败消息点名真实候选（`frames`），不落 sidecar」；本表其余列（源码证据 / 调用链 /
> 测试证据 / 缺口 / 影响）是审计基线 `ea53240` 的证据快照，保持原样，不倒写历史。

## 3. P1 能力差距（21 条）

> P1 = 显著影响质量 / 可诊断性 / 维护成本，但有可接受的临时人工步骤。施工顺序见 [P0 范围](P0-00-p0-scope.md) §6。

| ID | 能力 / 需求 | 状态 | 源码证据 | 调用链 | 测试证据 | 真实产物证据 | 缺口 | 影响 | 分流 | 优先级 | 验收条件 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `CAP-SPEC-02` | 设计层胜负条件有明确的运行时落点，或明确声明为叙事 | partial | `game-design.ts:196-197`；`assets/prompt.ts:846-865`（`designBrief` 不含）；`scene.ts:264-267` | Design `winConditions` / `loseConditions` → `designBrief` 不插值 → config 无字段 → 运行时无失败态 | 无 | A4 设计写「接触敌人即失败」；A3 外壳只退回起点 | 无失败态；文本与运行时不符 | 设计意图不可执行；文档可能过度承诺 | 补文档 + 补测（Q5） | P1 | 文档/契约明确「叙事，不是运行时契约」，并从验收剔除；或另立票新增可执行原语 |
| `CAP-SPEC-03` | 多关卡选择，或明确声明只编译第一关 | partial | `assets/ops.ts:914-918`；`pipeline/create-game.ts:508-516` | `compileRuntime` 取 `opts.levelId ?? design.levels[0].id`；create 不传 `levelId` | `compile-runtime.test.ts:369-377`（默认第一关） | A4 设计有 3 关；A3 只装配 1 关 | 多关设计被静默截断 | 设计完整度与产物不一致 | 补文档 / 修正 | P1 | 文档与检查点写明「第一阶段只编译第一关」；或 create 支持选关并有测试 |
| `CAP-SPEC-04` | 外壳从 manifest 消费 `animations.fps` / `loop` | partial | `asset-spec.ts:84-85`；`pack.ts:1050-1057`；`scene.ts:140,193` | pack 写 manifest → `resolvePackRef` 返回 → 外壳硬编码 `frameRate:8/10/6`、`repeat:-1` | `pack-frames.test.ts:66` 只断帧名；`assetpack.test.ts:268` 断言 fps 被返回；无运行时测试 | manifest 有 `fps:4/10/8` 与 `jump.loop:false`；播放未验证速率/循环 | manifest → runtime 断链 | 动画速率 / 一次性动画不正确 | 修正 + 补测 | P1 | 外壳读 manifest `fps`/`loop`；`jump.loop=false` 不循环；不同 fps 真的不同 |
| `CAP-SPEC-05` | `entities[].motion` 在运行时被消费，或契约限制它只能用于 hazard | partial | `game-config.ts:59-67,74-81`；`demo/world.ts:142`；`scene.ts:152-154`；`reachability.ts` 把实心体整段行程当可踩 | config motion → `world.ts` 带上 → 只有 hazard 在 `advanceHazards` 移动；solid/pickup/goal/decor 无消费者 | `shell-scene-wiring.test.ts:33-40` 只测 hazard | A1/A3 只有敌人 hazard 在巡逻 | 静默不生效；可达性却当真 | 关卡设计与可达性判断不一致 | 修正 / 限制 schema + 补测 | P1 | 运行时移动所有带 motion 的实体；或 schema 限制 motion 只能用于 hazard；有测试 |
| `CAP-SPEC-06` | VWS `lighting` 四格有具名读者，或从契约删除 | absent | `visual-world.ts:208-213`；全仓 grep 仅定义 | VWS → 无任何下游读取 | 无 | 无 | 死字段 | 规格写了但不影响产物 | 修正（接线或删除） | P1 | DNA / 规划提示词具名插值 + 测试；或删除并升版说明 |
| `CAP-SPEC-08` | VWS 六桶 / `constraints` / `shapeLanguage` 有生成后判据，或明确降为提示词建议 | partial | `game-design/prompts.ts:498-518`；`assets/prompt.ts:875,885`；`dna-prompts.test.ts:32-39`、`plan-assets.test.ts:137-149` 只断「在提示词里」 | VWS → DNA / 规划提示词 → 生图；无生成后检查 | 只有在场断言（E2 在场） | A2 无视觉比对 | 提示词建议被当成验收 | 风格约束无法证明被执行 | 补测（视觉 QA）+ 补文档 | P1 | 至少一条可重复的视觉对照，或明确「提示词建议，不验收」 |
| `CAP-SPEC-09` | `styleReferences` 多于 1 张时明确拒绝或全部消费 | partial | `visual-world.ts:267`（无上限）；`create-game.ts:269-270` 只约束 create；`ops.ts:280,404-408` 只取 `refs[0]` | VWS `styleReferences[]` → `planAssets` 只拷第一张为 `reference.png` | 无 | 归档均单张 | 静默丢参考图 | 多参考图输入行为不可预期 | 修正 + 补测 | P1 | `plan` / MCP 对 >1 明确拒绝（usage），或实现多图；有测试 |
| `CAP-SPEC-10` | Intent 的胜负 / 进阶 / 挑战进入设计，或明确声明不进入 | absent | `game-intent.ts:163-172`；`game-design/prompts.ts:295-344` 无插值；`intent-coverage.ts:110-131` 只读 entities/mechanics | Intent → `designPrompt` 只插值 6 个 ① 档字段；胜负/进阶/挑战零读取 | `prompts.test.ts:126-146` 只断言台账规矩 | A4 意图没有这两格；设计层自行造 progression | 用户胜负条件不交给设计 | 设计可能偏离用户目标 | 修正 / 补文档 | P1 | `designPrompt` 具名插值 + 测试，或契约写明「不进入设计」 |
| `CAP-SPEC-16` | DNA `palette` / `visualConstraints` 有生成后验证，或明确为提示词建议 | partial | `character-dna.ts:106-125`；`assets/prompt.ts:75-99`；`build-character-dna.ts:191-208` 只验下标 | DNA → `dnaBrief` → 母版 / 资产提示词；无像素检查 | `master.test.ts:48-53`（ref→hex）；无生成后测试 | A2 prompt 文件有 hex；无交付图色板对照 | 约束只到提示词 | 角色颜色 / 约束无法证明 | 补测（视觉 QA） | P1 | 像素级或人工对照证明 DNA 颜色进入交付图；否则明确「提示词建议，不验收」 |
| `CAP-SPEC-18` | ① 档字段的测试证明「字段 → 下游产物」，而不只是「字段在提示词里」 | partial | `design-prompts.test.ts:35-38`；`plan-assets.test.ts:114-131`；`compile-runtime.test.ts:298-313`；`dna-prompts.test.ts:32-39` | 字段 → 提示词 → 模型；测试只到提示词 | 大量在场断言（E2 在场） | A4 可看到部分呼应；无逐字段可证伪测试 | 在场 ≠ 生效 | 字段消费结论被高估 | 补测 | P1 | 每个 ① 档字段至少一条「字段 → 下游产物」可证伪测试，或登记「提示词在场」为唯一验收口径 |
| `CAP-QA-03` | 自动或半自动的参考图风格相似度判据 | absent | `qa.ts:113-121`；`qa/visual.ts:7-18`；`assets/review.ts:100-170`（付费、人工、非阻断） | 自动链无参考图输入；`review` 可喂联系表 + 原图，但不在创建链 | 无；`review` 只有假 fetch 测试 | E3 absent；实验 README「没量」 | 没有风格相似度判据 | 「风格匹配」无法自动验收 | 新增（P1） | P1 | 可重复的参考图 vs 交付图比较方法（模型或 CV），有阈值 / 误报边界；或明确人眼协议 |
| `CAP-QA-04` | `review` 的真实判定能力被量过，或明确只作诊断 | partial | `assets/review.ts:100-170`；`pipeline/review.ts:4-7` | CLI `review` → `reviewPack` → 视觉模型；无阈值 / 评分 / 阻断 | `assets/tests/review.test.ts:54-170`（假 fetch） | 从未真跑 | 付费视觉诊断能力未验证 | 不能把 `review` 当验收 | 补测 / 研究 | P1 | 一次有记录的 `review` 测量（付费需单独授权），或明确「仅诊断、不验收」 |
| `CAP-QA-06` | Intent / Design 覆盖能发现「同 id 更弱机制」等近似替代，或明确只做 id 集合 | partial | `intent-coverage.ts:110-131`；`build-design.ts:132-181` | `auditIntentCoverage` 按 type 落桶 + id 查机制；同 id 弱化通过 | `intent.test.ts:86-126`（缺实体/串桶/缺机制） | A4 机制逐条映射 | 近似替代无判据 | 设计可能名义覆盖、实际降级 | 补测 / 修正 | P1 | 负例：同 id 填更弱 mechanic ⇒ 被发现；或文档明确接受该限制 |
| `CAP-TEST-01` | 「参考图没有、需求要求的新实体」的 fixture + 判据 | absent | `fixtures/e2e/wasteland-platformer/README.md`（有意错配） | fixture → recipe / config；无断言 | **missing**（W5 类别 5） | fixture 存在，无断言 | 无测试 / 无判据 | 新实体是否被生成不可知 | 补测 | P1 | fixture + 测试断言新实体在 recipe/config，且 palette 绑定成立；负例缺实体 ⇒ 红 |
| `CAP-TEST-02` | CLI / MCP 同输入对照测试 | absent | `cli/cli.ts:241,584` 对 `mcp/server.ts:287,319`；`data` 形状差异 | 同一 fixture / 假上游 → CLI `create --yes` vs MCP `create_game` | **missing**（W5 类别 10） | 两套测试各写各的断言 | 无对照 | 入口漂移不可见 | 补测 | P1 | 同输入下产物路径 / 字节 / 机器可读字段 / 失败退出码对照；TD 分派有测试 |
| `CAP-TEST-03` | 「pack 成功 → site 构建失败」的 CLI/MCP 全链用例 | absent | `demo/tests/site.test.ts` 只有组件级 | 成功 pack → `assembleFromConfig` 抛 invalid → 退出 4 / MCP isError | **missing**（W5 类别 7） | 无 | 无全链 | 装配失败路径未被端到端证明 | 补测 | P1 | 全链用例：pack 成功、site 失败、退出码 / 目录 / pack 可 verify |
| `CAP-TEST-04` | 真实 image / import 交付包 fixture | absent | `fixtures/packs/*` 都是 drawlist 包 | 包 fixture → QA / site / inspect | **missing**（W5 类别 6） | 无 image/import 交付包 fixture | 真产物路径没在 image 源包上跑过 | QA/site 的 image 路径不可回归 | 补测 | P1 | committed image/import 包 fixture；QA/site/inspect 在其上跑 |
| `CAP-TEST-05` | 失败现场 / 版本不消耗的剩余用例 | partial | `demo/layout.ts`；`pipeline/create-game.ts:477-495` | site 硬失败 → 下次成功版本；config staging 清理；QA 失败后 pack 版本 | 有 run/pack 强测试；site/config/QA 跨 attempt 缺失 | 无 | 失败路径的版本语义未完全钉住 | 回归风险 | 补测 | P1 | site 失败后下一次仍 `site/v1`；`.config-*` 不残留；QA 失败后 pack 版本有断言 |
| `CAP-TEST-06` | CLI `site` / `compile-*` / `review` 与 MCP `plan` / `compile` / `assemble` 的命令级成功路径 | partial | `cli/tests` 只调 `create/build/pack/plan/verify/inspect`；`mcp/tests` 只覆盖 inspect/verify/build 失败 | 命令 → core → 产物 | 部分 missing | 无 | 命令级覆盖不全 | 入口回归缺口 | 补测 | P1 | 每个命令至少一条成功路径 + 一条失败路径；MCP 三个工具同样 |
| `CAP-E2E-02` | 归档一份真实 QA 失败 run（E3） | absent | W4 证据缺口 | QA error → 报告落盘 → 退 4 / 不产站点 | 阻断只有 E2 | 无归档失败 run | QA 阻断缺 E3 | 无法用真实产物验证阻断 | 补测 / 补证据 | P1 | 一份零付费可复现的 QA 失败 run：报告、退出码、站点不产 |
| `CAP-E2E-03` | inspect 接线后的真实 `qa-report.json` | absent | 三份归档报告均为接线前产物（observation `unavailable`） | `runBuild` → inspect → `QaContext` → 报告 | `create-game.test.ts:769-800` 只有 E2 | 无接线后真实报告 | 缺接线后 E3 | 观察链路只有测试证据 | 补测 / 补证据 | P1 | 一次零付费真实 run 的 `qa-report.json` 含 inspect 观察 |

## 4. P2 能力差距（21 条）

> P2 = 优化项，不影响当前最小端到端验收。多数是死字段、文档漂移、诊断性改进或已解释的兼容边界。

| ID | 能力 / 需求 | 状态 | 源码证据 | 调用链 | 测试证据 | 真实产物证据 | 缺口 | 影响 | 分流 | 优先级 | 验收条件 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `CAP-ENTRY-03` | MCP 工具面与 CLI 等价（TD / review / 并发参数） | partial | `mcp/server.ts:72-175`（七工具）；`cli/cli.ts:560,603,133-158` | MCP 无 `compile_td_game` / `review` / `concurrency` | `server.test.ts:61-75` 逐名钉住七工具 | 无 | 能力面较窄 | 部分 CLI 能力无法从 MCP 走 | 暂缓（Q9） | P2 | 按产品需要新增工具；不默认全等价 |
| `CAP-ENTRY-04` | `HUD_LINE_HEIGHT` 单一来源 | partial | `cli/cli.ts:237,556,571`；`mcp/server.ts:258,268`；`contracts/screen-space.ts:24`；`demo/draw.ts:43` | CLI 传 `HUD_LINE_HEIGHT`；MCP 不传，靠 `DEFAULT_HUD_LINE_HEIGHT` | 今天同值 10，不可观察 | A3 HUD 正常 | 两个事实源 | 改一处漏一处 | 修正 / 补文档 | P2 | 统一常量来源；MCP 传同一值；有测试 |
| `CAP-ENTRY-05` | `site` 默认外壳路径使用注入 `cwd` | partial | `cli/cli.ts:583` 对 `:243,459` | `site` → `defaultShellPath(process.cwd())`；`create/build` → 注入 cwd | 无 | 无 | 两套解析基准 | 注入 cwd 时行为不一致 | 修正 + 补测 | P2 | `site` 与 `create/build` 用同一 cwd 解析；有测试 |
| `CAP-ENTRY-06` | `laySite` 中途 I/O 失败可回滚或明确失败现场 | partial | `demo/layout.ts`（`mkdirSync` 后 `copyFileSync`，无回滚） | `assembleSite` → `laySite` → 写半成品；无故障注入 | 无 | 无 | 可能留下半个 `site/v<N>` | 失败现场不干净 | 补测 / 修正 | P2 | 故障注入测试：中途失败不留下可用版本目录，或留下可识别现场 |
| `CAP-ENTRY-07` | `RUN_ARTIFACT` 注释与实际键数一致 | implemented | `pipeline/artifacts.ts:1,14-26`（10 键，含 `recipePlan`）；`create-game.ts:8` / `contracts/qa.ts:429` 仍写「九项」 | 常量 → 落盘 | 无 | 归档可见 `recipePlan` | 文档漂移 | 读者误判产物 | 补文档 | P2 | 注释改为 10 项；三处口径一致 |
| `CAP-SPEC-07` | VWS `styleIdentity.styleName` / `composition.characterScale` / `camera.projection/angle/elevation/perspective` 有读者或删除 | absent | `visual-world.ts:170,178-181,189`；`game-design/prompts.ts:347-355` 白名单不含；`assets/prompt.ts:867-885` 不含 | 全仓零读取（仅定义） | 无 | 无 | 死字段 | 规格冗余、误导 | 修正 / 暂缓 | P2 | 有具名读者 + 测试，或删除/标为兼容字段 |
| `CAP-SPEC-11` | Design `progression` / `difficulty` 有读者或明确为说明 | absent | `game-design.ts:190-191,222-225`；`assets/prompt.ts:846-865` 不含；config 提示词不含 | 设计层文本 → 无下游 | 无 | A4 有完整文本；运行时不读 | 死字段 | 设计与运行时不符 | 补文档 / 暂缓（Q5） | P2 | 文档写明「人读的设计说明」；或接入 config/QA |
| `CAP-SPEC-13` | `AssetSpec.styleId` 有校验或删除 | absent | `asset-spec.ts:19`；`recipe.ts:153-157` 自白；manifest 不收 | 模型写 `styleId` → 无人读 | `recipe-tool.test.ts` 只做形状对等 | A1 每件都写 `"style"`，从未核对 | 死字段 | 规格冗余 | 补文档 / 删除 | P2 | 标为遗留；或加「与 styleRef 一致」校验；或删除 |
| `CAP-SPEC-14` | `AssetSpec.required` / `AssetPackEntry.required` 有语义 | absent | `asset-spec.ts:28`；`assetpack.ts:170`；`pack.ts:1209` | 只抄进 manifest，无读者 | `recipe-tool.test.ts:55-85` 只形状对等 | A1 `required:false` 仍照常生成/交付 | 死字段 | 声明与实际不符 | 修正 / 补文档 | P2 | 定义 `required:false`（可缺、QA 跳过）或删除；有行为测试 |
| `CAP-SPEC-15` | 母版 `AuthoringAsset.source` 的 image 参数被消费或禁止 | partial | `recipe.ts:164-174`；`pack.ts:430-460` 母版支只读 `kind` / `import.ref` / `size` | 母版 source → pack 忽略 `reference` / `background` / `alphaThreshold` / `minLargestShare` | `pack-master.test.ts:129` 写入但无断言 | A2 | 参数被接受但无效 | 配方误导 | 修正 / 补文档 | P2 | 母版支消费参数并测试，或 schema/文档禁止写 |
| `CAP-SPEC-19` | plan sidecar 的用途被写明（审计记录，非执行输入） | implemented | `assets/ops.ts:421-441`；`pipeline/artifacts.ts:104-105`；全仓无 reader | 规划 → sidecar → 仅测试读 | `plan-sidecar.test.ts:49-86` | A5 sidecar 落盘 | 无机器消费者（按设计） | 读者可能误以为它驱动 pack | 补文档 | P2 | 文档写明 `record`；若要驱动重放/修复另立票 |
| `CAP-SPEC-21` | `GameConfig.objective.kind` 的单值枚举被写明为留位 | implemented | `game-config.ts:185`；`scene.ts:269-274` | 外壳直接实现 `collect-then-reach` | `game-config.test.ts` 只验 schema | A3 | 无分支 | 新增值时可能漏改外壳 | 补文档 | P2 | 文档写明「单值枚举是留位」；新增值必须同时改外壳与 schema |
| `CAP-ASSET-02` | `import` 路线可从 CLI / MCP / create 到达 | absent | `cli/cli.ts:516`、`mcp/server.ts:233`、`pipeline/create-game.ts:328` 都不传 `existingAssets` | `planAssets` → `resolveRoute` 支持 import，但三入口不提供 `existingAssets` | `plan-sidecar.test.ts:94-107` 只测 core | v7 包有 7 个 import 资产（手改 recipe） | 端到端不可达 | 已有外部资源只能用 API / 手写 recipe | 暂缓（v3 Q4b；Q6） | P2 | 维持暂缓；若产品需要，另立票打通三入口 |
| `CAP-ASSET-03` | 资源路线按六类语义区分（敌人/NPC/大型/高频小道具/UI/外部） | partial | `route.ts:80-118`（四条硬信号 + 候选平局）；`prompt.ts:807-810` | spec → `resolveRoute` → 硬信号或候选；敌人/NPC 无独立信号 | `route-resolver.test.ts:29-121` | 归档显示跨类目分流，但 `office-debris` / `tile-floor` 靠候选 | 规则粗于六类 | 「为什么这类资源走这条路线」仍靠模型 | 暂缓 / 补文档（Q6） | P2 | 写清规则矩阵与缺失即失败；语义路由另立票 |
| `CAP-ASSET-04` | 非九宫格 UI 有硬信号或被明确接受候选平局 | partial | `route.ts:106-111`；`route-resolver.test.ts:54-59` | `kind:ui` 无 `ninePatch` ⇒ 候选决定，可能 `image` | 有候选平局测试 | A3 HUD 图标走 drawlist | 无硬规则 | UI 小图标可能走 image | 补测 / 暂缓 | P2 | 记录现状；若要硬规则另立票 |
| `CAP-ASSET-05` | import 缺文件在 pack 层有可诊断错误 | partial | `pack.ts:1025`（裸 `ENOENT`） | 手写 recipe / 绕过规划 → pack → 读 import 文件 → ENOENT | 规划期有拦截测试；pack 期无 | 探针复现 | 错误未包装 | 诊断性一般 | 修正 | P2 | 抛带资源 id / ref 的错误；有测试 |
| `CAP-QA-05` | 除像素完整性外的 inspect 观察有明确处置策略 | partial | `qa/assemble.ts:97-100`；`inspectPack` 文案「观察，不是判据」 | inspect → observations；不改裁决 | `assemble.test.ts:119-150` 观察不改变裁决 | 真包 +52.4% exit 0 | 观察与判据边界需写明 | 读者可能把观察当验收 | 补文档 | P2 | 文档列明哪些观察已阈值化（P0）、哪些永远只作诊断 |
| `CAP-QA-10` | `warning` 有真实生产者，或明确保留为未用 | partial | `qa.ts:160-162,374-379`；`audit.ts:24-33` 的 `checkSize` 无生产调用者 | 三族只产 error；warning 无生产者 | `contracts/qa.test.ts:198-200` 合成 warning | 无 | 类型允许但无生产者 | 读者误判 warning 语义 | 补测 / 补文档 | P2 | 定义一个 warning 生产者 + 测试，或文档写明「当前未使用」 |
| `CAP-QA-11` | QA 族读不到 / 不过契约时的退出码与「产物不合法 = 4」一致 | partial | `qa/visual.ts:86-88`、`qa/gameplay.ts:73-75`、`qa/intent.ts:83-86` 抛裸 Error；`cli/cli.ts:207-221` 只翻译形状；`command.ts:88` → 1 | 族抛裸 Error → `runBuild` 不捕获 → CLI 1 / MCP 1 | 无退出码测试 | 无 | 错误码不一致 | 调用方误判为内部错误 | 修正 + 补测 | P2 | 族错误包装为 `CommandError("invalid")` 或统一映射；测试退 4 |
| `CAP-TEST-07` | 测试对象不随本机 `out/` 状态变化 | partial | `cli/tests/cli.test.ts` / `mcp/tests/server.test.ts` 优先选 `out/shift-change-assets/pack/vN`；`describe.skipIf(!hasPack)` | 测试 → 本机包或 fixture 回落 | 当前 `hasPack` 为真 | 无 | 可复现性风险 | 干净检出可能跳过整组 | 修正 | P2 | 测试只依赖 committed fixture，或显式标记环境依赖并失败而非跳过 |
| `CAP-TEST-08` | MCP 缺必填参数的行为有测试 | absent | `mcp/server.ts:219-328` 直接 `String(args.x)` | 缺参数 → `"undefined"` → core 报 usage 或路径错误 | **no test found**（W5 类别 2 / 10） | 无 | 无测试 | 请求错误可能变成难懂的错误 | 补测 | P2 | 缺每个必填参数的请求 ⇒ usage / 明确错误；有测试 |

## 5. 字段消费总览（W2 结论）

### 5.0 字段映射摘要（producer → verifier → consumer）

| 规格 | 生产者 | 验证者 | 主要消费者 | 判定 |
|---|---|---|---|---|
| `VisualWorldSpec` | `analyzeReference` | `VisualWorldSpecSchema` + 越界 gate | `designPrompt` / `characterClassBrief` / `worldBrief`；`style.palette` / `styleReferences` 进 pack | partial：少数代码判据，多数 prompt-only，若干死字段 |
| `GameIntentSpec` | `analyzeIntent` | schema + 非空 gate + id 唯一 | `designPrompt`（6 个 ① 档字段 + mechanics/entities/ambiguity）；`auditIntentCoverage` 按 id | partial：胜负 / 进阶 / 挑战零读取 |
| `GameDesignSpec` | `compileDesign` | schema + R12（相机 / 机制 / 覆盖） | `designBrief` → 规划 / config 提示词；`auditIntentCoverage` | partial：胜负 / 进阶 / 难度无运行时落点 |
| `CharacterDNA` | `compileCharacterDna` | schema + 集合相等 + 逐字守门人 + palette 越界 | `dnaBrief` → 母版 / 资产提示词；`pack` 按 id 查 | partial：全部到提示词，无生成后像素判据 |
| `AssetRecipe` / `AssetSpec` | `planAssets`（模型候选 + resolver 定稿） | `parseRecipe` + 玩家动画闸 + `resolveRoute` + pack 审计 | `packAssets` 按 `source.kind` 分派；manifest；config 引用 | implemented / partial：路线与执行成立；`styleId` / `required` 死字段；`frames` 折叠 |
| `GameConfig` | `compileRuntime` | `auditGameConfig` / `auditScreenSpace` / `auditLayerCoverage` / `auditReachability` | `demo/world.ts` / `shell/scene.ts` | partial：多数运行字段成立；`objective.gate`、fps/loop、motion、多关有断点 |

### 5.1 三层消费

| 层 | 含义 | 代表字段 | 判定 |
|---|---|---|---|
| **代码判据**（少） | 有机器读取，且改变实际行为 | `camera.mode`（构建前拒绝）、`style.palette`（抠底 / 量化）、`styleReferences`（参考图内联）、`characterId` / `masterAsset`（路线 + DNA 查找）、`runtimeProfile`（外壳 / 配置形状）、`levels[0].id`、`GameConfig` 的 world / player / terrain / entities / hud / pickupCount | `consumed` |
| **提示词燃料**（多） | 只插值进模型提示词；行为由模型决定，无自动判据 | VWS `styleIdentity.keywords/description`、`composition`（除 characterScale）、`materials`、`character`、`environment`、`shapeLanguage`、`constraints`；Intent 大部分字段；Design 大部分字段；DNA 八字段 | `prompt-only` |
| **只写不读 / 死字段**（若干） | 全仓零读取，或只有 schema / 生成前审计 | VWS `styleIdentity.styleName`、`composition.characterScale`、`lighting.*`、`camera.projection/angle/elevation/perspective`；Intent `winConditions/loseConditions/progression/challenge`；Design `progression/difficulty/winConditions/loseConditions`；`AssetSpec.styleId/required`；`AuthoringAsset.source` 的 image 参数；`GameConfig.objective.kind`（单值留位） | `dead` / `validated-only` |

### 5.2 最重要的运行时断点

| 断点 | 事实 | 能力差距 |
|---|---|---|
| 胜负 | `objective.gate` 只校验不消费；每个 goal 都 `tryWin()`，只看 pickupCount | `CAP-SPEC-01` |
| 失败态 | Design 写「接触敌人即失败」；外壳 `hitHazard()` 只退回起点，无 HP / 失败态 | `CAP-SPEC-02` |
| 动画节奏 | `fps/loop` 写进 manifest，外壳硬编码 `8/10/6` 与 `repeat:-1` | `CAP-SPEC-04` |
| 运动 | `entities[].motion` 只有 hazard 被移动；solid 的 motion 被可达性当真 | `CAP-SPEC-05` |
| 多关 | 只编译 `levels[0]`，create 不传 `levelId` | `CAP-SPEC-03` |

### 5.3 字段测试口径

基线运行 18 个测试文件 / 343 个测试通过（exit 0），但其中大量只断言「字段出现在提示词里」或「形状合法」，
已逐条标成 `E2（在场）`，**不**冒充 E3。详见 [W2 §5](../../.scratch/p0-00-audit/research/w2-field-consumption.md)。

### 5.4 QA 8 维能力矩阵

| 维度 | 自动入口 / 实现 | 实际读什么 | 判定性质 | 链上能响吗 | 阻断 | 状态 | 证据 |
|---|---|---|---|---|---|---|---|
| Contract / Schema | 各族入口的 `parseRecipe` / `parseAssetPack` / `parseGameConfig` / `safeParse(GameIntent/GameDesign)`；报告本身在 `runBuild` 再过 `QAReportSchema` | 已落盘 JSON 产物 | 结构 + 文档内跨字段业务约束；不产 finding，失败即抛 | 输入坏就抛（但链上产物已被上游 parse 过） | 抛 = 硬失败；CLI 对 `CommandError("invalid")` 退 4，对族裸 `Error` 退 1 | implemented（但无 QA 报告行） | `qa/visual.ts:85-88`；`qa/gameplay.ts:72-75`；`qa/intent.ts:81-86`；`create-game.ts:533-538`；`command.ts:46,88` |
| Intent QA | `intentQaRunner` → `auditIntentCoverage` | `game-intent.json` + `game-design.json` | id 级集合差；实体按 `type` 落桶，机制按 id | **链上恒绿**（`compile-design` 先拒） | `error`；理论阻断 | partial（id 半；文本半故意 absent） | `qa/intent.ts:77-98`；`intent-coverage.ts:110-131`；`build-design.ts:97` |
| Design QA | **没有 QA 族**；最接近的是 `compile-design` 的 R12 拒绝 | intent + VWS + design + RuntimeProfile | schema 门 + 相机支持 + 机制/能力差集 + 意图 id 覆盖 | 在生图前硬拒 | `DesignRejectedError` → 退 4 | partial（只在生成前；不产 QA 报告） | `build-design.ts:132-181`；`compile-design.ts:288-300`；`create-game.ts:305-315` |
| Asset QA | `constructiveConstraint`（visual 族）+ `auditAssetSpec` | recipe spec + manifest 元数据 + drawlist JSON | spec ↔ 产物元数据对账 | 能响（`pack` 只返回 audit、不失败） | `error` | partial（无文件 / checksum / 真实帧尺寸） | `qa/visual.ts:110-137`；`audit.ts:45-83`；`pack.ts:1290-1300` |
| Visual QA | `visualQaRunner`（两条判据）+ 免费 `inspectPack` 观察 + 手动 `reviewPack` | 自动：JSON 元数据；inspect：真实 PNG（只观察）；review：联系表 + 原图（付费、手动） | 自动链**不做风格比较** | 只有元数据类错误能响 | 元数据 `error` 阻断；观察 / review 不阻断 | **partial → absent（风格相似度）** | `qa/visual.ts:84-174`；`ops.ts:1900-1945`；`review.ts:100-170` |
| Gameplay QA | `gameplayQaRunner` → `auditReferences` + `auditReachability` | `game-config.json` + manifest | 引用族 + **静态**可达性（上界） | `reachability` 能响（QA 独有）；`reference-resolution` 链上恒绿 | `error` | partial（无真实启动 / 输入 / 胜负） | `qa/gameplay.ts:71-106`；`reachability.ts:44-225`；`ops.ts:1046-1052` |
| Integration QA | 无独立族；QA 的 `reference-resolution` + 上游 `compile-runtime` / `assembleSite` 的引用/几何/HUD 审计 | config ↔ manifest；包 → 站点拷贝 | 静态引用与几何；**不验证 Demo 真的加载 / 渲染** | 上游先拒；QA 的引用族链上恒绿 | 上游 error → 退 4 | partial | `game-config.ts:271-387`；`site.ts:191-213`；`demo/world.ts:60-100` |
| Publish Gate | `assertQaPassed`（创建 / 构建）；`site` / `assemble_site` **不读 QA** | `qa-report.json.failures`（仅 `severity:"error"`） | 只挡 `create/build` 的站点产出 | 是 | error → CLI 4 / MCP `isError`；其余不阻断 | **partial（可绕过）** | `create-game.ts:215-226,543-544`；`cli.ts:575-591`；`server.ts:318-326` |

### 5.5 QA 阻断规则（基线 `ea53240`）

| 条件 | 生成位置 | 影响 `qaVerdict` | 阻断 `create/build`？ | 退出码 / 表现 | 证据 |
|---|---|---|---|---|---|
| QA finding `severity:"error"` | 三族 | `fail` | **是** | CLI 4；MCP `isError=true, _exitCode=4`；报告已落盘；站点不产 | `create-game.ts:215-226,543-544`；E2 `cli-create.test.ts:409-420` |
| QA finding `severity:"warning"` | 今天无生产者 | 否 | **否** | 正常运行 | `qa.ts:160-162,374-379`；E2 `contracts/qa.test.ts:198-200` |
| `checked < 6` | 恒真（5/6） | `incomplete` | **否**（闸门不看 verdict） | 正常运行；CLI 打「5/6 · 没跑的：层覆盖」 | `assemble.ts:89`；`create-game.ts:206-213`；E2 `create-game.test.ts:575-587` |
| `observation`（inspect / review）任意内容 | `assemble.ts:97-100` | 否 | **否** | 完全不影响 | E2 `assemble.test.ts:119-150`；E3 真包 +52.4% 仍退 0 |
| 族读不到 / 不过契约 | 三族入口 | 不产报告 | 是（硬失败） | 裸 `Error` → CLI **1**（不是 4）；无报告 | `visual.ts:86-88`；`command.ts:88`；E1 |
| 装配出的报告不过 `qa-report/v1` | `runBuild` | 不适用 | 是 | `CommandError("invalid")` → 4 | `create-game.ts:533-538` |
| `qa: null` | 调用方 API | 不适用 | **否（QA 整个不跑）** | 无 `qa-report.json`；无 `qa` 字段 | E2 `create-game.test.ts:590-597` |
| `site` / `assemble_site` | 壳层 | 不适用 | **不读 QA** | 只跑上游审计；可绕过 reachability | E1 `cli.ts:575-591`；`server.ts:318-326` |
| `review` 失败 | 手动命令 | 不适用 | **否** | 自己的 3/4 退出码；包与站点不受影响 | `review.ts:71-74,118-124` |

### 5.6 QA 族逐族摘要（finding / CLI-MCP / 测试 / 未覆盖）

| QA 族 | finding 生成条件 | CLI / MCP | 正例 | 负例 | 未覆盖 |
|---|---|---|---|---|---|
| Intent | 实体按 `type` 落桶后找不到 / 机制 id 找不到 / 串桶 | 同 runner、同结果 | `qa/tests/intent.test.ts:64-85` | `:86-126` | 同 id 更弱机制；设计多出的项；ambiguity |
| Design（R12，非 QA 族） | 意图缺机制 / 缺实体 / 串桶；相机不支持；profile 缺机制 | 同 `compileDesign` | `build-design.test.ts` 多个 ok 用例 | `build-design.test.ts:94-178`；`compile-design.test.ts:99-136` | 设计语义质量；文本覆盖（故意不查）；多关 |
| Asset | recipe id 在包里没有；kind / 标称尺寸 / 动画名 / 帧数 / viewBox 不符 | 同 runner、同结果 | `qa/tests/visual.test.ts:55-68`（真包零 finding） | `:71-167`；`asset-spec.test.ts:255-321` | 文件缺失 / checksum / atlas 帧一致性 / 额外资源 / 真实像素尺寸 |
| Visual | 构造性约束 + 色板声明计数 | 同 runner；CLI 多打 inspect 摘要（有意） | 同上 | 同上（全是元数据） | **没有任何「视觉不像参考图」的自动判据**；review 只有假 fetch 测试 |
| Gameplay | `auditReferences` 引用族；`auditReachability` 终点 / 拾取物不可达 | 同 runner、同结果 | `qa/tests/gameplay.test.ts:53-63` | `:65-146`；`reachability.test.ts:54-116` | 真实启动、输入、胜负、危险物、难度 |
| Integration | config ↔ manifest 引用 / 种类 / 动画 / HUD / 背景层；站点装配审计 | CLI `assembleFromConfig` 分派；MCP 直接 `assembleSite` | `demo/tests/site.test.ts:29-77` | `:79-139,178-317` | QA 与站点联合验收；真实渲染；`site` 绕过 QA |
| Publish | QA `error` → `assertQaPassed` | CLI 退 4；MCP `isError` + 4 | `cli-create.test.ts:358-408` | `:409-420`；`create-game.test.ts:649-660` | MCP 失败路径；`site` 绕过；真实 QA 失败归档 |

## 6. v3 基线复核（Q3：只验证，不重开）

| 基线 | 复核结果 | 证据 |
|---|---|---|
| `deriveRecipe` 仍存在 / 默认 `drawlist` | **不成立**：源码无 `deriveRecipe` 函数或导出；只剩历史注释 | `grep` 仅 `assets/prompt.ts:563` 注释；W3 §7 |
| `planAssets` 是唯一规划入口 | **成立** | `ops.ts:249-451`；`plan-assets.test.ts` 16 tests |
| `resolveRoute` 是 `source.kind` 唯一最终写入者 | **成立** | `route.ts:80-118,143-155`；`ops.ts:367-399`；`route-resolver.test.ts` 17 tests |
| route 仍是 `image/drawlist/import` 三值 | **成立**（route / sidecar）；执行层多一个 `frames`，规划时折叠成 `image` | `asset-plan.ts:13`；`recipe.ts:143`；`ops.ts:372`；W3 F1 |
| plan sidecar 独立、只在规划成功后写 | **成立** | `ops.ts:421-441`；`plan-sidecar.test.ts:49-86` |
| `resolveRoute` 的 `context` 读 design / VWS | **不成立（但属 v3 基线）**：`RouteContext` 明确写「当前规则不读它」 | `route.ts:20-21`；只登记，不重开 |
| `planAssets` 的 `source.kind` 是候选 | **成立**：模型给候选，最终由 resolver 改写 | `ops.ts:367-399`；`plan-assets.test.ts:181-208` |

## 7. 不构成缺口的已解释边界

以下项在调研中被提到，但**不是 HEAD 的缺陷**，不应在后续 P0 中重开：

| 项 | 为什么不是缺口 | 证据 |
|---|---|---|
| `deriveRecipe` 不存在 / 无默认 `drawlist` | v3 已把规划并入 `planAssets`；无合法路线时硬失败 `no-route` | W3 §7；`route.ts:117` |
| `pack` 不读 plan sidecar | v3 Q5 裁定 sidecar 是记录，不是执行输入 | W3 F5；`ops.ts:417-441` |
| `import` 三入口不可达 | v3 Q4(b) 明确留后续；本审计只登记为暂缓 | W3 F2；Q6 裁定「import 维持暂缓」 |
| `StyleSpec` 六个旧字段零读取 | R6 已解释的兼容例外（`camera` 故意不读） | `visual-world.ts:29-33`；`prompt.ts:217` |
| plan sidecar 无机器消费者 | 按设计是审计记录 | W2-G19 |
| 控制映射硬编码 | 外壳常量，不是契约字段缺口 | W2 §2.6 |
| `objective.kind` 单值 | 留位；新增值须同时改外壳与 schema | W2-G21 |
| MCP 不打印 inspect 摘要 | W4 记录为**有意为之**，并有反证测试 | `create-game-no-digest.test.ts:127-129` |
| 塔防不进 RuntimeProfile / create 链 | v3 既定边界；塔防是并列旁路 | `runtime-profile.ts:120-123`；W1 §5 |
| 三份归档 `qa-report` 的 `inspect/review = unavailable` | 归档早于接线；不能据归档否定 HEAD | W4 §2.5；W1 §7 |

## 8. 覆盖对账：W1–W6 → CAP ID

> 用于证明没有遗漏任何调研缺口，也防止同一缺口被重复计数。

| 来源 | 来源编号 | CAP ID | 备注 |
|---|---|---|---|
| W1 | W1-1 | `CAP-ENTRY-01` | MCP 错误翻译 |
| W1 | W1-2 | `CAP-ENTRY-02` | `stylePath` |
| W1 | W1-3 | `CAP-ENTRY-03` | 工具面 |
| W1 | W1-4 | `CAP-ENTRY-04` | HUD 常量 |
| W1 | W1-5 | — | 归档缺 plan sidecar，属 E3 漂移，不是 HEAD 缺口 |
| W1 | W1-6 | `CAP-ENTRY-07` | 文档「九项」 |
| W1 | W1-7 | `CAP-ENTRY-05` | `site` cwd |
| W1 | W1-8 | `CAP-ENTRY-06` | `laySite` 回滚 |
| W2 | G01 | `CAP-SPEC-01` | `objective.gate` |
| W2 | G02 | `CAP-SPEC-02` | 设计胜负 |
| W2 | G03 | `CAP-SPEC-03` | 多关 |
| W2 | G04 | `CAP-SPEC-04` | fps/loop |
| W2 | G05 | `CAP-SPEC-05` | motion |
| W2 | G06 | `CAP-SPEC-06` | lighting |
| W2 | G07 | `CAP-SPEC-07` | VWS 其他死字段 |
| W2 | G08 | `CAP-SPEC-08` | VWS 提示词字段 |
| W2 | G09 | `CAP-SPEC-09` | 多参考图 |
| W2 | G10 | `CAP-SPEC-10` | Intent 叙事字段 |
| W2 | G11 | `CAP-SPEC-11` | Design progression |
| W2 | G12 | `CAP-SPEC-12` | 设计→清单覆盖 |
| W2 | G13 | `CAP-SPEC-13` | styleId |
| W2 | G14 | `CAP-SPEC-14` | required |
| W2 | G15 | `CAP-SPEC-15` | 母版 image 参数 |
| W2 | G16 | `CAP-SPEC-16` | DNA 提示词字段 |
| W2 | G17 | `CAP-SPEC-17` | 空色板 |
| W2 | G18 | `CAP-SPEC-18` | 在场测试 |
| W2 | G19 | `CAP-SPEC-19` | sidecar 用途 |
| W2 | G20 | — | 已解释的兼容例外（§7） |
| W2 | G21 | `CAP-SPEC-21` | objective.kind |
| W3 | F1 | `CAP-ASSET-01` | frames 折叠 |
| W3 | F2 | `CAP-ASSET-02` | import 不可达（暂缓） |
| W3 | F3 | `CAP-ASSET-03` | 六类规则 |
| W3 | F4 | `CAP-ASSET-04` | 非九宫格 UI |
| W3 | F5 | — | sidecar 不被 pack 读（v3 设计，§7） |
| W3 | F6 | `CAP-ASSET-05` | 裸 ENOENT |
| W4 | 1 | `CAP-QA-01` | 5/6 |
| W4 | 2 | `CAP-QA-02` / `CAP-QA-03` | 像素完整性 / 风格相似度 |
| W4 | 3 | `CAP-QA-04` | review 未量 |
| W4 | 4 | `CAP-QA-02` / `CAP-QA-05` | 观察不阻断 |
| W4 | 5 | `CAP-QA-06` | id 级覆盖 |
| W4 | 6 | `CAP-ASSET-06` | verifyPack 入链 |
| W4 | 7 | `CAP-QA-07` | 无启动 / 输入 |
| W4 | 8 | `CAP-QA-08` | 闸门绕过 |
| W4 | 9 | `CAP-ENTRY-03` / `CAP-TEST-08` | 工具面 / MCP 参数；摘要差异为有意 |
| W4 | 10 | `CAP-QA-01` / `CAP-QA-10` | incomplete / warning |
| W4 | 11 | `CAP-QA-11` | 裸 Error 退 1 |
| W5 | 类别 1 | `CAP-TEST-06` | 命令级成功路径 |
| W5 | 类别 2 | `CAP-TEST-08` | MCP 参数 |
| W5 | 类别 3 | `CAP-ASSET-01` | frames |
| W5 | 类别 4 | — | 已有，非缺口（语义错误只有机械部分） |
| W5 | 类别 5 | `CAP-TEST-01` | 新实体 |
| W5 | 类别 6 | `CAP-TEST-04` / `CAP-ASSET-06` | 真实包 fixture / checksum 入链 |
| W5 | 类别 7 | `CAP-TEST-03` | 全链 site 失败 |
| W5 | 类别 8 | `CAP-QA-07` | 启动 + 输入 |
| W5 | 类别 9 | `CAP-QA-08` / `CAP-TEST-05` | 闸门 / 失败路径 |
| W5 | 类别 10 | `CAP-TEST-02` / `CAP-ENTRY-01/02` | 对照 / 入口 |
| W5 | 类别 11 | `CAP-TEST-05` / `CAP-ENTRY-06` | 版本 / 回滚 |
| W5 | §15 可复现性 | `CAP-TEST-07` | 本机 `out/` 依赖 |
| W6 | G1 | `CAP-RUNTIME-01` | 危险物软锁 |
| W6 | G2 | `CAP-QA-07` | QA 绿但不可玩 |
| W6 | G3 | `CAP-QA-08` | site 绕过 |
| W6 | G4 | `CAP-QA-05` / `CAP-QA-02` | 观察不阻断 |
| W6 | G5 | `CAP-E2E-01` | 无 HEAD 单跑 |
| W6 | G6 | `CAP-QA-07` | 状态感知输入 |

## 9. 未验证 / unknown 清单

以下结论**只有 E1/E2，没有 E3**；不得写成已验收：

1. **视觉风格相似度**：自动链没有判据；`review` 从未真跑；E3 不存在。08 的人眼裁定只覆盖一次归档站点。
2. **真实玩法可重复性**：只有一次人工 CDP 成功 + 一次失败复现；没有第二次独立运行，也没有自动回归。
3. **inspect 接线后的真实 `qa-report.json`**：三份归档报告都是接线前产物；接线后只有 E2。
4. **MCP 的 QA 失败路径**：源码可读（E1），无测试、无真实产物。
5. **付费模型行为**：本审计零付费；归档产物的模型版本 / 提示词与 HEAD 可能漂移。
6. **归档的上游 E3**：2026-10-17 的真跑没有记录 sha，且早于 `bf3e11f` / `a3ac8d8` / `ea53240` / `7aa98d7`。
7. **`7aa98d7` 之后的增量**：只核实了 typecheck / 测试 / `accept` 工具面；没有逐行重审全部源码。
8. **`frames` 折叠的运行时后果**：W3 用假 fetch 探针确认规划期折叠；没有真实付费跑验证逐帧生成路径。
9. **`site` 绕过的真实案例**：有源码 + 一个「终点够不到」的 config 过上游校验的测试；
   没有一份归档的「QA 失败后又用 site 装配」的完整现场（`CAP-E2E-02`）。
10. **多参考图 / 空色板**：有源码与契约测试，没有真实多图 / 空色板产物。

## 10. 证据索引

| 类别 | 路径 |
|---|---|
| W1 调用链 | [research/w1-call-graph.md](../../.scratch/p0-00-audit/research/w1-call-graph.md) |
| W2 字段消费 | [research/w2-field-consumption.md](../../.scratch/p0-00-audit/research/w2-field-consumption.md) |
| W3 资源路线 | [research/w3-asset-routes.md](../../.scratch/p0-00-audit/research/w3-asset-routes.md) |
| W4 QA 能力 | [research/w4-qa-capability.md](../../.scratch/p0-00-audit/research/w4-qa-capability.md) |
| W5 测试矩阵 | [research/w5-test-matrix.md](../../.scratch/p0-00-audit/research/w5-test-matrix.md) |
| W6 E2E | [research/w6-e2e-evidence.md](../../.scratch/p0-00-audit/research/w6-e2e-evidence.md) |
| HEAD 重放 | [runs/2026-10-20a-head-replay/](../../.scratch/p0-00-audit/runs/2026-10-20a-head-replay/) |
| 最终包 v7 | [pack/v7](../../.scratch/asset-integration-v1/runs/2026-10-20f-lurker/ruin-scavenger-extraction-assets/pack/v7/) |
| 最终站点 v3（`out/` 构建产物不入库） | [运行目录](../../.scratch/asset-integration-v1/runs/2026-10-20e-site/) |
| 归档完整单跑 | [run-2026-10-17d.json](../../.scratch/game-maker-v2/experiments/e2e-wasteland/raw/run-2026-10-17d.json) |
| 视觉裁定 | [08-visual-comparison-rulings.md](../../.scratch/p0-00-audit/issues/08-visual-comparison-rulings.md) |

## 11. 结论

1. **主链不是「没建起来」，而是「边界没封住」**：理解 → 规划 → 包 → 配置 → QA → 站点都有实现与测试；
   真正的问题是运行时语义（gate / fps / motion / 失败态）、QA 的真实判定能力（视觉 / 玩法 / 6/6）
   和发布闸门（site 绕过）没有闭合。
2. **13 条 P0** 全部围绕两类风险：**阻断目标**（gate 假胜利、危险物软锁、无启动/输入验收、资源不完整）
   与**假成功**（QA 5/6、像素不阻断、site 绕过、无单跑 E2E、静默 `frames` 折叠）。
3. **21 条 P1** 是质量 / 诊断 / 可复现性改进；**21 条 P2** 是死字段、文档漂移、兼容边界与优化项。
4. **v3 基线未被推翻**：`deriveRecipe` 不存在、`planAssets` 唯一规划入口、`resolveRoute` 唯一路线写入者、
   三值 route、sidecar 记录语义都成立；唯一新增的静默降级是 `frames → image`（P0 修）。
5. **不得宣称 HEAD E2E 已通过**：只有归档上游 + HEAD 下游重放；单跑 E2E 是 P0 最终验收门（Q8）。
6. **下一步**：按 [P0 范围](P0-00-p0-scope.md) 的工作包顺序施工；本审计不实施、不付费、不提交。
