# 06. 交付接入（取代 playable-smoke）

Type: grilling
Status: resolved
Map: ../map.md
Owner: main session · 2026-10-27
Blocked by: 04

## Question

裁定新 harness 的试玩报告怎么接入现有 QA / delivery（范围内第 5 条；方向已定：取代 smoke、交付契约只加性扩展、
不破坏 `playable-smoke` 键）。至少定：

1. **取代 vs 兼容**：`playable-smoke.mjs` / `mapPlayableSmoke` 的退役时序 —— 新 harness 上线后，交付报告里那个
   `playable-smoke` 键是**继续叫这名**（消费者换成新产物、旧报告仍解析）还是**新增 `playtest` 键**（旧 `playable-smoke`
   退役）？`result.json` 形状变了，`mapPlayableSmoke` 怎么演进（加性扩字段 / 换新映射函数）？
2. **交付契约加性扩展**：`qa-report/v1` 的 `delivery` 要加什么字段（试玩场景列表 / 五态归因 / 事件观测引用 /
   回归基线引用）？沿用 fpvs-v1-p1「可选子对象 + 固定注册表 + 不升版」的加性纪律吗？
3. **命令与入口**：`pnpm test:playable` 变成 `pnpm test:playtest` 还是保留旧命令做别名？新 harness 的 CLI/入口
   长什么样（是否复刻 smoke 的 `--negative` / `--scenario` 开关）？
4. **消费者重算**：五态归因（票 04）如何进 `deriveDeliveryVerdict` —— `playable-smoke` 检查项的状态/归因怎么算、
   最终 verdict 重算对不对。
5. **零付费验收**：本图最后如何像 fpvs-v1-p1 的 `acceptance.mjs` 那样，用现有真实产物做一次零付费端到端报告验收。

> **与票 04 的接口（2026-10-27 补）**：票 04 已定——五态 → 交付状态映射（`SUCCESS→pass` / `GAMEPLAY_FAILURE→fail` /
> `ENVIRONMENT_FAILURE·not-executed→blocked` / `TIMEOUT·AGENT_LIMITATION·UNKNOWN→incomplete`）、多场景聚合
> （执行结果按总序、执行资格单独判：必需场景未执行不得 pass，确定性 fail 不降级）、`mapPlaytest` 纯映射 +
> `buildDeliveryReport` 重算、写前一致性不变量、证据一律可追溯本次执行的 E3、`UNKNOWN` 结构化缺口记录。
> 本票只裁定**键名（`playable-smoke` 保留 vs 新增 `playtest`）、schema 条件校验、命令改名、兼容迁移与真实产物验收**，
> 不重开归因语义。

> **与票 05 的接口（2026-10-27 补）**：票 05 已定——基线比较是**纯观察**（三值 `match/changed/not-comparable`），
> **不得**改变 `PlaytestOutcome`、断言三值、`DeliveryCheckStatus` 或 `DeliveryVerdict`；试玩报告带 `baseline` 比较段，
> delivery / CLI 只展示（「与基线不同」措辞），不把 `changed` 写成「回归失败」。基线机制本身归票 09。

HITL：用户逐字裁定。

## Answer（裁定 · 2026-10-27 用户逐字 + 修正）

**总纲**：一套新 harness、一套五态归因、一套交付判定；`playable-smoke` 键负责历史兼容，旧 smoke 执行机制在本 effort 末尾退役。`qa-report/v1` 不升版，`delivery` 只做加性扩展。

### Q1 — 键名：保留 `playable-smoke` ✓

- `DELIVERY_REQUIRED_CHECKS` 保持六项；不新增必需的 `playtest` 检查项。
- `DELIVERY_CHECK_LABELS["playable-smoke"] = "试玩"`；`detail` 承载五态 / `UNKNOWN` / `not-executed` 等判定信息。
- 新增**可选** `delivery.playtest` 摘要子对象（Q7）。**可选的是摘要，不是必需验收本身**：新报告缺少必需试玩结果时，消费者仍根据报告存在性、执行状态和有效证据映射交付状态，不得跳过检查项或自动通过。
- `qa-report/v1` 不升版，旧报告继续可读。
- 旧报告里的 smoke 结果只作为旧结果读取，**不升级**为新 harness 的场景证据或基线数据。

