# 清单→配置缺口：recipe 补 ui/地形 prop，config 稳定过业务校验

Labels: wayfinder:map
Tracker: local-markdown
Effort: recipe-config-gap-v1

> **本图 2026-10-23 开。** 输入：上一张 [intent-to-mechanics-v1](../intent-to-mechanics-v1/map.md) 票 11
> 付费重跑失败现场 —— Stage A（理解层）全过、生图 12 次 0 重试，但 compile-runtime 的 GameConfig
> 过不了业务校验（5 条硬失败）。根因不在生图、不在机制契约，而在**清单缺两类资源**：
> ① 设计带 `hud:screen-space` 但 recipe 无 `ui` 资源（panel/pip）；② 关卡 layout 要地形 props
> 但 recipe 无 solid/decor 用的 sprite。compile-runtime 拿到做不出合法 config 的清单，只能乱填。
> **第一轮裁定**（2026-10-23 用户）：修 plan-assets + compile-runtime（Q1=b）；免费验收到
> config 业务校验全过 + offline E2E 可玩 + smoke/probe 全绿，付费重跑独立授权（Q2=a+b）；
> 承载执行（Q3=b）。
> **全图零付费默认**；付费重跑（票 07）单独书面预算 + 逐字授权。不提交/推送除非单独授权。

## Destination

让 design → recipe（plan-assets）→ config（compile-runtime）链**稳定产出一份过业务校验的合法 config**：
plan-assets 按设计需求产出 `ui`（HUD panel/pip）与地形 prop 资源并加覆盖闸；compile-runtime 在清单
缺资源时**明确拒**而非乱填。收口在**免费验收闭环**（config 业务校验全过 + offline E2E 可玩 +
smoke/probe 全绿）。付费 P0-FINAL 重跑是本图最后一票、单独授权，不在免费验收内。

## Notes

- **失败现场**：`.scratch/intent-to-mechanics-v1/runs/2026-10-23-p0-final/`（5 条硬失败逐字在
  `stage-b.log`）。输入同款：`fixtures/e2e/wasteland-platformer/style.png` + `intent.md`。
- **代码地形**：`assetPlanPrompt`（`packages/assets/src/prompt.ts`）不读 `runtimeRequirements`；
  `designCoverageGate`（plan-assets）只查设计四桶实体，不查 ui/地形；compile-runtime 在
  `packages/assets/src/ops.ts:938`（LLM 产 config + `auditGameConfig`/`auditScreenSpace`/
  `auditLayerCoverage` 三批业务校验）。
- **config 契约**：`hud.panel` / `hud.pip` 的 `asset` 必须是 `ui` kind（`game-config.ts:361-362`）；
  `panel.size` 是「资源尺寸≠声明尺寸」的唯一例外，但**只对九宫格成立**（否则两数须相等，`:467`）。
  `EntityKind` 含 `solid`/`decor`（`:50`）。
- **工作树纪律**：不改 `fixtures/`、`game-maker.local.json`；测试产物只写 `out/` 或本 effort 目录。
- **证据分级**：E0 推测 / E1 源码 / E2 测试 / E3 真实产物 + 运行证据。

## Decisions so far

<!-- the index: one line per closed ticket, enough to judge relevance, then zoom the link for the detail the ticket holds -->

- [01 HUD ui 资源契约](issues/01-hud-ui-contract.md)：`hud.panel`/`hud.pip` 的 asset 必须 `ui` kind；
  `auditPanelSize` 只对九宫格放行「声明尺寸≠资源尺寸」。plan-assets 从不读 `runtimeRequirements`、无任何输入逼模型产 ui；
  落点 = `ops.ts:398` 后新增确定性闸 `hudUiGate`（带 ninePatch 的 ui 面板 ≥1 + 不带 ninePatch 的 ui pip ≥1），
  夹具 `last-train.json` 是现成正例。
