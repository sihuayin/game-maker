# 02 契约表达审计：主动停止 / 无进展 / 重复重置

**结论：NOT EXPRESSIBLE（现有契约不能无歧义表达「执行器主动停止」）。**
现有 `playtest-report/v1` 能表达「重置发生了多少次」「最后状态」「总步数」和五态归因的**原因类别**，
但没有任何字段表达「这次运行是执行器主动结束的，而不是场景截止期、动作预算或外部终止」，也没有
字段表达停止规则（无进展窗口 / 重置上限 / 等待上限）。`actions[].outcome` 的闭集与
`terminationReached` 只描述结果，不描述终止发起者；事后 `stuck` 统计是归因输入，不落盘、不终止运行。
要把 (a) 执行器主动停止、(b) 连续无进展、(c) 重复重置达到上限作为**可被契约消费者读取的事实**，
需要一处最小增量字段；该变更须单开审批票，本票不实施。

- 审计性质：只读源码、契约、测试与规格；未改 contracts / code / tests；未跑真实浏览器；零付费调用。
- 需求依据：`docs/v7.6/验证.md:152-158`（有限终止后「输出原因、最后观测和执行轨迹」）、
  `docs/v7.6/验证.md:178`、`docs/v7.6/验证.md:455`；本图边界 ③（不为表达方便擅自扩契约）见
  `.scratch/generic-playtest-v1/map.md:23`。
- 术语依据：`CONTEXT.md:704-731`（Semantic Test Action / Critical Path / Playtest Outcome /
  InsufficientEvidence / not-executed）。

---

## 一、现有字段逐项能承载什么

| 字段 | 位置 | 能表达 | 不能表达 |
|---|---|---|---|
| `PlaytestOutcome`（五态 + `UNKNOWN`） | `packages/contracts/src/playtest.ts:24-33` | 未完成/完成的**原因类别**（游戏失败/环境/代理限制/超时/未知/成功） | 谁结束了运行；停止规则 |
| `PlaytestExecutionSchema` | `playtest.ts:35-40` | 「未执行 + 原因」 | 已执行后的提前终止；`not-executed` 明确禁止带 outcome（`playtest.ts:233-234`） |
| 场景 `terminationReached` | `playtest.ts:200` | 场景**目标**是否达成 | 谁结束运行；未达成时的原因 |
| `actions[].outcome` 闭集 `completed/timeout/failed/skipped` | `playtest.ts:214-219` | 单个声明动作的粗结果 | `stopped/aborted` 语义；动作级原因；发起者 |
| `actions[].steps` | `playtest.ts:218` | 动作结束时的**累计**观测步数 | 单动作步数（runner 写入 `obs.steps` 累计值，`runner.mjs:264`；`skipped` 写 0，`runner.mjs:254`） |
| `steps` / `durationMs` | `playtest.ts:227-228` | 场景总步数 / 总时长 | 无进展窗口、阈值是否命中 |
| `endState` / `initialState` | `playtest.ts:172-180, 203-212` | 首末位置，可算净位移 `progressPx` | 逐动作进展；停止时的判定点 |
| `eventCounts` | `playtest.ts:224-225` | `reset` 等 11 类事件的计数（观察器初始化并统计，`observe.mjs:137-145`） | 「达到上限并据此停止」这一决定 |
| `outcome` + `insufficientEvidence` | `playtest.ts:220-222` | 归因结果；`UNKNOWN` 的结构化证据缺口 | 停止原因。`insufficientEvidence` 语义被定义为 `UNKNOWN` 的缺口（`playtest.ts:62-68, 235-236`；`CONTEXT.md:726-728`） |
| 报告 `aggregate` | `playtest.ts:257-258, 461-471` | 多场景原因聚合 | 终止发起者 |
| `runtime.scenarioTimeoutMs` | `playtest.ts:259-267` | 一个**跨场景最大值**（`runner.mjs:333, 388`） | 每场景声明的 `timeoutMs`；场景报告里没有该字段（`playtest.ts:190-245`） |
| `delivery.playtest` 摘要 | `playtest.ts:399-446` | 每场景 `execution/outcome/evidence/insufficientEvidence` | 停止事实（不在投影里，`playtest.ts:511-529`） |
| `playable-smoke` | `delivery.ts:78-101, 196-228, 317-353` | 由 outcome 映射的五值检查状态 | 运行如何结束；`AGENT_LIMITATION/TIMEOUT/UNKNOWN` 三者都映射为 `incomplete`（`playtest.ts:497-504`） |
| `events.jsonl` | `playtest.ts:42-110` | 11 类闭事件；`reset` 事件证明复位发生（`observe.mjs:114-115`） | 停止决定；事件集是闭集，没有 stop 事件 |
| `trace.jsonl` | 仅 `playtest.ts:113` 提及，无契约 schema；`cli/src/playtest.ts:224, 232` 按约定解析 | 逐拍状态快照，可事后重算位置/停滞 | 契约层面的停止事实；不是报告字段，不参与归因读取以外的验证 |

