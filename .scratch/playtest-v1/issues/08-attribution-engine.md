# 08. 五态归因器（阶段化决策 + 证据最小集）

Type: task
Status: resolved
Map: ../map.md
Owner: main session · 2026-10-27
Blocked by: 04, 06, 07

## Question

把票 04 的裁定落成纯函数 `attribute(runEvidence) → PlaytestOutcome` 与证据校验：阶段化决策表、
五态 + `UNKNOWN` + `not-executed`、环境健康前置门、代理限制实锤、`SUCCESS` 门槛、结构化 `InsufficientEvidence`、
每态最小证据集。**只吃运行证据**，不吃 `expectedOutcome`、不吃场景名。

## 范围

1. **阶段化决策**：`prepare`（`not-executed` / 证据充分的环境故障）→ `boot`（环境故障 / `UNKNOWN`）→
   `execute`（游戏失败 / 代理限制 / 超时 / `UNKNOWN`）→ `evaluate`（游戏失败 / `UNKNOWN`）；
   `TIMEOUT` 只在 `execute`；超时与结构性不可判主因不可分时 `UNKNOWN` 优先。
2. **实锤门槛**：游戏失败三类证据统一加环境健康前置门；`runtime-error` 判来源与严重性；
   代理限制三类正面证据（轨迹 / 能力几何矛盾 / 探索耗尽），永不映射 fail/pass。
3. **`SUCCESS`**：执行到底 + ≥1 实质断言求值 `pass` + 终止条件达成 + 零 `UNKNOWN` 断言 + 无未归因运行时错误。
4. **证据校验**：每态最小证据集（票 04 Q8）；`UNKNOWN` 必填结构化 `InsufficientEvidence`（`ruleId` +
   `missingObservation` + `affectedAssertionIds` + `explanation`），缺失即拒。
5. **多场景聚合**：执行结果按总序 `GAMEPLAY_FAILURE > ENVIRONMENT_FAILURE > TIMEOUT > AGENT_LIMITATION > UNKNOWN > SUCCESS`；
   `not-executed` 单独参与执行资格判断；harness 条件场景不进交付聚合。

## 验收（完成条件）

- 离线测试覆盖成功 / 游戏失败 / 环境故障 / 代理限制 / 超时 + `UNKNOWN` + `not-executed`，每态至少一个正例及其证据；
- 断言 `fail` 不自动升级游戏失败；环境故障不得判游戏失败；代理限制不得升 pass；
- 归因纯函数单测 + 真实产物端到端各一；全仓测试绿 + typecheck 绿。

## 追加范围（票 06 收口 · 2026-10-27）

在五态归因器之外，本票落交付接入的执行层（用户 2026-10-27 分层）：

1. **CLI `game-maker playtest <run 目录>`**（仅 CLI，不加 MCP）：只吃 run 目录；按票 06 Q4 的六项准备校验解析 pack/config/site；不提供 `--pack` / `--site` / `--config` / `--scenario` / `--negative` / 超时覆盖。
2. **attempt 目录**：`run/v<N>/playtest/v<K>/`，K 单调递增、绝不覆盖；先写临时目录，成功后再原子提交为正式 `v<K>`；失败留独立失败记录，不占用正式 attempt。
3. **纯函数映射**：`playtestSummaryOf(report)`、`applyPlaytest(delivery, report, evidence)`；身份校验用完整、已验证的报告对象，不塞进窄 `PlaytestReportView`；只动 `playable-smoke` 检查项、`delivery.playtest`、`verdict`；证据替换 `playtest-*` refs，不删非 playtest 证据；不碰 QA 层、`visualReview`、`knownLimitations`。
4. **原子写回**：`writePlaytestToReport` 重新读取/校验当前 `qa-report.json` 与 attempt 身份；同一文件系统 `.tmp` + `rename`；rename 前完成 schema 校验与 verdict 重算；失败保留 `result.json`、原子写 `writeback-error.json`；幂等；身份不匹配绝不污染当前 delivery。
5. **退出码与失败记录**：`0` 须试玩 `SUCCESS` 且写回成功；`1` 非 `SUCCESS` 或写回失败；`4` 准备拒绝/输入或报告不合法；`2` 用法错。四类 `not-executed` 情形按票 06 Q8 区分（输入无效 / 身份不匹配 / site 未装配 / 执行中环境故障）。
6. **CLI 摘要**：渲染五态、`not-executed`、旧 smoke 结果标注；不把旧结果升级为新证据。
7. **历史报告兼容**：旧 `qa-report/v1` 的 `playable-smoke` 数据继续可读；删除旧 TypeScript 类型/文件不得导致历史报告拒绝解析；新写回永远同时写摘要与检查项。

> **退役拆分（2026-10-27）**：smoke 删除 / `test:playable` 迁移 / `hazard-legacy`·`gate`·`pickup`·`input` 自测 / `CONTEXT.md` 词条已拆到 [10. smoke 退役与自测迁移](10-smoke-retirement.md)，在票 09 验收之后执行（票 06 Q3 的硬切顺序）。本票只保留 CLI 摘要与历史报告兼容。

验收补充：离线测试覆盖五态 + `not-executed` + 写回失败/身份不匹配/幂等。

## Answer（施工 · 2026-10-27）

五态归因器 + 交付接入执行层落地。**真实产物 E2E 的真实结果是 `AGENT_LIMITATION → incomplete`，不是通过、也不是游戏失败**；本票没有把「没通关」写成 `GAMEPLAY_FAILURE`。

### 1. 归因器（`packages/contracts/src/playtest-attribution.ts`）

