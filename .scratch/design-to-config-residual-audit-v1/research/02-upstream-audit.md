# 02 上游审计：plan-assets / recipe 职责与上下游闭环

- 日期：2026-11-02
- 范围：`plan-assets` → recipe → pack → `compile-runtime` 的上游规划与下游消费链路
- 性质：**只读源码审计**；未修改生产代码、提示词、测试、fixture、契约
- 证据分级：E0 推测 / E1 源码 / E2 测试 / E3 真实产物 + 运行证据

---

## 0. 结论先行

**对 2026-10-23 的五条历史硬失败，上下游闭环已经成立；对“设计对资源的所有要求”，没有完全闭环。**

- **E01 / E02（玩家资源当地形块 / 斜坡）已关闭（下游确定性拒绝；规划层无正向闸）**：`solid → ["sprite"]` 的 kind 锁在构建期确定性拒绝（E2 `packages/contracts/tests/game-config.test.ts:181-185`），错误从“多动画缺 anim”变成“是 animation，这里要的是 sprite”（E1 `packages/contracts/src/game-config.ts:366-374`）。正向地形 sprite 由提示词引导，真实付费跑已产出 `ground-tile` / `rubble-pile` / `broken-wall` / `cracked-plate`（E3 `.scratch/recipe-config-gap-v1/runs/2026-10-23-p0-final/wasteland-scavenger-assets/run/v1/asset-recipe.json:176-259`）。
- **E03 / E04 / E05（HUD 缺 ui / 尺寸不匹配）已关闭**：设计声明 `hud:screen-space` 时，`hudUiGate` 在**任何生图之前**拒绝缺 ui 的清单（E1 `packages/assets/src/ops.ts:300-314`、`:482-488`；E2 `packages/assets/tests/plan-hud-gate.test.ts:59-89`）；下游 `hud.panel` / `hud.pip` 的 `["ui"]` kind 锁与 `auditPanelSize` 兜底（E1 `packages/contracts/src/game-config.ts:373-374`、`:404-420`）。真实付费跑已产出 `hud-panel`（32×32，ninePatch 8/8/8/8）与 `hud-pip`（12×12）（E3 同上 recipe `:323-365`）。
- **但仍有残余**：
  1. `hudUiGate` 只在设计 `runtimeRequirements` 含 `hud:screen-space` 时触发；设计能力数组可以为空（E1 `packages/game-design/src/prompts.ts:284`、`packages/contracts/src/game-design.ts:199-205`）。此时清单可以没有 ui，而 GameConfig 的 `hud` 是结构必填（E1 `packages/contracts/src/game-config.ts:223`）。E3 实测：去掉 `hud:screen-space` 的历史设计 + 无 ui 的历史清单，`planAssets` 1 发通过。
  2. 地形 prop 只有提示词正向线索，没有规划期闸（E1 `packages/assets/src/prompt.ts:986-989`）。清单没有任何地形 sprite 时 `planAssets` 仍通过（E3 实测），下游只能退化成看不见的 `terrain`；这是前序票 03 明确选择的 (c) 退化路径，不是硬失败。
  3. 重采样是**盲重采样**：plan-assets 与 compile-runtime 的重试复用同一份 prompt，不把上一发的错误反馈给模型（E1 `packages/assets/src/ops.ts:412-429`、`:1086-1167`；E3 实测三发请求体逐字相同）。系统性错误（如实体出界）三发仍失败，最终靠确定性钳位 `clampToWorld` 解决（E3 `stage-b-retry6.log:17-22`；E1 `ops.ts:1027-1037`、`:1187-1189`）。

**是否需要在 plan-assets 新增闸门：不需要。**

- 五条历史失败已分别由现有规划期闸门与下游 kind 锁覆盖，新增闸门只会重复已有判据。
- 残余的 HUD 条件触发问题属于**现有 `hudUiGate` 触发条件过窄**（或设计层结构化 HUD 表达能力缺失），应改条件/改设计层，而不是新增第二个 ui 闸。
- 地形 prop 的正向产率属于前序裁定接受的退化路径；为“必须产地形 sprite”新增闸会与票 03 的 (c) 裁定冲突，也超出 `GameDesignSpec` 现有表达能力（前序地图明确把「设计层结构化 HUD/地形需求」列为 out of scope：`.scratch/recipe-config-gap-v1/map.md:92`）。
- 其余残余（人工改清单后的复验、盲重采样、未加锁的实体 kind）分别属于 pipeline 复用现有闸、重采样反馈、下游契约范围，不是 plan-assets 新闸能解决的。

---

## 1. `plan-assets` 与 recipe 的职责边界

### 1.1 两层是什么

| 层 | 职责 | 关键证据 |
|---|---|---|
| `AssetRecipe`（recipe） | **要做什么**：纯意图 + 帧来源；`spec` 描述资源本身，`source` 说怎么造 | E1 `packages/contracts/src/recipe.ts:1-20`、`:379-382` |
| `plan-assets` | **把设计读成清单**：LLM 工具调用 → 过契约 → 确定性闸门 → 路线决策 → 母版兜底 → 落盘 + plan sidecar | E1 `packages/assets/src/ops.ts:370-640` |
| plan sidecar | **记录**每件资源的最终路线与理由（`asset-plan/v1`）；不反向影响 recipe | E1 `packages/contracts/src/asset-plan.ts:1-82`、`ops.ts:595-613` |
| `pack` / `compile-runtime` | 消费 recipe / pack manifest；不消费 plan sidecar | E1 `packages/pipeline/src/create-game.ts:390-400`、`:592-600` |

因此：**recipe 是输入也是输出**（模型产出的候选清单经闸门、路线改写、母版兜底后成为最终清单）；plan sidecar 只是账，不是下游语义来源。

### 1.2 输入

`planAssets` 的实际输入（E1 `ops.ts:83-107`、`:370-415`）：

- `designPath`：`GameDesignSpec`；经 `GameDesignSpecSchema.safeParse`。
- `visualWorldPath`：`VisualWorldSpec`；经 schema，并做空色板判据（`emptyPaletteProblem`，CAP-SPEC-17）。
- `outRoot`、`transport`、可选的 `imageTransport`、`existingAssets`、`viewport`（`PlanAssetsOptions` 有这一格；但 create 链拿不到，见下）。
- `viewport` 默认 `DEFAULT_VIEWPORT`（480×270），只用于背景覆盖闸与提示词。

