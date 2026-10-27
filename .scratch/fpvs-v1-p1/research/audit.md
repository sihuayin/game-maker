# 票 01 研究：阶段A 只读审计（现有报告 / 状态 / 产物关联）

Date: 2026-10-27 · 零付费（只读代码 + 读既有 run/issue 产物，未跑 create/build/生图）

## 结论速览（TL;DR）

1. **报告结构**：`qa-report.json` 由 `packages/pipeline/src/create-game.ts` 的 `runBuild()` QA 步生成
   （schema `packages/contracts/src/qa.ts`，`qa-report/v1`）。顶层 `{ format, subject?, checked[6], failures[], observations[] }`，
   **无 status 字段** —— verdict 是纯函数 `qaVerdict(): "pass"|"fail"|"incomplete"`（`qa.ts:383,400-404`）。
   **QA 硬失败也先落盘再抛**（`create-game.ts:633-635`），但 QA 禁用 / runner 抛 / 更早阶段失败时**不生成**。
2. **状态枚举现状**：`pass/fail/incomplete`（QAVerdict）与 `pending/pass/fail`（HumanVerdict）存在；
   **`BLOCKED` / `NOT_REQUIRED` 不存在**（最近邻：`not-tested` / `not-run` / `unavailable` / `missing` / `unsupported`）。
3. **smoke 结果**：`playable-smoke.mjs` 每场景产 `result.json` `{ ok, stage, reason, expected, ... }` + 截图 + console/exceptions。
   **无步骤数 / 最后成功步骤 / 失败步骤 / 已知限制字段**；「3/4」只存在于 scratch 人类笔记，代码只有 `stage`+`reason`。
4. **版本关联**：run=`<gameId>/run/v<N>` · pack=`<id>/pack/v<N>` · site=`<gameId>/site/v<N>`（`site.json={shell,pack,config}`）·
   config 在 run 目录；`qa-report.json.subject` 已绑 `{packId, packVersion, manifestChecksum}`；checksum=`sha256:` 逐文件。
5. **无跨阶段持久化聚合**：现有最接近的是 qa-report.json（单阶段 QA）、free-acceptance.json（免费验收）、
   mechanic-coverage.json（机制矩阵）、animation-acceptance（冻结占位）、CLI/MCP 内存态 `CommandResult` 摘要（渲染不落盘）。
6. **P0-06 视觉对照 verdict 无存储**：唯一 HumanVerdict 是 `animation-acceptance/v1` 的 `AcceptanceHuman`
   （`pending|pass|fail` + 7 项 + reviewer + reviewedAt + evidence），但**生产端只写冻结占位、无代码填真实 verdict**；
   `reviewPack` 只产「差异观察」不判定不阻断。create→site 链上**无**风格对照 verdict 记录。
7. **最小改动建议**：扩展现有 `qa-report.json`（或升版）加「交付验收」段；装配自然缝 = `assertPublishableQa`
   （`publish-gate.ts:145-198`，CLI 与 MCP 都在 site 装配前调用）；版本绑定复用 `subject` + run/pack/site 版本号；
   新聚合作为**新字段/新 artifact**，不改现有 `CommandResult.data` 键。

---

## D1 现有能力清单

### qa-report.json（生成位置 / schema）
- 生成：`packages/pipeline/src/create-game.ts` `runBuild()`，QA 步；runner = `@game-maker/qa` synthesizer（`assemble.ts` `qaRunner`）。
- 路径：`<runDir>/qa-report.json`（`RUN_ARTIFACT.qaReport`，`artifacts.ts:24`）；写盘 `create-game.ts:633-634`，在 `assertQaPassed`（`:635`）**之前**。
- schema：`contracts/src/qa.ts` `QAReportSchema`（`:282-344`）、`QA_REPORT_FORMAT = "qa-report/v1"`（`:96`）。
- 顶层键（精确类型）：
  - `format: literal("qa-report/v1")`
  - `subject?: { packId: string; packVersion: number; manifestChecksum?: /^sha256:[0-9a-f]{64}$/ }`（`:286-292`，从 manifest 注入 `create-game.ts:617-623`）
  - `checked: QAJudgement[]`（6 条封闭值 `:110-159`）
  - `failures: QAFailure[]`（`{ judgement, target, detail, severity: "error"|"warning" }`，`:191-193,297`）
  - `observations: Observation[]`（判别 `outcome`：`{ source:"inspect"|"review", outcome:"ok", lines[] }` 或 `{ source, outcome:"unavailable", reason }`，`:250-262,299`）
