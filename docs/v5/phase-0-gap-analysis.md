# Animation & Asset Acceptance V1 — Phase 0 缺口分析

| 属性 | 内容 |
|---|---|
| 项目 | `sihuayin/game-maker` |
| 阶段 | Phase 0（只读调查） |
| 基线 | `main` · `f0dac01` |
| 日期 | 2026-10-21 |
| 任务书 | [动画.md](动画.md) |
| 现状报告 | [phase-0-current-state.md](phase-0-current-state.md) |
| 实施计划 | [phase-0-implementation-plan.md](phase-0-implementation-plan.md) |

## 0. 阅读指引

- 缺口类型按任务书 §5：**缺失能力 / 已有但缺少覆盖 / 已有但缺少追溯 / 已有但尚未验证 / 设计不一致**。
- 每条缺口有 ID、状态、证据、影响、Phase 1 动作、优先级。
- 优先级是**建议**：P0 = Phase 1 Tier 1 必须；P1 = Phase 1 Tier 2；P2 = 延后 / 另立票。
- `unverified` 不代表能力不存在；它表示**没有足够证据证明它在当前环境下有效**。
- 证据文件索引见 §9。

## 1. 需求与现有能力对照（任务书 §7.2）

| 需求 | 现有实现 | 证据 | 状态 | Phase 1 动作 |
|---|---|---|---|---|
| 固定动画基准 | v7 `scavenger-actor` idle 4 帧 + 票 12 标准；无 `baseline.json`、零测试引用 | [`d-baseline-history.md`](../../.scratch/animation-acceptance-v1/research/d-baseline-history.md) §2–3；`pack/v7/manifest.json` | partial | **补齐**：小 fixture + `baseline.json` + 回归测试 |
| 实验与产物关联 | manifest / ledger / coverage / qa-report 各自可读；无 run→pack→site→qa 外键 | [`g-report-traceability.md`](../../.scratch/animation-acceptance-v1/research/g-report-traceability.md) §2 | partial | **补齐**：`run-build-record/v1` 索引 sidecar |
| 动画结构检查 | manifest schema + `superRefine` 很实；交付态 PNG / 图集 JSON 无对账 | [`b-pack-atlas-animation.md`](../../.scratch/animation-acceptance-v1/research/b-pack-atlas-animation.md) §7–8 | partial | **新增**：交付态结构验收器 |
| 图集与元数据检查 | 图集 JSON 无 schema；`verify` 不读；`AtlasEntry.size/frames/checksum` 零读者 | [`c-deterministic-checks.md`](../../.scratch/animation-acceptance-v1/research/c-deterministic-checks.md) §1–5 | partial | **新增**：图集 schema + 几何对账 |
| 视觉审查 | contact sheet / CDP 截图 / loop preview 脚本存在；无统一入口、无标签、无人裁模板 | [`e-visual-review.md`](../../.scratch/animation-acceptance-v1/research/e-visual-review.md) §1 | partial | **复用 + 补齐**：免费出口 + 人裁模板 |
| 游戏集成验证 | `site/v3` 真实播放；fps/loop 不生效；固定场景/触发入口/录屏缺失 | [`f-runtime.md`](../../.scratch/animation-acceptance-v1/research/f-runtime.md) §1–3 | partial | **复用 + 补齐**：CDP 只读探针；不修运行时 |
| 统一验收报告 | `qa-report/v1` 是裁决报告，不是验收报告；无身份/checksum | [`g-report-traceability.md`](../../.scratch/animation-acceptance-v1/research/g-report-traceability.md) §3 | missing | **新增**：`animation-acceptance/v1` |
| 基线比较 | `qualify.mjs` / `finalist.mjs` 已实现阈值，但 4 份拷贝、无共享模块/测试 | [`d-baseline-history.md`](../../.scratch/animation-acceptance-v1/research/d-baseline-history.md) §2.5 | partial | **复用 + 新增**：共享指标/比较模块 |

## 2. 缺口总表

