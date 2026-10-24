# 13. open-chest 实现切片：MECHANICS + EntityKind + 纯层/渲染 + 校验 + 见证

Type: task
Status: resolved
Owner: main session · 2026-10-23
Blocked by: —
Map: ../map.md

## Question

落地 [票 04](04-open-chest-semantics.md) 的语义（**近距自动触发 + 复用收集计数**），把 open-chest 端到端实现出来：

1. `vocabulary.ts`：`MECHANICS` 加 `open-chest`；实现后加进 `RUNTIME_IMPLEMENTED_MECHANICS`（让 `deriveMechanicStatus`
   判它 `supported`，R12 才放行）。
2. `game-config.ts`：`EntityKind` 加 `chest`；`Entity` 加可选 `range`（交互范围，缺省用实体盒子）；`pickupCount`
   改统计 `pickup + chest`（目标变成「捡齐 pickup + 开完 chest」）。
3. `world.ts`：`EntityDesc.kind` 加 `chest`；映射带出 `range` 与 closed/open 状态。
4. `scene.ts`：`addEntity` 加 `case "chest"` —— 近距 overlap → 打开（closed→open 视觉）+ `collected + 1` +
   一次性防重复 + 范围外不触发。
5. `config-tool.ts`（v4 镜像）+ `auditReferences`/`auditGameConfig` 校验 + `shell-mechanic-witness.test.ts` 加
   `open-chest` needle。

## 现状（E1，见 ../findings-codebase.md）

- `pickup` 已一次性（`scene.ts:254` `collect()` 里 `if (!sprite.active) return`）；`collect` 已有 `collected++` + 点亮 pip。
- `EntityKind` 在 `game-config.ts:50`；`EntityDesc.kind` 在 `world.ts:35`；`addEntity` switch 在 `scene.ts:144-168`。

## 建议

- 宝箱 closed→open 视觉用资源的两帧，打开后停帧不循环。
- 奖励复用 `collect()` 的计数路径（开箱 = 一次 collect），`tryWin` 用新的 `pickup + chest` 计数。
- 完成后 `open-chest` **必须**进 `RUNTIME_IMPLEMENTED_MECHANICS` + witness needle —— 否则 R12 会把它当
  `experimental` 拒掉（[票 12](12-registry-witness-impl.md) 的硬约束），本票就白做。

## Answer

**已实现（2026-10-23）** —— `pnpm typecheck` 通过、全仓 **1839 测试全绿**。open-chest 端到端落地：

1. **词表**（`vocabulary.ts`）：`MECHANICS` 加 `open-chest`（注释标明 `EntityKind="chest"` + 可选 `range`）；
   `RUNTIME_IMPLEMENTED_MECHANICS` 加 `open-chest` ⇒ `deriveMechanicStatus` 判 `supported`。
2. **config**（`game-config.ts`）：`EntityKind` 加 `chest`；`Entity` 加可选 `range`（非负 int，交互外扩，缺省 0 =
   交互区就是实体盒子）；`pickupCount` 改统计 `pickup + chest`。`auditReferences` 的「一个 pickup 都没有」措辞
   改为「一个 pickup 或 chest 都没有」。
3. **v4 镜像**（`config-tool.ts`）：`EntityShape.kind` 加 `chest`、加可选 `range`；漂移测试补「chest 带 range 两份都过」。
4. **纯层**（`world.ts`）：`EntityDesc.kind` 加 `chest`、加 `range?: number`；映射带出 `range = e.range ?? 0`；
   `objective.pickupCount` 与 HUD 槽位改用 `pickupCount(cfg)`（数到 chest）。
5. **渲染**（`scene.ts`）：`case "chest"` 不进 physics overlap —— `advanceChests()` 每帧算玩家盒子 × 交互区
   （实体盒子外扩 `range`）相交 → `openChest()`（closed→open 切帧 + `collected+1` + 一次性、范围外不触发）。
   宝箱多帧资源**不建循环动画**（打开后停帧）。
6. **见证**（`shell-mechanic-witness.test.ts`）：`open-chest` needle = `this.openChest(c)`。

**测试**：`vocabulary.test.ts` 的 `ENTITY_KIND_FATE` 加 `chest: "open-chest"`；`game-config.test.ts` 加
「pickupCount 数 chest」「chest 带 range 过 schema」；`world.test.ts` 加「chest 映射 + range 缺省 0 + 槽位同源」。

