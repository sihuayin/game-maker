# Visual Design Compiler V1：锁定 VDS 契约 + SVG 派生视图 + 集成落位（旁轨，只规划不实现）

Labels: wayfinder:map
Tracker: local-markdown
Effort: visual-design-v1

> **本图 2026-10-24 开。** 输入：`docs/v7/中间svg.md`（Visual Design Compiler V1 PRD，待评审）。
> 三岔已裁定（用户 2026-10-24）：① 终点 = 锁死一份可交付实现者的**正式契约 + 集成方案**，不写编译器、不改仓库代码；
> ② **Visual Design Spec 是语义来源，SVG 是派生视图**（不是新创作态）；③ **VDS 拥有视觉构图，GameConfig 拥有玩法几何**，
> 二者在共享子集（实体 id + 粗略 bounds）交叉验证。V1 是**旁轨**（不闸主链）。
> 已核对 PRD §9.2：`resolveRoute` / `source.kind` 真存在，`GameCreationState` 是死词（全仓无此符号）。

## Destination

把 Visual Design Compiler V1 从「待评审 PRD」走到「**清楚到可交付实现者**」：锁死
**Visual Design Spec 的正式契约**、**SVG 派生视图规则**、**确定性验证 + 语义覆盖的判据/观察清单**、
以及**集成落位**（`run/vN`、旁轨接缝、`VisualDesignCompiler.compile` 逻辑入口）。本图**不写编译器、不改仓库代码**。

## Notes

- **PRD 输入**：`docs/v7/中间svg.md`。领域词汇以 `CONTEXT.md` 为准（`docs/文档.md` 是旧规格，别引用它的措辞）。
- **管线事实**（fact-finder 2026-10-24，file:line 已核）：
  `visual-world → intent → design → character-dna → recipe → pack → config → qa → (site)`。
  关键落点：`create-game.ts:40-41`（UNDERSTANDING_STEPS / BUILD_STEPS）、`compileDesign`（game-design）、
  `planAssets`（`ops.ts:320`）、`compileRuntime`（`ops.ts:1004`，唯一产 GameConfig 处）、
  `raster.ts:120`（DrawList→PNG，确定性、逐字节可重放）、QA 族 `packages/qa/src/{visual,gameplay,intent}.ts`。
- **核心缺口（PRD §1 的真凭据）**：整条链**没有任何「生图/编 config 之前」的合成预览** —— 人只能在最终 site 第一次看到合成画面。
- **三岔裁定（本图不许推翻）**：VDS=语义来源 / SVG=派生视图；VDS=视觉构图 / GameConfig=玩法几何；V1=旁轨不闸。
- **判据 vs 观察**：沿用 `CONTEXT.md`「观察/判据」分界 —— 判据 = 构建期硬失败（「错了一定不是设计」）；观察 = 只报不阻断。
- **工作树纪律**：不改 `fixtures/`、`game-maker.local.json`、不改仓库代码（本图只规划）；产物只写本 effort 目录或 `out/`。

## Decisions so far

<!-- the index: one line per closed ticket, enough to judge relevance, then zoom the link for the detail the ticket holds -->

