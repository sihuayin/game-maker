# A · 项目架构与依赖边界（票 01）

> 基线：`main` · `f0dac01`（2026-10-21）。只读取证；未改业务代码 / 测试 / 契约 / 资源 / 配置 / 锁文件。
> 未运行 `pnpm check` / `pnpm build` / 任何写 `out/` 的生成命令；零付费。
> W1（`.scratch/p0-00-audit/research/w1-call-graph.md`，基线 `ea53240`）只作线索，本报告引用的每条都已在 `f0dac01` 上重新读源码/测试核过；行号均为 **HEAD 当前行号**，不是 W1 的行号。

## 0. 结论先行

1. **workspace 是 9 个 pnpm package**：`contracts` · `assets` · `demo` · `cli` · `mcp` · `vision` · `game-design` · `qa` · `pipeline`（`pnpm-workspace.yaml:1-2`；根脚本 `package.json:7-14`）。状态：`implemented`。
2. **生成 / 处理 / 验证不在同一个 package**：
   - 生成：`@game-maker/assets`（规划 `ops.planAssets`、组装 `pack.buildAssetPack`、drawlist/生图客户端）；
   - 处理：`@game-maker/assets`（导入、切帧、光栅化、量化、图集、PNG/JPEG）；
   - 验证：分成四层——`contracts` 的 schema / 纯函数判据、`assets` 的 `verify` / `inspect` / `pack` 自校验、`qa` 的 5/6 判据族、`demo` 的装配期硬失败。状态：`implemented`（但“验收级”能力仍见 §6/§8）。
3. **资源格式的唯一家是 `@game-maker/contracts`**：`assetpack/v4`（`packages/contracts/src/assetpack.ts:57`）、`asset-recipe/v1`、`asset-spec`、`game-config/v1`、`td-config/v1` 都在这里；任何新报告/基线 schema 若需要共享，也只能放这里（所有包都已依赖它）。状态：`implemented`。
4. **游戏运行时在 `@game-maker/demo`**：纯层 `buildWorld` + Phaser 外壳 `shell/entry.ts` / `shell/scene.ts` + 站点装配器。没有独立的 runtime package。状态：`implemented`；但“确认动画真的播放了”的自动证据不在仓库测试里（见 §6.2）。
5. **CLI / MCP 都是薄壳，但能力面不同**：CLI 10 个命令；MCP 7 个工具。只有 CLI 有 `create` 检查点、`compile-td-game`、`review`；MCP 的 `create_game` 等价 `create --yes`，`assemble_site` 直接调横版装配器、不能装塔防。W1 的入口差异结论在 HEAD 仍成立（§5）。
6. **依赖守卫实际允许/禁止的边**见 §3；`node scripts/check-deps.mjs` 在 HEAD 退出码 0（“✅ 依赖图合法（9 个包）”）。守卫只读 `package.json` 的 `dependencies`，不读 `tsconfig` 与相对路径 import，且当前 `cli` / `mcp` 的 tsconfig project references 漏了 `pipeline`（§3.2）。
7. **Phase 1 最小落点**（详见 §7）：确定性动画/包结构检查放 `packages/assets`；运行时播放探针放 `packages/demo`；报告/基线 schema 放 `packages/contracts`；编排放 `cli`（必要时加 `mcp` tool）。不要放 `qa`（白名单只有 `contracts`，够不着 PNG/demo）或 `pipeline`（够不着 `demo`）。新建 `packages/acceptance` 只有在“必须给两个壳之外的调用者复用”时才值得，且必须同时改 `check-deps.mjs`、`tsconfig.json` references 与 `package.json`。

## 1. package / workspace 划分（任务书 §4.1 Q1）

`pnpm-workspace.yaml:1-2` 把 `packages/*` 全部纳入；每个 package 都是 `private` + ESM + `exports` 指向 `dist`，共用根 catalog（`pnpm-workspace.yaml:7-13`）。构建是 `tsc -b` + 各包 `bundle`（根 `package.json:8`），测试是根 `vitest run --passWithNoTests`（`package.json:13`）。

| Package | 依赖的兄弟包（package.json 证据） | 当前职责 | 状态 |
|---|---|---|---|
| `@game-maker/contracts` | 无（只有外部 `zod`；`packages/contracts/package.json:13-15`） | Zod schema、纯类型、确定性判据（audit / reachability / layer-coverage 等） | implemented |
| `@game-maker/assets` | `contracts`（`packages/assets/package.json:13-17`） | 规划、生成、处理、打包、compile-*、verify/inspect | implemented |
| `@game-maker/demo` | `contracts` + `phaser`（`packages/demo/package.json:13-16`） | 纯场景描述、Phaser 外壳、站点装配 | implemented |
| `@game-maker/cli` | `assets` · `contracts` · `demo` · `pipeline`（`packages/cli/package.json:13-18`） | 参数解析 + 调 core + 渲染 `CommandResult` | implemented |
| `@game-maker/mcp` | `assets` · `contracts` · `demo` · `pipeline`（`packages/mcp/package.json:13-18`） | MCP stdio 薄壳，直接调 core，不 shell out 到 CLI | implemented |
| `@game-maker/pipeline` | `contracts` · `assets` · `vision` · `game-design` · `qa`（`packages/pipeline/package.json:13-19`） | `runUnderstanding` / `runBuild` 两段链；**够不着 demo** | implemented |
| `@game-maker/qa` | 仅 `contracts`（`packages/qa/package.json:13-15`） | 5 条判据族 + `qaRunner` 合成器（第 6 条由装配期硬失败保证） | implemented |
| `@game-maker/vision` | 仅 `contracts` | 参考图 → `VisualWorldSpec` | unverified（本票只确认包与依赖边，未展开其能力） |
| `@game-maker/game-design` | 仅 `contracts` | intent / design / CharacterDNA | unverified（本票只确认包与依赖边，未展开其能力） |

