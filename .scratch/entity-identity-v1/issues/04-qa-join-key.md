# 04. QA 第 7 判据改 join 键：id → sourceIntent（保持严格）

Type: task
Status: resolved
Owner: claude (2026-10-25 · resolved)
Blocked by: 01
Map: ../map.md

## Question

把 `visualConfigCoherence`（`packages/qa/src/visual.ts:204`）的 join 键从 `config.entity.id` 改成
`config.entity.sourceIntent`（Q1=(a) 的 QA 侧兑现，PRD P0-05「保留精确身份关联」）。改两处：

- `entityOf` 从 `Map(config.entities.map(e => [e.id, e]))`（`visual.ts:219`）改成
  `Map<string, GameConfig["entities"][number][]>`——按 `sourceIntent` 分组（**1:N 一个键多个实体**）。
- 查找 `entityOf.get(obj.sourceIntent)`（`visual.ts:229`）改为「按 `sourceIntent` 取**列表**」。

语义保持（**不放松**，PRD P0-05）：

- **设计→config 方向**：每个 VDS 带 `sourceIntent` 的对象 → ≥1 个 config 实体 `sourceIntent` 相同；
  0 个 = 「不存在」error（原文案不变，只是不再误报）。
- **1:N**：同 `sourceIntent` 的每个 config 实体都要 `kind` 落在该桶允许集合 `DESIGN_BUCKET_KINDS`
  （`visual.ts` 顶部那表）；**任一**串桶 = error。
- **保持**：`player` 排除、无 `sourceIntent` 的纯装饰排除、几何漂移 warning（只报不阻断）、
  串桶 error 优先跳过几何观察（避免 `(judgement,target)` 重复）。
- **明确不做**：模糊匹配 / 名称匹配 / 数组位置匹配（PRD §4.3 已禁）。

执行：改 `visual.ts` + 补测试——1:N（多个 pickup 都合法、其中一个串桶则 error）、孤儿不误报、
悬空 sourceIntent 缺失仍 error、精确匹配通过。

## Answer

已落码（2026-10-25）：

- **`packages/qa/src/visual.ts` `visualConfigCoherence`**：join 键从 `config.entity.id` 改成
  `config.entity.sourceIntent`。`entityOf`（`Map<id, entity>`）换成 `bySource`（按 `sourceIntent` 分组的
  多映射，`sourceIntent === undefined` 的孤儿不进组）。
- **1:N 语义**（Q1=(a) 的 QA 侧兑现）：
  - coverage —— 每个 VDS 带 `sourceIntent` 的对象 → ≥1 个 config 实体 `sourceIntent` 相同；0 个 = 「不存在」error。
  - 串桶 —— 同 `sourceIntent` 的**任一**实体 `kind` 越出 `DESIGN_BUCKET_KINDS` 允许集合 = error。
  - 几何观察 —— 只报不阻断，取第一个实体比尺寸（1:N 实体共享同一设计实体/资源，尺寸一致）。
  - 保持：`player` 排除、无 `sourceIntent` 装饰排除、串桶 error 优先跳过几何观察、不做模糊/位置匹配。
- **测试**（`assemble.test.ts`）：`configWith` 给实体补 `sourceIntent`（否则新 join 键查不到）；+2 条
  1:N（多个实体都合法 ⇒ 无 error；其中一个串桶 ⇒ error）。
- **验证**：qa 31/31（assemble 17 · visual 14）· 全仓 **1938/1938** · `pnpm typecheck` 10 包绿。
