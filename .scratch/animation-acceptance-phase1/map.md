# Animation & Asset Acceptance V1 · Phase 1 Tier 1 施工图

Labels: wayfinder:map
Tracker: local-markdown
Effort: animation-acceptance-phase1

> **本图 2026-10-21 开。**输入：[Phase 0 实施计划](../../docs/v5/phase-0-implementation-plan.md) §3.1 +
> Phase 1 第 1 轮裁定（Q1–Q8 全部 A，边界逐字见 Notes）。
> 本图**承载施工**（覆盖 wayfinder「只规划」默认），只做 Tier 1；
> **不提交、不推送、不付费、不重生成资源**，完工停在等待提交授权状态。
> ✅ **2026-10-21 完工**：01–10 全部 resolved；`pnpm test` 110 文件 / 1731 例、typecheck、build 全绿；
> v7 报告 `out/ruin-scavenger-extraction-assets/acceptance/v2/report.json`；停在等待提交/推送授权。

## Destination

Tier 1 施工完成并可机器复跑：`pnpm test` / `pnpm typecheck` / `pnpm build` 全绿
（`pnpm check` 的链接守卫若因既有断链失败，须单独记录为既有问题）；
`game-maker accept <v7 pack>` 输出结构验收报告（exit 0），baseline fixture 与回归/负例通过；
改动严格落在 Tier 1 文件清单内；书面总结已出，**停在等待提交/推送授权**。

## Notes

- **基线**：分支 `animation-acceptance-v1-phase-0` · `5be1fd2`（Phase 0 已推送未合并；`main` 不动）。
- **输入**：[Phase 0 实施计划](../../docs/v5/phase-0-implementation-plan.md) §3.1；Phase 0 Q1–Q8 全 A。
- **本轮 Q1–Q8 全 A（逐字边界）**：
  - **Q1 范围**：严格按 §3.1；含 CLI、MCP、基准回归、契约、指标和结构验收；不含 Tier 2。
  - **Q2 分支**：叠加在 `animation-acceptance-v1-phase-0` 上；`main` 不动。
  - **Q3 基准**：4 张 raw + 4 张 delivery + 32 色真实 Prompt + 34 色重建 Prompt + `baseline.json`。
  - **Q4 命令**：允许测试、类型检查、build/check 和验收验证；禁止付费调用及生成链。
  - **Q5 输出**：`out/<packId>/acceptance/v<N>/`（`report.json` + `report.md`）；`--out` 可覆盖；
    退出码 `0` 无 error findings / `1` 有 error findings / `2` 参数错 / `4` 包或基准不合法。
  - **Q6 提交**：完工后先交书面总结，等待单独授权；**本图不提交、不推送**。
  - **Q7 完成判据**：测试、类型检查、build/check、v7 验收、基准回归和负例全部通过。
  - **Q8 工作树**：不碰 `CONTEXT.md` 与既有 `.scratch` 内容；只处理本任务自己的文件。
- **补充裁定**：
  - Tier 1 文件范围封闭（见 `## Out of scope`）；不做 `compare.ts` / 联系表 / 循环预览 / CDP /
    `run-build-record` / 播放行为修复 / `runBuild` 门禁 / 付费视觉 / Playwright。
  - 退出码语义边界：输入不合法不得混成验收失败；不得永远返回 0 隐藏 findings；
    CLI 与 MCP 共享同一验收核心与报告语义。
  - 输出版本不得覆盖：实现前检查仓库既有版本分配、路径安全和失败处理惯例，
    不得仅凭本票假设现有机制。
  - 基准证据链保真：4 raw + 4 delivery；32 色真实 Prompt 与 34 色重建 Prompt 明确区分；
    记录哈希、来源、模型、票 12 阈值、期望指标；**不重生成**；回归测试实际校验内容与指标。
  - 施工纪律：不执行 `reset` / `clean` / 覆盖式清理；记录 `typecheck` / `build` / `check`
    的实际写入范围与结果；不运行 `create` / `pack` / `site` 生成链；
    `game-maker.local.json` 逐字节不变。
- **已知既有问题**：`node scripts/check-links.mjs` 在 HEAD 有 2 条既有断链
  （`.scratch/asset-integration-v1/runs/2026-10-20a-olive-palette/palette-curation.md:21`、
  `.scratch/asset-integration-v1/runs/2026-10-21c-screening/budget-report.md:8`）。
  Q8 禁止碰既有 `.scratch` 内容 ⇒ 本图不修；最终验证单独记录，不把它算作本次改动引入的失败。
- **付费闸**：任何生图 / 文本 / 视觉调用须另出书面预算 + 逐字点头；本图零付费。
- **提交**：本图不提交 / 不推送；完成后停在等待授权状态。
- **工作树**：既有 `CONTEXT.md` 修改与无关 `.scratch` 旧 run 保留；不 reset / clean。

