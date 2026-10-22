# P0 施工：让「风格图 + 意图 → 可玩 Demo」可被真实验收

Labels: wayfinder:map
Tracker: local-markdown
Effort: p0-construction-v1

> **本图 2026-10-21 开。**输入：[docs/v4/P0-00-p0-scope.md](../../docs/v4/P0-00-p0-scope.md)
> （13 条 CAP / 6 个施工包 / P0-FINAL 另立）。本图**承载施工**（覆盖 wayfinder「只规划」默认）。
> 第 1/2 轮裁定 Q1–Q9 全部 A，边界逐字见 Notes。
> ⚠️ 本图**不提交、不推送、不付费**；完工停在等待单独授权状态。

## Destination

P0-01…P0-06 六个施工包完成并通过**程序级验收**：13 条 P0 CAP 中除 `CAP-E2E-01` 外的 12 条
满足 [P0-00 §5](../../docs/v4/P0-00-p0-scope.md) 的完成判据；`pnpm test` / `pnpm typecheck` /
`pnpm build` 全绿，`pnpm test:playable` 通过；验证证据落 `.scratch/p0-construction-v1/runs/`。
终点书面记录 **「单跑 E2E（P0-FINAL）未完成」**，不得出现无条件的「P0 全部验收通过」。

**不含**：P0-FINAL 付费单跑、P1/P2 的 42 条、提交 / 推送。

## Notes

- **基线**：分支 `p0-construction-v1`，自 `animation-acceptance-v1-phase-0` @ `70631af` 新建（Q3 A）。
  `main` 不动。工作树既有 `CONTEXT.md` 改动与未跟踪 `.scratch` 原样保留。
- **输入**：`docs/v4/P0-00-p0-scope.md`（范围与验收口径）；
  证据表 `docs/v4/P0-00-capability-gap-audit.md`；支撑 `P0-00-call-graph.md` / `P0-00-test-matrix.md` /
  `P0-00-e2e-evidence.md`。
- **第 1 轮裁定（2026-10-21，逐字）**：「裁定：Q1–Q5 全部选择 A，接受五项推荐。」
  - **Q1 A**：终点不含 P0-FINAL；终点 = 程序级判据全绿 + test/typecheck/build 全绿 +
    书面「单跑 E2E 未完成」；P0-FINAL 归 Out of scope / 另立付费 effort。
  - **Q2 A**：本图承载施工，每票交付代码 / 测试 + 验证证据。
  - **Q3 A**：从 `70631af` 新开 `p0-construction-v1`。
  - **Q4 A**：不提交、不推送；每票收口只交书面总结，提交 / 推送每次单独授权。
  - **Q5 A**：契约 / CLI / MCP / 新依赖变更，每票先交逐项清单，逐字点头后才动；未获批该票停住。
- **第 2 轮裁定（2026-10-21，逐字）**：「Q6–Q9 全部选择 A，接受四项推荐。」
  - **Q6 A**：11 票（9 施工 + 2 research + 1 最终验证）；依赖见各票 `Blocked by`。
  - **Q7 A**：像素阈值由人裁定 —— 03 只做免费测量与提案，用户逐字裁定后 04 才落实现。
  - **Q8 A**：`pnpm test:playable` 独立；默认 `pnpm test` 无浏览器依赖；最终验证必须跑它；
    Chrome 缺失 = 失败并记录，不跳过。
  - **Q9 A**：允许 `test` / `typecheck` / `build` / `check` / `check:deps`、只读 `verify` / `inspect`、
    对 v7 与 fixture 的 `site` 装配与 CDP、fake upstream 的 `create/pack` 测试；
    **禁止**任何真实上游 / 付费调用（`create` 无 fake、`understand`、`review`、视觉模型）、
    改 `game-maker.local.json`、改 v7 包与 fixtures；测试产物只写 `out/` 或
    `.scratch/p0-construction-v1/runs/`。
- **付费闸**：任何生图 / 文本 / 视觉调用须另出书面预算 + 逐次点头；本图零付费。
- **既有问题**：`pnpm check` 在 HEAD 有 2 条既有断链（`.scratch/asset-integration-v1/...`），
  只记录，不算本图引入，不在本图修复。
