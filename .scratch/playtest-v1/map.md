# Playtest V1：可复现试玩与失败归因

Labels: wayfinder:map
Tracker: local-markdown
Effort: playtest-v1

> **本图 2026-10-27 开。** 输入：`docs/v7.4/试玩.md`（Playtest V1「可复现试玩与失败归因」）。
> **收口形态（用户 2026-10-27 逐字裁定）**：**(a) 承载执行** —— 每张票 = 一段实现或一个决策，
> 收口到代码 + 测试 + 真实产物验收，与 `fpvs-v1-p0` / `fpvs-v1-p1` 一致；完成条件即验收判据。
> **方向裁定（用户 2026-10-27 逐字）**：
>   **(b) 新 harness 取代 smoke** —— 不两套试玩机制 / 两份结果 / 两种消费者长期分叉；
>   **(a) 观测以只读外部为主、会话内打点为辅、排除外壳埋点** —— 明确接受外部轮询无法捕获所有瞬时事件；
>   **(a) 只横版** —— 收敛首版验证面，塔防不纳入本轮；
>   **(a) 五态一等归因** —— 试玩归因必须能表达「代理限制」，不能把代理失败直接算成游戏失败；
>   **(a) 词汇捡回并重定义** —— 保持设计连续性，但旧定义不自动继承。
> **前置（继承，不重开）**：`fpvs-v1-p1` 收口态 —— 交付报告 `playable-smoke` 检查项已由 `mapPlayableSmoke`
> 消费现有 `playable-smoke.mjs` 的 `result.json`（三档归因、永不产 AGENT_LIMITATION）。本图**取代**那条
> smoke 链路，交付契约只加性扩展、不破坏 `playable-smoke` 键。

## Destination

建立**可复现试玩与失败归因**（Playtest V1）：用一套新 `playtest` harness **取代**现有 `playable-smoke.mjs`，
把「检查能否启动 / 完成部分操作」推进到「执行固定场景、结构化观测运行事件与状态、区分游戏缺陷 /
环境故障 / 代理限制 / 超时，并生成可复现、可回归的试玩报告」，接入现有 QA / delivery 报告。
离线测试覆盖**成功、游戏失败、环境故障、代理限制、超时**五种结果，每种都有明确判定 + 证据，
不出现未知状态被误判为通过。

## Notes

- **输入（只读）**：`docs/v7.4/试玩.md` 是需求规格；`CONTEXT.md` 是领域词汇唯一权威（`docs/文档.md` 是旧规格）。
- **词汇捡回（Q6 已定）**：从 `CONTEXT.md`「已出局」区捡回 `Runtime Observation / RuntimeEntity / Runtime Event Log /
  Runtime Black Box / Semantic Test Action / GameplayTestPlan / Critical Path / Evidence`，**按本图裁定重定义**，
  旧定义（闭环模型时代）不自动继承。落点：场景契约 → `Semantic Test Action` / `GameplayTestPlan` / `Critical Path`；
  观测 → `Runtime Observation` / `Runtime Event Log` / `Runtime Black Box`。
- **观测红线（Q3 已定）**：只读外部（轮询状态差推事件）为主、会话内打点（钩场景方法）为辅、**外壳零改动**
  （`SHELL_VERSION` 不升、站点字节不动）；**接受轮询漏「同一帧内发生又消失」的瞬时事件**，并把这种漏采
  归为 [[结构性不可判]] 而非补造证据。
- **五态一等（Q5 已定）**：归因必须可表达「代理限制」，不得把代理失败算成游戏失败；沿用 [[观察 / 判据]]
  边界（判据阻断、观察只报），试玩观测是**证据**不是新判据，不擅自扩大质量门禁。
- **零付费 / 离线优先**：验收复用现有真实产物，不因试玩重复付费生图、不新增付费调用。
- **交付契约稳定**：`qa-report/v1` 的 `delivery` 只加性扩展（沿用 fpvs-v1-p1「可选子对象 + 固定注册表 + 不升版」），
  `playable-smoke` 键与既有 schema 不破坏。
- **工作树纪律**：不改既有 `fixtures/`（唯一加性例外：可新增 `fixtures/playtest-baselines/` 及其基线文件，
  **不得修改、删除或重写既有 fixture**）、不改 `game-maker.local.json`；不 `reset`/`clean`；不提交/推送除非单独授权；
  测试产物只写 `out/` 或本 effort 目录。
- **证据分级**：E0 推测 / E1 源码 / E2 测试 / E3 真实产物 + 运行证据（命令 + 退出码 + 路径）。

## Decisions so far

<!-- the index: one line per closed ticket -->

