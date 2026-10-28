# 08 契约扩展审批：主动停止的表示

Type: grilling
Status: resolved
Blocked by: 03

## Question

02 已证明现有 `playtest-report/v1` + `delivery` **不能无歧义表达**「执行器主动停止」及其原因。是否批准最小增量扩展？请逐项裁定：

1. **是否扩展**：批准 `PlaytestScenarioReportSchema.stop?` 可选严格对象
   `{ reason: "no-progress" | "reset-exhaustion" | "wait-limit" | "jump-exhaustion" | "scenario-timeout" | "action-timeout" | "actions-exhausted"; atStep: int }`？
   还是拒绝扩展、改为降级表达？
2. **版本策略**：保持 `playtest-report/v1` 加性可选字段（旧报告可读、旧 strict 读取器会拒绝新字段），
   还是升 `PLAYTEST_REPORT_VERSION` v2？
3. **归因是否消费 `stop`**：只记录不使用（`mapPlaytest` 忽略，`playable-smoke`/verdict 不变），
   还是让 `attribute()` 也读取它（行为变更，需单独测试）？
4. **交付摘要**：`delivery.playtest` 是否镜像 `stop`？必须保证 `playable-smoke` 消费方不破坏。
5. **若拒绝**：主动停止如何降级表达（`timeout` + 事后观测），最终报告如何写限制，确保不被误读为真实场景截止。

输出：批准 / 拒绝 + 精确字段与兼容性约束 + 实施边界。批准后 05 才开工；本票不实施。

## 03 裁定（已锁定，待本票裁定表示方式）

- 停止触发条件与语义已锁定：`no-progress`（连续 300 步）/ `reset-exhaustion`（累计 5 次）/ `wait-limit`（连续 120 步）/ `jump-exhaustion`（3 次未观察到跳跃则降级、累计 5 次且无替代推进手段）；记录 `atStep`、最后观测、动作轨迹。
- 停止 = 执行器主动结束，`terminationReached=false`，**不是游戏失败**。
- 本票只裁定**表示方式**（是否加 `stop?`、版本策略、归因是否消费、交付摘要是否镜像、拒绝时的降级措辞）；05 在本票批准前不得动 schema。

## Answer

**2026-10-28 用户逐项裁定：Q1(A)、Q2(A)、Q3(B)、Q4(A)、Q5(B)、Q6(A，仅备用)、Q7(全部锁定)。本票只裁定，不改代码；05 按此实施。**

### 裁定表

| # | 问题 | 裁定 | 核心决定 |
|---|---|---|---|
| Q1 | 主动停止契约 | **A** | 新增可选 `stop?: { reason, atStep }`，原因限定为 4 个执行器原因 |
| Q2 | 版本策略 | **A** | `playtest-report/v1` 加性扩展；`PLAYTEST_HARNESS_VERSION` 升 v2；消费 stop 的 `PLAYTEST_RULES_VERSION` 也升 v2 |
| Q3 | 归因器 | **B** | 执行器主动停止且未达成终态 ⇒ `AGENT_LIMITATION`，优先于推导出的 `deadlineHit` |
| Q4 | 交付摘要 | **A** | 不镜像 stop；从 `delivery.playtest.report` 指向的 `result.json` 读取 |
| Q5 | 确定性投影 | **B** | 加入 `stopReason: string \| null`，参与 canonical projection 与重复运行比较 |
| Q6 | Q1 被拒绝时的降级 | **A** | 仅备用；本轮批准 Q1 后不实施 |
| Q7 | 实施边界与测试 | **锁定** | 08 只裁定；05 实施；不改 Runtime、站点或配置 |

### 一、契约形状（精确）

```ts
export const PLAYTEST_STOP_REASONS = [
  "no-progress", "reset-exhaustion", "wait-limit", "jump-exhaustion",
] as const;
export const PlaytestStopReason = z.enum(PLAYTEST_STOP_REASONS);
export const PlaytestStopSchema = z.strictObject({
  reason: PlaytestStopReason,
  atStep: z.number().int().nonnegative(),
});
// PlaytestScenarioReportSchema 增加：
//   stop: PlaytestStopSchema.optional(),
```

- `stop` **只表示执行器主动决定结束执行**，不取代 `terminationReached` / `outcome` / `actions`。
- `atStep` = `trace.jsonl` 的**累计观测步**，不是墙钟、不是动作序号。停止阈值、最后观测、`maxX`/reset 计数继续由 `trace.jsonl` + `endState` + `eventCounts` 承载，不在 `stop` 里重复。
- 被中断动作仍用既有 `timeout` outcome；`stop.reason` 用于消歧，**不扩 `actions[].outcome` 闭集**。
- 非执行器结束（`scenario-timeout` / `action-timeout` / `actions-exhausted`）**不进入** stop 枚举；它们仍由 `actions[].outcome` + `terminationReached` 表达。
- schema 不变量（`superRefine`）：
  1. 只有 `execution === "executed"` 时才能有 `stop`；
  2. `stop` 与 `terminationReached === true` 不能同时成立；
  3. `stop` 与 `outcome === "SUCCESS"` 不能同时成立；
  4. 若 `steps` 存在，则 `atStep <= steps`。