## Decisions so far

（暂无；施工票完成后追加。）

- [01. 修复 typecheck 两处测试类型错误](issues/01-typecheck-fixes.md)：**已收口（task）** ——
  `pack-sheet-grid.test.ts:161` 假 generator 的 `call` 补 `requestedSize`（依据
  `image-gen.ts:34` 的 `ImageGenCall`）；`prompt.test.ts:8` 从 `@game-maker/contracts`
  导入 `CharacterDNA`。`pnpm typecheck` 由 exit 2 → **exit 0**（9 个项目全部 Done）；
  两个受影响测试 36 例通过。未提交、零付费。
- [02. 新增 AtlasJson 与 animation-acceptance/v1 契约](issues/02-contracts.md)：**已收口（task）** ——
  新增 `packages/contracts/src/atlas-json.ts`（`AtlasFrame` / `AtlasJson`，strict，v7 四张图集正例）与
  `animation-acceptance.ts`（`AnimationAcceptance` / `parseAnimationAcceptance`；findings 必须可定位、
  human 7 项齐全且不重复、runtime 不参与结构验收）；`contracts/src/index.ts` 追加两个导出。
  定向测试 **35 例通过**，包级 typecheck exit 0。有意偏差：`findings[].code` 在契约层仍是
  `string`（码表由票 05 的实现方拥有）；`declared.fps` 可为 null；无 baseline 时 `verdict` 为 null。
- [03. 新增 animation-metrics.ts 纯指标](issues/03-metrics.md)：**已收口（task）** ——
  新增 `packages/assets/src/animation-metrics.ts` 与 13 例测试；指标定义逐项对齐
  `qualify.mjs` / `finalist.mjs`（清洗顺序、alpha 128、1 位小数、位置漂移分母为 raw 源图）。
  v7 idle 4 帧 golden 全绿：alpha 0.4% / bbox 宽 0.2% / 位置 0.4% / L1 3 / 色数 ≥18 /
  off-palette 0 / 边界深色 87.4%。阈值只住 `ANIMATION_THRESHOLDS` 一处。偏差：API 形状与脚本不同；
  `boundaryDarkPct` 空色板抛错；`verdictOf` 只收数值（null 由调用方处理）。
- [04. 冻结 baseline fixture 与回归测试](issues/04-baseline-fixture.md)：**已收口（task）** ——
  `fixtures/animation-baselines/scavenger-idle/` 共 **18 文件 / 5.4MB**：4 raw（与 v7、19i 现场逐字节相同）、
  4 delivery（从 v7 图集无损裁出）、8 份 Prompt（32 色 actual / 34 色 pack，hash 全部核对）、
  `baseline.json`（§6.2 全字段 + 资产/色板/容差/双 hash）与 README。
  `animation-baseline.test.ts` 实际校验 hash、图集矩形、checksum、Prompt 色数区分与指标容差；
  baseline + metrics **2 文件 / 20 例通过**。未重生成；偏差已记录。
- [05. 结构验收器 + 报告 writer + 负例测试](issues/05-acceptance-core.md)：**已收口（task）** ——
  新增 `packages/assets/src/acceptance.ts`：`acceptAnimationPack`（`verifyPack` → `AtlasJson` → 解码 PNG →
  §5 的 1–13 项检查）、`writeAcceptanceReport`（`out/<packId>/acceptance/v<N>/report.json` + `report.md`；
  `mkdirSync` EEXIST 抢占版本，绝不覆盖；`manifest.id` 安全目录名校验）、
  `ACCEPTANCE_FINDING_CODES` 21 个闭集 code、`nextAcceptanceVersion`。
  baseline 存在时用包内 raw + 交付帧按动画计算 metrics/verdict；无 raw 则 `metrics: null` + `info`。
  测试 **3 文件 / 37 例全过**；v7 + 真实 baseline 结构全绿（findings 为空）。偏差：baseline schema
  用 `.passthrough()` 容忍票 04 的额外追溯字段；metrics 是「被验收包自身」的读数，不是 Tier 2 的
  基线 vs 候选比较。
- [07. MCP accept_asset_pack](issues/07-mcp-accept.md)：**已收口（task）** —— 新增第 8 个 MCP 工具，
  与 CLI 共用 `acceptAnimationPack` + `writeAcceptanceReport`；`structuredContent` 返回完整
  `CommandResult`（`packId` / `packVersion` / `baselineId` / `hasErrors` / findings 计数 /
  `reportVersion` / `reportDir` / `report` / `reportMarkdown`），artifacts 为
  `acceptance-report` / `acceptance-report-markdown`。错误语义：error findings ⇒ `isError: true` +
  `_exitCode: 1` 且报告照写；输入不合法 ⇒ `_exitCode: 4` 且不写报告。测试 **11 例全过**
  （v7+baseline 正例、error findings、坏包、工具面 8 个）。待办：CLI 数据形状与本票对齐
  （已把字段名发给票 06）。