---

## 二、逐项判定

### (a) 执行器主动停止：**不可表达**

1. 没有「终止发起者」字段。场景报告只有 `terminationReached: boolean`（`playtest.ts:200`），它回答
   「目标达成没有」，不回答「谁结束的」。
2. `actions[].outcome` 是闭集（`playtest.ts:216`），没有 `stopped/aborted`。执行器停止时只能借
   `failed` 或 `timeout`，两者都已各有含义：
   - `timeout` 是 runner 在场景截止期到达时的真实返回值（`runner.mjs:164-175`），也是
     `wait_until` 自身预算耗尽的返回值（`runner.mjs:181-193`）；把它用于主动停止会**与超时不可区分**。
   - `failed` 在 runner 里只是「不认识的 action kind」的初值（`runner.mjs:258`），并不表示主动停止；
     而且会破坏归因的「探索耗尽」判据（见下）。
3. 现有 `execution` 的 `{status:"not-executed", reason}` 不能承载：主动停止发生在已执行之后；
   契约禁止 `not-executed` 带 outcome（`playtest.ts:233-234`），`mapPlaytest` 会把它映射为 `blocked`
   （`playtest.ts:483-485`），CLI 归因会把 not-executed 当 prepare/boot 阶段处理（`cli/src/playtest.ts:237-239`），
   聚合直接排除它（`playtest-attribution.ts:189-198`）。这是事实层面的错误（运行明明执行了）。
4. `expectedOutcome` 是场景**设计意图**，明确不参与归因（`playtest.ts:196-197`；`playtest-attribution.ts:1-8`），
   也不能当停止事实。
5. `harnessCondition` 是场景声明的闭集（`playtest.ts:195`, `playtest.ts:368`），没有「停止」值，且它是
   场景设计而不是运行结果。

### (b) 连续无进展：**原始观察可表达，判定与窗口不可表达**

- 可表达：`steps`、`durationMs`、`endState.playerX - initialState.playerX`、`eventCounts.reset` 和
  `trace.jsonl`（证据 ref）都在报告/证据里。
- 不可表达：契约没有「连续多少步无进展」的窗口字段，也没有「因此停止」的字段。报告里没有进展
  度量定义或阈值；`trace` 不是契约 schema（`packages/contracts/src/playtest.ts` 中无 trace schema），
  只能作为附件证据，不能由 schema 校验。
- 现在的 `stuck` 是**事后归因输入**：`cli/src/playtest.ts:251`
  `((steps ?? 0) >= 200 && progressPx <= 10) || (eventCounts.reset ?? 0) >= 3`。
  它不写进报告、不停止运行，只在 `attributionEvidence()` 内部传给 `attribute()`
  （`cli/src/playtest.ts:250-258`）。`PlaytestAttributionEvidence.action.stuck` 是归因输入类型
  （`playtest-attribution.ts:37-48`），不是报告字段。
- 另外 `actions[].steps` 是累计值而非增量（`runner.mjs:264`），不能用来证明「某个动作内连续 N 步无进展」。
- 该统计本身也不是「连续」度量：`steps` 是**场景总步数**，`progressPx` 是**首末净位移**，二者都不能证明「连续 200 步无进展」；`reset>=3` 统计的是整次运行中推断出的 reset 事件，而不是执行器停止瞬间的连续计数。

### (c) 重复重置达到上限：**计数可表达，「达到上限并停止」不可表达**

- 可表达：`reset` 是 11 类闭事件之一（`playtest.ts:43-55`），`eventCounts.reset` 是契约字段
  （`playtest.ts:225`），观察器按状态差推导 `reset` 并计数（`observe.mjs:114-115, 137-145`）。