> ⚠️ 上游一致性小缺口：`UnderstandingInput` **没有** `viewport` 字段（E1 `create-game.ts:48-77`），`viewport` 只在 `BuildInput` 里（`:109-128`；`CreateInput = UnderstandingInput & BuildInput`，`:177`）。`runUnderstanding` 的 `planAssets` 调用因此拿不到它（`:390-400`），只能用 `DEFAULT_VIEWPORT`；而 `compileRuntime` / site 用 `input.viewport`（`:598`、`:645`）。`ops.ts:97-101` 的注释写着「create 链两处都传 `input.viewport ?? DEFAULT_VIEWPORT`」，与代码不符。默认 480×270 时无影响；自定义视口时规划期背景闸与下游层覆盖会用两个数。

### 1.3 设计需求 → 资源规划的实际映射

| 设计层事实 | 规划期如何映射 | 确定性？ | 证据 |
|---|---|---|---|
| `player.id` | 必须有**恰好一件** `kind:"animation"`、`characterId == player.id`、三路 `idle/run/jump`、每路 ≥2 帧 | **是**（`playerAnimationGate`） | E1 `ops.ts:215-259`、`:493-499` |
| `enemies[] / npcs[] / interactables[] / resources[]` 的每个 id | 某件资产的 `spec.id` **或** `spec.characterId` 逐字等于它；**不看 kind** | **是**（`designCoverageGate`） | E1 `ops.ts:266-286`、`:472-478` |
| `runtimeRequirements` 含 `hud:screen-space` | 至少一件带 `ninePatch` 的 `ui` + 至少一件不带 `ninePatch` 的 `ui` | **是**（`hudUiGate`，条件触发） | E1 `ops.ts:300-314` |
| `runtimeRequirements` 的其他能力 | **不映射到任何资源**；只被设计层 R12 求差 / plan sidecar 记录 | 不适用 | E1 `ops.ts:294-301`、`packages/game-design/src/build-design.ts:156-159`；plan-assets 内只有 `ops.ts:301` 与 `prompt.ts:919` 两处读取，设计层另有 R12 求差（`build-design.ts:156-159`） |
| `levels[].layout` / `world.structure` 散文 | 作为提示词文本交给模型（`designBrief`），并给一条“需要看得见的静态碰撞体就产 sprite”的线索；**没有结构化解析或闸** | **否** | E1 `prompt.ts:854-871`、`:986-989` |
| 视口 / 背景 | 背景尺寸、层视差、平铺写入提示词，并由 `backgroundCoverageGate` 判 | **是** | E1 `prompt.ts:980-985`、`ops.ts:336-358` |
| `design.game.runtimeProfile` | 只用于 sidecar 的能力快照与路线上下文；不产出资源 | 不适用 | E1 `ops.ts:131-139`（`plannerCapabilitiesOf`） |
| `levels[].entities[]` | 不单独映射；设计 schema 已保证它们解得到 player 或四桶，四桶由覆盖闸统一覆盖 | 间接 | E1 `packages/contracts/src/game-design.ts:176-190`、`:309-322` |
| `mechanics[]` / `winConditions[]` / `loseConditions[]` | 只进提示词散文，不进闸 | **否** | E1 `prompt.ts:854-871` |

> 结论：**plan-assets 只对“Runtime 契约真正强制的槽位”做确定性映射**（player / solid / hud / background + 四桶存在性）。PRD 的九类语义槽位中，enemy / pickup / chest / hazard / danger / decor 在 Runtime 契约里没有 asset-kind 强制（`kind` 是行为，不是资源类型），所以规划期也没有对应 kind 闸；slope 在 GameConfig 中没有独立槽位（E1 `packages/contracts/src/game-config.ts:45-53`、`:220-221`），只能落成 `solid` 或 `terrain`。

### 1.4 提示词

`assetPlanPrompt`（E1 `prompt.ts:899-993`）插入：

1. `designBrief(design)`：标题、题材/镜头、核心循环、玩家、四个桶、世界三段、**每关 layout 与 entities**（`prompt.ts:854-871`）。
2. `hud:screen-space` 条件块：要求两件 ui（带 ninePatch 面板 + 不带 ninePatch 图标）（`prompt.ts:919-923`）。
3. `worldBrief(vws)`：视觉身份、空间分层、六桶色板、材质、角色共同长相、环境（`prompt.ts:874-893`）。
4. 背景尺寸/平铺规则（`prompt.ts:980-985`）。
5. 地形/台阶线索：`solid` 只能引 `sprite`，layout 需要可见静态碰撞体时产一件 sprite（`prompt.ts:986-989`）。
6. `recipeShapeSpec()`：每类 spec 允许的键与形状（`prompt.ts:609-646`）。

工具线 schema 是 `RecipeToolSchema`（v4 镜像，E1 `packages/contracts/src/recipe-tool.ts:1-20`）；真正的契约是 v3 的 `parseRecipe`（E1 `recipe.ts:379-382`）。镜像不复制 `refine`，所以“线形状过了”不算数（E1 `recipe-tool.ts:12-19`）。

### 1.5 确定性闸门

| 顺序 | 闸门 | 判据 | 失败档 | 证据 |
|---|---|---|---|---|
| 0 | 入口 | 设计/世界 schema、空色板、凭据 | 不重试 | E1 `ops.ts:378-405` |
| 1 | 线形状 | `RecipeToolSchema` | `schema` 可重采样 | E1 `ops.ts:443-449` |
| 2 | v3 契约 | `parseRecipe`（依赖图、母版比例、九宫格中央区、层名/动画名唯一、路径） | `schema` 可重采样 | E1 `recipe.ts:379-382` |
| 3 | `frames` 候选 | `source.kind:"frames"` 明确失败 | `invalid`，**不重采样** | E1 `ops.ts:458-468` |
| 4 | 四桶覆盖 | `designCoverageGate`：id/characterId 精确相等 | `schema` | E1 `ops.ts:266-286`、`:472-478` |
| 5 | HUD ui | `hudUiGate`：条件 + 两类 ui | `schema` | E1 `ops.ts:300-314`、`:482-488` |
| 6 | 玩家动画 | `playerAnimationGate` | `schema` | E1 `ops.ts:215-259`、`:493-499` |
| 7 | 背景覆盖 | `backgroundCoverageGate` | `schema` | E1 `ops.ts:336-358`、`:503-508` |
| 8 | 路线决策 | `resolveRoute` + 参考图能力 | `usage`/`invalid`，不重采样 | E1 `ops.ts:527-562`、`packages/assets/src/route.ts:80-118` |
| 9 | 终稿 | 母版兜底后 `parseRecipe(finalRecipe)`；plan sidecar `parseAssetPlan` | `invalid`，不重采样 | E1 `ops.ts:520-600` |

