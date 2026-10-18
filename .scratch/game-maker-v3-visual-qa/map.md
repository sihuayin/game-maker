# V3 视觉 QA 接口：免费 inspect 观察接入 QA 报告

Labels: wayfinder:map
Tracker: local-markdown
Effort: game-maker-v3-visual-qa

> **本图 2026-10-18 开。**上一张 [v3 地图](../game-maker-v3/map.md)（Asset Planner Phase 1）已走完；
> 本图是**新一张图**，终点来自它的 `Not yet specified`「视觉 QA 接口」。
> 第一轮裁定的逐字记录在[本轮裁定](issues/01-round-1-rulings.md)；
> ⚠️ **本图带执行**（Q7 = (a)）：终点是接线 + 测试 + 文档，不是只裁接口。

## Destination

**Phase 1 落地**：create/build 在 pack 之后调用**免费**的 `inspectPack`，把它的 summary（含 palette usage /
色板外像素 / 背景层覆盖率，以及**图片实际宽高比、输出尺寸与预期差**）作为
`run/v<N>/qa-report.json.observations` 的 `inspect` 条目（`ok`）；`review` 仍为 `unavailable`。
**报告契约、六条判据、`qaVerdict`、`packages/qa` 白名单（只有 contracts）与付费边界全部不变**；
观察不评分、不阻断、不自动修复。

## Notes

- **输入事实**：
  - `inspectPack`（assets）免费可算 palette usage / 色板外像素 / 背景层覆盖率 / 尺寸；
    summary 是人读的行，`data` 另有结构化 `paletteUsage` / `layerCoverage`；它不进任何自动门禁。
  - `reviewPack` 是付费视觉模型抽查；v2 [票 78](../game-maker-v2/issues/78-reviewpack-wiring.md)
    已裁「人主动调用、不进自动创建链」。
  - `qa-report.json.observations` 只有 `inspect` / `review` 两个来源，每源恰好一条；
    观察是**预渲染 lines**，契约要求原样搬；今天两条都 `unavailable`。
  - `packages/qa` 白名单只有 `contracts`；观察必须由**上游算好传进来**
    （v2 [票 20](../game-maker-v2/issues/20-qa-report-assembly.md)）。
  - v3 plan sidecar 只有 route / reason / inputs，**没有视觉观察**。
- **第一轮边界**（逐字见[本轮裁定](issues/01-round-1-rulings.md)）：
  只做 pack 级、免费 inspect 观察；不做 site 级 QA · 不做 review 注入 · 不新增结构化观察契约 ·
  不新增阻断判据/评分 · 不调用付费视觉上游 · 不改报告 schema / 六判据 / `qaVerdict` / qa 白名单。
- **工作方式**：每轮只问当前前沿；HITL 决定由人裁，AFK 可自行跑；不运行付费上游。
- ✅ **2026-10-18 本图走完**：05 已施工 · 已关 · 已提交（人裁「开工 05」→「提交 · 关票」）。
> 读数：94 文件 / 1543 条全绿 · tsc/build 干净 · check:deps 9 包 · check:links 359/2079 · 零付费上游。
> ✅ **前沿（本段扫描）：空** —— 没有 open / unblocked / unclaimed 的票（05 / 07 已关；其余全部 resolved）。

## Decisions so far

- [inspect 观察接线](issues/05-wiring-tests-docs.md)：**已施工 · 已关 · 已提交** —— pipeline 调 free inspectPack → qa-report 的 inspect 观察；源图→目标尺寸观察；inspect 抛错 unavailable + build 继续；review 仍 unavailable；报告 schema/六判据/qaVerdict/白名单/付费边界不变；94/1543 全绿（基线 94/1538 ⇒ +5）。
- [施工授权](issues/07-construction-authorization.md)：人裁「开工 05」；授权后施工完成并收口。
- [第二轮裁定](issues/06-round-2-rulings.md)：Q9 `QaContext.inspectObservation?`（只收 inspect；未传保持旧 unavailable；只装配不改写）· Q10 原图→目标（animation/layer/single/master/import；drawlist 跳过）；Δ_AR = (r_t/r_s - 1)×100%，一位小数；并入 inspectPack.summary · Q11 抛错→unavailable + build 继续；不伪装 ok；三档测试。
- [qaRunner 输入接口](issues/02-qarunner-observation-input.md)：**已裁** —— `QaContext.inspectObservation?`；向后兼容；只收 inspect。
- [inspect 观察内容](issues/03-inspect-observation-content.md)：**已裁** —— 原图 vs 目标；六类资源口径；源图→目标；不设阈值。
- [inspect 不可用语义](issues/04-inspect-unavailable-semantics.md)：**已裁** —— 成功 ok / 失败 unavailable / 未传旧 unavailable；报告恰好一条；不阻断。
- [第一轮裁定](issues/01-round-1-rulings.md)：Q1 (a) 免费 inspect 接线 · Q2 (a) inspect 现有 + 宽高比/尺寸差 · Q3 (a) qa-report observations · Q4 (a) pipeline 调 inspect、qa 只装配 · Q5 (a) review 保持人工付费 · Q6 (a) site 级另开图 · Q7 (a) 带执行 · Q8 (a) 只观察、不评分/不阻断。

## Not yet specified

- **CLI/MCP 的人类输出**：除了落进 `qa-report.json`，`build` 是否在人类输出里再展示 inspect 观察（本图只要求报告；这一点等接线票再定）。

## Out of scope

- **site 渲染 / 浏览器截图 / 像素检查**（Q6）。
- **review 注入 / 自动调用**（Q5；v2 票 78 的边界不变）。
- **结构化观察新契约 / `asset-observations.json` / plan sidecar 扩展**（Q3）。
- **新的阻断判据、阈值、综合分、自动修复/重生成**（Q8；R3 边界）。
- **风格相似度 / 剪影可读性 / 构图 / 材质相似度**（Q2；v2 已裁没有可算形式）。
- **付费视觉上游调用**（本图零付费）。
- **改报告 schema / 六条判据 / `qaVerdict` / `packages/qa` 白名单**。