- 注意 `reset` 是状态差**推断**事件（`observe.mjs:114-115`），不是引擎权威计数器；执行器若按自己的
  连续 reset 计数停止，该计数本身也应在报告里留痕，而不是靠事后数事件。
- 不可表达：没有字段记录「重置次数达到阈值，因此主动停止」。`reset >= 3` 只存在于 CLI 的事后
  `stuck` 统计里（`cli/src/playtest.ts:251`），同样不终止运行；而且 `comparableEvents` 默认只有
  `pickup/win`（`playtest.ts:381`），`reset` 不在比较投影里（`playtest.ts:551-567`），
  但它仍在 `eventCounts` 中可读。

### (d) 最终归因：**原因类别可表达，终止发起者不可表达**

- 五态 + `UNKNOWN` 的词表足以把「执行器能力不足」归为 `AGENT_LIMITATION`、把「截止/预算耗尽」
  归为 `TIMEOUT`、把「证据不足」归为 `UNKNOWN`；聚合与交付映射也是确定的
  （`playtest.ts:461-505`；`delivery.ts:46-56`）。
- 但 `attribute()` 的输入里没有任何「停止发起者/停止原因」字段（`playtest-attribution.ts:23-53`），
  决策表也从不读取它。`AGENT_LIMITATION` 在 `deadlineHit` 之前判定（`playtest-attribution.ts:159-172`），
  所以**场景截止 + stuck 证据也会得到 `AGENT_LIMITATION`**；测试
  `packages/contracts/tests/playtest-attribution.test.ts:60-68` 正是这个组合。
  也就是说，同样的 outcome 既可能来自主动停止，也可能来自场景超时；报告读者无法区分。
- 交付层更粗：`AGENT_LIMITATION`、`TIMEOUT`、`UNKNOWN` 都映射为 `incomplete`
  （`playtest.ts:497-504`），只在 `detail` 字符串上不同；`playable-smoke` 状态本身不区分三者。

---

## 三、尝试用现有字段承载停止事实的映射（均失败）

| # | 映射 | 结果 | 失败原因 |
|---|---|---|---|
| 1 | `execution: {status:"not-executed", reason:"executor stop: no progress"}` | schema 可过（若同时不带 outcome），但语义错误 | 运行已执行；禁止 outcome（`playtest.ts:233-234`）；`mapPlaytest` → `blocked`（`playtest.ts:485`）；CLI 归因为 prepare/boot（`cli/src/playtest.ts:237-239`）；聚合排除（`playtest-attribution.ts:189-198`） |
| 2 | 当前动作 `outcome:"failed"`，后续动作 `"skipped"` | schema 可过 | 没有原因；`explorationExhausted` 变成 false（`cli/src/playtest.ts:249`），可能把 `AGENT_LIMITATION` 翻成 `UNKNOWN`；只有动作级结果，没有场景级停止事实 |
| 3 | 当前动作 `outcome:"timeout"`，后续 `"skipped"` | schema 可过，归因往往能到 `AGENT_LIMITATION`/`TIMEOUT` | 「主动停止」被伪装成「超时」；真实场景截止期同样写入 `timeout`（`runner.mjs:175`）；`deadlineHit = timedOut > 0`（`cli/src/playtest.ts:259`）；不可区分 |
| 4 | 追加合成动作 `{kind:"stop-no-progress", outcome:"failed"}` | schema 可过（`kind` 是开放字符串，`playtest.ts:215`） | 违反「报告 actions 对应场景声明动作」的语义（`CONTEXT.md:704-710`）；`attempted` 被改变（`cli/src/playtest.ts:246`）；仍无类型化原因；交付摘要不携带 |
| 5 | `eventCounts["executor-stop:no-progress"] = 1` | schema 可过（开放 record，`playtest.ts:225`） | 事件计数被定义为 11 类闭事件的计数（`playtest.ts:42-57`, `observe.mjs:137-145`）；没有消费者读；交付摘要不携带 |
| 6 | `insufficientEvidence.ruleId = "executor-stop-no-progress"` | schema 不禁止非 `UNKNOWN` 场景携带（只有 `UNKNOWN` **必须**携带，`playtest.ts:235-236`） | 语义是「证据不足」（`playtest.ts:62-68`, `CONTEXT.md:726-728`），会与真正的证据缺口混淆；`attribute()` 不读它；强行使用会把「执行器有正面停止证据」说成「证据不足」 |
| 7 | 用 `outcome: "AGENT_LIMITATION"` 单独承载 | 可过 | 这是原因类别，不是终止事实；场景截止 + stuck 也得到同一值（`playtest-attribution.test.ts:60-68`）；无法回答「主动停止还是超时」 |
| 8 | 用 `terminationReached:false` 承载 | 可过 | 只表示目标未达成；场景超时、动作列表耗尽、主动停止都是 false；不区分发起者 |
| 9 | 用 `trace.jsonl` / `events.jsonl` 承载 | 证据存在 | `trace` 无契约 schema；`events` 是闭集且无 stop 事件（`playtest.ts:42-57`）；只能事后推断症状，不能读取决定；且 `trace` 只作为证据 ref，schema 不校验 |
| 10 | 用 `durationMs` 对比 `runtime.scenarioTimeoutMs` 推断 | 不可靠 | 报告里的 `scenarioTimeoutMs` 是**跨场景最大值**（`runner.mjs:333, 388`），场景报告没有自己的 `timeoutMs`（`playtest.ts:190-245`）；`durationMs` 还含 setup/boot（`runner.mjs:198, 291`）；`wait_until` 的动作预算耗尽也会提前结束并写 `timeout`（`runner.mjs:181-193, 265`） |

