# 12. Asset Planner：`GameDesignSpec` + `VisualWorldSpec` → `AssetRecipe`

Type: grilling
Status: resolved
Owner: claude (2026-10-05)
Blocked by: 10, 11, 07
Map: ../map.md
> `docs/v2/03-claude-code.md` §12。「旧：Requirement + StyleSpec。新：GameDesignSpec + VisualWorldSpec。」

## Question

这是 `derive` 的**接班人**。要答的是**它和 `derive` 的关系**，以及**风格怎么落进每个资产**。

### 1. 与 `derive` 的同构性 —— 别丢掉那条锁定性质

`CONTEXT.md:81-85` 钉着：

> **Asset Recipe（资源清单）**……**它是文件，先落盘再生产** ——
> 因此「人给的清单」与「从需求推导的清单」在下游**完全同构**（票 28 定形状）。

要答：Asset Planner 的产出**是不是同一份 `asset-recipe/v1`**？
⚠️ 若是，那 `derive` 与它**是不是两个入口写同一种文件**（那就该合并或至少共用写入侧）——
`derivePackMode` 那条教训（`CONTEXT.md:194-195`：写入侧与校验侧各写一份必然漂移）在这里同样适用。

### 2. 风格怎么落到每个资产上

V2 的资产现在有两个视觉来源：`VisualWorldSpec`（世界语法）与 `CharacterDNA`（角色）。
今天 `AssetSpec` 有 `styleId`（`asset-spec.ts:15-25`），而 `styleBrief(style)` 是把整份 StyleSpec
压成一段话喂下游。

要答：R6 之后 **`StyleSpec` 仍是那个被引用的东西**（`styleId` 指向它）吗？
还是 `VisualWorldSpec` 也参与？**两个视觉来源同时存在**，谁对「这个资产长什么样」说了算？

### 3. 资源清单里**不该有**的东西

- ⚠️ **碰撞体**（与票 11 §1 同一处）：若按 [[地形]] 处理，清单里**没有它**。
- ⚠️ **关卡/地图**：`CONTEXT.md:223-225` 钉着「**map / 关卡属于 Game Config，不是一种 Asset**」
  —— drawlist 里没有「实例化另一个资源」这种 op。要答：`GameDesignSpec.levels[].layout`
  怎么变成 `GameConfig`，**不经过清单**（那就是票 14）。
- ⚠️ **背景层**：今天分层背景是 `background` 类资源的 `layers`（`CONTEXT.md:140-146`）。
  `VisualWorldSpec.composition.{foreground,midground,background}` 是不是**直接映射**成三层？
  要答，「三」是不是写死的（今天外壳支持几层？）。

### 4. 判据：清单是**可静态校验**的

今天清单有 schema 校验（重复 id、import/sheet 自洽，`recipe.ts:137-172`）。
新字段（依赖图、策略）要**加进同一处**，不许在 Planner 里另写一份检查。

> ⚠️ **2026-10-02（[票 04](04-contract-character-dna.md) 已关）：清单多了三样东西，且附带两条纪律。**
> ① `assets[].spec.characterId`（**可选**）—— 有角色的资产才写，取值**沿用 `GameDesignSpec` 的实体 id**
>    （不许自己起名：那是第四个事实源）。
> ② `assets[].spec.masterAsset`（**可选**）—— 指向 `AssetRecipe.authoring[].id`。
> ③ 顶层 **`characterRef`**（可选，路径，与 `styleRef` 同形）+ 顶层 **`authoring[]`**（创作态母版）。
> ⚠️ **纪律一：planner 不重复校验 `characterId` 的命中** —— 那是票 15 的 pipeline 统一校验（票 04 Q3）。
> 两处都做就是 `derivePackMode` 那种漂移。
> ⚠️ **纪律二：`AssetSpec.description` / `role` 已降格为资产级**（"待机三帧"），
> **不再表示角色身份** —— 身份归 `CharacterDNA`。票面 §2 问的「两个视觉来源谁说了算」，
> 现在多了一个答案：**角色身份**那一半归 DNA，**世界语法**那一半归 `VisualWorldSpec`。