### Q2 — 触发：独立 CLI `game-maker playtest <run 目录>` ✓

- `create` / `build` 不启动浏览器，不依赖系统 Chrome；v1 不新增 MCP 工具，不把试玩隐式塞入 `build`。
- `playtest` 独立执行场景，产物写 `run/v<N>/playtest/v<K>/`；完成后写回对应 `qa-report.json`，由 contracts 纯映射 + `buildDeliveryReport` 重算交付结论。
- 未来若加 `build --playtest`，只能是同一机制的显式调用入口，不得引入第二套执行或判定逻辑。
- 命令失败不得用「没有报告」伪装成正常未执行；CLI 必须保留失败原因与可追溯记录。消费者区分「尚未运行」「准备阶段拒绝」「执行过程中环境故障」「报告损坏」。

### Q3 — 退役：本 effort 末尾硬切 ✓

执行顺序：① 新 harness 与 07–09 的自测、场景覆盖、真实产物验收完成；② 确认新 `playtest` 报告可被现有 delivery 消费者稳定读取、所有必需验收状态映射正确；③ 同一 effort 内删除 `packages/demo/probe/playable-smoke.mjs`、`packages/contracts/src/playable-smoke.ts`、对应旧测试与 `PLAYABLE_SMOKE_*` 常量；④ 移除 `test:playable`，新增 `test:playtest`；⑤ 保留 `probe-harness.mjs`，继续复用其 CDP 与 Chrome 启动能力，不复制第三套浏览器基础设施。

- **硬切的是实现，不是历史报告契约**：旧 `qa-report/v1` 中的 `playable-smoke` 数据仍可读取；新消费者兼容旧 `detail` 形状，不因删除旧 TypeScript 类型/文件而拒绝历史报告。
- 旧 smoke 结果不得自动伪装成新 harness 的完整场景证据或基线数据。**能读旧报告 ≠ 能把旧结果升级成新结果。**

### Q4 — 产物布局与输入解析 ✓

**产物**：`run/v<N>/playtest/v<K>/`，K 在同一 run 的 playtest 命名空间单调递增；attempt 一旦创建，报告、事件、输入轨迹及证据文件不可被后续运行覆盖。`delivery.playtest.report` 指向当前被交付报告采用的 attempt；比较基线或重跑发现变化时，不得自动替换历史 attempt 或基线。

**失败安全**：attempt 分配遵循仓库原子写入纪律——先写临时目录，成功完成后再提交为正式 `v<K>`；中途失败可留独立失败记录，但不能占用一个看似完整的正式 attempt。

**输入**：`game-maker playtest <run 目录>` 是唯一输入入口，不允许 `--pack` / `--site` / `--config` 覆盖。准备阶段必须验证：① `qa-report.json` schema 有效；② `subject` 对应的 pack 存在且身份匹配；③ `delivery.site.version` 对应的 site 已装配且身份匹配；④ `run/v<N>/game-config.json` 存在、有效，并与目标产物一致；⑤ QA 满足启动试玩的既定前置条件；⑥ 场景契约格式、版本绑定及必需场景集均有效。任何一项不满足都不能继续执行试玩，也不能把拒绝伪装成正常运行结果。

**v1 不提供** `--scenario` / `--negative` / 超时覆盖。交付命令必须运行完整的必需场景集；场景子集与负例由 `pnpm test:playtest` 的离线测试机制覆盖。

### Q5 — 退出码与失败记录 ✓（含修正）

| 退出码 | 语义 |
|---|---|
| `0` | 试玩结果为 `SUCCESS`，且报告及交付回写均成功 |
| `1` | 试玩结果非 `SUCCESS`，或 attempt 已生成但交付回写失败 |
| `4` | 准备阶段拒绝、输入无效或已有报告 schema 不合法 |
| `2` | 命令用法错误 |

