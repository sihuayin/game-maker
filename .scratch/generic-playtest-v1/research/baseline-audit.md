# 01 基线重验：`docs/v7.6/验证.md` vs `main@ae339b9`

**结论：当前 `main` 未满足全部 v7.6 验收标准。**

- **P0-2（§6.6）**：8/8 **MET**（证据闭环可用；有 2 个实现级 caveat，见下）。
- **P0-1（§5.5）**：按验收条目 **3 MET / 3 PARTIAL / 2 NOT MET**。主缺口是：
  `dangers` 不被策略读取、纵向巡逻不支持、`pickupAbove` 无条件追逐、无进展/重复重置不终止、
  等待无独立上限、跳跃只在动作层记录已发键而不校验状态变化。
- **P0-3（§7.5）**：**3 MET / 3 PARTIAL**。审核记录的身份没有与 `delivery`/`visualReview` 机械绑定；
  没有机器可读的“证据不足”状态。
- **P0-4（§8.4）**：**5 MET / 1 PARTIAL**。结论可追溯主要靠路径；产品读取路径不重算证据哈希；
  视觉结论没有结构化 evidence ref。
- **§9**：**9.2 MET；9.1 / 9.3 PARTIAL**（五态场景文件齐全，但没有全量端到端 E2E；
  危险/重复重置测试只覆盖横向巡逻）。
- **§12**：**6 MET / 1 PARTIAL / 1 NOT MET**（DoD-1“有限、可解释的危险处理和无进展终止机制”未满足）。

- 审计性质：只读源码、契约、测试、历史产物；未改 source/test/fixture/config/历史运行目录；
  未启动浏览器、未跑付费调用、未写历史目录。
- 审计基线：`git rev-parse HEAD` = `ae339b9`（FPVS-V1 Final Acceptance FA-06 收口）。
  工作树仅有未跟踪的 `docs/v7.6/` 与 `.scratch/generic-playtest-v1/`；跟踪文件零改动。
- 证据分级：**E1** 源码/契约 `file:line`；**E2** 测试文件 + 测试名/运行结果；**E3** 真实产物路径 + 身份/哈希。
- 路径约定：未写 `.scratch/fpvs-v1-final/` 前缀的产物路径默认相对该 effort 根；`.scratch/playtest-v1/` 与 `packages/` 路径按仓库根写全。
- 需求行号均指 `docs/v7.6/验证.md`（§5.5:174-181；§6.6:274-281；§7.5:334-339；
  §8.4:380-385；§9:391-423；§12:455-462）。

---

## 0. 本次核验做了什么

| 命令 / 检查 | 结果 |
|---|---|
| `pnpm test` | **145 files / 2160 tests passed**，exit 0（本审计在当前 HEAD 重跑） |
| `pnpm typecheck` | 全部包 `Done`，exit 0 |
| 定向 vitest：contracts playtest/attribution/baseline/delivery + pipeline playtest/baseline/delivery/integration + cli review-verdict/scenario-dir + demo probe tests | **13 files / 169 tests passed**，exit 0 |
| `artifacts/hashes.json` 80 条逐文件 sha256 | **80/80 匹配**（snapshot 66 + reference 14），0 missing |
| snapshot vs work（66 个同名文件） | 仅 `run/v1/qa-report.json` 不同（预期：FA-02/FA-04 写回）；site/pack/config 字节相同 |
| snapshot / reference 可写性 | 各 **0** 个可写条目（`chmod -R a-w` 仍生效） |
| `materials.json` 44 条材料 sha256 | **44/44 匹配**（17 源 + 27 生成） |
| `evidence.json` 36 条文件 sha256 | **36/36 匹配** |
| `delivery` 重算 | `QAReportSchema` parse 通过；`deliveryVerdictOf(checks)=pass`；`mapPlaytest=pass/SUCCESS`；`deliverySummaryOf=pass` |
| 继承视觉证据身份 | `review-record.subject` / `materials.subject` / `capture.subject` 与 `pack/v1 · site/v1 · shell 2`、manifest `a162942d…feb3`、config `455d9c7f…7dcd` 一致；`delivery.visualReview` 的 reviewer/time 与记录一致 |

本次**没有**重跑 `pnpm test:playtest`、`.scratch/fpvs-v1-final/runs/.../consistency.mjs` 或任何真实浏览器命令：
它们会写已跟踪的 self-test 目录或重写历史 consistency 文件，超出只读审计边界。FA-06 已记录这些命令的
exit 0 与隔离/恢复哈希（`runs/2026-10-28-regression-closure/`）。

---

## 1. §1 问题基线复核：哪些已过时

| §1 断言（`docs/v7.6/验证.md:20-30`） | 当前事实 | 判定 |
|---|---|---|
| `delivery.playtest` 只有在自动试玩结果为 `SUCCESS` 时才通过（:22） | `mapPlaytest` 明确：`SUCCESS→pass`、`GAMEPLAY_FAILURE→fail`、`ENVIRONMENT_FAILURE→blocked`、`TIMEOUT/AGENT_LIMITATION/UNKNOWN→incomplete`（`packages/contracts/src/playtest.ts:483-509`）；这是 playtest-v1 的既定映射，不是缺陷 | **仍然成立，但属设计而非 bug** |
| FA-01B 的 gate-stop 已修复（:23） | `targetReached` 改为“玩家右边界进入 gate 盒 + 垂直重叠”（`policy.mjs:262-274`）；observer 用同一判据（`observe.mjs:130-131`）；测试 `observe.test.mjs:137-143`；FA-02 真实 `win` 事件 | **已修复，成立** |
| 危险躲避仍是当前主要阻塞项（:24） | 对**冻结 wasteland Demo 的横向巡逻**已不成立：FA-02 真实按键 `SUCCESS`（`won=true`、collected 6、0 reset）；但**通用性**仍是缺口（`dangers`、`axis:"y"`、无进展终止） | **部分过时**：该 Demo 已通关；通用策略仍阻塞 |
| 自动试玩曾推进到 `x=813` 后 24 次重置（:25） | 当前保留的失败迭代是 `x=438` / 19 reset / 3138 步（`runs/2026-10-28-acceptance/harness-1/attempt-v1/result.json`）；`x=813` 只出现在历史 trace / 旧 map 叙述中 | **历史叙述，不可作为当前基线** |
| 即使不能完成也必须保留真实证据并诚实报告（:26） | `result.json` / `events.jsonl` / `trace.jsonl` / `input.jsonl` / console/exceptions 全部落盘；失败迭代 harness-1 保留；写回失败另有 `writeback-error.json` | **成立** |

补充：`§7.3` 列了 7 个人工审核项（风格/角色/场景/可读性/动画/玩法-视觉对应/整体完成度），
而 FA-04 继承的审核记录是 FR-04/P0-06 的 **6 项**（整体风格/色彩/角色/场景/关键物件/运行效果）。
这套 6 项不等于 §7.3 的 7 项；见 §8 的继承结论与 §11 的未决问题。

---

## 2. §5.5（P0-1，8 条）