## 2. 模块职责表（任务书 §4.1 输出要求）

| 模块 / 文件 | 当前职责 | 相关接口 | 已有测试 | 对 Phase 1 的建议 |
|---|---|---|---|---|
| `packages/contracts/src/assetpack.ts:57,150-162,164-251,265-333,344-347,377-426` | 定义 `assetpack/v4`：包 manifest、`FrameRef`、`Animation`、锚点、图集索引、逐文件 checksum；`superRefine` 查帧名/动画名重复、动画引用帧存在、分层背景层帧一一对应、多帧必须分组；`resolvePackRef` 是构建期引用解析 | `ASSET_PACK_FORMAT`、`AssetPackManifest`、`parseAssetPack`、`resolvePackRef` | `packages/contracts/tests/assetpack.test.ts`（本轮 40 用例通过） | **复用**；不要为验收改包格式，除非确有必要升版 |
| `packages/contracts/src/audit.ts:45-84` | spec ↔ 产物对账：kind/size、动画名与帧数、非动画多帧、drawlist viewBox；`checkSize` 按 `exact` 分 error/warning | `auditAssetSpec`、`checkSize` | `packages/contracts/tests/asset-spec.test.ts:183-280` | **复用**；动画“声明 vs 产物”第一层 |
| `packages/contracts/src/game-config.ts:29,388-480`；`td-config.ts:33,381-653`；`layer-coverage.ts:94`；`screen-space.ts:49`；`reachability.ts:44` | 两种关卡格式 + 引用族 / 自洽 / 可达性 / 屏幕空间 / 层覆盖判据 | `parseGameConfig`、`parseTdConfig`、`auditGameConfig`、`auditTdConfig`、`auditLayerCoverage`、`auditScreenSpace`、`auditReachability` | `game-config.test.ts`、`td-config.test.ts`、`reachability.test.ts`、`layer-coverage.test.ts` 等 | **复用**；运行时集成验收的配置侧依据 |
| `packages/assets/src/ops.ts:249,882,1232,1508` | 四个对外操作：`planAssets`（v3 清单）、`compileRuntime`（game-config）、`compileTdGame`（td-config）、`packAssets`（清单→包）；负责入口闸门、失败分类、账与失败现场 | `PlanAssetsOptions`、`CompileRuntimeOptions`、`CompileTdGameOptions`、`PackOptions` | `packages/assets/tests/ops.test.ts`、`compile-*.test.ts`、`plan-assets*.test.ts`、`pack.test.ts` | **复用**；Phase 1 不应重写这些入口 |
| `packages/assets/src/ops.ts:1662-1727` | `verifyPack`：manifest schema + **逐文件 checksum** + `files[]` 覆盖 + 可选 `ledger.json` / `master-ratios.json` schema 与包身份对账；失败抛 `CommandError("invalid")` → 退出码 4 | `VerifyOptions`、`verifyPack` | `packages/cli/tests/cli.test.ts:117-138`；`pack.test.ts`、`ledger.test.ts` 等多处以 `verifyPack(...).data.ok` 收尾 | **复用/扩展**；但它不解析图集 JSON、不核对 manifest 帧名是否真在图集里（§6.2） |
| `packages/assets/src/ops.ts:1900-1958` | `inspectPack`：读 manifest + 解 PNG，报每资源 kind/尺寸/帧/动画、色板用色、色板外像素、背景层覆盖、源图→目标尺寸；只报数、不阻断 | `inspectPack`、`InspectData` | `packages/assets/tests/inspect.test.ts`（本轮 9 用例通过） | **复用**；适合作为验收报告的“观察”数据源，不要把它当判据 |
| `packages/assets/src/pack.ts:307,1050-1057,1174-1229,1272-1294` | `buildAssetPack`：把一个 recipe 变成完整包；动画由 `spec.animations` + 帧的 `state` 派生；写 manifest / 图集 / sidecar；写盘后**自校验**（`parseAssetPack(onDisk)`）再做 spec 对账 | `BuildPackOptions`、`BuildPackResult`、`buildAssetPack` | `pack*.test.ts`（尤其 `pack-selfcheck.test.ts` 4 用例、`pack.test.ts`） | **复用**；不要在这里长验收编排 |
| `packages/assets/src/generate.ts:100`；`image-gen.ts:159,394,576`；`prompt.ts`；`image-config.ts:103`；`route.ts:80` | 生成路径：drawlist 文本生成器、三种生图客户端、提示词、凭据/协议解析、route 选择 | `createDrawListGenerator`、`ImageGenerator`、`resolveImageTransport`、`resolveRoute` | `generate.test.ts`、`image-gen.test.ts`、`prompt.test.ts`、`image-config.test.ts`、`route-resolver.test.ts` | **不涉及**（Phase 1 零付费；验收只读已有包） |
| `packages/assets/src/import.ts:315`；`sheet.ts:175,192`；`raster.ts:120`；`quantize.ts:19`；`atlas.ts:55`；`png.ts:29,44`；`coverage.ts` | 处理路径：导入位图重建、切帧/网格、drawlist 光栅化、色板量化、TexturePacker 图集、PNG 编解码、背景覆盖 | `sliceGrid`、`segmentRowCells`、`sliceGridCells`、`rasterize`、`quantizeToPalette`、`buildAtlas`、`decodePNG`/`encodePNG`、`backgroundCoverage` | `import*.test.ts`、`sheet-grid.test.ts`、`raster.test.ts`、`despill.test.ts`、`pack-frames.test.ts` 等 | **复用只读部分**（解码/图集读取）；不要修改生成行为 |
| `packages/assets/src/review.ts:24,100` | `packContactSheet` 把包内帧拼成联系表；`reviewPack` 做一次**付费**视觉差异观察（不评分、不阻断） | `packContactSheet`、`reviewPack` | `packages/assets/tests/review.test.ts` | **不涉及**（零付费）；其联系表代码可给人眼验收复用 |
| `packages/qa/src/assemble.ts:73-101`；`qa/src/visual.ts:29-36` | `qaRunner` 并发跑三族，拼 6 条判据（`layer-coverage` 由装配期保证，故 `checked` 恒 5/6）与两条观察；只返回 `QAReport`，落盘归 pipeline | `qaRunner`、`QaContext`、`QAReport` | `packages/qa/tests/*.test.ts`（本轮 `assemble.test.ts` 10 用例通过） | **可复用判据思路，但不适合承载完整验收**：白名单只有 `contracts`，够不着 PNG/demo/runtime（`visual.ts:29-36`） |
| `packages/demo/src/world.ts:90-196`；`draw.ts:143-185` | 纯层：把 (manifest, game-config) 读成场景描述；`resolveDraw` 解引用；`atlasList` 是图集加载路径的唯一拼接处；**绝不抛**，坏数据变占位符 + issues | `buildWorld`、`resolveDraw`、`atlasList`、`WorldDescription` | `packages/demo/tests/world.test.ts`（本轮 23 用例通过）；`player.anims` 逐帧名断言在 `world.test.ts:109-115` | **复用**；这是运行时验收最好的纯层观测面（可在 vitest 里断言动画帧映射） |
| `packages/demo/src/shell/entry.ts:44-85`；`shell/scene.ts:33-35,89-92,130-142,179-197` | Phaser 运行时：读 `site.json` / manifest / config → `buildWorld` → Phaser；`preload` 用 `load.atlas`；玩家按 idle/run/jump **显式映射** `play`；多帧实体用 manifest 帧名建动画 | `createScene`、`SHELL_VERSION`、`VIEWPORT` | 只有源码见证测试（`shell-scene-wiring.test.ts`、`shell-capability-witness.test.ts`），没有真实浏览器断言 | **复用/加探针**；Phaser 在 node vitest 里 import 不了，真实播放需 probe/CDP（§6.2） |
| `packages/demo/src/site.ts:167-245`；`assemble.ts:53-66`；`layout.ts:75-119` | 站点装配：schema + 引用族 + 几何族 + 屏幕空间硬失败；摆 `index.html/shell.js/site.json/game-config.json`；绝不覆盖版本 | `assembleSite`、`assembleFromConfig`、`assembleTdSite`、`laySite` | `site.test.ts`（本轮 24 用例通过）、`td-site.test.ts` | **复用**；Phase 1 若要装配验收站点，输出根必须改到 `.scratch/.../runs/`，不能用默认 `out/` |
| `packages/pipeline/src/create-game.ts:250,417`；`pipeline/src/index.ts:3-12` | 唯一串起理解层/构建层的包：`runUnderstanding` 五步、`runBuild`（pack → config → QA）；**不依赖 demo**，站点由壳层接第三步 | `runUnderstanding`、`runBuild`、`qaRunnerOf` | `packages/pipeline/tests/create-game.test.ts`、`run.test.ts` | **不涉及**（验收编排放壳层；改 pipeline 会增加一条不必要的能力边） |
| `packages/cli/src/cli.ts:6-18,470-613` | 薄壳：`parseArgs` + 命令 switch + 退出码翻译 + 人类/JSON 渲染；`create` 可停在清单检查点；`site` 走 `assembleFromConfig` 按 format 分派 | `run(argv)`、`parseArgs`、`CommandResult` | `packages/cli/tests/cli.test.ts`（本轮 20 用例通过）、`cli-create.test.ts`、`inspect-digest.test.ts` | **Phase 1 编排入口的首选**（见 §7） |
| `packages/mcp/src/server.ts:9-17,70-194,229-328` | MCP stdio 薄壳：7 个工具、`tools/call` 分派、`notifications/progress`、`structuredContent`；不 shell out | `TOOLS`、`handle` | `packages/mcp/tests/server.test.ts`（本轮 8 用例通过）、`build-pack-stdio.test.ts`、`create-game-no-digest.test.ts` | **可选**；若要求 agent 侧也能验收，需新增 tool；当前能力面窄于 CLI |
| `scripts/check-deps.mjs:16-54` | 静态依赖方向守卫：读各包 `package.json.dependencies`，对照 `ALLOWED` 图；违规退出 1 | `ALLOWED`、`node scripts/check-deps.mjs` | 无独立测试；本轮直接执行 exit 0 | **修改成本低但必须同步**；新增 package 时必须先在这里表态 |
| `packages/demo/probe/smoke.mjs:1-30`；`smoke-td.mjs`；`packages/assets/probe/td-hit-rate.mjs:20-26` | 不进 CI 的真浏览器 / 真上游探针；smoke 会写 `out/__probe*`，td-hit-rate 会花钱 | CLI 脚本 | 无 vitest 覆盖 | **只作模式参考**；Phase 1 不可直接跑（写 out / 付费），需参数化输出与零付费模式 |

