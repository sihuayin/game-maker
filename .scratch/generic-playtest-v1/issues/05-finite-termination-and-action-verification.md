# 05 有限终止与动作验证

Type: task
Status: resolved
Blocked by: 03, 08

## Question

按 03 的裁定实现：

- **无进展 / 重复重置的有限终止**：进展度量、阈值、主动停止、终止原因与最后观测/轨迹的落点（按 02 的契约结论，不擅自扩契约）。
- **跳跃状态验证**：用 `onFloor` / `vy` / 位置变化确认跳跃实际发生；单次跳跃尝试上限；连续失败后的动作。
- **等待上限**：独立的最大等待步数/时长与结束条件。
- **`pickupAbove` 可达性**：只在有足够证据时追逐；不可达时跳过非必需目标的边界。

验收：

- 新增确定性测试覆盖：连续无进展触发有限终止、重复重置触发有限终止、跳跃未发生时不无限重复、等待超限、`pickupAbove` 不可达时不盲跳。
- 终止原因、最后状态、动作轨迹可追溯；不把「没通关」判成游戏失败。
- `pnpm test:playtest` 与全仓回归保持绿；不新增依赖；不改站点/配置/Runtime。

## 03 裁定（已锁定，2026-10-28）

| 规则 | 值 |
|---|---|
| 无进展窗口 | 连续 **300** 个观测步（自最后一次进展事件起计） |
| 重置预算 | 累计 **5** 次（不因进展清零） |
| 连续等待上限 | **120** 步 |
| 跳跃成功观测窗口 | 发键后 **3** 步 |
| 连续未观察到跳跃 | **3** 次 → 降级为不跳 |
| 单一动作累计失败 | **5** 次；仅当跳跃是唯一推进手段时才停 |
| 停止原因 | `no-progress` / `reset-exhaustion` / `wait-limit` / `jump-exhaustion` |