**关于「开放字符串」的说明**：`actions[].kind`（`playtest.ts:215`）、`eventCounts` 的 key
（`playtest.ts:225`）和 `evidence` 的 ref（`playtest.ts:226`）在类型上允许塞入约定字符串。
但这不是契约表达，而是**约定滥用**：没有 schema 验证、没有消费者读取、交付摘要不投影，
并且会与场景动作/事件词表冲突。它比增加一个显式可选字段更差，不满足「无歧义」。

---

## 四、两条关键机制证据

### 4.1 事后 `stuck` 统计不终止运行

- `stuck` 只在 CLI 归因阶段计算（`cli/src/playtest.ts:251`），并且只作为
  `PlaytestAttributionEvidence.action.stuck` 传给 `attribute()`（`cli/src/playtest.ts:258`）。
- runner 的动作循环只由场景 `timeoutMs` 截止、动作自身预算或目标达成结束
  （`runner.mjs:164-175, 181-194, 252-267`）；policy 的 `STUCK_STEPS = 12` 只触发一次起跳
  （`policy.mjs:16-17, 176-203`），不是停止机制；`policy.mjs` 没有 reset 计数/主动停止路径。
- 因此 `steps>=200 && progressPx<=10` 与 `reset>=3` 是**观测性归因阈值**，既不是终止机制，
  也不落盘为事实。

### 4.2 `attribute()` 对发起者不敏感

- `positiveLimitation` 在 `deadlineHit` 之前（`playtest-attribution.ts:159-172`）。
- 测试 `playtest-attribution.test.ts:60-68`：`deadlineHit:true` + `stuck:true` +
  `explorationExhausted:true` ⇒ `AGENT_LIMITATION`。
- 测试 `playtest-attribution.test.ts:88-94`：`deadlineHit:true` 且无 stuck ⇒ `TIMEOUT`。
- 所以「主动停止」若被编码成 `timeout`，其归因结果与真实截止期完全相同；报告字段无法反推发起者。
- 此外，若把停止动作记为 `failed`，`explorationExhausted` 需要所有动作都是 `completed|timeout`
  （`cli/src/playtest.ts:249`），会变成 false；当重置耗尽但净位移 ≥10px 时
  （`stuck=true` 因 reset≥3，但 `progressPx<10` 不成立），`positiveLimitation` 两个分支都不成立
  （`playtest-attribution.ts:160-163`），最终落到 `UNKNOWN`（`playtest-attribution.ts:174-176`）——
  把执行器的能力边界误报为证据不足。这是「用 failed 承载停止」的具体语义代价。

---

## 五、最小增量提案（**不实施**）

### 5.1 缺失字段

`PlaytestScenarioReportSchema`（`packages/contracts/src/playtest.ts:190-245`）没有「场景如何结束」
的字段。`DeliveryPlaytestScenarioSchema`（`playtest.ts:399-417`）同样没有。

### 5.2 提案字段

在 `PlaytestScenarioReportSchema` 增加一个**可选、严格对象**：

