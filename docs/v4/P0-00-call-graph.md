# P0-00 真实调用链与产物路径

| 属性 | 内容 |
|---|---|
| 审计基线 | `v2-foundation` · `ea53240`（2026-10-20） |
| 当前 HEAD（写作时） | `7aa98d7`（Phase 1 Tier 1 已提交） |
| 证据来源 | [W1 调研](../../.scratch/p0-00-audit/research/w1-call-graph.md) |
| 相关交付物 | [能力差距表](P0-00-capability-gap-audit.md) · [测试矩阵](P0-00-test-matrix.md) · [E2E 证据](P0-00-e2e-evidence.md) · [P0 范围](P0-00-p0-scope.md) |
| 证据等级 | E1 源码 · E2 测试 · E3 真实产物（任务书附录 A） |

> **行号口径**：本文行号来自审计基线 `ea53240`；`7aa98d7` 之后源码行号会漂移。
> **基线漂移**：`7aa98d7` 新增了 `accept` CLI 与 MCP `accept_asset_pack`（不在本文审计的主链内），
> 并修复了两处测试类型错误；截至 `7aa98d7`，CLI 有 11 个命令、MCP 有 8 个工具。
> 主链（理解 → 包 → 配置 → QA → 站点）未被 `7aa98d7` 改动。详见 §8。

## 0. 结论先行

1. **主链是两段，不是一段**：`runUnderstanding`（理解五步 → 定稿 `run/v<N>`）与 `runBuild`
   （包 → 配置 → QA）在清单处分开；`build` 只吃 `runDir`，清单、风格、DNA 全部从磁盘读回。
2. **站点不在 pipeline 里**：`@game-maker/pipeline` 的依赖没有 `@game-maker/demo`；站点由 CLI/MCP
   这一层串第三步。CLI 的 `create --yes` / `build` 走 `assembleFromConfig`（按 `format` 分派横版/塔防）；
   MCP 的 `create_game` / `assemble_site` 直接调 `assembleSite`，**因此塔防站点只能从 CLI 走**。
3. **RuntimeProfile 有两处分派、一处注册表**：写设计时 `compileDesign → pickProfile`，编配置时
   `compileRuntime` 从设计读 `game.runtimeProfile` 并查 `CONFIG_SHAPES`（只有 `platformer/v1`）；
   塔防是并列旁路链，不读 RuntimeProfile、不在 `create` 链。
4. **版本号由父分配且首次对齐**：`create/build` 的 `run/v<N>`、`pack/v<N>`、`site/v<N>` 首次同 N；
   重跑构建取 `nextPackVersion`；单独 `pack` / `compile-*` / `site` 各自扫目录取 max+1。
5. **失败语义按段分裂**：理解段失败把 staging 改名成 `failed-*`；pack 失败把 `.building-*` 改名成
   `<id>/failed-<ts>`；配置 staging 在 `finally` 删除；QA 硬失败**先落报告再抛**，站点不产。
6. **CLI 与 MCP 的错误语义不一致**：CLI 用 `asCommandError` 把 `{rejections}` → 4、`{failure:http|timeout}` → 3；
   MCP 没有这层，裸 Error 的 `_exitCode` 一律 1，与工具说明写的 3/4 不符。
7. **两个真实边界**：HEAD 没有从「风格图 + 意图」到可玩站点的单跑（W6）；`site` / `assemble_site`
   不读 QA 报告、也不跑 reachability，发布闸门可被绕过（W4）。

## 1. 主链调用图（CLI）

入口：`packages/cli/src/cli.ts`，bin 是 `dist/cli.mjs`；源码底部在直接执行时
`process.exit(await run(...))`（`cli.ts:645-648`）。