**没有地形 prop 闸、没有“目标/出口资源”闸、没有四桶的 kind 闸、没有“设计无拾取物但 config 必须有 pickup”闸。**

### 1.6 重采样 / 失败分档

- 重试次数：`empty-input` 6 发，其余坏档 3 发（E1 `packages/contracts/src/structured-call.ts:25`、`:37`；`ops.ts:421-424`）。
- 失败闭集：`http / timeout / truncated / invalid-json / no-tool-use / empty-input / schema`（E1 `structured-call.ts:70-78`）。
- **所有规划期业务闸都记成 `schema`**（E1 `ops.ts:474`、`:484`、`:495`、`:505`）。账上 `failures` 看不出是哪一道闸，只有最终 message 能区分。
- 盲重采样：`prompt` 在循环外构造一次，循环内原样复用（E1 `ops.ts:412-429`）；`lastError` 只写进最终异常，不进入下一次请求。
- 不可重采样：`frames` 候选、路线决策失败、终稿 schema、plan sidecar schema、入口 schema/空色板/凭据。
- 下游 `compile-runtime`：schema、引用、自洽、实体身份、HUD 屏幕空间在循环内重采样 3 发（E1 `ops.ts:1162-1209`）；层覆盖在循环外、不重采样（`:1219-1234`）。

---

## 2. `hudUiGate` 的实际覆盖范围

### 2.1 触发条件

E1 `ops.ts:300-301`：

```ts
function hudUiGate(recipe, design) {
  if (!design.runtimeRequirements.includes("hud:screen-space")) return null;
```

**唯一触发条件是设计 `runtimeRequirements` 含 `hud:screen-space`。** 设计层没有其他结构化 HUD 字段；`winConditions` / `coreLoopSteps` / `levels[].layout` 里的 HUD 文字不会触发。

### 2.2 要求产出的精确形态

E1 `ops.ts:302-314`：

- 从 `recipe.assets` 里取 `kind:"ui"`。
- “面板” = `ninePatch !== undefined` 的 ui，**至少 1 件**。
- “图标” = `ninePatch === undefined` 的 ui，**至少 1 件**。
- 不检查 id、role、尺寸、anchor、是否同一件、是否被 config 引用。
- 不检查 `hud.panel.size` 是否装得下 pip；不检查 pip 数量与面板尺寸的关系。

契约层的形状（E1 `packages/contracts/src/asset-spec.ts:15-28`、`:154-165`、`:231-237`）：

- `UiSpec = { kind:"ui", ...COMMON, ninePatch?: {left,right,top,bottom} }`；`COMMON` 含 `id/role/description/styleId/anchor/size/required`。
- `ninePatch` 四边是非负整数；`left+right < size.w` 且 `top+bottom < size.h`，否则中央区为空，契约拒绝。
- `ui` 不能声明动画（`UiSpec` 是 strict，`animations` 进不来）。

下游对 HUD 的真实硬要求（E1 `game-config.ts:194-198`、`:373-374`、`:404-420`）：

- `hud.panel.asset` / `hud.pip.asset` 都必须是 `kind:"ui"`。
- `hud.panel.size` 与资源尺寸：**九宫格放行任意声明尺寸；非九宫格必须相等**。
- `hud.pip` 不在 config 里声明尺寸，用包里资源尺寸；`gameHudScreenItems` 按 `pickupCount` 逐个算 pip 盒子并查视口（E1 `packages/contracts/src/screen-space.ts:86-104`）。

> 所以 `hudUiGate` 比下游**略严**：下游只要求两件 ui；闸额外要求“面板必须九宫格、图标必须非九宫格”。这是为了让面板可拉伸、pip 固定尺寸；不是 schema 强制，是规划约定。

### 2.3 与 `designCoverageGate` 的分工

| | `designCoverageGate` | `hudUiGate` |
|---|---|---|
| 管的输入 | 设计四桶 `enemies/npcs/interactables/resources` | 设计 `runtimeRequirements` 的 HUD 能力 |
| 判据 | 每个 id 有资产的 `id` 或 `characterId` 逐字相等 | ui 的 `kind` + `ninePatch` 两类各 ≥1 |
| 看 kind 吗 | **不看** | **只看 kind / ninePatch** |
| HUD 吗 | 不涉及 | 只涉及 |
| 触发 | 总是（数组空则无要求） | 条件（`hud:screen-space`） |
| 复用 | 导出；`runBuild` 也复用 | **未导出**；只在 `planAssets` 循环内跑 |
| 证据 | E1 `ops.ts:266-286`；E2 `plan-coverage-gate.test.ts:55-100` | E1 `ops.ts:300-314`；E2 `plan-hud-gate.test.ts:53-89` |

两者**不重叠**：四桶是设计实体，HUD 是外壳槽位。

### 2.4 哪些设计声明下**不会**触发

1. `runtimeRequirements` 不含 `hud:screen-space`。设计提示词明确允许“没有就留空数组”（E1 `packages/game-design/src/prompts.ts:284`），设计 schema 也允许空数组（E1 `packages/contracts/src/game-design.ts:199-205`）。
   - E2 证据：`plan-assets.test.ts` 的 `DESIGN` 只声明 `["input:keyboard"]`（`:55`），配方用 `fixtures/recipes/shift-change.json`（`:16`）——该配方**没有任何 ui 资源**，整套 18 个测试照常通过。
   - E3 证据：历史设计去掉 `hud:screen-space`、历史清单去掉一件坏背景后，`planAssets` 1 发通过（见 §8 复现 2）。
