# V3：Asset Planner 与资源生产路线决策改造（第一阶段）

Labels: wayfinder:map
Tracker: local-markdown
Effort: game-maker-v3

> **本图 2026-10-18 开。**输入是 [PRD](../../docs/v3/asset-planner-production-routing-prd.md) 与第一轮离线裁定。
> 它不是从零画的：v2 地图的[票 12](../game-maker-v2/issues/12-asset-planner.md) 已把 `deriveRecipe` 并入
> `planAssets`，并裁定「只有一个写入侧」「策略就是 `source.kind`，六值枚举不成立」。
> ⚠️ **本图把执行带进来**（第一轮 Q1 = (b)）：终点是 Phase 1 落地并通过测试，施工票也挂在图上。
> ⚠️ 第一轮裁定的逐字记录在[本轮裁定](issues/01-round-1-rulings.md)；本图只引用，不复述全文。

## Destination

**Phase 1 落地并通过测试**：在现有 `planAssets` / `pack` 链上，模型产完整 Recipe 与路线候选，
**确定性 `resolveRoute` 是 `source.kind` 的唯一最终写入者**；能力对象约束可执行路线；
每项资源留 **plan sidecar**（id / route / reason / inputs）追溯；`import` 只保证规则与 pack 支持，
create 链的素材输入留后续；**公共 Recipe Schema、CLI/MCP 接口、Pack 目录结构与原子发布语义不变**。

## Notes

- **输入文档**：[docs/v3/asset-planner-production-routing-prd.md](../../docs/v3/asset-planner-production-routing-prd.md)
  （2026-10-18 已按 Q3 同步 `deriveRecipe → planAssets` 的口径）。
- **既有约束**：v2 [票 12](../game-maker-v2/issues/12-asset-planner.md) 的「唯一写入侧 / 策略 = source.kind /
  六值枚举不成立」；现有测试 `plan-assets.test.ts:180` 的意图按 Q2 改写为「最终路线由 resolver 决定」。
- **本轮边界（逐字引用见[本轮裁定](issues/01-round-1-rulings.md)）**：
  不重开 v2 票 12 · 不改公共 Recipe Schema / 不加 `decisionReason` · 不加 `existingAssets` 输入 ·
  不建跨包 capability registry · 不改 CLI/MCP 接口与 Pack 目录 · 模型路线不是最终判决。
- **工作方式**：每轮只问当前前沿；HITL 决定由人裁，AFK 审计/测试可自行跑；不运行付费上游。
- ✅ **2026-10-18 本图走完**：09 已施工 · 已关 · 已提交（人裁「开工 09」→「提交 · 关票」）。
> 读数：94 文件 / 1538 条全绿 · tsc/build 干净 · check:deps 9 包 · check:links 351/2061 · 零付费上游。
> ✅ **前沿（本段扫描）：空** —— 没有 open / unblocked / unclaimed 的票（09 / 15 已关；其余全部 resolved）。

## Decisions so far

