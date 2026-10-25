# VDS 全设计 / config 单关卡：多关卡拆实体时的「缺失」误报

Type: grilling
Status: resolved
Owner: claude (2026-10-25)

## Question

事实（票 02 顺带确认，E1 已核）：`compileVisualDesign` 吃整份 design（`create-game.ts:370`）、
`layoutVds` 读全四桶不分关卡（`layout.ts`），而 `compileRuntime` 按 `levelId` 只产一关 config。

⇒ 当多关卡设计在关卡间**拆分实体**（level-1 用 {A,B}、level-2 用 {C,D}）时：
- VDS（全四桶）= {A,B,C,D}；
- config（只 level-1）= {A,B}；
- 现有「VDS→config 缺失」检查（`visualConfigCoherence` 主循环）会把 C、D 误报成「VDS 画了、配置没做」。

当前夹具（含 entity-identity-v1.1 E2E-C 的两关设计）都是**同一套实体铺满所有关卡**，故从未触发。
这是**结构性错位**，不是已暴露的 bug；且**只影响「VDS→config 缺失」这一条** —— D∖S/S∖D（票 02 补的）
是 VDS↔design 全设计口径、不受此影响。

要裁：

1. **归谁**：VDS 该按关卡产（`compileVisualDesign` 只吃当前关卡的设计实体），还是
   「VDS→config 缺失」检查该按关卡作用域过滤（同 `auditEntityIdentity` 的 `levelId`），还是另定？
   注意：按关卡产 VDS 会连 SVG/PNG 预览一起变（旁轨产物形状），而按关卡过滤检查只动 QA 一条判据。
2. **多关卡拆实体是不是真实场景**：若当前/近期不产这种设计，是否记录为已知限制、暂不做。
3. **范围**：本票只动「VDS→config 缺失」这一条的作用域，不动 D∖S/S∖D、不动布局。

## Answer

裁定（用户 2026-10-25 收口）：**Q1 = 否（非当前真实场景）· Q2 = (a) 记录为已知限制，本图不做。**

`create` 流程不选关（`CreateGameInput` 无 `levelId`、`compileRuntime` 调用处不传 `levelId` 永远默认
`levels[0]`、多关卡索引形状尚未设计），所以「VDS→config 缺失」误报别的关卡实体这件事**今天触发不了**
—— 它不是当前 bug，是**未来多关卡能力**（选关 + 索引）的连带边界问题。

**已知限制**：`compileVisualDesign` 吃整份 design、`layoutVds` 读全四桶不分关卡，而 config 是单关。
当未来多关卡支持落成、且关卡间**拆分实体**时，`visualConfigCoherence` 的「VDS→config 缺失」会把别的
关卡实体误报。**届时**把 `levelId` 流进 `QaContext`（schema 改动）+ `create` 传它，再按关卡作用域过滤
这一条 —— 两行改动。归属**多关卡那张图**，不在本图。

**本图不做**：不加 `levelId`（给一个还没人用的参数接线）、不动布局（不碰 SVG/PNG 旁轨产物形状）。