| # | 验收标准（`验证.md:174-181`） | 判定 | E1 源码 | E2 测试 | E3 真实产物 |
|---|---|---|---|---|---|
| 5.5-1 | 危险区域不再无条件持续向右推进 | **PARTIAL** | `policy.mjs:217-259` 只从 `st.hazards` 构造 `patrolling`；`hazardModel` 明确拒绝 `axis!=="x"`（`:54-55`）；`dangers` 从未被策略读取（仅 `observe.mjs:17,104-109` 观测）；唯一 `advance:false` 在横向巡逻带前的 `:250`；无匹配分支一律 `advance:true`（`:253-254,257-258`）。执行层见 `runner.mjs:164-175` | `policy.test.mjs:64-91`（横向等待/跨越）；`:46-49`（`axis:"y"` ⇒ null）；**无 dangers 测试** | 冻结 Demo 配置只有 2 只 `axis:"x"` hazard、0 个 danger（`site/v1/game-config.json:48,55,103,110`）；FA-02 输入时间线见 `runs/2026-10-28-acceptance/README.md` §4 |
| 5.5-2 | 必要时等待，条件变化后重新评估 + 有限等待 | **PARTIAL** | 等待/重评估存在：`decide` 每观测步重算（`policy.mjs:238-251`），`runner.mjs:164-173` 每步调用并松开/恢复右键；但等待没有独立上限，只有场景 `deadline`（`runner.mjs:164,175`），终止条件只有 `won`/`collected`（`policy.mjs:277-282`） | `policy.test.mjs:71-78`（远离时 advance:false）、`:80-91`（窗口内前进+起跳）；**无等待上限测试** | FA-02 `input.jsonl`：patroller-1 前 `keyUp ArrowRight @3103ms` → `keyDown @4707ms`（1.60s 等待）；无“等待超限”样本 |
| 5.5-3 | 跳跃动作有实际状态变化作为证据，而非仅记录已发送输入 | **PARTIAL** | 证据层已有状态差：`observe.mjs:111-112` 由 `onFloor` 边沿推断 `jump`/`land`（`inferred:true`）；输入另存 `runner.mjs:101-117,296-301`。但动作层仍以“已发键”为准：`policy.mjs:49` 的 `markJump` 在发键时调用（`runner.mjs:172`），冷却按步数（`policy.mjs:16,170`），**不校验本次跳跃是否真的离地**；`actions[]` 无“观察到跳跃”字段（`contracts/playtest.ts:214-219`） | `observe.test.mjs:23-51`（jump/land 推断）；policy 测试无“跳跃未发生不得无限重复”用例 | FA-02：Space 9 次、`jump` 9、`land` 9（`result.json` eventCounts；`README.md` §4） |
| 5.5-4 | `pickupAbove` 等目标关系不盲目追逐，且不绕过必需目标 | **NOT MET** | `shouldJump` 对任何前方 <130px、上方 >20px 的 active pickup 直接返回 true（`policy.mjs:200-203`）；没有可达性/平台几何判据。`jumpPredictionSafe` 只在近危险物时抑制（`:135-137`），且只在 `decide` 的危险分支被调用（`:241,253,257`）；无障碍区不会抑制 | `policy.test.mjs:93-102` 只测“危险物在前时”的抑制；**无障碍区不可达 pickup 无测试** | 冻结 Demo 的 scrap-2 在可见平台上方，可达；没有“不可达高处 pickup”样本 |
| 5.5-5 | 连续无进展和重复重置能触发有限终止 | **NOT MET** | `noteObservation` 只累计 `stuckSteps` / 清 `crossing`（`policy.mjs:38-47`），`decide` 不据此停止；`runner.mjs:169,175` 仅在目标/终止条件/deadline 结束；CLI 的 `stuck` 是**事后归因输入**（`cli/playtest.ts:251`），不落盘、不终止；`termination` 闭集只有 `won/collected/never`（`contracts/playtest.ts:372-375`） | 无“连续无进展触发终止”或“重复重置触发终止”测试 | harness-1：19 reset / 3138 步，仍由 `move_to` action timeout 结束（`runs/2026-10-28-acceptance/harness-1/attempt-v1/result.json`），不是由 no-progress 规则结束 |
| 5.5-6 | 终止原因、最后状态、动作轨迹可追溯 | **MET** | `runner.mjs:274-304` 场景报告含 `execution`/`terminationReached`/`actions[]`/`endState`/`eventCounts`/`evidence`；`:296-303` 写 `events.jsonl`、`trace.jsonl`、`input.jsonl`、console/exceptions，`runReport` 在 `:416` 写 attempt 的 `result.json`，CLI 在 finalDir 写归因后的 `result.json`（`cli/playtest.ts:398`）；schema `contracts/playtest.ts:190-246`；`outcome` + `insufficientEvidence` 在 `:231-237` | `scenarios.test.mjs`、`observe.test.mjs:63-126`、`playtest.test.ts:203-209`（UNKNOWN 必须有结构化缺口） | FA-02 v2 `result.json` + `acceptance-win-wasteland-v1/{events,trace,input,console,exceptions}`；harness-1 失败样本保留。caveat：没有独立 `termination.reason` 字符串，原因需由 `outcome`/`insufficientEvidence` + `actions[].outcome` 组合读出 |
| 5.5-7 | 现有确定性场景测试仍然通过 | **MET** | 本次审计未改代码；`git diff 5b8283f..HEAD -- packages` 为空 | 本审计 `pnpm test` 2160/145 exit 0；定向 169/13 exit 0；FA-06 `regression.json` 2160/145 | FA-06 `regression/test.exit` = 0；`typecheck.exit` = 0 |
| 5.5-8 | 不需要修改游戏生成协议、游戏配置契约或 Runtime | **MET** | FA-02 的策略改动只在 `packages/demo/probe/playtest/{policy,runner,observe}.mjs`、`probe-harness.mjs` 与 CLI `--scenario-dir`（`git show --stat 5b8283f -- packages`）；`packages/contracts/src`、`packages/demo/src`、`packages/mcp/src` 未改 | 既有测试全绿 | FA-06 `precheck.json`：`contractsSrcChanges=[]`、`mcpSrcChanges=[]`、`depsChanges=[]`。caveat：实现 dangers 需要 Q7(b) 的 `READ_STATE` 只读加字段，仍属 probe 观测层，不改游戏协议/配置/Runtime |

**§5.5 计数：3 MET / 3 PARTIAL / 2 NOT MET。**
（对已知起点的修正：先前把 5.5-1 的“dangers 不支持”和“axis:y 不支持”当成两条 PARTIAL，
按验收条目应合并为 5.5-1 一条；5.5-3 的“跳跃只记录已发键”也不准确 —— 证据层已有状态差推理，
缺的是动作级校验与重试上限。详见 §9。）

> 5.5-3 的判定边界：若只按“证据层是否记录状态差”读，可判 MET；本表判 PARTIAL，是因为
> 动作/决策层仍以“已发键”为准，且 §5.3B 明确要求“未观察到预期状态变化时，不得无限重复同一跳跃动作”。
> 这一区分正是 05 号票要补的内容。

---

## 3. §6.6（P0-2，8 条）

