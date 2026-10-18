# 10. 同步 PRD 的过时口径：deriveRecipe → planAssets

Type: task
Status: resolved
Owner: claude (2026-10-18 · 按第一轮 Q3)
Blocked by: —
Map: ../map.md
> 第一轮 Q3 = (a)：标记为历史措辞，目标直接指向 `planAssets`；不重开 v2 票 12。

## Question

PRD 中哪些过时术语/目标描述需要按第一轮裁定同步？

## Answer

已改 `docs/v3/asset-planner-production-routing-prd.md`：

1. 头部加「口径更新（2026-10-18）」：`deriveRecipe` 已在 v2 并入 `planAssets`；
   Phase 1 目标 = `planAssets` + 确定性 `resolveRoute`；模型只提供候选；plan sidecar；
   `import` 只保证规则与 pack 支持，create 链素材输入留后续；公共 Recipe Schema 不变。
2. §2.1「由明确的 Planner 取代 `deriveRecipe`…」改为「在现有 `planAssets` 上收敛…（`deriveRecipe` 已并入）」。
3. §11 Task 1「查明 `deriveRecipe`…」改为「查明 `planAssets`（历史名 `deriveRecipe`）…」。
4. §11 Task 2「移除或收敛旧 `deriveRecipe` 的重复职责」改为「确认 `planAssets` 是唯一写入侧…把路线决策收敛到确定性 resolver」。
5. §10 验收「Planner 取代 `deriveRecipe`…」改为「在现有 `planAssets` 上收敛…」；附录 A 的「`deriveRecipe`/Planner 实现」改为「`planAssets`/Planner 实现」。

⚠️ 只改措辞与目标描述，未改 PRD 的功能需求/验收/边界。