```ts
stop: z.strictObject({
  reason: z.enum([
    "no-progress",        // 执行器：步数制连续无进展达到上限
    "reset-exhaustion",   // 执行器：重复重置达到上限
    "wait-limit",         // 执行器：等待/退避预算耗尽
    "jump-exhaustion",    // 执行器：连续跳跃尝试失败达到上限
    "scenario-timeout",   // 场景声明的 timeoutMs 到期
    "action-timeout",     // 动作自身预算到期（如 wait_until.timeoutMs）
    "actions-exhausted",  // 场景声明动作列表正常走完但未达成 termination
  ]),
  atStep: z.number().int().nonnegative(), // 做出停止决定时的累计观测步数
}).optional()
```

- **为什么是这个形状**：`reason` 同时编码「发起者」与「规则」——
  `no-progress/reset-exhaustion/wait-limit/jump-exhaustion` = 执行器主动停止；
  `scenario-timeout` = 场景截止；`action-timeout` = 动作预算；`actions-exhausted` = 正常耗尽。
  不再单列 `initiatedBy`，因为它由 `reason` 可推导，单列会重复。
- **为什么需要 `atStep`**：把决定绑定到 `trace.jsonl` / 报告 `steps`，满足
  `docs/v7.6/验证.md:157` 的「输出原因、最后观测和执行轨迹」；不要求把无进展窗口阈值写进报告。
  若审批票认为连阈值也必须自足，可再加可选 `windowSteps`/`observed`，但 `progressPx` 与
  `resets` 已可由 `endState/initialState/eventCounts` 推出，不建议重复。
- **生产者**：harness runner/policy（决定发生处），不是 CLI 的事后归因。CLI 无法重建决定，只能推断症状。
- **写入条件**：新报告在 `execution === "executed" && terminationReached === false` 时必须写
  `stop`；schema 不能强制（否则旧报告不合法），由 runner + 测试保证。
- **语义**：`stop` 只陈述「本次执行如何结束」，不改变 outcome 归因；`SUCCESS` 仍要求
  `terminationReached` 与全 pass（`playtest.ts:239-244`）。

### 5.3 交付摘要（可选同构）

若要求 `delivery.playtest` 不跟进报告路径也能读到停止事实，在
`DeliveryPlaytestScenarioSchema`（`playtest.ts:399-417`）增加同一个可选 `stop`，
并在 `playtestSummaryOf`（`playtest.ts:511-529`）投影一行。
若不做，`delivery` 只能通过 `playtest.report` 指向的完整报告读取；交付摘要本身仍不表达。

### 5.4 向后兼容

- **旧报告 → 新读取器**：合法。字段可选，所有现有 `playtest-report/v1` 报告无需改写。
- **新报告 → 旧读取器**：`PlaytestScenarioReportSchema` 是 `z.strictObject`（`playtest.ts:190`），
  旧读取器会把新字段当未知键拒绝。本仓库 schema/生产者/消费者同版本发布，通常不是问题；
  若要求跨版本读取，应同时把 `PLAYTEST_REPORT_VERSION`（`playtest.ts:19`）升到 v2，而不是静默改 v1。
- **基线/确定性投影**：`playtestProjectionOf`（`playtest.ts:551-567`）不包含 `stop` 时，
  旧基线不受影响；若把 `stop` 加入投影，基线需要重新校准。建议先不加入。
- **规则版本**：停止阈值是策略的一部分。审批票应同时约定 `PLAYTEST_RULES_VERSION`
  （`playtest.ts:22`）或 harness 版本的递增规则，避免旧报告的 `no-progress` 被新阈值重新解释。

### 5.5 对 `playable-smoke` / verdict 的影响

- `mapPlaytest`（`playtest.ts:483-505`）不读取 `stop`；`playable-smoke` 的
  `status`/`detail` 完全不变，仍由 `execution/aggregate/scenario.outcome` 决定。
- `DeliveryReportSchema` 的一致性校验（`delivery.ts:196-228`）因此不需要改；`applyPlaytest`
  （`delivery.ts:317-353`）与 `deriveDeliveryVerdict`（`delivery.ts:46-56`）不变。
- 也就是说，新字段是**观察性**的，不会新增 pass/fail 路径，不降低门禁，不改变
  `AGENT_LIMITATION`/`TIMEOUT`/`UNKNOWN` → `incomplete` 的既有映射。
