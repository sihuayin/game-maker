# 01. config 契约：GameConfig Entity 加 sourceIntent 回指字段

Type: task
Status: resolved
Owner: claude (2026-10-25 · resolved)
Blocked by: —
Map: ../map.md

## Question

给 `GameConfig.Entity` 加一个 `sourceIntent` 字段，作为设计实体身份的回指（Q1=(a) 已裁）。要定的形状：

- **命名** `sourceIntent`：与 VDS 同源（`packages/contracts/src/visual-design.ts` 的 object 已有此名），
  同一身份概念用同一个词。
- **可选**：孤儿实体（`block-*` 地面 solid、`gate` 终点 goal、任何没有设计对位的结构实体）**不带**。
  必填的话孤儿无处填。
- **不唯一**：1:N（`resource-pickup` → 多个 pickup）**共享**同一 `sourceIntent`。`Entity` superRefine 的
  id 唯一检查（`game-config.ts:222`）**只看 `id`、不看 `sourceIntent`**，**不改**。
- **契约不跨文件查设计 id**：`sourceIntent` 悬空（指向设计里不存在的 id）**不在 schema 里判**，
  归票 03（编译期验真）/ 票 04（QA）。schema 只验形状：`sourceIntent?: z.string().min(1)`。

执行：落码 `packages/contracts/src/game-config.ts`（Entity 加字段）+ 补 schema 测试——带/不带
`sourceIntent` 都过、1:N 共享同一 `sourceIntent` 不报 id 重复、空串被 min(1) 拒。

## Answer

已落码（2026-10-25）：

- **`packages/contracts/src/game-config.ts` `Entity`** 加 `sourceIntent: z.string().min(1).optional()`，
  放在 `id` 之后、`kind` 之前，带 doc comment（设计身份回指：`id`=运行时唯一、`sourceIntent`=设计身份）。
- **形状裁定（兑现 Question）**：
  - 命名 `sourceIntent`（与 VDS `visual-design.ts` 同源）。
  - **可选**：孤儿（`block` 地面 solid / `gate` 终点 goal，无设计对位）不带。
  - **不唯一**：1:N（`resource-pickup` → 多个 pickup）共享同一 `sourceIntent`；`GameConfigSchema` 的
    id 唯一 superRefine **只看 `id`、不看 `sourceIntent`**，不改。
  - schema **只验形状**（`optional` + `min(1)`），悬空（指向设计里不存在的 id）**不在 schema 判**，
    归票 03（编译期验真）/ 票 04（QA）。
- **测试**（`game-config.test.ts` +3）：带/不带 `sourceIntent` 都过（孤儿不带）；1:N 共享同一
  `sourceIntent` 不报 id 重复；空串 `sourceIntent` 被 `min(1)` 拒。
- **验证**：`game-config.test.ts` 46/46 · contracts 全 662/662 · 全仓 **1929/1929** · `pnpm typecheck`
  10 包全绿。`GameEntity` 类型新增可选字段，下游（demo / qa / assets）typecheck 全过，无破坏。