- **既有问题（2026-10-21 票 07 发现）**：CLI `accept` 负例测试每次 `mkdtempSync` 一个 ~89 MB 的
  `gm-cli-accept-findings-*` 目录且不清理；全量跑多次后触发 `ENOSPC`。票 07 清理 41 个既有泄漏
  （1.8 GB）后恢复；**测试卫生本身不在 P0 范围，未修**。票 11 跑全量前先看磁盘。
- **工作树纪律**：不执行 `reset` / `clean` / 覆盖式清理；不碰既有 `CONTEXT.md` 改动与无关 `.scratch`；
  v7 包与 `fixtures/` 只读。
- **并行**：同一工作树一次只开一票；并行施工只在独立 git worktree 中允许。
- **证据分级**：E0 推测 / E1 源码 / E2 测试 / E3 真实产物 + 运行证据（命令 + 退出码 + 路径）。
- **工作方式**：research 票由子代理并行跑，只写 `research/` 与各自票；施工票一次一票；
  地图 Decisions-so-far 由主会话统一追加。

## Decisions so far

<!-- the index: one line per closed ticket, enough to judge relevance, then zoom the link for the detail the ticket holds -->

- [06. [research] Phaser Arcade `body.reset` 语义与本仓物理设置](issues/06-r2-phaser-body-reset.md)：**已收口（research）** ——
  软锁根因不是「没清速度」（现行 `scene.ts:266` 已 `setVelocity(0,0)`），而是 `setPosition` 只动 GameObject、
  body 仍在旧位，同帧 `postUpdate` 把旧位移加到刚传送的精灵上；Arcade 防穿透窗口
  `overlap > |dy| + 4px` 拒绝分离 ⇒ 掉穿。900 px/s² / 60 Hz 下重置瞬间下落 ≳225 px/s 即触发
  （归档 `vy=300`、偏移 5.25 px）。推荐：`body.reset(spawn.x, spawn.y)`，再按重置后实际 `body.bottom`
  把脚底对齐到由 `world.terrain` + 静态 `solid` 算出的地面顶边；`reset()` 清速度/加速度/prev/touching，
  重复重置幂等。`world.terrain` 数据存在（`world.ts:66,131`）但可站立性从未校验（`game-config.ts:429,443-450`）。
  纯逻辑可钉地面/见证数据，真实不掉穿必须由 [10 可玩 smoke](issues/10-p0-03-headless-playable-smoke.md) 覆盖
  （Phaser 不能在 Node 导入）。证据：`research/phaser-body-reset.md`。
- [05. [research] site / assemble_site 与 QA 的接缝](issues/05-r1-site-qa-seam.md)：**已收口（research）** ——
  正常链上（`create --yes` / `build` / MCP `create_game`）QA 不缺上下文；独立 `site` / `assemble_site`
  只拿到 `packDir + configPath + outRoot`（`cli.ts:642-648`、`server.ts:203-213`），**没有 runDir**。
  就地重跑 QA（B）成本低但上下文不成立（默认合成器会因缺 recipe / intent / design 直接抛，
  至多 2/6）；`qa-report/v1` 只有 `format/checked/failures/observations`（`contracts/qa.ts:266-320`），
  **不含任何包身份**；`run-ledger` 无 `packVersion`；可靠身份 = `manifest.id + version`。
  实测：同一 run 的绿色报告对 pack v1 复跑出 16 条 reference 错误、对 v2 为 0 —— 报告无法自证属于哪个包。
  推荐 **A + C**：报告新增可选 `subject {packId, packVersion, manifestChecksum?}`（A），
  发布路径按身份查找/校验；out 树之外用显式 `--qa-report` / MCP `qaReportPath` 定位（C），但仍强制校验 subject。
  `2026-10-20e-site` 无 `qa-report.json` 是流程问题（out 树没有 `run/`，包与 config 都来自外部）。
  最小变更清单 11 项、残余风险 7 条见研究文件 §8.2 / §8.4；**票 09 仍须按 Q5 逐项报批后才动**。
