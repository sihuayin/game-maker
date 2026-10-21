# Animation & Asset Acceptance V1 · Phase 0

Labels: wayfinder:map
Tracker: local-markdown
Effort: animation-acceptance-v1

> **本图 2026-10-21 开。**输入任务书：[docs/v5/动画.md](../../docs/v5/动画.md)。
> 本轮只交付调查报告与文件级实施计划；不提交业务代码 / 测试 / 契约 / 资源 / 配置改动，
> 不执行写 `out/` 的生成命令，零付费。第一轮 Q1–Q5 全部裁定 A（见 Notes，边界逐字）。
> ✅ **2026-10-21 收口**：01–09 全部 resolved；四份交付物已落 `docs/v5/`；地图终点达成。

## Destination

Phase 0 完成：`docs/v5/` 下四份有证据的交付物
（`phase-0-current-state.md` / `phase-0-gap-analysis.md` / `phase-0-implementation-plan.md` /
`phase-0-test-inventory.md`）落地并通过交叉引用校验；每项能力标
`implemented` / `partial` / `missing` / `unverified`，每条缺口有源码 / 测试 / 运行证据；
Phase 1 的范围、复用模块、文件级改动、测试方案与实施顺序明确到可直接执行。
**不含任何业务代码 / 测试 / 契约 / 资源 / 配置改动。**

## Notes

- **基线**：`main` · `f0dac01`（工作树非干净：`CONTEXT.md` 已改，`.scratch/` 有未跟踪文件）。
- **任务书**：[docs/v5/动画.md](../../docs/v5/动画.md) §4 A–H、§5 缺口规则、§6 交付物、
  §7 报告格式、§8 完成标准。
- **第一轮裁定（2026-10-21，Q1–Q5 全部 A；边界逐字）**：
  - **Q1 交付物**：四份独立文档放 `docs/v5/`；证据放
    `.scratch/animation-acceptance-v1/research/`；报告使用相对链接；**本轮不提交**。
  - **Q2 命令边界**：允许 `pnpm test`、`pnpm typecheck`、只读 `verify` / `inspect`；
    **禁止** `pnpm check`、`pnpm build` 及任何写入 `out/` 的生成命令。
  - **Q3 运行时验证**：仅使用现有 `site/v3` + CDP；截图、日志写入
    `.scratch/animation-acceptance-v1/runs/`；**不重装站点，不写 `out/`**。
  - **Q4 既有研究**：W1–W6 和历史票仅作为线索；**必须针对 `f0dac01` 复验**；
    旧结论**不自动继承** `implemented`。
  - **Q5 动画基准**：v7 `scavenger-actor` idle 4 帧 + 票 12 标准；
    **Phase 1 计划必须明确基准冻结、版本固定和证据保存方案**；`last-train/v2` 仅作辅助候选。
- **零付费**：生图 / 文本上游都算付费动作；本图不发起任何付费调用。
- **不提交**：research / 报告 / 地图全部留工作树；提交需单独授权。
- **既有证据（只作线索，须在 HEAD 复验）**：
  - `.scratch/p0-00-audit/research/w1–w6.md`（基线 `ea53240`）。
  - `.scratch/asset-integration-v1/issues/09|12|14|15|16*.md` 与 `runs/2026-10-21{a..f}/`。
  - v7 包：`.scratch/asset-integration-v1/runs/2026-10-20f-lurker/ruin-scavenger-extraction-assets/pack/v7/`
    （19 资源 / 76 帧 / 动画 61 帧，已入库）。
  - `site/v3`：`.scratch/asset-integration-v1/runs/2026-10-20e-site/out/ruin-scavenger-extraction-assets/site/v3/`
    （未入库）。
  - CDP 驱动：`.scratch/asset-integration-v1/runs/2026-10-20e-site/drive-cdp.mjs`；
    W6 的 `.scratch/p0-00-audit/runs/2026-10-20a-head-replay/drive.mjs`。
- **不修改**：`game-maker.local.json` 一个字不动。
- **工作方式**：research / task 票由子代理并行跑，只写 `research/` 与各自票；综合票由人裁；
  地图 Decisions-so-far 由主会话统一追加，避免并行写冲突。
- **证据分级**：沿用 `docs/v4/P0-00-task-brief.md` 附录 A（E0 推测 / E1 源码 / E2 测试 / E3 真实产物），
  另加运行证据（命令 + 退出码 + 路径）。

## Decisions so far