## 3. 依赖守卫：实际允许 / 禁止的边（Q7 的前置）

### 3.1 规则

`scripts/check-deps.mjs:16-31` 的 `ALLOWED` 图是唯一事实：

| 包 | 允许依赖的兄弟包 | 关键禁止边 |
|---|---|---|
| `contracts` | 无 | 任何兄弟包 |
| `assets` | `contracts` | `assets → demo`、`assets → pipeline` |
| `demo` | `contracts` | `demo → assets`（A/B 互相独立的结构化落点） |
| `vision` / `game-design` / `qa` | `contracts` | 三者彼此、`→ assets`、`→ demo` |
| `pipeline` | `contracts` · `assets` · `vision` · `game-design` · `qa` | `pipeline → demo`（站点不在 pipeline） |
| `cli` | `contracts` · `assets` · `demo` · `pipeline` | `cli → mcp` |
| `mcp` | `contracts` · `assets` · `demo` · `pipeline` | `mcp → cli`（R5：不 shell out） |

执行语义（`check-deps.mjs:38-54`）：

- 只遍历 `pkg.dependencies`，外部依赖与 `devDependencies` 不管（`:46-47`）；
- 未在 `ALLOWED` 里的新包直接报错（`:45`）；
- `ALLOWED` 里有但 `packages/` 下没有的包也报错（`:51`）；
- 有错误 ⇒ `console.error` + `process.exit(1)`（`:53`）；全部通过 ⇒ 打印 `✅ 依赖图合法（N 个包）` 并退出 0。
- 本轮实测：`node scripts/check-deps.mjs` → exit 0，输出 `✅ 依赖图合法（9 个包）`。