- **实质修正**：退出码 `0` 必须同时证明试玩成功和交付更新成功；试玩 `SUCCESS` 但 `qa-report.json` 写回失败时不得返回 `0`。
- 非 `SUCCESS` 是有效的执行结果，不是命令崩溃；用 `1` 不用 `2/3`。
- run 目录和原报告有效后，准备拒绝或环境故障应留下可追溯的 attempt；run 目录不存在、原报告损坏或 schema 不合法时退出 `4`，不伪造可正常消费的试玩报告。
- 写回失败时 attempt 报告必须保留，并明确记录回写错误。正式 `result.json` 已完成并提交后，不应事后修改它来伪造回写成功；可将写回失败记录为独立诊断证据（`writeback-error.json`），或在命令输出/日志中记录。下次重试重新验证当前报告和 attempt 身份，不能直接假设上一次写回一定没发生。
- 退出码 `1` 本身不能区分非成功归因与写回失败；消费者必须读取报告中的结构化状态。若写回失败导致交付报告仍然陈旧，CLI 必须明确提示，不能声称交付结论已更新。

### Q6 — 零付费真实产物验收 ✓

- 目标：复用 `.scratch/fpvs-v1-p0/runs/2026-10-26-e2e-r4`（`run/v1` + `pack/v1` + `site/v1`），在 `.scratch/playtest-v1/runs/<日期>-acceptance/` 建立可写沙箱副本；历史产物保持只读。
- 前置 `pnpm build`，运行 `node .scratch/playtest-v1/acceptance.mjs`。
- 三块验收：① 真实产物链路（本地 Chrome、零付费、正式 attempt、写回沙箱副本的 `qa-report.json`）；② 归因与交付一致性（`playable-smoke` 状态、`delivery.playtest`、最终 `verdict`、证据引用、产物身份）；③ 离线五态与准备拒绝测试（记录命令及退出码）+ 旧报告兼容（读取不含 `delivery.playtest` 的旧报告，确认可解析且未被升级）。
- 不要求真实运行一定 `SUCCESS`；五态任一都可证明链路，前提是证据充分且映射正确。
- 若本地 Chrome 缺失，真实产物链路只能证明环境故障归因与记录机制，不能宣称已完成真实游戏执行验收；离线测试通过不能替代真实产物执行。

### Q7 — 摘要 schema 与纯函数边界 ✓（含 3 项修正）

`delivery.playtest?`（`z.strictObject`）：

```ts
{
  report: string,              // run/v<N>/playtest/v<K>/result.json，相对 out 根、POSIX
  reportVersion: string,       // "playtest-report/v1"
  execution: "executed" | { status: "not-executed"; reason: string },
  aggregate?: PlaytestOutcome, // executed 时必填；not-executed 时省略
  scenarios: Array<{
    scenarioId: string,
    required: boolean,
    execution: "executed" | { status: "not-executed"; reason: string },
    outcome?: PlaytestOutcome,                 // executed 时必填
    evidence: string[],                        // refs → delivery.evidence；非 pass 场景至少一条
    insufficientEvidence?: InsufficientEvidence, // outcome=UNKNOWN 时必填（场景级）
  }>,
  evidence: string[],          // 报告级 refs：playtest-result / events / trace / input / command-log
  baseline?: {                 // 纯观察，永不参与 status/verdict
    result: "match" | "changed" | "not-comparable",
    baselineId?: string, reason?: string, diff?: unknown,
  },
}
```

**修正 1 — `aggregate` 与场景聚合一致**：`aggregate` 必须由**已执行场景**的 outcome 按票 04 优先级
`GAMEPLAY_FAILURE > ENVIRONMENT_FAILURE > TIMEOUT > AGENT_LIMITATION > UNKNOWN > SUCCESS` 计算。
`not-executed` 场景不参与 outcome 排序，但必需场景未执行会阻止交付通过；若存在 `GAMEPLAY_FAILURE`，
即使另一必需场景未执行，也不能降成 `blocked`。

