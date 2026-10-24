# 02. 地形 solid/decor 现状与退化路径

Type: research
Status: resolved
Owner: main session · 2026-10-23
Blocked by: —
Map: ../map.md

## Question

config 里 `solid` / `decor` 实体分别引用什么资源（`solid` 要 sprite？`decor` 要 sprite？）；compile-runtime
提示词对 solid 的现状（有没有「看不见的碰撞进 terrain」的规则、有没有「别用玩家/动画当 solid」的规则）；
recipe 有没有地形 prop 先例（sprite 带 terrain/block/decor role）。以及 `decor` 与 `solid` 的区别与各自的
资源要求。

## 要钉死的事实（E1 源码 / E2 测试）

- `EntityKind` 里 `solid` / `decor` 的语义与资源引用要求（`game-config.ts` + `auditGameConfig`）。
- `compileRuntime` 提示词（`packages/assets/src/ops.ts:985-1044`）对 `terrain`（invisible）与
  `solid`（visible、带资源）的既有规则逐字；缺口在哪（有没有「禁止拿动画/玩家当 solid」）。
- recipe 的 `role` 是否有 terrain/block/decor 的既有用法或先例（grep 全仓 + 既有 fixture 清单）。
- 现有测试里有没有「solid/decor 引用 sprite」的 witness。

## Answer

**EntityKind 语义（E1）**：`solid` = 可见 + 静态碰撞（`game-config.ts:47-48,214`）；`decor` = 可见、纯装饰、
无碰撞（`vocabulary.ts:33`、`scene.ts:193` `case "decor": break`）；`terrain` = 看不见的碰撞（地面线/边界/隐形墙）。

**关键缺口：audit 对 solid/decor 实体没有 kind 锁**（`game-config.ts:360`）——实体解引用时**不传 kinds**
（`ref("entity…", { asset, anim })`），只有 `scene.background→["background"]`(`:331`)、`player→["animation"]`(`:334`)、
`hud.panel/pip→["ui"]`(`:361-362`) 三处有 kind 锁。所以 `solid` 引用 `animation` **不会被「要的是 sprite」拦下**，
只在资源多动画未指明 anim 时（`assetpack.ts:421-426`）才弱失败——block-1/slope-1 撞的就是这一条，是**间接失败**。

**compile-runtime 提示词现状**：铁律 #5（`ops.ts:999-1001`）有 terrain/solid 分工，但**没有「禁止拿玩家/动画资源
当 solid」**；铁律 #9 只约束 anim 存在性、不约束 kind。`resourceBrief`（`ops.ts:867`）渲染 `id·kind·尺寸·锚点·动画`，
**不带 role、不标「哪件是地形」**，模型无从辨认哪件该当 block。

**recipe role 现状**：`role` 是自由文本 `z.string()`（`asset-spec.ts:17`），`resolveRoute` **不分派 role**
（`route.ts:80-118`）。但**地形 prop 有现成 sprite 先例**：`fixtures/packs/last-train/v2/manifest.json` 的
`prop-luggage-pile`（sprite）、`.scratch/asset-integration-v1/runs/*/asset-recipe.json` 的 `tile-floor` /
`metal-platform` / `concrete-step`（sprite，地形 role）。失败现场包 `rust-city-scavenger` 则**零 solid 地形 sprite**，
故模型只能拿玩家动画顶。

**witness**：`solid→sprite` 有唯一成型先例 `game-config.test.ts:30`（`{id:"luggage",kind:"solid",asset:"prop-luggage-pile"}`
+ 夹具 manifest）；`decor` **无任何测试/witness**。

**落点（高杠杆）**：① **给实体引用加 kind 锁**——`game-config.ts:360` 处 `solid`/`decor` 实体 → `["sprite"]`，
让「solid 引 animation」直接报「是 animation，这里要的是 sprite」（与 player/hud 同口径），把根因从「模型选错」
变成「构建期 kind 拒绝」；② recipe 补一件地形 sprite（照 tile-floor/metal-platform 先例）；③ 铁律 #5/#9 旁补一条
「solid/decor 只能引 sprite，禁止拿玩家/动画当地形」。①②是确定性修复，③是正向线索。
