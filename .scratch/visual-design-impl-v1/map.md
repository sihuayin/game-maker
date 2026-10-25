# Visual Design Compiler V1 实现：确定性布局 → VDS → SVG → PNG → 校验 → 交叉验证（旁轨，承载执行）

Labels: wayfinder:map
Tracker: local-markdown
Effort: visual-design-impl-v1

> **本图 2026-10-24 开。** 前置：`visual-design-v1` 已 7/7 收口（契约 + 集成方案锁死）。
> 本图是它的**执行图**（覆盖 wayfinder「只规划」默认）：把锁定的契约落成**能跑的 `VisualDesignCompiler`**。
> 输入 PRD：`docs/v7/中间svg.md`；领域词汇以 `CONTEXT.md` 为准（`docs/文档.md` 是旧规格）。
> 事实基准：`assets/codebase-facts.md`（recon 2026-10-24，file:line 已核）。
>
> **终点三岔已裁定（用户 2026-10-24）**：Q1 真实 E2E（b）· Q2 全 P0 收敛版（a）· Q3 确定性纯结构布局（a）。
> **边界四岔已裁定（用户 2026-10-24）**：Q4 分开放（contracts / visual-design / qa）· Q5 零依赖手写（a）·
> Q6 纯结构不碰自由文本（a）· Q7 不加 CLI（a）。测试 = Vitest + TDD + 一条真实 E2E；枚举复用 `EntityKind`。
> ⚠️ **唯一不锁死**：桶→`EntityKind` 映射（尤其 `npcs`/`resources` 无对位），在票 02 按真实定义确定，
> 无法可靠映射要明确处理，**不随意选值过判据**。

## Destination

把 `visual-design-v1` 锁定的契约+集成方案落成**可运行的 Visual Design Compiler V1**：确定性纯结构布局 →
`visual-design.json`（VDS）→ `scene.svg` → `preview.png` → 确定性 validator → VDS↔GameConfig 交叉验证，
作为**旁轨**接入现有 `create` 链（`design` 后、`recipe` 前），产物原子落 `run/vN/`。
**验收 = 一条真实 E2E run**（fixtures 废土风格图+意图）走完整条主链，产出完整 visual-design 产物 +
判据全绿 + 单测绿。

## Notes

- **已锁定契约**（`../visual-design-v1/map.md` 的 Decisions-so-far 是权威，本图不推翻）：坐标 = 视口
  480×270、1:1 无缩放（票 01）；接缝 = `say("recipe")` 前、读 `game-design.json`+`visual-world.json`、
  file-in/file-out、`commitRun` 单次 `renameSync`（票 02）；VDS 顶层 `format:"visual-design/v1"` +
  `viewport` + `style`（仅出处指针）+ `objects[]`，object `{id,role,bounds,layer,fill:palette:N,sourceIntent}`
  （票 03）；覆盖 = 只按 id 集合差，缺 `D∖S` 与悬空 `S∖D` 都硬失败（票 04）；SVG 派生 = 1 object→1
  `<g id>`+`<rect>`、layer=文档序、fill=paletteColor、白名单 `<svg>/<g>/<rect>`+10 属性、只 `<rect>`、
  单 `scene.svg`（票 05）；validator = §8.1 八条全判据、VDC 自有（票 06）；交叉验证 = join 实体 id、
  身份判据（`role↔kind` + `sourceIntent` 缺失，硬失败，视觉族，`QA_JUDGEMENTS` 6→7）+ 几何观察（票 07）。
- **关键事实**（`assets/codebase-facts.md`，file:line 已核）：GameDesignSpec **零几何**（`game-design.ts:124-208`，
  4 桶 enemies/npcs/interactables/resources + player + mechanics[]，全是 id + 自由文本）；palette =
  `VisualWorldSpec.style.palette`（32 项 index-addressed `#rrggbb`，`visual-world.ts:63-68`）；`EntityKind`
  7 值 `solid/pickup/hazard/goal/chest/danger/decor`（`game-config.ts:50`）；`RUN_ARTIFACT` **10** 键
  （`artifacts.ts:14-26`，注意锁定文档写「9」已漂移）；`QA_JUDGEMENTS` 6 项（`qa.ts:110-152`）；
  **全仓无 XML parser / SVG 栅格化器**（§9）。
- **三个实现约束（用户逐字，不许打折）**：
  1. **零依赖 ≠ regex 查 SVG** —— 手写白名单解析器必须正确处理 XML 基本语法、属性解析、转义、重复属性、
     非法结构；不能只靠正则找 `<rect>`/`id`。若最小解析器证明不了满足契约，零依赖不是天然最优（先针对性验证，
     不自动引 native 依赖）。
  2. **纯结构布局必须覆盖 + 非退化** —— 同输入逐字节一致；每实体 ≥1 object；默认坐标不全部重叠；增删实体不
     搅乱既有 id 映射；特殊角色 vs 七值 `EntityKind` 边界正确；background/实体/UI 按确定 layer 排序。
     不求漂亮构图，但必须有效、可验证、非退化。
  3. **真实 E2E 走整条 create 主链**（不只调 compiler）—— 记录命令、退出码、run 路径、检查实际产物；
     覆盖包注册+依赖方向、GameDesignSpec→VDS 真实输入、SVG/PNG/QA 落盘、交叉验证、run 版本+原子提交。
     单测与真实 E2E 不互替。