## Answer

**结论：`derive` 被**合并**掉了 —— `planAssets` 就是它被改写（正合两份 doc 的字面），
而风格从 `VisualWorldSpec` 里抽、R16 的工具调用配一份**新立的 v4 镜像**。**
21 条裁决 · **15 条新测试** · 套件 **906/906**（此前 891）· `tsc -b --force` 干净 ·
两个守卫绿（146 份文档 · 766 条链接）· **19 发变异全部验过会红**。

### 0. 裁决表（两轮）

| # | 轮 | 裁决 | 落点 |
|---|---|---|---|
| 1 | 1-Q1 | **合并为 planner**（票 09/10/11 三次推过来的那一问） | `ops.ts` |
| 2 | 1-Q1 | 命令改名 **`plan`**；MCP 工具改 **`plan_assets`** | `cli.ts` · `server.ts` |
| 3 | 1-Q2 | `styleRef` **指向从 VWS 抽出的那份 `StyleSpec`** —— 配方契约与 `pack` 一行不改 | `ops.ts` |
| 4 | 1-Q2 | `AssetSpec.styleId` **按契约自己的话办**（「一份配方只有一个风格，那个 id 不携带信息……**别砍**」） | 不动 |
| 5 | 1-Q2 | ⚠️ **`VisualWorldSpec` 进生成提示词另开一票** | [票 32](32-vws-in-generation-prompt.md) |
| 6 | 1-Q3 | **碰撞体不进清单**（票 11 已判）—— planner 只需不排它 | 无 |
| 7 | 1-Q3 | **关卡 / 地图不进清单**（它是 Game Config，走票 14） | 无 |
| 8 | 1-Q3 | **背景层不固定三层**（外壳不限层数 ⇒ 写死「三」就是发明一个约束） | `prompt.ts` |
| 9 | 1-Q3 | ⚠️ **`layers[].parallax` 单调性**：人类裁「**暂不升级为 gate**」 | **不做** |
| 10 | 1-Q4 | 调用走 **R16**（强制工具调用 + 过 Zod 才算成功 + 3 次） | `ops.ts` |
| 11 | 1-Q4 | ⚠️ 由此**必须**立一份 **v4 镜像**（`toolInputSchema` 只吃 v4，而配方是 v3） | `recipe-tool.ts` |
| 12 | 1-Q4 | `LedgerStep` **加 `"plan-assets"`、保留 `"derive"`**（删旧值会让历史账解析不过） | `ledger.ts` |
| 13 | 1-Q4 | 工具名 `emit_asset_recipe` · 账 `target = "recipe"`（产物名）· `max_tokens 16_000` | 两个文件 |
| 14 | 1-Q4 | **校验统一由 `recipe.ts` 的 `superRefine`**（planner 不另写一份） | `ops.ts` |
| 15 | 1-Q5 | 真探针 n≈4（授权） | `experiments/plan-first-shot/` |
| 16 | 落地 | **两层判据**：过线形状（v4 镜像）**≠** 过契约（v3）—— 后者才算数 | `ops.ts` |
| 17 | 落地 | 落盘时**改写 `styleRef`**·**拷风格参考图**并设 `referenceImage`（`03 §15` 要的「原图参与」） | `ops.ts` |
| 18 | 落地 | `characterId` / `masterAsset` / `dependsOn` **只产出、不另验**（判据都在契约里） | `prompt.ts` |
| 19 | 探针 | 骨架必须画出**那三个键住在 `spec` 里** | `prompt.ts` |
| 20 | 探针 | 骨架**不写死 `source.kind`**（写死 = 替模型把策略定了） | `prompt.ts` |
| 21 | 探针 | 两处都立成**回归判据**（否则下次会被改回去） | `plan-assets.test.ts` |

### 1. `derive` 的存废（票面第 1 问，也是三张票推过来的那一问）

