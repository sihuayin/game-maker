# 07. Harness 核心与观测（可复现判定基础）

Type: task
Status: resolved
Map: ../map.md
Owner: main session · 2026-10-27
Blocked by: 02, 03, 05, 06

## Question

把票 02/03/05 的裁定落成新 `playtest` harness 的第一层（用户 2026-10-27 分层第 1 层）：同一场景在同版本绑定 +
同判定规则下产出**判定确定**的规范化证据。本票**不**实现五态归因（票 08）与基线（票 09）。

## 范围

1. **场景契约加载**：声明式数据契约 + 薄解释器（票 02）；版本绑定（场景格式版本 + 目标 site 版本 + pack/config
   经 site 依赖验证），不匹配默认拒绝并记 `not-executed` + 拒绝记录。
2. **观测产物**：`events.jsonl`（11 类闭事件 + `source` 真实性 + `actor` 规则 + `params` schema）· `trace`（状态快照）·
   `input.jsonl`（实际输入：`type`/`key`/`code`/`t`/`seq`/动作来源）· `result.json`（摘要 + 逐场景结果 + 身份 + 证据引用）。
3. **确定性运行**：语义动作解释器按**观测步**推进；固定轮询间隔与场景时限；固定 Chrome flags / viewport / DSF /
   渲染路径；把影响决策的 `Date.now()` 改为步骤计数（stuck / jump cooldown）；实际配置写入报告。
4. **规范化投影**：按票 05 Q2 的「必须一致」字段产出可比较投影（断言三值、离散终态、显式可比较事件计数、
   不可判记录）；`PlaytestOutcome` 由票 08 归因填入。
5. **harness 自测分层**：`hazard-legacy` + `gate` / `pickup` / `input` 负例保留为 harness 自测，**不进**五态场景集。

## 验收（完成条件）

- 全仓测试绿 + typecheck 绿；
- 同一场景连续两次干净运行的规范化投影完全一致（票 05 Q2「两次干净运行」定义）；
- 真实产物零付费跑通，命令 + 退出码 + 路径可追溯，产物只写 `out/` 或本 effort 目录；
- 观测字段与票 03 Q5/Q6 逐条对齐：无会话内打点、外壳零改动（`SHELL_VERSION` 不升、站点字节不动）。

## 追加范围（票 06 收口 · 2026-10-27）

票 06 已裁定交付接入的 schema 与聚合规则。本票在原有 harness 核心之外，落以下**契约与规则**；
阶段化归因决策表、实锤门槛与代理限制证据仍归票 08（不重开原分工）：

1. **完整 `PlaytestReportSchema`**（`playtest-report/v1`）：`reportVersion` · 身份绑定（场景格式版本、实际 site/pack/config/shell、harness 版本、判定规则版本）· `execution`（`executed` | `not-executed` + reason）· 逐场景结果（`scenarioId` / `required` / `execution` / `outcome` / 逐断言三值 / 场景级 `insufficientEvidence` / 证据引用）· `aggregate` · 命令与退出码 · 起止时间。
2. **`delivery.playtest` 可选摘要 schema**（`z.strictObject`）：`report` / `reportVersion` / `execution` / `aggregate?` / `scenarios[]`（含场景级 evidence refs 与 UNKNOWN 的 `insufficientEvidence`）/ `evidence` / `baseline?`。摘要不是第二份报告；完整身份与逐断言细节只住 `result.json`。
3. **聚合规则**：`aggregate` 由**已执行场景**按票 04 优先级
   `GAMEPLAY_FAILURE > ENVIRONMENT_FAILURE > TIMEOUT > AGENT_LIMITATION > UNKNOWN > SUCCESS` 计算；
   `not-executed` 不参与排序但阻止 pass；存在 `GAMEPLAY_FAILURE` 时不得因必需场景未执行降为 blocked。