| # | 验收标准（`验证.md:274-281`） | 判定 | E1 源码 | E2 测试 | E3 真实产物与 caveat |
|---|---|---|---|---|---|
| 6.6-1 | 每次执行均可定位到对应的版本化试玩目录 | **MET** | `cli/playtest.ts:178-186` `nextAttemptVersion`（max+1）；`:367` 取 `v<k>`；`:397-399` 最终 `rename` 到 `run/v<N>/playtest/v<k>`；harness 每次 `attempt-v<i>` 新目录（`runner.mjs:407-418`） | 无直接单测覆盖 `nextAttemptVersion`（见 caveat） | `work/.../run/v1/playtest/v1`、`v2` 并存；另有 `rejections/`。caveat：该点目前靠 E1+E3，缺 E2 |
| 6.6-2 | 可区分未执行、已执行但未完成、成功完成 | **MET** | `PlaytestExecutionSchema`（executed / not-executed+reason）与五态 outcome 分离（`contracts/playtest.ts:25-39`）；`mapPlaytest` 五态映射（`:483-509`） | `playtest.test.ts:112-127`“没有报告=blocked；未执行=blocked+not-executed”“五态映射”；`playtest-attribution.test.ts:111-153`（prepare/boot/not-executed/TIMEOUT/UNKNOWN） | FA-02 `SUCCESS`；harness-1 已执行未完成；env/hang 条件场景 |
| 6.6-3 | 关键结果能追溯到真实观测 | **MET** | `observe.mjs:71-135` 从 `READ_STATE` 状态差推导 11 类事件；`:211-233` `endState`/`initialState` 由观测计算；`runner.mjs:296-303` 落盘 trace/events/input | `observe.test.mjs:23-61`（事件推导）、`:63-126`（三值/否定可判） | FA-02 v2 的 events/trace/input 与 `won/collected/reset` 一致；caveat：`jump/land/spawn` 标 `inferred:true`，轮询间隙标 `poll-gap` / `ambiguous:true`，不冒充实测 |
| 6.6-4 | 环境失败、执行器能力不足、游戏失败可区分 | **MET** | `playtest-attribution.ts:90-177` 阶段化 + 环境健康前置门 + 正面证据门槛；`TIMEOUT/AGENT_LIMITATION/UNKNOWN` 分别定义（`:159-176`） | `playtest-attribution.test.ts:37-109`（五态、环境优先、runtime-error 来源、超时 vs 不可判）、`:111-153`（not-executed/boot） | FA-03 对 harness-1 的归因 = `AGENT_LIMITATION`（raw harness-1 是未归因观测报告）；`env-no-chrome` 场景声明 `expectedOutcome=ENVIRONMENT_FAILURE`，归因单测覆盖；FA-03 attribution 21/21 |
| 6.6-5 | 身份漂移时拒绝写回错误的 Demo | **MET** | `applyPlaytest` 校验 pack id/version、site version、shell（`contracts/delivery.ts:317-345`）；`writePlaytestToReport` 再校验 config checksum 与 pack checksum（`pipeline/playtest.ts:51-62`）；CLI 准备阶段校验 site.json/shell/pack/manifest/config（`cli/playtest.ts:106-158`） | `playtest.test.ts:298-324`（site/pack/shell/无 site 拒写）；`pipeline/playtest.test.ts:112-126`（site/config checksum 拒写） | FA-02 身份三方一致（`identity.three-way`）；caveat：身份粒度是 pack checksum + config checksum + site version + shell；site 的 `index.html`/`shell.js` 原始字节没有存进 delivery 身份，只在同 attempt 内以 `site-integrity.json` 证明前后未变 |
| 6.6-6 | 结果写回失败不会留下伪造的成功状态 | **MET** | `pipeline/playtest.ts:66-74` 先写 `.tmp` 再 `rename`；失败删 tmp、原文件不动；`:79-95` 单独写 `writeback-error.json`；CLI exit 1（`cli/playtest.ts:402-414`） | `pipeline/playtest.test.ts:127-136`“写回失败留独立诊断记录，不改 result.json”；`:112-120`“身份不匹配 ⇒ qa-report 不变” | 失败 attempt 保留 `writeback-error.json`；caveat：写回失败会保留**上一次**的 delivery 状态（可能是旧 pass），但不会写入新的成功状态，且有 attempt 证据 + exit 1 |
| 6.6-7 | 原有 `delivery.checks.playable-smoke` 消费方不发生不必要的 schema 破坏 | **MET** | check key 保留为 `playable-smoke`（`contracts/delivery.ts:79-101`）；`delivery.playtest` 为可选摘要（`:158-159`），旧报告可解析；不变量在 `:196-228` | `playtest.test.ts:210-260`“旧报告没有 playtest 仍可解析”“历史阶段C：visual pass + playable-smoke incomplete ⇒ 仍 incomplete”；`delivery.test.ts:203-260` | 旧 qa-report 仍可读：`runs/2026-10-27-acceptance/acceptance.json` 的 `legacyReport`（旧 smoke incomplete，未升级） |
| 6.6-8 | 不自动创建基准，不覆盖既有版本目录 | **MET** | 基线只能显式晋升：`pipeline/playtest-baseline.ts:29-89`；已存在默认拒绝（`:83-84`）；`baselineFor` 只读（`cli/playtest.ts:269-282`）；attempt 目录 max+1（`:178-186`） | `pipeline/playtest-baseline.test.ts:49-107`（两次干净运行/身份不一致拒绝/阈值不放宽/已存在默认拒绝+`--replace`） | `run/v1/playtest/v1` 与 `v2` 并存，未覆盖；FA-06 postcheck 快照/参考 0 变化。caveat：直接复用同一个 harness `--out` 会重写 `attempt-v<i>`（`runner.mjs:407-418` 用 `recursive:true` 后写同名文件）；CLI 的 `run/playtest/v<k>` 路径不会复用 |

**§6.6 计数：8/8 MET。** 两个实现级 caveat：6.6-1 缺直接单测；6.6-5 的 identity 粒度不包含 site 原始字节。
两者都不推翻验收，但应在 07 的最终报告中作为限制/测试补齐项记录。

---

## 4. §7.5（P0-3，6 条）