2. 设计只在 `winConditions` / `coreLoopSteps` / `levels[].layout` 里用散文提到 HUD。这些字段只进 `designBrief`，不触发闸（E1 `prompt.ts:854-871`）。
3. 设计只声明 `objective:collect-then-reach`、没有 `hud:screen-space`。GameConfig 仍然结构必填 `hud`，但闸不触发。这是当前最尖锐的条件缺口。
4. 规划期被绕过：人直接写清单、或 `runBuild` 读入人工改过的清单。`runBuild` 只重跑 `designCoverageGate`（E1 `packages/pipeline/src/create-game.ts:517-525`），不重跑 `hudUiGate` / `playerAnimationGate` / `backgroundCoverageGate`（后三者未导出或未被 build 引用）。

---

## 3. 地形 prop 策略现状

### 3.1 正向线索

- plan-assets 提示词（E1 `prompt.ts:986-989`）：
  > 平台关的 `solid` 实体**只能引用 `sprite`** —— 若这一关的 layout 需要看得见的静态碰撞体（地面砖 / 台阶 / 碎石堆 / 斜坡），产出一件对应的 `sprite`。
- compile-runtime 铁律 #5（E1 `ops.ts:1103-1108`）：
  > `solid` 实体只能引用 `sprite`；禁止拿玩家角色或任何动画资源当地形。清单里没有 sprite 地形资源时，地面用 `terrain`（看不见的碰撞）搭，不要硬造 solid 块。
- `CONFIG_TOOL_DESCRIPTION` 铁律 #2（E1 `prompt.ts:1018-1020`）：看不见的碰撞进 `terrain`，看得见的静态碰撞体是 `solid` 实体。

真实付费跑的正向证据（E3）：`.scratch/recipe-config-gap-v1/runs/2026-10-23-p0-final/wasteland-scavenger-assets/run/v1/asset-recipe.json` 产出了 `ground-tile`（32×32）、`rubble-pile`（64×40）、`broken-wall`（48×48）、`cracked-plate`（48×24）四件地形 sprite（`:176-259`）；同一跑次的 pack 全部成功，config 才因实体出界失败（E3 `stage-b-retry6.log:1-22`）。

### 3.2 安全网的落地位置

- **确定性底线**：`auditReferences` 的实体循环只给 `solid` 加 `["sprite"]` 锁（E1 `game-config.ts:366-374`）；`decor` 不加锁（动画/ ui 合法，v7 真配置就这么用）。E2 witness：`game-config.test.ts:181-191`。
- **退化提示词**：compile-runtime 铁律 #5（E1 `ops.ts:1106-1108`）告诉模型“没有 sprite 就退化到 `terrain`”。
- **没有自动退化代码**：`compileRuntime` 不会把引用动画的 `solid` 自动改写成 `terrain`；它靠 kind 锁把这一发判成“模型错”，再重采样（E1 `ops.ts:1193-1204`）。模型下一发必须自己改走 `terrain`。

### 3.3 哪些情况仍可能产不出合法地形资源

先定义：**合法地形资源** = 能被 `solid` 引用的 `sprite`。GameConfig 的 `terrain` 是**不引用任何资源**的矩形（E1 `game-config.ts:220-221`），所以“没有地形 sprite”不等于“没有合法地形办法”。

仍可能产不出“看得见的地形资源”的情况：

1. **清单里完全没有 sprite**：`planAssets` 不检查 layout 是否需要地形，照样通过（E3 复现 3）。下游只能退化成 `terrain`，关卡变平，但 config 合法。这是票 03 (c) 明确接受的退化。
2. **清单只有非地形 sprite**：例如只有 `chest` / `enemy` / `pickup`。模型可以把这些 sprite 当 `solid` 引用——kind 锁放行（是 sprite），但语义错。没有“地形类 sprite”判据。
3. **斜坡**：GameConfig 没有斜坡槽位（E1 `game-config.ts:45-53` 的 `EntityKind` 只有 `solid/pickup/hazard/goal/chest/danger/decor`；`:220-221` 的 `terrain` 是矩形）。斜坡视觉只能做成 `solid` sprite，而碰撞仍是 AABB 矩形，无法表达斜坡碰撞。PRD AC-02 的“合法斜坡资源”在现有 Runtime 契约里没有对等位置。
4. **模型把地形块写成 `decor` 或 `hazard`**：kind 锁只对 `solid` 生效；没有 `sourceIntent` 的孤儿地形块可以被标成任何 kind。这样不会触发 `solid → sprite` 锁，但也没有碰撞。属于玩法/可玩性缺口，不是“非法地形资源”。
5. **人工在检查点删掉地形 sprite**：`runBuild` 不重跑背景/玩家/HUD 闸，也不检查地形 sprite（E1 `create-game.ts:517-525`）。下游仍可退化，不会硬拒。
6. **模型连续三发坚持用动画当 `solid`**：kind 锁每发都拒，最终 `invalid`（exit 4），不会落一份非法 config。这是正确的最终失败形态。

> 因此：**“交付非法地形资源”已被 kind 锁堵死；“可见地形资源的产率”没有被确定性保证**。前者是硬失败保护，后者是票 03 接受的退化。

---

## 4. 上下游闭环逐链路追踪