4. **状态映射契约**：`mapPlaytest(view | undefined) → { status, detail }`，纯函数，不读文件、不验路径；规则见票 06 Q7（fail / blocked / incomplete / pass 的边界；`aggregate=SUCCESS` 不等于 pass；必需场景未执行不得 pass）。
5. **superRefine 写前不变量**：check status 必须等于 `mapPlaytest`；pass 要求全部必需场景 executed+SUCCESS、无 UNKNOWN、证据 ref 可解析、`report` 与 `playtest-result` path 相等；fail 只能来自 GAMEPLAY_FAILURE；blocked 覆盖未执行/环境故障/必需场景未执行；incomplete 覆盖 TIMEOUT/AGENT_LIMITATION/UNKNOWN（必需场景已执行）；`baseline` 不参与 status/verdict。
6. **证据引用分层**：`scenarios[].evidence` 与 `delivery.playtest.evidence` 都是指向 `delivery.evidence` 的可解析 refs；UNKNOWN 的 `insufficientEvidence` 保持在场景级；旧报告 `delivery.playtest` 缺席合法，旧 smoke 结果不升级。

⚠️ 本票仍**不**实现五态归因的阶段化决策表、实锤门槛与代理限制证据（票 08）；本票只提供报告契约、聚合规则与交付摘要契约。

## Answer（施工 · 2026-10-27）

第一层落地：**声明式场景契约 + 状态差观测 + 判定确定的规范化证据**。本票**不**实现五态归因、交付写回/CLI 与基线（08/09）；`result.json` 的 `outcome` / `aggregate` 在观测阶段缺席，由 08 归因后填入。

### 1. 契约（`packages/contracts/src/playtest.ts`）

- `PlaytestReportSchema`（`playtest-report/v1`）：完整身份（场景格式/每场景修订号、site/pack/config/shell/harness/判定规则版本）· `execution`（executed / not-executed + reason）· 逐场景结果（`required` / `harnessCondition` / `expectedOutcome` / 断言三值 + 场景级 `InsufficientEvidence` / `initialState` / `endState` / 动作摘要 / 可比事件计数）· `aggregate` · 命令/退出码/时间 · 实际运行配置。
  - **观测阶段 `outcome` / `aggregate` 可缺席**；一旦出现，schema 强制「已执行场景要么都有 outcome，要么都没有」且 aggregate 与场景按票 04 优先级一致。SUCCESS 强制终止条件达成 + 至少一条实质断言 + 全部 pass + 零 unknown。
- `PlaytestEventSchema`：11 类闭事件，`params` **按事件类型**用 strictObject 校验（票 03 Q5 约束 3）；`runtime-error` 的 `source` 强制 `cdp`，其余事件强制 `poll`；`spawn` / `jump` / `land` 的 `inferred:true` 写死。
- `PlaytestInputEventSchema`：`type/key/code/t/seq/source`（票 05 Q1；`input.jsonl` 不是 `trace`）。
- `PlaytestScenarioSchema`（`playtest-scenario/v1`）：版本绑定、语义动作（`move_to` / `jump_over` / `wait_until` / `reach_goal` / `assert_state`）、断言三值（`onInsufficient` 写死 `"unknown"`）、终止条件、时限、可比较事件、harness 条件（`none` / `no-chrome` / `hang`）。
- `DeliveryPlaytestSchema`：交付最小摘要（`report/reportVersion/execution/aggregate?/scenarios[]/evidence/baseline?`），场景级 UNKNOWN 必须带 `insufficientEvidence`；证据 ref 在 `delivery` superRefine 里必须可解析，`playtest.report` 必须等于 `playtest-result` 的 path。
- `mapPlaytest` / `aggregatePlaytestOutcome` / `aggregateAssertions` / `playtestProjectionOf` / `samePlaytestProjection` / `playtestSummaryOf`：纯函数，零 I/O。`mapPlaytest` 规则按票 06 Q7：fail 优先、必需场景未执行 ⇒ blocked（`aggregate=SUCCESS` 不等于 pass）、环境故障 ⇒ blocked、TIMEOUT/AGENT_LIMITATION/UNKNOWN ⇒ incomplete。
- `delivery.ts` 加可选 `playtest` 字段与六条 superRefine 不变量；`applyVisualReview` 重算时**保留** `playtest`。旧报告无 `playtest` 仍可解析。

### 2. Harness（`packages/demo/probe/playtest/`）