| ID | 缺口 | 类型 | 状态 | 优先级 | Phase 1 动作 |
|---|---|---|---|---|---|
| G-01 | 交付态结构验收器（PNG/图集/边界/锚点/fps-loop） | 缺失能力 | missing | P0 | 新增 `assets` 模块 |
| G-02 | 统一验收报告 `animation-acceptance/v1` | 缺失能力 | missing | P0 | 新增 contracts schema + writer |
| G-03 | 固定基准 fixture + `baseline.json` + 回归测试 | 缺失能力 | missing | P0 | 新增 `fixtures/animation-baselines/` |
| G-04 | 共享动画指标与基线比较模块 | 缺失能力 | missing | P0/P1 | Tier 1 指标；Tier 2 比较编排 |
| G-05 | 免费带标签联系表 / 循环预览 / 人裁模板 | 缺失能力 | missing | P1 | 复用 `packContactSheet` + 新出口 |
| G-06 | run→pack→site→qa 索引 (`run-build-record/v1`) | 缺失能力 | missing | P1 | 新增 contracts + pipeline 写入 |
| G-07 | 固定动画场景 / 公开触发入口 | 缺失能力 | missing | P2 | 延后（Q1 A） |
| G-08 | 仓库内截图 / 录屏 / 运行时错误落盘 | 缺失能力 | missing | P1/P2 | CDP 探针（P1）；录屏延后 |
| G-09 | 验收器负例测试（缺文件/越界/坏 JSON/锚点） | 缺失能力 | missing | P0 | 新增测试 |
| G-10 | 运行时消费 `fps` / `loop` / `durationMs` | 缺失能力 | missing | P2 | 另立票（Q1 A） |
| G-11 | 图集 JSON schema | 缺失能力 | missing | P0 | 新增 contracts schema |
| G-12 | CI | 缺失能力 | missing | P2 | 延后 |
| G-13 | `verifyPack` 不在构建链、只 schema+checksum | 覆盖不足 | partial | P1 | 验收器调用它；不改 `runBuild` 门禁 |
| G-14 | `auditAssetSpec` 不读 anchor / scale9 / bounds | 覆盖不足 | partial | P1 | 验收器补齐；不改 QA 语义 |
| G-15 | QA 视觉族只判元数据 | 覆盖不足 | partial | P2 | 不扩展 `qa`（依赖白名单） |
| G-16 | `inspect` 只观察、缺图集帧静默跳过 | 覆盖不足 | partial | P1 | 验收器显式报错 |
| G-17 | 视觉脚本 4 份拷贝、无测试、无标签 | 覆盖不足 | partial | P1 | 共享模块 + 标签 |
| G-18 | 人裁记录非结构化、`humanVerdict` pending | 覆盖不足 | partial | P1 | 模板 + 写回报告 |
| G-19 | 真实动画包样本偏旧、v7 零测试引用 | 覆盖不足 | partial | P0 | 基准 fixture + 回归 |
| G-20 | `.scratch` 与 `fixtures/` 双轨样本 | 覆盖不足 | partial | P2 | 记录；不在 Phase 1 迁移全部样本 |
| G-21 | `pnpm check` 把守卫与 build 捆绑 | 覆盖不足 | partial | P2 | 记录；CI 另议 |
| G-22 | 无结构性网络守卫 / 测试 project 隔离 | 覆盖不足 | partial | P1 | `test:runtime` opt-in 脚本 |
| G-23 | MCP 能力面窄于 CLI | 覆盖不足 | partial | P1 | 只补 `accept` tool；其他差异记录 |
| G-24 | `run-ledger` 无 `packVersion` / `siteVersion` | 追溯不足 | partial | P1 | `run-build-record` |
| G-25 | `qa-report` 无身份、固定路径、重跑覆盖 | 追溯不足 | partial | P1 | build record 钉 checksum；可选 QA 版本化 |
| G-26 | manifest 无 run 外键；manifest 自身不在 `files[]` | 追溯不足 | partial | P1 | build record 补 manifest checksum |
| G-27 | 基准证据未入库（32 色 Prompt、日志、19k patch） | 追溯不足 | partial | P0 | 复制 4 份 Prompt + 日志关键行 |
| G-28 | 视觉产物不内嵌版本；脚本硬编码 v7 | 追溯不足 | partial | P1 | 报告/产物写 packId@version + checksum |
| G-29 | `site.json` 无 schema、无 run/qa/checksum | 追溯不足 | partial | P1 | build record 引用；不升 site 契约 |
| G-30 | QA/site 失败无 `failureDir`；QA 硬失败 run ledger 不更新 | 追溯不足 | partial | P2 | 另立票 |
| G-31 | `pnpm typecheck` exit 2（两处测试类型错误） | 尚未验证 / 回归风险 | unverified | P0 | 修两处测试 |
| G-32 | MCP 设计/vision 错误动态退出码 | 尚未验证 | unverified | P2 | 补测试或记录 |
| G-33 | QA 硬失败 run ledger 缺口无 E3 | 尚未验证 | unverified | P2 | 构造失败 run |
| G-34 | HEAD 真实端到端未跑 | 尚未验证 | unverified | P2 | 另立票（可能付费） |
| G-35 | `game-maker review` live 未跑 | 尚未验证 | unverified | P2 | 付费另立票 |
| G-36 | 图集越界在 `inspect` 的失败形态 | 尚未验证 | unverified | P1 | 合成负例 |
| G-37 | `coverage.json` 版本对账无测试 | 尚未验证 | unverified | P2 | 补测试 |
| G-38 | 完全禁网沙箱测试表现 | 尚未验证 | unverified | P2 | 断网跑 `pnpm test` |
| G-39 | 干净 `dist` / `pnpm build` | 尚未验证 | unverified | P2 | Phase 1 施工时验证 |
| G-40 | `CONTEXT.md` 声称 Game Config 可逐引用覆盖 fps/loop | 设计不一致 | partial | P1 | 补测试或改文档（另裁） |
| G-41 | README 写 MCP 6 工具，代码 7 | 设计不一致 | partial | P2 | 改文档 |
| G-42 | QA `constructive-constraint` 标签写锚点/九宫格，实现对不上 | 设计不一致 | partial | P1 | 验收器补齐；QA 语义另议 |
| G-43 | `AtlasEntry.checksum/size/frames` 声明但零读者 | 设计不一致 | partial | P0 | 验收器读并核对 |
| G-44 | `FrameRef.index/durationMs` 零生产者/消费者 | 设计不一致 | partial | P2 | 记录；删/用另裁 |
| G-45 | `checkSize` 零生产调用 | 设计不一致 | partial | P2 | 记录 |
| G-46 | 坏 manifest JSON 退 1 而非 4 | 设计不一致 | partial | P1 | 验收器归类为 invalid |
| G-47 | 同一文件两份 checksum，`atlases[].checksum` 不验 | 设计不一致 | partial | P0 | 验收器核对 |
| G-48 | `required` / `role` 等字段零消费者 | 设计不一致 | partial | P2 | 记录 |
| G-49 | `site.json` 无契约 schema | 设计不一致 | partial | P1 | build record 引用；不升 site 契约 |
| G-50 | `pnpm check` 语义混合（守卫 + build） | 设计不一致 | partial | P2 | 记录；CI 另议 |