- **包落点（Q4）**：`packages/contracts/src/visual-design.ts`（VDS schema）；新包 `packages/visual-design/`
  （layout / SVG serialize / PNG render / validator）；`packages/qa/`（交叉验证判据 + finding 装配）。
  新包只依赖 `@game-maker/contracts`，不反依赖 pipeline/QA（R11）。
- **零新依赖（Q5）**：PNG 用 `raster.ts`+`png.ts` 手写（无 AA、逐字节可重放）；SVG 确定性序列化；二者同源一份
  矩形绘制指令，一致性由 validator 兜底（**不许因同源就省一致性验证**）。
- **工作树纪律**：本图改仓库代码（执行），但**不动** `fixtures/`、`game-maker.local.json`、不 `reset`/`clean`；
  不提交/推送除非单独授权；`create` 链含**付费 LLM 调用**，先书面预算+逐字授权才跑（`p0-final-v1` 同款纪律）。
- **证据分级**：E0 推测 / E1 源码 / E2 测试 / E3 真实产物 + 运行证据（命令 + 退出码 + 路径）。

## Decisions so far

<!-- the index: one line per closed ticket, enough to judge relevance, then zoom the link for the detail the ticket holds -->

- [01 Visual Design Spec 契约 schema 落码](issues/01-vds-contract-schema.md)：`contracts/src/visual-design.ts` 落码（zod/v4）—— `format:"visual-design/v1"` + `viewport`（只验形状，值注入）+ `style`（仅 `visualWorldFormat` 出处指针）+ `objects`（min(1)）；object `{id,role,bounds,layer,fill:PaletteRefShape,sourceIntent?}`；`role` 从 `EntityKind.options` 派生（单一来源，漂移测试盯着）。唯一 superRefine = id 不重复；跨文件悬空引用（palette 越界 / sourceIntent 悬空）归装配/QA 步（票 07）。14/14 测试 + 全仓 typecheck 绿。
- [02 确定性纯结构布局算法](issues/02-layout-algorithm.md)：Q1 裁定 role = **视觉分组默认**（enemies→hazard · npcs→decor · interactables→pickup · resources→pickup），identity 判据改「设计桶↔kind 家族」（枚举表已写入票 07）。`layout.ts` 落码：分栏+固定地面线、容量检查、layer 0/10+/100/110、fill 语义桶 ref + 空桶回退。包脚手架（package.json/tsconfig）本票先建。11/11 测试 + wasteland 真夹具过 schema。
- [03 SVG 序列化 + 最小白名单解析器](issues/03-svg-serializer-parser.md)：`svg.ts` 落码——`serializeVds(vds,palette)`（确定性、layer 升序、id 转义、越界 fill 抛错）+ `parseWhitelistedSvg`（**字符级状态机，非 regex**）。白名单 3 元素 + 10 属性；处理转义/重复属性/非法结构；DOCTYPE/script/foreignObject/onclick 全拒。24/24 测试。

## Not yet specified

<!-- see "Fog of war": in-scope fog you can't ticket yet; graduates as the frontier advances -->

- **人工批准设计稿的交互（P1）**：VDS 落盘后批准/驳回如何回写，等 VDS 契约 + 落位稳定后才清晰。
- **局部设计修改（P1）**：同一件事「改一处重跑」如何表达，挂 VDS 契约 + 版本落位之后。

## Out of scope

<!-- see "Out of scope": work ruled beyond the destination; closed, never graduates -->

- **主观视觉审查（PRD §8.3）**：视觉模型/人工风格一致性评分 —— 属 QA 族扩展，另开 QA 图（`visual-design-v1` Q9 已划）。
- **SVG 直接驱动 AssetRecipe / GameConfig（PRD §3.1 P2、§15）**：后续阶段，不是 V1 必要条件。
- **「闸」（gating）**：V1 是旁轨；把 VDS 变主链强制第 N 步，留将来单独一张图（`visual-design-v1` Q5 已划）。
- **CLI 独立命令 `game-maker visual-design`**：defer；本图只给逻辑入口 `VisualDesignCompiler.compile`。
- **LLM 提候选 VDS**：本图确定性（Q3 已裁）；LLM 生成留 P2。
- **解读 `world.structure` / `levels[].layout` 的语义布局**：本图纯结构（Q6 已裁），语义摆放留 P2。