```text
game-maker <command>
└─ run(argv)                                  cli.ts:445
   ├─ parseArgs(argv)                          cli.ts:78
   ├─ --help / help            → EXIT.ok(0)    cli.ts:466
   ├─ 无子命令                 → EXIT.usage(2) cli.ts:467
   ├─ create        cli.ts:471
   │  ├─ readRequirement / styleRefOf          cli.ts:168 / 188
   │  ├─ runUnderstanding                      pipeline/create-game.ts:250
   │  │  ├─ writeIntentMd                      pipeline/artifacts.ts:45
   │  │  ├─ analyzeReference                   vision/analyze-reference.ts:303
   │  │  │  └─ writeVisualWorld (+ 拷参考图)   pipeline/artifacts.ts:58,65
   │  │  ├─ analyzeIntent                      game-design/analyze-intent.ts:194
   │  │  ├─ compileDesign (pickProfile)        game-design/compile-design.ts:235,156
   │  │  ├─ compileCharacterDna                game-design/compile-character-dna.ts:180
   │  │  ├─ planAssets(staging)                assets/ops.ts:249
   │  │  ├─ injectCharacterRef → parseRecipe → flattenPlannerOutput
   │  │  │                                     pipeline/artifacts.ts:88,100
   │  │  ├─ commitRun → run/v<N>               pipeline/run.ts:75
   │  │  └─ writeRunLedger                     pipeline/create-game.ts:603
   │  ├─ 无 --yes → awaitingCheckpoint → 0     cli.ts:282,486-489
   │  └─ --yes → buildAndSite                  cli.ts:224,490-493
   ├─ build         cli.ts:496 → buildAndSite  cli.ts:224
   │  └─ buildAndSite
   │     ├─ runBuild                           pipeline/create-game.ts:417
   │     │  ├─ parseRunVersion + parseRecipe + id 一致性
   │     │  ├─ packAssets                      assets/ops.ts:1508
   │     │  ├─ staging .config-* → compileRuntime   assets/ops.ts:882
   │     │  │  └─ rename → run/v<N>/game-config.json
   │     │  ├─ inspectPack（免费观察，失败不阻断） assets/ops.ts:1900
   │     │  ├─ qaRunner                        qa/assemble.ts:73
   │     │  ├─ write qa-report.json → assertQaPassed
   │     │  └─ run ledger 并集写回             create-game.ts:549-551
   │     └─ assembleFromConfig                 demo/assemble.ts:53
   │        ├─ game-config/v1 → assembleSite   demo/site.ts:167
   │        └─ td-config/v1   → assembleTdSite demo/td/site.ts:92
   ├─ plan          cli.ts:508 → planAssets    assets/ops.ts:249
   ├─ pack          cli.ts:524 → packAssets    assets/ops.ts:1508
   ├─ compile-runtime  cli.ts:544 → compileRuntime  assets/ops.ts:882
   ├─ compile-td-game  cli.ts:560 → compileTdGame   assets/ops.ts:1232
   ├─ site          cli.ts:575 → assembleFromConfig demo/assemble.ts:53
   ├─ verify        cli.ts:593 → verifyPack    assets/ops.ts:1662
   ├─ inspect       cli.ts:598 → inspectPack   assets/ops.ts:1900
   └─ review        cli.ts:603 → reviewRun     pipeline/review.ts:76
                                  └─ reviewPack assets/review.ts:100
```

错误出口：`run()` 顶层 `catch`（`cli.ts:617-643`）→ `asCommandError`（`cli.ts:207`）→
`exitCodeOfError` → 输出人类文本或 `--json`。进度写 stderr（`cli.ts:191`），仅当调用方传了 `onProgress`。

关键分支：

- **检查点**：`create` 不带 `--yes` 只跑 `runUnderstanding`，返回 `status: "awaiting"` 与清单摘要
  （`cli.ts:282-309`），退出码 0；`--yes` 与 `build` 共用 `buildAndSite`（`cli.ts:224-248`），
  测试断言两条路产物逐字节等价（`cli-create.test.ts:310-357`）。E2。
- **站点版本**：`buildAndSite` 用 `built.packVersion` 作为 `siteVersion`（`cli.ts:246`）；
  测试钉住「先摆一个 `site/v9`，产物仍在 `site/v1`」（`cli-create.test.ts:299-308`）。E2。
- **`site` 命令的默认外壳路径**用 `process.cwd()`（`cli.ts:583`），而 `create/build` 用注入的 `cwd`
  （`cli.ts:243,459`）——同一壳里两套解析基准。E1。

## 2. 主链调用图（MCP）

入口：`packages/mcp/src/server.ts`，bin 是 `dist/server.mjs`，stdio 逐行读 JSON-RPC（`server.ts:362-377`）。

```text
JSON-RPC
├─ initialize / notifications/* / tools/list   server.ts:211-217
└─ tools/call                                  server.ts:218
   ├─ plan_assets      server.ts:230 → planAssets        assets/ops.ts:249
   ├─ build_asset_pack server.ts:241 → packAssets        assets/ops.ts:1508
   ├─ verify_asset_pack server.ts:255 → verifyPack       assets/ops.ts:1662
   ├─ compile_runtime  server.ts:258 → compileRuntime    assets/ops.ts:882
   ├─ create_game      server.ts:268
   │  ├─ readIntent → runUnderstanding  pipeline/create-game.ts:250
   │  ├─ runBuild                       pipeline/create-game.ts:417
   │  └─ assembleSite（直接调，不经 format 分派） demo/site.ts:167
   ├─ assemble_site    server.ts:318 → assembleSite     demo/site.ts:167
   └─ inspect_asset_pack server.ts:326 → inspectPack     assets/ops.ts:1900
```

- 基线工具面**恰好七个**，测试逐名断言（`packages/mcp/tests/server.test.ts:61-75`）。E2。
  `7aa98d7` 追加第 8 个 `accept_asset_pack`（见 §8）。
- `create_game` 的说明逐字写着「它不停（R9 检查点只活在 CLI 上）」（`server.ts:117-143`），
  源码也不传 `onRecipe`。E1。
