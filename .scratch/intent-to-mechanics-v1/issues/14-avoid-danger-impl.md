# 14. avoid-danger 实现切片：MECHANICS + EntityKind danger + 定时打击 + 校验 + 见证

Type: task
Status: resolved
Owner: main session · 2026-10-23
Blocked by: —
Map: ../map.md

## Question

落地 [票 05](05-avoid-danger-semantics.md) 的语义（**定时打击 + 复用复位**），把 avoid-danger 端到端实现出来：

1. `vocabulary.ts`：`MECHANICS` 加 `avoid-danger`；实现后加进 `RUNTIME_IMPLEMENTED_MECHANICS`（让
   `deriveMechanicStatus` 判它 `supported`，R12 放行）。
2. `game-config.ts`：`EntityKind` 加 `danger`；`Entity` 加可选 `strike`（`{ periodMs, activeMs }`，打击区 = 实体盒子）；
   `auditReferences`/`auditGameConfig` 校验 strike 参数。
3. `world.ts`：`EntityDesc.kind` 加 `danger`；映射带出 `strike` 与 idle/active 状态。
4. `scene.ts`：`addEntity` 加 `case "danger"` —— 定时 idle↔active 循环；active 时 overlap 玩家 → hit（复用
   `hitHazard` 复位）。
5. `config-tool.ts`（v4 镜像）+ `shell-mechanic-witness.test.ts` 加 `avoid-danger` needle。

## 现状（E1，见 ../findings-codebase.md）

- `Motion`（cycle）是**位置**周期（`game-config.ts:59`）；`strike` 是**激活**周期（idle/active），不同概念，不混用。
- hazard 走 `advanceHazards`（`scene.ts:241`）做位置周期；danger 需要一个**状态周期**（idle↔active），渲染层新写。
- 复位 `hitHazard`（`scene.ts:275`）可复用。

## 建议

- `strike` 与 `motion` 正交：danger 是静止区 + 激活周期；将来若要「移动的定时打击」再组合两者，本票不做。
- danger 的 idle/active 视觉用资源两帧，active 帧只在喷发窗口播。
- 完成后 `avoid-danger` **必须**进 `RUNTIME_IMPLEMENTED_MECHANICS` + witness needle（[票 12](12-registry-witness-impl.md) 的硬约束），否则 R12 把它当 `experimental` 拒掉。

## Answer

**已实现（2026-10-23）** —— `pnpm typecheck` 通过、全仓 **1839 测试全绿**。avoid-danger 端到端落地：

1. **词表**（`vocabulary.ts`）：`MECHANICS` 加 `avoid-danger`（注释标明 `EntityKind="danger"` + `strike`）；
   `RUNTIME_IMPLEMENTED_MECHANICS` 加 `avoid-danger` ⇒ `deriveMechanicStatus` 判 `supported`。
2. **config**（`game-config.ts`）：`EntityKind` 加 `danger`；新 `Strike = { periodMs, activeMs }`（正整数）；`Entity`
   加可选 `strike`。**结构不变量**：`danger` 缺 `strike` 在 `superRefine` 就拦（parse 时，不是 audit 时）——
   「永不喷发的 danger」名存实亡。
3. **v4 镜像**（`config-tool.ts`）：`EntityShape.kind` 加 `danger`、加 `StrikeShape`；漂移测试补「danger 缺 strike
   契约拒、镜像放行」（与「id 重复」同类的**明示例外**——refine 不镜像）。
4. **纯层**（`hazard.ts`）：新纯函数 `dangerState(periodMs, activeMs, elapsedMs)` —— `idle`（安全窗口）↔ `active`
   （喷发窗口）循环；完整周期 = `periodMs + activeMs`，喷发落在周期的**最后** `activeMs`，t=0 从 idle 开始。
   `world.ts` 的 `EntityDesc` 加 `danger` + `strike`。
5. **渲染**（`scene.ts`）：`case "danger"` 存 `{ box, idleFrame, activeFrame, periodMs, activeMs }`；
   `advanceDangers(delta)` 用 `dangerState` 切帧，active 窗口内玩家盒子与 danger 盒子相交 → `hitHazard()`（复用复位）。
   danger 多帧资源**不建循环动画**（喷发窗口播 active 帧、否则 idle 帧）。
6. **见证**（`shell-mechanic-witness.test.ts`）：`avoid-danger` needle = `dangerState(d.periodMs, d.activeMs, d.t)`。

**测试**：`vocabulary.test.ts` 的 `ENTITY_KIND_FATE` 加 `danger: "avoid-danger"`；`game-config.test.ts` 加
「danger 缺 strike 被拒」「danger 带 strike 过 schema」；`hazard.test.ts` 加 `dangerState` 相位/非法参数判据；
`world.test.ts` 加「danger 映射 + strike 带出」。