- [01. P0-04 · 资产完整性链（覆盖闸 / verifyPack 入链 / 空色板前移）](issues/01-p0-04-asset-integrity.md)：
  **已收口（施工）** —— 三闸落链：① 覆盖闸 `designCoverageGate`（`assets/src/ops.ts:253`）在
  `planAssets` 重采样（`schema`，三发 ⇒ invalid/4）与 `runBuild` 的 `packAssets` 之前（`pipeline/src/create-game.ts:463`）
  各查一次，四桶 id 必须被资产 `spec.id` / `spec.characterId` **逐字**命中；用户裁定**严格全覆盖、无豁免**，
  规则已写进 planner 工具说明第 3 条。② `verifyPack` 入链（`create-game.ts:499`，pack 之后、
  config / QA / site 之前，只做一次；失败 invalid/4、不产下游产物、原包保留）。③ 空色板前移
  （共用 `emptyPaletteProblem` `ops.ts:276`；VWS 落盘后、`analyze-intent` 前 `create-game.ts:303`；
  单独 `plan` 入口 `ops.ts:319`；失败时账随异常、现场留 VWS）。无契约 / CLI / MCP / 新依赖变更；
  唯一夹具改动 = canned 配方补一件 `e-drone`（用户逐字批准），既有断言同步。`pnpm test` 1740 用例 /
  `typecheck` / `build` / `check:deps` 全绿；归档 10-17d、`fixtures/e2e`、canned 三对覆盖闸正例全 `null`；
  v7 `verify` exit 0（157 checksum）。证据：`runs/2026-10-21-ticket-01/`。CLI 端到端篡改用例不可注入，
  退 4 由共享映射断言 + 既有 CLI 用例佐证（见 Answer「诚实边界」）。
- [02. P0-06 · 静默降级与入口错误语义](issues/02-p0-06-no-silent-downgrade.md)：
  **已收口（施工）** —— ① `frames` 候选不再折叠成 `image`：`planAssets` 在路线决策前明确
  `invalid`/4（`assets/src/ops.ts:384`），不重采样、不落 recipe / sidecar、花费照记；`authoring[]`
  的 frames 契约本就拒。② `asCommandError` 从 CLI 搬进 `contracts/command.ts:103`，MCP catch
  先翻译（`mcp/src/server.ts:414`）⇒ 设计拒绝 4 / HTTP 3 / usage 2（此前前两档退 1）。
  ③ `styleRefOf` 搬进 `pipeline/create-game.ts:251`，MCP `create_game` 的绝对 `stylePath`
  与 CLI 同规则（`server.ts:344`），全链绝对路径用例通过。无契约形状 / CLI flag / MCP 参数 /
  新依赖变更（Q5 逐项清单已获逐字批准）。`pnpm test` 1744 用例 / `typecheck` / `build` /
  `check:deps` 全绿；证据：`runs/2026-10-21-ticket-02/`。

- [07. P0-01 · 运行时胜利判定与危险物软锁](issues/07-p0-01-runtime-win-hazard.md)：**已收口（施工）** ——
  ① 胜利目标在纯层唯一化：`EntityDesc.wins` 只对 `id === objective.gate` 的 goal 为真（`world.ts:177`），
  外壳只在 `e.wins` 上注册 `tryWin()`（`scene.ts:162`），其他 goal 照画不判。
  ② `hitHazard` 改 `body.reset(x, y)`，再按重置后真实 `body.bottom` 对 `floorY` 二次校正（`scene.ts:275-282`）；
  根因按票 06：`setPosition` 只动 GameObject、body/prev 留在旧位，同帧 `postUpdate` 叠加旧位移，
  且 `OVERLAP_BIAS=4` 拒绝分离 ⇒ 掉穿。③ `floorYOf` 纯函数：玩家盒底 → 地形 + 静态 solid 顶边
  （排除 `motion` / `draw.missing`），4px 浅埋抬回、坑退回作者脚线（`world.ts:105`）。
  红→绿：11 条新用例全部在 HEAD 上红（exit 1，11 failed / 25），新代码 36/36 绿；
  全量 `pnpm test` 1755 passed / `typecheck` / `build` / `check:deps` 全绿。
  **诚实边界**：纯层 + 源码见证只证「选对了实现」，真实不掉穿归 [10](issues/10-p0-03-headless-playable-smoke.md) 的 W6 CDP 用例。
  证据：`runs/2026-10-21-ticket-07/`。

