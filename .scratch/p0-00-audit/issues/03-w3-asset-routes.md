# 03. W3 资源生产路线审计

Type: research
Status: resolved
Owner: claude（2026-10-20 认领 · research 子代理）
Blocked by: —
Map: ../map.md

## Question

审计 HEAD 上的资源生产路线：`planAssets`（`packages/assets/src/ops.ts:249`）、
`resolveRoute`（`packages/assets/src/route.ts:80`，调用点 `ops.ts:370`）与 `pack` 执行器。

核实 A-01 / A-02：

- **A-01**：`deriveRecipe` 是否仍存在 / 是否仍默认 `drawlist`。v3 已把 `deriveRecipe` 并入
  `planAssets`，若函数已不存在，应如实写「不可复现 / 已被 v3 取代」，不得强行凑证据。
- **A-02**：路线决策能否区分复杂角色、敌人、环境与道具。

按任务书 W3 的 6 类样例各取代表性资源（主角与移动动画、敌人 / NPC、大型环境物件、
高频小型道具、HUD / UI、已有外部资源），每类记录：

输入规格 → 规划输出 → `source.kind` → 选择理由（plan sidecar）→ 执行结果 → 产物位置 →
测试覆盖 → 失败表现。

同时核查：合法路线枚举是否仍为 `image` / `drawlist` / `import`；不合法或缺少必要输入时
是否明确失败，不得静默降级为任意默认路线。

## 验收

路线选择由可测试规则决定；非法 / 缺输入明确失败；每个样例的证据可追溯。
样本可来自既有 fixture / 归档产物，不得触发付费上游。

## 边界

- 只读；零付费；不改源码 / Schema / 路线；只写 `research/w3-asset-routes.md`。
- 不新增 `source.kind`，尤其不新增 `derived`。

## 产出

`research/w3-asset-routes.md`：6 类样例表 + 路线规则证据 + A-01 / A-02 裁定 + `## Answer`。

## Answer

完整审计见 [research/w3-asset-routes.md](../research/w3-asset-routes.md)。

- **A-01：不可复现 / 已被 v3 取代。** `deriveRecipe` 在 HEAD 已不存在（全仓 grep 只剩 `packages/assets/src/prompt.ts:563` 的历史注释）；唯一规划入口是 `planAssets`（`packages/assets/src/ops.ts:249`）。HEAD 没有「默认 `drawlist`」分支：无硬信号且候选非法时 `resolveRoute` 返回 `no-route` 硬失败（`packages/assets/src/route.ts:117`）。证据等级：不存在 **E1**，新行为 **E2**（`route-resolver.test.ts:29-121`）。
- **A-02：部分成立。** 确定性规则能区分：`characterId` → `image:character`、`masterAsset` → `image:master`、`kind:animation` → `image:animation`、`kind:background` → `image:background`、`ui+ninePatch` → `drawlist:ui-ninepatch`、显式 `existingAssets+mustReuse` → `import:explicit-ref`；其余由模型候选在 `image`/`drawlist` 之间平局（`participated=true`）。敌人 / NPC 无独立信号，大型非背景物件与高频小道具无尺寸 / 频率规则，非九宫格 UI 由候选决定。**不能宣称「按六类语义智能分类」**。等级 **E2**（规则）+ **E3**（归档 product）。
- **合法路线枚举**：仍是 `image` / `drawlist` / `import`（`packages/contracts/src/asset-plan.ts:13`；`asset-plan.test.ts:33-36` 断言三值）。Recipe 的 `source.kind` 另有 `frames`（`packages/contracts/src/recipe.ts:143`），但它不是 route，且规划期会被静默折叠成 `image`（`ops.ts:372` + `route.ts:154`；sidecar 的 `candidate` 也只记 `image`）——**本次审计发现的最大缺口（P1 修正项）**。
- **非法 / 缺输入**：非法 `source.kind`、设计 / 世界不过 Schema、不可访问的 import ref、能力缺失、候选 `import`（无 `mustReuse`）都明确失败，且规划失败不落 recipe / sidecar（`plan-sidecar.test.ts:87-113`、`plan-assets.test.ts:242/252`、`route-resolver.test.ts:78-121`）。唯一静默降级是 `frames → image`。
- **六类样例**：主角 / 敌人 / 大型环境 / 小型道具 / UI 均有 HEAD 规划输出 + 归档真实规划 / 执行产物；import 路线为 **E2**（`plan-sidecar.test.ts:94-107`、`import-fixture.test.ts:13`），pack 执行为 **E3**（`pack.test.ts:117-187` 与归档 v7 包）。
- **零付费**：只跑免费测试（2 组，共 28 + 77 条，exit 0）与注入假 fetch 的本地探针；未运行任何真实 `plan`/`pack`/`build`/`create`/`site`，未改 `game-maker.local.json`。
