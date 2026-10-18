# 09. Phase 1 施工：resolver + 能力输入 + sidecar + 接线

Type: task
Status: resolved
Owner: claude (2026-10-18 · 人裁「开工 09」→「提交 · 关票」；**已施工 · 已关 · 已提交** —— 施工记录与收口在文末)
Blocked by: 15
Map: ../map.md
> 本图带执行（第一轮 Q1 = (b)）；本票是施工票，等 03–07 全部裁定后开。
> ⚠️ 不改公共 Recipe Schema / CLI/MCP 接口 / Pack 目录与原子发布；不加 existingAssets 输入；
> 不碰 `raster.ts` / 图像生成客户端 / 塔防链；不运行付费上游（测试用 fixture / 假 generator）。

## Question

按 03–07 的裁定落地：
- `resolveRoute` 模块（纯函数、可单测、唯一写 `source.kind`）；
- `planAssets` 接线：模型候选 → resolver → 最终 Recipe；
- 最小能力对象输入与来源；
- plan sidecar 落盘/搬运；
- 测试（08）与文档（含 `plan-assets.test.ts:180` 意图改写）；
- 旧 Recipe / CLI / MCP / pack 回归。
验收 = 第一轮「实施验收方向」+ 地图 Destination。


---

## 施工记录（2026-10-18 · 人裁逐字「开工 09」）

> 按第一~五轮裁定实施 Phase 1。**未提交 · 未关票**（施工 / 提交 / 关票仍是三次独立点头）。
> 零付费上游：测试只用固定 fixture、假 transport、假生成器；规划不 live ping。

### 落地（逐文件）

| 文件 | 改了什么 |
| --- | --- |
| `packages/contracts/src/asset-plan.ts`（新） | `asset-plan/v1` 契约 + `parseAssetPlan`；reason code 闭合枚举 8 个；capabilities / inputs / assets 严格对象。 |
| `packages/assets/src/route.ts`（新） | `resolveRoute` 纯函数：import > image 硬信号 > drawlist 硬信号 > 候选平局；能力缺失不换路；`sourceForDecision`；`plannerCapabilitiesOf`。 |
| `packages/assets/src/ops.ts` | `planAssets` 接入 resolver：能力快照、`existingAssets` 可访问性预检查、最终 source 改写、sidecar 落盘、artifacts；`usage`/`invalid` 分类。 |
| `packages/cli/src/cli.ts` · `packages/mcp/src/server.ts` | `plan`/`plan_assets` 免费解析 image transport；create 把 image transport 传进理解段；命令名/参数不变。 |
| `packages/pipeline/src/create-game.ts` · `artifacts.ts` | `UnderstandingInput.imageTransport`；sidecar 从 `v<N>.plan.json` 复制成 `run/v<N>/asset-recipe.plan.json`；`recipePlan` path。 |
| `packages/assets/src/pack.ts` | **无 `layers` 的背景**按「最远（唯一）层」不抠底（v3 票 09 后 background 硬信号走 image；否则整张图被众数色抠空，站点最远层门禁判死）。 |
| `fixtures/e2e/wasteland-platformer/` | 复制 e2e 的 design / VWS / DNA / recipe / stylespec / reference；新增 `import-frame.png` + 手写 `import-recipe.json`。 |
| 测试 | `asset-plan.test.ts`（5）· `route-resolver.test.ts`（17）· `plan-sidecar.test.ts`（5）· `import-fixture.test.ts`（1）；`plan-assets.test.ts:180` 改写为「最终 route 由 resolver 决定」；pipeline/CLI 夹具补假生图器与 image env；旧 run 无 sidecar 兼容测试；CLI `plan` 退出码 0/2/3/4。 |

### 关键读数