**修正 2 — 状态规则统一**：

- `fail`：存在已证实的 `GAMEPLAY_FAILURE`；
- `blocked`：整体未执行、环境故障，或必需场景未执行，且没有优先级更高的 `GAMEPLAY_FAILURE`；
- `incomplete`：`TIMEOUT` / `AGENT_LIMITATION` / `UNKNOWN` 等未能完成验收（且必需场景已执行）；
- `pass`：所有必需场景执行且成功，证据完整。

`aggregate` 是已执行场景的聚合结果，**不是最终 delivery 状态**；`aggregate=SUCCESS` 不代表 `playable-smoke` 一定 `pass`。

**修正 3 — 证据引用分层**：

- `scenarios[].evidence`：指向 `delivery.evidence` 中可解析的证据引用；非 pass 场景至少一条。
- `delivery.playtest.evidence`：本次 attempt 的报告级证据引用。
- `result.json` 内部仍保存逐断言结果、完整身份、详细证据和 `InsufficientEvidence`。
- `playtest.report` 必须与 `playtest-result` 证据条目的 path 一致，不能只检查两者都存在。
- `UNKNOWN` 的 `insufficientEvidence` 保持在**场景级**；若整体 `aggregate=UNKNOWN` 由多个场景的证据不足产生，不能只允许一个模糊的报告级原因。

**纯函数边界**：

| 函数 | 职责 | 禁止事项 |
|---|---|---|
| `mapPlaytest` | 纯映射：执行结果 → 检查项状态与 detail | 读文件、验证文件路径 |
| `playtestSummaryOf` | 从完整报告 view 投影最小摘要 | 自行决定 verdict |
| `applyPlaytest` | 合并内存中的 delivery、重算 verdict | 文件 I/O、改动 QA 层字段 |
| `writePlaytestToReport` | 读写文件、验证身份、原子提交 | 另行实现一套状态映射规则 |

- `applyPlaytest(delivery, report, evidence)` 做完整身份校验，必须收到**完整、已验证的报告对象或身份信息**，不能只给窄 `PlaytestReportView`；`PlaytestReportView` 只用于纯映射。
- `detail` 约定：完整执行时 = `aggregate`；完全未执行 = `not-executed`；必需场景部分未执行且无 fail ⇒ status `blocked`、detail 用可读的 `blocked: 必需场景未执行（id1, id2）`。不新增归因枚举。
- `delivery.playtest` 缺席是合法旧报告状态；消费者只当旧 smoke 结果 / 未运行，绝不升级；新写回路径永远同时写摘要与检查项。
- `knownLimitations` 不被写回改变；`baseline` 纯观察。

### Q8 — 写回不变量 ✓（含 2 项钉死）

1. **重新读取并校验**：每次写回重新读 `qa-report.json`、过 `QAReportSchema`，把 attempt 身份（pack id/version/checksum、config、site version、runId）与**当前** delivery 对齐。身份已变 ⇒ 拒绝写回（`4`），写独立 `writeback-error.json` 到 attempt 目录，**不改** `result.json`。
2. **只动三处**：`playable-smoke` 检查项、`delivery.playtest` 摘要、`verdict`（经 `buildDeliveryReport` 重算）。`visualReview`、`knownLimitations`、pack/config/site/runId、QA 层字段原样保留。
3. **证据替换**：从 `delivery.evidence` 移除全部 `playtest-*` ref，再追加本次 attempt 证据；非 `playtest-*` 证据（旧 smoke、qa-report）不删。旧 attempt 留在磁盘，但不再是当前交付引用的证据。
4. **原子写回与失败恢复**：临时文件与目标文件同一文件系统；`rename` 前完成 schema 校验与 verdict 重算；失败时保留完整 `result.json`，独立写 `writeback-error.json`（也尽可能原子写入）；若它也写失败，CLI 至少输出明确错误并保留可诊断的 stderr。重试时重新读取当前 `qa-report.json`，重新验证身份和当前采用的 attempt，不能假设上次失败一定发生在 `rename` 之前。
5. **幂等**：若当前 `delivery.playtest.report` 已指向本 attempt，且摘要与检查项一致 ⇒ 校验通过即返回，不重复堆证据。
6. **`not-executed` 四类情形**：