| # | 验收标准（`验证.md:334-339`） | 判定 | E1 源码 | E2 测试 | E3 真实产物 |
|---|---|---|---|---|---|
| 7.5-1 | 人工审核针对确定版本的最终 Demo | **PARTIAL** | 历史 FA-04 记录绑定明确：`review-record.json:7-12`（packId/version/siteVersion/shellVersion/manifestChecksum/configChecksum）；`materials.subject` 核心身份字段一致（另含 `siteJson`）；`capture.subject` 核心字段一致；但**产品写入路径不绑定**：`DeliveryVisualReviewSchema` 只有 status/reviewer/reviewedAt/note（`contracts/delivery.ts:116-122`）；`review-verdict` 只吃 runDir/qa-report/verdict/reviewer/note（`cli/cli.ts:780-816`），且不强制 runDir 位于 `--out` 根内（未调用 `requireUnder`，对比 `playtest` 的 `cli/playtest.ts:47-52,110`） | `review-verdict.test.ts:48-96` 只校验 runDir 形状、qa-report 存在、verdict 合法、跨 run 不继承；**不校验 review-record** | FA-04 `review-record.json` / `materials.json` / `capture.json` 三处 subject 与 pack/v1·site/v1·shell 2 一致；`delivery.visualReview` 的 reviewer/time 与记录一致。即：**历史记录满足，产品机制不保证** |
| 7.5-2 | 审核结果可追溯到具体版本 | **PARTIAL** | `delivery.visualReview` 不含 subject/version/checksum；`applyVisualReview` 原样保留 `delivery.evidence`（`contracts/delivery.ts:293-305`），而视觉 review **没有结构化 evidence ref**；`writeVisualReviewToReport` 只改视觉三处（`pipeline/delivery.ts:153-170`）；note 里的路径是自由文本 | `review-verdict.test.ts` 无记录绑定测试；`contracts/tests/delivery.test.ts:262-301` 只测“只动三处” | FA-04 记录可追溯到具体版本（subject + materials + capture）；FA-05 `qa-report.json` 的 `delivery.evidence` 只含 playtest refs（8 条），**不含 review-record/materials**；视觉结论只能靠 note 中的“见 runs/2026-10-28-visual-review/”与外部 `evidence.json` |
| 7.5-3 | 可以明确记录通过、不通过或证据不足 | **PARTIAL** | 三态是 `pending/pass/fail`（`contracts/delivery.ts:110-122`）；`pending` 表示未评审，不是“已评审但证据不足”；CLI 只接受 `pass/fail`（`cli/cli.ts:793-795`） | `delivery.test.ts:262-266`（pending→incomplete、pass→pass、fail→fail）；`review-verdict.test.ts:81-86`（`--verdict pending` ⇒ exit 2） | FA-04 README §5 约定“无法确认 ⇒ 保持 pending + 最终报告记 incomplete”，但没有机器可读的“insufficient”结论字段 |
| 7.5-4 | 视觉审核不能覆盖自动试玩失败 | **MET** | `applyVisualReview` 只动 `visualReview` + `visual-review` 检查项，`playtest` 原样保留（`contracts/delivery.ts:293-305`）；verdict 由全部必需检查重算（`deriveDeliveryVerdict:46-56`） | `playtest.test.ts:251-256`“applyVisualReview 保留 playtest 摘要（只动视觉三处）”；`playtest.test.ts:287-296`（GAMEPLAY_FAILURE ⇒ fail）；`delivery.test.ts:58-61` 矩阵 I（visual fail ⇒ fail） | FA-04 visual pass 与 FA-02 playable-smoke pass 并存；未见“playtest fail + visual pass”的真实样本，但代码与矩阵覆盖该方向 |
| 7.5-5 | 自动试玩成功也不能自动视为视觉审核通过 | **MET** | `visualReview` 默认 `pending`（`contracts/delivery.ts:267`）；`pending→incomplete`（`visualReviewToCheck:282-285`）；`applyPlaytest` 保留 visual（`:348`） | `delivery.test.ts:46-57`（F/G/H：试玩未完成/视觉待确认 ⇒ incomplete）、`:239-257`（历史 visual pass + playtest incomplete 仍 incomplete） | FA-02 写回后的 `verdict=incomplete`（visual pending），见 `runs/2026-10-28-acceptance/README.md`；直到 FA-04 才变 pass |
| 7.5-6 | 机器可测量指标和人工判断明确分离 | **MET** | QA 层机器观察 vs `delivery.visualReview` 人工结论分属两层；`visual-review` 检查项只由视觉写回改（`pipeline/delivery.ts:153-170`）；`qa` 检查项独立（`contracts/delivery.ts:65-101`） | `delivery.test.ts` 视觉三态/检查项测试；`pipeline/tests/delivery-integration.test.ts` 站点成功→视觉 pass→仍 incomplete（试玩没做完） | FA-05 §2 明确“视觉 QA `unavailable`，由 FA-04 人工审核补足，不替代”；`materials.json.existingVisualQa` 保留机器观察与 2 条 warning |

**§7.5 计数：3 MET / 3 PARTIAL。** 核心记录性缺口：**审核记录 → delivery 的身份绑定只在 effort 产物里，
不在产品读取路径里**；视觉结论没有结构化 evidence ref；`insufficient` 没有独立状态。

---

## 5. §8.4（P0-4，6 条）

| # | 验收标准（`验证.md:380-385`） | 判定 | E1 源码 | E2 测试 | E3 真实产物与 caveat |
|---|---|---|---|---|---|
| 8.4-1 | 最终报告能说明 Demo 是否达标及原因 | **MET** | `deliverySummaryOf` 从 `delivery.verdict` 渲染结论行 + fail/blocked/incomplete 明细（`pipeline/delivery.ts:216-252`）；verdict 由 `deriveDeliveryVerdict` 确定性计算（`contracts/delivery.ts:46-56`） | `consistency.mjs` 的 `verdict.deterministic` / `summary.shared-by-cli-and-mcp`（FA-05 12/12） | `final-acceptance.md:3-13`（结论 pass）、`:126-159`（六项检查 + 四类语义）；本审计重算 `deliverySummaryOf=pass` |
| 8.4-2 | 每个结论均可追溯到对应证据 | **PARTIAL** | `DeliveryEvidenceSchema` 只有 `ref` + `path`（`contracts/delivery.ts:124-130`）；产品读取路径不重算哈希：`pipeline/playtest.ts:44-49` 只 `existsSync`；`consistency.mjs:137-140` 只检查路径存在；视觉结论无 evidence ref（见 7.5-2） | 无“证据文件被改动 ⇒ 拒绝/告警”的测试 | FA-05 `evidence.json` 36 文件哈希 **36/36** 匹配（effort 层补了产品缺口）；但产品 `delivery.evidence` 本身仍是 path-only；caveat：外部 effort 脚本能补，不等于产品读取路径已加固（map Q8(b)） |
| 8.4-3 | 自动试玩和视觉审核结果相互独立 | **MET** | `applyPlaytest` 只改 playable-smoke/summary/verdict，保留 visual（`contracts/delivery.ts:317-352`）；`applyVisualReview` 只改视觉三处，保留 playtest（`:293-305`） | `playtest.test.ts:251-256,275-286`；`delivery-integration.test.ts:75-100`（视觉 pass 后仍受试玩约束） | FA-05 同一 qa-report 同时承载两者；FA-04/FA-02 独立产物 |
| 8.4-4 | 环境阻塞和证据不足不会被误判为成功 | **MET** | `mapPlaytest`：ENVIRONMENT_FAILURE→blocked，TIMEOUT/AGENT_LIMITATION/UNKNOWN→incomplete（`contracts/playtest.ts:483-509`）；`deriveDeliveryVerdict` 优先级 fail>blocked>incomplete>pass | `playtest.test.ts:112-150`；`playtest-attribution.test.ts:88-109`（超时 vs 不可判；UNKNOWN 优先）；`delivery.test.ts:25-107` | FA-05 `consistency.json → no-missing-evidence-defaults-pass`；`mapPlaytest(undefined)=blocked`、`visualReviewToCheck(pending)=incomplete`、`deliverySummaryOf(undefined)=null` |
| 8.4-5 | 最终结论不依赖人工修改中间 JSON | **MET** | verdict 由 `buildDeliveryReport`/`applyPlaytest`/`applyVisualReview` 统一重算（`contracts/delivery.ts:259-272,293-352`）；`DeliveryReportSchema` 的 superRefine 拒绝 verdict 与 checks 不一致（`:181-187`） | `delivery.test.ts:168-178`“verdict 与检查项不一致 → 拒”；`buildDeliveryReport` 测试 `:180-201` | FA-05 `consistency.json → verdict.deterministic`；本审计重算一致。caveat：qa-report 是普通 JSON，没有签名/防篡改；这里说的是“结论由工具计算”，不是“不可伪造” |
| 8.4-6 | 不通过放宽规则、忽略失败或改写结果追求通过率 | **MET** | 契约不变量 + 必需检查注册表（`contracts/delivery.ts:99-101,164-230`）；失败样本保留；无阈值放宽 | 全仓 2160/145 绿；FA-06 `precheck.json`：无测试删除、无契约/MCP/依赖变更 | FA-06 postcheck：快照/参考 0 变化；`regression.json` 四条命令 exit 0；harness-1 失败与历史 `AGENT_LIMITATION` 未删除 |