| # | 链路 | 捕获点 | 是否重采样 | 最终失败形态 | 证据 |
|---|---|---|---|---|---|
| A | 设计四桶实体需要、清单没有 | `designCoverageGate`（plan 循环内）；`runBuild` 再查一次 | 是，3 发 `schema` | `invalid`(4)，点名缺失 id，不落盘 | E1 `ops.ts:266-286`、`:472-478`；`create-game.ts:517-525`；E2 `plan-coverage-gate.test.ts:62-100` |
| B | 设计玩家动画形状不对 | `playerAnimationGate` | 是，3 发 `schema` | `invalid`(4)，点名缺哪一路/几帧/几件 | E1 `ops.ts:215-259`、`:493-499`；E2 `plan-assets-player-gate.test.ts:151-198` |
| C | 设计声明 HUD，清单缺 ui | `hudUiGate` | 是，3 发 `schema` | `invalid`(4)，点名缺面板/图标，不落盘 | E1 `ops.ts:300-314`、`:482-488`；E2 `plan-hud-gate.test.ts:59-89`；E3 历史重放 |
| D | 背景盖不住世界 | `backgroundCoverageGate`（plan）；`auditLayerCoverage`（compile，循环外） | plan 是；compile 否 | plan：`invalid`(4) 点名尺寸/层；compile：`invalid`(4)，明确“去资源清单” | E1 `ops.ts:336-358`、`:503-508`、`:1219-1234`；E2 `plan-background-gate.test.ts:63-101` |
| E | 设计 layout 需要地形，清单没有地形 sprite | **无**（只有提示词） | 不适用 | 不失败；下游退 `terrain`，视觉变平 | E1 `prompt.ts:986-989`；E3 复现 3 |
| F | 清单有资产、但 kind 不对（四桶） | **规划期无 kind 判据**（只比 id/characterId） | 不适用（plan 通过） | 取决于该资产是否被 config 引用、引用到哪个 kind：可能完全静默 | E1 `ops.ts:266-275`；E1 `game-config.ts:370-372` 只锁 `solid`；`resolvePackRef` 对 background/单帧 ui 都放行（E1 `assetpack.ts:377-427`） |
| G | 清单有资产、但 kind 不对（solid） | `auditReferences` 的 `solid → ["sprite"]` | 是，3 发（`modelHard`） | `invalid`(4)，“是 animation，这里要的是 sprite”；不落盘 | E1 `game-config.ts:366-374`；`ops.ts:1193-1204`；E2 `game-config.test.ts:181-185` |
| H | 清单有资产、但 kind 不对（hud） | `hudUiGate`（规划期）；`hud.panel/pip → ["ui"]`（下游） | 是 | plan：缺 ui；下游：`是 sprite，这里要的是 ui` | E1 `ops.ts:300-314`；`game-config.ts:373-374`；E2 `game-config.test.ts:172-178` |
| I | 下游拒绝，但根因在清单（例如包里没有 ui） | 被归进 `modelHard`，在 compile 循环内重采样 | **是，但不可能修好**：config 重抽不能生成新资源 | 3 发后 `invalid`(4)，message 写“模型错”，实际应指向清单 | E1 `ops.ts:1193-1204`；对比层覆盖的明确上游路由 `:1229-1234` |
| J | 人工改清单后删掉 ui/地形/背景 | `runBuild` 只重跑 `designCoverageGate` | 不适用 | 下游才失败；生图钱已花 | E1 `create-game.ts:517-525` |
| K | 设计没声明 `hud:screen-space`，清单没 ui | **无** | 不适用 | 下游 `hud` 结构必填 + ui kind 锁 → 3 发后 `invalid`(4) | E1 `game-config.ts:223`、`:373-374`；E3 复现 2；E2 `plan-assets.test.ts:16,55` |

**关于“下游拒绝后是否回到可恢复重采样”：**

- 模型侧错误（引用、自洽、HUD 屏幕空间、实体身份）已移进 compile 循环，3 发（E1 `ops.ts:1189-1204`；E2 `compile-runtime.test.ts:203-231`）。
- 确定性错误（层覆盖、QA 产物、包校验）不重采样，符合“重抽改不了”的纪律（E1 `ops.ts:1213-1234`）。
- 但“可恢复”的分档是**按错误是否由模型这一发写错**判的，不是按**根因是否在上游**判的。包缺 ui / 包缺 sprite 这类上游根因，会进入 `modelHard` 并浪费 3 发；message 还写“模型错”。
- 重采样是**盲的**：三发同一 prompt，模型看不到上一发的错误（E1 `ops.ts:412-429`、`:1086-1167`；E3 三发请求体相同）。对随机性错误有效；对系统性错误无效。真实证据：`stage-b-retry6.log:17-22` 显示实体出界连续 3 发未修好，最后靠 `clampToWorld` 的确定性钳位（E1 `ops.ts:1027-1037`、`:1187-1189`）。

**关于“错误信息是否足以指向上游”：**

- **规划期闸门：足够。** 每条 message 都点名缺什么、属于哪类、建议怎么补（`ops.ts:282-285`、`:311-313`、`:356-358`；玩家闸 `:215-259`）。
- **下游 kind 锁：中等。** `是 {actual}，这里要的是 {expected}` 说清了实际/预期，但没有说“去资源清单改哪一件”；不过 compile prompt 铁律 #5 已把 solid→terrain 的出路写给模型（E1 `ops.ts:1106-1108`）。
- **下游聚合消息：偏弱。** `modelHard` 统一写成“配置过不了业务校验（模型错…）”（E1 `ops.ts:1201-1202`），当根因是清单缺资源时，这句话把人指向“再抽一次 config”，而正确方向是清单。层覆盖那条反而写得很清楚：“要去的地方：资源清单”（E1 `:1232-1233`）。这是**错误信息的不对称**。
- **结构化字段：** `ConfigIssue` 只有 `{severity, where, message}`（E1 `game-config.ts:281-286`），没有 `code/entityId/field/assetId/expected/actual`。这属于票 03 的 A/B 范围，本票只记录事实。

---

## 5. 2026-10-23 历史失败的上游根因复核

原始失败逐字在 E3 `.scratch/intent-to-mechanics-v1/runs/2026-10-23-p0-final/stage-b.log:10-17`。

| 历史错误 | 原始根因 | 当前捕获点 | 是否已关闭 | 证据 |
|---|---|---|---|---|
| E01 `block-1` 引用 `scavenger-hero` | 清单没有地形 sprite，模型拿玩家动画当 solid | `solid → ["sprite"]` kind 锁；compile 循环重采样；提示词正向线索 | **已关闭（交付层面）** | E2 `game-config.test.ts:181-185`；E1 `game-config.ts:366-374`、`ops.ts:1103-1108`；E3 后续真实跑产出地形 sprite |
| E02 `slope-1` 引用 `scavenger-hero` | 同上；斜坡只能落成 solid | 同上 | **已关闭（玩家当斜坡）**；斜坡语义本身未覆盖 | E1 `game-config.ts:45-53`、`:220-221`；E3 同上 |
| E03 `hud.panel` 引用 `chest` | 清单没有 ui | `hudUiGate` 规划期拒；下游 `["ui"]` 锁 | **已关闭** | E2 `plan-hud-gate.test.ts:59-71`；E1 `ops.ts:300-314`；E3 历史重放（3 发拒） |
| E04 `hud.pip` 引用 `resource-item` | 同上 | 同上 | **已关闭** | 同上 |
| E05 panel 72×32 vs chest 32×24 非九宫格 | 清单没有九宫格 ui；模型硬拿非九宫格资源声明大尺寸 | `hudUiGate` 要求带 ninePatch 的 ui；`auditPanelSize` 判声明尺寸 | **已关闭** | E2 `game-config.test.ts:435-445`；E1 `game-config.ts:404-420`；E3 后续真实跑 `hud-panel` 32×32 ninePatch 8/8/8/8 |