| 情况 | attempt | delivery |
|---|---|---|
| 输入目录或现有 `qa-report.json` 无效 | 不伪造有效 attempt；退出 `4` | 不改 |
| 输入有效，但准备阶段拒绝（如身份不匹配） | 可产生可追踪的拒绝记录 | **身份不匹配时不得写入当前 delivery**；退出 `4` |
| 有效 delivery，但 site 尚未装配 | 可产生 `not-executed` 记录 | 身份绑定仍可验证时写回 `blocked`；退出 `4` |
| 游戏执行中环境故障 | 产生正常执行报告 | 写回真实环境故障结果 |

7. **不碰基线**：不自动新建/覆盖基线，不把 `changed` 写成失败，不把旧 attempt 的基线比较结果带进新 attempt。退出码 `4` 表示准备阶段拒绝，不表示写回成功。

### Q9 — 验收报告与判定 ✓（含 2 项修正）

`acceptance.json`（`playtest-acceptance/v1`）包含：`acceptanceVersion` / `verdict` / `startedAt` / `finishedAt` / `source`（`historicalRun`、`sandbox`、`historicalMutated`）/ `environment`（`chrome: "found" | "missing"`、`chromePath?`、`node`、`platform`）/ `checks.realPlaytest` / `checks.attributionDelivery` / `checks.offlineFiveStates` / `checks.legacyReport` / `incompleteReasons` / `artifacts`。

**修正 1 — 必须证明真实游戏执行**：`realPlaytest` 不能只看 `execution === "executed"`。增加并校验：
`gameExecutionReached`（真实游戏执行是否到达可观察游戏阶段）、`sceneReadyObserved`（是否观察到有效 `scene-ready`）、`executionEvidence`（支撑以上结论的证据引用）。真实执行验收要求目标 site 确实被加载、场景达到可观察阶段、并产生本次运行的真实 harness 证据；不要求游戏最终通关，也不要求 outcome 为 `SUCCESS`。

**修正 2 — pass / incomplete / fail 界限**：

- `pass`：Chrome 可用；真实游戏执行已被证实；归因、摘要、检查项、verdict、证据引用一致；离线五态与准备拒绝测试通过；旧报告兼容通过；历史产物未被修改。
- `incomplete`：Chrome 缺失，或未能证明真实游戏执行；其余已运行的检查没有发现验收链路缺陷。
- `fail`：schema、映射、证据、身份或 verdict 不一致；报告损坏；历史产物被修改；或离线验收断言失败。**离线测试失败属于验收链路失败，不能因为真实执行也没发生就一律归为 `incomplete`。**

退出码维持 `0` = pass；`1` = fail 或 incomplete；`4` = 验收输入或历史产物不可用。旧报告样本用 `.scratch/fpvs-v1-p1/runs/2026-10-27-stage-c/qa-report.json`（有 `delivery`、无 `delivery.playtest`），只读解析，不写回。基线只验证 `changed` 不改变 status/verdict；晋升与两次干净运行归票 09。

### 分层（用户 2026-10-27 建议）

- **票 07**：完整报告 schema、归因与聚合规则（含 `delivery.playtest` schema、聚合/映射契约）。
- **票 08**：CLI、attempt 目录、纯函数映射、原子写回、失败恢复、smoke 退役、CONTEXT/CLI 摘要。
- **票 09**：基线比较、真实产物验收、旧报告兼容、验收报告。
- 不新增票据；07/08/09 的范围已按此更新。