## 3. 缺失能力（任务书 §5.1）

### G-01 交付态结构验收器

- **状态**：`missing`。
- **证据**：`verifyPack`（[`packages/assets/src/ops.ts:1662`](../../packages/assets/src/ops.ts)）只验
  schema + `files[]` 存在/大小/sha256 + 反向穷举；不解析 `atlas.*.json`、不解码 PNG。
  `/tmp` 探针：非 PNG、帧矩形 `9999`、`atlases[].frames=999`、目录 `v99` 全部通过。
  详见 [`c-deterministic-checks.md` §1–2](../../.scratch/animation-acceptance-v1/research/c-deterministic-checks.md)。
- **影响**：包可以“自洽”却包含越界帧、坏图集、与 manifest 不符的帧数；验收无法区分
  “checksum 没被改”与“动画结构有效”。
- **Phase 1**：在 `packages/assets` 新增验收模块，读 PNG + 图集 JSON，做 manifest↔atlas↔PNG 对账。
- **验收条件**：对 v7 包 exit 0；对非 PNG / 越界 / 缺帧 / 锚点不一致 / `frames` 说谎的合成包
  返回结构化 findings，并能定位 file + resource + frame。

### G-02 统一验收报告 `animation-acceptance/v1`

- **状态**：`missing`。
- **证据**：`qa-report/v1`（[`packages/contracts/src/qa.ts:258-319`](../../packages/contracts/src/qa.ts)）
  只有 `format/checked/failures/observations`，无 id/version/checksum/createdAt；
  固定写 `run/v<N>/qa-report.json`，第二次 attempt 覆盖。详见
  [`g-report-traceability.md` §3](../../.scratch/animation-acceptance-v1/research/g-report-traceability.md)。