- [03. P0-05a · 像素指标免费测量与阈值提案](issues/03-p0-05a-pixel-metrics-measurement.md)：**已收口（裁定）** ——
  用户逐字裁定：① **长宽比** `|ΔAR| ≥ 25% ⇒ error`，对全部 `sourceSizes`（含背景层、母版、精灵、动画）生效；
  `24.9%` 不触发 / `25.0%` 触发；无可用 `sourceSizes` = 「没跑」，不得判绿。
  ② **色板外采用 A+**：`share ≥ 25% 且 pixels ≥ 16 ⇒ error`；`share ≥ 10% 且 pixels ≥ 16 ⇒ observation`；
  边界 fixture 覆盖 `24.9/25.0`、`15/16 px`、`9.9/10.0`。③ 已知坏例处置：`health-icon`（41 px / 16.02%）
  与 `tile-wall`（29 px / 12.89%）**不阻断、必须作 observation** —— 这是对 P0-00 §3「41 像素」风险项的
  **明确降级**（observation / P1 收紧）；长宽比坏例 `+52.4% / +103.2% / +107.8%` 仍触发 error。
  ④ **背景层覆盖率不新增 P0 阈值**，保持 observation（由装配期 `auditLayerCoverage` 与票 08 的第 6 条判据承担）。
  ⑤ unavailable ≠ 通过（`last-train/v2`、`counter-siege/v4` 是已知样本）。票 04 边界：阈值集中一处、
  注明来源、补边界 fixture、不得扩到其他 QA / 发布策略 / 契约 / 依赖。裁定原文（含六条依据与边界）在票 03 Answer。

- [04. P0-05b · 像素阈值判据落地](issues/04-p0-05b-pixel-threshold-criteria.md)：**已收口（施工）** ——
  按票 03 裁定 A+ 落地：① 长宽比 `|ΔAR| ≥ 25%` ⇒ error，全部 `sourceSizes`（背景不豁免），
  `24.9%` 不触发 / `25.0%` 触发；② 色板外 `share ≥ 25% 且不透明像素 ≥ 16` ⇒ error，
  `10%–25%` ⇒ observation；`health-icon`（16.02%）/ `tile-wall`（12.89%）只作 observation；
  ③ 无 `sourceSizes` ⇒ 「没跑（unavailable）」；④ 覆盖率不新增 P0 阈值。
  阈值唯一落点 `qa/src/pixel.ts:26`；error 挂既有 `constructive-constraint` / `palette-binding`，
  **不新增第七判据**；pipeline 把 `InspectData` 喂给纯函数并用 `withPixelFindings` 在契约校验前挂回报告
  （`create-game.ts:554-575`）。红→绿：17 条新用例全红（17 failed / 44 passed），新代码 61/61；
  全量 `pnpm test` **1772 passed** / `typecheck` / `build` / `check:deps` 全绿。
  附带修正三个假上游按提示词目标比例出图（**仅测试夹具**；固定 512×270 会被新阈值判 -29.7% / -62.5%）。
  无 contracts / CLI / MCP / 依赖 / `inspectPack` 输出变更。证据：`runs/2026-10-21-ticket-04/`。

- [08. P0-02a · QA 跑满 6/6 判据](issues/08-p0-02a-qa-6of6.md)：**已收口（施工）** ——
  `layer-coverage` 由合成器**真跑**：`qa/src/layers.ts:48` 的 `layerCoverageJudgement` 读
  `QaContext.viewport` + 已落盘 config/manifest，调装配期**同一个** `auditLayerCoverage`
  （`contracts/layer-coverage.ts:137`）；入参来路也收成一处 `backgroundLayerEntries`
  （`:116`，`assets/src/ops.ts:1107` 共用）。`QaContext.viewport` 必填（`qa.ts:462`），
  pipeline 传 `input.viewport ?? DEFAULT_VIEWPORT`（`create-game.ts:575`，与 `compileRuntime` 同值）。
  finding 一层一条、target = `<背景 id>.<层名>`；解不到背景**不报**（引用族已报）。
  `checked` 5/6 → **6/6**、`qaVerdict` `incomplete` → `pass`；负例（坏层）+「删掉 runner 必红」
  源码见证 + 视口真被用上（960 宽）。全量 `pnpm test` **1779 passed / 115 files**、
  `typecheck` / `build` / `check:deps` 全绿；Q5 五项逐字批准。证据：`runs/2026-10-22-ticket-08/`。
  **诚实边界**：链上恒绿（compile-runtime 已先抛），坏例子只能手工改包构造。