### 3.2 它没有守到的三处（证据弱点）

1. **只读 `package.json`，不读源码相对路径 import**。`packages/assets/probe/td-hit-rate.mjs:21-24` 自己写着：相对路径跨包 import 会“悄悄通过”，因为守卫只读 `package.json`。
2. **不读 `tsconfig` project references**。`packages/cli/tsconfig.json:13-23` 与 `packages/mcp/tsconfig.json:13-23` 都只 references `contracts/assets/demo`，但两个包的 `package.json` 都依赖 `pipeline`（`cli:17`、`mcp:17`），源码也确实 import 它（`cli.ts:17`、`server.ts:15`）。这是**已存在的设计不一致**；本轮未运行 `tsc -b` / `pnpm typecheck`（按票边界），因此**它对构建的实际影响未验证**。
3. **不校验“所有 import 都有声明”**——声明缺失由 pnpm 的严格 node_modules 挡，不是这个脚本。

结论：新增验收能力若只依赖 `contracts/assets/demo` 的既有能力，**不会造成新的跨 package 边**；一旦新增 package，必须同时改 `package.json`、`tsconfig.json` references、`check-deps.mjs` 三处，否则会出现“守卫绿但类型图不一致”的同款漂移。

## 4. 资源格式、运行时与数据流（Q2–Q4）

### 4.1 格式家：`contracts`

- 交付侧：`assetpack/v4`（`assetpack.ts:57`），由 `AssetPackManifest`（`:265-333`）描述；动画是 `Animation{name, frames:string[], fps?, loop}`（`:157-162`），帧是 `FrameRef{name, index?, durationMs?}`（`:150-155`）；**帧的真实 x/y/w/h 只在 `delivery/atlas.*.json`**（原则见 `assetpack.ts:9-16`）。
- 输入侧：`asset-recipe/v1`（`recipe.ts:17`）、`AssetSpec` / `AnimationSpec`（`asset-spec.ts:68-86`，`frames` 是**数量**）、`asset-plan/v1`。
- 关卡侧：`game-config/v1`（`game-config.ts:29`）、`td-config/v1`（`td-config.ts:33`）。
- 运行侧：`RuntimeProfile` 与 `GameConfig` 的语义接口也在 `contracts`（`packages/contracts/src/index.ts:118-142`）。

### 4.2 生成 / 处理 / 验证的实际位置

- **生成**：
  - 规划：`assets/ops.ts:249` `planAssets`（模型输出 `asset-recipe` + plan sidecar；`planner-masters.ts` 补母版）；
  - 打包编排：`assets/pack.ts:307` `buildAssetPack`；
  - drawlist 生成：`assets/generate.ts:100`；生图客户端：`assets/image-gen.ts:159/394/576`；提示词：`assets/prompt.ts`；
  - 两条生成路径的差异在 `recipe.ts` 的 `DrawlistSource` / `ImageSource` / `ImportSource`（`recipe.ts:36-80`）。
- **处理**：`import.ts:315` 切导入图；`sheet.ts:175/192` 分割模型画的横排；`raster.ts:120` drawlist→RGBA；`quantize.ts:19` 色板量化；`atlas.ts:55` 拼 TexturePacker JSON；`png.ts:29/44` 编解码；`coverage.ts` 算背景覆盖。所有“像素”都在 `assets`，这是 `demo` 拿不到的（`site.ts:193` 自白“没有 PNG 解码器”）。
- **验证**：见 §6。简言之：schema/纯判据在 `contracts`；包完整性在 `assets/ops.verifyPack`；观察在 `assets/ops.inspectPack`；运行链判据在 `qa`；装配期硬失败在 `demo/site.ts`。

### 4.3 运行时：`demo`

`buildWorld(manifest, config)`（`world.ts:90`）是零 DOM / 零 Phaser 的纯描述层；`shell/entry.ts:44` 读 `site.json` / manifest / config 并把 `buildWorld` 的结果交给 Phaser；`shell/scene.ts:33-35` 用 `load.atlas` 加载图集，`:179-197` 用 manifest 帧名创建玩家动画并 `play("idle")`，`:89-92` 按输入切 run/jump；多帧实体在 `:130-142` 用 manifest 帧名建 `repeat:-1` 动画。`site.ts:167` 负责装配并做 schema + 引用/几何/屏幕空间硬失败。