- **影响**：验收结果无法关联到具体包/基线；视觉与人裁没有结构化落点；报告与裁决门禁混为一谈。
- **Phase 1**：新增 `animation-acceptance/v1` schema + writer；`accept` 命令写入版本化目录。
- **验收条件**：Report 能装包身份/checksum、基线身份、逐动画指标、findings、人裁槽、证据路径；
  schema strict；现有 `qa-report` 不受影响。

### G-03 固定基准 fixture + `baseline.json` + 回归测试

- **状态**：`missing`。
- **证据**：v7 idle 4 帧全绿但零测试引用；包内 prompt 是 34 色重建版，真实 32 色 Prompt 只在
  未入库的 19i failed 目录。详见
  [`d-baseline-history.md` §8](../../.scratch/animation-acceptance-v1/research/d-baseline-history.md)。
- **影响**：基准没有 checksum 锚点，未来会被悄悄改掉；无法在 CI/本地复现验收。
- **Phase 1**：新增 `fixtures/animation-baselines/scavenger-idle/`（4 raw + 4 交付 + 两份 Prompt +
  `baseline.json`）+ 回归测试。**不重生成。**
- **验收条件**：测试校验 raw/交付 hash、manifest/atlas checksum、票 12 指标在容差内；
  失败信息定位到 `资源.动画.帧`。

### G-04 共享动画指标与基线比较模块

- **状态**：`missing`。
- **证据**：`qualify.mjs:215-233` 与 `finalist.mjs:222-237` 各复制阈值；仓库无共享模块、无测试；
  票 12 标准只有票面文本。详见
  [`d-baseline-history.md` §2.5](../../.scratch/animation-acceptance-v1/research/d-baseline-history.md)、
  [`e-visual-review.md` §5](../../.scratch/animation-acceptance-v1/research/e-visual-review.md)。
- **影响**：基线/候选比较口径不一致；阈值改动会漂移；无法单测。
- **Phase 1**：Tier 1 新增纯指标函数（alpha/bbox/位置/背景 L1/色数/off-palette/边界深色）；
  Tier 2 新增 `compare.ts` 比较编排，复用票 12 阈值常量。
- **验收条件**：用 `qualify.mjs` / `finalist.mjs` 现有读数做 fixture，重算逐项一致；负例可判绿/黄/红。

### G-05 免费带标签联系表 / 循环预览 / 人裁模板

- **状态**：`missing`。
- **证据**：`packContactSheet` 无 CLI / 无标签 / 无落盘出口（`assets/src/review.ts:24`）；
  预览页硬编码旧包且 untracked（`.scratch/style-migration-v1/preview/index.html:43`）；
  `humanVerdict` 仍 `pending`（`2026-10-21f-finalist/result.json:1007`）。详见
  [`e-visual-review.md` §1–2](../../.scratch/animation-acceptance-v1/research/e-visual-review.md)。