- [01 只读审计](issues/01-readonly-audit.md)：**已收口** —— 现有试玩链路 / READ_STATE 观测面 / 交付消费点 /
  已出局词汇史 / 证据分级全量盘点。关键结论：真实管线不跑 smoke（`playable-smoke` 写死 blocked/incomplete）、
  `mapPlayableSmoke` 唯一消费者是手动 `acceptance.mjs`、回归基线与重放完全不存在、两套真相字段漂移。
  审计全案：[research/audit.md](research/audit.md)。→ 解除 02 / 03 阻塞。
- [03 运行事件与状态的结构化观测](issues/03-runtime-observation.md)：**已收口** —— 观测 = 边-快照二分 + 11 类闭事件集
  + 断言级三值（`pass`/`fail`/`unknown`，unknown 一等、非 fail 兜底）+ `events.jsonl`（v1 字段 + `source` 真实性 +
  `actor` 非稳定 ID + `params` 按类型 schema）+ **v1 零会话内打点**（机制保留，将来由真实证据缺口驱动重开）+
  逐事件三值可判性表（计数级可判、帧级被迫 unknown）+ 两处收紧（`scene-ready` 永不 ready ≠ fail、由票 04 定；
  `runtime-error` 只算 harness 实际捕获到的错误）。→ **解除 [02 试玩场景契约](issues/02-scenario-contract.md)
  断言语义 + 场景集阻塞**。
- [02 试玩场景契约 + 版本绑定](issues/02-scenario-contract.md)：**已收口** —— 声明式数据契约 + 薄解释器 · 语义动作
  （`Semantic Test Action`）· 版本绑定（场景格式版本 + 目标 site 版本，pack/config 经 site 依赖验证，默认拒绝）·
  断言模型（结构化匹配器 + `onInsufficient:"unknown"` 不可配；闭集三类 state/event/invariant；`fail` 双重门槛 =
  证据充分 **且** 否定条件在窗口内可判；`fail > unknown > pass`）· 首版五场景集（一态一个）+ 现有 smoke 分层保留。
  **关键维度分离**：场景预期结果（`expectedOutcome`，设计意图）/ 实际试玩结果（证据独立归因）/ 基线资格
  （`baselineEligible`，独立论证）三者互不推导。→ 解除 [04](issues/04-failure-attribution.md) /
  [05](issues/05-replay-baseline.md) 阻塞。

- [04 失败归因规则（五态一等）](issues/04-failure-attribution.md)：**已收口** —— 归因 = 证据独立的阶段化纯函数
  （只吃运行证据、不吃 `expectedOutcome`/场景名）：五态 `SUCCESS / GAMEPLAY_FAILURE / ENVIRONMENT_FAILURE /
  AGENT_LIMITATION / TIMEOUT` + `UNKNOWN`（归因不成立，非第六种原因）+ 独立 `not-executed`；`TIMEOUT` 只在
  `execute`、`boot` 只出环境故障/`UNKNOWN`；超时与结构性不可判主因不可分时 `UNKNOWN` 优先。游戏失败三类实锤
  统一加**环境健康前置门**（runtime-error 须判来源/严重性）；代理限制解除「永不产」，须正面可复现的能力边界证据
  （动作轨迹 + 能力几何矛盾 + 探索耗尽），永不映射 fail/pass；`SUCCESS` 须 ≥1 实质断言求值 pass + 终止条件达成
  （禁止空断言真空通过）；**已知代理限制阻止自动 pass**，`knownLimitations` 不换状态、`not-required` 不绕必需项。
  交付映射 `SUCCESS→pass / GAMEPLAY_FAILURE→fail / ENVIRONMENT_FAILURE·not-executed→blocked /
  TIMEOUT·AGENT_LIMITATION·UNKNOWN→incomplete`，verdict 总序不变；聚合区分执行结果与执行资格（必需场景未执行
  不得 pass，确定性 fail 不因未执行降级）。证据一律要求**可追溯到本次执行的 E3**（命令/退出码/路径/身份绑定）；
  `UNKNOWN` 须结构化 `InsufficientEvidence`（ruleId + missingObservation + affectedAssertionIds + explanation）。
  Harness 只产证据与归因，`mapPlaytest` 纯映射、`buildDeliveryReport` 重算 verdict，harness 不写交付结论。
  → 解除 [06](issues/06-delivery-integration.md) 阻塞；键名/schema/迁移归 06。
