# 08. 五态归因器（阶段化决策 + 证据最小集）

Type: task
Status: open
Map: ../map.md
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
6. **smoke 退役**（本 effort 末尾）：删除 `packages/demo/probe/playable-smoke.mjs`、`packages/contracts/src/playable-smoke.ts`、对应测试与 `PLAYABLE_SMOKE_*`；移除 `test:playable`，新增 `test:playtest`；保留 `probe-harness.mjs` 并复用 CDP/Chrome，不复制第三套浏览器基础设施。
7. **CONTEXT.md 词条 + CLI 摘要**：落地本图捡回/重定义的词汇；CLI 摘要渲染五态、`not-executed`、旧 smoke 结果标注；不把旧结果升级为新证据。
8. **历史报告兼容**：旧 `qa-report/v1` 的 `playable-smoke` 数据继续可读；删除旧 TypeScript 类型/文件不得导致历史报告拒绝解析；新写回永远同时写摘要与检查项。

验收补充：离线测试覆盖五态 + `not-executed` + 写回失败/身份不匹配/幂等；`pnpm test:playtest` 的 harness 自测（含 `hazard-legacy` + `gate`/`pickup`/`input` 负例）不混入交付场景集。