- **影响**：人眼验收靠零散脚本与票面文字，无法复现、无法追溯。
- **Phase 1（Tier 2）**：免费出口 + 标签 + 逐动画循环预览 + 7 项人裁模板；写回报告。
- **验收条件**：任一包/候选 run → 一条免费命令产出带标签联系表 + 循环预览 + `humanVerdict` 模板；
  重跑除时间戳外稳定。

### G-06 run→pack→site→qa 索引

- **状态**：`missing`。
- **证据**：`run-ledger/v1` 无 `packVersion`/`siteVersion`；`qa-report` 无身份；
  `manifest` 无 run 外键；`site.json` 只有 `shell/pack/config`。18a 现场 run v1 + pack v1/v2 + site→pack v2，
  没有任何文件说明 run v1 产了 pack v2。详见
  [`g-report-traceability.md` §2](../../.scratch/animation-acceptance-v1/research/g-report-traceability.md)。
- **影响**：验收报告无法回溯到一次具体生成；多次 attempt 的结果会混。
- **Phase 1（Tier 2）**：新增 `run/vN/builds/v<M>.json`（`run-build-record/v1`），只存路径 + checksum + 计数。
- **验收条件**：join key 四元组可解析；不复制 findings/calls；QA 报告仍唯一裁决。

### G-07 固定动画场景 / 公开触发入口

- **状态**：`missing`。
- **证据**：只有一个 shell scene；`entry.ts:75` 丢弃 `new Phaser.Game`，`Phaser.GAMES` 不存在；
  CDP 必须注入 `Phaser.Game.prototype.boot` 才能拿 scene。详见
  [`f-runtime.md` §2.3, §2.4](../../.scratch/animation-acceptance-v1/research/f-runtime.md)。
- **影响**：无法稳定地按 clip 触发/步进/冻结帧；运行时验收依赖探针技巧。
- **Phase 1**：**延后**（Q1 A：不改运行时行为）。
- **验收条件（若另立票）**：URL 或只读句柄可选择 clip、暂停、步进；不改变普通游戏行为。

### G-08 仓库内截图 / 录屏 / 运行时错误落盘

- **状态**：`missing`（录屏）/ `partial`（截图、错误落盘）。
- **证据**：站点自身不产出截图/日志；本轮用 CDP 外挂采集；仓库无 Playwright/Puppeteer、无 CI。
  详见 [`f-runtime.md` §2.6–2.7](../../.scratch/animation-acceptance-v1/research/f-runtime.md)。
- **影响**：运行时证据不可在仓库内复现；录屏无法作为验收材料。
- **Phase 1（Tier 2）**：CDP 探针脚本参数化、输出到指定 run 目录；**录屏延后**。
- **验收条件**：探针可重复产出截图、console、network、采样 JSON；不需要 Chrome 之外的依赖。

### G-09 验收器负例测试

- **状态**：`missing`。
- **证据**：`verify` 对包内容的仓库负例只有 checksum 篡改（`cli.test.ts:127`）；缺文件/大小不符/
  越界/坏 JSON 无仓库测试；`/tmp` 探针未入库。详见
  [`c-deterministic-checks.md` §7](../../.scratch/animation-acceptance-v1/research/c-deterministic-checks.md)。
- **影响**：新验收器的错误路径没有回归保护。
- **Phase 1**：新增负例 fixture/测试：非 PNG、越界矩形、缺帧、幽灵帧、`frames` 说谎、
  锚点/尺寸不一致、跨资源同名帧。
- **验收条件**：每条负例断言错误码 + file/resource/frame 定位。

### G-10 运行时消费 `fps` / `loop` / `durationMs`

- **状态**：`missing`。
- **证据**：`scene.ts:140` 实体 `frameRate: 8`、`repeat: -1`；`scene.ts:193` 玩家 `run?10:6`、`repeat: -1`；
  `FrameRef.index/durationMs` 零生产者/消费者。实测 lunge 8fps 无限循环 vs 14fps/loop:false。