- verdict：纯函数 `qaVerdict(): "pass"|"fail"|"incomplete"`（`:383,400-404`），**不落盘为字段**。

### 状态 / verdict / severity 枚举全表
| 枚举 | 取值 | 出处 |
|---|---|---|
| QAVerdict | `pass` `fail` `incomplete` | `qa.ts:383` |
| QA_SEVERITIES | `error` `warning` | `qa.ts:171` |
| OBSERVATION_SOURCES | `inspect` `review` | `qa.ts:221` |
| OBSERVATION_OUTCOMES | `ok` `unavailable` | `qa.ts:225` |
| AcceptanceSeverity | `error` `warning` `info` | `animation-acceptance.ts:66` |
| AcceptanceVerdict | `green` `yellow` `red` | `animation-acceptance.ts:98` |
| HumanVerdict | `pending` `pass` `fail` | `animation-acceptance.ts:131` |
| RuntimeStatus | `verified` `unverified` `not-run` | `animation-acceptance.ts:170` |
| MECHANIC_COVERAGE_STATUSES | `satisfied` `missing` `unsupported` `not-tested` `failed` | `mechanic-coverage.ts:34` |
| MECHANIC_STATUSES | `experimental` `supported` `deprecated` | `vocabulary.ts:77` |
| CALL_FAILURES | `http` `timeout` `truncated` `invalid-json` `no-tool-use` `empty-input` `schema` | `structured-call.ts:70-78` |
| DESIGN_ATTEMPT_OUTCOMES | `truncated` `no-tool-use` `empty-input` `schema` `rejected` | `design-attempts.ts:45` |
| EXIT | `ok:0` `failure:1` `usage:2` `upstream:3` `invalid:4` | `command.ts:46` |

**关键结论**：`BLOCKED`、`NOT_REQUIRED` **均不存在**；`skip`、`warn`（只有 `warning`）也不存在。

### headless playable smoke（`packages/demo/probe/playable-smoke.mjs`）
- 入口：`pnpm test:playable`（root package.json）。
- 每场景 `<OUT>/<scenario>/result.json`：成功 `{ ok:true, stage:"won"|"reset-floor", reason, durationMs, ..., trace }`；
  失败 `{ ok:false, expected:"pass", stage, reason, durationMs, extra, console, exceptions }`；负向场景 `expected:"fail"`。
- summary：`<OUT>/summary-<mode>.json` `{ startedAt, mode, pack, config, out, chrome, chromeVersion, node, url, scenarios[] }`。
- 截图：`00-start.png` / `won.png` / `fail-<stage>.png` / `pickup-<n>.png` / `reset-<n>.png`；console/exceptions：`console.json`/`exceptions.json`。
- **无** `lastSuccessStep` / `stepCount` / `failureStep` / 已知限制字段；只有 `stage`（`boot/spawn/move/pickup/navigate/win/floor/reset-*`）+ `reason`。
- 「3/4」= move/jump/pickup 过、win 卡巡逻 hazard（`stage:"navigate"`），只记在 scratch 人类笔记（`05-paid-e2e.md:79-88`）。
  现场：`.scratch/fpvs-v1-p0/runs/2026-10-26-e2e-r4/smoke3/playable/result.json` `{ ok:false, stage:"navigate", reason:"超时 … collected=1/4 won=false" }`。

### inspectPack / reviewPack
- `inspectPack`（`assets/src/ops.ts:2102`）：库函数 + CLI `inspect <packDir>`（`cli.ts:647-650`）+ MCP `inspect_asset_pack`（`server.ts:175-181`）。
  输出 `CommandResult`，`data: InspectData { packId, version, provenanceMode, assets[], paletteUsage, layerCoverage[], sourceSizes[] }`（`ops.ts:2013-2021`）。