- [Phase 1 施工](issues/09-phase1-implementation.md)：**已施工 · 已关 · 已提交** —— `resolveRoute`（import > image 硬信号 > drawlist 九宫格 > 候选平局）· `asset-plan/v1` sidecar · 能力快照/结构性检查 · create 复制到 run · pack 不读 · 旧 run 兼容；94/1538 全绿（基线 90/1504 ⇒ +4 文件 / +34 条）。
- [Phase 1 施工授权](issues/15-phase1-construction-authorization.md)：人裁「开工 09」；授权后施工完成并收口。
- [第一轮顶层裁定](issues/01-round-1-rulings.md)：Q1 (b) 带执行 · Q2 (a) 模型 + 确定性 resolver · Q3 (a) `deriveRecipe` 标为历史、目标 `planAssets` · Q4 (b) `import` 仅规则/pack 支持 · Q5 (a) plan sidecar · Q6 (a) 最小能力对象。
- [第五轮裁定](issues/14-round-5-rulings.md)：测试基准收口 —— fixtures 复制、测试落点、sidecar 新契约 `asset-plan/v1`、12 组 + N=20 + Schema 专项、旧测试改写、观察/门禁分离、零付费。
- [测试基准](issues/08-test-baseline.md)：**已裁** —— fixture 来源/落点/用例/门禁齐备；09 的施工授权另由 15 把关。
- [第四轮裁定](issues/13-round-4-rulings.md)：确定性 = 固定归一化输入（含候选）下 resolver 可重复；纯函数 + ref 预检查；错误分类 `usage`(2) / `invalid`(4) / `upstream`(3)，能力缺失归 usage；失败不落 sidecar。
- [确定性语义](issues/04-determinism-semantics.md)：**已裁** —— 归一化输入含候选；模型资源发现/候选随机性不承诺；resolver 纯函数。
- [错误语义](issues/05-error-semantics.md)：**已裁** —— 能力缺失 usage；路线/ref/sidecar/invalid；schema 重采样保留、语义失败不重采样；失败无 sidecar。
- [第三轮裁定](issues/12-round-3-rulings.md)：03 规则细节（fixture-only import、image 信号顺序、ninePatch 窄口径、8 个 reason code）· 06 sidecar 字段/枚举/搬运 · 07 结构性能力检查（不 live ping）。
- [路线规则矩阵](issues/03-route-decision-rules.md)：**已裁** —— import fixture-only；image `characterId > masterAsset > animation > background`；drawlist 仅 `kind:ui`+有效 ninePatch；非九宫格 UI 由候选，缺失则失败；无合法路线/能力缺失硬失败。
- [plan sidecar 形状](issues/06-plan-sidecar-shape.md)：**已裁** —— 顶层元数据+能力快照+style/reference；每项 id/route/reason/inputs/candidate/participated；plan artifacts 含 sidecar；pack 不读；旧 Recipe 可无。
- [能力对象形状](issues/07-capability-object-shape.md)：**已裁** —— routes 三布尔 + runtime 只记录；image/drawlist 结构性检查、不 live ping；import create 链 false；plan 期失败。
- [第二轮裁定](issues/11-round-2-rulings.md)：Q7 候选只作 image/drawlist 平局裁决 · import > image > drawlist · 不纳入 size/required/dependsOn；Q8 sidecar 方向；Q9 能力对象形状 / create 链 import=false / runtime 只记录。细节仍在 03/06/07。
- [PRD 口径同步](issues/10-prd-terminology-update.md)：`deriveRecipe` 标为历史、目标改为 `planAssets`；头部口径注记 + §2.1 / §11 Task 1–2 四处措辞同步。
- [现状审计](issues/02-local-audit.md)：`deriveRecipe` 已并入 `planAssets`；pack 已严格按 `source.kind` 分派；合法枚举三值；缺口是「路线在提示词里」、无 sidecar / 能力输入、`import` 在 create 链不可达。

## Not yet specified

- **视觉 QA 接口**：sidecar 的观察值将来如何喂给资源视觉 QA（Phase 1 不实现，接口在哪一层仍未定）。
- **人读的规划摘要**：CLI/MCP 的 `plan` 输出是否展示 `resolveRoute` 的 reason（还是只落 sidecar）；
  等 sidecar 形状（06）定了再决定。
- **规则矩阵的剩余边界**：03 解完后若仍有无法归类的混合资源，再 graduate 成新票；现在不预切。

## Out of scope

- PRD §2.2 的全部：重写 `raster.ts` / 改 AssetPack 布局 / 新增 `derived` 或任何 source.kind /
  碰撞体进资源清单 / VWS 直接进图像生成 / 跨游戏视觉记忆 / 自动重试·修复·重生成 /
  单一 QA 分数 / 塔防旧链与其他 RuntimeProfile 分派 / `compile-runtime` 的 GameConfig 唯一写入职责。
- **create 链的 `existingAssets` 输入**（Q4 = (b) 明确留后续）：本阶段不宣称 `import` 端到端可用。
- **跨包 capability registry**（Q6 = (a) 明确不建）。
- **公共 Recipe Schema 扩张 / `decisionReason` 字段**（Q5 = (a) 明确不加）。
- **重开 v2 票 12 / 恢复 `deriveRecipe` / 让模型路线成为最终判决**（Q2/Q3）。
- **CLI/MCP 接口改动、Pack 目录/版本/原子发布语义改动**（第一轮边界）。