- **影响**：manifest 的播放参数是死数据；动画验收无法通过运行时保真。
- **Phase 1**：**延后**（Q1 A：不在验收能力里改行为；另立票）。
- **验收条件（若另立票）**：`buildWorld` 带 fps/loop，`scene.ts` 读取并设置 `frameRate` / `repeat`；
  jump 不循环、lunge 5 帧后停住。

### G-11 图集 JSON schema

- **状态**：`missing`。
- **证据**：全仓无 `AtlasJson` 的 Zod schema；`atlas.ts:21-34` 只是 TS 类型。详见
  [`b-pack-atlas-animation.md` §3.4](../../.scratch/animation-acceptance-v1/research/b-pack-atlas-animation.md)。
- **影响**：图集 JSON 是不可信输入；验收器只能手写解析，错误定位弱。
- **Phase 1**：在 `contracts` 新增最小 `AtlasJson` schema；验收器使用它。
- **验收条件**：坏 JSON / 缺字段 / 类型错被明确拒绝；v7 四张图集通过。

### G-12 CI

- **状态**：`missing`；**Phase 1 延后**。无 `.github/` 或任何工作流。

## 4. 已有能力但缺少覆盖（任务书 §5.2）

### G-13 `verifyPack` 不在构建链

`verifyPack` 只由 CLI `verify` / MCP `verify_asset_pack` 手动调用；`runBuild`
（[`pipeline/src/create-game.ts:417-560`](../../packages/pipeline/src/create-game.ts)）不调用。
**Phase 1**：验收器内部调用 `verifyPack`；不改 `runBuild` 门禁（Q2 A）。

### G-14 `auditAssetSpec` 不读 anchor / scale9 / bounds

`constructive-constraint` 标签写“尺寸 / 锚点 / 九宫格”（`qa.ts:114,385`），
但 `auditAssetSpec`（[`contracts/src/audit.ts:45-84`](../../packages/contracts/src/audit.ts)）只对账
kind/size/动画名与帧数/drawlist viewBox；spec 锚点 `{0,0}` vs 产物 `{0.9,0.9}` 仍返回 `[]`。
**Phase 1**：验收器补齐；不改变 QA 现有语义（另议是否改标签）。

### G-15 QA 视觉族只判元数据

`visualQaRunner`（[`qa/src/visual.ts`](../../packages/qa/src/visual.ts)）只跑
`constructive-constraint` / `palette-binding`，不读图像。**Phase 1**：不在 `qa` 扩展
（白名单只有 `contracts`）。

### G-16 `inspect` 只观察、缺图集帧静默跳过

`inspect` 解码真实像素但不阻断；缺失图集帧在 `ops.ts:1771-1773` 静默 `continue`。
**Phase 1**：验收器显式报错并定位。

### G-17 视觉脚本重复

`qualify.mjs`、`retry-enemy.mjs`、`finalist.mjs`、预览页各有一份阈值/渲染逻辑；无测试。
**Phase 1（Tier 2）**：收进共享模块 + 测试。

### G-18 人裁记录非结构化

票 12/15/16 的 `## Answer` 有人裁原文，但无逐项 checklist、无 A/B/C 盲标证据；
`humanVerdict` 仍 `pending`。**Phase 1（Tier 2）**：模板 + 写回。

### G-19 真实动画包样本偏旧

`fixtures/packs/last-train/v2` / `counter-siege/v4` 是 drawlist 包，动画帧少（idle 2 帧）；
v7 是真实 image 源动画包但零测试引用。**Phase 1**：基准 fixture 解决；last-train 仅辅助。

### G-20 `.scratch` 与 `fixtures/` 双轨

14 个测试读已入库的 `.scratch/.../stylespec.json`；`game-design` 读真跑失败产物。
可用，但样本位置双轨是结构性隐患。**Phase 1**：记录；不迁移全部样本。