- [09. P0-02b · 发布闸门统一](issues/09-p0-02b-publish-gate.md)：**已收口（施工）** ——
  采纳票 05 的 **A + C**：① `qa-report/v1` 增**可选** `subject {packId, packVersion, manifestChecksum?}`
  （`contracts/src/qa.ts:279`）；pipeline 在落盘前注入并**覆盖** runner 自带值
  （`create-game.ts:606`，checksum = sha256(manifest 原始字节)）。② 新共享闸
  `pipeline/src/publish-gate.ts:145` `assertPublishableQa`：无 subject / 身份不符 / checksum 不符 /
  error / incomplete（`checked<6`）全拒（`invalid`=4）；显式 `--qa-report` / `qaReportPath` 优先，
  否则只扫规范 out 树 `<out>/<packId>/run/v<N>/qa-report.json` 并按 subject 匹配；
  TD（`td-config/v1`）**显式跳过**（P2）。③ 五个发布入口全部在装配前接线：CLI `site`（`cli.ts:626`）、
  CLI `build`/`create --yes`（`cli.ts:227`）、MCP `assemble_site`（`server.ts:405`）、
  MCP `create_game`（`server.ts:366`）；`runBuild` 的 `assertQaPassed` 同步扩为 error + incomplete 都拒
  （`create-game.ts:227`），报告仍先落盘。`warning` 不阻断。红→绿：新增 4 个测试文件 + 31 条用例；
  全量 `pnpm test` **1810 passed / 119 files**、`typecheck` / `build` / `check:deps` 全绿；
  两条临时变异见证（去掉 incomplete 阻断 / 去掉 site 闸）均必红。Q5 逐字批准；另裁定 standalone
  `site` **不跑** `verifyPack`（字节完整性归 P0-04 链）。残余：只钉 pack 不钉 config、外部包需显式报告、
  库调用方不受闸、README fixture 快速开始改 TD（side-scroller 不能直接 site）。证据：
  `runs/2026-10-22-ticket-09/`。

- [10. P0-03 · 可玩性 headless smoke](issues/10-p0-03-headless-playable-smoke.md)：**已收口（施工）** ——
  新增独立 `pnpm test:playable`（根 `package.json`）+ `packages/demo/probe/playable-smoke.mjs`：
  Node 22 内置 WebSocket + 系统 Chrome 155 CDP，**零新依赖**；用已验收 v7 包 + 配套 config
  真实装配站点。状态探针沿用 W6：`window.Phaser` setter 上挂 Proxy ⇒ `window.__gmGame`，
  读 x/y/body.bottom/onFloor/blockedRight/collected/pickups/hazards/solids；输入全状态驱动。
  实跑（Chrome 155.0.8059.85）：正例 6.6 s 拾取 3/3 到 gate `won=true`；软锁专项两次
  「木箱顶起跳 → 空中撞 hazard → 重置」×30 帧采样，`bottom ≤ floorY+1`、`onFloor` 变真、
  `collected/won` 不变，静止脚线 250.00 / 250.00；旧实现负例按预期红（bottom 379.50）。
  三类负例各自 exit 1 并报阶段：gate 指错=`assemble`（装配期 invalid）、运行时拿掉 pickup=`win`、
  破坏输入=`move`。`pnpm test` 1810/119、`pnpm typecheck` 全绿；零付费；未改运行时 / v7 / fixtures；
  证据 `runs/2026-10-22-ticket-10/run.md`。

## Not yet specified

<!-- 当前没有尚未成票的雾：像素阈值已裁定并收口（见票 03）；前沿见 open 子票。 -->

## Out of scope

- **P0-FINAL 付费 E2E**（Q1 A）：另立付费 effort；未完成时终点文案必须带限定。
- **P1 / P2 共 42 条**：见 P0-00 §6；不因施工顺手扩入。
- **config 身份（`subject.configChecksum`）与 TD 的 QA 等价**：票 09 只钉 pack 身份；
  `td-config/v1` 的发布闸显式跳过 —— P0-02 票面如此，收紧 = P2。
- **`import` 三入口、六类语义路由、新增 `source.kind` / route**。
- **多关、HP / 失败态、完整胜负原语、通用 `motion`**。
- **重写流水线 / Pack / `raster.ts` / 图像客户端**。
- **自动修复 / 自动重生成 / 重试循环**。
- **Playwright / Puppeteer / CI 重构**（P0-03 只用系统 Chrome + CDP）。
- **CLI / MCP 全等价（TD / review / 并发参数）** —— P2。
- **修改 `game-maker.local.json`**。
- **提交 / 推送** —— 每次单独授权。
- **修改既有 `CONTEXT.md` 改动与无关 `.scratch` 旧 run**。