### 二、版本与兼容

- `PLAYTEST_REPORT_VERSION` 保持 `playtest-report/v1`（加性可选字段）。
- `PLAYTEST_HARNESS_VERSION` → `playtest-harness/v2`（生产者行为变化）。
- `PLAYTEST_RULES_VERSION` → `playtest-rules/v2`（归因消费 stop）。
- 旧报告无 `stop`：schema 可读；归因按旧行为；投影 `stopReason: null`。
- `delivery.playtest` 保持最小摘要，不新增 `stop` 镜像；`mapPlaytest` 不变（`AGENT_LIMITATION` → `incomplete`）。
- 基线身份会比对 harness/rules 版本，旧基线会 `not-comparable`；**当前仓库没有基线文件**，未来建立/晋升基线仍须显式操作。

### 三、归因优先级（锁定）

在现有阶段化决策中，**执行器 stop 判定放在正面游戏失败、环境故障与 `SUCCESS` 之后，放在 `positiveLimitation`、`structuralUndecidable`、`deadlineHit` 之前**：

1. prepare / boot / not-executed；
2. 环境故障 ⇒ `ENVIRONMENT_FAILURE`；
3. runtime 游戏错误 / 初始态矛盾 / invariant fail / termination+assert fail / won 断言 fail ⇒ `GAMEPLAY_FAILURE`；
4. 终止达成 + 全断言 pass + 无报错 ⇒ `SUCCESS`；
5. **执行器 stop + `!terminationReached` ⇒ `AGENT_LIMITATION`**；
6. `positiveLimitation` ⇒ `AGENT_LIMITATION`；
7. `structuralUndecidable` ⇒ `UNKNOWN`；
8. `deadlineHit` ⇒ `TIMEOUT`；
9. 其余 ⇒ `UNKNOWN`。

- 已证实的游戏失败仍是游戏失败；已证实的环境故障仍是环境故障；已证实完成目标仍是 `SUCCESS`。
- 无 `stop` 的普通场景超时仍按旧规则归因 `TIMEOUT`。
- 直接修复两个误判：120 步 `wait-limit` 不再仅因 deadline 被判 `TIMEOUT`；300 步 `no-progress`、净推进 12px 不再失去停止原因。

### 四、确定性投影

- `PlaytestProjectionSchema` 增加 `stopReason: z.string().nullable()`。
- `playtestProjectionOf` 投影 `scenario.stop?.reason ?? null`；`canonicalProjection` 自动包含。
- 重复运行比较包含 stopReason；将来基线晋升必须显式记录它。
- 旧报告无 stop ⇒ `null`，避免字段缺失造成格式差异。

### 五、Q6 备用方案（本轮不实施）

若将来拒绝 Q1：执行器仍提前停止，动作 outcome 保持 `timeout`，stop 事实写入 `trace.jsonl` 的策略注解（不加入 11 类事件闭集），最终报告披露「`TIMEOUT` 包含执行器主动停止」并引用 trace。**不得**把 stop 塞进 `insufficientEvidence` 或 `evidence` 字符串。

### 六、实施边界（05）

**文件**
- `packages/contracts/src/playtest.ts`：`PlaytestStopSchema` / 4 原因常量 / 场景级可选 `stop` / 四条不变量 / 投影 `stopReason` / 版本号。
- `packages/contracts/src/playtest-attribution.ts`：归因优先级规则。
- `packages/demo/probe/playtest/policy.mjs`：返回明确停止原因。
- `packages/demo/probe/playtest/runner.mjs`：在决定处写 `{reason, atStep}`；每个观测步检查（含 `wait_until`）。
- 对应测试（contracts + demo probe + baseline/pipeline 受影响处）。

**不改**
- `delivery.ts` / `playtestSummaryOf` / `applyPlaytest`（Q4 A）。
- Runtime / 站点字节 / `GameConfig` / `SHELL_VERSION`。
- `actions[].outcome` 闭集；`PLAYTEST_REPORT_VERSION`。

**验收测试**
- schema：旧 v1 报告可读；4 个 reason 合法；非法 reason / 负 `atStep` / not-executed + stop / stop + terminationReached / stop + SUCCESS / `atStep > steps` 被拒。
- 归因：4 个 reason 均 → `AGENT_LIMITATION`；环境/游戏失败/`SUCCESS` 仍优先；无 stop 的 deadline 仍 `TIMEOUT`；stop + 轮询断档仍 `AGENT_LIMITATION`（Q3 B）。
- 投影：有 stop / 无 stop / 原因漂移；旧报告 `stopReason: null`。
- 摘要：`delivery.playtest` 不出现 stop 字段；`mapPlaytest` 不变。
- 回归：`pnpm test`、`pnpm test:playtest`、`pnpm typecheck` 全绿。

### 七、明确不做

- 不把 `stop` 扩成完整结束原因枚举（`scenario-timeout` / `action-timeout` / `actions-exhausted`）。
- 不在 `delivery.playtest` 镜像 stop。
- 不扩 `actions[].outcome`（不加 `stopped`）。
- 不改 Runtime / 站点 / 配置 / `SHELL_VERSION`。
- 不在 08 中改代码；05 实施。
- 不自动晋升基线；不手工改中间 JSON。