- `reviewPack`（`assets/src/review.ts:100`）：库函数，**仅 CLI** `review <run dir>`（`cli.ts:666-674` → `pipeline/src/review.ts`），**非 MCP**。
  付费、人主动调用的诊断；「只说差异、不说好坏、不判定、不阻断」。输出 `ReviewResult { ok, observations[], raw, contactSheet, call }`。

### CLI / MCP 面（「不改公开接口」清单）
- CLI `game-maker`：`create / build / plan / pack / compile-runtime / compile-td-game / site / verify / inspect / accept / review`。
- MCP `game-maker-mcp`：`plan_assets / build_asset_pack / verify_asset_pack / accept_asset_pack / create_game / inspect_asset_pack / compile_runtime / assemble_site`。
- 共享返回 `CommandResult = { command, summary[], data, artifacts[] }`；两 shell 断言「`--json` 与 MCP 同一 data」。

## D2 当前报告结构

`qa-report.json` 是**单阶段 QA 聚合**：无 status 字段（verdict 是纯函数 `qaVerdict`），QA 硬失败先落盘再抛；
QA 禁用（`BuildInput.qa=null`）→ 无 `qa`/`qaReport` 键；runner 抛（族读失败 `assemble.ts:56-58`）或更早阶段（pack/verifyPack/config）失败 → 不生成。

## D3 产物版本关联图

```
<outRoot>/<gameId>/run/v<N>/          ← 理解产物 + qa-report.json + ledger.json（RunLedger: {gameId,runVersion,...}）
<outRoot>/<recipe.id>/pack/v<N>/      ← 资源包（manifest.json + delivery/ + authoring/ + ledger.json）
<outRoot>/<gameId>/site/v<N>/         ← 站点（index.html + shell.js + site.json + game-config.json）
  site.json = { shell, pack, config }   ← 站点自述：钉住「消费了哪个 pack 版本」
```
- 版本分配：父级分配、子级不计算；首次 pack N = run N（`create-game.ts:492-494`）。
- 校验和：`sha256:<hex>` 逐文件（`fileChecksum` / `manifestChecksumOf`，`publish-gate.ts:30-37`）；`Checksum` 正则 `/^sha256:[0-9a-f]{64}$/`。
- 站点**不**逐文件校验，只钉「消费了哪个 pack」。

## D4 缺失字段 / 状态语义清单

1. **状态**：`BLOCKED` / `NOT_REQUIRED` 无对家，需新增或映射。
2. **smoke 证据**：无步骤数/最后成功步骤/失败步骤/已知限制字段 —— FR-03「计划步骤数 vs 实际步骤数（如果现有工具提供）」当前**没提供**，要么接受缺位要么补 `playable-smoke.mjs` 输出。
3. **跨阶段聚合**：不存在「资源→配置→QA→站点→smoke→视觉」的单份持久化聚合。
4. **视觉评审 verdict**：P0-06 风格对照无存储；唯一 HumanVerdict（animation-acceptance）是冻结占位、无写真实 verdict 的代码路径。

## D5 最小改动建议

1. **落点**：扩展现有 `qa-report.json`（加「交付验收」段），或升 `qa-report/v2`（升版代价：旧报告解析不过，见 CONTEXT.md「账」教训）。
2. **装配缝**：`assertPublishableQa`（`publish-gate.ts:145-198`）—— CLI 与 MCP 都在 site 装配前调用，且已要求 report 存在 + subject 匹配 + 6 判据跑满 + 无 error。这是「跨阶段聚合」最自然的挂载点。
3. **版本绑定**：复用 `subject`{packId,packVersion,manifestChecksum} + run/pack/site 版本号 + site.json{shell,pack,config}。
4. **不破坏接口**：新聚合作为新字段/新 artifact，不改现有 `CommandResult.data` 键（两 shell 断言 data 一致）。
