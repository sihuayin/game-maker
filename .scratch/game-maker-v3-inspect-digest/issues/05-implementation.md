# 05. 实施：CLI 摘要 + 结构化数据流 + 测试 + 文档

Type: task
Status: resolved
Owner: claude (2026-10-18 · 人裁逐字「开工 05」→「提交 · 关票」)
Blocked by: 03
Map: ../map.md
> 施工已由 [04](04-construction-authorization.md) 按 01 / 02 授权；**提交 / 关票不在授权内**。
> 零付费上游 · 不改 MCP 输出 · 不改报告契约。

## Question

按 01 / 02 / 03 落地：

**assets**
- 导出 `InspectData` 类型（`inspectPack.data` 的形状）以及它需要的子类型（`SourceSizeEntry`、palette usage 等）；只加类型导出，**不改 `inspect` 的行为或 summary 文本**。

**pipeline**
- 在 `create-game.ts` 把 `inspected.data` **收窄一次**（与 `ledgerOf` 同款纪律），成功时给 `BuildResult.inspectData?: InspectData`；inspect 抛错时字段不存在。
- 不重复调用 `inspectPack`、不重读 PNG；`qa-report.json` 的观察与 `lines` 原样搬运不变。

**CLI**
- 新增**纯函数**聚合器 / 渲染器（无 I/O、不调用 inspect、不读 PNG、不解析 summary 文本）；输入只有 `InspectData` 与 unavailable 原因。
- 四行草案：
  ```text
  资源观察摘要（不评分 · 不阻断）：
    N 个资源 · 源图→目标 M 条 · 最大 |长宽比差| X.X%（<label>）
    色板外像素 P 个（S.SS%） · 背景层 K 帧 · 最低覆盖 C.C%（<frame>）
    全文：<run 相对路径>/qa-report.json · game-maker inspect <pack 相对路径>
  ```
- 位置：现有 QA 裁决行之后、站点行之前（`qaReportOf` / 两条命令共用的路径）。
- 规则：
  - 源图观察为空 ⇒ 省略「源图→目标」段；背景帧为空 ⇒ 省略「背景层」段；数据缺失 / 类型不符 ⇒ 省略对应段，不抛错、不以 `0` 冒充。
  - 色板外真实为 `0` ⇒ 照常显示 `0 个（0.00%）`。
  - 最大 |Δ_AR| 用未舍入的 `deltaAr` 取绝对值，显示一位小数；并列取 manifest 顺序第一条。
  - 背景覆盖率取最小 `ratio`，显示帧名，一位小数；并列取 manifest 顺序第一条。
  - 比例两位小数；标签沿用 `inspect`（动画/背景层 `id.unit`，单资源/母版 `id`）。
- unavailable：从 `b.qa.observations` 的 `source: "inspect"` 条目取 `reason`，显示一行「inspect 观察不可用：<reason>」；不新增字段、不带路径/堆栈。
- `inspectData` 整体缺席而观察为 `ok` ⇒ **整块省略**：无 header、无指针、无占位文案；不把 `ok` 说成不可用（03）。
- `--json` 的 `summary` 自然包含摘要行，`data` 不变；MCP 不动。

**测试**
- 聚合器纯函数：最大值/并列取首、最低覆盖率/并列取首、空数组、零占比、缺失字段、非法字段、unavailable 渲染。
- CLI 集成：`build` 与 `create --yes` 各一条，断言四行摘要 + 站点路径仍在其后。
- CLI 渲染：`inspect=ok` 且 `inspectData` 缺失时摘要块整体不出现，artifacts 指针仍正常输出（03）。
- pipeline：成功时 `inspectData` 存在；inspect 抛错时不存在；QA 报告观察语义不变。
- MCP：`create_game` 文本不出现新增摘要行。
- 回归：`--json` 的 `summary` 含摘要、`data` 不变。
- 不扩张 `CliDeps`；测试用 fake 上游与固定 fixture，零付费。

**文档**
- `README_zh.md` 与 `README.md` 各补一段：终端摘要来自 inspect 结构化数据；全文仍在 `qa-report.json` 与 `game-maker inspect`。CLI help 不动。

**验收**
- `pnpm test` / `tsc -b --force` / `pnpm build` / `check:deps` / `check:links` 全绿。
- 一条**零付费**真实 `build`（drawlist fixture run）贴出终端摘要，并确认站点路径仍在其后。
- 全绿读数与改动清单写进本票；**不提交、不关票**，等逐字点头。

---

## 施工记录（2026-10-18 · 人裁逐字「开工 05」）

> 按 01 / 02 / 03 落地；**未提交 · 未关票**；零付费上游。

### 落地（逐文件）