### 5.1 HUD ui 缺失：已完全关闭吗？

**在设计声明 `hud:screen-space` 时：是。**

- E2：`plan-hud-gate.test.ts` 四个用例覆盖阳性、缺面板、缺图标、全缺；缺时 3 发 `schema`、exit 4、不落盘。
- E3：把历史设计 + 历史清单（7 件资产、0 件 ui）喂给当前 `planAssets`，**3 发后拒绝**，message 点名“缺带 ninePatch 的 ui 面板 / 不带 ninePatch 的 ui 图标”（见 §8 复现 1）。
- E3：后续真实付费跑产出了 `hud-panel` / `hud-pip`，pack 成功，config 才因另一类错误（实体出界）失败（`stage-b-retry6.log:12-22`）。

**在设计没有声明 `hud:screen-space` 时：否（残余）。**

可复现条件（E3 复现 2，零付费）：

- 设计：历史 `game-design.json` 去掉 `hud:screen-space`（其余不变）。
- 清单：历史 `asset-recipe.json` 去掉 `ruined-street-fg`（否则会被背景闸以“高 120 < 视口 270”拒掉；这是另一条已关闭的缺口）。
- 结果：`planAssets` **1 发通过**，产出 6 件资产，kind = `{animation:1, sprite:4, background:1}`，**0 件 ui**。
- 下游：`GameConfigSchema` 的 `hud` 不是 optional（E1 `game-config.ts:223`），`hud.panel/pip` 必须 ui（`:373-374`）。这份清单**结构上编不出一份合法 config**；若 compile 重采样 3 发，最终 `invalid`，message 会写“模型错”。
- E2 旁证：`plan-assets.test.ts` 的设计只声明 `["input:keyboard"]`（`:55`），用的 `shift-change` 配方没有任何 ui（`:16`），18 个测试全绿——说明这条“无 HUD 能力 + 无 ui 清单”路径在设计层是合法且被测试覆盖的。

> 这是**设计层表达能力**问题，不是 `hudUiGate` 的判据写错：设计层没有“我需要 HUD / 我不需要 HUD”的结构化字段，只有能力数组；而 GameConfig 又结构必填 HUD。前序地图已把“设计层结构化 HUD/地形需求”列为 out of scope（`.scratch/recipe-config-gap-v1/map.md:92`）。

### 5.2 地形 prop 缺失：已完全关闭吗？

**“玩家资源被当作地形块/斜坡”这个失败形态：是。** kind 锁确定性拒绝，E2 witness 在 `game-config.test.ts:181-185`；真实后续跑也产出了四件地形 sprite。

**“清单一定会产地形 prop”：否。** 这是故意的：

- plan-assets 没有地形闸（E1 §1.5）；E3 复现 3 显示：历史设计（layout 明说“碎石堆 / 沙土斜坡”）+ 补了 ui 但**不补任何地形 sprite** 的清单，`planAssets` 1 发通过（8 件资产；sprite 只有 `enemy-wasteland`、`chest`、`hazard-spike`、`resource-item`）。
- 下游可以合法退化成 `terrain`（E1 `ops.ts:1103-1108`）；这是票 03 (c) 的裁定（`.scratch/recipe-config-gap-v1/issues/03-terrain-prop-strategy.md` 的 Answer），不是 bug。
- 真正的地形可玩性（有没有可踩的台阶、斜坡碰撞）属于下一阶段 Level Playability；本链路只保证“不交付非法地形引用”。

---

## 6. 已关闭 / 部分关闭 / 未覆盖清单

### 6.1 已关闭

| # | 能力 | 证据 |
|---|---|---|
| 1 | 设计四桶 → 清单的精确 id/characterId 覆盖闸 | E1 `ops.ts:266-286`、`:472-478`；E2 `plan-coverage-gate.test.ts:55-100`；build 复验 `create-game.ts:517-525` |
| 2 | 玩家资源必须是一件 animation、三路动作、≥2 帧 | E1 `ops.ts:215-259`、`:493-499`；E2 `plan-assets-player-gate.test.ts:151-198` |
| 3 | 声明 HUD 时必须在花钱前产出 ui 面板 + 图标 | E1 `ops.ts:300-314`、`:482-488`；E2 `plan-hud-gate.test.ts:53-89`；E3 历史重放 |
| 4 | 背景尺寸/层视差/平铺的规划期闸 | E1 `ops.ts:336-358`、`:503-508`；E2 `plan-background-gate.test.ts:57-101` |
| 5 | `solid → sprite` 构建期 kind 锁 | E1 `game-config.ts:366-374`；E2 `game-config.test.ts:181-185` |
| 6 | `hud.panel/pip → ui` + 九宫格尺寸例外 | E1 `game-config.ts:373-374`、`:404-420`；E2 `game-config.test.ts:172-178`、`:429-445` |
| 7 | 下游“模型错”族（引用/自洽/身份/HUD 屏幕空间）进重采样循环 | E1 `ops.ts:1189-1204`；E2 `compile-runtime.test.ts:203-231` |
| 8 | 层覆盖确定性失败、不重采样、明确指向上游 | E1 `ops.ts:1213-1234`；E2 `compile-runtime.test.ts:462-505` |
| 9 | `empty-input` 单独 6 发、不与 schema 抢预算 | E1 `structured-call.ts:37`、`ops.ts:421-424`；E2 `plan-assets.test.ts:364-382` |
| 10 | 合法 config 过三批业务校验（正向不误伤） | E2 `recipe-config-acceptance.test.ts:29-38` |
| 11 | 真实付费跑产出 HUD ui + 地形 sprite | E3 `wasteland-scavenger-assets/run/v1/asset-recipe.json:176-365`；`stage-b-retry6.log:1-15` |

### 6.2 部分关闭