- **路线**：8 个 reason code 全覆盖；硬信号覆盖候选（player/background 的 drawlist 候选 → image，`participated=false`）；候选平局 `participated=true`；import 需 `mustReuse` + `accessible`；能力缺失 `usage`、语义失败 `invalid`。
- **sidecar**：`recipes/v<N>.plan.json`；create 复制到 `run/v<N>/asset-recipe.plan.json`；pack 不读；旧 run 无 sidecar 照常 build；sidecar route 与 Recipe `source.kind` 逐项一致。
- **确定性**：同一归一化输入（含 candidate）跑 20 次，route/reason/inputs/candidate/participated 完全一致。
- **import fixture**：手写 recipe 经 `buildAssetPack` 产出 `imported` 包，`verifyPack` 通过。
- **CLI `plan` 退出码**：成功 0 · 无 image 能力 2 · 语义不合格 4 · 文本上游 500 → 3。
  ⚠️ MCP 的 `plan_assets` 走同一个 `planAssets`/`exitCodeOfError`；本轮没有为 MCP 另加一条退出码测试（CLI 已覆盖三档，MCP 共享同一映射）。
- 五闸：`pnpm test` **94 文件 / 1538 条全绿** · `tsc -b --force` 干净 · `pnpm build` 干净 · `check:deps` ✅ 9 包 · `check:links` ✅ **351 份文档 / 2061 条链接**（收口复测）。
- 账：零付费上游；测试用 fixture / fake transport / fake generator；image 能力只做结构性检查（不 live ping）。

### 没做的

- ⚠️ **没提交 · 没关票**（等另一次点头）。
- ⚠️ 没有为 MCP 另加退出码专测（共享映射见上）。
- ⚠️ 没做视觉 QA / 自动修复 / 重生成 / 跨游戏记忆（PRD §2.2 边界）。


---

### ✅ 收口（2026-10-18 · 人裁逐字「提交 · 关票」）

> 本轮只做三件：① 本票 `in-progress` → `resolved` + 本节；② 本图 `Decisions so far` 加 09 / 15、前沿改为
> 「空」；③ 提交。**源码 / 测试**在施工轮已经落地 —— 本轮**一个上游字节没动**。

- **收口押的是哪几条**：第一~五轮的验收方向全部成立 ——
  ① `resolveRoute` 是 `source.kind` 唯一最终写入者；模型候选只作平局与记录；硬信号覆盖候选；
  ② 8 个 reason code / 冲突矩阵 / 候选缺失 / 能力缺失 / import 条件均有测试；
  ③ sidecar `asset-plan/v1` 独立契约、create 复制到 run、pack 不读、旧 run 无 sidecar 兼容、
     sidecar route 与 Recipe `source.kind` 逐项一致；
  ④ 确定性 20 次同输入一致；`usage`/`invalid`/`upstream` 三档与 CLI `plan` 0/2/4/3 实测；
  ⑤ `import` 只由 fixture 的 `existingAssets` 触发；create 链不扩展输入。
- **五闸**：`pnpm test` **94 文件 / 1538 条全绿** · `tsc -b --force` 干净 · `pnpm build` 干净 ·
  `check:deps` ✅ 9 包 · `check:links` ✅ **351 份文档 / 2061 条链接**（收口复测）。
- ⚠️ **一处照实记**：MCP `plan_assets` 与 CLI 共享同一个 `planAssets` / `exitCodeOfError`，
  本轮没有为 MCP 另加退出码专测（CLI 已覆盖三档）。
- ⚠️ **一处必要的额外改动**：`pack.ts` 把**无 `layers` 的背景**按「最远/唯一层」不抠底 ——
  否则 background 硬信号走 image 后整张图会被众数色抠空，站点最远层门禁判死。它属于 image 路线的执行细节，
  不改 route 分派。
- ⚠️ 测试夹具随新的路线规则更新：pipeline/CLI 的假上游补了**假生图器**与 image env；CLI `imageHeavyRecipe`
  移除了 create 链不支持的 `import` 资产；调用次数按 resolver 后的最终路线重算。
- ✅ **提交**：resolver + sidecar 契约 + 能力/接线 + pack 修复 + fixtures + 测试 +
  v3 地图/票 + PRD 口径 = **同一个 commit**。**未推送**（人裁只说「提交 · 关票」）。