- MCP 复用的是 core 函数与 `CommandResult`，不 shell out 到 CLI（`server.ts:2-3`）；
  `structuredContent` 与 CLI `--json` 同源（`server.test.ts:94-101`）。E2。
- 进度走 MCP 原生 `notifications/progress`（`server.ts:220-228`），测试覆盖有/无 token 两档
  （`server.test.ts:102-111`）。E2。
- MCP 的 `inputSchema` 只用于描述，`handle` 不校验参数，直接 `String(args.x)`（`server.ts:219-328`）；
  缺失/类型错误最终由 core 以 usage 错误报出（部分会变成字符串 `"undefined"`）。E1。

## 3. 阶段 / 产物表

路径前缀：`outRoot` CLI 默认 `path.resolve("out")`（`cli.ts:457`）；MCP 默认 `"out"`（`server.ts:234` 等）。

| # | 阶段 | 实现入口 | 输入类型 | 输出类型 | 落盘位置（基线行为） | 证据 |
|---|---|---|---|---|---|---|
| 0 | 输入登记 | CLI `create` / MCP `create_game` | `--style` 一张图；`--intent` 文本或 `.md/.txt` 路径 | 原始需求串 + `styleReferences[{path}]` | 未落盘；`intent` 判别在 `cli.ts:168` / `server.ts:24` | E1；意图路径正/负例 `cli-create.test.ts:194-223` E2 |
| 1 | 这个世界 | `analyzeReference` `vision/analyze-reference.ts:303` | `AnalyzeReferenceInput`（参考图、需求文本、styleId、已解码像素、transport）`:46-76` | `AnalyzeReferenceResult { spec: VisualWorldSpec }` `:78-83` | staging 内 `visual-world.json`，参考图拷贝进同目录并把路径改成 basename；`commitRun` 后成为 `run/v<N>/visual-world.json`（`artifacts.ts:58-78`） | E2 `create-game.test.ts:46-64` |
| 2 | 意图 | `analyzeIntent` `game-design/analyze-intent.ts:194` | `AnalyzeIntentInput` `:40-50` | `AnalyzeIntentResult { spec: GameIntentSpec }` `:52-58` | `run/v<N>/game-intent.json`（`create-game.ts:300`） | E2 `create-game.test.ts:46` |
| 3 | 设计 | `compileDesign` `game-design/compile-design.ts:235` | `CompileDesignInput`（`GameIntentSpec` + `VisualWorldSpec` + 可选 `RuntimeProfileRef`）`:38-48` | `CompileDesignResult { spec: GameDesignSpec }` `:50-56`；`DesignRejectedError` 是另一档结论 `:71-78` | `run/v<N>/game-design.json`（`create-game.ts:313`） | E2 `create-game.test.ts:46` |
| 4 | 角色基因 | `compileCharacterDna` `compile-character-dna.ts:180` | `CompileCharacterDnaInput`（design + vws）`:37-45` | `CompileCharacterDnaResult { file: CharacterDNAFile }` `:47-53` | `run/v<N>/character-dna.json`（`create-game.ts:323`） | E2 同上 |
| 5 | 资源清单 | `planAssets` `assets/ops.ts:249`（规划段由 `runUnderstanding:328` 调） | `PlanAssetsOptions`（`designPath`、`visualWorldPath`、`outRoot`、transport）`:78-...` | `AssetRecipe` + `asset-plan/v1` sidecar + `stylespec.json` + `reference.png` | staging：`<staging>/<recipeId>/recipes/v<N>.json`、`v<N>.plan.json`（`ops.ts:345,440`）；`flattenPlannerOutput` 摊平到 run 根：`asset-recipe.json`、`asset-recipe.plan.json`、`stylespec.json`、`reference.png`（`artifacts.ts:100-109`）。单独 `plan` 留在 `<out>/<id>/recipes/` | E2 `create-game.test.ts:65-79`；E3 归档 run 见 §9（归档缺 plan sidecar 见 §9 注） |
| 6 | 资源包 | `packAssets` `assets/ops.ts:1508` | `PackOptions`（`recipePath`、`outRoot`、transport、可选 `version`/`visualWorldPath`/`imageTransport`/`concurrency`）`ops.ts:1376-1402` | `AssetPackManifest` + 包目录 | `<out>/<gameId>/pack/v<N>/`：`manifest.json`、`ledger.json`、`coverage.json`、`delivery/atlas.*.{png,json}`、`authoring/{drawlist,imported,generated,masters}/`、`authoring/stylespec.json`、`authoring/visual-world.json`（有 VWS 时）。工作目录 `.building-<pid>-<version>` 成功才 rename（`pack.ts:320-340,1263-1298`） | E2 `create-game.test.ts:106-140`；E3 见 §9 |
| 7 | 关卡配置 | `compileRuntime` `assets/ops.ts:882`（构建段由 `runBuild:480` 调） | `CompileRuntimeOptions`（`designPath`、`packDir`、`outRoot`、transport、level、viewport、hudLineHeight）`:797-...`；profile 从设计里读（`:896`） | `GameConfig`（`game-config/v1`） | 构建段：暂存 `<out>/.config-XXXX/<id>/game-configs/v<N>.json` → **rename** 成 `run/v<N>/game-config.json`（`create-game.ts:477-495`）。单独 `compile-runtime`：`<out>/<id>/game-configs/v<N>.json`（`ops.ts:1063-1067`） | E2 `create-game.test.ts:106-116`；`text-op-ledger.test.ts:196+` |
| 8 | QA | `qaRunner` `qa/assemble.ts:73`（默认；`runBuild:445` 取默认） | `QaContext`（`runDir`、`packDir`、`configPath`、`intentPath`、`designPath`、`recipePath`、`gameId`、可选 inspect 观察）`contracts/qa.ts:436-458` | `QAReport`（`qa-report/v1`） | `run/v<N>/qa-report.json`（`create-game.ts:542-543`） | E2 `create-game.test.ts:574-675` |
| 9 | 站点 | CLI `assembleFromConfig` `demo/assemble.ts:53` → `assembleSite` `demo/site.ts:167` / `assembleTdSite` `demo/td/site.ts:92`；MCP 直接 `assembleSite` | `AssembleOptions`（`packDir`、`configPath`、`shellJsPath`、`outRoot`、可选 `gameId`/`siteVersion`）`assemble.ts:36-44` | 站点目录 | `<out>/<gameId>/site/v<N>/`：`index.html`、`shell.js`、`site.json`、`game-config.json`（横版）或 `td-config.json`（塔防）。若 `<out>/<gameId>/pack/v<N>` 不存在则把包拷过去（`layout.ts:75-100`）。校验不过**不建目录**（校验在 `laySite` 之前，`site.ts:211-216`） | E2 `site.test.ts:29-63,79-140`；`td-site.test.ts:33-135`；E3 见 §9 |
| 10 | 塔防配置 | `compileTdGame` `assets/ops.ts:1232` | `CompileTdGameOptions`（`requirementPath`、`packDir`、transport、attempts、viewport、hudLineHeight）`:1202-...` | `TdConfig`（`td-config/v1`） | `<out>/<id>/td-configs/v<N>.json`（`ops.ts:1349-1353`） | E2 `compile-td-game.test.ts`；注意 §5 的 `ok:false` 语义 |
| 11 | 事后抽查 | `reviewRun` `pipeline/review.ts:76` | run 目录 + transport | 观察清单；追加 run 账 | 读 `run/v<N>/visual-world.json` 的原图、包内 `authoring/stylespec.json`；写 `run/v<N>/ledger.json` | E2 `pipeline/tests/review.test.ts` |
| 12 | 校验 / 观察 | `verifyPack` `ops.ts:1662`；`inspectPack` `ops.ts:1900` | 包目录 | `CommandResult` | 只读；`verify` 逐文件 checksum，`inspect` 汇总 assets/palette/layer/source size | E2 `cli.test.ts:123-138` |