**§8.4 计数：5 MET / 1 PARTIAL。** 唯一 PARTIAL 是 8.4-2：结论可按路径找到文件，但产品路径不校验证据字节；
视觉结论连路径 ref 都没有（只有自由文本 note）。FA-05 的外部 `evidence.json` 36/36 哈希是继承时的重要补强，
但它属于 effort 脚本，不是产品行为。

---

## 6. §9 测试计划

### 9.1 自动化测试：**PARTIAL**

| 要求（`验证.md:391-401`） | 现状 | 判定 |
|---|---|---|
| 至少覆盖 `success-basic` / `failure-missing-pickup` / `limitation-wide-patrol` / `env-no-chrome` / `timeout-hang` | 5 个场景文件齐全：`packages/demo/probe/playtest/scenarios/five-state/*.json`；harness 默认目录就是它（`playtest.mjs:17`）；但自动化里只有 `failure-missing-pickup` 被 self-test 真实执行（`self-test.mjs:47-75`），`input-blocked` 也是 self-test 专用；**没有一条测试把 5 个场景全部端到端跑一遍**。五态的“原因类别”由 attribution 单测覆盖（`playtest-attribution.test.ts:37-159`），不是场景执行 | **PARTIAL** |
| 针对通用策略补充危险处理和重复重置测试，优先确定性 fixture | 横向巡逻有确定性单测 + 离线物理闭环（`policy.test.mjs:34-62,64-121,124-172`）；**无 `axis:"y"` / dangers / 等待上限 / 无进展终止 / 重复重置终止的 fixture** | **PARTIAL** |
| 确定性、零付费 | policy/observe/scenarios 测试都是纯离线；本次定向 169/169 绿 | **MET（该子项）** |

### 9.2 回归测试：**MET**

- 本审计 `pnpm test`：145 files / 2160 tests pass，exit 0；`pnpm typecheck`：全部 Done，exit 0。
- 定向 playtest/delivery/CLI 测试：13 files / 169 tests pass，exit 0。
- FA-06 记录：`pnpm test` 2160/145、`pnpm typecheck` 0、`pnpm test:playtest` self-test 4/4 + 96/8、
  `pnpm test:acceptance` 免费闭环 allOk=true，四条 exit 0（`runs/2026-10-28-regression-closure/regression.json`，
  `regression/*.exit` 均为 0）。
- `playable-smoke` 兼容、身份漂移、原子写回、报告映射测试均在上述套件中（见 §3 的 E2）。
- 无新增依赖：FA-06 `precheck.json` `depsChanges=[]`；`git diff 5b8283f..HEAD -- package.json pnpm-lock.yaml` 为空。
- caveat：本次没有重跑 `pnpm test:playtest`（会覆盖已跟踪的 self-test 目录）；FA-06 的
  `self-test-isolation.json` 记录了覆盖 10 个 tracked 文件、复制新证据、`git restore` 后哈希与运行前一致。

### 9.3 真实 Demo 验证：**PARTIAL**

| 要求（`验证.md:411-423`） | 现状 | 判定 |
|---|---|---|
| 固定 Demo 上有限轮次真实浏览器试玩，保留每轮完整结果 | FA-02：harness-1 失败（19 reset / x=438）、harness-2 成功、harness-final `--repeat 2` 均保留；交付链 v1/v2 均保留；FA-04 capture 另跑一次并保留 9 个 shot 样本（`won=true`, collected 6, 0 reset）；3 轮上限内 | **MET（历史）** |
| 危险区域是否仍反复重置 | 冻结 Demo 的横向巡逻：最终 0 reset；失败迭代 19 reset 保留 | **MET（横向）** |
| 玩家能否推进 / 必需目标是否完成 / 是否由真实观测支持 | FA-02 `won=true`、collected 6、playerX 1371、`win`@17006ms；events/trace/input 真实按键 | **MET** |
| 人工浏览器试玩能否提供独立视觉材料 | FA-04 capture + 9 帧 + 材料包 | **MET** |
| 覆盖三类危险形态（Q3(a) 的横向/纵向/定时喷发） | 历史真实运行只覆盖**横向巡逻**；纵向与 dangers 没有真实或 fixture 证据；`dangers` 在冻结 Demo 中为 0 | **PARTIAL（通用性）** |

**§9 计数：9.1 PARTIAL / 9.2 MET / 9.3 PARTIAL。**

---

## 7. §12（DoD，8 条）

| # | DoD（`验证.md:455-462`） | 判定 | 证据 |
|---|---|---|---|
| 12-1 | 自动试玩策略具有有限、可解释的危险处理和无进展终止机制 | **NOT MET** | 5.5-1（dangers/axis y 未覆盖）、5.5-2（无等待上限）、5.5-5（无无进展/重置终止）均未满足；当前 `termination` 闭集无主动停止（`contracts/playtest.ts:372-375`）；02 号票已结论“不可表达”，08 号票待裁定 |
| 12-2 | 真实试玩证据能关联到确定版本的 Demo | **MET** | `PlaytestIdentitySchema`（`contracts/playtest.ts:156-170`）；FA-02 v2 result identity 与 delivery/identity.json 三方一致；`site-integrity.json` unchanged |
| 12-3 | 结果分类和写回符合现有 Playtest 契约 | **MET** | `attribute()` 五态 + `mapPlaytest` + `applyPlaytest` + `writePlaytestToReport`；E2 `playtest-attribution.test.ts`、`playtest.test.ts:264-344`、`pipeline/playtest.test.ts:88-145`；E3 FA-02 v2 |
| 12-4 | 关键测试和回归测试通过 | **MET** | 本审计 `pnpm test` 2160/145、`pnpm typecheck` exit 0；FA-06 `regression.json` 四条命令 exit 0 |
| 12-5 | 已对目标 Demo 进行真实试玩，且结果如实记录 | **MET** | FA-02 v2 `SUCCESS`（`won=true`, collected 6, 0 reset, 453 steps）；失败迭代 harness-1 保留；FA-04 capture 另一次真实运行 |
| 12-6 | 已对同一版本 Demo 完成视觉人工确认，或明确记录尚未完成及原因 | **MET（历史，带覆盖缺口）** | FA-04 `review-record.json` subject 与冻结版本一致；6/6 项 pass、problems=[]；`delivery.visualReview=pass`；但 6 项不等于 §7.3 的 7 项（见 §8/§11） |
| 12-7 | 最终验收报告给出有证据支持的结论 | **PARTIAL** | FA-05 `final-acceptance.md` 已给出 `pass`，且证据链（36/36 哈希）可核；但它是 FPVS-V1 Final Acceptance 的历史报告，未覆盖本轮 v7.6 §5.5 的通用性缺口；本 effort 的最终报告要到 07 才产出，且 P0-1 未闭合前不能声称全部达标 |
| 12-8 | 未通过伪造成功、忽略失败、放宽门禁或人工覆盖结果完成验收 | **MET** | FA-06 `precheck.json`：无测试删除/契约/MCP/依赖变更；`postcheck.json`：快照/参考 0 变化；失败样本/历史 AGENT_LIMITATION 未删除；`delivery` 不变量拒绝假绿 |