**注意（验收相关的事实，不在本票判定范围内）**：运行时**没有读** manifest 的 `fps` / `loop`；玩家动画写死 `frameRate: 6`（idle/jump）/ `10`（run），实体写死 `8`（`scene.ts:140,193`）。`FrameRef.durationMs` / `index` 在仓库里没有生产者（`pack.ts:1221` 只写 `{name}`），也没有消费者。这是“播放配置”层的真实缺口，建议 02/06 票把它纳入验收矩阵；本票只记录边界。

## 5. CLI / MCP 两个入口的差异（Q5，W1 已对 HEAD 复验）

### 5.1 共用部分

- 两个壳都**直接调 core**，不互相 shell out：CLI 导入 `assets/demo/contracts/pipeline`（`cli.ts:6-18`）；MCP 导入同一组（`server.ts:9-17`）。
- 机器输出同源：CLI `--json` 与 MCP `structuredContent` 都是 `CommandResult`（CLI `cli.ts:615`；MCP `server.ts:333-337`；测试 `server.test.ts:94-101`）。
- 错误携带同源：`ledgerOfError` / `failureDirOfError` 两边都按能力读（CLI `cli.ts:627-640`；MCP `server.ts:338-359`）。
- 进度协议不同：CLI stderr（`cli.ts:191`）；MCP `notifications/progress`（`server.ts:220-228`）。

### 5.2 差异表（HEAD 复验）

| 能力 | CLI | MCP | HEAD 证据 | 对 Phase 1 的含义 |
|---|---|---|---|---|
| 端到端创建 | `create [--yes]`，无 `--yes` 停在清单检查点 | `create_game`，总是跑完（等价 `create --yes`） | `cli.ts:486-489`；`server.ts:117-143,268-317` | 验收若需“先人看清单再跑”，只能走 CLI |
| 站点装配 | `site` → `assembleFromConfig`，按 config `format` 分派横版/塔防 | `create_game` / `assemble_site` → `assembleSite`，**不分派** | `cli.ts:575-591`；`server.ts:287,318-325`；`demo/assemble.ts:53-66` | MCP 不能装塔防站点；Phase 1 若覆盖 TD，需新 tool 或参数 |
| 塔防编译 | `compile-td-game` | **无** | `cli.ts:560-573`；`server.ts:70-194` | MCP 能力面缺一整条链 |
| 事后视觉抽查 | `review <run>`（付费、人工主动、不进链） | **无** | `cli.ts:603-610`；`server.ts` 无 `reviewRun` 导入 | 零付费 Phase 1 不应依赖 |
| 打包参数 | `--visual-world` / `--version` / `--concurrency*` | 均无 | `cli.ts:524-541`；`server.ts:90-106` inputSchema | MCP 永远用默认并发/自算版本 |
| 编译参数 | `compile-runtime` 传 `viewport` + `hudLineHeight` | 只传 `viewport` | `cli.ts:549-557`；`server.ts:258-266` | 今天 `hudLineHeight` 两处默认同值，但是第二份事实源；W1 的这条仍成立 |
| 参考图路径 | `styleRefOf` 把 `--style` 转成相对 cwd | `create_game` 原样传 `String(args.stylePath)` | `cli.ts:188-189,482`；`server.ts:273`；`visual-world.ts:90-95` 拒绝绝对路径 | 绝对路径会在 `analyzeReference` 前被契约拒；测试 `create-game-no-digest.test.ts:112-117` 只覆盖了相对路径，未覆盖绝对路径 |
| 错误翻译 | `asCommandError` 把理解层异常按形状翻成 3/4 | **无**，裸 Error 一律 `_exitCode:1` | `cli.ts:207-218,617-641`；`server.ts:338-360`；`exitCodeOfError` `command.ts:88` | 两个壳的退出码语义不一致；W1 的这条仍成立 |
| 生图 warning | `resolveImageTransport(...).warnings` 逐条 stderr | `imageTransportOf()` 只取 `.transport`，warning 丢弃 | `cli.ts:513-515,527-528`；`server.ts:65-67` | 配置错误在 MCP 侧更安静 |
| 参数校验 | `parseArgs` 手写、重复 flag 报错 | `inputSchema` 仅描述，`handle` 直接 `String(args.x)` | `cli.ts:78-105`；`server.ts:218-328` | 类型错误最终由 core 报 usage，MCP 无 schema 前置校验 |
| 工具数量 | 10 个命令（`cli.ts:20-66`） | 7 个工具（`server.ts:70-194`，测试 `server.test.ts:61-69`） | 同上 | README 仍写“六个工具”（`README_zh.md:206`、`README.md:208`），**与代码不一致**；W1 未点出这一条，本轮补上 |

### 5.3 W1 复验记录（只列本报告实际用到的结论）