- 若希望归因真正利用该字段，还需在 `PlaytestAttributionEvidence`（`playtest-attribution.ts:23-53`）
  增加 `stop` 输入，并在阶段化决策表加一条规则（例如执行器停止 + 正面能力边界证据 ⇒
  `AGENT_LIMITATION`；执行器等待预算耗尽且无能力边界证据 ⇒ `TIMEOUT` 或 `UNKNOWN`）。
  这是**行为变更**，属于审批票范围，不是本提案的契约字段本身。

### 5.6 验收测试（审批票实施时）

- schema：旧报告（无 `stop`）继续通过；新 `stop` 的 7 个 reason 通过；未知 reason 拒绝；
  `atStep` 非整数/负数拒绝。
- runner：无进展停止写 `reason:"no-progress"`；重置上限写 `"reset-exhaustion"`；
  等待上限写 `"wait-limit"`；场景截止仍写 `"scenario-timeout"`；正常动作耗尽写 `"actions-exhausted"`。
- 归因：同样的 stuck/reset 证据下，主动停止与场景截止得到**可区分**的输入；
  且不把「没通关」误判为 `GAMEPLAY_FAILURE`。
- 交付：`mapPlaytest` 对同一 outcome 的 status/detail 与改动前逐字一致。

---

## 六、结论与审批

**NOT EXPRESSIBLE。** 现有 `playtest-report/v1` + `delivery` 契约可以表达重置计数、首末位置、
总步数和五态原因类别，但**不能无歧义表达执行器主动停止及其原因**：

- 「主动停止」没有终止发起者字段；`actions[].outcome` 的 `failed/timeout` 都会造成语义失真，
  且 `timeout` 与场景截止期不可区分。
- 「连续无进展」只有原始观察；没有窗口/阈值/停止决定字段；`stuck` 是事后归因输入，不落盘、不终止。
- 「重复重置达到上限」的计数可读，但「达到上限并停止」没有字段。
- 最终五态归因可表达原因类别，但 `attribute()` 对发起者不敏感；场景截止 + stuck 与主动停止
  产生相同 outcome（测试已证明）。

**因此需要一处最小增量字段（`PlaytestScenarioReportSchema.stop`，可选；交付摘要可选同构），
并且必须单开审批票后再实施。** 本票未修改任何 contracts / code / tests，也未实施该提案。

---

## 七、引用索引

- 契约：`packages/contracts/src/playtest.ts:19-33, 35-40, 42-57, 62-68, 190-245, 248-291,
  372-381, 399-446, 461-471, 483-505, 511-529, 551-567`
- 归因：`packages/contracts/src/playtest-attribution.ts:1-8, 23-53, 99-177, 159-176, 189-198`
- 交付：`packages/contracts/src/delivery.ts:46-56, 78-101, 135-229, 317-353`
- 写回：`packages/pipeline/src/playtest.ts:27-76`
- CLI：`packages/cli/src/playtest.ts:222-263, 284-316, 369-372, 393-400, 412-425`
- runner：`packages/demo/probe/playtest/runner.mjs:153-194, 196-305, 307-340, 388, 434-449`
- policy：`packages/demo/probe/playtest/policy.mjs:16-17, 27-49, 217-259, 276-282`
- 观察：`packages/demo/probe/playtest/observe.mjs:71-145, 157-209, 235-241`
- 测试：`packages/contracts/tests/playtest-attribution.test.ts:60-68, 88-94, 96-108`;
  `packages/contracts/tests/playtest.test.ts:118-126`;
  `packages/contracts/tests/delivery.test.ts:46-56`; `packages/pipeline/tests/playtest.test.ts:88-145`
- 规格/词汇：`docs/v7.6/验证.md:152-158, 178, 455`; `CONTEXT.md:704-731`;
  `.scratch/generic-playtest-v1/map.md:14-33, 74-78`

## 八、限制

- 只读审计；未运行浏览器、未运行测试套件、未调用付费模型。
- 未验证「未来策略实现是否真的会产生无进展/重置停止」——本票只判定契约表达力；
  实现与阈值由 03/05 决定。
- 结论基于当前源码与测试；若审批票决定不落盘停止原因、只要求人类可读的证据旁注，
  则可用 attempt 目录 sidecar 满足 `docs/v7.6/验证.md:157` 的**人工追溯**，
  但这不满足「契约消费者可读取」的无歧义表达，且不应冒充为报告事实。
