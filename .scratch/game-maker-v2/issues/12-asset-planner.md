# 12. Asset Planner：`GameDesignSpec` + `VisualWorldSpec` → `AssetRecipe`

Type: grilling
Status: open
Owner: —
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

（待解）