- `playtest.mjs`：入口（`--site/--pack/--scenario-dir/--out/--repeat/--json`）；退出 0 = 至少一个场景 executed 且投影一致，1 = 未执行/不一致，4 = 没有可执行场景。
- `runner.mjs`：从 site 解析实际身份（主绑 site，pack/config 从 `site.json` 解析）；场景格式/版本不匹配写 `rejections.json` 并拒绝；`run/v<N>/playtest` 的版本化 attempt 留给 08，本层用 `attempt-v<K>/`；站点前后哈希（`site-integrity.json`）。
- `observe.mjs`：11 类事件由状态差推导；`source` 如实（poll/cdp）；`actor` 用当前运行内的实体下标、无法定位为 null；同窗口多次变化保留计数并标 `ambiguous`。
- `policy.mjs`：起跳冷却/stuck 全部按**观测步**计数，不用 `Date.now()` 做决策；固定轮询/步长/时限写入报告。
- `scenarios/five-state/`：`success-basic` / `failure-missing-pickup` / `limitation-wide-patrol` / `env-no-chrome` / `timeout-hang`。后两者 `required:false`、带 `harnessCondition`，**不进真实游戏交付聚合**（票 04 Q2）。
- 运行前用 schema 校验全部事件与输入；外壳零改动（只注入 `PHASER_HOOK` / `READ_STATE`，无会话内打点）。

### 3. 证据（E3 · 零付费）

- **测试/类型**：`pnpm test` exit 0 —— 140 files / 2100 tests；`pnpm typecheck` exit 0。
- **真实产物**：`.scratch/fpvs-v1-p0/runs/2026-10-26-e2e-r4/wasteland-scavenger-recipe/site/v1`（只读；零付费）。
- **两次干净运行**：命令 + exit 0 + 路径见 [run-evidence.json](../runs/2026-10-27-ticket-07/run-evidence.json)；`determinism.same=true`，两次 attempt 的规范化投影一致（断言三值 / 离散终态 / `pickup,win,chest-open` 计数），位置/时间戳/步数不参与比较。
- **观测契约**：`events.jsonl` 示例 `{"v":1,"seq":0,"t":0,"frame":null,"type":"scene-ready",...,"source":"poll"}`；`runtime-error` 走 `cdp`（单测覆盖）；`input.jsonl` 记录实际按键；`site-integrity.json` 前后逐文件哈希一致；`shellVersion=2`，站点字节未改。
- **setup 路径**：`failure-missing-pickup` 初始 `activePickups=3` vs 期望 4 ⇒ 断言 `fail`（票 04 Q4 要求的初始态证据）；`limitation-wide-patrol` 把 hazard 0 distance 改为 100 后 8s 未通关 ⇒ 断言 `unknown`。
- **harness 条件**：`env-no-chrome` 记 `not-executed`（不启动浏览器）；`timeout-hang` 记 `executed` + 截止未终止（断言 unknown）。归因归 08，本层不声称五态。
- **真实 run 不声称 SUCCESS**：`success-basic` 在真实站点上执行到底但未通关（assertions unknown、termination=false）；这正是 08 要用证据归因的输入，不是本层的 `GAMEPLAY_FAILURE`。

### 4. 边界与移交

- **08**：五态归因器、`delivery.playtest` 写回、`game-maker playtest` CLI、attempt 版本化（`run/v<N>/playtest/v<K>/`）、退出码 0/1/2/4、smoke 退役与 `hazard-legacy` / `gate` / `pickup` / `input` 自测迁移（旧 smoke 的负例仍在旧实现上，**不进**五态场景集；迁移前不删除）。
- **09**：基线比较、真实产物验收、旧报告兼容报告。
- **未做**：交付写回/CLI、基线、五态归因、smoke 删除。没有改 `fixtures/`、`game-maker.local.json`、Runtime Shell 或站点字节。

### 5. 已知风险

- 真实站点的自动玩家在 45s 内未通关（历史 smoke 同样停在 `navigate`）；本层只保证证据与判定确定，**08 必须用动作轨迹/能力几何/探索耗尽等正面证据区分 `AGENT_LIMITATION` / `TIMEOUT` / `UNKNOWN`**，不得把这次没通关写成 `GAMEPLAY_FAILURE`。
- `failure-missing-pickup` 的初始态证据已落盘，但 08 仍需按票 04 的实锤门槛（环境健康前置门）归因。