- [01. A · 项目架构与依赖边界](issues/01-a-architecture.md)：**已收口（research）** —— 9 个 pnpm package；
  格式唯一家在 `contracts`（`assetpack/v4`），生成/处理/打包在 `assets`，运行时与站点在 `demo`，
  `pipeline` 够不着 `demo`，`cli`/`mcp` 是仅有的可同时依赖 `assets`+`demo` 的薄壳。
  `check-deps.mjs:16-31` 实测 exit 0；Phase 1 落点建议：确定性检查 → `assets`，运行时探针 → `demo`，
  报告/基线 schema → `contracts`，编排 → `cli`；不要放 `qa`（白名单只有 contracts）或 `pipeline`（无 demo 边）。
  证据弱点：`verify` 不解析图集 JSON、`inspect` 对缺失图集帧静默跳过、运行时 `fps/loop` 写死；
  `cli/mcp` tsconfig references 漏 `pipeline`（构建影响未验证）。证据：`research/a-architecture.md`。
- [08. H · 测试体系与安全执行清单](issues/08-h-test-inventory.md)：**已收口（task）** ——
  `pnpm test` **EXIT 0**：105 文件 / 1647 用例全绿，0 跳过；测试只写 `os.tmpdir()`，运行前后 git status 不变。
  `pnpm typecheck` **EXIT 2**：根 `tsc -b` 通过，`pack-sheet-grid.test.ts:150`（TS2322 缺 `requestedSize`）与
  `prompt.test.ts:257`（TS2304 未导入 `CharacterDNA`）红；其余 8 包 Done。无 CI；零凭据 / 零外网 / 零费用。
  关键缺口：`verifyPack` 只验 schema + 文件大小 + sha256，**不解码 PNG、不查图集帧矩形越界**
  （`ops.ts:1662`）；v7 基准包（19 资源 / 76 帧）**零测试引用**；缺基准冻结、图集几何、帧像素不变量、
  基线/候选 diff、运行时播放测试。证据：`research/h-test-inventory.md`。

- [06. F · 游戏运行时与集成验证路径](issues/06-f-runtime.md)：**已收口（task）** —— 现有 `site/v3` 真实跑通：
  HTTP 根为 `pack/`+`site/` 父目录，`python3 -m http.server 8791` → 200；Chrome headless + CDP；
  `scavenger-actor.idle` 4 帧按 ~168ms 循环，局部连拍去重 4 帧、`drawImage` 轨迹换帧 ~167ms；
  `ArrowRight` / `Space` 可触发 run / jump。**播放 implemented**，但 manifest 的 `fps`/`loop` 从未被运行时读取
  （`scene.ts:140,193` 硬编码 `frameRate` 与 `repeat:-1`；实测 lunge 以 8fps 无限循环 vs 声明 14fps/loop:false），
  固定动画场景与公开触发入口 `missing`，录屏 `missing`，CDP 截图 / 错误落盘 `partial`。
  站点与包未被修改（mtime 仍 2026-10-20 14:53:15）；零付费、未写 `out/`。
  证据：`research/f-runtime.md`、`runs/2026-10-21-runtime/`。
- [05. E · 视觉审查能力](issues/05-e-visual-review.md)：**已收口（research）** —— 不是空白，是「能看」的半成品：
  `packContactSheet`（`packages/assets/src/review.ts:24`）能拼全帧但无标签 / 无 CLI；
  预览页 `.scratch/style-migration-v1/preview/index.html:84-99` 按 manifest fps 循环，但硬编码旧包且未入库；
  `qualify.mjs` / `finalist.mjs` 已能生成 baseline|candidate 联系表 + 绿/黄/红阈值 + loop preview，
  但 4 份拷贝、无测试、PNG 无标签；`site` + CDP 截图成立，但 shell fps 写死、不能选 clip / 步进 / 冻结帧；
  04/08/15/16 的 `## Answer` 有人裁原文，但缺逐项清单，`humanVerdict` 仍为 `pending`
  （`2026-10-21f-finalist/result.json:1007`）。视觉模型 `reviewPack` 明确付费、人工、只描述差异、
  不判分、不阻断、不进链（`review.ts:9-13`；`qa/assemble.ts:96-103`；`contracts/qa.ts:356-378`
  的 `qaVerdict` 不看 observations）——**未发现被当作确定性判定**。
  Phase 1 最小建议：冻结 v7 checksum + 免费联系表/预览入口 + 抽出 `assets/src/compare.ts`
  （票 12 阈值 + 单测）+ 固定 site/CDP 取证 + 7 项人裁模板并回写 `humanVerdict`；
  视觉模型保持可选付费旁路。证据：`research/e-visual-review.md`。