- [02 地形 solid/decor 现状](issues/02-terrain-solid-decor-status.md)：**audit 对 solid/decor 实体没有 kind 锁**
  （`game-config.ts:360` 解引用不传 kinds）——`solid` 引 animation 只弱失败在「多动画缺 anim」，不是「要的是 sprite」。
  高杠杆修法 = `game-config.ts:360` 给 solid/decor 加 `["sprite"]` kind 锁（构建期拒绝，与 player/hud 同口径）；
  地形 prop 有现成 sprite 先例（`prop-luggage-pile` / `tile-floor` / `metal-platform`）。
- [03 地形 prop 策略](issues/03-terrain-prop-strategy.md)：**(c) 两者兼备** —— recipe 产地形 sprite（正向路径，照
  `tile-floor`/`metal-platform` 先例）+ solid/decor→`sprite` kind 锁 + 「缺 sprite 就退 `terrain`、禁拿玩家当 solid」
  （安全网）。落点 → 票 05。
- [04 plan-assets 补 ui + 覆盖闸](issues/04-plan-assets-ui-gate.md)：落地 `hudUiGate`（**条件化在 `hud:screen-space`**）——
  设计声明 HUD 时清单须「带 ninePatch 的 ui 面板 ≥1 + 不带 ninePatch 的 ui 图标 ≥1」，缺则 `schema` 档重采样；
  `assetPlanPrompt` 加正向线索。witness 4 用例，全仓 1850 绿。
- [05 地形 prop + compile-runtime 收紧](issues/05-compile-runtime-tighten.md)：**`solid` → `sprite` kind 锁**
  （`game-config.ts` 实体引用循环，把「拿玩家动画当地形」变构建期 kind 拒绝；⚠️ `decor` **不加锁**——动画/ui 装饰
  合法，v7 真配置就这么用）+ compile-runtime 铁律 #5 收紧（禁玩家/动画当 solid、缺 sprite 退 `terrain`）+
  recipe 地形 sprite 正向线索。口径澄清：按 (c)「退化」而非「硬拒」；solid-only 是票 06 抓的修正。
- [06 免费验收闭环](issues/06-free-acceptance.md)：三批 audit（`recipe-config-acceptance.test.ts`）零硬失败 +
  `pnpm test:playable` 全绿（offline E2E）。⚠️ 抓到票 05 的 decor 误伤并修掉。`pnpm test` 1853 绿、零付费。
- [08 drawlist 九宫格 UI 截断](issues/08-drawlist-truncation.md)：**诊断 = 模型侧随机截断，不是传输/预算**（三发探针
  证伪 4KB 传输假设：11.5KB 简单 JSON + 6.3KB 真 hud-panel drawlist 都完整）。修法 **C 落地**：`generate.ts` drawlist
  `attempts` 默认 2→4 + witness；B（改走 image）留作降级。
- [09 生图底色偏色](issues/09-image-bg-color.md)：**诊断 = 主体画太大（54%）+ 提示词「占满画面」vs 判据「背景>50%」
  自相矛盾**，不是渐变（渐变只 1.5%）。**修法 B 落地**（用户裁：空间连续性，不引固定比例）：`import.ts` 加
  `edgeConnectedBackground`（四边 flood-fill 众数色+despill），`pack.ts` 删 `>0.5` 改判「剩下的墨连成一块」。
  chest.png 46% 背景 → 1 块 → 通过；「主体=众数」的洞被补上（0 块报错）。全仓 1854 绿。
- [10 compile-runtime 业务校验重试](issues/10-compile-runtime-retry.md)：**模型错重采样 / 确定不重试** ——
  `auditGameConfig`+`auditScreenSpace`（引用/自洽/HUD）移进重采样循环，`auditLayerCoverage`（层覆盖）留循环后
  不重试。与 R12 的 `intent-*`/`*-unsupported` 同思路。witness 2 条，全仓 1855 绿。