### 版本目录规则

- `run/v<N>`：`nextRunVersion` 扫 `<out>/<gameId>/run/v*` 取 max+1（`run.ts:37-46`）；
  `commitRun` 用 `renameSync` 到非空目录失败当原子抢（`run.ts:75-93`）。
- `pack/v<N>`：首次 `runBuild` 如果 `pack/v<runVersion>` 不存在就与 run 对齐，否则 `nextPackVersion`
  （`create-game.ts:439-441`）；单独 `pack` 由 `buildInto` 取 `nextPackVersion`（`pack.ts:328`）。
- `site/v<N>`：`create/build` 显式传 `packVersion`（`cli.ts:246`；`server.ts:292`）；
  单独 `site` 取 `nextSiteVersion`（`layout.ts:60-72`）。显式版本撞已存在目录 ⇒ 抛普通 Error（`layout.ts:91-96`）。
- `recipes/`、`game-configs/`、`td-configs/`：`nextVersion` 扫 `v<N>.json`（`ops.ts:691-695`）。

## 4. 失败：退出码、错误包装、现场与清理

### 4.1 退出码表

`EXIT = { ok:0, failure:1, usage:2, upstream:3, invalid:4 }`（`contracts/command.ts:46`）；
`exitCodeOfError` 只认 `CommandError`，其余一律 1（`command.ts:88`）。