- [07. G · 报告、错误与实验追溯](issues/07-g-report-traceability.md)：**已收口（research）** ——
  错误模型 `partial`：壳层统一信封 `CommandError(kind/message/ledger?/failureDir?)` + `EXIT 0–4` + `Carried`
  （`contracts/command.ts:46,67-151`），但 core 有裸 `Error`，且没有 `stage/file/resource/frame` 结构化字段；
  CLI/MCP 传播不一致（MCP 设计/vision 错误落 1，工具说明写 3/4；CLI 翻理解层错误时丢 `failureDir`）。
  失败保存 `partial`：理解层 / pack 用 `failed-<ts>/` 保留现场，但 config staging 被删、QA/site 无 `failureDir`，
  **QA 硬失败时 run ledger 不更新**。**追溯链最大缺口 `missing`**：`run-ledger/v1` 无
  `packVersion/siteVersion`，`qa-report/v1` 无身份 / checksum / time，manifest 无 run 外键；
  `qa-report` 固定写 `run/v<N>/qa-report.json`，第二次 attempt 会覆盖旧 findings。
  包身份 `implemented`：`(manifest.id, version)` + `files[].checksum` + `atlases[].checksum`，
  但 manifest 自身不在 `files[]`，`verify` 不在创建链上自动跑。
  最小方案：新增 `run/vN/builds/v<M>.json`（`run-build-record/v1`）索引
  `runVersion→packVersion→siteVersion→qaReport`，复用现有账本与报告，不建第三本账；
  只新增 manifest / qa-report / 输入文件 checksum 与 `stages[]` / 失败 `error{kind,stage,file?,resource?,frame?}`。
  验证：11 个定向测试文件 / 209 tests passed；未跑 HEAD 端到端。证据：`research/g-report-traceability.md`。
- [03. C · 现有确定性检查覆盖矩阵](issues/03-c-deterministic-checks.md)：**已收口（research）** ——
  真正落实的只有 manifest 自洽 + 文件 checksum。`verifyPack`（`ops.ts:1662`）只由 CLI/MCP 手动调用，
  `runBuild` 不调用；它只验 schema + `files[]` 存在/大小/sha256 + 反向穷举 + 可选 ledger/master-ratios，
  **不解码 PNG、不读图集 JSON、不查帧矩形越界 / `atlases[].size` / 锚点 / 目录 `vN` / `coverage.json`**。
  `/tmp` 探针：非 PNG、帧矩形 `9999`、`atlases[].frames=999`、目录改 `v99` 全部通过 `verify`；
  manifest 幽灵帧也通过。契约层 `AssetPackEntry.superRefine`（`assetpack.ts:194-333`）真实校验
  帧 / 动画 / 层 / 资源 id 唯一、动画帧 ⊆ `frames[]`、多帧归组、层帧一一对应，但只看 manifest。
  **「只声明不读取」确认**：QA `constructive-constraint` 标签写「尺寸/锚点/九宫格」
  （`qa.ts:114,385`），实际 `auditAssetSpec`（`audit.ts:45-84`）不读 `anchor` / `scale9Borders` /
  图集帧 bounds；spec 锚点 `{0,0}` vs 产物 `{0.9,0.9}` 仍返回 `[]`。死字段：`AtlasEntry.checksum`
  零读者、`checkSize` 零生产调用、`FrameRef.index/durationMs` 零读者、`fps/loop` 运行时写死。
  返回结构不统一（`{ok,errors}` / `CommandError+problems[]` / `string[]` / QA finding / `ConfigIssue`）；
  `verify` 定位到文件（最多 6 条）不到资源/帧，QA 定位到资源 id 不到文件。W4 六条结论在 HEAD 全部成立。
  证据：`research/c-deterministic-checks.md`。
- [02. B · 资源包、图集与动画数据结构](issues/02-b-pack-atlas-animation.md)：**已收口（research）** ——
  `assetpack/v4` manifest + 四类 TexturePacker JSON Hash 图集 + `authoring/` + `ledger.json`/`coverage.json`；
  生产者 `buildAssetPack`，消费者 `world.ts`/`draw.ts` 与 Phaser。帧名是唯一连接键，顺序 = `Animation.frames[]`；
  `FrameRef.index/durationMs` **零生产者、零消费者**。`anchor`/`size` 在 manifest 资源级与图集逐帧各有一份，
  **从不跨文件对账**。`fps/loop` 写进 manifest 但运行时写死（`scene.ts:140,193`）；v7 `jump(fps10,loop:false)`
  实际 6fps 无限循环。身份：`id+version+files[].sha256` 足以钉住包字节；无 per-asset 哈希 / manifest 自哈希 /
  全局稳定 ID；`AtlasEntry.checksum/size/frames` 零读者。五层：L1 manifest schema `implemented`（图集 JSON 无 schema）；
  L2 文件 `partial`；L3 解码 `partial`（只有 `inspect` 解码且不阻断）；L4 引用 `partial`
  （manifest 内与 config→pack 实，**manifest→图集 JSON 无检查**）；L5 播放 `partial`（帧推进实测通过；
  fps/loop/duration 不生效）。`/tmp` 探针：manifest 帧不在图集 JSON + 图集 PNG 不是 PNG + `AtlasEntry.frames`
  说谎时 `verify` 仍 exit 0；跨资源同名帧在 `atlas.ts:86` 静默覆盖。报告关联 `partial`：`qa-report/v1`
  无 id/version/checksum/time；`run/v<N>` 与 `pack/v<M>` 可不同号。证据：`research/b-pack-atlas-animation.md`。