- [11 生图长宽比偏差](issues/11-aspect-ratio-drift.md)：**诊断 = 生图层固定 aspect 表撞上宽动画片**（hero 片 8:3，
  `geminiAspect` 挑最近的 16:9 ⇒ 差 +48.8%），是代码问题非模型不照做。**修法 ① 落地**：`sourceSizeObservations` 对
  动画片改比「裁到前景墨迹包围盒」的 AR（+48.8% → +24.8%，<25% 放行）；单帧/背景/母版照旧。全仓 1855 绿。
- [12 compile-runtime 非底边锚点摆法](issues/12-anchor-placement.md)：**诊断 = 铁律 #3 只教「底边中心」摆法**，没教
  anchor≠底边（vehicle 0.5,0.3）怎么摆 ⇒ 模型照底边写 `at.y=地面线`，底边伸出 28px 出界。**落地**：铁律 #3 补
  「anchor y<1 时 `at.y = 地面线 − (1−anchor.y)×高`」。全仓 1855 绿。
- [07 P0-FINAL 付费重跑](issues/07-p0-final-paid-rerun.md)：**失败**（未通过）—— Stage A 三次卡 plan-assets
  （`empty-input` / `schema`，`deepseek-v4-pro` 对大 schema 不可靠，成功率约 1/8）；换 provider 被用户推迟。
  `CAP-E2E-01` 未通过。恢复 = 换 provider（MiniMax / 千问）→ 探针 → plan-only → Stage A。
- [13 empty-input 独立重试档](issues/13-empty-input-retry.md)：落地 —— `EMPTY_INPUT_ATTEMPTS=6` + `planAssets`
  循环改成 empty-input 单独 6 发 / schema 3 发（scope 只 plan-assets）；witness 2 条；全仓 1858 绿。

## Not yet specified

<!-- see "Fog of war": in-scope fog you can't ticket yet; graduates as the frontier advances -->

（无。offline E2E 跑法已由票 06 定：复用 `last-train` fixture 包 + 三批 audit 测试 + `playable-smoke`。）

## Out of scope

- **设计层结构化 HUD/地形需求**（Q1=c 否决）：让 `GameDesignSpec` 显式表达 HUD/地形，不在本图；
  prose layout 的自由度保留。
- **换 provider（文本上游可靠性）**：`deepseek-v4-pro` 对 `emit_asset_recipe` 大 schema 系统不可靠
  （empty-input + schema，约 1/8 成功率）。用户裁定**暂时不切换**；恢复 = 切 MiniMax-M2.7 / qwen3.8-max
  → 探针 → plan-only → Stage A。见 [票 07](issues/07-p0-final-paid-rerun.md)。
  repo 侧替代（`empty-input` 独立重试档）已开 [票 13](issues/13-empty-input-retry.md)。
- **compile-runtime 之外的机制/玩法改动**：本图只修「清单补资源 + 链上闸」，不改 8 条机制行为。
- **设计步 R12 的「不重试」**（付费重跑暴露，票 07 Stage A 卡在这）：`compile-design.ts:288-299` 把 R12 当终局
  结论、**立即抛不重采样** —— 而 `intent-mechanic-missing` 这次是**采样失误**（`avoid-danger` 在 `MECHANICS` 里、
  只是模型漏写），不是「外壳做不了」。修法 = `intent-mechanic-missing` 重采样、`mechanic-unsupported` 才不重试。
  **已修**（本图票 07 顺带落地，`compile-design.ts` + 3 witness），全仓 1854 绿。
- **drawlist 九宫格 ui 截断**：已开 [票 08](issues/08-drawlist-truncation.md) 跟进（诊断 = 模型侧随机截断，修法 C
  `attempts` 2→4 已落地），不在本图。
- **生图层 image 底色偏色**：已开 [票 09](issues/09-image-bg-color.md) 跟进（诊断 = 渐变非偏色，修法倾向 despill 主抠），
  不在本图。