| 码 | 含义 | 典型来源 | 证据 |
|---|---|---|---|
| 0 | 成功 | 任一步返回 `CommandResult`；`--help`；`create` 停在检查点（`status:"awaiting"`） | `cli.test.ts:109-125`；`cli-create.test.ts:225-238`；E3 `run-2026-10-17b.json` |
| 1 | 失败 / 我们的 bug / 未包装的裸 Error | pack 段的判断（如透明像素、帧数不符）；`site` 显式版本撞名；CLI 里未被 `asCommandError` 认出的裸 Error | `cli.test.ts:103-107,193-281`；E3 `run-2026-10-17c.json` |
| 2 | 参数 / 用法错 | 缺 flag、`--recipe` 缺值、不认识的子命令、包不是包、生图凭据缺失（清单有 image） | `cli.test.ts:109-121`；`ops.ts:1517-1520` |
| 3 | 上游不可达 | HTTP / timeout；缺文本上游；`GenerationError` / `ImageGenerationError` 被 `packAssets` 包成 `upstream` | `cli.test.ts:171-190`；`ops.ts:1592-1593` |
| 4 | 产物 / 清单 / 设计不合法 | schema 不过、QA 硬失败、R12 拒绝、业务校验不过 | `cli-create.test.ts:409-450`；`create-game.ts:215-233` |

CLI 对理解层错误的翻译：`asCommandError`（`cli.ts:207-221`）按**形状**识别——带 `rejections` → `invalid`(4)；
带 `failure` → `http|timeout` 为 `upstream`(3)，其余 `invalid`(4)；其他原样抛 → 1。
测试：`cli-create.test.ts:429-450`。E2。

MCP 的失败回复：`isError: true` + 非标准的 `_exitCode: exitCodeOfError(e)`（`server.ts:338-360`），
测试钉住 usage=2（`server.test.ts:112-118`）。**MCP 没有 `asCommandError` 这一层**：
`DesignRejectedError` / `CompileDesignError(schema)` / `AnalyzeReferenceError(http)` 都是裸 Error，
`_exitCode` 为 1（本地执行 `exitCodeOfError` 复核）。这与 `create_game` 工具说明里写的「4 / 3」不一致
（`server.ts:141-143`）。E1（无测试覆盖）→ 见能力差距表 `CAP-ENTRY-01`。

### 4.2 错误携带

- `CommandError` 可带 `ledger` 与 `failureDir`（`command.ts:67-86`）。
- `carryOnError` 把 `{ledger, failureDir, designAttempts, visualWorldAttempts}` 挂到原异常上
  （`command.ts:114-139`）；两个壳都按能力读（`ledgerOfError` / `failureDirOfError`，`command.ts:142-151`）。
  CLI 在 `cli.ts:627-640` 渲染；MCP 在 `server.ts:344-359` 渲染。
  E2（`cli.test.ts:142-190,193-281`；`build-pack-stdio.test.ts:185-235`）。
- 失败时「已经花掉的那几笔」是事实：`packAssets` 的 `ledger` 数组在 `buildAssetPack` 调用前就存在
  （`ops.ts:1549-1552`），失败时挂到异常上（`ops.ts:1573-1610`）。E2/E3。

### 4.3 现场与清理策略

| 段 | 工作目录 | 成功 | 失败 | 证据 |
|---|---|---|---|---|
| 理解段 | `<out>/.building-<pid>-<ts>`（`openRun`，`run.ts:60-65`） | `commitRun` 一次 rename 到 `<out>/<gameId>/run/v<N>` | `abandonRun` 改名为 `<out>/<gameId>/run/failed-<ts>`（已定 gameId）或 `<out>/.failed-<ts>`（未定 gameId），**只改名、不删**；已定稿时什么都不做（`run.ts:108-117`） | E2 `create-game.test.ts:290-308` |
| 理解段诊断 | staging 内 | — | 抛前 best-effort 写 `design-attempts.json` / `visual-world-attempts.json`，再随失败现场改名（`create-game.ts:378-401`） | E2 `create-game.test.ts:309-573` |
| pack | `<out>/<id>/.building-<pid>-<version>`（`pack.ts:331-333`） | rename 到 `<out>/<id>/pack/v<N>`（`pack.ts:1297-1298`） | `keepFailureSite`：有文件才把 `.building-*` 改名成 `<out>/<id>/failed-<ts>`，并只保留最近一份；空目录直接删（`pack.ts:288-304`）；路径挂在异常上（`pack.ts:307-318`） | E2 `pack.test.ts` / `ledger.test.ts`；E3 `run-2026-10-17c.json` 的 `failureDir` |
| 配置 | `<out>/.config-XXXX`（`mkdtempSync`，`create-game.ts:477`） | rename 成 `run/v<N>/game-config.json` | `finally` 一律 `rmSync` 暂存（`create-game.ts:495`）；run + pack 保留 | E1 |
| QA | 无独立工作目录 | 写 `run/v<N>/qa-report.json` 后继续 | 报告**先落盘、再**抛 `invalid`（`create-game.ts:536-545,215-233`）；`buildAndSite` 因此不会走到站点，run + pack 保留 | E2 `create-game.test.ts:640-675`；`cli-create.test.ts:409-428` |
| 站点 | 直接写 `<out>/<gameId>/site/v<N>` | 三份数据 + bundle | 校验在 `laySite` 之前，校验失败**一个目录都不建**（`site.ts:211-216`）；若 `laySite` 中途 I/O 失败，代码没有回滚（E1，未见测试） | E2 `site.test.ts:79-140`；`td-site.test.ts:84-135` |
| review | 无 | 观察清单 | 已发出的调用仍写 `run/v<N>/ledger.json`；未发出 → `invalid`(4)，已发出 → `upstream`(3)（`review.ts:104-124`） | E2 `review.test.ts` |