| W1 结论（基线 `ea53240`） | HEAD `f0dac01` 复验 | 状态 |
|---|---|---|
| 主链两段：`runUnderstanding` 在清单处停、`runBuild` 从磁盘读回 | `cli.ts:486-495`；`pipeline/create-game.ts:250,417,422-435,497-502` | 成立 |
| 站点不在 pipeline；站点由 CLI/MCP 串第三步 | `pipeline/package.json:13-19` 无 demo；`pipeline/src/index.ts:3-4`；`cli.ts:224-248`；`server.ts:287-293` | 成立 |
| CLI 走 `assembleFromConfig`；MCP 直接 `assembleSite`，塔防只能走 CLI | `cli.ts:584`；`server.ts:287,319`；`demo/assemble.ts:53-66` | 成立 |
| MCP 7 个工具（不是 README 的 6 个） | `server.ts:70-194`；`server.test.ts:61-69`；README 仍写 6 | 成立，且发现文档漂移 |
| MCP 无 `asCommandError`，裸 Error → 1 | `server.ts:338-360`；`cli.ts:207-218`；`command.ts:88` | 成立 |
| MCP `create_game` 的 `stylePath` 未相对化 | `server.ts:273`；`visual-world.ts:90-95`；测试只覆盖相对路径 | 成立（无绝对路径测试） |
| MCP `compile_runtime` 不传 `hudLineHeight` | `server.ts:258-266`；`cli.ts:549-557`；`ops.ts:813-814` | 成立（今天默认同值） |
| MCP 无 TD / review / 并发参数 | `server.ts` 工具面（`:70-194`）与分派（`:229-328`） | 成立 |
| pipeline 够不着 demo | `pipeline/package.json:13-19`；`pipeline/src/index.ts:3-4`；`check-deps.mjs:25-28` | 成立 |

W1 里关于 RuntimeProfile 分派、版本号分配、失败现场与退出码 0–4 的结论，本票只**部分复验**（用到退出码与 `CommandError` 形状：`command.ts:46,67-88`）；未把它们扩写成新的结论，避免越过 A 票范围。

## 6. 可直接复用的验证入口（Q6）

### 6.1 入口清单

| 入口 | 位置 | 实际检查什么 | 不检查什么 | 失败语义 |
|---|---|---|---|---|
| `verifyPack` | `assets/ops.ts:1662-1727` | manifest schema；`files[]` 每文件的 size + sha256；磁盘上未登记文件；`ledger.json` / `master-ratios.json` schema 与包身份 | 图集 JSON 内容；manifest 帧名是否真在图集；帧边界是否落在图内；动画 fps/loop 是否合理；运行时能否播放 | `CommandError("invalid")` → 4；不是包 → usage 2 |
| `inspectPack` | `assets/ops.ts:1900-1958` | manifest schema；解 PNG 后的色板用色 / 色板外像素 / 背景层覆盖率 / 源图→目标尺寸 | 不校验 checksum；缺图集帧时 `if (!fr) continue` 静默跳过（`:1771-1773`） | schema 错 → 4；否则 0（观察） |
| `qaRunner` | `qa/assemble.ts:73-101` | 5/6 判据：`constructive-constraint`、`palette-binding`、`reference-resolution`、`reachability`、`intent-coverage`；两条观察（inspect/review） | PNG 像素、demo 几何、真实运行（白名单只有 contracts，`qa/src/visual.ts:29-36`）；`layer-coverage` 由装配期负责 | 族抛 ⇒ 硬失败；否则返回报告，`qaVerdict` 由 `contracts` 派生 |
| `auditAssetSpec` / `checkSize` | `contracts/audit.ts:24-84` | spec ↔ 产物的 kind/size/动画名/帧数/drawlist viewBox | 图集实际帧内容；运行时 | 返回 `string[]`，由调用方决定是否阻断 |
| `auditGameConfig` / `auditTdConfig` / `auditLayerCoverage` / `auditScreenSpace` / `auditReachability` | `contracts/game-config.ts:388`、`td-config.ts:381`、`layer-coverage.ts:94`、`screen-space.ts:49`、`reachability.ts:44` | 引用族、自洽、层覆盖、HUD 屏幕空间、静态可达性 | 真实物理/真实浏览器；像素级外观 | 返回 `ConfigIssue[]`；`assembleSite` 将 error 变硬失败 |
| `assembleSite` | `demo/src/site.ts:167-245` | 包/config schema + 引用族 + 几何 + 屏幕空间；不通过则不建站点目录 | 运行时实际播放；pack 内部完整性（checksum 是 `verify` 的事） | `CommandError("invalid")` → 4；缺输入 → 2 |
| `buildWorld` | `demo/src/world.ts:90-196` | 把 (manifest, config) 读成场景描述；逐帧动画名映射；坏数据 → issues + 占位符，**不抛** | 实际渲染；Phaser 加载 | 永不抛；调用方读 `issues` |
| shell runtime | `demo/src/shell/entry.ts:44-85`；`scene.ts:33-35,130-142,179-197` | 真正加载图集、创建并播放动画（静态源码可证；真实浏览器需 probe） | 无自动断言；Phaser 在 vitest 里不可 import | 页内 console.warn / 占位符；无进程退出码 |
| probe 脚本 | `packages/demo/probe/smoke.mjs:1-30`；`smoke-td.mjs`；`assets/probe/td-hit-rate.mjs` | 真 Chrome 打开站点；塔防 `?auto=1` 快照；提示词命中率（付费） | 不在 CI；smoke 写 `out/__probe*`；td-hit-rate 花钱 | 脚本自行 exit；不是仓库验收契约 |

### 6.2 关键缺口（对“动画验收”而言）

