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

## Not yet specified

- **像素阈值的具体数值、误伤 / 漏放边界** —— 提案已出、**等用户逐字裁定**：
  [03. 像素指标测量](issues/03-p0-05a-pixel-metrics-measurement.md) →
  [pixel-metrics-distribution.md](research/pixel-metrics-distribution.md)。
  长宽比建议 `|ΔAR| ≥ 25%`；色板外 A（25%，v7 通过 / health-icon 漏放）vs B（10%，v7 失败）待选；
  覆盖率建议保持 observation。裁定后由 [04](issues/04-p0-05b-pixel-threshold-criteria.md) 落地。
- **可玩 smoke 的稳定性策略**（状态轮询、超时、失败阶段报告）—— 07 完成后在 10 内定。

## Out of scope

- **P0-FINAL 付费 E2E**（Q1 A）：另立付费 effort；未完成时终点文案必须带限定。
- **P1 / P2 共 42 条**：见 P0-00 §6；不因施工顺手扩入。
- **`import` 三入口、六类语义路由、新增 `source.kind` / route**。
- **多关、HP / 失败态、完整胜负原语、通用 `motion`**。
- **重写流水线 / Pack / `raster.ts` / 图像客户端**。
- **自动修复 / 自动重生成 / 重试循环**。
- **Playwright / Puppeteer / CI 重构**（P0-03 只用系统 Chrome + CDP）。
- **CLI / MCP 全等价（TD / review / 并发参数）** —— P2。
- **修改 `game-maker.local.json`**。
- **提交 / 推送** —— 每次单独授权。
- **修改既有 `CONTEXT.md` 改动与无关 `.scratch` 旧 run**。