⚠️ 事实摆齐之后它比我预想的更锐 —— **`derive` 不是一个「子集」，是一个拒绝做 V2 要求它做的事的入口**：
它的提示词写死「**所有资源的 source 都写 `{"kind":"drawlist"}`**……那一项由人后续自己填」，
而 `00 §2.4` 写着「**Asset Generation Strategy 不应该人工决定**，V2 必须允许 LLM 决定」。

⇒ **合并**（(a)），而**落法就是两份 doc 的字面**：`03 §12` 说「**修改**当前 Asset derive 流程」、
`02 Phase 5` 说「**修改现有** `ops.ts` / `prompt.ts`」⇒ `deriveRecipe` **被改写成** `planAssets`，
**写入侧因此天然只有一处**（票面点名的 `derivePackMode` 那个病）。
⚠️ 「清单可以**人手写**」那条锁定性质**不受影响**（8 份 fixture 一字不改照旧解析）。
⚠️ **代价已付**：CLI `derive` → `plan`、MCP `derive_recipe` → `plan_assets`（含 `server.test.ts` 钉着的工具表）、
两份 README 的「两个入口」改写、`fixtures/recipes/*-derived.json`（2 份）成为**历史产物**。

### 2. 风格怎么落到每个资产上（票面第 2 问）

- **配方那一侧**：`styleRef`（路径）是唯一**活**的风格来源；`AssetSpec.styleId` 是它的**死副本**，
  而契约**自己写着别砍** ⇒ 本票不重开那一问。
  **`styleRef` 指向哪份文件**：从 VWS 抽出 `world.style` 落成配方旁边的 `stylespec.json`（`styleRef` 就是它的文件名）
  ⇒ **配方契约一个字不改、`pack` 一行不改**（那份 `vws.style` 原样就是一份 `StyleSpec` —— R6 说的「兼容载体」）。
  ⚠️ 世界的**风格参考图也拷进配方目录**并设成 `referenceImage`：那是 `03 §15` 要的「原图参与」的唯一入口，
  而世界那边的路径是**相对 `visual-world.json`** 的，不拷过来就指不到。
- **一句话的答案**：**「该造哪些资产」由 `GameDesignSpec` + `VisualWorldSpec` 说了算；
  「每个资产长什么样」由 `StyleSpec` 说了算（它是 VWS 内嵌那份的抽取件）；「角色是谁」归 `CharacterDNA`。**
- ⚠️ **而 `VisualWorldSpec` 的**新视图**（六桶 / `materials` / 构图）今天一个消费者都没有** ——
  `03 §15` 与 `02 Phase 8` 都要求「生成 Prompt 必须结合 VisualWorldSpec」，而
  `buildAssetPack` 的入参里**根本没有 VWS**、`imagePrompt(spec, style)` 只拿两样。
  ⇒ **另开一票**（人类裁定）：[`VisualWorldSpec` 进生成提示词：六桶与 `materials` 今天零消费者](32-vws-in-generation-prompt.md)。

### 3. 什么**不该**进清单（票面第 3 问）

- **碰撞体**：票 11 已判（[[地形]]，「不引用任何资源」）⇒ planner 只需**不排它**。
- **关卡 / 地图**：不是资产（`CONTEXT.md` 的 [[Asset Kind]] 钉着）；`levels[].layout` → `GameConfig` 走票 14，**不经过清单**。
- **背景层**：⚠️ **不固定三层**。`00-overview.md:447` 曾把「foreground / midground / background 三层」当事实写，
  而**外壳不限层数**（`shell/scene.ts` 逐层 `DEPTH_BG + i`，唯一隐式上限是实体在 depth 10，而没人强制它）。
  `composition` 的三个 band 是**深度描述**，`layers` 是**滚动平面**（parallax 不同）—— 一层的画面可以横跨两个 band
  ⇒ 写死「三」就是**发明一个约束**（与票 05 砍 `cameraModel` 同一种病）。提示词里明说「层数按画面需要定」。
- ⚠️ **`layers[].parallax` 的单调性判据**：我建议过「立」（契约**自己**给 `parallax` 与**层序**都定义了远近 ⇒
  两者必须同向），**人类裁「暂不升级为 gate」** ⇒ 本票**不做**。理由记在这里：它今天**没有失败先例**。