失败**不消耗版本号**：理解段在 `commitRun` 前挂掉，N 没被用掉（`run.ts:73` 注释 + 测试）；
pack 失败留在 `failed-*`，不占 `v<N>`（`pack.ts:281-286`）。E2。

## 5. 入口差异表（CLI vs MCP）

| 能力 | CLI 入口 | MCP 工具 | 共用 core | 差异 | 证据 |
|---|---|---|---|---|---|
| 端到端创建 | `create [--yes]`（`cli.ts:471`） | `create_game`（`server.ts:268`） | `runUnderstanding` + `runBuild` | CLI 可停在清单检查点；MCP 总是跑完 | E1；E2 工具面 `server.test.ts:61-75` |
| 站点装配 | `assembleFromConfig`（`cli.ts:243,583`） | `create_game` / `assemble_site` 直接 `assembleSite`（`server.ts:287,319`） | `assembleSite` | CLI 按 config `format` 分派横版/塔防；MCP 无 `assembleTdSite` 路径 | E1；E2 `td-site.test.ts:226-270` |
| 规划 | `plan --design --visual-world`（`cli.ts:508`） | `plan_assets`（`server.ts:230`） | `planAssets` | CLI 打印 image transport 警告；MCP 静默丢弃 `warnings`（`server.ts:65-67`） | E1 |
| 打包 | `pack --recipe [--visual-world] [--version] [--concurrency*]`（`cli.ts:524`） | `build_asset_pack`（`server.ts:241`） | `packAssets` | MCP 无 `version` / `visualWorldPath` / `concurrency` 参数 | E1 |
| 编配置 | `compile-runtime --design --pack [--level]`（`cli.ts:544`） | `compile_runtime`（`server.ts:258`） | `compileRuntime` | MCP 不传 `hudLineHeight`（现默认 10，与外壳常量同值）；CLI 传 `VIEWPORT` + `HUD_LINE_HEIGHT` | E1；常量 `screen-space.ts:24`、`draw.ts:43` |
| 塔防 | `compile-td-game`（`cli.ts:560`） | **无** | `compileTdGame` | 塔防链只能走 CLI | E1；E2 工具面七项 `server.test.ts:61-75` |
| 站点 | `site <pack> --config`（`cli.ts:575`） | `assemble_site`（`server.ts:318`） | 横版 `assembleSite` | MCP 无 `format` 分派 | E1 |
| 校验 | `verify`（`cli.ts:593`） | `verify_asset_pack`（`server.ts:255`） | `verifyPack` | 无 | E2 `cli.test.ts:123-138` |
| 观察 | `inspect`（`cli.ts:598`） | `inspect_asset_pack`（`server.ts:326`） | `inspectPack` | 无 | E2 `server.test.ts:94-101` |
| 抽查 | `review <run>`（`cli.ts:603`） | **无** | `reviewPack` | 付费诊断只在 CLI，且不在创建链上 | E1 `review.ts:1-13` |
| 并发 | `--concurrency` / `--concurrency-image`（`cli.ts:133-158`） | 无 | `packAssets` / `runBuild` | MCP 永远用默认（text 4 / image 3） | E1；E2 `cli.test.ts:65-93` |
| 参考图路径 | `styleRefOf` 转成相对 cwd（`cli.ts:188`） | 直接 `String(args.stylePath)`（`server.ts:273`） | `runUnderstanding` | **绝对路径会被 `StyleReferencePath` 拒**（`visual-world.ts:90-93`）；MCP 无此转换，且无测试覆盖 | E1 |
| 错误翻译 | `asCommandError`（`cli.ts:207`） | 无 | `exitCodeOfError` | MCP 对 vision/design 的裸 Error 报 1（CLI 报 3/4） | E1 + 本地执行复核 |
| 外壳路径 | `--shell` 可覆盖；默认 `defaultShellPath`（`cli.ts:243,582-583`） | `assemble_site.shellPath`；`create_game` 不可指定 | `defaultShellPath` | `create_game` 固定 `defaultShellPath("", process.cwd())`（`server.ts:289`） | E1 |
| 进度 | stderr 行（`cli.ts:191`） | `notifications/progress`（`server.ts:220-228`） | 各自 `onProgress` | 协议不同 | E2 `server.test.ts:102-111` |
| 机器输出 | `--json`（`cli.ts:621`） | `structuredContent`（`server.ts:352`） | 同一个 `CommandResult` | 同源，不另造数据 | E2 `server.test.ts:94-101` |