- [06. CLI accept 命令](issues/06-cli-accept.md)：**已收口（task）** —— 新增
  `game-maker accept <pack> [--baseline <dir>] [--out <dir>] [--json]`；调 core 的
  `acceptAnimationPack` + `writeAcceptanceReport`；报告落 `out/<packId>/acceptance/v<N>/`，版本不覆盖。
  `run()` 增加 case 级退出码：findings 有 error ⇒ 打印结果后返回 **1**（报告照写）；
  无效包/基准 ⇒ **4**；参数错 ⇒ **2**；无 error ⇒ **0**。`data` 字段与 artifacts kind 与票 07
  **逐字对齐**。测试 **28 例全过**（0/1/2/4、版本不覆盖、人类/JSON 同源）。
  偏差：`baseline` 加入全局 `takesValue`；人类摘要最多列 10 条 error；v7 用例带 `skipIf` 兜底。
- [08. v7 第一份验收报告与集成验证](issues/08-v7-report.md)：**已收口（task）** ——
  `pnpm build` exit 0；CLI `accept` 对 v7 + baseline **exit 0**，报告落
  `out/ruin-scavenger-extraction-assets/acceptance/v1/report.json` + `report.md`；
  `parseAnimationAcceptance` ok；findings **0 error / 0 warning / 0 info**；`human.verdict=pending`（7 项）、
  `runtime.status=unverified`；idle metrics 与 baseline 逐项相等（green）；manifest / baseline checksum
  实测一致；MCP 测试 11/11，`data` 与 CLI `--json` 完全相等；v7 与 fixture 18 文件运行前后
  sha256/mtime 未变。**暴露问题**：12 个非 baseline 动画也被判红（run/jump/patrol 的正常帧间差异），
  已立 [10](issues/10-verdict-baseline-coverage.md) 修正 verdict 覆盖语义。
- [10. 修正 verdict 的 baseline 覆盖语义](issues/10-verdict-baseline-coverage.md)：**已收口（task）** ——
  `buildReport` 现在只对 baseline 的 `asset.id` + `asset.animation` 同时匹配的动画给 `verdict`；
  v7 的 13 个动画中只有 `scavenger-actor.idle` 为 **green**，其余 12 个保留 metrics、`verdict: null`
  （此前把 run/jump/patrol 的正常帧间差异误判红）。summary / `report.md` 增加覆盖名单与语义说明；
  `hasErrors` / findings / 退出码 / 报告 schema / CLI / MCP 未动。测试：assets 3 文件 / **38 例**，
  加 CLI/MCP/契约回归共 **57 例**，全绿。偏差：baseline 现在要求 `asset.id`/`asset.animation`；
  Markdown 覆盖名单由非 null verdict 反推（schema 不允许新增字段），summary 仍准确。
- [09. 最终验证与完工总结](issues/09-final-validation.md)：**已收口（task）** ——
  `pnpm test` **110 文件 / 1731 例 exit 0**；`pnpm typecheck` / `pnpm build` / `pnpm check:deps` exit 0；
  `pnpm check` 仅因 **2 条既有 `.scratch/asset-integration-v1` 断链** exit 1（Q8 不修），本次改动 0 断链；
  v7 `accept` **exit 0**，报告 `out/ruin-scavenger-extraction-assets/acceptance/v2/report.json`，
  findings 0，idle green，其余 verdict null，human pending，runtime unverified；包/fixture 未变。
  tracked 修改 8 文件 + 新增契约/指标/验收器/测试/fixture/地图；`CONTEXT.md`、无关 `.scratch`、
  `game-maker.local.json` 未动；未提交/推送。偏差：`findings[].code` 契约层仍为 string；
  baseline 要求 `asset.id/animation`；v1 报告保留，最终为 v2；`docs/v5/动画.md` 仍为未跟踪。
## Not yet specified

（无。Tier 1 已完工；Tier 2/3 与提交/推送都在 Out of scope。下一步是等待提交/推送授权。）

## Out of scope

- **Tier 2**：`compare.ts`、联系表、循环预览、CDP 探针、`run-build-record`。
- **Tier 3**：播放行为修复、固定动画场景、录屏、付费视觉模型、Playwright/Puppeteer、
  `runBuild` 门禁、CI。
- **提交 / 推送**：本图不执行；完工后等待单独授权。
- **任何付费调用与资源重生成**。
- **修改 `CONTEXT.md`、`game-maker.local.json`、无关 `.scratch` 旧 run**。