| 文件 | 改了什么 |
| --- | --- |
| `packages/assets/src/ops.ts` | 导出 `InspectData` / `InspectAsset` / `InspectPaletteUsage` / `SourceSizeEntry`（`inspectPack.data` 的形状，只定型、不改行为）；`inspectPack.data` 复用已经算好的 `bg`，不再扫第二遍。 |
| `packages/pipeline/src/create-game.ts` | `inspectDataOf` 收窄一次；`BuildResult.inspectData?: InspectData`（inspect 抛错 ⇒ 缺席）；只传数据、不落盘、不进报告。 |
| `packages/cli/src/inspect-digest.ts` | 新增**纯函数** `inspectDigestLines` / `inspectObservationOf`：不 I/O、不调 inspect、不读 PNG、不解析 summary；四行草案；缺段省略、真实零值照显、非法字段安全省略、确定性并列取首。 |
| `packages/cli/src/cli.ts` | `qaReportOf` 收 `inspectData` + `packDir`；摘要放在 QA 裁决行之后、站点行之前；unavailable 从 `qa.observations` 取同源原因；`--json` 的 `summary` 自然包含、`data` 不变；MCP 未改。 |
| `README_zh.md` / `README.md` | 各补一段：终端默认摘要、数据来源、完整文本仍在 `qa-report.json` / `game-maker inspect`；CLI help 不动。 |
| `CONTEXT.md` | 补**人类输出** / **观察摘要** 两个词条（domain modeling）。 |
| 测试 | 新增 `packages/cli/tests/inspect-digest.test.ts`（8 条纯函数）、`packages/mcp/tests/create-game-no-digest.test.ts`（MCP 反证）；CLI 集成补 `build` / `create --yes` 摘要与顺序、`--json` 回归；pipeline 补 `inspectData` 在/不在。 |

### 读数（五闸）

- `pnpm test` **96 文件 / 1553 条全绿**（基线 94 / 1543 ⇒ +2 文件 / +10 条）
- `tsc -b --force` 干净 · `pnpm build` 干净（demo/cli/mcp 三个 bundle 都过）
- `check:deps` ✅ 9 包 · `check:links` ✅ 365 份文档 / 2092 条链接
- 全程零付费：所有验收走 fake 上游；没有调用 `reviewPack`；没有改 QA 判据 / 报告 schema / MCP 输出。

### 零付费真实 build 输出（fake 上游 · drawlist fixture）

```text
这次运行：wasteland/run/v1（v1 · wasteland）· 包 v1
包：wasteland/pack/v1（4 个资源）
✅ QA：没有一条判据说不行 · 5/6 条由 QA 跑过（裁决 incomplete） —— 没跑的：层覆盖
资源观察摘要（不评分 · 不阻断）：
  4 个资源 · 源图→目标 4 条 · 最大 |长宽比差| 29.7%（p-body.idle）
  色板外像素 0 个（0.00%） · 背景层 1 帧 · 最低覆盖 100.0%（bg-dusk）
  全文：wasteland/run/v1/qa-report.json · game-maker inspect wasteland/pack/v1
站点：wasteland/site/v1（复用已存在的包 wasteland/pack/v1）
...
EXIT 0
```

### 没做的 / 照实记

- ⚠️ **没提交 · 没关票**（等另一次「提交 / 关票」点头）。
- ⚠️ `pnpm typecheck` 在 `packages/assets/tests/prompt.test.ts:257` 报 `Cannot find name 'CharacterDNA'`
  —— 该文件**本票未改**、且 `tsc -b --force` 干净；这是工作树里**先前就在**的测试类型错误，不在本票范围。
- 摘要只覆盖 inspect；review / MCP / QA 硬失败路径 / 阈值评分全部按 Out of scope 不动。


---

### ✅ 收口（2026-10-18 · 人裁逐字「提交 · 关票」）

> 本轮只做三件：① 05 `claimed` → `resolved` + 本节；② 地图 `Decisions so far` 加 05、前沿改为「空」；
> ③ 提交。**源码 / 测试 / 文档**在施工轮已经落地 —— 本轮**一个上游字节没动**。

- **押的是哪几条**：01 / 02 / 03 全部成立 —— 四行摘要来自结构化数据；背景取最低覆盖率（并列取 manifest 首）；
  母版计入；`InspectData` 走 assets → pipeline → `BuildResult.inspectData` → CLI 纯函数；缺段省略、
  真实零值照显；unavailable 一行同源原因；`inspect=ok` + `inspectData` 缺失 ⇒ 整块省略；
  QA 判据 / 报告契约 / MCP 输出 / 付费边界不变。
- **五闸**：`pnpm test` **96 文件 / 1553 条全绿** · `tsc -b --force` 干净 · `pnpm build` 干净 ·
  `check:deps` ✅ 9 包 · `check:links` ✅ **365 份文档 / 2092 条链接**。
- ⚠️ **一处余量照实记**：`pnpm typecheck` 的 `packages/assets/tests/prompt.test.ts:257`
  （`CharacterDNA` 未导入）是**本票之前就存在**的测试类型错误；本票未改该文件，`tsc -b` 干净。
- ✅ **提交**：代码 + 测试 + README + CONTEXT + 本图/票 = **同一个 commit**。**未推送**（人裁只说「提交 · 关票」）。