### 4. 落地形状（票面第 4 问）+ 那条裁定逼出来的代价

| 项 | 定法 |
|---|---|
| 落点 | 改写 `packages/assets/src/ops.ts` 的 `deriveRecipe` → `planAssets`；提示词进 `prompt.ts` |
| 写入侧 | **只有一处**（`parseRecipe` 校验 + `v<N>` + 拷 stylespec/参考图 + 改写两个路径） |
| 协议 | **R16**：`forcedTool` + `parseToolUse` + `STRUCTURED_CALL_ATTEMPTS`(3) 次 |
| ⚠️ **两层判据** | **过线形状（v4 镜像）≠ 过契约（v3）** —— 后者才算数，不过就算 `schema`、照样重采样 |
| `LedgerStep` | `+ "plan-assets"`；**`"derive"` 保留**（历史 `ledger.json` 还要能解析） |
| 工具 / 账 | `emit_asset_recipe` / `target = "recipe"` / `max_tokens 16_000` |
| `characterId` 等 | **只产出、不另验**（票 04 的纪律一 + 票 11 的播下） |
| CLI | `derive` → **`plan`**（输入与语义都变了，名字跟着变）；**不新开**入口 |

⚠️ **那份 v4 镜像（`contracts/src/recipe-tool.ts`）是这条裁定逼出来的**：`toolInputSchema` **只吃 `zod/v4`**
（票 28 的边界），而 `asset-recipe/v1` 是 v3。先例是票 02 给 `StyleSpec` 立的那一份。
它**只镜像形状**（类型/可选性/封口/长度下限/枚举/**默认值**），**一个 `refine` 都不镜像**：
`toJSONSchema` 静默丢掉它们（票 08 实测）⇒ 模型看见的一样；而在两种方言里各写一遍判据
就是 `derivePackMode` 那种漂移。那些 gate（依赖图 · 母版比例 · 九宫格中央区 · 路径字符）的落点是
**装配后**那次 `parseRecipe`。⚠️ **漂移测试盯着形状那一半**，并把那几条 refines 写成**明示例外**。

### 5. 探针（`experiments/plan-first-shot/`，n=4，两轮）

⚠️ **第一轮被我自己的操作污染了**：我让探针与 903 条的全套测试**同时跑**，进程被饿死 ⇒
两发的墙钟是 **960s / 989s**（`SHOT_TIMEOUT_MS` 的定时器在饥饿的进程里根本没按时触发），
量出来的 1/4 **不可信**。那一轮的 4 份 raw 留在 **`raw-contaminated/`**（不删 —— 它抓到了两处真缺陷）。
**第二轮在空载下重跑**：

- **过线形状 4/4 · 过契约 4/4**（失败分布：无）。
- **图约束 4/4 全清**：环 0 · 悬空 0 · 自指 0 · 母版比例不符 0。
- **母版那一环 4/4 都通了**：`authoring[]` 填了 4/4 · 带 `characterId` 的资产 4/4。
- 策略分布（合计）：**`image` 29 / `drawlist` 57** —— 四类都出现（sprite / animation / background / ui）。
- 输出 3270–5292 token（**这是所有步骤里最大的一份产物**）· 12.7–21s/发。
- 服务端自报 `servedModel=deepseek-flash`（请求的是 `deepseek-v4-pro`）—— 代理仍在换模型。

### 6. 落地时量到的（三条，都是「探针/变异比人先发现」）

1. ⚠️ **骨架没画出「那三个键住在 `spec` 里」** ⇒ 模型把 `dependsOn` 放到了 **entry 层**
   （`assets[6]: Unrecognized key: "dependsOn"`），被闭合当场拒。**修法**：骨架画全 + 明说「放错一层会被拒收」，
   并**立成回归判据**。
2. ⚠️ **骨架把 `"source":{"kind":"drawlist"}` 写死了**（那是 `derive` 时代的遗留）⇒ 它在
   **教模型永远选 drawlist**。证据：污染那轮干净的一发是 `drawlist:15 / image:2`，改完是 `drawlist:18 / image:9`。
   ⇒ **等于替模型把策略定了**，与 `00 §2.4` 正面冲突。**修法**：改成 `"drawlist|image|import"` 的占位 + 一句「别照抄成 drawlist」。
3. ⚠️ **判据太弱会被变异抓到**（两发没红，两种病）：
   ① 「默认值一致」那条拿真 fixture 比 `required`，而**那份 fixture 每一条都显式写了它**
   ⇒ 把镜像里的 `.default(true)` 删掉**照样绿**。修法：**先把键删掉**再比默认出来的值，且**点出具体值**（`true` / `{x:false,y:false}`）。
   ② 变异瞄的是「两层」那句，而判据锚的是同段的「放错一层会被拒收」⇒ **源码改了、被测的那句一个字没动**（票 10 那口老坑）。
   修法：**补宽测试**，再把变异重新瞄准。

### 7. 播下

- **`14`（Runtime Compiler）**：你要的 `GameDesignSpec` 现在**有人产了**（票 10），而清单里那些
  `dependsOn` / `masterAsset` / `characterId` 也已经有人写 —— 你的输入齐了。
  ⚠️ 两条差集（`mechanics − profile.mechanics` / `runtimeRequirements − profile.capabilities`）**形式上是你的**，今天恒空。
- **`13`（母版 → DNA → 动画）**：⚠️ 探针实测 **`authoring[]` 4/4 都填得出来**，但**它今天到不了生图那一步** ——
  `pack` 连 `authoring[]` 都够不着（票 11 已播）。「把母版的位图当参考图喂进去」那条管道**仍然归你**。
- **`15`（pipeline）**：① **清单的落点今天没动**（还是 `out/<id>/recipes/v<N>.json`）——
  「移不移进 `run/v<N>/`」**仍然是你的**；② ⚠️ **`characterId` 的统一校验归你**（本票明确不重复验），
  而**母版宽高比那条票 11 已经落进契约的 `superRefine`**（每次解析都跑，你不用再写一份）；
  ③ `gameId` **今天由这一步的模型给出**（清单的 `id`）—— 但 `run/v<N>/` 在 `out/<gameId>/` **底下**，
  所以「一次 `create` 里 id 在哪一步才知道」还是你那一问。
- **`16`（CLI）**：`create` 要串的清单那一步，命令名现在是 **`plan`**（签名 `--design` + `--visual-world`）。
- **`31`（DNA 的产出）**：角色的 `characterId` 现在有真值了（planner 从设计层照抄），你的引用族有东西可解。
- **`17`/`18`/`19`/`22`/`26`/`29`/`30`**：无涉。

### 8. 连带改动（都记账，不是重开 R 表）

`assets/src/ops.ts`（`deriveRecipe` → `planAssets` + `onceThroughTool` + `spentOfTool`；⚠️ 顺带**补回**了被块替换
误删的 `formatSpentCalls` —— `tsc` 当场抓到）· `assets/src/prompt.ts`（规划提示词 + `PLAN_TOOL_*` + 两个 brief）·
**新文件 `contracts/src/recipe-tool.ts`**（v4 镜像）+ `contracts/tests/recipe-tool.test.ts`（漂移测试）·
`contracts/src/ledger.ts`（`+ "plan-assets"`）· `cli/src/cli.ts` · `mcp/src/server.ts` + `mcp/tests/server.test.ts` ·
`assets/tests/text-op-ledger.test.ts`（那一族从「旧协议」搬到「工具调用」，**失败档也跟着换**）·
`assets/tests/plan-assets.test.ts`（新）· `docs/v2/{01,02,03}.md`（§12 / Phase 5 / §6.1 / §14 的 `character-reference` 残留 /
§15 的指针）· `00-overview.md`（§3 图的**输入数**与 §6 **缺的那个节点**一并补上 + §10 的对账表）·
**两份 README**（「两个入口」那句）· `CONTEXT.md`（`Requirement` 的消费者**从三处减到两处** + 新词 [[资产规划]] + [[Asset Recipe]] 的两个来源）。
