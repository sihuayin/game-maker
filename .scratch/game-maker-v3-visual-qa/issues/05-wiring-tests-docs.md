# 05. 接线、测试与文档：inspect 观察进入 QA 报告

Type: task
Status: resolved
Owner: claude (2026-10-18 · 人裁「开工 05」→「提交 · 关票」；**已施工 · 已关 · 已提交** —— 施工记录与收口在文末)
Blocked by: 07
Map: ../map.md
> 本图带执行（第一轮 Q7 = (a)）。等 02/03/04 裁定后开。

## Question

按 02–04 落地：
- pipeline 在 pack 之后调 `inspectPack`；按 04 构造 inspect 观察；传入 `qaRunner`（按 02 的接口）。
- `qaRunner` 原样装配 inspect 观察；review 保持 `unavailable`；报告契约/六判据/`qaVerdict`/白名单不变。
- 按 03 增加宽高比/尺寸差观察（在 assets 的 `inspectPack` 里算，不在 qa 层重算）。
- 测试：成功 / inspect 抛错 / 未传观察三档；create/build 真链；现有 QA/pipeline/CLI 回归；
  不调用付费视觉上游。
- 文档：说明 inspect 观察现在会进 `qa-report.json`；review 仍人工付费。
- 验收：第一轮「3. 验收范围」7 条。


---

## 施工记录（2026-10-18 · 人裁逐字「开工 05」）

> 按第一~二轮裁定实施。**未提交 · 未关票**；零付费上游。

### 落地（逐文件）

| 文件 | 改了什么 |
| --- | --- |
| `packages/contracts/src/qa.ts` | `QaContext.inspectObservation?: Observation`（可选输入；不落盘、不改报告 schema）。 |
| `packages/qa/src/assemble.ts` | qaRunner 原样使用 `ctx.inspectObservation`；没给 ⇒ 旧的 standalone unavailable；review 仍 unavailable；注释同步。 |
| `packages/assets/src/ops.ts` | `inspectPack` 新增「源图 → 目标」观察段：animation / background layer / single / master（master-ratios canonical）/ import；drawlist 跳过；Δ_AR = (r_t/r_s − 1)×100%，一位小数；`data.sourceSizes` 保留结构化诊断值。 |
| `packages/pipeline/src/create-game.ts` | pack 之后调 `inspectPack`（可选测试注入 `inspect`）；成功 ⇒ `{source:"inspect",outcome:"ok",lines:summary}`；抛错 ⇒ `unavailable` + 自包含 reason（不带路径/堆栈）+ build 继续；传入 qaRunner。 |
| `README.md` / `README_zh.md` | 说明 inspect 观察现在进 `qa-report.json`；review 仍人工付费、不进自动链。 |
| 测试 | QA assemble +2（提供 ok / 提供 unavailable）；pipeline +2（成功 / inspect 抛错，六判据 + qaVerdict 不变）；pack-master +1（母版 canonical）；import fixture 补 inspect 断言。 |

### 读数

- `pnpm test` **94 文件 / 1543 条全绿**（基线 94 / 1538 ⇒ +5 条）
- `tsc -b --force` 干净 · `pnpm build` 干净 · `check:deps` ✅ 9 包 · `check:links` ✅ 359 份文档 / 2077 条链接
- 全程零付费；没有调用 `reviewPack`；没有 site 级截图；报告 schema / 六判据 / qaVerdict / qa 白名单未改。

### 没做的

- ⚠️ **没提交 · 没关票**（等另一次点头）。
- ⚠️ CLI/MCP 的人类输出里没有额外展示 inspect 观察（本图只要求落进 `qa-report.json`；见地图 Not yet specified）。


---

### ✅ 收口（2026-10-18 · 人裁逐字「提交 · 关票」）

> 本轮只做三件：① 本票 `in-progress` → `resolved` + 本节；② 本图 `Decisions so far` 加 05 / 07、前沿改为「空」；
> ③ 提交。**源码 / 测试**在施工轮已经落地 —— 本轮**一个上游字节没动**。

- **收口押的是哪几条**：第一轮 §3 的 7 条 + 第二轮 Q9–Q11 全部成立 ——
  ① create/build 成功后 `qa-report.json` 含免费 inspect 观察（`inspect: ok`）；
  ② 现有 inspect 指标 + 源图→目标宽高比/尺寸差有确定性文本；qa 层未重算；
  ③ sidecar 不扩、报告 schema 不变；④ review 仍 `unavailable`、不被自动调用；
  ⑤ 六判据 / `qaVerdict` / qa 白名单不变；⑥ 成功 / inspect 抛错 / 未传观察三档测试；
  ⑦ 全程零付费。
- **五闸**：`pnpm test` **94 文件 / 1543 条全绿** · `tsc -b --force` 干净 · `pnpm build` 干净 ·
  `check:deps` ✅ 9 包 · `check:links` ✅ **359 份文档 / 2079 条链接**（收口复测）。
- ⚠️ **一处余量照实记**：CLI/MCP 的人类输出没有额外展示 inspect 观察（本图只要求进 `qa-report.json`；
  留在图上的 `Not yet specified`）。
- ✅ **提交**：代码 + 测试 + README + 本图/票 = **同一个 commit**。**未推送**（人裁只说「提交 · 关票」）。