- [05 可重放测试 + 回归基线](issues/05-replay-baseline.md)：**已收口** —— 三层分工（语义重跑 = 回归基础 /
  操作轨迹重放 = 诊断，`input.jsonl` 不得当判定依据 / 证据级比较 = 比较器）· 判定确定性契约（outcome + 断言三值 +
  离散终态 + 显式覆盖且证据充分的规范化事件计数必须一致；位置/时间戳/事件顺序/截图可抖动；动作按观测步、
  固定轮询与时限、固定 Chrome 配置、去掉影响决策的墙钟判断；v1 无随机种子）· 基线 = 自足 JSON
  （`baselineFormatVersion` + `identity` + `coverage` + `expected` + `source`）放 `fixtures/playtest-baselines/`
  （工作树纪律加性例外）· 晋升须连续两次干净运行 + 人工显式 + 审计；允许记录非 SUCCESS 的已接受行为；
  禁自动新建/覆盖 · 比较三值 `match / changed / not-comparable`，**纯观察**：不改 outcome、断言三值、
  `DeliveryCheckStatus`、`DeliveryVerdict`；「回归失败」唯一来源仍是契约断言 + 票 04 归因；
  不稳定覆盖字段降级为观察并留审计。→ 解除 Harness 实现（07/08 可开工；交付接入层待 06）。
- [06 交付接入（取代 playable-smoke）](issues/06-delivery-integration.md)：**已收口** —— 保留 `playable-smoke` 键
  （label 改「试玩」、`delivery.playtest` 可选摘要、必需项不得绕过、旧报告可读且旧结果不升级）· 独立 CLI
  `game-maker playtest <run>`（create/build 零 Chrome、无 MCP）· `run/v<N>/playtest/v<K>/` 版本化 attempt、
  只吃 run 目录、严格身份校验 · 退出码 0/1/2/4（0 须试玩成功且写回成功）· 写回只动 check/summary/verdict、
  `playtest-*` 证据替换、身份不匹配不污染 delivery、原子提交 + `writeback-error.json` · 聚合
  `GAMEPLAY_FAILURE > ENVIRONMENT_FAILURE > TIMEOUT > AGENT_LIMITATION > UNKNOWN > SUCCESS`，必需场景未执行
  不得 pass（fail 优先），`aggregate=SUCCESS` 不等于 pass · 真实产物零付费验收（历史产物沙箱副本；必须证明
  真实游戏执行，Chrome 缺失只记 incomplete 且非 0 退出）· smoke 本 effort 末尾硬切（实现退役、历史契约保留）。
  → 解除 07；08/09 范围扩展（交付接入执行层 / 真实验收与旧报告兼容）。
- [07 Harness 核心与观测](issues/07-playtest-harness-core.md)：**已收口** —— 契约（`playtest-report/v1` /
  `playtest-scenario/v1` / `delivery.playtest` 摘要 / 11 类事件按类型 `params` / `input`）+ 纯映射聚合 +
  harness（版本绑定、状态差观测、步进决策、`events/trace/input/result`、`site-integrity`）+ 五态场景文件 +
  零付费真实产物两次运行 `determinism.same=true`、站点字节未改；真实 run 未通关只记 `unknown`（五态归因归 08）。
  → 解除 08；09 待 08。
- [08 五态归因器（阶段化决策 + 证据最小集）](issues/08-attribution-engine.md)：**已收口** —— 纯函数
  `attribute` 阶段化决策（prepare/boot/execute/evaluate）· 五态 + `UNKNOWN` + 独立 `not-executed` · 环境健康前置门 ·
  runtime-error 来源判定 · 初始态/invariant/win-contract 游戏失败 · `AGENT_LIMITATION` 正面证据 · `SUCCESS` 门槛 ·
  结构化 `InsufficientEvidence` · 聚合优先级 · CLI `game-maker playtest <run>` + `run/v<N>/playtest/v<K>/` attempt +
  `applyPlaytest`/`writePlaytestToReport` 原子写回/证据替换/幂等/身份拒写 · 真实产物 E2E = `AGENT_LIMITATION → incomplete`
  （exit 1，站点字节未改、QA 层保留）· 全仓 2123 测试绿。→ 解除 09；smoke 退役/自测/CONTEXT 拆到
  [10](issues/10-smoke-retirement.md)（09 验收后硬切）。

## Not yet specified

<!-- in-scope fog that graduates as the frontier advances -->

（无）—— 06 收口后交付接入/契约字段毕业为 07/08/09；08 收口后 smoke 退役、自测迁移、CONTEXT.md 词条毕业为
[10](issues/10-smoke-retirement.md)。剩余风险（真实运行能否稳定产出某态、Chrome 可用性）属于实施验收的观察项，不是未指定决策。

## Out of scope

<!-- work ruled beyond the destination; closed, never graduates -->

- **塔防试玩**（Q4 已定）：只横版，塔防的 `mechanic-probe` / `td-balance` / `td-sweep` 照旧，不纳入本图。
- **spec §明确不做**：不新增游戏机制 · 不重写 Runtime Shell（含不埋事件、`SHELL_VERSION` 不升）·
  不引入自主 AI 修复循环 · 不把所有试玩未完成统一判定为游戏失败 · 不改动现有资源包与交付契约中已稳定的部分。
- **P1 视觉一致性验收 V1** · **P2 失败定位与低成本重跑** · **自动修复与自我进化**（继承 fpvs-v1-p1 的 Out of scope）。