**§12 计数：6 MET / 1 PARTIAL / 1 NOT MET。**

---

## 8. 可继承的历史证据（身份 / 哈希 / 结论）

### 8.1 逐项

| 证据 | 绑定的身份 | 本次机械核验结果 | 继承结论 |
|---|---|---|---|
| **FA-04 视觉审核** `runs/2026-10-28-visual-review/review-record.json`（sha256 `a1602021720ed1a984913094eebff3a9b29ad5ef09f2ef7347c620ea0d93a0c1`） | pack `wasteland-scavenger-recipe` v1；site v1；shell `2`；manifest `a162942d…feb3`；config `455d9c7f…7dcd`；snapshot/work 路径；reviewer `人（本次会话用户）`；reviewedAt `2026-10-28T08:12:51.004Z`；overall `pass`；6/6 项 pass；problems `[]` | subject 的 manifest/config 与实际文件一致；`materials.subject` / `capture.subject` 的核心身份字段一致；`materials.json`（sha256 `060debc4…69af`）44/44 哈希匹配；`capture.json`（sha256 `8a27db7e…6f58`）subject 同、9 个 shot 文件齐全；`delivery.visualReview` 的 reviewer/reviewedAt/status 与记录一致 | **可继承**（针对这 6 项、这一冻结版本）。无需重审（字节未变）。但：① 产品 `review-verdict` 不校验记录身份，07 必须继续用 effort 脚本核验；② 6 项 ≠ §7.3 的 7 项（缺显式可读性/动画/玩法-视觉对应/整体完成度）；③ `shots/08-goal.png` 与 `09-final.png` 字节相同（`b5cbe0e7…`），“9 张”实为 8 个不同画面，报告措辞需注意 |
| **FA-05 最终报告 / verdict** `runs/2026-10-28-final-acceptance/{final-acceptance.md,qa-report.json,evidence.json,consistency.json}` | `qa-report.json` sha256 `dc20e301…5ee6`（与 work origin 逐字节相同）；`final-acceptance.md` `ec9c73a1…1ba4`；`evidence.json` `f38a57a2…7ba`；`consistency.json` `b1191e17…1cb`；subject pack/site/shell/checksums 同上；`delivery.verdict=pass`；6 checks 全 pass；playable-smoke `SUCCESS`；visual-review `pass` | `QAReportSchema` parse 通过；`deliveryVerdictOf=pass`；`mapPlaytest=pass/SUCCESS`；`deliverySummaryOf=pass`；`evidence.json` 36/36 文件哈希匹配；`consistency.json` 12/12（历史产物，本次未重写） | **可继承为“同一冻结对象的 delivery=pass”**；**不可继承为“v7.6 §5.5 通用策略已满足”**。它是历史结论，且其 `consistency.mjs` 不比对 review-record.subject 与 delivery；07 需重新聚合 + 披露限制。若任何 pack/site/config 字节变化，则不能继承 |
| **FA-06 回归** `runs/2026-10-28-regression-closure/regression.json`（sha256 `fa2c63e1…9873`） | HEAD 记录 `b4f03c2`（FA-06 在其后提交，内容仍指向同一快照）；四条命令 exit 0；2160/145；typecheck；self-test 4/4 + 96/8；acceptance allOk；`postcheck.json` `c2026d45…76a0` | 四条 `.exit` 均为 `0`；`precheck.json` 无契约/MCP/依赖变更、无删除；本次在 `ae339b9` 重跑 `pnpm test` 2160/145、`pnpm typecheck` exit 0；快照/参考 0 变化、work 仅 qa-report 变（本次复算一致） | **可继承为回归基线**；04/05 改动后必须重跑，不能沿用旧数字。当前 HEAD 已独立复核 |
| **FA-02 真实通关** `work/.../run/v1/playtest/v2/result.json`（sha256 `1826a5e1…d28c`） | identity pack/v1·site/v1·shell 2·`a162942d…`/`455d9c7f…`；`execution=executed`；`aggregate=SUCCESS`；`won=true`; collected 6; chests 2; reset 0; runtime-error 0; 453 steps | identity 与 delivery/identity.json 三方一致；`site-integrity.json`（sha256 `1e350ade…6c4f`）before/after 四文件哈希相同；事件计数与 FA-05 一致 | **可继承**为“冻结横向巡逻 Demo 的真实 SUCCESS”；**不可继承**为三类危险形态的通用证据 |
| **FA-02 失败迭代** `runs/2026-10-28-acceptance/harness-1/attempt-v1/result.json`（sha256 `22732606…664e`） | 同一 identity；19 reset；x=438；assertionAggregate fail；actions 含 timeout | 保留、未删除；无 outcome（未归因的观测报告） | **可继承为负样本/历史失败证据**；不可当当前能力或成功证据 |
| **历史参考 playtest-v1** `artifacts/reference/playtest-v1/attempt-v1/result.json`（sha256 `afe634d0…b616`） | 同一 identity；`AGENT_LIMITATION`；collected 3；reset 10；site-integrity unchanged | 80 条哈希中已包含；本次 80/80 匹配 | **仅作历史参考**；不可升级、不可当当前成功证据 |
| **冻结快照** `artifacts/wasteland-scavenger-recipe/` + `artifacts/reference/` | `hashes.json`（sha256 `c7330dc0…4988`）80 条；`identity.json`（sha256 `abf0047a…12ad`）；66 snapshot + 14 reference；snapshot chmod a-w | **80/80 匹配**；snapshot/reference 各 0 可写；work 66 同名文件中仅 `run/v1/qa-report.json` 不同 | **可继承为身份基线**；任何字节变化即失效 |

### 8.2 明确不可继承 / 必须重验

- **历史阶段 C 的 visual pass**：不可继承。FA-04 已明确“历史阶段C PASS 未继承”；产品测试也钉住
  “visual-review=pass 但 playable-smoke=incomplete ⇒ 读回仍 incomplete”（`packages/contracts/tests/delivery.test.ts:239-257`）。
- **FA-02 的 25.8px 净空读数**：不可继承。FA-05 §3.7 已改为可复现读数 18.75px（|dx|≤14）/ 6.25px（盒重叠）；
  25.8px 不可复现，不得写进本轮结论。