- [01 VDS 坐标系统与设计画布](issues/01-coordinate-system.md)：VDS `bounds` 用**视口（屏幕空间）坐标系** = 现有 480×270 外壳常量（`draw.ts:15`）；「设计画布 / Target Viewport」= 与视口同尺寸、**1:1 无缩放**。PRD 的 `1280×720` 是非规范占位（示例 JSON 明说不是契约）；任何别的值都会逼出非整数下采样（×0.375）、打破「整数从创作态到屏幕不重采样」的不变量（`CONTEXT.md:611`、`game-config.ts:21-24`、`raster.ts:121`）。设计画布→交付态因此**不是缩放步**；资产后唯一步骤是票 07 的交叉验证。
- [02 管线接缝与版本落位](issues/02-pipeline-seams-versioning.md)：插入点 = `say("recipe")` 前（`create-game.ts:365`），VDS 读 `game-design.json` + `visual-world.json`（与 `planAssets` 同两个文件）、写 staging，是 file-in/file-out 一步。`commitRun` 单次 `renameSync`（`run.ts:83`）⇒ staging 任意树（含 `visual-design/{svg,preview}/`）原子落 `run/vN/`、「失败不占号」免费继承（写 `run.tmpDir` 即可）。**不许动**：`resolveRoute`/`source.kind` 真、`GameCreationState` 死词，另不碰 `pack` 语义、`GameConfigSchema`（`EntityKind` 封闭枚举 `:50`）、原子提交规则。`sourceIntent` 原样复用 GameDesignSpec 实体 id（稳定一对一链、非封闭枚举）。
- [03 Visual Design Spec 正式契约](issues/03-vds-contract-schema.md)：顶层 `format:"visual-design/v1"` + `viewport`=壳 `VIEWPORT`(480×270) + `style`(仅出处指针，不重写色板) + `objects[]`；对象 `{id, role, bounds, layer, fill:palette:N, sourceIntent}`。人裁四条：`role` = `{player}∪EntityKind∪{background,ui-panel,ui-pip}`(11 值) · `visualRef` 砍(V1) · `layer` 逐对象 z 序 · 判据/观察分档。资产 [03-vds-contract-draft.md](assets/03-vds-contract-draft.md)。
- [04 VDS↔GameDesignSpec 覆盖契约](issues/04-vds-gamedesign-coverage.md)：实体覆盖 = 只按 id 的集合差，`D`=设计实体 id、`S`=带 `sourceIntent` 的 VDS id 集；**缺失 `D∖S`** 与**悬空 `S∖D`** 都是硬失败 ⇒ `S=D`(集合)。多对象命中同一实体允许；`mechanics[]` 不进覆盖(归 `mechanic-coverage`)、`role↔kind` 归票 07、无 `sourceIntent` = 装饰不判。
- [05 SVG 派生视图 + 安全白名单](issues/05-svg-derived-view-whitelist.md)：`render(VDS,palette)` = 1 object→1 `<g id>`+`<rect>`，`layer`=文档序(升序)、`fill`=`paletteColor` 解析 hex(∈色板)；白名单 `<svg>/<g>/<rect>`+10 属性。人裁：`data-role` 砍、一份 `scene.svg`、只 `<rect>`。资产 [05-svg-derived-view-whitelist.md](assets/05-svg-derived-view-whitelist.md)。
- [06 确定性验证判据/观察清单](issues/06-deterministic-validator.md)：§8.1 八条**全判据**（无观察）；VDS↔SVG 一致性 = VDC 自有 validator（与 `audit*` 并行不复用），跨契约（`sourceIntent` 覆盖/`role↔kind`）遵循 `audit*` 中性函数模式（代码接缝由对应 ticket 确认）。顺序 = 语法→安全白名单(前置门)→一致性四项→PNG→文件清单；安全失败不继续处理、XML 禁外部实体/资源加载。
- [07 VDS↔GameConfig 交叉验证](issues/07-vds-gameconfig-crosscheck.md)：join 键 = 实体 id；身份判据（新判据，`role↔kind` 串桶 + `sourceIntent` 缺失，都硬失败，落视觉族，`QA_JUDGEMENTS` 6→7）；几何观察（只比尺寸 w/h、无阈值、描述性措辞）。

## Not yet specified

<!-- see "Fog of war": in-scope fog you can't ticket yet; graduates as the frontier advances -->

- **人工批准设计稿的交互（P1）**：VDS 契约定形后，批准/驳回的交互、对旁轨产物的回写方式才会变清晰。
- **局部设计修改（P1）**：同一件事的「改一处重跑」如何表达，挂在 VDS 契约与版本落位之后。

## Out of scope

<!-- see "Out of scope": work ruled beyond the destination; closed, never graduates -->

- **主观视觉审查（PRD §8.3）**：视觉模型/人工的风格一致性评分 —— 属 QA 族扩展，另开一张 QA 地图，不在「编译器契约」这张图里（Q9）。
- **SVG 直接驱动 AssetRecipe / GameConfig（PRD §3.1 P2、§15）**：后续阶段，不是 V1 必要条件。
- **「闸」（gating）**：V1 是旁轨；把 VDS 变成主链强制第 N 步，留给将来单独一张图（Q5）。
- **CLI 命令名**（`game-maker visual-design`）：实现细节，defer；本图只在集成方案里给逻辑入口 `VisualDesignCompiler.compile`。
- **写编译器本身**：Q4 只规划不实现，编译器交给实现者。
- **Benchmark 验收（PRD §12.4）**：固定废土寻宝输入的基准测试，属实现/验收阶段，不在契约图里。
