# 08. 五态归因器（阶段化决策 + 证据最小集）

Type: task
Status: open
Map: ../map.md
Blocked by: 04, 07

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