| # | 缺口 | 说明 | 证据 |
|---|---|---|---|
| 1 | HUD 闸的条件触发窄于下游硬要求 | 设计不声明 `hud:screen-space` 时，清单可无 ui，而 config 必填 HUD | E1 `ops.ts:301`、`game-config.ts:223`；E3 复现 2；E2 `plan-assets.test.ts:16,55` |
| 2 | 地形 prop 正向路径无闸 | layout 需要可见地形，清单可完全没有 sprite；下游退 `terrain`，不报错 | E1 `prompt.ts:986-989`；E3 复现 3；票 03 (c) 裁定 |
| 3 | 四桶覆盖不看 kind | 设计 id 被任意 kind 的资产覆盖都算过；下游只对 player/solid/hud/background 加锁 | E1 `ops.ts:266-275`；`game-config.ts:337-374` |
| 4 | 下游未加锁的实体 kind | pickup/hazard/goal/chest/danger/decor 可引用任意可解析 kind（background、ui、animation） | E1 `game-config.ts:370-372`；`assetpack.ts:377-427` |
| 5 | 人工改清单后的复验不完整 | `runBuild` 只重跑覆盖闸，不重跑 HUD/玩家/背景闸 | E1 `create-game.ts:517-525`；`hudUiGate` 未导出 |
| 6 | 错误信息对“上游根因”不够明确 | `modelHard` 统一写“模型错”；层覆盖那条才明确指清单 | E1 `ops.ts:1201-1202`、`:1229-1234` |
| 7 | 盲重采样 | 三发同 prompt、无错误反馈；能修随机错，修不了系统性错 | E1 `ops.ts:412-429`、`:1086-1167`；E3 三发同 body、`stage-b-retry6.log:17-22` |
| 8 | 视口在 plan 与 compile 之间可能不一致 | `UnderstandingInput` 没有 `viewport`；`planAssets` 只能用默认值，而 compile/site 用 `BuildInput.viewport` | E1 `create-game.ts:48-77`、`:109-128`、`:177`、`:390-400`、`:598`、`:645`；`ops.ts:97-101`、`:411` |
| 9 | pack manifest 有 `role`，但 compile prompt 不打印 | 下游选“哪件是地形”只能靠 id 名字；`resourceBrief` 不含 `role` | E1 `assetpack.ts:164-167`；`ops.ts:941-953` |

### 6.3 未覆盖

| # | 缺口 | 说明 | 证据 |
|---|---|---|---|
| 1 | layout 散文 → 地形/道具需求的结构化表达 | 只有提示词；设计层没有地形/道具字段 | E1 `game-design.ts:176-190`（只有 layout 字符串）；`prompt.ts:986-989`；前序 out of scope `recipe-config-gap-v1/map.md:92` |
| 2 | 斜坡语义 | GameConfig 无斜坡槽位；只能 AABB `solid` 或 `terrain` | E1 `game-config.ts:45-53`、`:220-221`；PRD AC-02 与现有 Runtime 的张力 |
| 3 | 目标/出口资源 | 设计没有 goal 实体；config 的 `objective.gate` 必须指向一个 goal 实体，资源可任选 | E1 `game-config.ts:209-213`、`:376-378`；设计 schema 无 goal 桶 |
| 4 | 设计“无拾取物”时的可满足性 | config 要求至少 1 个 pickup/chest（`pickupCount > 0`），设计允许 `resources: []` 且无 chest interactable；无规划期闸 | E1 `game-config.ts:380-381`；`game-design.ts:169-172`；设计提示词 `packages/game-design/src/prompts.ts:273` 说 resources 可空 |
| 5 | 人工直接写清单（绕过 plan-assets） | 没有任何 plan 闸；只能靠 pack/compile 下游 | E1 `ops.ts:370`（plan 是独立命令）；`create-game.ts:517-525` |
| 6 | 未加锁 kind 的语义正确性 | enemy/pickup/chest/hazard/danger/decor 的“资源是否适合这个玩法角色”不在 Runtime 契约 | E1 `game-config.ts:370-372`；`DESIGN_BUCKET_KINDS` 只查运行时 kind 与设计桶的兼容（`:534-539`），不查 asset kind |

> 关于 #6：这不一定是“缺口”。现有 Runtime 对 `hazard`/`decor` 明确允许 animation/ui（v7 真配置的 `decor` 就引用 animation 与 ui，E1 `game-config.ts:368-369`），所以为它们加 kind 锁会**发明 Runtime 没有的规则**。前序 `entity-identity-v1.1` 的 C 路线也把 `interactables` 同桶误归属列为已知限制。

---

## 7. 闭环判定

| 问题 | 结论 | 理由 |
|---|---|---|
| 1. `plan-assets` 表达设计对资源的要求是否完整？ | **部分** | 对 Runtime 契约强制的槽位（玩家、四桶存在性、HUD 条件、背景）是完整的；对 layout 地形/道具、未声明 HUD 能力、目标/出口、四桶 kind 适配不完整。对历史五错足够，对“所有设计要求”不完整。 |
| 2. 规划结果能否被下游审计准确消费？ | **部分** | player/solid/hud/background 的 kind 与尺寸被准确消费（E1/E2）；pickup/hazard/goal/chest/danger/decor 没有 asset-kind 锁；manifest 的 `role` 没有进入 compile prompt，地形选择靠 id 推断。 |
| 3. 上游缺失是否会被下游可靠捕获？ | **部分** | 四桶、玩家、HUD（声明时）、背景会在**花钱前**被 plan 闸捕获（E2/E3）；layout 地形不会（按裁定退化）；未声明 HUD 能力的 HUD 缺失只在**花钱后**由下游捕获，且被标成“模型错”；人工改清单不重跑 plan 闸。 |
| 4. 错误信息是否足以指向上游？ | **部分** | 规划期闸门的 message 足够明确（点名缺项 + 建议补法）；下游 kind 锁说明了 actual/expected，但聚合消息把上游根因写成“模型错”；层覆盖那条是明确指向上游的正面样板。 |
| 5. 重采样是否真正解决了可恢复的资源规划错误？ | **部分** | 分档正确（模型错 3 发、确定性错不重试），但重采样是盲的（同 prompt、无错误反馈）；对随机错有帮助，对系统性错无效（E3 实体出界三发失败，最终靠 `clampToWorld`）。 |
| **是否需要在 `plan-assets` 新增闸门？** | **不需要** | 五错已闭环；HUD 缺口是现有闸条件过窄/设计层表达缺失；地形正向产率是裁定的退化；其余是下游 kind 锁、build 复验、重采样反馈、设计层结构化表达。为“架构完整”再加一道 plan 闸会重复判据或发明 Runtime 没有的规则。 |