- **`x=813` / 24 reset 的旧叙述**：不可作为当前基线；当前保留的失败样本是 x=438 / 19 reset。
- **FA-04 的 6 项审核对 §7.3 的 7 项**：不能直接当作 §7.3 全覆盖；需要补审或给出逐项映射。
- **任何 pack/site/config/qa-report 字节变化**：FA-04 视觉 pass 与 FA-05 delivery pass 均失效，必须重审/重聚合。
- **纵向巡逻 / 定时喷发**：没有历史真实证据（冻结 Demo 0 danger、0 axis:y）；只能用确定性 fixture + 本轮一次真实 Demo 运行补足；不能从 FA-02/FA-04 继承。

### 8.3 判定摘要（可继承 / 需重验 / 不可继承）

- **可继承（无需重审）**：FA-04 的 6 项视觉结论（身份 + 44/44 材料哈希 + delivery reviewer/time 一致）；
  FA-05 的 `delivery=pass`（同一冻结对象、qa-report 字节相同、36/36 证据哈希）；
  FA-06 的回归基线；冻结快照/参考与身份（80/80 哈希、只读）。
- **需重验（条件或后续）**：FA-05 作为**本轮 v7.6 最终结论**（07 必须重新聚合，不能直接复用历史 `pass`）；
  FA-06 回归（04/05 改动后必须重跑）；FA-04 若任何 pack/site/config/qa-report 字节变化（必须重审）；
  任何把 6 项视觉结论扩大解释为 §7.3 的 7 项（需要补审或逐项映射）。
- **不可继承**：历史阶段 C 的 visual pass；FA-02 的 25.8px 净空；`x=813`/24 reset 的旧叙述；
  纵向巡逻/定时喷发（无历史真实证据）；任何身份或字节漂移后的 FA-04/FA-05。

---

## 9. 对已知起点的逐条复核（含修正）

| 已知起点 | 复核结果 |
|---|---|
| “§6.6 8/8 基本满足” | **确认 8/8 MET**。补两条 caveat：6.6-1（版本化目录）缺直接单测；6.6-6 写回失败会保留旧状态（不伪造新成功）。 |
| “§5.5 2 项未满足（pickupAbove 无条件追逐、无无进展/重复重置终止）” | **确认** 5.5-4 / 5.5-5 = NOT MET。 |
| “§5.5 4 项部分满足（dangers 不支持、axis:y 不支持、jump 只记录已发键、wait 无独立上限），2 项满足” | **部分修正**：按验收条目应为 **3 PARTIAL / 2 NOT MET / 3 MET**。`dangers` 与 `axis:y` 同属 5.5-1，不应拆成两条；5.5-3 不是“只记录已发键”——`observe.mjs:111-112` 已从 `onFloor` 边沿推断 `jump/land`，真正的缺口是**动作层不校验本次跳跃是否产生状态变化、也不因失败停止重试**。5.5-6/7/8 = MET。 |
| “`policy.mjs` 不读 `dangers`” | **确认**：策略只读 `st.hazards`；`dangers` 只在 `observe.mjs:17,104-109` 被观测。 |
| “`hazardModel` 只接受 `axis:"x"`” | **确认**：`policy.mjs:55` 直接返回 null；测试 `policy.test.mjs:46-49`。 |
| “跳跃只记录已发键” | **修正见上**：证据层有状态差事件；动作层仍以 `markJump` + 步数冷却为准（`policy.mjs:49,16,170`），没有单次跳跃验证/失败上限。 |
| “等待无独立上限” | **确认**：等待持续到场景 `deadline`（`runner.mjs:164,175`）；`wait_until` 的 `timeoutMs` 只约束 `won/collected` 等待，不是策略等待的上限。 |
| “§7.5/§8.4 记录性缺口：review-verdict 不校验审核记录身份；delivery.evidence 只存路径、读取不重算哈希；consistency.mjs 未比对 review-record.subject 与 delivery” | **全部确认**。补一条更具体的：视觉评审写回**没有向 `delivery.evidence` 添加任何 ref**（`applyVisualReview` 原样保留 evidence，`contracts/delivery.ts:293-305`；`writeVisualReviewToReport` 只改视觉三处，`pipeline/delivery.ts:153-170`），因此视觉结论连“路径 ref”都没有，只有 `note` 自由文本。 |
| “冻结 wasteland Demo 有两只 x 轴 hazard、0 个 danger” | **确认**：`site/v1/game-config.json:48,55,103,110` 两只 `kind:hazard` + `motion.axis:"x"`；全文无 `kind:"danger"`。 |
| “FA-02 真实 SUCCESS（won=true、collected=6、0 reset）” | **确认**：`run/v1/playtest/v2/result.json`，`aggregate=SUCCESS`、`endState.won=true`、`collected=6`、`eventCounts.reset=0`、453 steps；`site-integrity.unchanged=true`。 |
| “FA-05/06 delivery.verdict=pass” | **确认**：当前 `qa-report.delivery.verdict=pass`；本审计重算 `deriveDeliveryVerdict=pass`；FA-06 `postcheck.verdict=pass`、consistency 12/12。 |
| “领域陷阱：`periodMs` 是安全窗口、`activeMs` 是喷发、完整周期相加；`d.t` 毫秒累计、命中不复位、重载归零” | **确认**：`packages/demo/src/hazard.ts:24-32`（`const cycle = periodMs + activeMs; phase < periodMs ? "idle" : "active"`）；`scene.ts:286-287`（`d.t += delta; dangerState(d.periodMs, d.activeMs, d.t)`）；`scene.ts:352-359` `hitHazard()` 只复位玩家，不动 `d.t`；`scene.ts:185-193` 初始化 `t: 0`，页面重载重建场景即归零。注意：`d.t` 在 `scene.ts`，不在 `hazard.ts`。当前 `READ_STATE` 的 dangers 只有 `{x,y,state,hits}`（`probe-harness.mjs:242`），**没有**盒足迹/`periodMs`/`activeMs`/`t`；Q7(b) 的只读扩展尚未实现。 |

---

## 10. 差距清单（供 03 分诊）

### A. P0-1 策略缺口（需要 04/05/08）

1. **`dangers` 不被策略读取**：`policy.mjs` 无 `st.dangers`；当前观测面只有 `{x,y,state,hits}`，
   缺盒足迹、`periodMs`、`activeMs`、`t`（`probe-harness.mjs:242`）。冻结 Demo 0 danger，历史真实证据不覆盖。
2. **纵向巡逻不支持**：`hazardModel` 拒绝 `axis!=="x"`（`policy.mjs:54-55`）；无纵向等待/窗口/跳跃交互判据。
3. **`pickupAbove` 无条件**：`policy.mjs:200-203`；只在横向巡逻附近被 `jumpPredictionSafe` 抑制。
4. **无进展/重复重置不终止**：`stuckSteps` 只用于跳跃触发（`policy.mjs:38-47,176,203`）；
   `cli/playtest.ts:251` 的 `stuck` 是事后归因；`termination` 闭集无 stop（`contracts/playtest.ts:372-375`）。
5. **等待无独立上限**：等待只受场景 deadline 约束（`runner.mjs:164,175`）。
6. **跳跃动作级验证缺失**：`markJump` 在发键时调用（`policy.mjs:49`），无“本次跳跃是否离地”的校验/失败上限。
7. **契约表达缺口**：02 号票结论 **NOT EXPRESSIBLE**；需要 08 号票批准最小 `stop?` 增量，或由 03 裁定降级表达。

