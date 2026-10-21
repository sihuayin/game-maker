# 07. G · 报告、错误与实验追溯

Type: research
Status: resolved
Owner: research 子代理 · 2026-10-21
Blocked by: —
Map: ../map.md

## Question

检查现有错误对象、CLI / MCP 的错误传播方式、资源生成产物清单、任务运行记录、构建日志、失败记录、
资源版本管理、已有 JSON / Markdown 报告。

回答任务书 §4.7 的 8 个问题：

1. 当前是否有统一的错误模型？
2. 错误是否能够携带文件、资源和阶段信息？
3. 失败任务是否保存已有产物与执行记录？
4. 是否能关联一次生成运行与具体资源？
5. 是否有稳定的资源版本标识？
6. 是否已经存在可复用的 JSON 报告格式？
7. 如果新增验收报告，应该扩展现有结构还是建立独立结构？
8. 是否会造成新的重复账本或重复报告？

必读：`packages/contracts/src/{command,audit,ledger,run-ledger,qa}.ts`、
`packages/pipeline/src/artifacts.ts`、`packages/cli/src/cli.ts` 的 `--json` 与退出码、
`packages/mcp/src/server.ts`、`qa-report/v1`、v7 的 `manifest.json` / `ledger.json` / `coverage.json`、
`runs/2026-10-21*/result.json` / `budget-report.md`。

## 验收

- 错误模型：类型 / 字段 / 退出码 / 传播路径；能否定位文件、资源、阶段、帧。
- 追溯链：run / pack / site 版本、checksum、`ledger.json`、`coverage.json`、`qa-report.json` 的关联方式；
  哪些环节断链。
- 可复用报告格式清单：路径、schema、生产者、消费者、是否含证据字段。
- 推荐的最小数据关联方案：哪些现有字段直接复用，哪些必须新增；如何避免重复账本 / 报告。
- 在 HEAD 复验 W1 / W4 的入口差异与错误传播结论。

## 边界

- 只读；不改错误模型 / 报告格式 / 账本 / CLI / MCP。
- 允许定向测试与只读检查；禁止 `pnpm check` / `pnpm build` / 写 `out/`；零付费。
- 不写 `map.md`；只写本票与 `research/g-report-traceability.md`；不提交。

## 产出

`research/g-report-traceability.md`：错误模型 + 追溯链 + 报告格式清单 + 最小关联方案。
完成后在本票追加 `## Answer`（10–20 行摘要），`Status: resolved`。

## Answer

- **错误模型 `partial`**：壳层统一信封是 `CommandError(kind/message/ledger?/failureDir?)` + `EXIT 0–4` + `Carried`（`packages/contracts/src/command.ts:46,67-151`）；但 core 有裸 `Error`，且没有 `stage/file/resource/frame` 结构化字段。文件/资源/阶段/帧只能靠文案，QA `target` 与 ledger `step/target` 是仅有的机器可读定位。
- **CLI / MCP 传播不一致**：CLI 用 `asCommandError` 把理解层错误翻成 3/4（`cli.ts:207-218`），MCP 直接 `exitCodeOfError`（`server.ts:338-360`）⇒ 设计/vision 的 `extends Error` 会落 `_exitCode:1`，而工具说明写 3/4（静态 E1，无测试）。CLI 翻译还只转交 `ledger`，**丢掉理解层挂在原异常上的 `failureDir`**（`create-game.ts:394-396` vs `cli.ts:207-218`）。
- **失败保存 `partial`**：理解层改名 `failed-<ts>/`、pack 改名 `failed-<ts>/` 保留原图/prompt/drawlist/ledger（`run.ts:108-117`、`pack.ts:288-318`，E3 17c 现场 33 文件）；但 config staging 被删、QA/site 无 `failureDir`，**QA 硬失败时 run ledger 不更新**（抛出早于并集写回，`create-game.ts:544` vs `:549-551`）。
- **追溯链最大缺口 `missing`**：`run-ledger/v1` 无 `packVersion/siteVersion`，`qa-report/v1` 无任何身份/checksum/time，`manifest` 无 run 外键；18a 现场 run v1 + pack v1/v2 + site→pack v2，但没有任何文件说 run v1 产了 pack v2。`qa-report` 固定写 `run/vN/qa-report.json`，第二次 attempt（pack v2）会覆盖旧 findings。
- **包身份 `implemented`**：`(manifest.id, manifest.version)` + `files[].checksum` + `atlases[].checksum`，版本目录不覆盖（`assetpack.ts:265-299`）；但 manifest 自身不在 `files[]`，`verify` 也不在创建链上自动跑。
- **可复用格式 `implemented`**：`qa-report/v1`、`assetpack/v4`、包/run ledger、`coverage`、`master-ratios`、`asset-plan`、`CommandResult`（CLI `--json` / MCP `structuredContent`）；实验 `result.json` / `budget-report.md` 无 schema、无 pack/commit 外键（`partial`）。
- **最小方案**：不建第三本账、不复制 findings；新增 `run/vN/builds/v<M>.json`（`run-build-record/v1`）索引 `runVersion→packVersion→siteVersion→qaReport`，复用现有包/账字段，只新增 manifest、qa-report、输入文件的 checksum，以及 `stages[]`（复用 `CreateStep`）与失败时的 `error{kind,stage,file?,resource?,frame?}`。
- **避免重复**：run 账=总花费、pack 账=包收据、`qa-report`=唯一裁决；build record 只存路径+checksum+派生计数。若需保留多次 QA findings，必须另裁「QA 报告按 attempt 版本化」（会改 `RUN_ARTIFACT.qaReport` 落点）。
- **W1/W4 复验**：入口差异、MCP 无翻译、版本父分配、`checked` 恒 5/6 / `incomplete`、site 绕过 QA 均成立；W4 引用的 18a `qa-report` 产在 inspect 接线前，不能当 HEAD 证据。
- **验证**：定向 11 个测试文件 / **209 tests passed**（contracts carried-error+qa、cli+cli-create、pipeline run+create-game+review、mcp server、demo site、assets ledger、qa assemble）；未跑 `pnpm check`/`build`，未写 `out/`，零付费。
- **未验证**：MCP 设计错误的动态 `_exitCode`；QA 失败时的 run ledger 缺口无 E3 归档；HEAD 真实端到端未跑。
- 详细证据：`.scratch/animation-acceptance-v1/research/g-report-traceability.md`。