- [04. D · 动画基准与历史验收材料](issues/04-d-baseline-history.md)：**已收口（research）** ——
  **v7 `scavenger-actor` idle 4 帧可冻结为主基准**；`fixtures/packs/last-train/v2` 只能作辅助结构夹具。
  v7 包 158 文件 / 19 资源 / 76 帧 / 61 动画，`verify` exit 0、157 checksum 全对；4 张 raw 与 4 张交付帧在库；
  4 帧最差 alpha 0.4% / 宽差 0.2% / key L1 3 / off-palette 0 / 边界 87.4%，按票 12 全绿。
  追溯链 19i 失败现场 → 19j v1 → 19k patch → 20a v2–v4 → 20d v6 → 20f v7，4 帧 raw 逐字节相同；
  19i 记录 `gemini-2.5-flash-image`（70 发 / 68×200 / 66×PNG）。**同一输入不严格成立**：v7 包内 prompt 是
  34 色重建版，真正生成用的 32 色 Prompt 只在未入库的
  `.scratch/style-migration-v1/runs/2026-10-19i-real-frames/.../failed-2026-10-19T11-50-47-861Z/`，两者差两个色号；
  21a–21f 用的是 34 色版。验收标准只有票 12 的 `## Answer`，无版本号 / 独立文件 / 共享实现或测试；
  `qualify.mjs` 与 `finalist.mjs` 各自复制阈值；`humanVerdict` 仍 `pending`。
  冻结建议：不重生成；建小 fixture（4 raw + 4 交付帧 + 32 色真实 Prompt + 34 色重建 Prompt + `baseline.json`：
  raw/交付 hash、atlas/manifest checksum、reference/master hash、模型、阈值、期望指标）+ 一条基线 regression test
  （v7 当前零测试引用）。证据：`research/d-baseline-history.md`。
- [09. 综合：缺口判定、Phase 1 文件级实施计划与四份交付物](issues/09-synthesis.md)：**已收口（grilling/HITL）** ——
  **Q1–Q8 全部 A**。Phase 1 **Tier 1** = 修 typecheck + `AtlasJson` / `animation-acceptance/v1` 契约 +
  纯动画指标 + v7 baseline fixture/回归 + 交付态结构验收器 + CLI/MCP `accept` + 测试；
  **Tier 2** = 共享 compare + 带标签联系表/循环预览/人裁模板 + CDP 只读探针 + `run-build-record/v1`；
  **Tier 3** = 运行时 fps/loop 修复、固定动画场景、录屏、付费视觉模型、Playwright/CI、
  把验收接入 `runBuild` 门禁。缺口 G-01–G-50 按 P0/P1/P2 分流。
  交付物：[current-state](../../docs/v5/phase-0-current-state.md) ·
  [gap-analysis](../../docs/v5/phase-0-gap-analysis.md) ·
  [implementation-plan](../../docs/v5/phase-0-implementation-plan.md) ·
  [test-inventory](../../docs/v5/phase-0-test-inventory.md)。
  零业务代码 / 测试 / 契约 / 资源 / 配置改动；零付费；未提交。

## Not yet specified

（无。终点已达成；Tier 3 延后项与 Phase 1 施工都超出本图 destination，归入下方 Out of scope。）

## Out of scope

- **业务代码 / 测试 / 契约 / 资源 / 配置改动**：本图只调查与计划；Phase 1 另行授权。
- **重生成资源 / 改动画 / 改模型路线**：属于 asset-integration-v1 的延续，不在本图。
- **付费生图 / 付费视觉分析**：任何付费动作须另立票 + 书面预算 + 逐字点头。
- **修改 `game-maker.local.json`**。
- **玩法扩展 / 新关卡 / 新题材**。
- **提交**：本轮不提交；提交需单独授权。
- **Phase 1 施工（Tier 1 / Tier 2）**：本图只交付报告与计划；施工需另一个 effort / 单独授权。
- **Tier 3 延后项**：运行时 fps/loop 修复、固定动画场景、录屏、付费视觉模型、Playwright/CI、
  把验收接入 `runBuild` 门禁。