### G-21 `pnpm check` 捆绑守卫与 build

`check` = `check:deps && check:links && build`，无法只跑守卫。**Phase 1**：记录；CI 另议。

### G-22 无结构性网络守卫

“`pnpm test` 完全离线”靠约定；没有 vitest project / tag / 环境门控；新测试可无声发请求。
**Phase 1（Tier 2）**：CDP 探针独立 `test:runtime` / 脚本，默认套件保持离线。

### G-23 MCP 能力面窄于 CLI

MCP 7 工具 vs CLI 10 命令；无 `compile-td-game`、`review`；`stylePath` 不相对化、
`compile_runtime` 漏 `hudLineHeight`。**Phase 1**：只补 `accept_asset_pack`，其他差异记录。

## 5. 追溯与报告缺口（任务书 §5.3）

### G-24 `run-ledger` 无 `packVersion` / `siteVersion`

[`contracts/src/run-ledger.ts:19-34`](../../packages/contracts/src/run-ledger.ts) 只有
`gameId/runVersion/createdAt/run/calls[]`。**Phase 1（Tier 2）**：`run-build-record/v1`。

### G-25 `qa-report` 无身份、固定路径、重跑覆盖

[`contracts/src/qa.ts:258-319`](../../packages/contracts/src/qa.ts) 无 id/version/checksum/time；
固定写 `run/v<N>/qa-report.json`；第二次 attempt 覆盖旧 findings。
**Phase 1（Tier 2）**：build record 钉 checksum；是否把 QA 报告版本化另裁。

### G-26 manifest 无 run 外键；manifest 自身不在 `files[]`

`AssetPackManifest` 是 `.strict()`；manifest 自身不在 `files[]`，`verify` 不校验它。
**Phase 1（Tier 2）**：build record 补 manifest checksum。

### G-27 基准证据未入库

32 色真实 Prompt、19i/21c–21f HTTP 日志、19k patch、19h 母版 Prompt 未入库或不可考。
**Phase 1（Tier 1）**：把 4 份 Prompt + 日志关键行复制到 baseline fixture。

### G-28 视觉产物不内嵌版本

`result.json` / `contact.png` / `loop-preview.html` 不写 packId@version；
`finalist.mjs:27-28` 硬编码 v7 路径。**Phase 1（Tier 2）**：报告与产物写身份 + checksum。

### G-29 `site.json` 无 schema

`layout.ts:114-116` 直接写 `{shell,pack,config}`；无 run/qa/checksum。
**Phase 1（Tier 2）**：build record 引用；不升 site 契约。

### G-30 失败记录不完整

理解层 / pack 用 `failed-<ts>/` 保留现场；config staging 被删、QA/site 无 `failureDir`；
QA 硬失败时 run ledger 不更新。**Phase 1**：记录；另立票。

## 6. 已有能力但尚未验证（任务书 §5.4）

| ID | 事项 | 证据 / 原因 | 最小验证 |
|---|---|---|---|
| G-31 | `pnpm typecheck` exit 2 | `pack-sheet-grid.test.ts:150` TS2322；`prompt.test.ts:257` TS2304 | 修两处测试后复跑 |
| G-32 | MCP 设计/vision 错误动态退出码 | 静态 E1；`server.ts:338-360` | 注入 fake 上游跑 MCP `create_game` |
| G-33 | QA 硬失败 run ledger 缺口 | 无 E3 归档失败 run | 构造 QA 失败 run，检查 ledger |
| G-34 | HEAD 真实端到端 | 本图只读；未跑生成 | 另立票 + 预算 + 逐字点头 |
| G-35 | `game-maker review` live | 无 `"step":"review"` ledger | 付费另立票 |
| G-36 | 图集越界在 `inspect` 的失败形态 | 仓库无负例 | 合成包 + `inspect` |
| G-37 | `coverage.json` 版本对账 | 只有 site 侧代码，无测试 | 版本不符负例 |
| G-38 | 完全禁网沙箱 | 未执行 | 断网 `pnpm test` |
| G-39 | 干净 `dist` / `pnpm build` | 本图禁止 | Phase 1 施工时 |