### B. 记录/证据缺口（07 必须披露；本轮不改产品路径）

8. **review-record → delivery 身份未绑定**：`review-verdict` 不读审核记录（`cli/cli.ts:780-816`）；
   `DeliveryVisualReviewSchema` 无 subject/version（`contracts/delivery.ts:116-122`）；
   `consistency.mjs` 没有 review-record.subject 检查（42-165 的 12 项里没有）。
9. **视觉结论无结构化 evidence ref**：`applyVisualReview` 保留 evidence 原样（`contracts/delivery.ts:293-305`）；
   FA-05 `qa-report.delivery.evidence` 只有 8 条 playtest refs，没有 review-record/materials。
10. **`delivery.evidence` 只存 `ref`+`path`**（`contracts/delivery.ts:124-130`）；写回只 `existsSync`
    （`pipeline/playtest.ts:44-49`）；`consistency.mjs:137-140` 只查存在。FA-05 的 `evidence.json` 36/36
    哈希在 effort 层补足，但不是产品读取路径。
11. **“证据不足”无独立机器状态**：三态 `pending/pass/fail`（`contracts/delivery.ts:110-122`），
    `pending` 与“已评审但证据不足”不可区分；CLI 只接受 `pass/fail`（`cli/cli.ts:793-795`）。

### C. 测试/覆盖缺口（04/05 补）

12. **无 dangers / axis:y / 等待上限 / 无进展 / 重复重置的确定性测试**；`policy.test.mjs` 只有横向巡逻。
13. **五态场景没有全量 E2E**：5 个 JSON 齐全，但自动化只真实执行 `failure-missing-pickup`（self-test）
    和 `success-basic`（`.scratch/playtest-v1/runs/2026-10-27-acceptance` 的交付链）；`limitation-wide-patrol` / `env-no-chrome` / `timeout-hang` 由归因单测
    覆盖原因类别，不是场景端到端。
14. **§7.3 七项 vs FA-04 六项**：继承审核的 6 项未显式覆盖可读性/动画/玩法-视觉对应/整体完成度。

### D. 基线叙述

15. **§1 部分过时**：FA-02 已真实 SUCCESS、FA-05/06 已 pass；`x=813/24 reset` 不可复现；
    “danger 仍是主要阻塞”只对通用性成立，对冻结 Demo 不成立。

---

## 11. 未决问题（交 03 裁定）

1. **最终 verdict 的口径**：继承的 FA-05 `pass` 只覆盖 delivery/试玩/视觉维度，不覆盖 v7.6 §5.5 的通用性。
   本轮最终结论应是 `pass`（继承 + 新证据全绿）、`incomplete`（P0-1 缺口未关）还是 `fail`？
   07 必须明确“继承来源”和“未覆盖项”，不能把历史 `pass` 直接当本轮 `pass`。
2. **主动停止的契约**：02 已判 NOT EXPRESSIBLE；是否批准 08 的最小 `stop?` 字段（`no-progress` /
   `reset-exhaustion` / `wait-limit` / `jump-exhaustion` / `scenario-timeout` / `action-timeout` /
   `actions-exhausted`），还是降级为 `timeout` + trace + 事后 `AGENT_LIMITATION`？未裁定前 05 不能开工。
3. **dangers 的判据**：确认 `periodMs` = 安全窗口、`activeMs` = 喷发、完整周期 = 两者之和；
   `t` = 场景启动后毫秒累计、命中不复位、重载归零。字段缺失/周期非法时是“保守等待”还是
   “退回 state-only”？盒足迹用 `d.box` 还是 sprite body？
4. **纵向巡逻**：把三角波推广到 `axis:"y"`，还是采用更保守的“带外等待/不进入”？纵向运动与
   重力、跳跃滞空如何交互？是否需要平台几何作为“可达性证据”？
5. **`pickupAbove` 可达性**：平台几何、跳跃包络、还是“只追必需目标”？不可达时是跳过、等待，
   还是报 `AGENT_LIMITATION`？
6. **无进展/重复重置的阈值**：步数制（不用墙钟）的具体窗口；进展度量用最大 x、collected、
   还是目标状态；达到阈值后是主动 stop 还是让归因落 `AGENT_LIMITATION`/`TIMEOUT`？
7. **等待上限**：独立步数/时长；超限后是继续前进、跳过目标，还是 stop？
8. **跳跃验证**：用 `onFloor`/`vy`/位置变化确认“跳发生了”；单次尝试上限、连续失败后的动作；
   是否要把“观察到的跳跃”写进 `actions[]` 或 trace（不扩契约的前提下）。
9. **§7.5/§8.4 的记录缺口**：本轮按 Q8(b) 只记录为已知限制（07 用 effort 脚本机械核验），
   还是另开票加固产品路径（review-verdict 接受 `--review-record`、visualReview 存 subject、
   delivery.evidence 存 sha256、consistency 比对 review-record）？
10. **视觉审核覆盖**：FA-04 的 6 项是否足以满足 §7.3 的 7 项？若不足，是补一次针对 7 项的人工审核，
    还是在 07 报告中逐项给出“6 项 → 7 项”的映射并披露缺口？
11. **五态 E2E**：是否要求 04/05 新增一个自动化（或半自动）harness 测试，把 5 个场景全部跑一遍？
    这可能引入浏览器依赖，需要 03 裁定是否值得。
12. **site 原始字节的身份粒度**：delivery 身份只到 site version + shell + config/pack checksum；
    07 是否应在 effort 脚本里额外比对 site 四文件哈希（`site-integrity.json` 已提供四文件哈希）？

---

## 12. 本次审计的限制

- **没有跑真实浏览器**：所有“真实运行”结论来自已落盘的历史产物（FA-02/FA-04/FA-06）；
  本审计只重跑了离线测试与 typecheck。
- **没有重写任何历史目录**：`consistency.mjs`、`capture.mjs`、`build-materials.mjs` 都没有重跑，
  因为它们会写文件；FA-05 consistency 12/12 是读取历史 `consistency.json` + 本次独立重算关键字段。
- **“证据存在”≠“证据可继承”**：本审计已对 80/80、44/44、36/36 做逐文件 sha256 核验；
  但视觉审的是人判断，不是机器相似度；`reviewer` 是会话标识，不是可独立核验的个人身份。
- **6 项 ≠ §7.3 的 7 项**：FA-04 审核清单来自 FR-04/P0-06；v7.6 §7.3 的“可读性 / 动画表现 /
  玩法与视觉对应 / 整体完成度”没有逐项记录。继承视觉 pass 时不能扩大解释。
- **截图数量措辞**：9 个截图文件里 `08-goal.png` 与 `09-final.png` 字节相同（同一终态静止画面），
  实质是 8 个不同画面；不影响版本绑定，但报告不应声称 9 个不同画面。
- **历史 `x=813` 叙述**：只找到历史 trace/旧 map 的间接痕迹；当前保留的失败样本是 x=438 / 19 reset。
- **未验证跨机器/跨 Chrome 版本的可复现性**：历史运行是同一台机器、同一 Chrome；本轮没有重跑浏览器，
  因此“同一状态序列决定相同”的确定性只在离线测试与历史运行内成立。