### RuntimeProfile 分派与旧链边界

- **定义**：`RuntimeProfileRefSchema`（`contracts/runtime-profile.ts:84-88`）、`PLATFORMER_V1`（`:114-119`）、
  注册表只有它一个（`:123`）、`resolveRuntimeProfile` 查不到返回 `undefined`（`:128-130`）。
- **写入侧（设计层）**：`compileDesign` 调 `pickProfile`（`compile-design.ts:238`）；`pickProfile`
  默认 `platformer/v1`，查不到直接抛（`:156-164`）。`buildDesign` 把 `runtimeProfile` / `genre` / `camera`
  三个「调用方才知道」的值覆盖进设计（`build-design.ts:68-72,153-171`），并按 profile 的
  `mechanics` / `capabilities` 求差（`:134-147`）。
- **读取侧（运行编译）**：`compileRuntime` **从设计里读** `design.game.runtimeProfile`（`ops.ts:896`），
  再 `resolveRuntimeProfile`（`:897`）；`CONFIG_SHAPES` 只有 `platformer`（`:826-828`），没有形状就 `invalid`（`:902-906`）。
- **旧链/旁路边界**：
  - 旧 `derive` / `compile_game` 命令已不在 CLI switch 中（`cli.ts:471-608` 只有十个命令）；
    源码只剩解释它们被谁取代的注释（如 `ops.ts:73-77,245`）。E1/E2。
  - 塔防是**并列链**：`compile-td-game`（`cli.ts:560`）吃需求 + 包，产出 `td-config/v1`；
    `site` 再按 `format` 分派到 `assembleTdSite`（`assemble.ts:61-66`）。它**不经过**
    `GameDesignSpec` / `CharacterDNA` / `RuntimeProfile`，也不在 `create` 链里
    （`runtime-profile.ts:120-123` 明确「塔防不进新链」）。E1。
  - `createGame`（`create-game.ts:576`）是给测试/库调用者的便利封装（两段 + 可选 `onRecipe`），
    **两个壳都没用它**：CLI 用 `runUnderstanding` + `buildAndSite`，MCP 用 `runUnderstanding` + `runBuild`。
    E1（grep 仅测试引用）。

## 6. 与任务书 W1 的验收对照

| W1 要求 | 本文位置 | 状态 |
|---|---|---|
| CLI 命令与参数入口 | §1 | 已核实（基线十命令；`7aa98d7` 后十一） |
| MCP 工具入口与复用关系 | §2、§5 | 已核实（基线七工具；`7aa98d7` 后八） |
| RuntimeProfile 分派与旧链兼容边界 | §5 末 | 已核实 |
| 各阶段输入/输出/落盘位置 | §3 | 已核实 |
| 失败退出码、错误包装、清理策略 | §4 | 已核实 |
| 另一位开发者可据此跟踪一次构建 | §1、§3、§9 | 满足：`cli.ts:496 → cli.ts:224 → create-game.ts:417 → ops.ts:1508 → create-game.ts:477 → qa/assemble.ts:73 → assemble.ts:53` |

## 7. 主链缺口（详见能力差距表）

| 缺口 | 一句话 | 能力差距 ID |
|---|---|---|
| MCP 不翻译理解层错误 | 裸 Error 退 1，CLI 退 3/4，工具说明写 3/4 | `CAP-ENTRY-01` |
| MCP `stylePath` 未相对化 | 绝对路径被契约拒，且无测试 | `CAP-ENTRY-02` |
| MCP 工具面较窄 | 无 TD / review / 并发参数 | `CAP-ENTRY-03` |
| `HUD_LINE_HEIGHT` 两个来源 | 今天同值，结构性漂移 | `CAP-ENTRY-04` |
| `site` 默认外壳路径用 `process.cwd()` | 与 `create/build` 的注入 `cwd` 不一致 | `CAP-ENTRY-05` |
| `laySite` 中途 I/O 失败无回滚 | 可能留下半个 `site/v<N>` | `CAP-ENTRY-06` |
| `RUN_ARTIFACT` 注释「九项」 | 常量实际 10 个键（多 `recipePlan`） | `CAP-ENTRY-07` |

## 8. 基线漂移：`ea53240` → `7aa98d7`

审计证据在 `ea53240` 上取得。写作时 HEAD 为 `7aa98d7`，其间四次提交：

| 提交 | 与本文相关的增量 | 是否改变主链结论 |
|---|---|---|
| `157212d` | JPEG 解码、2.1 两帧 smoke、共享裁框 | 否（资源解码/模型路线） |
| `f0dac01` | 动画验收标准 + 模型筛查/决赛 | 否（验收标准） |
| `5be1fd2` | Phase 0 四件交付物 + Phase 1 文件级计划 | 否（文档） |
| `7aa98d7` | Phase 1 Tier 1：新增 `accept` CLI + MCP `accept_asset_pack`；修复两处测试类型错误 | **局部**：CLI 命令数 10 → 11，MCP 工具数 7 → 8；`pnpm typecheck` 由 exit 2 → exit 0；主链、退出码、产物路径未变 |