1. **`verify` 是完整性校验，不是动画结构校验**。它只解析 manifest，不打开 `delivery/atlas.*.json`（`ops.ts:1662-1727` 全文无 `atlases[].meta` 读取）；manifest 的 `Animation.frames` 与图集帧名是否一致、帧矩形是否越界，**只有 `pack` 在生成时由同一份数据构造**，之后没有独立复核。一个“manifest + atlas 一起改、checksum 重算”的包会过 `verify`。这不是说现有包有问题，而是说**验收不能只调 `verify`**。
2. **`inspect` 是观察，不是门**，且缺失图集帧会静默 `continue`（`ops.ts:1771-1773`）。它适合汇总报告，不适合当通过/失败判据。
3. **`qa` 受白名单限制**：`qa/src/visual.ts:29-36` 明确写着 PNG 解码器 / `inspectPack` / `auditGeometry` 都够不着；因此任何需要像素或 demo 几何的动画检查不能直接放进 `qa`。
4. **运行时播放没有仓库内自动证据**：`shell/scene.ts` 的动画代码只有源码见证测试（`shell-scene-wiring.test.ts`、`shell-capability-witness.test.ts`），没有 Playwright/vitest 浏览器断言；probe 脚本可跑但写 `out/` 且不进 CI。Phase 1 若要做“动画真的播了”，需要新的运行时探针（CDP/Chrome）与独立输出根，不能把现有 smoke 原样搬进门禁。
5. **报告/基线**：仓库没有“动画验收报告 / 基线比较”契约；`qa-report/v1` 是**一次运行**的报告（`contracts/src/qa.ts` 文件头），不是跨版本 baseline。此条 status = `missing`（属于 04/07 票的范围；本报告只给出落点约束）。

## 7. Phase 1 落点建议（Q7）

### 7.1 推荐的最小结构

| Phase 1 能力 | 推荐落点 | 理由（结构性证据） | 不应放哪里 |
|---|---|---|---|
| 动画/图集/包的确定性结构检查、基线 checksum、帧引用与边界复核 | `packages/assets`（扩展 `ops.ts` 或新增 `acceptance.ts` 并 `assets/src/index.ts` 导出） | 已有 `parseAssetPack`、PNG 解码、图集 JSON 读取（`inspectPack` 的 `paletteUsage`/`coverage`）、`verifyPack`；CLI/MCP 已经依赖 `assets`（`check-deps.mjs:18,29-30`） | `qa`（只有 contracts）、`demo`（无 PNG 解码器，`site.ts:193`） |
| 运行时动画播放探针（加载站点 → 触发 idle/run/jump → 采样/截图/日志） | `packages/demo`（纯层 `buildWorld` + 新的 `probe/` 或导出探针辅助） | `demo` 是运行时与站点装配的唯一家（`demo/src/index.ts:1-20`、`world.ts:90`、`shell/scene.ts`）；纯层可在 vitest 断言帧映射，真实播放用 Chrome/CDP 脚本 | `pipeline`（无 demo 边，`pipeline/src/index.ts:3-4`）、`assets`（不能依赖 demo，`check-deps.mjs:18-19`） |
| 验收报告 / 基线 schema | `packages/contracts` | 所有包都依赖 `contracts`；`qa-report/v1` 已住这里（`contracts/src/qa.ts`），新 schema 放同一处可避免第二套账本；若复用 `qa-report/v1` 则无需新 schema | `assets` 或 `demo` 私有类型（另一个壳会读不到，形成第二份事实） |
| 编排（跑包检查 + 装站点 + 起浏览器 + 汇总） | `packages/cli`（必要时 `mcp` 加 tool） | 只有 `cli` / `mcp` 被允许同时依赖 `assets` + `demo` + `pipeline`（`check-deps.mjs:29-30`）；CLI 的 `create --yes` / `build` 已经示范“core 办事、壳串第三步”（`cli.ts:224-248`） | 不要写在 CLI 的业务判断里（`cli.ts:2-3` 的薄壳纪律）：编排可以，判定与检查必须在 core |
| 可选的独立验收库 | 新建 `packages/acceptance`（consumer layer，依赖 `contracts` · `assets` · `demo` · `qa` · `pipeline`） | 如果 CLI 与 MCP 之外还有调用者，或验收要作为 npm 包导出，才值得新包；**不制造 `assets ↔ demo` 边**，A/B 独立仍成立；但要同步三处配置 | 不要把它塞进 `qa` / `assets` / `demo` 来“省一个包” |

### 7.2 为什么不是 `qa`

`qa` 现有判断力强、报告契约完整，但它的白名单只有 `contracts`（`qa/src/index.ts:1-2`、`packages/qa/package.json:13-15`）。`qa/src/visual.ts:29-36` 自己列出了够不着的东西：PNG 解码器 / `inspectPack` / `auditGeometry`。要让它做动画像素/运行时检查，必须加 `assets` + `demo` 依赖，直接违背票 07 定的边界，并会把 QA 从“运行后的判据族”变成“什么都做的验收包”。因此：**manifest 级别的集合差可以复用 qa 的思路，但完整验收不应落在 qa。**

### 7.3 为什么不是 `pipeline`

`pipeline` 的依赖图明确没有 `demo`（`packages/pipeline/package.json:13-19`；`pipeline/src/index.ts:3-4` “它够不着 demo”）。站点装配在 CLI/MCP（`cli.ts:224-248`、`server.ts:287-293`）。把运行时验收塞进 pipeline 会新增 `pipeline → demo`，这条边今天不存在、也没有必要。

### 7.4 基线冻结的落点约束

- 仓库的“基准件”约定在 `fixtures/`（`README_zh.md:35,234`）；`out/` 全部 gitignore。 **可入库的冻结基线应放 `fixtures/`（或仓库已跟踪的 `.scratch` 归档），而不是 `out/`。**
- 本轮实际核到 v7 包位于 `.scratch/asset-integration-v1/runs/2026-10-20f-lurker/ruin-scavenger-extraction-assets/pack/v7`，且 `git ls-files` 显示它**已被跟踪**（不是 ignored 的临时产物）；但“它是否作为 Phase 1 冻结基线”属于票 04/09，不在本票替你定。若选它，必须配 checksum / 版本钉住，且 Phase 1 只读。

