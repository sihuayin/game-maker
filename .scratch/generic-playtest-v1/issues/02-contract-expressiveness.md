# 02 契约表达审计：主动停止 / 无进展 / 重复重置

Type: research
Status: resolved

## Question

现有 `playtest-report/v1` + `delivery` 契约能否**无歧义**表达「执行器主动停止」「连续无进展」「重复重置达到上限」以及最终归因？逐字段审计并给出结论。

必须覆盖：

- `packages/contracts/src/playtest.ts`：action `outcome` 闭集（`completed/timeout/failed/skipped`）、场景 `execution`（`executed/not-executed`）、`termination`（`won/collected/never`）、`outcome` 五态 + `UNKNOWN`、`insufficientEvidence`、`assertions`、`actions`、`evidence`。
- `packages/contracts/src/playtest-attribution.ts`：`attribute()` 的阶段化决策、`TIMEOUT` / `AGENT_LIMITATION` / `UNKNOWN` 的成立条件。
- `packages/pipeline/src/playtest.ts` 与 `packages/cli/src/playtest.ts`：写回、退出码、聚合、事后 `stuck` 统计（`steps>=200 && progressPx<=10`、`reset>=3`）。
- `packages/contracts/src/delivery.ts`：`playable-smoke` / `delivery.playtest` 摘要能承载什么。

输出二选一：

1. **可表达**：给出最小映射 —— 主动停止的事实应写入哪些现有字段（`actions` outcome、`execution.reason`、trace、`InsufficientEvidence`、归因），以及是否会造成语义失真。
2. **不可表达**：指出缺口字段与最小契约变更提案（字段、取值、兼容性、对 `playable-smoke` 消费者的影响），但**不实施**；明确指出需要单开审批票。

约束：只读；不修改契约；不把「为了表达方便」当成扩契约的理由（用户边界 ③）。

## Answer

**NOT EXPRESSIBLE.** 现有 `playtest-report/v1` + `delivery` 能表达重置计数（`eventCounts.reset`）、首末位置/净位移、总步数与五态原因类别，但无法无歧义表达「执行器主动停止」及其原因。完整审计（逐字段 + 10 种映射尝试 + file:line）见 [`../research/contract-expressiveness.md`](../research/contract-expressiveness.md)。

- **(a) 主动停止**：没有终止发起者字段。`terminationReached` 只说目标是否达成（`playtest.ts:200`）；`actions[].outcome` 闭集无 `stopped`（`playtest.ts:216`）——用 `timeout` 会与场景截止（`runner.mjs:175`）及 `wait_until` 预算（`runner.mjs:181-193`）不可区分，用 `failed` 会破坏 `explorationExhausted`（`cli/src/playtest.ts:249`），并可能把 `AGENT_LIMITATION` 翻成 `UNKNOWN`。
- **(b) 连续无进展**：只有 `steps` / `endState` / `trace` 等原始观察；无窗口、阈值或停止决定字段。`stuck` 是 CLI 事后归因输入（`cli/src/playtest.ts:251`），不落盘、不终止运行；`actions[].steps` 是累计值而非增量（`runner.mjs:264`）。
- **(c) 重复重置**：计数可读（`eventCounts.reset`，`playtest.ts:225`；`observe.mjs:114-115`），但「达到上限并停止」不可读；`reset>=3` 只是事后 `stuck` 统计。
- **(d) 最终归因**：五态 + `UNKNOWN` 可表达原因类别，但 `attribute()` 没有停止输入；`deadlineHit + stuck` 也判 `AGENT_LIMITATION`（`playtest-attribution.ts:159-172`；测试 `playtest-attribution.test.ts:60-68`），主动停止与场景超时同值。交付层三者都映射为 `incomplete`（`playtest.ts:497-504`）。
- **最小增量提案（不实施）**：`PlaytestScenarioReportSchema.stop?` 可选严格对象 `{ reason: "no-progress" | "reset-exhaustion" | "wait-limit" | "jump-exhaustion" | "scenario-timeout" | "action-timeout" | "actions-exhausted"; atStep: int }`；由 runner 在决定处写入；交付摘要可选同构投影。`mapPlaytest` 不读 `stop`，`playable-smoke` 状态/verdict 不变；旧报告可读，旧 strict 读取器需随版本升级（或升 `PLAYTEST_REPORT_VERSION` v2）。若要让归因真正利用该字段，还需改 `PlaytestAttributionEvidence` 与阶段化决策表。
- **结论**：契约变更是**事实缺口**，不是表达便利；须单开审批票后再实施。本票只读，未改 contracts/code/tests。