`7aa98d7` 后实测：`pnpm test` **110 文件 / 1731 例，exit 0**；`pnpm typecheck` **exit 0**。
W5 的「`pnpm typecheck` exit 2」结论**只对基线成立**，已在 [测试矩阵](P0-00-test-matrix.md) 标注。
`accept` 不在本文审计的主链内；它只读包并写 `out/<packId>/acceptance/v<N>/`，不接入 `runBuild` 阻断
（Phase 1 Q2 裁定）。

## 9. 真实产物索引（E3，均早于或等于基线）

> 这些归档是**先前真实运行**的产物，用于证明目录形状、版本语义、失败现场、退出码确实被写出来；
> 不能用来证明 HEAD 每一行的最新行为。HEAD 行为由 E2 测试补充。

1. **检查点**：`.scratch/game-maker-v2/experiments/e2e-wasteland/raw/run-2026-10-17b.json`
   → `code: 0`，`command: "create"`，`data.status: "awaiting"`，`runDir: "wasteland-scavenger-assets/run/v1"`。
2. **构建失败**：`.../raw/run-2026-10-17c.json` → `code: 1`，`command: "build"`，`exitCode: 1`，
   带 17 笔 `ledger` 与 `failureDir: ".../wasteland-scavenger-assets/failed-2026-10-17T03-03-43-155Z"`。
3. **构建成功**：`.../raw/run-2026-10-17d.json` → `code: 0`，`status: "complete"`，
   `runDir/packDir/config` 是 `run/v1`、`pack/v1`、`run/v1/game-config.json`，
   `siteDir: ".../site/v1"`，`serveRoot: "wasteland-scavenger-assets"`。
4. **目录树**：`.../raw/run-out-2026-10-17d/wasteland-scavenger-assets/{run/v1,pack/v1,site/v1}` 同时存在；
   `run/v1` 内可见 `intent.md`、`visual-world.json`、`game-intent.json`、`game-design.json`、
   `character-dna.json`、`asset-recipe.json`、`game-config.json`、`qa-report.json`、`ledger.json`、
   `stylespec.json`、`reference.png`、`style.png`；`site/v1` 内是 `index.html`、`shell.js`、
   `site.json`、`game-config.json`。站点另有 `site/v2`、`site/v3`，与「绝不覆盖」一致。
5. **最终包**：`.scratch/asset-integration-v1/runs/2026-10-20f-lurker/ruin-scavenger-extraction-assets/pack/v7/`
   含 `manifest.json`、`ledger.json`、`coverage.json`、`delivery/atlas.*.{png,json}`、
   `authoring/{stylespec.json,visual-world.json,drawlist,generated,imported,masters}`。
6. **最终站点**：`.scratch/asset-integration-v1/runs/2026-10-20e-site/out/ruin-scavenger-extraction-assets/site/v3/`
   含 `index.html / shell.js / site.json / game-config.json`；同 gameId 下 `pack/` 与 `site/` 并列。

> **归档完整性注**：`run-out-2026-10-17d/.../run/v1` 缺 `asset-recipe.plan.json`，而 HEAD 的
> `flattenPlannerOutput` 会落它（`artifacts.ts:104-106`）且测试断言它在（`create-game.test.ts:65-79`）。
> 归档早于该行为或由旧二进制产生；**不能据归档否定 HEAD**（E2 vs E3）。该归档还缺
> `asset-recipe.plan.json` 对应的 plan sidecar，故 W2 的 sidecar 证据改用 `2026-10-18d` 的归档
> （见 [能力差距表](P0-00-capability-gap-audit.md) 的证据索引）。

## 10. 快速定位

- 想跟一次 `build`：`cli.ts:496` → `cli.ts:224` → `create-game.ts:417` → `ops.ts:1508`（pack）
  → `create-game.ts:477`（config）→ `qa/assemble.ts:73`（QA）→ `assemble.ts:53`（site）。
- 想找产物：`run/v<N>` 见 `pipeline/artifacts.ts:14-26`；`pack/v<N>` 见 `assets/pack.ts:329,1263-1298`；
  `site/v<N>` 见 `demo/layout.ts:75-118`。
- 想看失败：`run.ts:108-117`（理解段）、`pack.ts:288-318`（pack）、`create-game.ts:215-233`（QA）、
  `command.ts:67-151`（错误携带与退出码）。
- 想看入口差异：`cli.ts:445-643` 对 `server.ts:206-360`。
- 完整证据与逐行分析：[W1 调研](../../.scratch/p0-00-audit/research/w1-call-graph.md)。