## 8. 本轮实际执行的证据

在本票边界内（定向测试 + 只读 verify/inspect + 只读依赖守卫）：

| 命令 | 结果 |
|---|---|
| `node scripts/check-deps.mjs` | exit 0；`✅ 依赖图合法（9 个包）`（规则见 `scripts/check-deps.mjs:16-54`） |
| `pnpm exec vitest run packages/contracts/tests/assetpack.test.ts packages/assets/tests/inspect.test.ts packages/assets/tests/pack-selfcheck.test.ts packages/demo/tests/world.test.ts packages/demo/tests/site.test.ts packages/qa/tests/assemble.test.ts packages/mcp/tests/server.test.ts packages/cli/tests/cli.test.ts` | exit 0；8 files / 138 tests passed（`/tmp/t01-vitest.log` 为本轮日志） |
| `node packages/cli/dist/cli.mjs verify fixtures/packs/last-train/v2` | exit 0；`31 个文件的 checksum 全部对得上`，来源 generated，无 ledger（老包） |
| `node packages/cli/dist/cli.mjs inspect fixtures/packs/last-train/v2` | exit 0；9 资源 / 8 色，背景三层覆盖 100%/31.2%/20.0%，色板外 1.21%（观察） |
| `node packages/cli/dist/cli.mjs verify .scratch/asset-integration-v1/runs/2026-10-20f-lurker/ruin-scavenger-extraction-assets/pack/v7` | exit 0；`157 个文件的 checksum 全部对得上`，来源 mixed |
| `node packages/cli/dist/cli.mjs inspect .../pack/v7` | exit 0；inspect 报 19 资源 / 4 图集（manifest 统计：76 帧 / 61 动画帧；idle 4、run 8、jump 4；敌人/潜伏者等），输出见 `/tmp/inspect-v7.txt` |

未执行（按票边界）：`pnpm check`、`pnpm build`、`pnpm typecheck`、全量 `pnpm test`、任何 `out/` 生成命令、任何付费上游调用、仓库外的站点重建。

## 9. 证据弱点 / 未验证项

1. **W1 基线不同**：W1 是 `ea53240`；本报告只在 `f0dac01` 上复验了 §5.3 列出的那些结论，未把 W1 的其他结论（RuntimeProfile 分派、版本号分配全表、失败现场细节）当作已实现继承。W1 的行号也与 HEAD 不同。
2. **没有跑全量测试**：只跑了 8 个定向测试文件（138 用例）。全量由票 08 负责；因此“测试体系整体可行”不能由本票单独下结论。
3. **`packages/cli/dist` 是 gitignored 的构建产物**（`.gitignore:5`；目录时间戳 2026-10-21）。上面的 `verify` / `inspect` 真实运行证明的是“这个已存在的 bundle + fixtures 能工作”，**不等于**从 HEAD 干净源码重新构建的产物；本票按边界没有跑 `pnpm build`。源码侧结论以 `packages/*/src` 与 vitest 为准。
4. **依赖守卫的盲区**：只读 `dependencies`；`cli` / `mcp` 的 tsconfig references 漏 `pipeline`（§3.2）；相对路径 import 可绕过（`td-hit-rate.mjs:21-24` 自己承认）。这是 `partial` 的守卫，不是 `implemented` 的“全类型图守卫”。
5. **`verify` 不核对图集内容**：只验 schema/checksum/files 覆盖（`ops.ts:1662-1727`）；`inspect` 对缺失图集帧静默跳过（`:1771-1773`）。因此“包过 verify”不等于“动画帧引用/边界正确”。这是 §6.2 的核心缺口，需要在 Phase 1 用新的结构检查补上，而不是修改 `verify` 的既有语义（`ops.ts:1661` 明写它只做 schema + checksum）。
6. **运行时 fps/loop 未接入**：manifest 有 `Animation.fps/loop`（`assetpack.ts:157-162`），但 `scene.ts:140,193` 写死 `frameRate` 且 `repeat:-1`；`FrameRef.index/durationMs` 无生产者/消费者。该事实属于动画播放验收的候选缺口，本票只记录，未判定由哪张票修。
7. **README 与代码不一致**：MCP 实际 7 个工具（`server.ts:70-194`；`server.test.ts:69`），README 中文/英文写 6 个（`README_zh.md:206`、`README.md:208`）。这是任务书 §5.5 类“设计不一致”，不是功能缺失。
8. **MCP 的部分差异没有测试覆盖**：`stylePath` 绝对路径（测试只给相对路径，`create-game-no-digest.test.ts:112-117`）、`hudLineHeight` 缺省、TD/review 缺失、并发参数缺失。它们是源码事实（E1），但没有 E2 逐条钉住。
9. **probe 脚本不能直接用于 Phase 1 门禁**：`smoke.mjs:25` 固定写 `out/__probe`，`td-hit-rate.mjs` 会付费；本轮没有运行它们（票 Q3 允许的是现有 `site/v3` + CDP，且截图/日志写 `.scratch/.../runs/`）。Phase 1 若复用，必须先参数化输出根与零付费模式。
10. **未验证的构建影响**：`tsconfig` references 缺 `pipeline` 是否会让 `pnpm typecheck` / `tsc -b` 失败，本票按边界没有跑；标记为 `unverified`，不要把它写成 `missing` 或 `implemented`。
