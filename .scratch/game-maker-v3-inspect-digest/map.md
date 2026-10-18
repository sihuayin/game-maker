# V3 终端摘要：build 的人类输出展示 inspect 观察

Labels: wayfinder:map
Tracker: local-markdown
Effort: game-maker-v3-inspect-digest

> **本图 2026-10-18 开。**上一张 [v3 视觉 QA 图](../game-maker-v3-visual-qa/map.md) 已走完；
> 本图是它的 `Not yet specified` 里那条「CLI/MCP 的人类输出要不要展示 inspect 观察」的**直接续篇**。
> ⚠️ **本图带执行**（第一轮 Q1 = (b)）：终点是终端里真的看得见，不是只裁接口。
> 第一/二轮裁定逐字保留在 [01](issues/01-round-1-rulings.md) / [02](issues/02-round-2-rulings.md)。

## Destination

执行真实 `build` 或 `create --yes` 后，CLI 终端**默认**显示一段简短、可读、**来自结构化数据**的 inspect 观察摘要：
位于现有 QA 裁决行之后、站点行之前；含资源数 · 源图→目标条数 · 最大 |长宽比差| · 色板外像素 · 背景层最低覆盖率，
并指向 `qa-report.json` 与 `game-maker inspect`。inspect 不可用时显示**一行同源、脱敏**的原因。
**QA 判据 / `qaVerdict` / 报告契约 / MCP 输出 / 付费边界全部不变**；摘要只聚合、不评分、不阻断、不加阈值。

## Notes

- **输入事实**（本轮量过）：
  - `build` 与 `create --yes` 共用 `qaReportOf`（`packages/cli/src/cli.ts:401`）；MCP `create_game` 另拼一份 summary（`packages/mcp/src/server.ts:295`）。
  - `qa-report.json` 的 inspect 观察 = `inspectPack` 的 `summary` 原样；契约要求原样搬、不重定型。
  - `BuildResult` 今天**不携带** inspect 的结构化数据；pipeline 在 `create-game.ts:483` 算完只把 `lines` 交给 QA。
  - 真实 wasteland 包（10 个资源）：inspect 全文 20 行；源图→目标 11 条；最大 |Δ_AR| 107.8%；色板外 184 个（0.01%）；背景 4 帧，最低 17.4%。
  - 独立 `game-maker inspect <pack>` 已能看全文；README_zh:102 已写明观察会进 `qa-report.json`。
- **第一轮边界**（逐字见 [01](issues/01-round-1-rulings.md)）：只改 CLI `build` / `create --yes` · 默认展示 3–4 行摘要 + 指针 · 不新增旗标 · unavailable 显式一行 · 只聚合、不设阈值/⚠️/排序。
- **第二轮边界**（逐字见 [02](issues/02-round-2-rulings.md)）：四行草案 · 背景取最低覆盖率（并列取 manifest 首）· 母版计入源图统计 · `InspectData` 从 assets 导出、pipeline 收窄一次、`BuildResult.inspectData?` · 纯函数聚合、缺失段省略、真实零值照显 · 不扩张 `CliDeps` · `--json` summary 自然包含、`data` 不变。
- **工作方式**：每轮只问当前前沿；HITL 决定由人裁；AFK 施工/测试可自行跑；**不运行付费上游**。
- **验收口径**：`pnpm test` / `tsc -b --force` / `pnpm build` / `check:deps` / `check:links` 全绿；再用一条**零付费**的真实 `build`（drawlist fixture run）贴出终端摘要与站点路径仍在其后。
- **授权**：施工已由 [04](issues/04-construction-authorization.md) 按第一/二轮裁定授权；**提交 / 关票不在授权内**，需另一次逐字点头。
- ✅ **2026-10-18 03 已裁**：(a) 整块省略；前沿现在是 [05](issues/05-implementation.md)。
- ✅ **2026-10-18 本图走完**：05 已施工 · 已关 · 已提交（人裁「提交 · 关票」）。
> 读数：96 文件 / 1553 条全绿 · tsc/build 干净 · check:deps 9 包 · check:links 365/2092 · 零付费上游。
> ✅ **前沿（本段扫描）：空** —— 没有 open / unblocked / unclaimed 的票。

## Decisions so far

- [实施：CLI 摘要 + 结构化数据流 + 测试 + 文档](issues/05-implementation.md)：**已施工 · 已关 · 已提交** —— 四行摘要（QA 之后、站点之前）· `InspectData` 经 assets → pipeline → `BuildResult.inspectData` → CLI 纯函数 · unavailable 一行同源原因 · 03 整块省略 · 96/1553 全绿（基线 94/1543 ⇒ +2 文件 / +10 条）· MCP 输出不变。
- [inspect 观察为 ok 但 inspectData 整体缺席时，摘要显示什么](issues/03-inspectdata-absent-semantics.md)：**(a) 整块省略** —— 无 header / 指针 / 占位文案；`ok` 不改写成不可用；artifacts 仍列 `qa-report.json`；不解析文本、不重跑 inspect。
- [第一轮裁定](issues/01-round-1-rulings.md)：Q1 (b) 带执行 · Q2 (a) 只 CLI · Q3 (b) 摘要 + 指针 · Q4 (a) 默认展示 · Q5 (a) unavailable 显式一行 · Q6 (a) 只聚合、不设阈值。
- [第二轮裁定](issues/02-round-2-rulings.md)：四行草案 · 背景最低覆盖率（并列取 manifest 首）· 母版计入 · assets 导出 `InspectData` + pipeline 收窄 + `BuildResult.inspectData?` · 测试矩阵（纯函数 / CLI / pipeline / MCP / `--json`）· 不扩张 `CliDeps`。
- [施工授权](issues/04-construction-authorization.md)：人裁逐字「本图按上述方案进入施工」；提交/关票另需点头。

## Not yet specified

- （暂无 —— 05 已收口，前沿为空；没有够不着的雾。）

## Out of scope

- **MCP `create_game` 的 text/structured 输出**（Q2；本图只改 CLI）。
- **QA 硬失败 / 异常路径的人类输出**（本图只覆盖成功路径；报告仍先落盘、错误路径不动）。
- **review 观察的展示与自动调用**（review 仍人工付费、不进自动链）。
- **阈值、评分、⚠️ 标记、按异常排序、自动修复/重生成**（Q6；观察不升级成判据）。
- **新报告 schema / 字段 / 观察 lines 重定型 / plan sidecar 扩展**（报告契约不变）。
- **新 CLI 旗标**（`--observations` / `--verbose`；Q4）。
- **把摘要写进 `qa-report.json` 或新增持久化文件**（摘要只是终端展示）。
- **`masterRatioNotes` 的既有母版比例输出**（允许与新摘要重复；不改它）。
- **site 级 QA / 浏览器截图 / 像素检查**。
- **修改 `qaVerdict` / 六判据 / `packages/qa` 白名单 / 付费边界**。