## 7. 设计不一致（任务书 §5.5）

| ID | 冲突 | 证据 | 处理建议 |
|---|---|---|---|
| G-40 | `CONTEXT.md` 说 Game Config 可逐引用覆盖 fps/loop；契约/实现无此字段 | `CONTEXT.md:313-316`；`assetpack.ts:157-162`；`scene.ts:140,193` | 验收器报告声明 vs 实际；文档/契约另裁 |
| G-41 | README 写 MCP 6 工具，代码 7 | `README.md:208`；`server.ts:70-194` | 改文档（Phase 1 外） |
| G-42 | QA 标签写锚点/九宫格，`auditAssetSpec` 不读 | `qa.ts:114,385`；`audit.ts:45-84` | 验收器补齐；QA 标签另议 |
| G-43 | `AtlasEntry.checksum/size/frames` 零读者 | `assetpack.ts:259-262`；`ops.ts:1672-1679` | 验收器读并核对 |
| G-44 | `FrameRef.index/durationMs` 零生产者/消费者 | `assetpack.ts:153-154`；`pack.ts:1221` | 记录；删/用另裁 |
| G-45 | `checkSize` 零生产调用 | `audit.ts:24-33` | 记录 |
| G-46 | 坏 manifest JSON 退 1 而非 4 | `/tmp` 探针 M/N；`ops.ts:1666` 无捕获 | 验收器归类 `invalid` |
| G-47 | 同一文件两份 checksum，`atlases[].checksum` 不验 | `assetpack.ts:262`；`ops.ts:1672-1679` | 验收器核对 |
| G-48 | `required` / `role` 等字段零消费者 | `assetpack.ts:167,170` | 记录 |
| G-49 | `site.json` 无契约 schema | `layout.ts:114-116` | build record 引用；不升契约 |
| G-50 | `pnpm check` 语义混合 | `package.json` scripts | 记录；CI 另议 |

## 8. 缺口优先级与 Phase 1 分流

| 优先级 | 缺口 | Phase 1 层 |
|---|---|---|
| P0 | G-01, G-02, G-03, G-04（指标）, G-09, G-11, G-19, G-27, G-31, G-43, G-47 | Tier 1 |
| P1 | G-04（比较编排）, G-05, G-06, G-08（CDP 探针）, G-13, G-14, G-16, G-17, G-18, G-22, G-23, G-24, G-25, G-26, G-28, G-29, G-36, G-40, G-42, G-46, G-49 | Tier 2 |
| P2 | G-07, G-10, G-12, G-15, G-20, G-21, G-30, G-32–G-35, G-37–G-39, G-41, G-44, G-45, G-48, G-50 | Tier 3 / 另立票 |

**不做的事（本图 Out of scope）**：修复 fps/loop 运行时行为、固定动画场景、录像、
付费视觉模型、Playwright、把验收接入 `runBuild` 门禁、重生成任何资源。

## 9. 证据索引

- 现状报告：[phase-0-current-state.md](phase-0-current-state.md)
- 实施计划：[phase-0-implementation-plan.md](phase-0-implementation-plan.md)
- 测试清单：[phase-0-test-inventory.md](phase-0-test-inventory.md)
- 研究根：[`../../.scratch/animation-acceptance-v1/research/`](../../.scratch/animation-acceptance-v1/research/)
- 地图与票：[`../../.scratch/animation-acceptance-v1/map.md`](../../.scratch/animation-acceptance-v1/map.md)
- v7 包：`../../.scratch/asset-integration-v1/runs/2026-10-20f-lurker/ruin-scavenger-extraction-assets/pack/v7/`
- 运行时证据：[`../../.scratch/animation-acceptance-v1/runs/2026-10-21-runtime/`](../../.scratch/animation-acceptance-v1/runs/2026-10-21-runtime/)