- 复合进展指标：`maxX` / `collected` / `chestsOpened` / `gateReached` / `won` 任一**严格增加**即进展；等待期间恢复推进或新进展清零等待计数。
- 停止 = 执行器主动结束，`terminationReached=false`，**不是游戏失败**；记录 `atStep`（累计观测步）、最后观测、动作轨迹。
- 重置判据复用 `observe.mjs` 的 x 回弹；不得另写一套。
- `pickupAbove`：平台几何 + 单跳包络（`maxJumpHeight = v²/2g`，取自被验收游戏的 `player.move`）；不可达的非必需目标跳过但**不得静默**（记录 `pickup-unreachable` 证据）；必需目标不可达时如实归因；所有起跳前都做 `jumpPredictionSafe`。
- **契约边界**：08 批准前不得改 `playtest-report/v1` / `delivery` schema，不得新增 `stop` 字段或扩 `actions[].outcome`；停止事实先落 trace/最后观测，表示方式由 [08](08-contract-extension-approval.md) 裁定。
- 验收测试清单见 [03 的 Answer](03-gap-triage-and-strategy-ruling.md#answer)。

## 08 裁定（已批准，2026-10-28）

- **契约**：`playtest-report/v1` 加性可选 `stop?: { reason: "no-progress" | "reset-exhaustion" | "wait-limit" | "jump-exhaustion"; atStep: int ≥ 0 }`；`PlaytestStopSchema` + 4 原因常量；四条不变量（仅 executed 可有 stop；stop 与 `terminationReached` 不可同时成立；stop 与 `outcome:"SUCCESS"` 不可同时成立；若 `steps` 存在则 `atStep ≤ steps`）。
- **不扩** `actions[].outcome`：被中断动作仍记 `timeout`，由 `stop.reason` 消歧；非执行器结束不进入 stop 枚举。
- **版本**：report 保持 v1；`PLAYTEST_HARNESS_VERSION` → v2；`PLAYTEST_RULES_VERSION` → v2。
- **归因**：执行器 stop + `!terminationReached` ⇒ `AGENT_LIMITATION`，放在环境/游戏失败/SUCCESS 之后、`positiveLimitation` / `structuralUndecidable` / `deadlineHit` 之前。
- **投影**：`PlaytestProjectionSchema` 加 `stopReason: string | null`；`playtestProjectionOf` 投影 `scenario.stop?.reason ?? null`。
- **交付摘要**：不镜像 stop；`delivery.playtest` 与 `mapPlaytest` 不变。
- **实施**：05 负责改 `contracts/playtest.ts`、`contracts/playtest-attribution.ts`、`demo/probe/playtest/{policy,runner}.mjs` 与测试；不改 Runtime/站点/配置；验收清单见 [08 的 Answer](08-contract-extension-approval.md#answer)。

## Answer

## Answer

**2026-10-28 已收口。** 按 03 锁定的判据与 08 批准的契约边界实施「有限终止 + 动作验证」；零付费、不改 Runtime/站点/配置、不扩 `actions[].outcome`、不删测试、不降阈值。

### 一、契约（08 批准范围的实施）

- `packages/contracts/src/playtest.ts`
  - 新增 `PLAYTEST_STOP_REASONS` / `PlaytestStopReason` / `PlaytestStopSchema { reason, atStep }`；
    `PlaytestScenarioReportSchema.stop?`（加性可选）。
  - 四条不变量（`superRefine`）：仅 `execution:"executed"` 可带 stop；stop 与 `terminationReached=true` 互斥；
    stop 与 `outcome:"SUCCESS"` 互斥；`stop.atStep ≤ steps`（若存在）。
  - `PlaytestProjectionSchema.stopReason: string | null`；`playtestProjectionOf` 投影 `stop?.reason ?? null`，
    旧报告 ⇒ `null`，参与确定性比较。
  - `PLAYTEST_REPORT_VERSION` 保持 `playtest-report/v1`（加性）；`PLAYTEST_HARNESS_VERSION` → `playtest-harness/v2`、
    `PLAYTEST_RULES_VERSION` → `playtest-rules/v2`（生产者与归因规则变了；旧报告可读，旧基线会 `not-comparable`）。
  - **未改**：`delivery.playtest` 不镜像 stop；`mapPlaytest` / `playtestSummaryOf` 不变；`actions[].outcome` 闭集不变。
- `packages/contracts/src/playtest-attribution.ts`：执行器 stop 且 `!terminationReached` ⇒ `AGENT_LIMITATION`，
  位置在环境故障 / 正面游戏失败 / `SUCCESS` 之后，`positiveLimitation` / `structuralUndecidable` / `deadlineHit` 之前。
  因动作中断仍记 `timeout`，`deadlineHit` 常为真，该优先级正是 120 步 wait-limit 不再被误判 TIMEOUT 的关键。

### 二、策略与执行器

- `packages/demo/probe/playtest/policy.mjs`
  - 复合进展 `maxX / collected / chestsOpened / gateReached / won` 任一严格增加 ⇒ 进展，清零无进展与等待计数；
    连续 **300** 步无进展 ⇒ `no-progress`。
  - 重置判据**逐字复用** `observe.mjs` 的 x 回弹（`st.x < 上一步 x - 150 && |x - spawn| < 15 && 上一步 x > spawn + 100`），
    独立 `lastX`，不另写一套；重置清空越障状态；累计 **5** 次 ⇒ `reset-exhaustion`（不因进展清零）。
  - 连续 **120** 步 `advance:false` ⇒ `wait-limit`；恢复推进或新进展清零。
  - 跳跃验证：发键后 **3** 个观测步内须观察到 `!onFloor || vy < 0 || bottom 比发键前下降 ≥ 2px`；
    成功一次清零失败计数；连续 **3** 次未观察到 ⇒ 降级为不跳。**降级只放弃可选跳跃**（拾取物/越障窗口），
    「被挡 / 前方无地」这类必需跳跃继续重试，累计 **5** 次且跳跃是唯一推进手段 ⇒ `jump-exhaustion`
    —— 这是 Q6 的「连续 3 次降级」与「累计 5 次停止」两条规则的相容实现。
  - `pickupAbove` 可达性：`maxJumpHeight = v²/2g`（被验收游戏的 `player.move`）；直接从脚下单跳够得到，或存在
    一个顶面在单跳高度内、水平覆盖拾取物 x、且从顶面再跳也够得到的 solid 平台。不可达 ⇒ 不跳，并在
    `strategy.json` 记 `pickup-unreachable`（拾取物下标 + `maxJumpHeight` + 缺失几何），每个下标只记一次。
    所有起跳前都过 `jumpPredictionSafe`（含非危险分支的拾取物起跳）。
  - `stopReasonOf` 一旦锁定即返回同一结果；顺序：`reset-exhaustion` > `no-progress` > `wait-limit` > `jump-exhaustion`。
- `packages/demo/probe/playtest/runner.mjs`
  - 每个观测步（含 `wait_until`）检查停止；命中即结束动作，动作 outcome 仍记 `timeout`，场景报告带
    `stop:{reason,atStep}`。`atStep` = `trace.jsonl` 累计观测步（runner 把 `obs.steps` 传给策略）。
  - harness 条件场景（`hang` / `input-blocked`）不套用主动停止规则（它们有自己的期望结局）。
  - 新增**非契约 sidecar** `strategy.json`：stop / 阈值 / 最后观测 / 进展与重置计数 / 跳跃失败计数 / 策略注解；
    不进 11 类闭事件集、不改报告 schema。最后状态另见 `trace.jsonl` 末行、按键轨迹见 `input.jsonl`。
- `packages/demo/probe/playtest/README.md`：记录有限终止与可达性语义、`strategy.json`。

### 三、验收对照（03 的 05 清单）

| 项 | 证据 |
|---|---|
| 300 步无进展 ⇒ `no-progress`；任一进展清零；atStep 可追溯 | `tests/termination.test.mjs`（3 条） |
| 累计 5 次重置 ⇒ `reset-exhaustion`；判据与 observe 一致 | 同上（2 条） |
| 连续 120 步 `advance:false` ⇒ `wait-limit`；恢复/进展清零 | 同上（2 条） |
| 3 步窗口验证；连续 3 次降级；累计 5 次且无替代 ⇒ `jump-exhaustion` | 同上（5 条） |
| `pickupAbove` 可达 ⇒ 追；无平台 ⇒ 不跳且记证据；必需不可达不判游戏失败 | 同上（4 条）+ 归因测试 |
| 非危险分支起跳也做 `jumpPredictionSafe` | 同上（1 条） |
| stop 契约 / 归因 / 投影 / 摘要 | `packages/contracts/tests/playtest.test.ts`（7 条）、`playtest-attribution.test.ts`（5 条） |
| 回归绿 | `pnpm test` **146 files / 2189 tests passed，exit 0**；`pnpm typecheck` **exit 0**；`pnpm test:playtest` **exit 0**（self-test 4/4：gate / pickup / input / hazard-legacy + 9 files / 125 tests） |

**证据路径**：`.scratch/generic-playtest-v1/evidence/05-regression.json`、
`.scratch/generic-playtest-v1/evidence/self-test-run/`（含 `strategy.json`；运行后已 `git restore` tracked 自测产物，哈希与运行前一致）。

### 四、给 06 的事实

- 冻结 wasteland 的 `scrap-2`（466,150）/ `scrap-4`（1052,150）在平台（y=190）上方：爬升 50px + 二次 40px，
  均在 `maxJumpHeight ≈ 60.5px` 内 ⇒ 新可达性判据会继续追（E1 源码：`site/v1/game-config.json`）。
- 本次报告身份是 `playtest-harness/v2` + `playtest-rules/v2`：与 FA-06 的 v1 基线**不可比**，06 的继承比对必须按版本差异披露。
- 真实浏览器只验证了「harness 条件场景不触发停止」；**主动停止路径本身只有确定性单测覆盖**，真实运行是否触发停止由 06 记录。
- 停止后的可读面：`result.json` 场景 `stop`、`trace.jsonl` 末行、`strategy.json`（notes/lastObservation）、动作 `outcome:"timeout"`。