- **纯函数** `attribute(runEvidence) → AttributionResult`：只吃运行证据，不吃 `expectedOutcome`、不吃场景名。
- **阶段化决策**：`prepare`（not-executed / 有证据的环境故障）→ `boot`（环境故障 / UNKNOWN）→ `execute`（游戏失败 / 代理限制 / 超时 / UNKNOWN）→ `evaluate`（游戏失败 / UNKNOWN）。`TIMEOUT` 只在 execute；超时与结构性不可判同时存在 ⇒ UNKNOWN 优先。
- **环境健康前置门**：环境故障（Chrome/站点/资源加载/runtime-error origin=environment）优先于任何游戏失败证据；环境未证明健康且无具体故障 ⇒ UNKNOWN，不猜游戏失败。
- **游戏失败三类实锤**：初始态矛盾（`initialActivePickups` 断言 fail）· 与代理动作无关的 invariant fail · 终止达成但契约断言 fail / 到 gate 仍 won=false；`runtime-error` 必须来源为 game（来源未定 ⇒ UNKNOWN）。
- **SUCCESS 门槛**：终止达成 + 至少一条实质断言 pass + 全部断言 pass + 零 unknown + 无 runtime-error + 环境健康。
- **AGENT_LIMITATION**：环境健康、无游戏失败证据、未终止，且**正面**证据（探索耗尽 + stuck / 能力几何矛盾 / 反复尝试无进展）；永不映射 pass/fail。
- **UNKNOWN**：必填结构化 `InsufficientEvidence`（ruleId / missingObservation / affectedAssertionIds / explanation）；`not-executed` 独立返回，不进 outcome 排序。
- **多场景聚合**：`GAMEPLAY_FAILURE > ENVIRONMENT_FAILURE > TIMEOUT > AGENT_LIMITATION > UNKNOWN > SUCCESS`；`not-executed` 不参与排序；harness 条件场景由调用方排除。

### 2. 交付接入（CLI + 写回）

- **`game-maker playtest <run 目录>`**（仅 CLI、不加 MCP）：只吃 run 目录；六项准备校验（qa-report schema / subject pack / delivery.site / run config / QA·site 前置 / 场景契约与版本）；不接受 `--pack/--site/--config/--scenario`。准备拒绝写 `playtest/rejections/`，不伪造 attempt。
- **attempt**：`run/v<N>/playtest/v<K>/`，K 单调递增、绝不覆盖；沙箱 E2E 连续跑出 v1/v2/v3，delivery 只指向最新 v3，旧 attempt 保留。
- **CLI 只跑交付必需场景**：`success-basic`（`required:true`）；`failure-missing-pickup` / `limitation-wide-patrol` 是覆盖/诊断场景（`required:false`），`env-no-chrome` / `timeout-hang` 是 harness 条件场景；它们都不进交付必需集。
- **写回**：`applyPlaytest`（纯函数）+ `writePlaytestToReport`（I/O）；只动 `playable-smoke` 检查项、`delivery.playtest`、`verdict`；证据替换 `playtest-*` refs、保留非 playtest 证据；身份不匹配（pack/site/shell/config checksum）拒写且不污染 delivery；`.tmp`+`rename` 原子提交；失败留 `writeback-error.json` 且不改 `result.json`；幂等。
- **退出码**：`0` = SUCCESS + 写回成功；`1` = 非 SUCCESS 或写回失败；`4` = 准备拒绝/输入或报告不合法；`2` = 用法错。E2E 实测：usage 2、缺 QA 报告 4、真实非 SUCCESS 1。
- **历史兼容**：`delivery.playtest` 可选；旧 `qa-report/v1` 的 `playable-smoke` 数据仍可解析；`applyVisualReview` 重算时保留 `playtest`；旧 smoke 结果不升级。
- `DELIVERY_CHECK_LABELS["playable-smoke"]` 改为「试玩」（键名保留）。

### 3. 测试与真实产物

- `pnpm test`：**142 files / 2123 tests** 全绿；`pnpm typecheck` 全绿。
- 归因单测 13 条：SUCCESS / GAMEPLAY_FAILURE / ENVIRONMENT_FAILURE / AGENT_LIMITATION / TIMEOUT / UNKNOWN / not-executed 全覆盖；另验证「assertion fail 不自动升级」「环境故障不判游戏失败」「代理限制不升 pass」。
- 写回单测 6 条：成功写回、幂等/证据不重复、身份不匹配拒写、config checksum 不匹配、无 delivery 不伪造、写回失败留独立诊断记录。
- 真实产物 E2E（零付费；历史 site/pack 用相对 symlink，只读）：命令与退出码见 [run-evidence.json](../runs/2026-10-27-ticket-08/run-evidence.json)。结果是 `execution=executed`、`aggregate=AGENT_LIMITATION`，`playable-smoke=incomplete`、`delivery.verdict=incomplete`，CI exit 1；站点字节未改、QA 层字段原样保留。
- 归因证据：环境健康（scene-ready、无 poll gap、无 runtime-error）· 动作超时 + stuck/探索耗尽 + 无进展；所以是代理限制而不是游戏失败或通过。

### 4. 边界 / 移交

- **09**：基线比较、真实产物验收报告、旧报告兼容报告。
- **10**：smoke 删除、`test:playable` → `test:playtest`、`hazard-legacy`/`gate`/`pickup`/`input` 自测迁移、CONTEXT.md 词条。按票 06 Q3 的硬切顺序，票 10 在票 09 验收之后执行；本票不删除旧 smoke。
- 已知表示法：boot 失败时 raw 报告是 `not-executed`；归因把它判成环境故障/UNKNOWN 时，CLI 记「已尝试执行」以承载 outcome（否则 schema 无法表达环境故障 outcome）。这是显式记录，不伪装成游戏执行到底。
- 真实站点上自动玩家仍无法通关（历史 smoke 同样停在 navigate）；本票只把证据如实归为 AGENT_LIMITATION，不扩大游戏质量门禁。