### 7.1 如果 P1 要动，最小修改面（仅供 P0-B 参考，本票不实施）

1. **不新增闸**，只把 `hudUiGate` 的触发条件与 GameConfig 的硬结构对齐：要么设计层保证 `hud:screen-space`（设计层改动，超出本图），要么在 `hudUiGate` 里去条件化/增加 `objective:collect-then-reach` 触发（会误伤当前无 HUD 设计的测试，需要先裁定）。
2. **复用现有闸**：`runBuild` 在 `designCoverageGate` 旁复用 `hudUiGate` / `playerAnimationGate` / `backgroundCoverageGate`（需要导出或移到 contracts），覆盖“人工改清单”路径。
3. **重采样反馈**：把上一发的 `lastError` 作为一条 user/assistant 反馈加入下一次请求（不是新闸，是重采样语义变化）。
4. **错误分层**：给 `modelHard` 里“包/清单缺资源”类错误单独指向上游（与层覆盖同款），不把根因在上游的错误写成“模型错”。是否用稳定 `code` 属于票 03。
5. **视口一致**：给 `UnderstandingInput` 增加 `viewport` 并透传给 `planAssets`，与 compile/site 用同一个数。

---

## 8. 验证记录（零付费、零模型、零生图）

### 8.1 既有 offline 测试

命令：

```bash
pnpm exec vitest run \
  packages/assets/tests/plan-hud-gate.test.ts \
  packages/assets/tests/plan-coverage-gate.test.ts \
  packages/assets/tests/plan-background-gate.test.ts \
  packages/assets/tests/plan-assets-player-gate.test.ts \
  packages/assets/tests/compile-runtime.test.ts \
  packages/contracts/tests/game-config.test.ts \
  packages/contracts/tests/recipe-config-acceptance.test.ts
```

结果：**exit 0**，7 个测试文件 / **121 tests passed**。

```bash
pnpm exec vitest run \
  packages/assets/tests/plan-assets.test.ts \
  packages/assets/tests/recipes-sweep.test.ts
```

结果：**exit 0**，2 个测试文件 / **28 tests passed**。

以上测试全部使用 mock `fetchImpl` / 临时目录，无模型调用、无生图。

### 8.2 历史产物重放（一次性 `/tmp` 脚本，零付费）

> 说明：这些脚本调用 `packages/assets/dist`（2026-10-30 构建，与当前源码同形），**只跑 `planAssets`**，不跑 create 链、不跑 pack、不生图、不调用模型。脚本在 `/tmp`，未写入仓库。

**复现 1：历史设计（声明 HUD）+ 历史清单（无 ui）**

- 输入：`.scratch/intent-to-mechanics-v1/runs/2026-10-23-p0-final/rust-city-scavenger/run/v1/{game-design.json,visual-world.json,asset-recipe.json}`
- 结果：`planAssets` **invalid**，3 次上游调用（mock），message：
  - “清单缺 HUD 用的 `ui` 资源…”
  - “一件带 `ninePatch` 的 `ui` 面板…”
  - “一件不带 `ninePatch` 的 `ui` 图标…”
- 结论：历史 HUD 缺陷会在**生图之前**被规划期闸门拦住。

**复现 2：历史设计去掉 `hud:screen-space` + 历史清单去掉坏背景**

- 结果：`planAssets` **1 发通过**，6 件资产，`kinds = {animation:1, sprite:4, background:1}`，**0 件 ui**。
- 对照：同一清单保留 `hud:screen-space` → 3 发后缺 HUD ui 拒绝。
- 结论：无 HUD 能力声明时，规划期不要求 ui；下游结构必填 HUD，形成残余缺口。

**复现 3：历史设计 + 含 ui、不含任何地形 sprite 的清单**

- 输入：历史清单 + 两件手工补的 ui（ninePatch 面板 + 非 ninePatch 图标），**不补地形 sprite**；设计 layout 明说“碎石堆 / 沙土斜坡”。
- 结果：`planAssets` **1 发通过**，8 件资产，`kinds = {animation:1, sprite:4, background:1, ui:2}`；sprite 只有 `enemy-wasteland / chest / hazard-spike / resource-item`。
- 结论：layout 的地形需求不被规划期捕获；下游只能退化。

**复现 4：盲重采样**

- 输入：历史设计 + 历史清单（无 ui）。
- 结果：向 mock 记录 3 次请求体，**3 份逐字相同**；prompt 中没有上一发的错误信息。
- 结论：重采样不携带反馈。

### 8.3 真实产物的正向证据（已有，不是本次运行）

- `.scratch/recipe-config-gap-v1/runs/2026-10-23-p0-final/wasteland-scavenger-assets/run/v1/asset-recipe.json`：14 件资产，包含 4 件地形 sprite + 2 件 ui（`:176-365`）。
- 同跑次 `stage-b-retry6.log:1-22`：14 件资源全部 pack 成功，config 走到业务校验，因实体出界 3 发重采样失败（该错误后来由票 13 的 `clampToWorld` 确定性修复，E1 `ops.ts:1027-1037`）。
- 更早的 `stage-b-retry4.log`（同目录）甚至走到 QA，失败在 hero 长宽比（后来由票 11 修复）；说明 HUD/地形/配置链路已通到 QA。

**本次未执行**：任何 create 链、任何生图、任何模型调用、任何付费调用。

---

## 9. 边界

- 本票只回答上游规划与闭环；`ConfigIssue` 契约（`code` 等）属于票 03；下游校验全量事实属于票 01。
- 本票不重开 `interactables` 同桶误归属、`decor` kind 锁（`entity-identity-v1.1` 已知限制，且前序地图列为 out of scope）。
- 本票不把“没有地形 sprite”判为失败：票 03 (c) 明确允许退 `terrain`；本票只指出正向产率无确定性保证。
- 本票不修改任何生产代码、提示词、测试、fixture、契约；报告中的“最小修改面”仅供 P0-B，不构成实施授权。
